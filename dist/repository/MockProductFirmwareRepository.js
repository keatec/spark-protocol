'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// getByID, deleteByID and update uses model.deviceID as ID for querying
var MockProductFirmwareRepository = function MockProductFirmwareRepository() {
  (0, _classCallCheck3.default)(this, MockProductFirmwareRepository);

  this.create = function (model) {
    throw new Error('The method is not implemented');
  };

  this.deleteByID = function (productFirmwareID) {
    throw new Error('The method is not implemented');
  };

  this.getAll = function () {
    throw new Error('The method is not implemented');
  };

  this.getAllByProductID = function (productID) {
    throw new Error('The method is not implemented');
  };

  this.getByVersionForProduct = function (productID, version) {
    throw new Error('The method is not implemented');
  };

  this.getCurrentForProduct = function (productID) {
    throw new Error('The method is not implemented');
  };

  this.getByID = function (productFirmwareID) {
    throw new Error('The method is not implemented');
  };

  this.updateByID = function (productFirmwareID, props) {
    throw new Error('The method is not implemented');
  };
}

// eslint-disable-next-line
;
/* eslint-disable no-unused-vars */

exports.default = MockProductFirmwareRepository;