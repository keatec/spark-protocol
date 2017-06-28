/*
 *   Copyright (c) 2015 Particle Industries, Inc.  All rights reserved.
 *
 *   This program is free software; you can redistribute it and/or
 *   modify it under the terms of the GNU Lesser General Public
 *   License as published by the Free Software Foundation, either
 *   version 3 of the License, or (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *   Lesser General Public License for more details.
 *
 *   You should have received a copy of the GNU Lesser General Public
 *   License along with this program; if not, see <http://www.gnu.org/licenses/>.
 *
 * @flow
 *
 */

import path from 'path';
/* eslint-disable sorting/sort-object-props */
export default {
  BINARIES_DIRECTORY: path.join(__dirname, '../data/binaries'),
  DEFAULT_EVENT_TTL: 60,
  DEVICE_DIRECTORY: path.join(__dirname, '../data/deviceKeys'),
  TCP_DEVICE_SERVER_CONFIG: {
    ENABLE_SYSTEM_FIRWMARE_AUTOUPDATES: true,
    HOST: 'localhost',
    PORT: 5683,
  },
  SERVER_KEY_FILENAME: 'default_key.pem',
  SERVER_KEY_PASSWORD: (null: ?string),
  SERVER_KEYS_DIRECTORY: path.join(__dirname, '../data/users'),

  CRYPTO_ALGORITHM: 'aes-128-cbc',
  LOG_LEVEL: (process.env.LOG_LEVEL: any) || 'info',
  KEEP_ALIVE_TIMEOUT: 15000, // 15 seconds
  SOCKET_TIMEOUT: 31000, // 31 seconds

  VERBOSE_PROTOCOL: false,
  SHOW_VERBOSE_DEVICE_LOGS: false,
};
