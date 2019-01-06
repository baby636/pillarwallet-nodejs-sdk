import axios from 'axios';
import { Configuration } from '../../../lib/configuration';
import { Register } from '../../../lib/register';
import { Requester } from '../../../utils/requester';

jest.mock('axios');

describe('Requester utility', () => {
  const defaultOptions: object = {
    headers: {},
    url: '',
  };

  afterEach(() => {
    axios.mockClear();
  });

  afterAll(() => {
    axios.mockRestore();
  });

  it('makes a request using options', () => {
    const options = {
      ...defaultOptions,
      method: 'POST',
      data: {
        foo: 'bar',
      },
      json: true,
    };

    Requester.execute(options);

    expect(axios).toBeCalledWith(options);
    expect(axios).toHaveBeenCalledTimes(1);
  });

  describe('OAuth unauthorized retry', () => {
    const options = {
      ...defaultOptions,
      headers: {
        Authorization: 'Bearer access',
      },
    };

    jest.spyOn(Register, 'refreshAuthToken');
    jest.spyOn(Register, 'registerTokens');

    beforeEach(() => {
      Configuration.setAuthTokens('accessToken', 'refreshToken');
      Configuration.accessKeys.privateKey = 'onePrivateKey';
    });

    afterEach(() => {
      Register.refreshAuthToken.mockClear();
      Register.registerTokens.mockClear();
    });

    describe('when response is 401', () => {
      const errorResponse = {
        config: options,
        response: {
          status: 401,
        },
      };

      beforeEach(() => {
        axios.mockImplementationOnce(() => Promise.reject(errorResponse));
      });

      it('tries to refresh access tokens', async () => {
        expect.assertions(3);

        const errorResponseRefreshToken = {
          response: {
            status: 400,
          },
        };
        axios.mockImplementationOnce(() =>
          Promise.reject(errorResponseRefreshToken),
        );

        try {
          await Requester.execute(options);
        } catch (e) {
          expect(Register.refreshAuthToken).toHaveBeenCalledTimes(1);
          expect(e.response.status).toBe(400);
          expect(axios).toHaveBeenCalledTimes(2);
        }
      });

      describe('with refreshed tokens', () => {
        beforeEach(() => {
          axios.mockImplementationOnce(() =>
            Promise.resolve({
              data: {
                accessToken: 'updatedAccessToken',
                refreshToken: 'updatedRefreshToken',
              },
            }),
          );
        });

        it('stores updated tokens', async () => {
          await Requester.execute(options);

          expect(Configuration.accessKeys.oAuthTokens.accessToken).toBe(
            'updatedAccessToken',
          );
          expect(Configuration.accessKeys.oAuthTokens.refreshToken).toBe(
            'updatedRefreshToken',
          );
          expect(axios).toHaveBeenCalledTimes(3);
        });

        it('retries request with the updated access token', async () => {
          await Requester.execute(options);

          expect(axios).toHaveBeenCalledWith({
            ...options,
            headers: { Authorization: 'Bearer updatedAccessToken' },
          });
          expect(options.headers.Authorization).toBe('Bearer access');
        });
      });

      describe('when refresh token is expired', () => {
        beforeEach(() => {
          const errorResponseRefreshToken = {
            response: {
              status: 400,
              data: {
                message: 'Invalid grant: refresh token has expired',
              },
            },
          };
          axios.mockImplementationOnce(() =>
            Promise.reject(errorResponseRefreshToken),
          );
        });

        it('stores updated tokens', async () => {
          axios.mockImplementationOnce(() =>
            Promise.resolve({
              data: {
                accessToken: 'updatedAccessToken',
                refreshToken: 'updatedRefreshToken',
              },
            }),
          );

          await Requester.execute(options);

          expect(Configuration.accessKeys.oAuthTokens.accessToken).toBe(
            'updatedAccessToken',
          );
          expect(Configuration.accessKeys.oAuthTokens.refreshToken).toBe(
            'updatedRefreshToken',
          );
          expect(axios).toHaveBeenCalledTimes(4);
        });

        it('tries to refresh access tokens', async () => {
          axios.mockImplementationOnce(() =>
            Promise.reject(new Error('registerTokens error')),
          );

          try {
            await Requester.execute(options);
          } catch (e) {
            expect(Register.refreshAuthToken).toHaveBeenCalledTimes(1);
            expect(Register.registerTokens).toHaveBeenCalledTimes(1);
            expect(e).toBeInstanceOf(Error);
            expect(e.message).toBe('registerTokens error');
            expect(axios).toHaveBeenCalledTimes(3);
          }
        });
      });
    });

    it('returns a rejected promise when original request config is missing', async () => {
      const malformedError = {
        response: {
          statusCode: 401,
        },
      };

      axios.mockImplementationOnce(() => Promise.reject(malformedError));

      try {
        await Requester.execute(options);
      } catch (e) {
        expect(e).toBe(malformedError);
      }
    });

    it('returns a rejected promise when response is not 401', async () => {
      const anotherError = {
        config: options,
        response: {
          statusCode: 400,
        },
      };

      axios.mockImplementationOnce(() => Promise.reject(anotherError));

      try {
        await Requester.execute(options);
      } catch (e) {
        expect(e).toBe(anotherError);
      }
    });
  });
});
