// @flow

import FileManager from './FileManager';

class ServerKeyFileRepository {
  _serverKeyFileName: string;
  _fileManager: FileManager;

  constructor(serverKeysDir: string, serverKeyFileName: string) {
    this._fileManager = new FileManager(serverKeysDir);
    this._serverKeyFileName = serverKeyFileName;
  }

  createKeys = async (
    privateKeyPem: Buffer,
    publicKeyPem: Buffer,
  ): Promise<{
    privateKeyPem: Buffer,
    publicKeyPem: Buffer,
  }> => {
    const extIdx = this._serverKeyFileName.lastIndexOf('.');
    const pubPemFilename = `${this._serverKeyFileName.substring(
      0,
      extIdx,
    )}.pub.pem`;

    this._fileManager.createFile(this._serverKeyFileName, privateKeyPem);
    this._fileManager.createFile(pubPemFilename, publicKeyPem);

    return { privateKeyPem, publicKeyPem };
  };

  getPrivateKey = async (): Promise<?string> =>
    this._fileManager.getFile(this._serverKeyFileName);
}

export default ServerKeyFileRepository;
