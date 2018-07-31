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

import { Transform } from 'stream';
import crypto from 'crypto';
import settings from '../settings';
import Logger from '../lib/logger';
const logger = Logger.createModuleLogger(module);

export type CryptoStreamType = 'decrypt' | 'encrypt';

type CryptoStreamOptions = {
  iv: Buffer,
  key: Buffer,
  streamType: CryptoStreamType,
};

class CryptoStream extends Transform {
  _key: Buffer;
  _iv: Buffer;
  _streamType: CryptoStreamType;

  constructor(options: CryptoStreamOptions) {
    super();

    this._key = options.key;
    this._iv = options.iv;
    this._streamType = options.streamType;
  }

  _transform = (
    chunk: Buffer | string,
    encoding: string,
    callback: () => void,
  ) => {
    if (!chunk.length) {
      logger.error(
        { length: chunk.length },
        "CryptoStream transform error: Chunk didn't have any length",
      );
      callback();
      return;
    }

    try {
      const data = ((chunk: any): Buffer);
      const cipherParams = [settings.CRYPTO_ALGORITHM, this._key, this._iv];
      const cipher =
        this._streamType === 'encrypt'
          ? crypto.createCipheriv(...cipherParams)
          : crypto.createDecipheriv(...cipherParams);

      const transformedData = cipher.update(data);
      const extraData = cipher.final();
      const output = Buffer.concat(
        [transformedData, extraData],
        transformedData.length + extraData.length,
      );

      const ivContainer = this._streamType === 'encrypt' ? output : data;
      this._iv = new Buffer(16);
      ivContainer.copy(this._iv, 0, 0, 16);

      this.push(output);
    } catch (error) {
      logger.error({ err: error }, 'CryptoStream transform error');
    }
    callback();
  };
}

export default CryptoStream;
