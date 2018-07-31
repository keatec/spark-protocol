'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var FileManager = function () {
  function FileManager(directoryPath) {
    var isJSON = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    (0, _classCallCheck3.default)(this, FileManager);

    this._directoryPath = directoryPath;
    this._isJSON = isJSON;
    if (!_fs2.default.existsSync(directoryPath)) {
      _mkdirp2.default.sync(directoryPath);
    }
  }

  (0, _createClass3.default)(FileManager, [{
    key: 'count',
    value: function count() {
      return _fs2.default.readdirSync(this._directoryPath).length;
    }
  }, {
    key: 'createFile',
    value: function createFile(fileName, data) {
      if (_fs2.default.existsSync(_path2.default.join(this._directoryPath, fileName))) {
        return;
      }

      this.writeFile(fileName, data);
    }
  }, {
    key: 'deleteFile',
    value: function deleteFile(fileName) {
      var filePath = _path2.default.join(this._directoryPath, fileName);
      if (!_fs2.default.existsSync(filePath)) {
        return;
      }

      _fs2.default.unlinkSync(filePath);
    }
  }, {
    key: 'getAllData',
    value: function getAllData() {
      var _this = this;

      return _fs2.default.readdirSync(this._directoryPath).filter(function (fileName) {
        return fileName.endsWith('.json');
      }).map(function (fileName) {
        return _fs2.default.readFileSync(_path2.default.join(_this._directoryPath, fileName), 'utf8');
      });
    }
  }, {
    key: 'getFile',
    value: function getFile(fileName) {
      var filePath = _path2.default.join(this._directoryPath, fileName);
      if (!_fs2.default.existsSync(filePath)) {
        return null;
      }

      return _fs2.default.readFileSync(filePath, 'utf8');
    }
  }, {
    key: 'getFileBuffer',
    value: function getFileBuffer(fileName) {
      var filePath = _path2.default.join(this._directoryPath, fileName);
      if (!_fs2.default.existsSync(filePath)) {
        return null;
      }

      return _fs2.default.readFileSync(filePath);
    }
  }, {
    key: 'hasFile',
    value: function hasFile(fileName) {
      var filePath = _path2.default.join(this._directoryPath, fileName);
      return _fs2.default.existsSync(filePath);
    }
  }, {
    key: 'writeFile',
    value: function writeFile(fileName, data) {
      _fs2.default.writeFileSync(_path2.default.join(this._directoryPath, fileName), data);
    }
  }]);
  return FileManager;
}();

exports.default = FileManager;