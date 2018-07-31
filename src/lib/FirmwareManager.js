// @flow

import fs from 'fs';
import { HalDescribeParser } from 'binary-version-reader';
import nullthrows from 'nullthrows';
import protocolSettings from '../settings';
import FirmwareSettings from '../../third-party/settings.json';

class FirmwareManager {
  static isMissingOTAUpdate = (systemInformation: Object): boolean =>
    !!FirmwareManager._getMissingModule(systemInformation);
  static getOtaSystemUpdateConfig = (systemInformation: Object): * => {
    const firstDependency = FirmwareManager._getMissingModule(
      systemInformation,
    );
    if (!firstDependency) {
      return null;
    }

    const systemFile = fs.readFileSync(
      `${protocolSettings.BINARIES_DIRECTORY}/${firstDependency.filename}`,
    );

    return {
      moduleFunction: firstDependency.moduleFunction,
      moduleIndex: firstDependency.moduleIndex,
      systemFile,
    };
  };

  static getAppModule = (systemInformation: Object): Object => {
    const parser = new HalDescribeParser();
    return nullthrows(
      parser
        .getModules(systemInformation)
        // Filter so we only have the app modules
        .find((module: Object): boolean => module.func === 'u'),
    );
  };

  static _getMissingModule = (systemInformation: Object): ?Object => {
    const platformID = systemInformation.p;

    const modules = systemInformation.m;

    // This grabs all the dependencies from modules that have them defined.
    // This filters out any dependencies that have already been installed
    // or that are older than the currently installed modules.
    const knownMissingDependencies = modules
      .reduce((deps: Array<any>, module: any): Array<any> => [
        ...deps,
        ...module.d,
      ])
      .filter((dep: any): boolean => {
        const oldModuleExistsForSlot = modules.some(
          (m: any): boolean => m.f === dep.f && m.n === dep.n && m.v < dep.v,
        );
        // If the new dependency doesn't have an existing module installed.
        // If the firmware goes from 2 parts to 3 parts
        const moduleNotInstalled = !modules.some(
          (m: any): boolean => m.f === dep.f && m.n === dep.n,
        );

        return oldModuleExistsForSlot || moduleNotInstalled;
      }, []);

    if (!knownMissingDependencies.length) {
      return null;
    }

    const numberByFunction = {
      b: 2,
      s: 4,
      u: 5,
    };

    // Map dependencies to firmware metadata
    const knownFirmwares = knownMissingDependencies.map((dep: any): any =>
      FirmwareSettings.find(
        ({ prefixInfo }: { prefixInfo: any }): boolean =>
          prefixInfo.platformID === platformID &&
          prefixInfo.moduleVersion === dep.v &&
          prefixInfo.moduleFunction === numberByFunction[dep.f] &&
          prefixInfo.moduleIndex === parseInt(dep.n, 10),
      ),
    );

    if (!knownFirmwares.length) {
      return null;
    }

    // Walk firmware metadata to get all required firmware for the current
    // version.
    const allFirmware = [...knownFirmwares];
    while (knownFirmwares.length) {
      const current = knownFirmwares.pop();
      const {
        depModuleVersion,
        depModuleFunction,
        depModuleIndex,
      } = current.prefixInfo;
      const foundFirmware = FirmwareSettings.find(
        ({ prefixInfo }: { prefixInfo: any }): boolean =>
          prefixInfo.platformID === platformID &&
          prefixInfo.moduleVersion === depModuleVersion &&
          prefixInfo.moduleFunction === depModuleFunction &&
          prefixInfo.moduleIndex === depModuleIndex,
      );

      if (foundFirmware) {
        knownFirmwares.push(foundFirmware);
        allFirmware.push(foundFirmware);
      }
    }

    // Find the first dependency that isn't already installed
    return allFirmware
      .filter((firmware: any): boolean => {
        const {
          moduleVersion,
          moduleFunction,
          moduleIndex,
        } = firmware.prefixInfo;
        return !modules.some(
          (module: any): boolean =>
            module.v === moduleVersion &&
            numberByFunction[module.f] === moduleFunction &&
            parseInt(module.n, 10) === moduleIndex,
        );
      })
      .pop();
  };

  getKnownAppFileName = (): ?string => {
    throw new Error('getKnownAppFileName has not been implemented.');
  };
}

export default FirmwareManager;
