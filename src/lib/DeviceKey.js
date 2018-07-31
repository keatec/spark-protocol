// @flow

import ECKey from 'ec-key';
import NodeRSA from 'node-rsa';

class DeviceKey {
  _ecKey: ?ECKey;
  _nodeRsa: ?NodeRSA;

  constructor(algorithm: 'ecc' | 'rsa', pemString: string) {
    switch (algorithm) {
      case 'ecc': {
        this._ecKey = new ECKey(pemString, 'pem');
        break;
      }

      case 'rsa': {
        this._nodeRsa = new NodeRSA(pemString, 'pkcs8-public-pem', {
          encryptionScheme: 'pkcs1',
          signingScheme: 'pkcs1',
        });
        break;
      }

      default: {
        throw new Error(`Key not implemented ${algorithm}`);
      }
    }
  }

  encrypt(data: Buffer): Buffer {
    if (this._nodeRsa) {
      return this._nodeRsa.encrypt(data);
    } else if (this._ecKey) {
      return this._ecKey
        .createSign('SHA256')
        .update(data)
        .sign();
    }

    throw new Error(`Key not implemented ${data.toString()}`);
  }

  equals(publicKeyPem: ?string): boolean {
    if (!publicKeyPem) {
      return false;
    }

    let otherKey;

    if (this._nodeRsa) {
      otherKey = new DeviceKey('rsa', publicKeyPem);
    } else if (this._ecKey) {
      otherKey = new DeviceKey('ecc', publicKeyPem);
    } else {
      return false;
    }

    return this.toPem() === otherKey.toPem();
  }

  toPem(): ?string {
    if (this._nodeRsa) {
      return this._nodeRsa.exportKey('pkcs8-public-pem');
    } else if (this._ecKey) {
      return this._ecKey.toString('pem');
    }

    return null;
  }
}

export default DeviceKey;
