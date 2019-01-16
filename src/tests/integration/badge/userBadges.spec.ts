// tslint:disable: object-shorthand-properties-first
// check node environment
const env = process.env.NODE_ENV;

const keys = require('../../utils/generateKeyPair');
import { PillarSdk } from '../../..';
import { Configuration } from '../../../lib/configuration';
import nock = require('nock');

describe('User Badges', () => {
  // Key pairs
  const privateKey = keys.privateKey.toString();

  // Generate random username
  const username = `User${Math.random()
    .toString(36)
    .substring(7)}`;

  let walletId: string;
  let pSdk: PillarSdk;

  // Responses
  const responseData = [
    {
      name: 'First connection established',
      imageUrl:
        'http://localhost:3900/images/badges/first%20connection%20established.png',
      subtitle: 'First connection established',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut',
      id: 2,
      createdAt: 1547479198,
      updatedAt: 1547479198,
      receivedAt: 1547572329,
    },
  ];

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
      apiUrl: 'http://localhost:8080',
      privateKey,
    });
    pSdk.configuration.setUsername('username');

    const walletRegister = {
      privateKey,
      fcmToken: '987qwe',
      username,
    };

    if (env === 'test') {
      const mockApi = nock('http://localhost:8080');
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
          walletId: 'walletId',
        })
        .get('/badge/my?walletId=walletId')
        .reply(200, responseData)
        .get('/badge/my?walletId=')
        .reply(400, errInvalidWalletId)
        .get('/badge/my?walletId=walletId')
        .reply(500, errInternal)
        .get('/badge/my?walletId=walletId')
        .reply(401, errUnauthorized)
        .post('/register/refresh')
        .reply(200, {
          accessToken: 'accessToken',
          refreshToken: 'refreshToken',
        })
        .get('/badge/my?walletId=walletId')
        .reply(200, responseData);
    }

    try {
      const response = await pSdk.wallet.registerAuthServer(walletRegister);
      walletId = response.data.walletId;
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

  it('expects to return array containing badges and status 200', async () => {
    const inputParams = {
      walletId,
    };

    const responseDefaults = await pSdk.badge.my(inputParams);
    expect(responseDefaults.status).toBe(200);
    expect(responseDefaults.data).toEqual(expect.any(Array));
  });

  it('should return 400 due invalid params', async () => {
    const inputParams = {
      walletId: '',
    };

    try {
      await pSdk.badge.my(inputParams);
    } catch (error) {
      expect(error.response.status).toEqual(400);
      expect(error.response.data.message).toEqual(errInvalidWalletId.message);
    }
  });

  if (env === 'test') {
    it('should return 500 due internal server error', async () => {
      const inputParams = {
        walletId,
      };

      try {
        await pSdk.badge.my(inputParams);
      } catch (error) {
        expect(error.response.status).toEqual(500);
        expect(error.response.data.message).toEqual(errInternal.message);
      }
    });
  }

  it('expects to return 401 (unauthorized) due to invalid accessToken', async () => {
    const inputParams = {
      walletId,
    };

    Configuration.accessKeys.oAuthTokens.accessToken = 'invalid';

    try {
      await pSdk.badge.my(inputParams);
    } catch (error) {
      expect(error.response.status).toEqual(401);
      expect(error.response.data.message).toEqual(errUnauthorized.message);
    }
  });
});
