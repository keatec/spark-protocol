// @flow
/* eslint-disable no-unused-vars */

import type { IProductDeviceRepository, ProductDevice } from '../types';

// getByID, deleteByID and update uses model.deviceID as ID for querying
class MockProductDeviceRepository implements IProductDeviceRepository {
  create = (model: $Shape<ProductDevice>): Promise<ProductDevice> => {
    throw new Error(`The method is not implemented`);
  };

  deleteByID = (productDeviceID: string): Promise<void> => {
    throw new Error(`The method is not implemented`);
  };

  // eslint-disable-next-line
  getAll = (): Promise<Array<ProductDevice>> => {
    throw new Error(`The method is not implemented`);
  };

  getByID = (productDeviceID: string): Promise<?ProductDevice> => {
    throw new Error(`The method is not implemented`);
  };

  getAllByProductID = (
    productID: number,
    page: number,
    perPage: number,
  ): Promise<Array<ProductDevice>> => {
    throw new Error(`The method is not implemented`);
  };

  // This is here just to make things work when used without spark-server
  getFromDeviceID = async (deviceID: string): Promise<?ProductDevice> => null;

  updateByID = (
    productDeviceID: string,
    props: $Shape<ProductDevice>,
  ): Promise<ProductDevice> => {
    throw new Error(`The method is not implemented`);
  };
}

/* eslint-enable no-unused-vars */

export default MockProductDeviceRepository;
