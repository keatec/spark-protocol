// @flow
/* eslint-disable no-unused-vars */

import type { IProductFirmwareRepository, ProductFirmware } from '../types';

// getByID, deleteByID and update uses model.deviceID as ID for querying
class MockProductFirmwareRepository implements IProductFirmwareRepository {
  create = (model: $Shape<ProductFirmware>): Promise<ProductFirmware> => {
    throw new Error(`The method is not implemented`);
  };

  deleteByID = (productFirmwareID: string): Promise<void> => {
    throw new Error(`The method is not implemented`);
  };

  // eslint-disable-next-line
  getAll = (): Promise<Array<ProductFirmware>> => {
    throw new Error(`The method is not implemented`);
  };

  getAllByProductID = (productID: number): Promise<Array<ProductFirmware>> => {
    throw new Error(`The method is not implemented`);
  };

  getByVersionForProduct = (
    productID: number,
    version: number,
  ): Promise<?ProductFirmware> => {
    throw new Error(`The method is not implemented`);
  };

  getCurrentForProduct = (productID: number): Promise<?ProductFirmware> => {
    throw new Error(`The method is not implemented`);
  };

  getByID = (productFirmwareID: string): Promise<?ProductFirmware> => {
    throw new Error(`The method is not implemented`);
  };

  updateByID = (
    productFirmwareID: string,
    props: $Shape<ProductFirmware>,
  ): Promise<ProductFirmware> => {
    throw new Error(`The method is not implemented`);
  };
}

export default MockProductFirmwareRepository;
