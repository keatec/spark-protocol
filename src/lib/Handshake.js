/*
*   Copyright (c) 2015 Particle Industries, Inc.  All rights reserved.
*
*   This program is free software; you can redistribute it and/or
*   modify it under the terms of the GNU Lesser General Public
*   License as published by the Free Software Foundation, either
*   version 3 of the License, or (at your option) any later version.
*
*   This program is distributed in the hope that it will be useful,
*   but WITHOUT ANY WARRANTY; without even the implied warranty of
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
*   Lesser General Public License for more details.
*
*   You should have received a copy of the GNU Lesser General Public
*   License along with this program; if not, see <http://www.gnu.org/licenses/>.
*
* @flow
*
*/

import type SparkCore from '../clients/SparkCore';
import type {Socket} from 'net';
import type {Duplex} from 'stream';

import CryptoLib from './ICrypto';
import utilities from './utilities';
import ChunkingStream from './ChunkingStream';
import logger from './logger';
import buffers from 'h5.buffers';
import nullthrows from 'nullthrows';

/*
 Handshake protocol v1

 1.) Socket opens:

 2.) Server responds with 40 bytes of random data as a nonce.
     * Core should read exactly 40 bytes from the socket.
     Timeout: 30 seconds.  If timeout is reached, Core must close TCP socket and retry the connection.

     * Core appends the 12-byte STM32 Unique ID to the nonce, RSA encrypts the 52-byte message with the Server's public key,
     and sends the resulting 256-byte ciphertext to the Server.  The Server's public key is stored on the external flash chip at address TBD.
     The nonce should be repeated in the same byte order it arrived (FIFO) and the STM32 ID should be appended in the
     same byte order as the memory addresses: 0x1FFFF7E8, 0x1FFFF7E9, 0x1FFFF7EA… 0x1FFFF7F2, 0x1FFFF7F3.

 3.) Server should read exactly 256 bytes from the socket.
     Timeout waiting for the encrypted message is 30 seconds.  If the timeout is reached, Server must close the connection.

     * Server RSA decrypts the message with its private key.  If the decryption fails, Server must close the connection.
     * Decrypted message should be 52 bytes, otherwise Server must close the connection.
     * The first 40 bytes of the message must match the previously sent nonce, otherwise Server must close the connection.
     * Remaining 12 bytes of message represent STM32 ID.  Server looks up STM32 ID, retrieving the Core's public RSA key.
     * If the public key is not found, Server must close the connection.

 4.) Server creates secure session key
     * Server generates 40 bytes of secure random data to serve as components of a session key for AES-128-CBC encryption.
     The first 16 bytes (MSB first) will be the key, the next 16 bytes (MSB first) will be the initialization vector (IV), and the final 8 bytes (MSB first) will be the salt.
     Server RSA encrypts this 40-byte message using the Core's public key to create a 128-byte ciphertext.
     * Server creates a 20-byte HMAC of the ciphertext using SHA1 and the 40 bytes generated in the previous step as the HMAC key.
     * Server signs the HMAC with its RSA private key generating a 256-byte signature.
     * Server sends 384 bytes to Core: the ciphertext then the signature.


 5.) Release control back to the SparkCore module

     * Core creates a protobufs Hello with counter set to the uint32 represented by the most significant 4 bytes of the IV, encrypts the protobufs Hello with AES, and sends the ciphertext to Server.
     * Server reads protobufs Hello from socket, taking note of counter.  Each subsequent message received from Core must have the counter incremented by 1. After the max uint32, the next message should set the counter to zero.

     * Server creates protobufs Hello with counter set to a random uint32, encrypts the protobufs Hello with AES, and sends the ciphertext to Core.
     * Core reads protobufs Hello from socket, taking note of counter.  Each subsequent message received from Server must have the counter incremented by 1. After the max uint32, the next message should set the counter to zero.
     */

type HandshakeStage =
  'done' |
  'get-core-key' |
  'get-hello' |
  'read-core-id' |
  'send-hello' |
  'send-nonce' |
  'send-session-key';

//statics
const NONCE_BYTES = 40;
const ID_BYTES = 12;
const SESSION_BYTES = 40;
const GLOBAL_TIMEOUT = 10;

class Handshake {
  _client: SparkCore;
  _socket: Socket;
  _handshakeStage: HandshakeStage = 'send-nonce';
  _reject: ?Function;
  _deviceID: string = '';
  _pendingBuffers: Array<Buffer> = [];
  _useChunkingStream: boolean = true;

  constructor(client: SparkCore) {
    this._client = client;
    this._socket = client._socket;
  }

  start = async (): Promise<*> => {
    return Promise.race([
      this._runHandshake(),
      this._startGlobalTimeout(),
      new Promise((resolve, reject) => this._reject = reject),
    ]).catch((message) => {
      var logInfo = {
        cache_key: this._client && this._client._connectionKey,
        ip: this._socket && this._socket.remoteAddress
          ? this._socket.remoteAddress.toString()
          : 'unknown',
        deviceID: this._deviceID ? this._deviceID.toString('hex') : null,
      };

      logger.error('Handshake failed: ', message, logInfo);

      throw message;
    });
  };

  _runHandshake = async (): Promise<*> => {
    try {
      const dataAwaitable = this._onSocketDataAvailable();
      const nonce = await this._sendNonce();
      const data = await dataAwaitable;
      const deviceProvidedPem = this._readDeviceID(nonce, data);
      const publicKey = this._getDeviceKey(nullthrows(deviceProvidedPem));
      const {
        cipherStream,
        decipherStream,
        sessionKey,
      } = await this._sendSessionKey(publicKey);

      const handshakeBuffer = await Promise.race([
        this._onDecipherStreamReadable(decipherStream),
        this._onDecipherStreamTimeout(),
      ]);
      this._finished();
      return {
        deviceID: this._deviceID,
        cipherStream,
        decipherStream,
        handshakeBuffer,
        pendingBuffers: [...this._pendingBuffers],
        sessionKey,
      };
    } catch (error) {
      logger.error(`runHandshakeError(): ${error}`);
      throw error;
    }
  };

  _startGlobalTimeout = (): Promise<*> => {
    return new Promise((resolve, reject) => {
      setTimeout(
        () => reject(`Handshake did not complete in ${GLOBAL_TIMEOUT} seconds`),
        GLOBAL_TIMEOUT * 1000,
      );
    });
  };

  _onSocketDataAvailable = (): Promise<Buffer> => {
    return new Promise((resolve, reject): void => {
      const onReadable = (): void => {
        const data = ((this._socket.read(): any): Buffer);
        try {
          if (!data) {
            logger.log('onSocketData called, but no data sent.');
            reject();
          }

          resolve(data);
        } catch (exception) {
          logger.log('Handshake: Exception thrown while processing data');
          logger.error(exception);
          reject();
        }

        this._socket.removeListener('readable', onReadable);
      };
      this._socket.on('readable', onReadable);
    });
  };

  _sendNonce = async (): Promise<Buffer> => {
    this._handshakeStage = 'send-nonce';

    const nonce = await CryptoLib.getRandomBytes(NONCE_BYTES);
    this._socket.write(nonce);

    return nonce;
  };

  // TODO wrong method name? it read deviceID alongside with
  // deviceKey? and returns deviceProvidedPem
  _readDeviceID = (nonce: Buffer, data: Buffer): ?string => {
    //server should read 256 bytes
    //decrypt msg using server private key
    let plaintext;
    try {
      plaintext = CryptoLib.decrypt(CryptoLib.getServerKeys(), data);
    } catch (error) {
      logger.error(`Handshake decryption error: ${error}`);
    }

    if (!plaintext) {
      this._handshakeFail('decryption failed');
      return '';
    }

    //plaintext should be 52 bytes, else fail
    if (plaintext.length < (NONCE_BYTES + ID_BYTES)) {
		  this._handshakeFail('plaintext was too small: ' + plaintext.length);
      return '';
    }

    //success
    const nonceBuffer = new Buffer(40);
    const deviceIDBuffer = new Buffer(12);

    plaintext.copy(nonceBuffer, 0, 0, 40);
    plaintext.copy(deviceIDBuffer, 0, 40, 52);

		const deviceKey = new Buffer(plaintext.length - 52);
		plaintext.copy(deviceKey, 0, 52, plaintext.length);
		const deviceProvidedPem = utilities.convertDERtoPEM(deviceKey);

    //nonces should match
    if (!utilities.bufferCompare(nonceBuffer, nonce)) {
      this._handshakeFail('nonces didn\'t match');
      return '';
    }

    this._deviceID = deviceIDBuffer.toString('hex');

    this._handshakeStage = 'read-core-id';

    return deviceProvidedPem;
  };

  // 4.) Read the public key from disk for this core
  // TODO do this with keys repository?
  _getDeviceKey = (deviceProvidedPem: string): Object => {
    const publicKey = utilities.get_core_key(this._deviceID);
    try {
      if (!publicKey) {
        this._handshakeFail(`couldn't find key for device: ${this._deviceID}`);
        if (deviceProvidedPem) {
          utilities.save_handshake_key(this._deviceID, deviceProvidedPem);
        }
        throw `Failed finding key for core: ${this._deviceID}`;
      }
    } catch (exception) {
      logger.error('Error handling get_corekey ', exception);
      this._handshakeFail(
        `Failed handling find key for core: ${this._deviceID}`,
      );
    }

    this._handshakeStage = 'get-core-key';
    return publicKey;
  };

  _sendSessionKey = async (
    devicePublicKey: Object,
  ): Object => {
    const sessionKey = await CryptoLib.getRandomBytes(SESSION_BYTES);

    // Server RSA encrypts this 40-byte message using the Core's public key to
    // create a 128-byte ciphertext.
    const ciphertext = CryptoLib.encrypt(devicePublicKey, sessionKey);

    // Server creates a 20-byte HMAC of the ciphertext using SHA1 and the 40
    // bytes generated in the previous step as the HMAC key.
    const hash = CryptoLib.createHmacDigest(ciphertext, sessionKey);

    // Server signs the HMAC with its RSA private key generating a 256-byte
    // signature.
    const signedhmac = CryptoLib.sign(null, hash);

    //Server sends ~384 bytes to Core: the ciphertext then the signature.
    const message = Buffer.concat(
      [ciphertext, signedhmac],
      ciphertext.length + signedhmac.length,
    );
    this._socket.write(message);

    const decipherStream = CryptoLib.CreateAESDecipherStream(sessionKey);
    const cipherStream = CryptoLib.CreateAESCipherStream(sessionKey);

    if (this._useChunkingStream) {
      const chunkingIn = new ChunkingStream({outgoing: false });
      const chunkingOut = new ChunkingStream({outgoing: true });

      // What I receive gets broken into message chunks, and goes into the
      // decrypter
      this._socket.pipe(chunkingIn);
      chunkingIn.pipe(decipherStream);

      // What I send goes into the encrypter, and then gets broken into message
      // chunks
      cipherStream.pipe(chunkingOut);
      chunkingOut.pipe(this._socket);
    } else {
      this._socket.pipe(decipherStream);
      cipherStream.pipe(this._socket);
    }

    this._handshakeStage = 'send-session-key';

    return {
      cipherStream,
      decipherStream,
      sessionKey,
    };
  };

  // TODO - Remove this callback once it resolves. When the stream is passed
  // into the SparkCore, it should be rebound there to listen for the keep-alive
  // pings.
  _onDecipherStreamReadable = (decipherStream: Duplex): Promise<*> => {
    return new Promise((resolve, reject) => {
      const callback = () => {
        const chunk = ((decipherStream.read(): any): Buffer);
        if (this._handshakeStage === 'send-hello') {
          this._queueEarlyData(this._handshakeStage, chunk);
        } else {
          resolve(chunk);
          decipherStream.removeListener('readable', callback);
        }
      };
      decipherStream.on('readable', callback);
    });
  };

  _queueEarlyData = (name: HandshakeStage, data: Buffer): void => {
    if (!data) {
      return;
    }
    this._pendingBuffers.push(data);
    logger.error('recovering from early data! ', {
      step: name,
      data: (data) ? data.toString('hex') : data,
      cache_key: this._client._connectionKey
    });
  };

  _onDecipherStreamTimeout = (): Promise<*> => {
    return new Promise(
      (resolve, reject) => setTimeout(() => reject(), 30 * 1000),
    );
  };

  _finished = (): void => {
    this._handshakeStage = 'done';
  };
/*
  _flushEarlyData = (): void => {
    if (!this._pendingBuffers) {
      return;
    }

    this._pendingBuffers.map(data => this._routeToClient(data));
    this._pendingBuffers = null;
  }

  _routeToClient = (data: Buffer): void => {
    if (!data) {
      return;
    }
    process.nextTick(() => this._client.routeMessage(data));
  }
*/
  _handshakeFail = (message: string): void => {
    this._reject && this._reject(message);
  }
}

export default Handshake;
