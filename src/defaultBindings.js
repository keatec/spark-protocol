// @flow
import { Container } from 'constitute';

import DeviceAttributeFileRepository from './repository/DeviceAttributeFileRepository';
import DeviceKeyFileRepository from './repository/DeviceKeyFileRepository';
import DeviceServer from './server/DeviceServer';
import EventPublisher from './lib/EventPublisher';
import EventProvider from './lib/EventProvider';
import ClaimCodeManager from './lib/ClaimCodeManager';
import CryptoManager from './lib/CryptoManager';
import MockProductDeviceRepository from './repository/MockProductDeviceRepository';
import MockProductFirmwareRepository from './repository/MockProductFirmwareRepository';
import ServerKeyFileRepository from './repository/ServerKeyFileRepository';
import protocolSettings from './settings';

type ServerSettings = {
  BINARIES_DIRECTORY?: string,
  DEVICE_DIRECTORY: string,
  ENABLE_SYSTEM_FIRWMARE_AUTOUPDATES: boolean,
  SERVER_KEY_FILENAME: string,
  SERVER_KEY_PASSWORD?: string,
  SERVER_KEYS_DIRECTORY: string,
  TCP_DEVICE_SERVER_CONFIG: {
    HOST: string,
    PORT: number,
  },
};

const defaultBindings = (
  container: Container,
  serverSettings: ServerSettings,
) => {
  const mergedSettings = { ...protocolSettings, ...serverSettings };

  // Settings
  container.bindValue('DEVICE_DIRECTORY', mergedSettings.DEVICE_DIRECTORY);
  container.bindValue(
    'ENABLE_SYSTEM_FIRWMARE_AUTOUPDATES',
    mergedSettings.ENABLE_SYSTEM_FIRWMARE_AUTOUPDATES,
  );
  container.bindValue(
    'SERVER_KEY_FILENAME',
    mergedSettings.SERVER_KEY_FILENAME,
  );
  container.bindValue(
    'SERVER_KEY_PASSWORD',
    mergedSettings.SERVER_KEY_PASSWORD,
  );
  container.bindValue(
    'SERVER_KEYS_DIRECTORY',
    mergedSettings.SERVER_KEYS_DIRECTORY,
  );
  container.bindValue(
    'TCP_DEVICE_SERVER_CONFIG',
    mergedSettings.TCP_DEVICE_SERVER_CONFIG,
  );

  // Repository
  container.bindClass(
    'IDeviceAttributeRepository',
    DeviceAttributeFileRepository,
    ['DEVICE_DIRECTORY'],
  );

  container.bindClass('IDeviceKeyRepository', DeviceKeyFileRepository, [
    'DEVICE_DIRECTORY',
  ]);
  container.bindClass('IProductDeviceRepository', MockProductDeviceRepository);
  container.bindClass(
    'IProductFirmwareRepository',
    MockProductFirmwareRepository,
  );

  container.bindClass('ServerKeyRepository', ServerKeyFileRepository, [
    'SERVER_KEYS_DIRECTORY',
    'SERVER_KEY_FILENAME',
  ]);

  // Utils
  container.bindClass('EventPublisher', EventPublisher, []);
  container.bindClass('EVENT_PROVIDER', EventProvider, ['EventPublisher']);
  container.bindClass('ClaimCodeManager', ClaimCodeManager, []);
  container.bindClass('CryptoManager', CryptoManager, [
    'IDeviceKeyRepository',
    'ServerKeyRepository',
    'SERVER_KEY_PASSWORD',
  ]);

  // Device server
  container.bindClass('DeviceServer', DeviceServer, [
    'IDeviceAttributeRepository',
    'IProductDeviceRepository',
    'IProductFirmwareRepository',
    'ClaimCodeManager',
    'CryptoManager',
    'EventPublisher',
    'TCP_DEVICE_SERVER_CONFIG',
    'ENABLE_SYSTEM_FIRWMARE_AUTOUPDATES',
  ]);
};

export default defaultBindings;
