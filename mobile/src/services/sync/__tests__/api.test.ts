import { createHttpSyncApi, SyncApiError } from '../api';

function fakeFetch(status: number, body: unknown = null) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('backup API client', () => {
  it('deletes the account with the code as the credential', async () => {
    const { impl, calls } = fakeFetch(204);
    await createHttpSyncApi('https://api.example.com/', impl).deleteAccount('ABCD-EFGH');
    expect(calls[0].url).toBe('https://api.example.com/v1/accounts/me');
    expect(calls[0].init.method).toBe('DELETE');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer ABCD-EFGH');
  });

  it('treats an unknown code as already deleted', async () => {
    const { impl } = fakeFetch(401);
    await expect(createHttpSyncApi('https://api.example.com', impl).deleteAccount('GONE')).resolves.toBeUndefined();
  });

  it('reports server problems and unreachable servers', async () => {
    await expect(createHttpSyncApi('https://api.example.com', fakeFetch(503).impl).deleteAccount('X')).rejects.toMatchObject({
      status: 503,
    });
    const offline = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const error = await createHttpSyncApi('https://api.example.com', offline)
      .deleteAccount('X')
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SyncApiError);
    expect((error as SyncApiError).status).toBeNull();
  });
});
