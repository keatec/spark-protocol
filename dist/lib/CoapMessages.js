'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _getOwnPropertyNames = require('babel-runtime/core-js/object/get-own-property-names');

var _getOwnPropertyNames2 = _interopRequireDefault(_getOwnPropertyNames);

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _class, _temp; /*
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
                   * 
                   *
                   */

var _CoapMessage = require('./CoapMessage');

var _CoapMessage2 = _interopRequireDefault(_CoapMessage);

var _MessageSpecifications = require('./MessageSpecifications');

var _MessageSpecifications2 = _interopRequireDefault(_MessageSpecifications);

var _coapPacket = require('coap-packet');

var _coapPacket2 = _interopRequireDefault(_coapPacket);

var _compactArray = require('compact-array');

var _compactArray2 = _interopRequireDefault(_compactArray);

var _logger = require('../lib/logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var logger = _logger2.default.createModuleLogger(module);

var _getRouteKey = function _getRouteKey(code, path) {
  var uri = code + path;
  var idx = uri.indexOf('/');

  // this assumes all the messages are one character for now.
  // if we wanted to change this, we'd need to find the first non message char,
  // '/' or '?', or use the real coap parsing stuff
  return uri.substr(0, idx + 2);
};
var _messageTypeToPacketProps = function _messageTypeToPacketProps(type) {
  var output = {
    ack: false,
    confirmable: false,
    reset: false
  };
  var types = _CoapMessage2.default.Type;
  if (type === types.ACK) {
    output.ack = true;
  } else if (type === types.CON) {
    output.confirmable = true;
  } else if (type === types.RST) {
    output.reset = true;
  }

  return output;
};

var _decodeNumericValue = function _decodeNumericValue(buffer) {
  var length = buffer.length;
  if (length === 0) {
    return 0;
  } else if (length === 1) {
    return buffer[0];
  } else if (length === 2) {
    return buffer.readUInt16BE(0);
  } else if (length === 3) {
    /* eslint-disable no-bitwise*/
    return buffer[1] << 8 | buffer[2] + (buffer[0] << 16 >>> 0);
    /* eslint-enable no-bitwise*/
  }

  return buffer.readUInt32BE(0);
};

var CoapMessages = (_temp = _class = function CoapMessages() {
  (0, _classCallCheck3.default)(this, CoapMessages);
}, _class._specifications = new _map2.default(_MessageSpecifications2.default), _class._routes = new _map2.default(_MessageSpecifications2.default.filter(
// eslint-disable-next-line no-unused-vars
function (_ref) {
  var _ref2 = (0, _slicedToArray3.default)(_ref, 2),
      name = _ref2[0],
      value = _ref2[1];

  return !!value.uri;
}).map(function (_ref3) {
  var _ref4 = (0, _slicedToArray3.default)(_ref3, 2),
      name = _ref4[0],
      value = _ref4[1];

  // see what it looks like without params
  var uri = value.template ? value.template.render({}) : value.uri;
  var routeKey = _getRouteKey(value.code, '/' + (uri || ''));

  return [routeKey, name];
})), _class.getUriPath = function (packet) {
  var options = packet.options.filter(function (item) {
    return item.name === _CoapMessage2.default.Option.URI_PATH;
  });

  if (!options.length) {
    return '';
  }

  return '/' + options.map(function (item) {
    return item.value.toString('utf8');
  }).join('/');
}, _class.getUriQuery = function (packet) {
  return packet.options.filter(function (item) {
    return item.name === _CoapMessage2.default.Option.URI_QUERY;
  }).map(function (item) {
    return item.value.toString('utf8');
  }).join('&');
}, _class.getMaxAge = function (packet) {
  var option = packet.options.find(function (item) {
    return item.name === _CoapMessage2.default.Option.MAX_AGE;
  });

  if (!option) {
    return 0;
  }

  return _decodeNumericValue(option.value);
}, _class.getRequestType = function (packet) {
  var uri = _getRouteKey(packet.code, CoapMessages.getUriPath(packet));

  return CoapMessages._routes.get(uri);
}, _class.getResponseType = function (name) {
  var specification = CoapMessages._specifications.get(name);
  return specification ? specification.response : null;
}, _class.statusIsOkay = function (message) {
  return message.code < _CoapMessage2.default.Code.BAD_REQUEST;
}, _class.isNonTypeMessage = function (messageName) {
  var specification = CoapMessages._specifications.get(messageName);
  if (!specification) {
    return false;
  }

  return specification.type === _CoapMessage2.default.Type.NON;
}, _class.wrap = function (messageName, messageId, params, options, data, token) {
  try {
    var specification = CoapMessages._specifications.get(messageName);
    if (!specification) {
      logger.error({ messageName: messageName }, 'Unknown Message Type');
      return null;
    }

    // Format our url
    var uri = specification.uri;
    var queryParams = [];
    if (params) {
      if (specification.template) {
        uri = specification.template.render(params);
      }
      queryParams = (params.args || []).map(function (value) {
        return {
          name: _CoapMessage2.default.Option.URI_QUERY,
          value: Buffer.isBuffer(value) ? value : new Buffer(value)
        };
      });
    }

    var uriOptions = [];
    var hasExistingUri = (options || []).some(function (item) {
      return item.name === _CoapMessage2.default.Option.URI_PATH;
    });

    if (uri && !hasExistingUri) {
      uriOptions = uri.split('/').filter(function (segment) {
        return !!segment;
      }).map(function (segment) {
        return {
          name: _CoapMessage2.default.Option.URI_PATH,
          value: new Buffer(segment)
        };
      });
    }

    return _coapPacket2.default.generate((0, _extends3.default)({}, _messageTypeToPacketProps(specification.type), {
      code: specification.code.toString(),
      messageId: messageId,
      options: (0, _compactArray2.default)([].concat((0, _toConsumableArray3.default)(uriOptions), (0, _toConsumableArray3.default)(options || []), (0, _toConsumableArray3.default)(queryParams))),
      payload: data || new Buffer(0),
      token: token && Buffer.from([token])
    }));
  } catch (error) {
    logger.error({ err: error }, 'Coap Error');
  }
  return null;
}, _class.unwrap = function (data) {
  if (!data) {
    return null;
  }

  try {
    return _coapPacket2.default.parse(data);
  } catch (error) {
    logger.error({ err: error }, 'Coap Error');
  }

  return null;
}, _class.translateIntTypes = function (varState) {
  if (!varState) {
    return null;
  }
  var translatedVarState = {};

  (0, _getOwnPropertyNames2.default)(varState).forEach(function (varName) {
    var intType = varState && varState[varName];
    if (typeof intType === 'number') {
      var str = CoapMessages.getNameFromTypeInt(intType);

      if (str !== null) {
        translatedVarState[varName] = str;
      }
    }
  });

  return (0, _extends3.default)({}, varState, translatedVarState);
}, _class.getNameFromTypeInt = function (typeInt) {
  switch (typeInt) {
    case 1:
      {
        return 'bool';
      }

    case 2:
      {
        return 'int32';
      }

    case 4:
      {
        return 'string';
      }

    case 5:
      {
        return 'null';
      }

    case 9:
      {
        return 'double';
      }

    default:
      {
        logger.error({ typeInt: typeInt }, 'asked for unknown type');
        throw new Error('error getNameFromTypeInt: ' + typeInt);
      }
  }
}, _class.tryFromBinary = function (buffer, typeName) {
  var result = null;
  try {
    result = CoapMessages.fromBinary(buffer, typeName);
  } catch (error) {
    logger.error({ buffer: buffer.toString(), err: error, typeName: typeName }, 'Could not parse type');
  }
  return result;
}, _class.fromBinary = function (buffer, typeName) {
  switch (typeName.toLowerCase()) {
    case 'bool':
      {
        return !!buffer.readUInt8(0);
      }

    case 'byte':
      {
        return buffer.readUInt8(0);
      }

    case 'crc':
      {
        return buffer.readInt32BE(0);
      }

    case 'uint32':
      {
        return buffer.readUInt32BE(0);
      }

    case 'uint16':
      {
        return buffer.readUInt16BE(0);
      }

    case 'int':
    case 'int32':
    case 'number':
      {
        return buffer.readInt32BE(0);
      }

    case 'float':
      {
        return buffer.readFloatBE(0);
      }

    case 'double':
      {
        // doubles on the device are little-endian
        return buffer.readDoubleLE(0);
      }

    case 'buffer':
      {
        return buffer;
      }

    case 'string':
    default:
      {
        return buffer.toString('utf8');
      }
  }
}, _class.toBinary = function (value, typeName) {
  // eslint-disable-next-line no-param-reassign
  typeName = typeName || (typeof value === 'undefined' ? 'undefined' : (0, _typeof3.default)(value));

  if (value === null) {
    return new Buffer(0);
  }

  switch (typeName) {
    case 'uint8':
      {
        var buffer = Buffer.allocUnsafe(1);
        buffer.writeUInt8(value, 0);
        return buffer;
      }
    case 'uint16':
      {
        var _buffer = Buffer.allocUnsafe(2);
        _buffer.writeUInt16BE(value, 0);
        return _buffer;
      }
    case 'uint32':
    case 'crc':
      {
        var _buffer2 = Buffer.allocUnsafe(4);
        _buffer2.writeUInt32BE(value, 0);
        return _buffer2;
      }

    case 'int32':
      {
        var _buffer3 = Buffer.allocUnsafe(4);
        _buffer3.writeInt32BE(value, 0);
        return _buffer3;
      }

    case 'number':
    case 'double':
      {
        var _buffer4 = Buffer.allocUnsafe(4);
        _buffer4.writeDoubleLE(value, 0);
        return _buffer4;
      }

    case 'buffer':
      {
        return Buffer.concat([value]);
      }

    case 'string':
    default:
      {
        return new Buffer(value || '');
      }
  }
}, _temp);
exports.default = CoapMessages;