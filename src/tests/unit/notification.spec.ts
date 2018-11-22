import { PillarSdk } from '../..';
import { Requester } from '../../utils/requester';
import { Configuration } from '../../lib/configuration';
import { default as getConfiguration } from '../../utils/requester-configurations/get';

describe('Notification Class', () => {
  const spy = jest.spyOn(Requester, 'execute');
  let pSdk: PillarSdk;

  jest.spyOn(Configuration.prototype, 'executeRequest');

  spy.mockImplementation(() => {});

  beforeEach(() => {
    pSdk = new PillarSdk({
      privateKey:
        'aef23212dbaadfa322321231231313123131312312312312312312312312312a',
      notificationsUrl: 'http://localhost:8081',
    });
  });

  afterEach(() => {
    Configuration.prototype.executeRequest.mockClear();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('List method', () => {
    it('should successfully call with valid data', () => {
      const notificationData = {
        walletId: '56b540e9-927a-4ced-a1be-61b059f33f2b',
        fromTimestamp: '2016-05-24T15:54:14.876Z',
        type: 'message',
      };

      pSdk.notification.list(notificationData);

      expect(Configuration.prototype.executeRequest).toHaveBeenCalledTimes(1);
      expect(Requester.execute).toHaveBeenCalledWith({
        ...getConfiguration,
        headers: { 'X-API-Signature': expect.stringMatching(/.+/) },
        params: notificationData,
        url: 'http://localhost:8081/notification/list',
      });
    });

    it('validates data', async () => {
      expect.assertions(2);

      try {
        await pSdk.notification.list({});
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e.message).toBe("data should have required property 'walletId'");
      }
    });
  });
});
