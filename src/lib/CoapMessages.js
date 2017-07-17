/*
*   Copyright (C) 2013-2014 Spark Labs, Inc. All rights reserved. -  https://www.spark.io/
*
*   This file is part of the Spark-protocol module
*
*   This program is free software: you can redistribute it and/or modify
*   it under the terms of the GNU General Public License version 3
*   as published by the Free Software Foundation.
*
*   Spark-protocol is distributed in the hope that it will be useful,
*   but WITHOUT ANY WARRANTY; without even the implied warranty of
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*   GNU General Public License for more details.
*
*   You should have received a copy of the GNU General Public License
*   along with Spark-protocol.  If not, see <http://www.gnu.org/licenses/>.
*
*   You can download the source here: https://github.com/spark/spark-protocol
*
* @flow
*
*/

import type { CoapMessageTypes } from './CoapMessage';
import type {
  MessageSpecificationType,
  MessageType,
} from './MessageSpecifications';

import CoapMessage from './CoapMessage';
import MessageSpecifications from './MessageSpecifications';
import CoapPacket from 'coap-packet';
import compactArray from 'compact-array';
import Logger from '../lib/logger';
const logger = Logger.createModuleLogger(module);

const _getRouteKey = (code: number, path: string): string => {
  const uri = code + path;
  const idx = uri.indexOf('/');

  // this assumes all the messages are one character for now.
  // if we wanted to change this, we'd need to find the first non message char,
  // '/' or '?', or use the real coap parsing stuff
  return uri.substr(0, idx + 2);
};
const _messageTypeToPacketProps = (
  type: CoapMessageTypes,
): { ack: boolean, confirmable: boolean, reset: boolean } => {
  const output = {
    ack: false,
    confirmable: false,
    reset: false,
  };
  const types = CoapMessage.Type;
  if (type === types.ACK) {
    output.ack = true;
  } else if (type === types.CON) {
    output.confirmable = true;
  } else if (type === types.RST) {
    output.reset = true;
  }

  return output;
};

const _decodeNumericValue = (buffer: Buffer): number => {
  const length = buffer.length;
  if (length === 0) {
    return 0;
  } else if (length === 1) {
    return buffer[0];
  } else if (length === 2) {
    return buffer.readUInt16BE(0);
  } else if (length === 3) {
    /* eslint-disable no-bitwise*/
    return (buffer[1] << 8) | (buffer[2] + (buffer[0] << 16 >>> 0));
    /* eslint-enable no-bitwise*/
  }

  return buffer.readUInt32BE(0);
};

class CoapMessages {
  static _specifications: Map<MessageType, MessageSpecificationType> = new Map(
    MessageSpecifications,
  );

  // Maps CODE + URL to MessageNames as they appear in 'Spec'
  static _routes: Map<string, MessageType> = new Map(
    MessageSpecifications.filter(
      // eslint-disable-next-line no-unused-vars
      ([name, value]: [MessageType, MessageSpecificationType]): boolean =>
        !!value.uri,
    ).map(([name, value]: [MessageType, MessageSpecificationType]): [
      string,
      MessageType,
    ] => {
      // see what it looks like without params
      const uri = value.template ? value.template.render({}) : value.uri;
      const routeKey = _getRouteKey(value.code, `/${uri || ''}`);

      return [routeKey, name];
    }),
  );

  static getUriPath = (packet: CoapPacket): string => {
    const options = packet.options.filter(
      (item: CoapOption): boolean => item.name === CoapMessage.Option.URI_PATH,
    );

    if (!options.length) {
      return '';
    }

    return `/${options
      .map((item: CoapOption): string => item.value.toString('utf8'))
      .join('/')}`;
  };

  static getUriQuery = (packet: CoapPacket): string =>
    packet.options
      .filter(
        (item: CoapOption): boolean =>
          item.name === CoapMessage.Option.URI_QUERY,
      )
      .map((item: CoapOption): string => item.value.toString('utf8'))
      .join('&');

  static getMaxAge = (packet: CoapPacket): number => {
    const option = packet.options.find(
      (item: CoapOption): boolean => item.name === CoapMessage.Option.MAX_AGE,
    );

    if (!option) {
      return 0;
    }

    return _decodeNumericValue(option.value);
  };

  static getRequestType = (packet: CoapPacket): ?string => {
    const uri = _getRouteKey(packet.code, CoapMessages.getUriPath(packet));

    return CoapMessages._routes.get(uri);
  };

  static getResponseType = (name: MessageType): ?string => {
    const specification = CoapMessages._specifications.get(name);
    return specification ? specification.response : null;
  };

  static statusIsOkay = (message: CoapPacket): boolean =>
    message.code < CoapMessage.Code.BAD_REQUEST;

  static isNonTypeMessage = (messageName: MessageType): boolean => {
    const specification = CoapMessages._specifications.get(messageName);
    if (!specification) {
      return false;
    }

    return specification.type === CoapMessage.Type.NON;
  };

  static wrap = (
    messageName: MessageType,
    messageId: number,
    params: ?{ args?: Array<any>, name?: string },
    options: ?Array<CoapOption>,
    data: ?Buffer,
    token: ?number,
  ): ?Buffer => {
    try {
      const specification = CoapMessages._specifications.get(messageName);
      if (!specification) {
        logger.error({ messageName }, 'Unknown Message Type');
        return null;
      }

      // Format our url
      let uri = specification.uri;
      let queryParams = [];
      if (params) {
        if (specification.template) {
          uri = specification.template.render(params);
        }
        queryParams = (params.args || []).map((value: any): CoapOption => ({
          name: CoapMessage.Option.URI_QUERY,
          value: Buffer.isBuffer(value) ? value : new Buffer(value),
        }));
      }

      let uriOptions = [];
      const hasExistingUri = (options || [])
        .some(
          (item: CoapOption): boolean =>
            item.name === CoapMessage.Option.URI_PATH,
        );

      if (uri && !hasExistingUri) {
        uriOptions = uri
          .split('/')
          .filter((segment: string): boolean => !!segment)
          .map((segment: string): CoapOption => ({
            name: CoapMessage.Option.URI_PATH,
            value: new Buffer(segment),
          }));
      }

      return CoapPacket.generate({
        ..._messageTypeToPacketProps(specification.type),
        code: specification.code.toString(),
        messageId,
        options: compactArray([
          ...uriOptions,
          ...(options || []),
          ...queryParams,
        ]),
        payload: data || new Buffer(0),
        token: (token || token === 0) && Buffer.from([token]),
      });
    } catch (error) {
      logger.error({ err: error }, 'Coap Error');
    }
    return null;
  };

  static unwrap = (data: Buffer): ?CoapPacket => {
    if (!data) {
      return null;
    }

    try {
      return CoapPacket.parse(data);
    } catch (error) {
      logger.error({ err: error }, 'Coap Error');
    }

    return null;
  };

  // http://en.wikipedia.org/wiki/X.690
  // === TYPES: SUBSET OF ASN.1 TAGS ===
  //
  // 1: BOOLEAN (false=0, true=1)
  // 2: INTEGER (int32)
  // 4: OCTET STRING (arbitrary bytes)
  // 5: NULL (void for return value only)
  // 9: REAL (double)
  // Translates the integer variable type enum to user friendly string types
  static translateIntTypes = (varState: ?Object): ?Object => {
    if (!varState) {
      return null;
    }
    const translatedVarState = {};

    Object.getOwnPropertyNames(varState).forEach((varName: string) => {
      const intType = varState && varState[varName];
      if (typeof intType === 'number') {
        const str = CoapMessages.getNameFromTypeInt(intType);

        if (str !== null) {
          translatedVarState[varName] = str;
        }
      }
    });

    return { ...varState, ...translatedVarState };
  };

  static getNameFromTypeInt = (typeInt: number): string => {
    switch (typeInt) {
      case 1: {
        return 'bool';
      }

      case 2: {
        return 'int32';
      }

      case 4: {
        return 'string';
      }

      case 5: {
        return 'null';
      }

      case 9: {
        return 'double';
      }

      default: {
        logger.error({ typeInt }, 'asked for unknown type');
        throw new Error(`error getNameFromTypeInt: ${typeInt}`);
      }
    }
  };

  // eslint-disable-next-line func-names
  static tryFromBinary = (buffer: Buffer, typeName: string): * => {
    let result = null;
    try {
      result = CoapMessages.fromBinary(buffer, typeName);
    } catch (error) {
      logger.error(
        { buffer: buffer.toString(), err: error, typeName },
        'Could not parse type',
      );
    }
    return result;
  };

  // eslint-disable-next-line func-names
  static fromBinary = (buffer: Buffer, typeName: string): * => {
    switch (typeName.toLowerCase()) {
      case 'bool': {
        return !!buffer.readUInt8(0);
      }

      case 'byte': {
        return buffer.readUInt8(0);
      }

      case 'crc': {
        return buffer.readInt32BE(0);
      }

      case 'uint32': {
        return buffer.readUInt32BE(0);
      }

      case 'uint16': {
        return buffer.readUInt16BE(0);
      }

      case 'int':
      case 'int32':
      case 'number': {
        return buffer.readInt32BE(0);
      }

      case 'float': {
        return buffer.readFloatBE(0);
      }

      case 'double': {
        // doubles on the device are little-endian
        return buffer.readDoubleLE(0);
      }

      case 'buffer': {
        return buffer;
      }

      case 'string':
      default: {
        return buffer.toString('utf8');
      }
    }
  };

  static toBinary = (
    value: ?(string | number | Buffer),
    typeName?: string,
  ): Buffer => {
    // eslint-disable-next-line no-param-reassign
    typeName = typeName || typeof value;

    if (value === null) {
      return new Buffer(0);
    }

    switch (typeName) {
      case 'uint8': {
        const buffer = Buffer.allocUnsafe(1);
        buffer.writeUInt8((value: any), 0);
        return buffer;
      }
      case 'uint16': {
        const buffer = Buffer.allocUnsafe(2);
        buffer.writeUInt16BE((value: any), 0);
        return buffer;
      }
      case 'uint32':
      case 'crc': {
        const buffer = Buffer.allocUnsafe(4);
        buffer.writeUInt32BE((value: any), 0);
        return buffer;
      }

      case 'int32': {
        const buffer = Buffer.allocUnsafe(4);
        buffer.writeInt32BE((value: any), 0);
        return buffer;
      }

      case 'number':
      case 'double': {
        const buffer = Buffer.allocUnsafe(4);
        buffer.writeDoubleLE((value: any), 0);
        return buffer;
      }

      case 'buffer': {
        return Buffer.concat([(value: any)]);
      }

      case 'string':
      default: {
        return new Buffer((value: any) || '');
      }
    }
  };
}

export default CoapMessages;
