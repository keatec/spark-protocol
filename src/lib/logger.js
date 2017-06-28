// @flow

import bunyan from 'bunyan';
import { ILoggerCreate } from '../types';
import path from 'path';
import settings from '../settings';

export default class Logger implements ILoggerCreate {
  static createLogger(applicationName: string): bunyan.Logger {
    return bunyan.createLogger({
      level: settings.LOG_LEVEL,
      name: applicationName,
      serializers: bunyan.stdSerializers,
    });
  }
  static createModuleLogger(applicationModule: any): bunyan.Logger {
    return bunyan.createLogger({
      level: settings.LOG_LEVEL,
      name: path.basename(applicationModule.filename),
      serializers: bunyan.stdSerializers,
    });
  }
}
