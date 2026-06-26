import { describe, it, expect, vi } from 'vitest';
import { createApiClient } from './api-client';

describe('createApiClient', () => {
  it('unwraps IBaseResponse.data and attaches bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 1 }, error: null, status_code: 200 }),
    });
    const client = createApiClient({
      baseUrl: '/api',
      getToken: () => 'jwt',
      fetchImpl: fetchMock as any,
    });
    const data = await client.get('/persons/1');
    expect(data).toEqual({ id: 1 });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt');
  });

  it('throws when envelope.error is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        data: null,
        error: 'RESOURCE_NOT_FOUND',
        message: 'nope',
      }),
    });
    const client = createApiClient({
      baseUrl: '/api',
      getToken: () => null,
      fetchImpl: fetchMock as any,
    });
    await expect(client.get('/x')).rejects.toThrow('nope');
  });
});
