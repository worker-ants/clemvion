import {
  Cafe24ApiClient,
  Cafe24AuthFailedError,
  Cafe24IncompleteCredentialsError,
  Cafe24RateLimitedError,
  Cafe24TransportFailedError,
  __resetCafe24LocksForTesting,
  wrapInCafe24Envelope,
} from './cafe24-api.client';
import type { Integration } from '../../../modules/integrations/entities/integration.entity';
import { makeFakeJwt } from '../../../modules/integrations/__test-utils__/make-fake-jwt';

type Mock = jest.Mock;

function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'int-cafe24-1',
    workspaceId: 'ws-1',
    serviceType: 'cafe24',
    name: 'My Cafe24',
    authType: 'oauth2',
    credentials: {
      mall_id: 'myshop',
      app_type: 'public',
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      scopes: ['mall.read_product'],
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      cafe24_operator_id: 'operator-1',
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

// 테스트 전용 JWT 빌더는 `modules/integrations/__test-utils__/make-fake-jwt`
// 의 공유 helper 사용. ai-review (2026-05-18) W2 조치로 중복 제거.

describe('Cafe24ApiClient', () => {
  let client: Cafe24ApiClient;
  let fetchMock: Mock;
  let sleepMock: Mock;
  let repo: { update: Mock };
  let dataSource: { transaction: Mock };

  beforeEach(() => {
    __resetCafe24LocksForTesting();
    fetchMock = jest.fn();
    sleepMock = jest.fn().mockResolvedValue(undefined);
    repo = { update: jest.fn().mockResolvedValue(undefined) };
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: { getRepository: Mock }) => Promise<void>) => {
            const txRepo = {
              findOne: jest.fn(),
              save: jest.fn().mockResolvedValue(undefined),
            };
            await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
          },
        ),
    };

    client = new Cafe24ApiClient(
      repo as never,
      dataSource as never,
      fetchMock as unknown as typeof fetch,
      sleepMock as unknown as (ms: number) => Promise<void>,
    );
  });

  describe('credentials validation', () => {
    it('throws when mall_id missing', async () => {
      const integration = makeIntegration({
        credentials: { access_token: 't', refresh_token: 'r' },
      });
      await expect(
        client.call(integration, { method: 'GET', path: 'products' }),
      ).rejects.toBeInstanceOf(Cafe24IncompleteCredentialsError);
    });

    it('throws when access_token missing', async () => {
      const integration = makeIntegration({
        credentials: { mall_id: 'myshop', refresh_token: 'r' },
      });
      await expect(
        client.call(integration, { method: 'GET', path: 'products' }),
      ).rejects.toBeInstanceOf(Cafe24IncompleteCredentialsError);
    });

    it('throws when private app missing client_id/secret', async () => {
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'private',
          access_token: 't',
          refresh_token: 'r',
        },
      });
      await expect(
        client.call(integration, { method: 'GET', path: 'products' }),
      ).rejects.toBeInstanceOf(Cafe24IncompleteCredentialsError);
    });
  });

  describe('happy path', () => {
    it('GET — builds mall-specific URL, attaches Bearer, parses body + headers', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          { products: [{ product_no: 1 }] },
          {
            headers: {
              'x-cafe24-call-usage': '12',
              'x-cafe24-call-remain': '0',
              'x-api-call-limit': '5/40',
            },
          },
        ),
      );

      const integration = makeIntegration();
      const res = await client.call(integration, {
        method: 'GET',
        path: 'products',
        query: { shop_no: 1, display: 'T' },
      });

      const url = new URL(fetchMock.mock.calls[0][0] as string);
      expect(url.origin).toBe('https://myshop.cafe24api.com');
      expect(url.pathname).toBe('/api/v2/admin/products');
      expect(url.searchParams.get('shop_no')).toBe('1');
      expect(url.searchParams.get('display')).toBe('T');

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer access-token-1');
      expect(init.body).toBeUndefined();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ products: [{ product_no: 1 }] });
      expect(res.callUsage).toBe(12);
      expect(res.callRemain).toBe(0);
      expect(res.callLimit).toBe('5/40');
      expect(res.retries).toBe(0);
    });

    // ----- Cafe24 `request` envelope (POST/PUT) -----
    // Cafe24 Admin API rejects flat bodies with 400 "Please enter the
    // Request parameter." All write requests (POST/PUT) MUST be wrapped
    // as `{ shop_no?, request: { ...rest } }`. shop_no is the only
    // exception that lives at the top level alongside `request`.
    // See https://developers.cafe24.com/docs/ko/api/admin/#update-a-product
    async function captureWireBody(
      opts: Parameters<Cafe24ApiClient['call']>[1],
    ): Promise<unknown> {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));
      await client.call(makeIntegration(), opts);
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      return init.body === undefined
        ? undefined
        : JSON.parse(init.body as string);
    }

    it.each<{
      label: string;
      method: 'POST' | 'PUT';
      path: string;
      body: Record<string, unknown>;
      expected: Record<string, unknown>;
    }>([
      {
        label: 'PUT with shop_no — shop_no top-level, rest wrapped',
        method: 'PUT',
        path: 'products/1001',
        body: { shop_no: 1, product_name: 'Updated', price: '10000.00' },
        expected: {
          shop_no: 1,
          request: { product_name: 'Updated', price: '10000.00' },
        },
      },
      {
        label: 'PUT without shop_no — body becomes `{ request: {...} }`',
        method: 'PUT',
        path: 'products/1001',
        body: { product_name: 'Updated' },
        expected: { request: { product_name: 'Updated' } },
      },
      {
        label: 'POST create — same envelope applied',
        method: 'POST',
        path: 'products',
        body: { shop_no: 1, product_name: 'New', price: '5000.00' },
        expected: {
          shop_no: 1,
          request: { product_name: 'New', price: '5000.00' },
        },
      },
      {
        label: 'PUT with only shop_no — sends shop_no + empty request envelope',
        // Degenerate case — caller passed only shop_no. We still emit
        // the envelope so Cafe24's parser sees the required `request` key
        // rather than 400 "Please enter the Request parameter."
        method: 'PUT',
        path: 'products/1001',
        body: { shop_no: 1 },
        expected: { shop_no: 1, request: {} },
      },
    ])('$label', async ({ method, path, body, expected }) => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));
      await client.call(makeIntegration(), { method, path, body });

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect((init.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
      expect(JSON.parse(init.body as string)).toEqual(expected);
    });

    it('GET — never wraps in envelope (no body)', async () => {
      const wire = await captureWireBody({
        method: 'GET',
        path: 'products',
        // GET requests carry shop_no on the query string; body is never
        // populated by the handler. Sanity-check the client doesn't
        // synthesise one.
      });
      expect(wire).toBeUndefined();
    });

    it('DELETE — envelope NOT applied even when body is somehow populated', async () => {
      // Cafe24 DELETE endpoints we map are all path-only — no body fields
      // exist in metadata. This test guards the allowlist: a hypothetical
      // future DELETE with body must not silently inherit the POST/PUT
      // envelope (different endpoints may use different body shapes).
      const wire = await captureWireBody({
        method: 'DELETE',
        path: 'products/1001',
        body: { reason: 'cleanup' },
      });
      expect(wire).toEqual({ reason: 'cleanup' });
    });
  });

  describe('wrapInCafe24Envelope (direct unit tests)', () => {
    // The integration-level tests above exercise the helper through the
    // full client.call() path. These direct tests pin the helper's
    // contract for shop_no falsy values, throws, and purity — corners
    // that would otherwise need a full client setup to assert.

    it('hoists falsy shop_no values (0, null) to the top level', () => {
      // shop_no === 0 is meaningful (some single-mall flows); shop_no
      // === null should propagate so a caller mistake is visible on the
      // wire rather than silently dropped.
      expect(wrapInCafe24Envelope({ shop_no: 0, product_name: 'x' })).toEqual({
        shop_no: 0,
        request: { product_name: 'x' },
      });
      expect(
        wrapInCafe24Envelope({ shop_no: null, product_name: 'x' }),
      ).toEqual({
        shop_no: null,
        request: { product_name: 'x' },
      });
    });

    it('omits shop_no key when value is undefined', () => {
      expect(
        wrapInCafe24Envelope({ shop_no: undefined, product_name: 'x' }),
      ).toEqual({ request: { product_name: 'x' } });
    });

    it('throws when caller pre-wraps with a `request` key (double-wrap guard)', () => {
      expect(() =>
        wrapInCafe24Envelope({ request: { product_name: 'x' } }),
      ).toThrow(/pre-existing `request` key/);
    });

    it('does not mutate the input object', () => {
      const input = { shop_no: 1, product_name: 'x' };
      const snapshot = { ...input };
      wrapInCafe24Envelope(input);
      expect(input).toEqual(snapshot);
    });
  });

  describe('rate limiting', () => {
    it('retries on 429 with sleep equal to max(call_remain, time_remain)', async () => {
      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse(null, {
            status: 429,
            headers: {
              'x-cafe24-call-remain': '3',
              'x-cafe24-time-remain': '7',
            },
          }),
        )
        .mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      const integration = makeIntegration();
      const res = await client.call(integration, {
        method: 'GET',
        path: 'orders',
      });

      expect(sleepMock).toHaveBeenCalledTimes(1);
      // 7s base from X-Cafe24-Time-Remain + up to 500ms thundering-herd
      // jitter; expect the sleep to lie in [7000, 7500).
      const sleptMs = sleepMock.mock.calls[0][0] as number;
      expect(sleptMs).toBeGreaterThanOrEqual(7000);
      expect(sleptMs).toBeLessThan(7500);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(res.status).toBe(200);
      expect(res.retries).toBe(1);
    });

    it('gives up after 2 retries — Cafe24RateLimitedError', async () => {
      fetchMock.mockResolvedValue(
        makeJsonResponse(null, {
          status: 429,
          headers: { 'x-cafe24-call-remain': '2' },
        }),
      );

      const integration = makeIntegration();
      await expect(
        client.call(integration, { method: 'GET', path: 'orders' }),
      ).rejects.toBeInstanceOf(Cafe24RateLimitedError);
      expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    // B-5-3: 경계값 — 429 2회 + 3번째 성공 → res.retries === 2. 옛 테스트는
    // retries=0 (성공 1회) 와 retries=1 (1회 retry) 만 검증했다. retries=2 가
    // MAX_RATE_LIMIT_RETRIES 경계값으로 안정해서 잘 동작하는지 검증.
    it('success on 3rd attempt (after 2 retries) — res.retries === 2', async () => {
      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse(null, {
            status: 429,
            headers: { 'x-cafe24-call-remain': '1' },
          }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse(null, {
            status: 429,
            headers: { 'x-cafe24-call-remain': '1' },
          }),
        )
        .mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      const integration = makeIntegration();
      const res = await client.call(integration, {
        method: 'GET',
        path: 'orders',
      });

      expect(sleepMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
      expect(res.status).toBe(200);
      expect(res.retries).toBe(2);
    });
  });

  describe('auth failure', () => {
    // Helper — wire `dataSource.transaction` so that an inline
    // `refreshAccessToken` reaches a fresh integration row (the same shape
    // the `token refresh` suite uses). Required for 401 reactive refresh
    // (§6.1) because the retry path goes through `refreshAccessToken`
    // when the BullMQ queue is unbound (test default).
    function wireRefreshTransaction(integration: Integration): void {
      dataSource.transaction.mockImplementation(
        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
          const txRepo = {
            findOne: jest.fn().mockResolvedValue(integration),
            save: jest.fn().mockResolvedValue(undefined),
          };
          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
        },
      );
    }

    // CAFE24_CLIENT_ID / CAFE24_CLIENT_SECRET 은 refreshAccessToken() 안의
    // resolveClientCredentials() 가 public app (app_type='public') 케이스에서
    // 읽는 OAuth Basic 자격증명. 테스트 fixture 값.
    function setRefreshClientEnv(): void {
      process.env.CAFE24_CLIENT_ID = 'fake-client-id-for-test';
      process.env.CAFE24_CLIENT_SECRET = 'fake-client-secret-for-test';
    }

    // 잔존 안전망 — 본문 끝에서 수동 호출 (idempotent). afterEach 가
    // primary cleanup 이지만 케이스 본문에서 명시적으로 부르면 디버깅 시
    // teardown 시점이 명확하다.
    function clearRefreshClientEnv(): void {
      delete process.env.CAFE24_CLIENT_ID;
      delete process.env.CAFE24_CLIENT_SECRET;
    }

    // afterEach 훅으로 자동 cleanup — 테스트 중간 실패 시에도 후속 테스트로
    // env 오염 누출되지 않도록.
    afterEach(() => {
      clearRefreshClientEnv();
      dataSource.transaction.mockReset();
    });

    // 403 — 즉시 격하 (refresh 무의미). spec §6.1 "403 즉시 격하".
    it('on 403 — flips Integration.status to error(auth_failed) and throws Cafe24AuthFailedError immediately (no refresh)', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ error: 'Forbidden' }, { status: 403 }),
      );

      const integration = makeIntegration();
      await expect(
        client.call(integration, { method: 'GET', path: 'orders' }),
      ).rejects.toBeInstanceOf(Cafe24AuthFailedError);

      // Single fetch — no refresh attempted on 403.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({
          status: 'error',
          statusReason: 'auth_failed',
        }),
      );
      expect(integration.status).toBe('error');
      expect(integration.statusReason).toBe('auth_failed');
    });

    // T-1 (spec §6.1 401 자가 회복) — proactive `ensureFreshToken` 이 race
    // window 로 빗나가 만료된 access_token 으로 API 호출이 401 을 받은 경우.
    // refresh + 1회 재시도 후 성공하면 status 가 connected 로 유지된다 (애초에
    // 격하 없음). pingConnection() 의 동일 패턴과 정책 통일.
    it('on 401 — refreshes access_token and retries once; status stays connected on retry success (§6.1)', async () => {
      const integration = makeIntegration();
      wireRefreshTransaction(integration);
      setRefreshClientEnv();

      // (1) 1차 API 401 — race window. (2) refresh 200. (3) 재시도 API 200.
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          { error: 'invalid_token', error_description: 'expired' },
          { status: 401 },
        ),
      );
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 7200,
        }),
      );
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ products: [{ product_no: 1 }] }),
      );

      const res = await client.call(integration, {
        method: 'GET',
        path: 'products',
      });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      // 2번째 fetch 는 refresh endpoint.
      expect(fetchMock.mock.calls[1][0]).toBe(
        'https://myshop.cafe24api.com/api/v2/oauth/token',
      );
      // 3번째 fetch 는 새 access_token 으로 동일 path 재호출.
      expect(fetchMock.mock.calls[2][0]).toBe(
        'https://myshop.cafe24api.com/api/v2/admin/products',
      );
      expect(
        (fetchMock.mock.calls[2][1] as RequestInit).headers as Record<
          string,
          string
        >,
      ).toMatchObject({ Authorization: 'Bearer new-access' });
      expect(res.status).toBe(200);

      // 핵심 invariant — 재시도 성공 시 status 는 connected 유지.
      expect(integration.status).toBe('connected');
      expect(integration.statusReason).toBeNull();
      // markAuthFailed 호출 안 됨 — repo.update 가 status='error' 로 불리지
      // 않았다. (refresh 의 transaction 안 save 는 별도 manager 의 txRepo
      // 를 통과하므로 외부 repo.update mock 과 무관.)
      const errorUpdates = repo.update.mock.calls.filter(
        (c: unknown[]) =>
          typeof c[1] === 'object' &&
          c[1] !== null &&
          (c[1] as { status?: string }).status === 'error',
      );
      expect(errorUpdates).toHaveLength(0);

      clearRefreshClientEnv();
    });

    // T-2 (spec §6.1 401 → 재시도도 401 → 격하)
    it('on 401 → refresh OK → retry still 401 — flips to error(auth_failed) and throws', async () => {
      const integration = makeIntegration();
      wireRefreshTransaction(integration);
      setRefreshClientEnv();

      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ error: 'invalid_token' }, { status: 401 }),
      );
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 7200,
        }),
      );
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          { error: 'invalid_token', error_description: 'still expired' },
          { status: 401 },
        ),
      );

      await expect(
        client.call(integration, { method: 'GET', path: 'orders' }),
      ).rejects.toBeInstanceOf(Cafe24AuthFailedError);

      // API 401 + refresh + API 401 = 3 fetches.
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({
          status: 'error',
          statusReason: 'auth_failed',
        }),
      );
      expect(integration.status).toBe('error');
      expect(integration.statusReason).toBe('auth_failed');

      clearRefreshClientEnv();
    });

    // T-3 (spec §6.1) — refresh 단계 자체가 401 (invalid_grant) 이면
    // refresh 단계가 이미 markAuthFailed 발사 + throw. API 재시도 없음.
    it('on 401 → refresh itself returns 401 (invalid_grant) — refresh step demotes; no API retry', async () => {
      const integration = makeIntegration();
      wireRefreshTransaction(integration);
      setRefreshClientEnv();

      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ error: 'invalid_token' }, { status: 401 }),
      );
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ error: 'invalid_grant' }, { status: 401 }),
      );

      await expect(
        client.call(integration, { method: 'GET', path: 'orders' }),
      ).rejects.toBeInstanceOf(Cafe24AuthFailedError);

      // API 401 + refresh 401 — 재시도 없음 = 2 fetches only.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({
          status: 'error',
          statusReason: 'auth_failed',
        }),
      );

      clearRefreshClientEnv();
    });

    it('surfaces Cafe24 error_code + error_message in Error.message so MCP callers see the cause', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          {
            error_code: 'INSUFFICIENT_SCOPE',
            error_message:
              'Access token does not have the required permissions',
          },
          { status: 403 },
        ),
      );

      const integration = makeIntegration();
      const caught = await client
        .call(integration, { method: 'GET', path: 'products' })
        .catch((err: unknown) => err);
      expect(caught).toBeInstanceOf(Cafe24AuthFailedError);
      const message = (caught as Error).message;
      expect(message).toContain('INSUFFICIENT_SCOPE');
      expect(message).toContain(
        'Access token does not have the required permissions',
      );
    });

    // 401 의 surface 메시지는 재시도 후 throw 시 살아남아야 한다 (1차/2차
    // 모두 같은 error_description 을 echo 한다고 가정).
    it('surfaces OAuth-shape error/error_description fields after refresh+retry exhausted (Cafe24 token endpoint format)', async () => {
      const integration = makeIntegration();
      wireRefreshTransaction(integration);
      setRefreshClientEnv();

      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          {
            error: 'invalid_token',
            error_description: 'Access token has expired',
          },
          { status: 401 },
        ),
      );
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 7200,
        }),
      );
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          {
            error: 'invalid_token',
            error_description: 'Access token has expired',
          },
          { status: 401 },
        ),
      );

      const caught = await client
        .call(integration, { method: 'GET', path: 'orders' })
        .catch((err: unknown) => err);
      expect(caught).toBeInstanceOf(Cafe24AuthFailedError);
      const message = (caught as Error).message;
      expect(message).toContain('invalid_token');
      expect(message).toContain('Access token has expired');

      clearRefreshClientEnv();
    });

    it('surfaces nested error.code/error.message shape (modern v2 API format)', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          {
            error: {
              code: 'APP_NOT_INSTALLED',
              message: 'The app has not been installed on this mall',
            },
          },
          { status: 403 },
        ),
      );

      const integration = makeIntegration();
      const caught = await client
        .call(integration, { method: 'GET', path: 'products' })
        .catch((err: unknown) => err);
      expect(caught).toBeInstanceOf(Cafe24AuthFailedError);
      const message = (caught as Error).message;
      expect(message).toContain('APP_NOT_INSTALLED');
      expect(message).toContain('The app has not been installed on this mall');
    });

    // REQ-C3 — 403 응답에 scope-부족 시그널이 있으면 statusReason='insufficient_scope'
    // 로 분기. spec §6 의 `error(insufficient_scope)` 전이.
    it('on 403 + INSUFFICIENT_SCOPE signal — flips statusReason to insufficient_scope (no refresh)', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          {
            error_code: 'INSUFFICIENT_SCOPE',
            error_message: 'missing scope: mall.write_product',
          },
          { status: 403 },
        ),
      );
      const integration = makeIntegration();
      await expect(
        client.call(integration, { method: 'GET', path: 'products' }),
      ).rejects.toBeInstanceOf(Cafe24AuthFailedError);
      // 403 — refresh 시도 안 함, 1 fetch.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({
          status: 'error',
          statusReason: 'insufficient_scope',
        }),
      );
      expect(integration.statusReason).toBe('insufficient_scope');
    });

    it('on 401 — always auth_failed even if INSUFFICIENT_SCOPE signal echoed (insufficient_scope is 403-only)', async () => {
      const integration = makeIntegration();
      wireRefreshTransaction(integration);
      setRefreshClientEnv();

      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          { error_code: 'INSUFFICIENT_SCOPE', error_message: 'whatever' },
          { status: 401 },
        ),
      );
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 7200,
        }),
      );
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          { error_code: 'INSUFFICIENT_SCOPE', error_message: 'whatever' },
          { status: 401 },
        ),
      );

      await expect(
        client.call(integration, { method: 'GET', path: 'products' }),
      ).rejects.toBeInstanceOf(Cafe24AuthFailedError);
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({ statusReason: 'auth_failed' }),
      );

      clearRefreshClientEnv();
    });
  });

  // REQ-C2 — spec §6 `connected → error(network) | 3회 연속 실패`. fetch 가
  // transport 레벨에서 실패할 때 카운터 증가, 3 도달 시 status 전이.
  describe('consecutive network failures (REQ-C2)', () => {
    it('increments consecutiveNetworkFailures on transport failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
      const integration = makeIntegration({ consecutiveNetworkFailures: 0 });
      await expect(
        client.call(integration, { method: 'GET', path: 'orders' }),
      ).rejects.toBeInstanceOf(Cafe24TransportFailedError);
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({ consecutiveNetworkFailures: 1 }),
      );
    });

    it('demotes to error(network) on 3rd consecutive failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
      const integration = makeIntegration({ consecutiveNetworkFailures: 2 });
      await expect(
        client.call(integration, { method: 'GET', path: 'orders' }),
      ).rejects.toBeInstanceOf(Cafe24TransportFailedError);
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({
          status: 'error',
          statusReason: 'network',
          consecutiveNetworkFailures: 0,
        }),
      );
      expect(integration.status).toBe('error');
      expect(integration.statusReason).toBe('network');
      expect(integration.consecutiveNetworkFailures).toBe(0);
    });

    it('resets counter on successful response', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));
      const integration = makeIntegration({ consecutiveNetworkFailures: 2 });
      await client.call(integration, { method: 'GET', path: 'orders' });
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({ consecutiveNetworkFailures: 0 }),
      );
    });

    it('does not call update when counter is already 0 on success (best-effort skip)', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));
      const integration = makeIntegration({ consecutiveNetworkFailures: 0 });
      await client.call(integration, { method: 'GET', path: 'orders' });
      // 일반 성공 경로에서 update 호출이 없어야 한다 (rapid path).
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('transport failure', () => {
    it('wraps fetch reject as Cafe24TransportFailedError', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
      const integration = makeIntegration();
      await expect(
        client.call(integration, { method: 'GET', path: 'orders' }),
      ).rejects.toBeInstanceOf(Cafe24TransportFailedError);
    });
  });

  describe('token refresh', () => {
    it('refreshes proactively when expires_at within 60s — atomic 4-field update', async () => {
      const within = new Date(Date.now() + 30_000); // 30s — within window
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old-access',
          refresh_token: 'old-refresh',
          scopes: ['mall.read_product'],
          expires_at: within.toISOString(),
          cafe24_operator_id: 'op-1',
        },
        // tokenExpiresAt is the canonical source (spec §10.5) — keep it
        // in sync with credentials.expires_at so the proactive gate sees
        // the same instant on both fields.
        tokenExpiresAt: within,
      });
      process.env.CAFE24_CLIENT_ID = 'env-id';
      process.env.CAFE24_CLIENT_SECRET = 'env-secret';

      // Stub the transaction to actually run the callback against an
      // in-memory repo so we can assert credentials get updated.
      let savedIntegration: Integration | undefined;
      dataSource.transaction.mockImplementation(
        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
          const txRepo = {
            findOne: jest.fn().mockResolvedValue(integration),
            save: jest.fn().mockImplementation(async (e: Integration) => {
              savedIntegration = e;
            }),
          };
          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
        },
      );

      // 1) refresh response
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 7200,
        }),
      );
      // 2) actual API call uses the new access token
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      const res = await client.call(integration, {
        method: 'GET',
        path: 'products',
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const refreshCall = fetchMock.mock.calls[0];
      expect(refreshCall[0]).toBe(
        'https://myshop.cafe24api.com/api/v2/oauth/token',
      );
      const refreshInit = refreshCall[1] as RequestInit;
      expect(refreshInit.method).toBe('POST');
      expect(
        (refreshInit.headers as Record<string, string>).Authorization,
      ).toMatch(/^Basic /);

      // Atomic write inspected
      expect(savedIntegration).toBeDefined();
      const newCreds = savedIntegration!.credentials;
      expect(newCreds.access_token).toBe('new-access');
      expect(newCreds.refresh_token).toBe('new-refresh');
      expect(typeof newCreds.expires_at).toBe('string');
      expect(savedIntegration!.tokenExpiresAt).toBeInstanceOf(Date);

      // 2nd fetch used the refreshed token
      const apiCall = fetchMock.mock.calls[1];
      const apiInit = apiCall[1] as RequestInit;
      expect((apiInit.headers as Record<string, string>).Authorization).toBe(
        'Bearer new-access',
      );

      expect(res.status).toBe(200);

      delete process.env.CAFE24_CLIENT_ID;
      delete process.env.CAFE24_CLIENT_SECRET;
    });

    // Regression — freshly-connected Cafe24 rows historically had a
    // populated `Integration.tokenExpiresAt` column but a NULL
    // `credentials.expires_at` mirror (the OAuth callback only wrote the
    // column). The legacy `ensureFreshToken` gate read only the JSONB
    // mirror and bailed silently, so the access_token was never refreshed
    // and Cafe24 returned 401 (`access_token time expired`) two hours
    // later. Spec §10.5 names the column as canonical — this test pins
    // the column-driven precedence so the bug cannot regress.
    it('refreshes proactively from tokenExpiresAt when credentials.expires_at mirror is missing', async () => {
      const expiredAt = new Date(Date.now() - 60_000); // 60s in the past
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old-access',
          refresh_token: 'old-refresh',
          scopes: ['mall.read_product'],
          // expires_at intentionally absent — simulates the legacy
          // OAuth-callback shape before the §10.5 mirror was added.
          cafe24_operator_id: 'op-1',
        },
        tokenExpiresAt: expiredAt,
      });
      process.env.CAFE24_CLIENT_ID = 'env-id';
      process.env.CAFE24_CLIENT_SECRET = 'env-secret';

      let savedIntegration: Integration | undefined;
      dataSource.transaction.mockImplementation(
        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
          const txRepo = {
            findOne: jest.fn().mockResolvedValue(integration),
            save: jest.fn().mockImplementation(async (e: Integration) => {
              savedIntegration = e;
            }),
          };
          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
        },
      );

      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 7200,
        }),
      );
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      const res = await client.call(integration, {
        method: 'GET',
        path: 'products',
      });

      // Refresh fetch + actual API fetch — proactive path actually fired.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://myshop.cafe24api.com/api/v2/oauth/token',
      );
      expect(savedIntegration).toBeDefined();
      expect(savedIntegration!.credentials.access_token).toBe('new-access');
      expect(typeof savedIntegration!.credentials.expires_at).toBe('string');
      // 2nd fetch carries the refreshed bearer.
      expect(
        (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<
          string,
          string
        >,
      ).toMatchObject({ Authorization: 'Bearer new-access' });
      expect(res.status).toBe(200);

      delete process.env.CAFE24_CLIENT_ID;
      delete process.env.CAFE24_CLIENT_SECRET;
    });

    // 회귀 보호 (2026-05-17) — Cafe24 의 OAuth callback (`normalizeTokenResponse`)
    // 옛 버전은 표준 `expires_in` 만 읽어, `expires_at` (ISO string) 만 돌려주는
    // Cafe24 응답에서 `tokenExpiresAt` 이 항상 NULL 로 저장됐다. 그 row 의
    // `credentials.expires_at` 도 동일 경로로 NULL. 옛 `ensureFreshToken` 은
    // `expiresAtMs === null` 일 때 silently return 해, 신규 Cafe24 통합이
    // 2h 후 첫 호출에서 401 (`access_token time expired`) 으로 좌초했다.
    //
    // 본 테스트는 callback 측 픽스와 별개로 (즉 이미 NULL 로 저장된 row 들이
    // 다음 호출에서 자가 회복되도록) `ensureFreshToken` 이 null expiry 를
    // "needs refresh" 로 해석하는지 검증.
    it('refreshes proactively when both tokenExpiresAt and credentials.expires_at are NULL (NULL = needs refresh)', async () => {
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'stale-access',
          refresh_token: 'stale-refresh',
          scopes: ['mall.read_product'],
          // expires_at intentionally absent (옛 callback bug)
          cafe24_operator_id: 'op-1',
        },
        // tokenExpiresAt also NULL (옛 callback bug)
        tokenExpiresAt: null,
      });
      process.env.CAFE24_CLIENT_ID = 'env-id';
      process.env.CAFE24_CLIENT_SECRET = 'env-secret';

      let savedIntegration: Integration | undefined;
      dataSource.transaction.mockImplementation(
        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
          const txRepo = {
            findOne: jest.fn().mockResolvedValue(integration),
            save: jest.fn().mockImplementation(async (e: Integration) => {
              savedIntegration = e;
            }),
          };
          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
        },
      );

      // 1) refresh response — Cafe24 의 실제 shape (expires_at ISO string)
      const newExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000);
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({
          access_token: 'fresh-access',
          refresh_token: 'fresh-refresh',
          expires_at: newExpiry.toISOString(),
        }),
      );
      // 2) actual API call
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      const res = await client.call(integration, {
        method: 'GET',
        path: 'products',
      });

      // NULL expiry triggered refresh (2 fetches: token endpoint + API).
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://myshop.cafe24api.com/api/v2/oauth/token',
      );

      // Atomic 4-field UPDATE wrote a real expiry instant, picking up the
      // ISO `expires_at` from Cafe24's response.
      expect(savedIntegration).toBeDefined();
      expect(savedIntegration!.tokenExpiresAt).toBeInstanceOf(Date);
      expect(savedIntegration!.tokenExpiresAt!.toISOString()).toBe(
        newExpiry.toISOString(),
      );
      expect(savedIntegration!.credentials.access_token).toBe('fresh-access');
      expect(savedIntegration!.credentials.expires_at).toBe(
        newExpiry.toISOString(),
      );

      // 2nd fetch uses the refreshed bearer.
      expect(
        (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<
          string,
          string
        >,
      ).toMatchObject({ Authorization: 'Bearer fresh-access' });
      expect(res.status).toBe(200);

      delete process.env.CAFE24_CLIENT_ID;
      delete process.env.CAFE24_CLIENT_SECRET;
    });

    /**
     * 회귀 보호 (2026-05-18) — refresh 응답의 access_token 이 JWT 이면 그
     * exp claim 이 응답 body 의 `expires_at` 보다 우선 채택. ISO 의 TZ
     * 모호성으로 인한 9h skew 차단의 핵심 회귀 케이스.
     *
     * spec/2-navigation/4-integration.md ## Rationale "Cafe24 token 만료
     * SoT — JWT exp 격상 (2026-05-18)".
     */
    it('refresh — JWT exp 가 응답 expires_at 보다 우선', async () => {
      const within = new Date(Date.now() + 1000);
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old',
          refresh_token: 'old',
          expires_at: within.toISOString(),
        },
        tokenExpiresAt: within,
      });
      process.env.CAFE24_CLIENT_ID = 'env-id';
      process.env.CAFE24_CLIENT_SECRET = 'env-secret';

      let savedIntegration: Integration | undefined;
      dataSource.transaction.mockImplementation(
        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
          const txRepo = {
            findOne: jest.fn().mockResolvedValue(integration),
            save: jest.fn().mockImplementation(async (e: Integration) => {
              savedIntegration = e;
            }),
          };
          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
        },
      );

      try {
        // JWT exp 는 1h 후, 응답 body 의 expires_at 은 2h 후 — JWT 가 우선
        const jwtExpSec = Math.floor(Date.now() / 1000) + 3600;
        const responseExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
        const jwtToken = makeFakeJwt({ exp: jwtExpSec });
        fetchMock.mockResolvedValueOnce(
          makeJsonResponse({
            access_token: jwtToken,
            refresh_token: 'fresh-refresh',
            expires_at: responseExpiresAt.toISOString(),
          }),
        );
        fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

        await client.call(integration, { method: 'GET', path: 'products' });

        expect(savedIntegration).toBeDefined();
        expect(savedIntegration!.tokenExpiresAt).toBeInstanceOf(Date);
        // 핵심 어서션 — JWT exp 가 응답 expires_at 을 누름
        expect(savedIntegration!.tokenExpiresAt!.getTime()).toBe(
          jwtExpSec * 1000,
        );
        expect(savedIntegration!.credentials.expires_at).toBe(
          new Date(jwtExpSec * 1000).toISOString(),
        );
      } finally {
        delete process.env.CAFE24_CLIENT_ID;
        delete process.env.CAFE24_CLIENT_SECRET;
      }
    });

    /**
     * 회귀 보호 (2026-05-18) — refresh 응답의 expires_at 에 TZ designator
     * 가 누락된 경우 KST (+09:00) 정규화. JWT 가 없는 비정상 (opaque) 토큰
     * 케이스에서 fallback 안전망 동작 확인.
     */
    it('refresh — TZ-less ISO expires_at 은 KST(+09:00) 로 정규화 (JWT 없을 때)', async () => {
      const within = new Date(Date.now() + 1000);
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old',
          refresh_token: 'old',
          expires_at: within.toISOString(),
        },
        tokenExpiresAt: within,
      });
      process.env.CAFE24_CLIENT_ID = 'env-id';
      process.env.CAFE24_CLIENT_SECRET = 'env-secret';

      let savedIntegration: Integration | undefined;
      dataSource.transaction.mockImplementation(
        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
          const txRepo = {
            findOne: jest.fn().mockResolvedValue(integration),
            save: jest.fn().mockImplementation(async (e: Integration) => {
              savedIntegration = e;
            }),
          };
          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
        },
      );

      try {
        const tzLessIso = '2026-12-21T07:09:50.000';
        const expectedUtcMs = Date.parse('2026-12-21T07:09:50.000+09:00');
        fetchMock.mockResolvedValueOnce(
          makeJsonResponse({
            // opaque (비-JWT) access_token
            access_token: 'opaque-fresh-access',
            refresh_token: 'fresh-refresh',
            expires_at: tzLessIso,
          }),
        );
        fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

        await client.call(integration, { method: 'GET', path: 'products' });

        expect(savedIntegration).toBeDefined();
        expect(savedIntegration!.tokenExpiresAt).toBeInstanceOf(Date);
        expect(savedIntegration!.tokenExpiresAt!.getTime()).toBe(expectedUtcMs);
      } finally {
        delete process.env.CAFE24_CLIENT_ID;
        delete process.env.CAFE24_CLIENT_SECRET;
      }
    });

    /**
     * 회귀 보호 — refresh 응답의 expires_at 이 다음 형식들일 때 모두
     * 정확히 처리되어야 한다 (ai-review W10 조치):
     * - `Z` suffix → UTC 그대로
     * - `+09:00` 명시 → 그대로
     * - `+0900` (콜론 없음) → 그대로
     * - TZ-less → KST 부여 (위 별개 테스트 커버)
     */
    it.each([
      {
        label: 'Z suffix (UTC)',
        iso: '2026-12-21T07:09:50.000Z',
      },
      {
        label: '+09:00 명시',
        iso: '2026-12-21T07:09:50.000+09:00',
      },
      {
        label: '+0900 콜론 없음',
        iso: '2026-12-21T07:09:50.000+0900',
      },
    ])('refresh — TZ designator 명시 형식 보존 ($label)', async ({ iso }) => {
      const within = new Date(Date.now() + 1000);
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old',
          refresh_token: 'old',
          expires_at: within.toISOString(),
        },
        tokenExpiresAt: within,
      });
      process.env.CAFE24_CLIENT_ID = 'env-id';
      process.env.CAFE24_CLIENT_SECRET = 'env-secret';

      let savedIntegration: Integration | undefined;
      dataSource.transaction.mockImplementation(
        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
          const txRepo = {
            findOne: jest.fn().mockResolvedValue(integration),
            save: jest.fn().mockImplementation(async (e: Integration) => {
              savedIntegration = e;
            }),
          };
          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
        },
      );

      try {
        const expectedMs = Date.parse(iso);
        fetchMock.mockResolvedValueOnce(
          makeJsonResponse({
            access_token: 'opaque-tz-test',
            refresh_token: 'fresh-refresh',
            expires_at: iso,
          }),
        );
        fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

        await client.call(integration, { method: 'GET', path: 'products' });

        expect(savedIntegration).toBeDefined();
        // TZ designator 가 있으면 정규화 적용 안 됨 — 원본 epoch 보존
        expect(savedIntegration!.tokenExpiresAt!.getTime()).toBe(expectedMs);
      } finally {
        delete process.env.CAFE24_CLIENT_ID;
        delete process.env.CAFE24_CLIENT_SECRET;
      }
    });

    /**
     * 회귀 보호 — refresh 응답의 access_token / expires_in / expires_at 가
     * 모두 비정상 (JWT 디코드 실패 + expires_in 없음 + expires_at 가 parse
     * 불가 문자열) 일 때 2h default 로 강하 (ai-review W11 조치).
     */
    it('refresh — JWT/expires_in/parse 가능한 expires_at 모두 없을 때 2h default fallback', async () => {
      const within = new Date(Date.now() + 1000);
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old',
          refresh_token: 'old',
          expires_at: within.toISOString(),
        },
        tokenExpiresAt: within,
      });
      process.env.CAFE24_CLIENT_ID = 'env-id';
      process.env.CAFE24_CLIENT_SECRET = 'env-secret';

      let savedIntegration: Integration | undefined;
      dataSource.transaction.mockImplementation(
        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
          const txRepo = {
            findOne: jest.fn().mockResolvedValue(integration),
            save: jest.fn().mockImplementation(async (e: Integration) => {
              savedIntegration = e;
            }),
          };
          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
        },
      );

      try {
        const before = Date.now();
        fetchMock.mockResolvedValueOnce(
          makeJsonResponse({
            access_token: 'opaque-not-jwt',
            refresh_token: 'fresh-refresh',
            // parse 불가능한 문자열 — Date.parse → NaN
            expires_at: 'not-a-valid-iso',
          }),
        );
        fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

        await client.call(integration, { method: 'GET', path: 'products' });

        expect(savedIntegration).toBeDefined();
        const savedMs = savedIntegration!.tokenExpiresAt!.getTime();
        // 2h ± 1s 허용 (테스트 실행 wall clock drift)
        expect(savedMs).toBeGreaterThanOrEqual(
          before + 2 * 60 * 60 * 1000 - 1000,
        );
        expect(savedMs).toBeLessThanOrEqual(
          Date.now() + 2 * 60 * 60 * 1000 + 1000,
        );
      } finally {
        delete process.env.CAFE24_CLIENT_ID;
        delete process.env.CAFE24_CLIENT_SECRET;
      }
    });

    it('refresh 401 marks Integration as auth_failed', async () => {
      const within = new Date(Date.now() + 1000); // 1s — well within REFRESH_WINDOW_MS
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old',
          refresh_token: 'old',
          expires_at: within.toISOString(),
        },
        tokenExpiresAt: within,
      });
      process.env.CAFE24_CLIENT_ID = 'env-id';
      process.env.CAFE24_CLIENT_SECRET = 'env-secret';

      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({ error: 'invalid_grant' }, { status: 401 }),
      );

      await expect(
        client.call(integration, { method: 'GET', path: 'products' }),
      ).rejects.toBeInstanceOf(Cafe24AuthFailedError);

      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({
          status: 'error',
          statusReason: 'auth_failed',
        }),
      );

      delete process.env.CAFE24_CLIENT_ID;
      delete process.env.CAFE24_CLIENT_SECRET;
    });
  });

  // Mutex semantics (withIntegrationLock) are exercised indirectly by the
  // refresh-during-call sequencing test above and verified through code
  // review. Direct integration-level mutex unit tests were dropped after
  // they were found to interact poorly with jest's unhandled-rejection
  // capture for the "task throws" case — the same correctness is covered
  // by the live serialisation that the refresh test relies on.

  describe('queue-backed refresh (multi-instance race protection)', () => {
    // 큐가 바인딩된 경로 — production wiring. Cafe24ApiClient 가 직접
    // refreshAccessToken 을 호출하는 대신, BullMQ 큐에 enqueue + worker
    // 완료 대기 + DB 재로드 패턴으로 동작하는지 검증.
    let queue: { add: jest.Mock };
    let queueEvents: object;
    let integrationRepo: { findOne: jest.Mock };
    let queuedClient: Cafe24ApiClient;
    const expiredAt = new Date(Date.now() - 60_000);
    const refreshedAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    beforeEach(() => {
      integrationRepo = { findOne: jest.fn() };
      queue = { add: jest.fn() };
      queueEvents = {}; // opaque — passed through to waitUntilFinished

      queuedClient = new Cafe24ApiClient(
        integrationRepo as never,
        dataSource as never,
        fetchMock as unknown as typeof fetch,
        sleepMock as unknown as (ms: number) => Promise<void>,
        queue as never,
        queueEvents as never,
      );
    });

    it('routes refresh through BullMQ when queue is bound: jobId dedup + re-fetch', async () => {
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old',
          refresh_token: 'old-refresh',
          scopes: ['mall.read_product'],
        },
        tokenExpiresAt: expiredAt,
      });

      // worker 가 DB 를 갱신했다고 가정 — client 가 finOne 으로 다시 로드.
      const refreshedIntegration = {
        ...integration,
        credentials: {
          ...integration.credentials,
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_at: refreshedAt.toISOString(),
        },
        tokenExpiresAt: refreshedAt,
        status: 'connected',
        statusReason: null,
        lastError: null,
      };
      integrationRepo.findOne.mockResolvedValue(refreshedIntegration);

      // queue.add 가 반환하는 job 의 waitUntilFinished — 즉시 성공.
      queue.add.mockResolvedValue({
        id: integration.id,
        waitUntilFinished: jest.fn().mockResolvedValue(undefined),
      });

      // 실제 Cafe24 API 호출 — 1회 (refresh 는 큐 worker 가 처리, client 는 안 함)
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      const res = await queuedClient.call(integration, {
        method: 'GET',
        path: 'products',
      });

      // refresh fetch 는 일어나지 않음 — worker 의 책임. client 는 API 1회만 fetch.
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // 큐 enqueue 확인 — jobId = integrationId
      expect(queue.add).toHaveBeenCalledWith(
        'refresh-cafe24-token',
        { integrationId: integration.id, source: 'proactive' },
        expect.objectContaining({ jobId: integration.id, attempts: 1 }),
      );

      // 재로드 + 새 bearer 사용
      expect(integrationRepo.findOne).toHaveBeenCalledWith({
        where: { id: integration.id },
      });
      const apiCall = fetchMock.mock.calls[0];
      const apiInit = apiCall[1] as RequestInit;
      expect((apiInit.headers as Record<string, string>).Authorization).toBe(
        'Bearer new-access',
      );

      // 호출자 reference 도 갱신되었는지 (executeWithRateLimit 가 본 token 사용)
      expect(integration.tokenExpiresAt).toEqual(refreshedAt);
      expect(res.status).toBe(200);
    });

    it('surfaces Cafe24AuthFailedError when worker marks integration as auth_failed', async () => {
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old',
          refresh_token: 'invalid-refresh',
        },
        tokenExpiresAt: expiredAt,
      });

      // worker 가 refresh 실패 후 markAuthFailed 수행 → DB row 가 error 상태
      integrationRepo.findOne.mockResolvedValue({
        ...integration,
        status: 'error',
        statusReason: 'auth_failed',
        lastError: { code: 'CAFE24_AUTH_FAILED', message: 'refresh failed' },
      });

      queue.add.mockResolvedValue({
        id: integration.id,
        waitUntilFinished: jest.fn().mockRejectedValue(new Error('job failed')),
      });

      await expect(
        queuedClient.call(integration, { method: 'GET', path: 'products' }),
      ).rejects.toBeInstanceOf(Cafe24AuthFailedError);

      // API fetch 는 발생하지 않음 — refresh 가 실패해 call() 가 일찍 종료
      expect(fetchMock).not.toHaveBeenCalled();
    });

    // B-5-1: PR #67 의 error(auth_failed) 외 다른 statusReason 검증. worker 가
    // network timeout 으로 실패해 status='error', statusReason='network' (또는
    // 그 외 비-auth_failed) 으로 row 를 표시한 경우 — refreshViaQueue 는 그
    // 분기가 아니므로 Cafe24TransportFailedError 를 던져야 한다 (auth 가 아닌
    // transport-level failure).
    it('non-auth_failed statusReason on row — throws Cafe24TransportFailedError (not AuthFailed)', async () => {
      const expiredAt = new Date(Date.now() - 10 * 60 * 1000);
      const integration = makeIntegration({
        tokenExpiresAt: expiredAt,
      });
      // expire credentials.expires_at as well so the proactive gate fires.
      (integration.credentials as { expires_at: string }).expires_at =
        expiredAt.toISOString();

      // worker 가 network failure 누적으로 status=error,statusReason='network'
      // 처리. auth_failed 분기를 타지 않아야 한다.
      integrationRepo.findOne.mockResolvedValue({
        ...integration,
        status: 'error',
        statusReason: 'network',
        tokenExpiresAt: expiredAt,
        lastError: { code: 'CAFE24_TRANSPORT_FAILED', message: 'ECONNRESET' },
      });

      queue.add.mockResolvedValue({
        id: integration.id,
        waitUntilFinished: jest.fn().mockRejectedValue(new Error('job failed')),
      });

      await expect(
        queuedClient.call(integration, { method: 'GET', path: 'products' }),
      ).rejects.toBeInstanceOf(Cafe24TransportFailedError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('skips queue path when token still fresh (proactive gate short-circuits before enqueue)', async () => {
      const integration = makeIntegration({
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h future
      });

      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      await queuedClient.call(integration, {
        method: 'GET',
        path: 'products',
      });

      expect(queue.add).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // 회귀 — CONC-1: waitUntilFinished 가 timeout 으로 reject 되었지만 worker
    // 가 실제로는 refresh 를 끝낸 시나리오. catch 블록이 DB 재확인 후
    // `tokenExpiresAt > now + REFRESH_WINDOW_MS` 면 정상 진행해야 하며,
    // 호출자 객체에 fresh credentials 를 mutate 한 뒤 API 호출까지 성공.
    // 이 보호가 없으면 caller 의 stale reference 로 retry 시 401 → false
    // `auth_failed` 격하.
    it('recovers when waitUntilFinished times out but worker already refreshed (CONC-1)', async () => {
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old',
          refresh_token: 'r',
        },
        tokenExpiresAt: expiredAt,
      });

      // worker 가 실제로는 갱신 완료 — DB 에 fresh state.
      integrationRepo.findOne.mockResolvedValue({
        ...integration,
        credentials: {
          ...integration.credentials,
          access_token: 'silently-refreshed',
        },
        tokenExpiresAt: refreshedAt,
        status: 'connected',
        statusReason: null,
        lastError: null,
      });

      // waitUntilFinished 는 reject — Redis 이벤트 손실 시뮬레이션.
      queue.add.mockResolvedValue({
        id: integration.id,
        waitUntilFinished: jest
          .fn()
          .mockRejectedValue(new Error('waitUntilFinished timeout')),
      });

      // 실제 API call 은 1회 — caller mutate 후 정상 진행.
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      const res = await queuedClient.call(integration, {
        method: 'GET',
        path: 'products',
      });

      // caller object 가 fresh state 로 mutate 됨
      expect(integration.tokenExpiresAt).toEqual(refreshedAt);
      // API fetch 는 새 bearer 로 1회 호출됨
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(
        (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
          string,
          string
        >,
      ).toMatchObject({ Authorization: 'Bearer silently-refreshed' });
      expect(res.status).toBe(200);
    });

    // 회귀 — TEST-C1: queue.add 자체가 Redis 장애로 throw 하는 경로.
    // 현재 구현은 별도 catch 가 없어 Error 가 그대로 propagate 된다 — 그
    // 동작이 의도임을 명시 (call() 의 호출자가 어떤 error 타입을 받는지
    // 고정). 향후 transport 분류로 wrap 하려면 본 테스트가 함께 수정됨.
    it('propagates queue.add failures (Redis down) as-is to caller', async () => {
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old',
          refresh_token: 'r',
        },
        tokenExpiresAt: expiredAt,
      });

      queue.add.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        queuedClient.call(integration, { method: 'GET', path: 'products' }),
      ).rejects.toThrow('ECONNREFUSED');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    // 회귀 — TEST-C1: timeout reject + DB row 가 여전히 `connected` 인데
    // tokenExpiresAt 가 fresh 가 아닌 케이스. worker 가 진짜로 실패했지만
    // markAuthFailed 까지 도달 못한 시나리오. TransportFailedError 로
    // surface 되어야 한다 (auth_failed 가 아님).
    it('surfaces TransportFailedError when timeout reject + DB row not auth_failed and token not fresh', async () => {
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old',
          refresh_token: 'r',
        },
        tokenExpiresAt: expiredAt,
      });

      // DB row 는 여전히 connected 이지만 tokenExpiresAt 갱신되지 않음.
      integrationRepo.findOne.mockResolvedValue({
        ...integration,
        status: 'connected',
        statusReason: null,
        lastError: null,
        tokenExpiresAt: expiredAt,
      });

      queue.add.mockResolvedValue({
        id: integration.id,
        waitUntilFinished: jest
          .fn()
          .mockRejectedValue(new Error('genuine timeout')),
      });

      await expect(
        queuedClient.call(integration, { method: 'GET', path: 'products' }),
      ).rejects.toBeInstanceOf(Cafe24TransportFailedError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    // 회귀 — TEST-C1: worker 성공 + queueEvent 도 정상 후 findOne 이 null
    // 반환 (통합이 그 사이 삭제) — TransportFailedError surface.
    it('surfaces TransportFailedError when integration vanishes between worker success and re-fetch', async () => {
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old',
          refresh_token: 'r',
        },
        tokenExpiresAt: expiredAt,
      });

      integrationRepo.findOne.mockResolvedValue(null);

      queue.add.mockResolvedValue({
        id: integration.id,
        waitUntilFinished: jest.fn().mockResolvedValue(undefined),
      });

      await expect(
        queuedClient.call(integration, { method: 'GET', path: 'products' }),
      ).rejects.toBeInstanceOf(Cafe24TransportFailedError);
    });

    /**
     * 회귀 보호 (2026-05-18) — `executeWithRateLimit` 의 401 자가 회복 경로.
     * `performAuthRefresh` 가 `refreshViaQueue(integration, 'reactive_401')`
     * 으로 dispatch 하며, worker 가 short-circuit 을 skip 하고 refresh 를
     * 수행한 뒤 caller 가 새 token 으로 retry → 성공.
     *
     * 본 테스트는 enqueue source 와 removeOnComplete 옵션이 정확히 전달되는지
     * + retry 가 새 token 으로 발사되는지 회귀 방지.
     *
     * spec/2-navigation/4-integration.md ## Rationale "Cafe24 token 만료
     * SoT — JWT exp 격상 (2026-05-18)".
     */
    it('401 reactive 자가 회복 — performAuthRefresh 가 reactive_401 source 로 enqueue + retry 성공', async () => {
      const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'stale-but-db-says-fresh',
          refresh_token: 'r-valid',
          scopes: ['mall.read_product'],
          // DB 가 1h 미래로 본다 (TZ 모호성 회귀 시뮬레이션).
          expires_at: tokenExpiresAt.toISOString(),
        },
        tokenExpiresAt,
      });

      // worker 가 refresh 완료 후 DB row.
      const refreshedRow = {
        ...integration,
        credentials: {
          ...integration.credentials,
          access_token: 'fresh-via-reactive',
          refresh_token: 'fresh-refresh',
          expires_at: refreshedAt.toISOString(),
        },
        tokenExpiresAt: refreshedAt,
        status: 'connected',
        statusReason: null,
        lastError: null,
      };
      integrationRepo.findOne.mockResolvedValue(refreshedRow);

      queue.add.mockResolvedValue({
        id: integration.id,
        waitUntilFinished: jest.fn().mockResolvedValue(undefined),
      });

      // 1차 API 호출 — Cafe24 가 stale token 으로 401 ('access_token time expired').
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          {
            error: 'invalid_token',
            error_description: 'access_token time expired',
          },
          { status: 401 },
        ),
      );
      // 2차 API 호출 (retry) — refresh 후 새 token 으로 성공.
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      const res = await queuedClient.call(integration, {
        method: 'GET',
        path: 'products',
      });

      // proactive 게이트는 통과 (tokenExpiresAt 가 1h 미래라 skip)
      // → 401 자가 회복이 reactive_401 로 enqueue.
      expect(queue.add).toHaveBeenCalledTimes(1);
      const addCall = queue.add.mock.calls[0];
      expect(addCall[0]).toBe('refresh-cafe24-token');
      expect(addCall[1]).toEqual({
        integrationId: integration.id,
        source: 'reactive_401',
      });
      // 핵심 어서션 — reactive_401 은 removeOnComplete.age=0
      expect(addCall[2]).toMatchObject({
        jobId: integration.id,
        attempts: 1,
        removeOnComplete: { age: 0 },
      });

      // retry 가 새 bearer 로 발사
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const retryInit = fetchMock.mock.calls[1][1] as RequestInit;
      expect((retryInit.headers as Record<string, string>).Authorization).toBe(
        'Bearer fresh-via-reactive',
      );
      expect(res.status).toBe(200);
    });

    // spec/4-nodes/4-integration/4-cafe24.md §8.6 — public refresh entry.
    // Cafe24McpToolProvider.tryRecoverExpired 가 호출하는 진입점이며,
    // (a) 큐 바인딩 시 jobId dedup 경로, (b) 미바인딩 시 in-process refresh
    // 폴백, (c) `source` 라벨 전달, 셋 다 검증.
    describe('refreshTokenViaQueue (public entry for buildTools self-heal)', () => {
      it('routes through BullMQ when queue is bound with given source label', async () => {
        const integration = makeIntegration({
          credentials: {
            mall_id: 'myshop',
            app_type: 'public',
            access_token: 'a',
            refresh_token: 'r-valid',
            expires_at: expiredAt.toISOString(),
          },
          tokenExpiresAt: expiredAt,
        });
        integrationRepo.findOne.mockResolvedValue({
          ...integration,
          tokenExpiresAt: refreshedAt,
          status: 'connected',
        });
        const waitUntilFinished = jest.fn().mockResolvedValue(undefined);
        queue.add.mockResolvedValue({
          id: integration.id,
          waitUntilFinished,
        });

        await queuedClient.refreshTokenViaQueue(integration, 'background');

        expect(queue.add).toHaveBeenCalledWith(
          'refresh-cafe24-token',
          { integrationId: integration.id, source: 'background' },
          expect.objectContaining({
            jobId: integration.id,
            attempts: 1,
          }),
        );
        expect(waitUntilFinished).toHaveBeenCalled();
      });

      it('falls back to in-process refreshAccessToken when queue is not bound', async () => {
        // queue 미주입 client — call() 의 fallback 경로와 동일 wiring.
        const noQueueRepo = { findOne: jest.fn() };
        const noQueueClient = new Cafe24ApiClient(
          noQueueRepo as never,
          dataSource as never,
          fetchMock as unknown as typeof fetch,
          sleepMock as unknown as (ms: number) => Promise<void>,
          // queue / queueEvents 둘 다 undefined.
        );
        // public app 의 refreshAccessToken 은 환경 변수 client_id/secret 을
        // 사용 — fallback 진입 자체를 검증할 수 있도록 set 후 finally cleanup.
        process.env.CAFE24_CLIENT_ID = 'test-client-id';
        process.env.CAFE24_CLIENT_SECRET = 'test-client-secret';
        try {
          const integration = makeIntegration({
            credentials: {
              mall_id: 'myshop',
              app_type: 'public',
              access_token: 'a',
              refresh_token: 'r-valid',
              expires_at: expiredAt.toISOString(),
            },
            tokenExpiresAt: expiredAt,
          });
          // refreshAccessToken 의 token endpoint mock.
          fetchMock.mockResolvedValueOnce(
            new Response(
              JSON.stringify({
                access_token: 'new-token',
                refresh_token: 'new-refresh',
                expires_at: refreshedAt.toISOString(),
              }),
              { status: 200 },
            ) as never,
          );
          // dataSource.transaction 안에서 row 를 잡고 업데이트하는 in-process
          // refreshAccessToken 경로. transaction 콜백이 findOne 으로 row 를
          // 재로드한 뒤 save 한다 — manager mock 을 inline 으로 wire.
          dataSource.transaction.mockImplementation(
            async (cb: (manager: unknown) => Promise<unknown>) =>
              cb({
                getRepository: () => ({
                  findOne: jest.fn().mockResolvedValue(integration),
                  save: jest.fn().mockResolvedValue(integration),
                }),
              }),
          );
          await expect(
            noQueueClient.refreshTokenViaQueue(integration, 'background'),
          ).resolves.toBeUndefined();
          // in-process refreshAccessToken 가 token endpoint 를 호출함.
          expect(fetchMock).toHaveBeenCalled();
        } finally {
          delete process.env.CAFE24_CLIENT_ID;
          delete process.env.CAFE24_CLIENT_SECRET;
        }
      });
    });
  });

  // 사용자 진단용 연결 테스트. spec §5.8 의 ping endpoint 를 호출해
  // 실제 access_token 유효성을 검증한다. 노드 호출 경로(call())와 달리
  // 401 시 markAuthFailed 즉시 발사하지 않고 refresh + 1회 재시도 후
  // 그래도 실패할 때만 auth_failed 로 격하한다 (race-condition 자가 회복).
  describe('pingConnection (test-connection probe)', () => {
    afterEach(() => {
      // 환경 변수 격리 — describe 내 it 들이 process.env 에 set 한 값이
      // 다른 테스트로 leak 되지 않도록 보장. 예외로 set 후 delete 미실행
      // 케이스도 여기서 일괄 정리.
      delete process.env.CAFE24_CLIENT_ID;
      delete process.env.CAFE24_CLIENT_SECRET;
    });

    function freshIntegration(): Integration {
      // 토큰이 expiry window 밖에 있어 ensureFreshToken 이 트리거되지 않게
      // 한다. 401 retry 분기를 명시적으로 검증하기 위함.
      const farFuture = new Date(Date.now() + 24 * 60 * 60 * 1000);
      return makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old-access',
          refresh_token: 'old-refresh',
          scopes: ['mall.read_product'],
          expires_at: farFuture.toISOString(),
          cafe24_operator_id: 'op-1',
        },
        tokenExpiresAt: farFuture,
        consecutiveNetworkFailures: 0,
      });
    }

    it('200 — calls /apps and returns success without touching status', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({
          apps: [{ app_name: 'My App', mall_id: 'myshop' }],
        }),
      );
      const integration = freshIntegration();

      const result = await client.pingConnection(integration);

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = new URL(fetchMock.mock.calls[0][0] as string);
      expect(url.origin).toBe('https://myshop.cafe24api.com');
      expect(url.pathname).toBe('/api/v2/admin/apps');
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect((init.headers as Record<string, string>).Authorization).toBe(
        'Bearer old-access',
      );
      // markAuthFailed 부작용 없음
      expect(repo.update).not.toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({ status: 'error' }),
      );
      expect(integration.status).toBe('connected');
    });

    it('401 → refresh → 200 retry — success without flipping status', async () => {
      const integration = freshIntegration();
      process.env.CAFE24_CLIENT_ID = 'env-id';
      process.env.CAFE24_CLIENT_SECRET = 'env-secret';

      // tx mock — refresh 가 실제로 access_token 을 갈아끼우도록.
      dataSource.transaction.mockImplementation(
        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
          const txRepo = {
            findOne: jest.fn().mockResolvedValue(integration),
            save: jest.fn().mockResolvedValue(undefined),
          };
          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
        },
      );

      fetchMock
        // 1) initial /apps → 401 (stale token)
        .mockResolvedValueOnce(
          makeJsonResponse(
            { error: 'invalid_token', error_description: 'expired' },
            { status: 401 },
          ),
        )
        // 2) refresh /oauth/token → 200
        .mockResolvedValueOnce(
          makeJsonResponse({
            access_token: 'new-access',
            refresh_token: 'new-refresh',
            expires_in: 7200,
          }),
        )
        // 3) retry /apps with new token → 200
        .mockResolvedValueOnce(
          makeJsonResponse({ apps: [{ app_name: 'My App' }] }),
        );

      const result = await client.pingConnection(integration);

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      // 첫 번째 호출: stale token
      expect(
        (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
          string,
          string
        >,
      ).toMatchObject({ Authorization: 'Bearer old-access' });
      // 두 번째: oauth token endpoint
      expect(fetchMock.mock.calls[1][0]).toBe(
        'https://myshop.cafe24api.com/api/v2/oauth/token',
      );
      // 세 번째: refreshed token 으로 retry
      expect(
        (fetchMock.mock.calls[2][1] as RequestInit).headers as Record<
          string,
          string
        >,
      ).toMatchObject({ Authorization: 'Bearer new-access' });
      // 1회 성공이므로 markAuthFailed 부작용 없음
      expect(repo.update).not.toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({ status: 'error' }),
      );
      expect(integration.status).toBe('connected');

      delete process.env.CAFE24_CLIENT_ID;
      delete process.env.CAFE24_CLIENT_SECRET;
    });

    it('401 → refresh succeeds → retry still 401 — markAuthFailed and returns failure', async () => {
      const integration = freshIntegration();
      process.env.CAFE24_CLIENT_ID = 'env-id';
      process.env.CAFE24_CLIENT_SECRET = 'env-secret';

      dataSource.transaction.mockImplementation(
        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
          const txRepo = {
            findOne: jest.fn().mockResolvedValue(integration),
            save: jest.fn().mockResolvedValue(undefined),
          };
          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
        },
      );

      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse(
            { error: 'invalid_token', error_description: 'expired' },
            { status: 401 },
          ),
        )
        .mockResolvedValueOnce(
          makeJsonResponse({
            access_token: 'new-access',
            refresh_token: 'new-refresh',
            expires_in: 7200,
          }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse(
            { error: 'invalid_token', error_description: 'still bad' },
            { status: 401 },
          ),
        );

      const result = await client.pingConnection(integration);

      expect(result.success).toBe(false);
      expect(result.code).toBe('CAFE24_AUTH_FAILED');
      expect(fetchMock).toHaveBeenCalledTimes(3);
      // 재시도 후 markAuthFailed 발사
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({
          status: 'error',
          statusReason: 'auth_failed',
        }),
      );
      expect(integration.status).toBe('error');
      expect(integration.statusReason).toBe('auth_failed');

      delete process.env.CAFE24_CLIENT_ID;
      delete process.env.CAFE24_CLIENT_SECRET;
    });

    it('401 → refresh itself fails (refresh_token invalid) — markAuthFailed and returns failure', async () => {
      const integration = freshIntegration();
      process.env.CAFE24_CLIENT_ID = 'env-id';
      process.env.CAFE24_CLIENT_SECRET = 'env-secret';

      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse(
            { error: 'invalid_token', error_description: 'expired' },
            { status: 401 },
          ),
        )
        // refresh endpoint → 401 invalid_grant
        .mockResolvedValueOnce(
          makeJsonResponse({ error: 'invalid_grant' }, { status: 401 }),
        );

      const result = await client.pingConnection(integration);

      expect(result.success).toBe(false);
      expect(result.code).toBe('CAFE24_AUTH_FAILED');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      // refreshAccessToken 의 markAuthFailed 가 이미 status 를 격하시킴
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({
          status: 'error',
          statusReason: 'auth_failed',
        }),
      );

      delete process.env.CAFE24_CLIENT_ID;
      delete process.env.CAFE24_CLIENT_SECRET;
    });

    it('403 — returns INSUFFICIENT_SCOPE without flipping status (diagnostic only)', async () => {
      const integration = freshIntegration();
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          {
            error_code: 'INSUFFICIENT_SCOPE',
            error_message: 'missing mall.read_application',
          },
          { status: 403 },
        ),
      );

      const result = await client.pingConnection(integration);

      expect(result.success).toBe(false);
      expect(result.code).toBe('CAFE24_INSUFFICIENT_SCOPE');
      expect(result.message).toContain('INSUFFICIENT_SCOPE');
      // 403 은 retry 하지 않고, status 격하도 않는다
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(repo.update).not.toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({ status: 'error' }),
      );
      expect(integration.status).toBe('connected');
    });

    it('401 → refresh succeeds → retry 403 — returns INSUFFICIENT_SCOPE WITHOUT markAuthFailed (403 정책 일관)', async () => {
      const integration = freshIntegration();
      process.env.CAFE24_CLIENT_ID = 'env-id';
      process.env.CAFE24_CLIENT_SECRET = 'env-secret';

      dataSource.transaction.mockImplementation(
        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
          const txRepo = {
            findOne: jest.fn().mockResolvedValue(integration),
            save: jest.fn().mockResolvedValue(undefined),
          };
          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
        },
      );

      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse(
            { error: 'invalid_token', error_description: 'expired' },
            { status: 401 },
          ),
        )
        .mockResolvedValueOnce(
          makeJsonResponse({
            access_token: 'new-access',
            refresh_token: 'new-refresh',
            expires_in: 7200,
          }),
        )
        .mockResolvedValueOnce(
          makeJsonResponse(
            {
              error_code: 'INSUFFICIENT_SCOPE',
              error_message: 'missing scope',
            },
            { status: 403 },
          ),
        );

      const result = await client.pingConnection(integration);

      expect(result.success).toBe(false);
      expect(result.code).toBe('CAFE24_INSUFFICIENT_SCOPE');
      // 첫 403 과 동일하게 status 격하 안 함
      expect(repo.update).not.toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({ status: 'error' }),
      );
      expect(integration.status).toBe('connected');
    });

    it('incomplete credentials — never throws, returns INTEGRATION_INCOMPLETE result', async () => {
      const integration = makeIntegration({
        credentials: {
          // mall_id 누락 — assertCredentials 가 throw 하는 경로
          access_token: 't',
          refresh_token: 'r',
        },
      });

      const result = await client.pingConnection(integration);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INTEGRATION_INCOMPLETE');
      expect(result.message).toContain('mall_id');
      // fetch 자체가 호출되어서는 안 됨
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('transport failure — returns failure WITHOUT incrementing consecutive_network_failures', async () => {
      const integration = freshIntegration();
      integration.consecutiveNetworkFailures = 0;
      fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));

      const result = await client.pingConnection(integration);

      expect(result.success).toBe(false);
      expect(result.code).toBe('CAFE24_TRANSPORT_FAILED');
      // 사용자 진단용 호출이라 노드 실행 카운터에 합산하지 않는다
      expect(repo.update).not.toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({ consecutiveNetworkFailures: 1 }),
      );
    });

    it('proactive refresh fires before /apps when token within REFRESH_WINDOW_MS', async () => {
      const within = new Date(Date.now() + 30_000);
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 'old-access',
          refresh_token: 'old-refresh',
          scopes: ['mall.read_product'],
          expires_at: within.toISOString(),
          cafe24_operator_id: 'op-1',
        },
        tokenExpiresAt: within,
      });
      process.env.CAFE24_CLIENT_ID = 'env-id';
      process.env.CAFE24_CLIENT_SECRET = 'env-secret';

      dataSource.transaction.mockImplementation(
        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
          const txRepo = {
            findOne: jest.fn().mockResolvedValue(integration),
            save: jest.fn().mockResolvedValue(undefined),
          };
          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
        },
      );

      fetchMock
        // refresh
        .mockResolvedValueOnce(
          makeJsonResponse({
            access_token: 'new-access',
            refresh_token: 'new-refresh',
            expires_in: 7200,
          }),
        )
        // /apps with refreshed token
        .mockResolvedValueOnce(makeJsonResponse({ apps: [] }));

      const result = await client.pingConnection(integration);

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://myshop.cafe24api.com/api/v2/oauth/token',
      );
      const apiCall = fetchMock.mock.calls[1];
      expect(new URL(apiCall[0] as string).pathname).toBe('/api/v2/admin/apps');
      expect(
        (apiCall[1] as RequestInit).headers as Record<string, string>,
      ).toMatchObject({ Authorization: 'Bearer new-access' });

      delete process.env.CAFE24_CLIENT_ID;
      delete process.env.CAFE24_CLIENT_SECRET;
    });
  });
});
