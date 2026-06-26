import ApplicationDBProvider from './db-connection';

// Mock drizzle-orm/node-postgres so the fake PoolClient doesn't reach real drizzle
jest.mock('drizzle-orm/node-postgres', () => ({
  drizzle: jest.fn().mockReturnValue({ _drizzle: true }),
}));

// Mock pg so we control the Pool and its clients
jest.mock('pg', () => {
  const fakeClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  const MockPool = jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(fakeClient),
  }));

  return { Pool: MockPool, __fakeClient: fakeClient };
});

// Re-import after mocks are set up so we can grab the fake client reference
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pg = require('pg');
const fakeClient: { query: jest.Mock; release: jest.Mock } = pg.__fakeClient;

describe('ApplicationDBProvider — pool slot leak on error', () => {
  let provider: ApplicationDBProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new ApplicationDBProvider();
  });

  describe('getTenantDBConnection', () => {
    it('releases the client when SET search_path throws', async () => {
      fakeClient.query.mockRejectedValueOnce(new Error('boom'));

      await expect(
        provider.getTenantDBConnection({
          database_uri: 'postgresql://localhost:5432/test',
          schema_id: 'x',
          user_id: 1,
        }),
      ).rejects.toThrow('boom');

      expect(fakeClient.release).toHaveBeenCalledTimes(1);
    });

    it('does NOT release the client on success (caller owns it)', async () => {
      fakeClient.query.mockResolvedValueOnce(undefined);

      const result = await provider.getTenantDBConnection({
        database_uri: 'postgresql://localhost:5432/test',
        schema_id: 'x',
        user_id: 1,
      });

      expect(result).toHaveProperty('dbConnection');
      expect(result).toHaveProperty('client');
      expect(fakeClient.release).not.toHaveBeenCalled();
    });
  });

  describe('getMasterConnection', () => {
    it('releases the client when SET search_path throws', async () => {
      fakeClient.query.mockRejectedValueOnce(new Error('master-boom'));

      await expect(provider.getMasterConnection()).rejects.toThrow('master-boom');

      expect(fakeClient.release).toHaveBeenCalledTimes(1);
    });

    it('does NOT release the client on success (caller owns it)', async () => {
      fakeClient.query.mockResolvedValueOnce(undefined);

      const result = await provider.getMasterConnection();

      expect(result).toHaveProperty('dbConnection');
      expect(result).toHaveProperty('client');
      expect(fakeClient.release).not.toHaveBeenCalled();
    });
  });
});
