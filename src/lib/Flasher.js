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

import type {ReadStream} from 'fs';

import messages from './Messages';
import logger from '../lib/logger';
import utilities from '../lib/utilities';
import BufferStream from './BufferStream';
import SparkCore from '../clients/SparkCore';

import buffers from 'h5.buffers';
import {Message} from 'h5.coap';
import Option from 'h5.coap/lib/Option';
import crc32 from 'buffer-crc32';
import nullthrows from 'nullthrows';

//
//UpdateBegin — sent by Server to initiate an OTA firmware update
//UpdateReady — sent by Core to indicate readiness to receive firmware chunks
//Chunk — sent by Server to send chunks of a firmware binary to Core
//ChunkReceived — sent by Core to respond to each chunk, indicating the CRC of the received chunk data.  if Server receives CRC that does not match the chunk just sent, that chunk is sent again
//UpdateDone — sent by Server to indicate all firmware chunks have been sent
//

const CHUNK_SIZE = 256;
const MAX_CHUNK_SIZE = 594;
const MAX_MISSED_CHUNKS = 10;

class Flasher {
	_chunk: ?Buffer = null;
	_chunkSize: number = CHUNK_SIZE;
	_chunkIndex: number;
	_client: SparkCore;
	_fileStream: ?BufferStream = null;
	_lastCrc: ?string = null;
	_protocolVersion: number = 0;
	_startTime: ?Date;
	_missedChunks: Set<number> = new Set();

	//
	// OTA tweaks
	//
	_fastOtaEnabled: boolean = true;
	_ignoreMissedChunks: boolean = false;

	constructor(client: SparkCore) {
		this._client = client;
	}

	startFlashBuffer = async (
		buffer: Buffer,
	): Promise<void> => {
    try {
      if (!this._claimConnection()) {
  			return;
  		}

  		this._startTime = new Date();

  		this._prepare(buffer);
      await this._beginUpdate(buffer);
      await Promise.race([
        // Fail after 60 of trying to flash
        new Promise((resolve, reject) => setTimeout(
          () => reject('Update timed out'),
          60 * 1000,
        )),
        this._sendFile(),
      ]);

  		// cleanup
  		await this._onAllChunksDone();
      this._cleanup();
    } catch (error) {
      this._cleanup();
      throw error;
    }
	};

	_prepare = (fileBuffer: ?Buffer): void => {
		//make sure we have a file,
		//  open a stream to our file
		if (!fileBuffer || fileBuffer.length === 0) {
			throw new Error('Flasher: this.fileBuffer was empty.');
		} else {
			this._fileStream = new BufferStream(fileBuffer);
		}

		this._chunk = null;
		this._lastCrc = null;

    this._chunkIndex = -1;

		//start listening for missed chunks before the update fully begins
		this._client.on('msg_chunkmissed', message => this._onChunkMissed(message));
	};

	_claimConnection = (): boolean => {
		//suspend all other messages to the core
		if (!this._client.takeOwnership(this)) {
			throw new Error('Flasher: Unable to take ownership');
		}

		return true;
	};

	_beginUpdate = async (buffer: Buffer): Promise<*> => {
		let maxTries = 3;

		const tryBeginUpdate = async () => {
      if (maxTries < 0) {
        throw new Error('Failed waiting on UpdateReady - out of retries ');
      }

      // NOTE: this is 6 because it's double the ChunkMissed 3 second delay
      // The 90 second delay is crazy but try it just in case.
      let delay = maxTries > 0 ? 6 : 90;
      const sentStatus = this._sendBeginUpdateMessage(buffer);
      maxTries--;

			// did we fail to send out the UpdateBegin message?
			if (sentStatus === false) {
				throw new Error('UpdateBegin failed - sendMessage failed');
			}

      // Wait for UpdateReady — sent by Core to indicate readiness to receive
  		// firmware chunks
  		const message = await Promise.race([
  			this._client.listenFor(
  				'UpdateReady',
  				/*uri*/ null,
  				/*token*/ null,
  			),
  			this._client.listenFor(
  				'UpdateAbort',
  				/*uri*/ null,
  				/*token*/ null,
  			).then((message: ?Message): ?Message => {
  				let failReason = '';
  				if (message && message.getPayloadLength() > 0) {
  					failReason = messages.fromBinary(message.getPayload(), 'byte');
  				}

  				throw new Error('aborted ' + failReason);
  			}),
        // Try to update multiple times
        new Promise((resolve, reject) => setTimeout(
          () => {
						if (maxTries <= 0) {
							return;
						}
						
            tryBeginUpdate();
            resolve();
          },
          delay * 1000,
        )),
  		]);

      // Message will be null if the message isn't read by the device and we are
      // retrying
      if (!message) {
        return;
      }

			maxTries = 0;

  		let version = 0;
  		if (message && message.getPayloadLength() > 0) {
  			version = messages.fromBinary(message.getPayload(), 'byte');
  		}
  		this._protocolVersion = version;
		};

		await tryBeginUpdate();
	};

  _sendBeginUpdateMessage = (fileBuffer: Buffer): boolean => {
    //(MDM Proposal) Optional payload to enable fast OTA and file placement:
    //u8  flags    0x01 - Fast OTA available - when set the server can
    //  provide fast OTA transfer
    //u16 chunk size	Each chunk will be this size apart from the last which
    //  may be smaller.
    //u32 file size		The total size of the file.
    //u8 destination 	Where to store the file
    //	0x00 Firmware update
    //	0x01 External Flash
    //	0x02 User Memory Function
    //u32 destination address (0 for firmware update, otherwise the address
    //  of external flash or user memory.)

    let flags = 0;	//fast ota available
    const chunkSize = this._chunkSize;
    const fileSize = fileBuffer.length;
    const destFlag = 0;   //TODO: reserved for later
    const destAddr = 0;   //TODO: reserved for later

    if (this._fastOtaEnabled) {
      logger.log('fast ota enabled! ', this._getLogInfo());
      flags = 1;
    }

    var bufferBuilder = new buffers.BufferBuilder();
    bufferBuilder.pushUInt8(flags);
    bufferBuilder.pushUInt16(chunkSize);
    bufferBuilder.pushUInt32(fileSize);
    bufferBuilder.pushUInt8(destFlag);
    bufferBuilder.pushUInt32(destAddr);

    //UpdateBegin — sent by Server to initiate an OTA firmware update
    return !!this._client.sendMessage(
      'UpdateBegin',
      null,
      bufferBuilder.toBuffer(),
      this,
    );
  }

	_sendFile = async (): Promise<*> => {
		this._chunk = null;
		this._lastCrc = null;

		//while iterating over our file...
		//Chunk — sent by Server to send chunks of a firmware binary to Core
		//ChunkReceived — sent by Core to respond to each chunk, indicating the CRC
		//  of the received chunk data.  if Server receives CRC that does not match
		//  the chunk just sent, that chunk is sent again

		//send when ready:
		//UpdateDone — sent by Server to indicate all firmware chunks have been sent

		const canUseFastOTA = this._fastOtaEnabled && this._protocolVersion > 0;
		if (canUseFastOTA) {
			logger.log(
				'Starting FastOTA update',
				{ deviceID: this._client.getID() },
			);
		}

		this._readNextChunk();
		while (this._chunk) {
			this._sendChunk(this._chunkIndex);
			this._readNextChunk();

			// We don't need to wait for the response if using FastOTA.
			if (canUseFastOTA) {
				continue;
			}

			const message = await this._client.listenFor(
				'ChunkReceived',
				null,
				null,
			);

			if (!messages.statusIsOkay(message)) {
				throw new Error('\'ChunkReceived\' failed.');
			}
		}

		if (canUseFastOTA) {
			// Wait a whle for the error messages to come in for FastOTA
			await this._waitForMissedChunks();
		}

		// Handle missed chunks
		let counter = 0;
		while (this._missedChunks.size > 0 && counter < 3) {
			await this._resendChunks();
			await this._waitForMissedChunks();
			counter++;
		}
	}

	_resendChunks = async (): Promise<void> => {
		const missedChunks = Array.from(this._missedChunks);
		this._missedChunks.clear();

		const canUseFastOTA = this._fastOtaEnabled && this._protocolVersion > 0;
		await Promise.all(missedChunks.map(async (chunkIndex) => {
			const offset = chunkIndex * this._chunkSize;
			nullthrows(this._fileStream).seek(offset);
			this._chunkIndex = chunkIndex;

			this._readNextChunk();
			this._sendChunk(chunkIndex);

			// We don't need to wait for the response if using FastOTA.
			if (!canUseFastOTA) {
				return;
			}

			const message = await this._client.listenFor(
				'ChunkReceived',
				null,
				null,
			);

			if (!messages.statusIsOkay(message)) {
				throw new Error('\'ChunkReceived\' failed.');
			}
		}));
	};

	_readNextChunk = (): void => {
		if (!this._fileStream) {
			logger.error('Asked to read a chunk after the update was finished');
		}

		let chunk = this._chunk = this._fileStream
			? this._fileStream.read(this._chunkSize)
			: null;

		//workaround for https://github.com/spark/core-firmware/issues/238
		if (chunk && chunk.length !== this._chunkSize) {
			const buffer = new Buffer(this._chunkSize);
			chunk.copy(buffer, 0, 0, chunk.length);
			buffer.fill(0, chunk.length, this._chunkSize);
			this._chunk = chunk = buffer;
		}
		this._chunkIndex++;
		//end workaround
		this._lastCrc = chunk ? crc32.unsigned(chunk) : null;
	}

	_sendChunk = async (chunkIndex: ?number = 0): Promise<*> => {
		const encodedCrc = messages.toBinary(
			nullthrows(this._lastCrc),
			'crc',
		);

    const writeCoapUri = (message: Message): Message => {
      message.addOption(
        new Option(Message.Option.URI_PATH, new Buffer('c')),
      );
      message.addOption(new Option(Message.Option.URI_QUERY, encodedCrc));
      if (this._fastOtaEnabled && this._protocolVersion > 0) {
        const indexBinary = messages.toBinary(
          chunkIndex,
          'uint16',
        );
        message.addOption(
          new Option(Message.Option.URI_QUERY, indexBinary),
        );
      }
      return message;
    };

		this._client.sendMessage(
			'Chunk',
			{
				crc: encodedCrc,
				_writeCoapUri: writeCoapUri,
			},
			this._chunk,
			this,
		);
	}

	_onAllChunksDone = async (): Promise<*> => {
		if (
			!this._client.sendMessage('UpdateDone', null, null, this)
		) {
			throw new Error('Flasher - failed sending updateDone message');
		}
	};

  _cleanup = (): void => {
		try {
			//resume all other messages to the core
			this._client.releaseOwnership(this);

			//release our file handle
			const fileStream = this._fileStream;
			if (fileStream) {
				fileStream.close();
				this._fileStream = null;
			}
		} catch (exception) {
			throw new Error('Flasher: error during cleanup ' + exception);
		}
	};

	/**
	 * delay the teardown until at least like 10 seconds after the last
	 * chunkmissed message.
	 * @private
	 */
	_waitForMissedChunks = async (): Promise<void> => {
		if (this._protocolVersion <= 0) {
			//this doesn't apply to normal slow ota
			return;
		}

		return new Promise((resolve, reject) => setTimeout(
			() => {
				console.log('finished waiting');
				resolve();
			},
			3 * 1000,
		));
	};

	_getLogInfo = (): { cache_key?: string, deviceID: string } => {
		if (this._client) {
			return {
				cache_key: this._client._connectionKey || undefined,
				deviceID: this._client.getID(),
			};
		}	else {
			return { deviceID: 'unknown' };
		}
	};

	_onChunkMissed = (message: Message): void => {
		if (this._missedChunks.size > MAX_MISSED_CHUNKS) {
			const json = JSON.stringify(this._getLogInfo());
			throw new Error(
        'flasher - chunk missed - device over limit, killing! ' + json,
      );
		}

		// if we're not doing a fast OTA, and ignore missed is turned on, then
		// ignore this missed chunk.
		if (!this._fastOtaEnabled && this._ignoreMissedChunks) {
			logger.log('ignoring missed chunk ', this._getLogInfo());
			return;
		}

		logger.log('flasher - chunk missed - recovering ', this._getLogInfo());

		//kosher if I ack before I've read the payload?
		this._client.sendReply(
			'ChunkMissedAck',
			message.getId(),
			null,
			null,
			this,
		);

		//the payload should include one or more chunk indexes
		const payload = message.getPayload();
		var bufferReader = new buffers.BufferReader(payload);
		for(let ii = 0; ii < payload.length; ii += 2) {
			try {
				this._missedChunks.add(bufferReader.shiftUInt16());
			} catch (exception) {
				logger.error('onChunkMissed error reading payload ' + exception);
			}
		}
	}
}

export default Flasher;
