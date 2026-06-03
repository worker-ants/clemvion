import {
  MakeshopApiClient,
  MakeshopAuthFailedError,
  MakeshopIncompleteCredentialsError,
  MakeshopRateLimitedError,
  MakeshopTransportFailedError,
  __resetMakeshopLocksForTesting,
} from './makeshop-api.client';
import type { Integration } from '../../../modules/integrations/entities/integration.entity';

type Mock = jest.Mock;

function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'int-makeshop-1',
    workspaceId: 'ws-1',
    serviceType: 'makeshop',
    name: 'My MakeShop',
    authType: 'oauth2',
    credentials: {
      shop_uid: 'myshop',
      client_id: 'cid',
      client_secret: 'csecret',
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      scopes: ['product.read'],
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    scope: 'personal',
    status: 'connected',
    statusReason: null,
    tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  } as Integration;
}

function makeJsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

describe('MakeshopApiClient', () => {
  let client: MakeshopApiClient;
  let fetchMock: Mock;
  let sleepMock: Mock;
  let repo: { update: Mock; findOne: Mock };
  let dataSource: { transaction: Mock };
  let txFindOne: Mock;
  let txSave: Mock;

  beforeEach(() => {
    __resetMakeshopLocksForTesting();
    fetchMock = jest.fn();
    sleepMock = jest.fn().mockResolvedValue(undefined);
    repo = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
    };
    txFindOne = jest.fn();
    txSave = jest.fn().mockResolvedValue(undefined);
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: { getRepository: Mock }) => Promise<void>) => {
            const txRepo = { findOne: txFindOne, save: txSave };
            await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
          },
        ),
    };

    client = new MakeshopApiClient(
      repo as never,
      dataSource as never,
      fetchMock as unknown as typeof fetch,
      sleepMock as unknown as (ms: number) => Promise<void>,
    );
  });

  describe('credentials validation', () => {
    it('throws when shop_uid missing', async () => {
      const integration = makeIntegration({
        credentials: {
          client_id: 'c',
          client_secret: 's',
          access_token: 't',
          refresh_token: 'r',
        },
      });
      await expect(
        client.call(integration, { method: 'GET', path: 'product' }),
      ).rejects.toBeInstanceOf(MakeshopIncompleteCredentialsError);
    });

    it('throws when client_id/secret missing (confidential client)', async () => {
      const integration = makeIntegration({
        credentials: {
          shop_uid: 'myshop',
          access_token: 't',
          refresh_token: 'r',
        },
      });
      await expect(
        client.call(integration, { method: 'GET', path: 'product' }),
      ).rejects.toBeInstanceOf(MakeshopIncompleteCredentialsError);
    });
  });

  describe('happy path / URL + flat body', () => {
    it('GET — builds single-host + shop_uid path-segment URL, attaches Bearer', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ list: [{ product_id: 1 }] }),
      );

      const integration = makeIntegration();
      const res = await client.call(integration, {
        method: 'GET',
        path: 'product',
        query: { limit: '50' },
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ list: [{ product_id: 1 }] });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://connect.makeshop.co.kr/api/v1/myshop/product?limit=50',
      );
      expect(init.method).toBe('GET');
      expect((init.headers as Record<string, string>).Authorization).toBe(
        'Bearer access-token-1',
      );
    });

    it('POST — sends FLAT JSON body (NO { request } envelope)', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      const integration = makeIntegration();
      await client.call(integration, {
        method: 'POST',
        path: 'brand/create',
        body: { type: 'BRAND', name: 'Acme' },
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://connect.makeshop.co.kr/api/v1/myshop/brand/create',
      );
      expect(init.method).toBe('POST');
      const parsed = JSON.parse(init.body as string);
      // Flat — exactly the body fields, no `request` wrapper.
      expect(parsed).toEqual({ type: 'BRAND', name: 'Acme' });
      expect(parsed).not.toHaveProperty('request');
    });
  });

  describe('token refresh (in-process, no queue) + rotation', () => {
    it('refreshes proactively when token within window, persists rotated refresh_token', async () => {
      // Token already expired → ensureFreshToken triggers refresh.
      const integration = makeIntegration({
        tokenExpiresAt: new Date(Date.now() - 1000),
        credentials: {
          shop_uid: 'myshop',
          client_id: 'cid',
          client_secret: 'csecret',
          access_token: 'old-access',
          refresh_token: 'old-refresh',
          expires_at: new Date(Date.now() - 1000).toISOString(),
        },
      });
      txFindOne.mockResolvedValue({ ...integration });

      // 1st fetch = token endpoint, 2nd = the actual API call.
      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse({
            access_token: 'new-access',
            refresh_token: 'new-refresh',
            expires_in: 3600,
          }),
        )
        .mockResolvedValueOnce(makeJsonResponse({ list: [] }));

      await client.call(integration, { method: 'GET', path: 'product' });

      // Token endpoint hit with Basic auth + refresh_token grant.
      const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
      expect(tokenUrl).toBe('https://auth.makeshop.com/oauth/token');
      expect((tokenInit.headers as Record<string, string>).Authorization).toBe(
        `Basic ${Buffer.from('cid:csecret').toString('base64')}`,
      );
      expect(tokenInit.body).toContain('grant_type=refresh_token');
      expect(tokenInit.body).toContain('refresh_token=old-refresh');

      // Rotation persisted — saved row carries the NEW refresh_token.
      expect(txSave).toHaveBeenCalledTimes(1);
      const saved = txSave.mock.calls[0][0] as {
        credentials: { access_token: string; refresh_token: string };
      };
      expect(saved.credentials.access_token).toBe('new-access');
      expect(saved.credentials.refresh_token).toBe('new-refresh');

      // Live entity also mutated so the API call uses the fresh bearer.
      const apiInit = fetchMock.mock.calls[1][1];
      expect((apiInit.headers as Record<string, string>).Authorization).toBe(
        'Bearer new-access',
      );
    });

    it('refresh 401 — markAuthFailed + throws MakeshopAuthFailedError', async () => {
      const integration = makeIntegration({
        tokenExpiresAt: new Date(Date.now() - 1000),
        credentials: {
          shop_uid: 'myshop',
          client_id: 'cid',
          client_secret: 'csecret',
          access_token: 'old',
          refresh_token: 'bad-refresh',
          expires_at: new Date(Date.now() - 1000).toISOString(),
        },
      });
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ error: 'invalid_grant' }, { status: 401 }),
      );

      await expect(
        client.call(integration, { method: 'GET', path: 'product' }),
      ).rejects.toBeInstanceOf(MakeshopAuthFailedError);
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({
          status: 'error',
          statusReason: 'auth_failed',
        }),
      );
    });
  });

  describe('401 reactive self-recovery', () => {
    it('401 on API call → refresh + 1 retry with fresh token', async () => {
      const integration = makeIntegration();
      txFindOne.mockResolvedValue({ ...integration });

      fetchMock
        // 1st API call → 401
        .mockResolvedValueOnce(
          makeJsonResponse({ error: 'expired' }, { status: 401 }),
        )
        // refresh token endpoint
        .mockResolvedValueOnce(
          makeJsonResponse({
            access_token: 'fresh-access',
            refresh_token: 'fresh-refresh',
            expires_in: 3600,
          }),
        )
        // retry API call → 200
        .mockResolvedValueOnce(makeJsonResponse({ list: [] }));

      const res = await client.call(integration, {
        method: 'GET',
        path: 'product',
      });
      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      // Retry used the refreshed bearer.
      const retryInit = fetchMock.mock.calls[2][1];
      expect((retryInit.headers as Record<string, string>).Authorization).toBe(
        'Bearer fresh-access',
      );
    });

    it('403 — immediate degrade, no refresh', async () => {
      const integration = makeIntegration();
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ error: 'forbidden' }, { status: 403 }),
      );
      await expect(
        client.call(integration, { method: 'GET', path: 'product' }),
      ).rejects.toBeInstanceOf(MakeshopAuthFailedError);
      // Only the single API call — no token-endpoint refresh attempt.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({
          status: 'error',
          statusReason: 'auth_failed',
        }),
      );
    });
  });

  describe('429 rate limiting', () => {
    it('honours Retry-After header (seconds), retries, then succeeds', async () => {
      const integration = makeIntegration();
      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse(
            {},
            { status: 429, headers: { 'retry-after': '3' } },
          ),
        )
        .mockResolvedValueOnce(makeJsonResponse({ list: [] }));

      const res = await client.call(integration, {
        method: 'GET',
        path: 'product',
      });
      expect(res.status).toBe(200);
      expect(sleepMock).toHaveBeenCalledTimes(1);
      // Retry-After=3s → at least 3000ms backoff (plus jitter).
      expect(sleepMock.mock.calls[0][0]).toBeGreaterThanOrEqual(3000);
    });

    it('falls back to fixed backoff when no Retry-After header', async () => {
      const integration = makeIntegration();
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse({}, { status: 429 }))
        .mockResolvedValueOnce(makeJsonResponse({ list: [] }));

      const res = await client.call(integration, {
        method: 'GET',
        path: 'product',
      });
      expect(res.status).toBe(200);
      expect(sleepMock).toHaveBeenCalledTimes(1);
      expect(sleepMock.mock.calls[0][0]).toBeGreaterThanOrEqual(2000);
    });

    it('exhausts retries → MakeshopRateLimitedError', async () => {
      const integration = makeIntegration();
      fetchMock.mockResolvedValue(makeJsonResponse({}, { status: 429 }));

      await expect(
        client.call(integration, { method: 'GET', path: 'product' }),
      ).rejects.toBeInstanceOf(MakeshopRateLimitedError);
      // initial + 2 retries = 3 calls.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(sleepMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('transport failure', () => {
    it('fetch reject → MakeshopTransportFailedError', async () => {
      const integration = makeIntegration();
      fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
      await expect(
        client.call(integration, { method: 'GET', path: 'product' }),
      ).rejects.toBeInstanceOf(MakeshopTransportFailedError);
    });
  });

  describe('refresh via queue (production path)', () => {
    it('delegates refresh to the BullMQ queue when bound and re-reads the row', async () => {
      const queue = { add: jest.fn() } as { add: Mock };
      const queueEvents = {} as never;
      const waitUntilFinished = jest.fn().mockResolvedValue(undefined);
      queue.add.mockResolvedValue({ waitUntilFinished });

      const queuedClient = new MakeshopApiClient(
        repo as never,
        dataSource as never,
        fetchMock as unknown as typeof fetch,
        sleepMock as unknown as (ms: number) => Promise<void>,
        queue as never,
        queueEvents,
      );

      const integration = makeIntegration({
        tokenExpiresAt: new Date(Date.now() - 1000),
        credentials: {
          shop_uid: 'myshop',
          client_id: 'cid',
          client_secret: 'csecret',
          access_token: 'old',
          refresh_token: 'old-r',
          expires_at: new Date(Date.now() - 1000).toISOString(),
        },
      });
      // After the worker runs, the row is re-read with a fresh token.
      repo.findOne.mockResolvedValue({
        ...integration,
        status: 'connected',
        tokenExpiresAt: new Date(Date.now() + 3600_000),
        credentials: {
          ...integration.credentials,
          access_token: 'queued-fresh',
        },
      });
      // The API call after the queue refresh.
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ list: [] }));

      const res = await queuedClient.call(integration, {
        method: 'GET',
        path: 'product',
      });
      expect(res.status).toBe(200);
      expect(queue.add).toHaveBeenCalledTimes(1);
      // proactive uses jobId = integrationId.
      const addOpts = queue.add.mock.calls[0][2] as { jobId: string };
      expect(addOpts.jobId).toBe(integration.id);
      // Refreshed bearer used.
      expect(
        (fetchMock.mock.calls[0][1].headers as Record<string, string>)
          .Authorization,
      ).toBe('Bearer queued-fresh');
    });
  });
});
