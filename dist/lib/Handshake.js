'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _ChunkingStream = require('./ChunkingStream');

var _ChunkingStream2 = _interopRequireDefault(_ChunkingStream);

var _logger = require('../lib/logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
* 
*
*/

var logger = _logger2.default.createModuleLogger(module);
/*
 Handshake protocol v1

 1) Socket opens:

 2) Server responds with 40 bytes of random data as a nonce.
 Device should read exactly 40 bytes from the socket.
 Timeout: 30 seconds.  If timeout is reached, Device must close TCP socket
 and retry the connection.

 Device appends the 12-byte STM32 Unique ID to the nonce,
 RSA encrypts the 52-byte message with the Server's public key,
 and sends the resulting 256-byte ciphertext to the Server.
 The Server's public key is stored on the external flash chip at address TBD.
 The nonce should be repeated in the same byte order it arrived (FIFO)
 and the STM32 ID should be appended in the same byte order as the memory addresses:
 0x1FFFF7E8, 0x1FFFF7E9, 0x1FFFF7EA… 0x1FFFF7F2, 0x1FFFF7F3.

 3) Server should read exactly 256 bytes from the socket.
 Timeout waiting for the encrypted message is 30 seconds.
 If the timeout is reached, Server must close the connection.

 Server RSA decrypts the message with its private key.  If the decryption fails,
 Server must close the connection.
 Decrypted message should be 52 bytes, otherwise Server must close the connection.
 The first 40 bytes of the message must match the previously sent nonce,
 otherwise Server must close the connection.
 Remaining 12 bytes of message represent STM32 ID.
 Server looks up STM32 ID, retrieving the Device's public RSA key.
 If the public key is not found, Server must close the connection.

 4) Server creates secure session key
 Server generates 40 bytes of secure random data to serve as components of a session key
 for AES-128-CBC encryption.
 The first 16 bytes (MSB first) will be the key, the next 16 bytes (MSB first)
 will be the initialization vector (IV), and the final 8 bytes (MSB first) will be the salt.
 Server RSA encrypts this 40-byte message using the Device's public key
 to create a 128-byte ciphertext.
 Server creates a 20-byte HMAC of the ciphertext using SHA1 and the 40 bytes generated
 in the previous step as the HMAC key.
 Server signs the HMAC with its RSA private key generating a 256-byte signature.
 Server sends 384 bytes to Device: the ciphertext then the signature.

 5) Release control back to the Device module
 Device creates a protobufs Hello with counter set to the uint32
 represented by the most significant 4 bytes of the IV,
 encrypts the protobufs Hello with AES, and sends the ciphertext to Server.
 Server reads protobufs Hello from socket, taking note of counter.
 Each subsequent message received from Device must have the counter incremented by 1.
 After the max uint32, the next message should set the counter to zero.

 Server creates protobufs Hello with counter set to a random uint32,
 encrypts the protobufs Hello with AES, and sends the ciphertext to Device.
 Device reads protobufs Hello from socket, taking note of counter.
 Each subsequent message received from Server must have the counter incremented by 1.
 After the max uint32, the next message should set the counter to zero.
*/

var NONCE_BYTES = 40;
var ID_BYTES = 12;
var SESSION_BYTES = 40;
var GLOBAL_TIMEOUT = 10;
var DECIPHER_STREAM_TIMEOUT = 30;

var Handshake = function Handshake(cryptoManager) {
  var _this = this;

  (0, _classCallCheck3.default)(this, Handshake);
  this._useChunkingStream = true;

  this.start = function () {
    var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(device) {
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _this._device = device;
              _this._socket = device._socket;

              return _context.abrupt('return', _promise2.default.race([_this._runHandshake(), _this._startGlobalTimeout()]).catch(function (error) {
                var logInfo = {
                  cache_key: _this._device && _this._device._connectionKey,
                  deviceID: _this._deviceID || null,
                  ip: _this._socket && _this._socket.remoteAddress ? _this._socket.remoteAddress.toString() : 'unknown'
                };

                logger.error({ err: error, logInfo: logInfo }, 'Handshake failed');

                throw error;
              }));

            case 3:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, _this);
    }));

    return function (_x) {
      return _ref.apply(this, arguments);
    };
  }();

  this._runHandshake = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2() {
    var nonce, data, _ref3, deviceID, deviceProvidedPem, publicKey, _ref4, cipherStream, decipherStream, handshakeBuffer;

    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return _this._sendNonce();

          case 2:
            nonce = _context2.sent;
            _context2.next = 5;
            return _this._onSocketDataAvailable();

          case 5:
            data = _context2.sent;
            _context2.next = 8;
            return _this._readDeviceHandshakeData(nonce, data);

          case 8:
            _ref3 = _context2.sent;
            deviceID = _ref3.deviceID;
            deviceProvidedPem = _ref3.deviceProvidedPem;

            _this._deviceID = deviceID;
            _context2.next = 14;
            return _this._getDevicePublicKey(deviceID, deviceProvidedPem);

          case 14:
            publicKey = _context2.sent;
            _context2.next = 17;
            return _this._sendSessionKey(publicKey);

          case 17:
            _ref4 = _context2.sent;
            cipherStream = _ref4.cipherStream;
            decipherStream = _ref4.decipherStream;
            _context2.next = 22;
            return _promise2.default.race([_this._onDecipherStreamReadable(decipherStream), _this._onDecipherStreamTimeout()]);

          case 22:
            handshakeBuffer = _context2.sent;

            if (handshakeBuffer) {
              _context2.next = 25;
              break;
            }

            throw new Error('wrong device public keys');

          case 25:
            return _context2.abrupt('return', {
              cipherStream: cipherStream,
              decipherStream: decipherStream,
              deviceID: deviceID,
              handshakeBuffer: handshakeBuffer
            });

          case 26:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, _this);
  }));

  this._startGlobalTimeout = function () {
    return new _promise2.default(function (resolve, reject) {
      setTimeout(function () {
        return reject(new Error('Handshake did not complete in ' + GLOBAL_TIMEOUT + ' seconds'));
      }, GLOBAL_TIMEOUT * 1000);
    });
  };

  this._onSocketDataAvailable = function () {
    return new _promise2.default(function (resolve, reject) {
      var onReadable = function onReadable() {
        try {
          var _data = _this._socket.read();

          if (!_data) {
            logger.error('onSocketData called, but no data sent.');
            reject(new Error('onSocketData called, but no data sent.'));
          }

          resolve(_data);
        } catch (error) {
          logger.error({ err: error }, 'Handshake: Exception thrown while processing data');
          reject(error);
        }

        _this._socket.removeListener('readable', onReadable);
      };
      _this._socket.on('readable', onReadable);
    });
  };

  this._sendNonce = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3() {
    var nonce;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return _this._cryptoManager.getRandomBytes(NONCE_BYTES);

          case 2:
            nonce = _context3.sent;

            _this._socket.write(nonce);

            return _context3.abrupt('return', nonce);

          case 5:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, _this);
  }));

  this._readDeviceHandshakeData = function () {
    var _ref6 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee4(nonce, data) {
      var decryptedHandshakeData, nonceBuffer, deviceIDBuffer, deviceKeyBuffer, deviceProvidedPem, deviceID;
      return _regenerator2.default.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              decryptedHandshakeData = _this._cryptoManager.decrypt(data);

              if (decryptedHandshakeData) {
                _context4.next = 3;
                break;
              }

              throw new Error('handshake data decryption failed. ' + 'You probably have incorrect server key for device');

            case 3:
              if (!(decryptedHandshakeData.length < NONCE_BYTES + ID_BYTES)) {
                _context4.next = 5;
                break;
              }

              throw new Error('handshake data was too small: ' + decryptedHandshakeData.length);

            case 5:
              nonceBuffer = new Buffer(NONCE_BYTES);
              deviceIDBuffer = new Buffer(ID_BYTES);
              deviceKeyBuffer = new Buffer(decryptedHandshakeData.length - (NONCE_BYTES + ID_BYTES));


              decryptedHandshakeData.copy(nonceBuffer, 0, 0, NONCE_BYTES);
              decryptedHandshakeData.copy(deviceIDBuffer, 0, NONCE_BYTES, NONCE_BYTES + ID_BYTES);
              decryptedHandshakeData.copy(deviceKeyBuffer, 0, NONCE_BYTES + ID_BYTES, decryptedHandshakeData.length);

              if (nonceBuffer.equals(nonce)) {
                _context4.next = 13;
                break;
              }

              throw new Error('nonces didn`t match');

            case 13:
              deviceProvidedPem = _this._convertDERtoPEM(deviceKeyBuffer);
              deviceID = deviceIDBuffer.toString('hex');
              return _context4.abrupt('return', { deviceID: deviceID, deviceProvidedPem: deviceProvidedPem });

            case 16:
            case 'end':
              return _context4.stop();
          }
        }
      }, _callee4, _this);
    }));

    return function (_x2, _x3) {
      return _ref6.apply(this, arguments);
    };
  }();

  this._convertDERtoPEM = function (buffer) {
    if (!buffer || !buffer.length) {
      return null;
    }

    var bufferString = buffer.toString('base64');
    try {
      var lines = ['-----BEGIN PUBLIC KEY-----'].concat((0, _toConsumableArray3.default)(bufferString.match(/.{1,64}/g) || []), ['-----END PUBLIC KEY-----']);
      return lines.join('\n');
    } catch (error) {
      logger.error({ bufferString: bufferString, err: error }, 'error converting DER to PEM');
    }
    return null;
  };

  this._getDevicePublicKey = function () {
    var _ref7 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee5(deviceID, deviceProvidedPem) {
      var publicKey;
      return _regenerator2.default.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              _context5.next = 2;
              return _this._cryptoManager.getDevicePublicKey(deviceID);

            case 2:
              publicKey = _context5.sent;

              if (publicKey) {
                _context5.next = 5;
                break;
              }

              throw new Error('no public key found for device: ' + deviceID);

            case 5:
              if (publicKey.equals(deviceProvidedPem)) {
                _context5.next = 7;
                break;
              }

              throw new Error("key passed to device during handshake doesn't" + ('match saved public key: ' + deviceID));

            case 7:
              return _context5.abrupt('return', publicKey);

            case 8:
            case 'end':
              return _context5.stop();
          }
        }
      }, _callee5, _this);
    }));

    return function (_x4, _x5) {
      return _ref7.apply(this, arguments);
    };
  }();

  this._sendSessionKey = function () {
    var _ref8 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee6(devicePublicKey) {
      var sessionKey, ciphertext, hash, signedhmac, message, decipherStream, cipherStream, chunkingIn, chunkingOut;
      return _regenerator2.default.wrap(function _callee6$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              _context6.next = 2;
              return _this._cryptoManager.getRandomBytes(SESSION_BYTES);

            case 2:
              sessionKey = _context6.sent;


              // Server RSA encrypts this 40-byte message using the Device's public key to
              // create a 128-byte ciphertext.
              ciphertext = devicePublicKey.encrypt(sessionKey);

              // Server creates a 20-byte HMAC of the ciphertext using SHA1 and the 40
              // bytes generated in the previous step as the HMAC key.

              hash = _this._cryptoManager.createHmacDigest(ciphertext, sessionKey);

              // Server signs the HMAC with its RSA private key generating a 256-byte
              // signature.

              _context6.next = 7;
              return _this._cryptoManager.sign(hash);

            case 7:
              signedhmac = _context6.sent;


              // Server sends ~384 bytes to Device: the ciphertext then the signature.
              message = Buffer.concat([ciphertext, signedhmac], ciphertext.length + signedhmac.length);
              decipherStream = _this._cryptoManager.createAESDecipherStream(sessionKey);
              cipherStream = _this._cryptoManager.createAESCipherStream(sessionKey);


              if (_this._useChunkingStream) {
                chunkingIn = new _ChunkingStream2.default({ outgoing: false });
                chunkingOut = new _ChunkingStream2.default({ outgoing: true });

                // What I receive gets broken into message chunks, and goes into the
                // decrypter

                _this._socket.pipe(chunkingIn);
                chunkingIn.pipe(decipherStream);

                // What I send goes into the encrypter, and then gets broken into message
                // chunks
                cipherStream.pipe(chunkingOut);
                chunkingOut.pipe(_this._socket);
              } else {
                _this._socket.pipe(decipherStream);
                cipherStream.pipe(_this._socket);
              }

              _this._socket.write(message);

              return _context6.abrupt('return', { cipherStream: cipherStream, decipherStream: decipherStream });

            case 14:
            case 'end':
              return _context6.stop();
          }
        }
      }, _callee6, _this);
    }));

    return function (_x6) {
      return _ref8.apply(this, arguments);
    };
  }();

  this._onDecipherStreamReadable = function (decipherStream) {
    return new _promise2.default(function (resolve) {
      var callback = function callback() {
        var chunk = decipherStream.read();
        resolve(chunk);
        decipherStream.removeListener('readable', callback);
      };
      decipherStream.on('readable', callback);
    });
  };

  this._onDecipherStreamTimeout = function () {
    return new _promise2.default(function (resolve, reject) {
      return setTimeout(function () {
        return reject();
      }, DECIPHER_STREAM_TIMEOUT * 1000);
    });
  };

  this._cryptoManager = cryptoManager;
}

/**
 * base64 encodes raw binary into
 * "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDHzg9dPG03Kv4NkS3N0xJfU8lT1M+s9HTs75
    DE1tpwXfU4GkfaLLr04j6jFpMeeggKCgWJsKyIAR9CNlVHC1IUYeejEJQCe6JReTQlq9F6bioK
    84nc9QsFTpiCIqeTAZE4t6Di5pF8qrUgQvREHrl4Nw0DR7ECODgxc/r5+XFh9wIDAQAB"
 * then formats into PEM format:
 *
 * //-----BEGIN PUBLIC KEY-----
 * //MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDHzg9dPG03Kv4NkS3N0xJfU8lT
 * //1M+s9HTs75DE1tpwXfU4GkfaLLr04j6jFpMeeggKCgWJsKyIAR9CNlVHC1IUYeej
 * //EJQCe6JReTQlq9F6bioK84nc9QsFTpiCIqeTAZE4t6Di5pF8qrUgQvREHrl4Nw0D
 * //R7ECODgxc/r5+XFh9wIDAQAB
 * //-----END PUBLIC KEY-----
 */
;

exports.default = Handshake;