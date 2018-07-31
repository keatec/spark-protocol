'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// getByID, deleteByID and update uses model.deviceID as ID for querying
var MockProductDeviceRepository = function MockProductDeviceRepository() {
  var _this = this;

  (0, _classCallCheck3.default)(this, MockProductDeviceRepository);

  this.create = function (model) {
    throw new Error('The method is not implemented');
  };

  this.deleteByID = function (productDeviceID) {
    throw new Error('The method is not implemented');
  };

  this.getAll = function () {
    throw new Error('The method is not implemented');
  };

  this.getByID = function (productDeviceID) {
    throw new Error('The method is not implemented');
  };

  this.getAllByProductID = function (productID, page, perPage) {
    throw new Error('The method is not implemented');
  };

  this.getFromDeviceID = function () {
    var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(deviceID) {
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              return _context.abrupt('return', null);

            case 1:
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

  this.updateByID = function (productDeviceID, props) {
    throw new Error('The method is not implemented');
  };
}

// eslint-disable-next-line


// This is here just to make things work when used without spark-server
;

/* eslint-enable no-unused-vars */

/* eslint-disable no-unused-vars */

exports.default = MockProductDeviceRepository;