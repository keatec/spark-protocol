// @flow

import bunyan from 'bunyan';

export type DeviceAttributes = {
  appHash: ?string,
  claimCode?: ?string,
  currentBuildTarget?: string,
  deviceID: string,
  functions: ?Array<string>,
  imei?: string,
  ip: string,
  isCellular?: boolean,
  last_iccid?: string,
  lastHeard: ?Date,
  name: string,
  ownerID: ?string,
  particleProductId: number,
  platformId: number,
  productFirmwareVersion: number,
  registrar?: ?string,
  variables: ?Object,
  reservedFlags: ?number,
};

export type DeviceKeyObject = {
  algorithm: 'ecc' | 'rsa',
  deviceID: string,
  key: string,
};

export type ProtocolEvent = {
  ...EventData,
  broadcasted?: boolean,
  publishedAt: Date,
  isPublic: boolean,
  isInternal: boolean,
};

export type EventData = {
  connectionID?: ?string,
  context?: ?Object,
  data?: string,
  deviceID?: ?string,
  name: string,
  ttl?: number,
  userID?: string,
};

export type ServerKeyRepository = {
  createKeys: (
    privateKeyPem: Buffer,
    publicKeyPem: Buffer,
  ) => Promise<{
    privateKeyPem: Buffer,
    publicKeyPem: Buffer,
  }>,
  getPrivateKey: () => Promise<?string>,
};

export type ProductFirmware = {|
  current: boolean,
  data: Buffer,
  description: string,
  device_count: number,
  id: string,
  name: string,
  product_id: number,
  size: number,
  title: string,
  updated_at: Date,
  version: number,
|};

export type ProductDevice = {|
  denied: boolean,
  development: boolean,
  deviceID: string,
  id: string,
  lockedFirmwareVersion: ?number,
  notes: string,
  productID: number,
  quarantined: boolean,
|};

export type PublishOptions = {
  isInternal?: boolean,
  isPublic?: boolean,
};

export interface IBaseRepository<TModel> {
  create(model: TModel | $Shape<TModel>): Promise<TModel>;
  deleteByID(id: string): Promise<void>;
  getAll(): Promise<Array<TModel>>;
  getByID(id: string): Promise<?TModel>;
  updateByID(id: string, props: $Shape<TModel>): Promise<TModel>;
}

export interface IDeviceAttributeRepository
  extends IBaseRepository<DeviceAttributes> {}

export interface IDeviceKeyRepository
  extends IBaseRepository<DeviceKeyObject> {}

export interface IProductDeviceRepository
  extends IBaseRepository<ProductDevice> {
  getAllByProductID(
    productID: number,
    page: number,
    perPage: number,
  ): Promise<Array<ProductDevice>>;
  getFromDeviceID(deviceID: string): Promise<?ProductDevice>;
}

export interface IProductFirmwareRepository
  extends IBaseRepository<ProductFirmware> {
  getAllByProductID(productID: number): Promise<Array<ProductFirmware>>;
  getByVersionForProduct(
    productID: number,
    version: number,
  ): Promise<?ProductFirmware>;
  getCurrentForProduct(productID: number): Promise<?ProductFirmware>;
}

export interface ILoggerCreate {
  static createLogger(applicationName: string): bunyan.Logger;
  static createModuleLogger(applicationModule: any): bunyan.Logger;
}
