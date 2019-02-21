/*
Copyright (C) 2019 Stiftung Pillar Project

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// tslint:disable: object-shorthand-properties-first
// check node environment
const env = process.env.NODE_ENV;

const EC = require('elliptic').ec;
const ecSecp256k1 = new EC('secp256k1');

import { PillarSdk } from '../../..';
import { Configuration } from '../../../lib/configuration';
import nock = require('nock');

describe('Connection Update Identity Keys', () => {
  const sourceUserPrivateKey = ecSecp256k1
    .genKeyPair()
    .getPrivate()
    .toString('hex');
  const targetUserPrivateKey = ecSecp256k1
    .genKeyPair()
    .getPrivate()
    .toString('hex');

  let sourceUserWalletId: string;
  let sourceUserAccessKey: string;
  let targetUserId: string;
  let pSdk: PillarSdk;

  const responseData = {
    result: 'success',
    message: 'Updated connections',
  };

  const responseDataConnectionInvite = {
    result: 'success',
    message: 'UpConnection invitation was successfully sentdated connections',
  };

  const errInvalidWalletId = {
    message: 'Could not find a Wallet ID to search by.',
  };

  const errInternal = {
    message: 'Internal Server Error',
  };

  const errUnauthorized = {
    message: 'Signature not verified',
  };

  beforeAll(async () => {
    pSdk = new PillarSdk({
      apiUrl: 'https://localhost:8080',
      privateKey: sourceUserPrivateKey,
    });

    if (env === 'test') {
      const mockApi = nock('https://localhost:8080');
      mockApi
        .post('/register/keys')
        .reply(200, {
          expiresAt: '2015-03-21T05:41:32Z',
          nonce: 'AxCDF23232',
        })
        .post('/register/auth')
        .reply(200, {
          authorizationCode: 'Authorization code',
          expiresAt: '2011-06-14T04:12:36Z',
        })
        .post('/register/access')
        .reply(200, {
          accessToken: 'accessToken',
          refreshToken: 'refreshToken',
          walletId: 'targetWalletId',
          userId: 'targetUserId',
        })
        .post('/register/keys')
        .reply(200, {
          expiresAt: '2015-03-21T05:41:32Z',
          nonce: 'AxCDF23232',
        })
        .post('/register/auth')
        .reply(200, {
          authorizationCode: 'Authorization code',
          expiresAt: '2011-06-14T04:12:36Z',
        })
        .post('/register/access')
        .reply(200, {
          accessToken: 'accessToken',
          refreshToken: 'refreshToken',
          walletId: 'sourceWalletId',
          userId: 'sourceUserId',
        })
        .post('/connection/invite')
        .reply(200, responseDataConnectionInvite)
        .post('/connection/update-identity-keys')
        .reply(200, responseData)
        .post('/connection/update-identity-keys')
        .reply(400, errInvalidWalletId)
        .post('/connection/update-identity-keys')
        .reply(500, errInternal)
        .post('/connection/update-identity-keys')
        .reply(401, errUnauthorized)
        .post('/register/refresh')
        .reply(200, {
          accessToken: 'accessToken',
          refreshToken: 'refreshToken',
        })
        .post('/connection/update-identity-keys')
        .reply(200, responseData);
    }

    try {
      // Generate random username
      let username = `User${Math.random()
        .toString(36)
        .substring(7)}`;

      pSdk.configuration.setUsername('username');

      let walletRegister = {
        privateKey: targetUserPrivateKey,
        fcmToken: '987qwe1',
        username,
      };

      let response = await pSdk.wallet.registerAuthServer(walletRegister);
      targetUserId = response.data.userId;

      // Generate random username
      username = `User${Math.random()
        .toString(36)
        .substring(7)}`;

      walletRegister = {
        privateKey: sourceUserPrivateKey,
        fcmToken: '987qwe2',
        username,
      };

      response = await pSdk.wallet.registerAuthServer(walletRegister);
      sourceUserWalletId = response.data.walletId;

      sourceUserAccessKey = Math.random()
        .toString(36)
        .substring(7);

      const inputParams = {
        targetUserId,
        accessKey: sourceUserAccessKey,
        walletId: sourceUserWalletId,
      };

      await pSdk.connection.invite(inputParams);
    } catch (e) {
      throw e;
    }
  });

  afterAll(() => {
    jest.restoreAllMocks();
    if (env === 'test') {
      nock.cleanAll();
    }
  });

  it('expects to return a success message when connection status is pending', async () => {
    const inputParams = {
      walletId: sourceUserWalletId,
      connections: [
        {
          sourceUserAccessKey,
          sourceIdentityKey: Math.random()
            .toString(36)
            .substring(7),
          targetIdentityKey: Math.random()
            .toString(36)
            .substring(7),
          targetUserId,
        },
      ],
    };

    const response = await pSdk.connection.updateIdentityKeys(inputParams);
    expect(response.status).toBe(200);
    expect(response.data).toEqual(responseData);
  });

  it('should return 400 due invalid params', async () => {
    const inputParams = {
      walletId: '',
      connections: [],
    };

    try {
      await pSdk.connection.updateIdentityKeys(inputParams);
    } catch (error) {
      expect(error.response.status).toEqual(400);
      expect(error.response.data.message).toEqual(errInvalidWalletId.message);
    }
  });

  if (env === 'test') {
    it('should return 500 due internal server error', async () => {
      const inputParams = {
        walletId: sourceUserWalletId,
        connections: [],
      };

      try {
        await pSdk.connection.updateIdentityKeys(inputParams);
      } catch (error) {
        expect(error.response.status).toEqual(500);
        expect(error.response.data.message).toEqual(errInternal.message);
      }
    });
  }

  it('expects to return 401 (unauthorized) due to invalid accessToken', async () => {
    const inputParams = {
      walletId: sourceUserWalletId,
      connections: [],
    };

    Configuration.accessKeys.oAuthTokens.accessToken = 'invalid';

    try {
      await pSdk.connection.updateIdentityKeys(inputParams);
    } catch (error) {
      expect(error.response.status).toEqual(401);
      expect(error.response.data.message).toEqual(errUnauthorized.message);
    }
  });
});
