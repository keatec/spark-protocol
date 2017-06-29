'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = undefined;

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _bunyan = require('bunyan');

var _bunyan2 = _interopRequireDefault(_bunyan);

var _types = require('../types');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _settings = require('../settings');

var _settings2 = _interopRequireDefault(_settings);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Logger = function () {
  function Logger() {
    (0, _classCallCheck3.default)(this, Logger);
  }

  (0, _createClass3.default)(Logger, null, [{
    key: 'createLogger',
    value: function createLogger(applicationName) {
      return _bunyan2.default.createLogger({
        level: _settings2.default.LOG_LEVEL,
        name: applicationName,
        serializers: _bunyan2.default.stdSerializers
      });
    }
  }, {
    key: 'createModuleLogger',
    value: function createModuleLogger(applicationModule) {
      return _bunyan2.default.createLogger({
        level: _settings2.default.LOG_LEVEL,
        name: _path2.default.basename(applicationModule.filename),
        serializers: _bunyan2.default.stdSerializers
      });
    }
  }]);
  return Logger;
}();

exports.default = Logger;