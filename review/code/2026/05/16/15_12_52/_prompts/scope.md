# 변경 범위(Scope) Review Payload

본 파일은 orchestrator 가 변경 범위(Scope) reviewer 용으로 작성한 입력입니다. 다음 코드 변경이 의도된 범위를 벗어나지 않는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (변경 범위(Scope))

1. **의도 이상의 변경**: 요청된 변경 외 추가 수정이 포함됐는지
2. **불필요한 리팩토링**: 현재 작업과 관련 없는 코드 정리·리팩토링
3. **기능 확장**: 요청하지 않은 기능 추가 (over-engineering)
4. **무관한 수정**: 변경 의도와 관련 없는 파일·코드 영역 수정
5. **포맷팅 변경**: 의미 없는 공백·줄바꿈·포맷팅이 실질 변경과 섞여 있는지
6. **주석 변경**: 불필요한 주석 추가/삭제/수정
7. **임포트 변경**: 사용하지 않는 임포트 추가나 불필요한 정리
8. **설정 변경**: 의도하지 않은 설정 파일 변경

## 리뷰 대상 파일

### 파일 1: backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 97d02fb4fca4be15f05c37fb96a9697ea47c41e9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 15:09:49 2026 +0900

    fix(cafe24): wrap POST/PUT body in `request` envelope
    
    Cafe24 Admin API rejects flat bodies with
    `400 "Please enter the Request parameter."` Every write request must be
    shaped `{ shop_no?, request: { ...rest } }` with shop_no as the only
    field allowed at the top level alongside `request`.
    
    The wrapping is applied centrally inside `Cafe24ApiClient.executeWithRateLimit`
    right before JSON serialisation, so the node handler and the MCP tool
    provider keep passing the metadata-driven body as a flat map and the
    wire format stays a pure protocol concern of the client.
    
    Adds 4 new test cases on `cafe24-api.client.spec.ts` covering PUT
    with/without shop_no, POST, and the degenerate shop_no-only body.
    Existing `cafe24.handler.spec.ts` assertions remain valid because the
    handler→client contract is unchanged (flat body in).
    
    Plan + spec-update note under plan/in-progress for the planner to fold
    the wire-format rule into spec/conventions/cafe24-api-metadata.md.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts b/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts
index c012051f..748c9300 100644
--- a/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts
+++ b/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts
@@ -156,20 +156,93 @@ describe('Cafe24ApiClient', () => {
       expect(res.retries).toBe(0);
     });
 
-    it('PUT — serialises body as JSON with content-type', async () => {
+    it('PUT — wraps body in Cafe24 `request` envelope (shop_no stays top-level)', async () => {
+      // Cafe24 Admin API rejects flat bodies with 400 "Please enter the
+      // Request parameter." All write requests (POST/PUT) MUST be wrapped
+      // as `{ shop_no?, request: { ...rest } }`. shop_no is the only
+      // exception that lives at the top level alongside `request`.
+      // See https://developers.cafe24.com/docs/ko/api/admin/#update-a-product
       fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));
       const integration = makeIntegration();
       await client.call(integration, {
         method: 'PUT',
         path: 'products/1001',
-        body: { product_name: 'Updated' },
+        body: { shop_no: 1, product_name: 'Updated', price: '10000.00' },
       });
 
       const init = fetchMock.mock.calls[0][1] as RequestInit;
       expect((init.headers as Record<string, string>)['Content-Type']).toBe(
         'application/json',
       );
-      expect(init.body).toBe('{"product_name":"Updated"}');
+      expect(JSON.parse(init.body as string)).toEqual({
+        shop_no: 1,
+        request: { product_name: 'Updated', price: '10000.00' },
+      });
+    });
+
+    it('PUT without shop_no — body becomes `{ request: {...} }`', async () => {
+      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));
+      const integration = makeIntegration();
+      await client.call(integration, {
+        method: 'PUT',
+        path: 'products/1001',
+        body: { product_name: 'Updated' },
+      });
+
+      const init = fetchMock.mock.calls[0][1] as RequestInit;
+      expect(JSON.parse(init.body as string)).toEqual({
+        request: { product_name: 'Updated' },
+      });
+    });
+
+    it('POST — same envelope applied to create requests', async () => {
+      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));
+      const integration = makeIntegration();
+      await client.call(integration, {
+        method: 'POST',
+        path: 'products',
+        body: { shop_no: 1, product_name: 'New', price: '5000.00' },
+      });
+
+      const init = fetchMock.mock.calls[0][1] as RequestInit;
+      expect(JSON.parse(init.body as string)).toEqual({
+        shop_no: 1,
+        request: { product_name: 'New', price: '5000.00' },
+      });
+    });
+
+    it('PUT with only shop_no in body — sends shop_no + empty request envelope', async () => {
+      // Degenerate case — caller passed only shop_no. We still emit the
+      // envelope so Cafe24's parser sees the required `request` key rather
+      // than 400 "Please enter the Request parameter."
+      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));
+      const integration = makeIntegration();
+      await client.call(integration, {
+        method: 'PUT',
+        path: 'products/1001',
+        body: { shop_no: 1 },
+      });
+
+      const init = fetchMock.mock.calls[0][1] as RequestInit;
+      expect(JSON.parse(init.body as string)).toEqual({
+        shop_no: 1,
+        request: {},
+      });
+    });
+
+    it('GET — never wraps in envelope (no body)', async () => {
+      fetchMock.mockResolvedValueOnce(makeJsonResponse({ products: [] }));
+      const integration = makeIntegration();
+      await client.call(integration, {
+        method: 'GET',
+        path: 'products',
+        // GET requests carry shop_no on the query string; body is never
+        // populated by the handler. Sanity-check the client doesn't
+        // synthesise one.
+      });
+
+      const init = fetchMock.mock.calls[0][1] as RequestInit;
+      expect(init.body).toBeUndefined();
     });
   });
 

```

#### 전체 파일 컨텍스트
```
import {
  Cafe24ApiClient,
  Cafe24AuthFailedError,
  Cafe24IncompleteCredentialsError,
  Cafe24RateLimitedError,
  Cafe24TransportFailedError,
  __resetCafe24LocksForTesting,
} from './cafe24-api.client';
import type { Integration } from '../../../modules/integrations/entities/integration.entity';

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

    it('PUT — wraps body in Cafe24 `request` envelope (shop_no stays top-level)', async () => {
      // Cafe24 Admin API rejects flat bodies with 400 "Please enter the
      // Request parameter." All write requests (POST/PUT) MUST be wrapped
      // as `{ shop_no?, request: { ...rest } }`. shop_no is the only
      // exception that lives at the top level alongside `request`.
      // See https://developers.cafe24.com/docs/ko/api/admin/#update-a-product
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));
      const integration = makeIntegration();
      await client.call(integration, {
        method: 'PUT',
        path: 'products/1001',
        body: { shop_no: 1, product_name: 'Updated', price: '10000.00' },
      });

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect((init.headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
      expect(JSON.parse(init.body as string)).toEqual({
        shop_no: 1,
        request: { product_name: 'Updated', price: '10000.00' },
      });
    });

    it('PUT without shop_no — body becomes `{ request: {...} }`', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));
      const integration = makeIntegration();
      await client.call(integration, {
        method: 'PUT',
        path: 'products/1001',
        body: { product_name: 'Updated' },
      });

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(init.body as string)).toEqual({
        request: { product_name: 'Updated' },
      });
    });

    it('POST — same envelope applied to create requests', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));
      const integration = makeIntegration();
      await client.call(integration, {
        method: 'POST',
        path: 'products',
        body: { shop_no: 1, product_name: 'New', price: '5000.00' },
      });

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(init.body as string)).toEqual({
        shop_no: 1,
        request: { product_name: 'New', price: '5000.00' },
      });
    });

    it('PUT with only shop_no in body — sends shop_no + empty request envelope', async () => {
      // Degenerate case — caller passed only shop_no. We still emit the
      // envelope so Cafe24's parser sees the required `request` key rather
      // than 400 "Please enter the Request parameter."
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }));
      const integration = makeIntegration();
      await client.call(integration, {
        method: 'PUT',
        path: 'products/1001',
        body: { shop_no: 1 },
      });

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(init.body as string)).toEqual({
        shop_no: 1,
        request: {},
      });
    });

    it('GET — never wraps in envelope (no body)', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ products: [] }));
      const integration = makeIntegration();
      await client.call(integration, {
        method: 'GET',
        path: 'products',
        // GET requests carry shop_no on the query string; body is never
        // populated by the handler. Sanity-check the client doesn't
        // synthesise one.
      });

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.body).toBeUndefined();
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
  });

  describe('auth failure', () => {
    it.each([401, 403] as const)(
      'on %i — flips Integration.status to error(auth_failed) and throws Cafe24AuthFailedError',
      async (status) => {
        fetchMock.mockResolvedValueOnce(
          makeJsonResponse({ error: 'Unauthorized' }, { status }),
        );

        const integration = makeIntegration();
        await expect(
          client.call(integration, { method: 'GET', path: 'orders' }),
        ).rejects.toBeInstanceOf(Cafe24AuthFailedError);

        expect(repo.update).toHaveBeenCalledWith(
          integration.id,
          expect.objectContaining({
            status: 'error',
            statusReason: 'auth_failed',
          }),
        );
        expect(integration.status).toBe('error');
        expect(integration.statusReason).toBe('auth_failed');
      },
    );

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

    it('surfaces OAuth-shape error/error_description fields (Cafe24 token endpoint format)', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          {
            error: 'invalid_token',
            error_description: 'Access token has expired',
          },
          { status: 401 },
        ),
      );

      const integration = makeIntegration();
      const caught = await client
        .call(integration, { method: 'GET', path: 'orders' })
        .catch((err: unknown) => err);
      expect(caught).toBeInstanceOf(Cafe24AuthFailedError);
      const message = (caught as Error).message;
      expect(message).toContain('invalid_token');
      expect(message).toContain('Access token has expired');
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
    it('on 403 + INSUFFICIENT_SCOPE signal — flips statusReason to insufficient_scope', async () => {
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
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({
          status: 'error',
          statusReason: 'insufficient_scope',
        }),
      );
      expect(integration.statusReason).toBe('insufficient_scope');
    });

    it('on 401 — always auth_failed (insufficient_scope is 403-only)', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(
          { error_code: 'INSUFFICIENT_SCOPE', error_message: 'whatever' },
          { status: 401 },
        ),
      );
      const integration = makeIntegration();
      await expect(
        client.call(integration, { method: 'GET', path: 'products' }),
      ).rejects.toBeInstanceOf(Cafe24AuthFailedError);
      expect(repo.update).toHaveBeenCalledWith(
        integration.id,
        expect.objectContaining({ statusReason: 'auth_failed' }),
      );
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
  });
});

```

---

### 파일 2: backend/src/nodes/integration/cafe24/cafe24-api.client.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 97d02fb4fca4be15f05c37fb96a9697ea47c41e9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 15:09:49 2026 +0900

    fix(cafe24): wrap POST/PUT body in `request` envelope
    
    Cafe24 Admin API rejects flat bodies with
    `400 "Please enter the Request parameter."` Every write request must be
    shaped `{ shop_no?, request: { ...rest } }` with shop_no as the only
    field allowed at the top level alongside `request`.
    
    The wrapping is applied centrally inside `Cafe24ApiClient.executeWithRateLimit`
    right before JSON serialisation, so the node handler and the MCP tool
    provider keep passing the metadata-driven body as a flat map and the
    wire format stays a pure protocol concern of the client.
    
    Adds 4 new test cases on `cafe24-api.client.spec.ts` covering PUT
    with/without shop_no, POST, and the degenerate shop_no-only body.
    Existing `cafe24.handler.spec.ts` assertions remain valid because the
    handler→client contract is unchanged (flat body in).
    
    Plan + spec-update note under plan/in-progress for the planner to fold
    the wire-format rule into spec/conventions/cafe24-api-metadata.md.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/nodes/integration/cafe24/cafe24-api.client.ts b/backend/src/nodes/integration/cafe24/cafe24-api.client.ts
index 068772da..796a14a1 100644
--- a/backend/src/nodes/integration/cafe24/cafe24-api.client.ts
+++ b/backend/src/nodes/integration/cafe24/cafe24-api.client.ts
@@ -708,7 +708,7 @@ export class Cafe24ApiClient {
     let bodyString: string | undefined;
     if (opts.body !== undefined && opts.method !== 'GET') {
       headers['Content-Type'] = 'application/json';
-      bodyString = JSON.stringify(opts.body);
+      bodyString = JSON.stringify(wrapInCafe24Envelope(opts.body));
     }
 
     const controller = new AbortController();
@@ -847,6 +847,29 @@ function defaultSleep(ms: number): Promise<void> {
 // own DOM/Node `lib` declarations and is typed as `typeof fetch` cleanly.
 const defaultFetch: typeof fetch = fetch;
 
+/**
+ * Wrap a write-request body in Cafe24's `request` envelope.
+ *
+ * Cafe24 Admin API rejects flat bodies with `400 "Please enter the Request
+ * parameter."` — every POST/PUT must be shaped as
+ * `{ shop_no?, request: { ...rest } }` where `shop_no` is the only field
+ * allowed to live at the top level alongside `request`. Centralising the
+ * transform here keeps both the node handler and the MCP tool provider
+ * caller-side flat: they pass the metadata-driven body map as-is, and the
+ * wire format stays a pure protocol concern of this client.
+ *
+ * See https://developers.cafe24.com/docs/ko/api/admin/ — every "Request
+ * body" example wraps its payload under `request:`.
+ */
+function wrapInCafe24Envelope(
+  body: Record<string, unknown>,
+): Record<string, unknown> {
+  const { shop_no, ...rest } = body;
+  const envelope: Record<string, unknown> = { request: rest };
+  if (shop_no !== undefined) envelope.shop_no = shop_no;
+  return envelope;
+}
+
 /**
  * Coerce a query parameter value to a string without ever producing the
  * `[object Object]` default — Cafe24 only accepts scalar query params, so

```

#### 전체 파일 컨텍스트
```
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Integration } from '../../../modules/integrations/entities/integration.entity.js';
import {
  CAFE24_REFRESH_JOB,
  CAFE24_REFRESH_QUEUE,
  CAFE24_REFRESH_QUEUE_EVENTS,
  Cafe24RefreshJobData,
  REFRESH_JOB_WAIT_TIMEOUT_MS,
} from '../../../modules/integrations/cafe24-token-refresh.constants.js';
import { sanitizeLastErrorMessage } from '../../../modules/integrations/integration-oauth.service.js';

/**
 * Optional DI tokens for swapping the network / sleep primitives in tests.
 * Production never binds these — NestJS resolves them as `undefined` via
 * `@Optional()` and the constructor falls back to `defaultFetch` /
 * `defaultSleep`. Using a string token (not the constructor's TS `typeof
 * fetch` reflection) is what stops `UnknownDependenciesException` —
 * NestJS otherwise tries to look up a provider keyed on the bare
 * `Function` metadata.
 */
export const CAFE24_FETCH_IMPL = 'CAFE24_FETCH_IMPL';
export const CAFE24_SLEEP_IMPL = 'CAFE24_SLEEP_IMPL';

/**
 * Cafe24 Admin API client wrapper.
 *
 * Responsibilities (spec/4-nodes/4-integration/4-cafe24.md §4·§4.1):
 * - Build `https://{mall_id}.cafe24api.com/api/v2/admin/{path}` URLs from
 *   metadata-driven path templates.
 * - Inject `Authorization: Bearer {access_token}` and refresh the token
 *   in-place (atomic 4-field UPDATE) when it expires within 60s.
 * - Honour Cafe24 leaky-bucket rate limits — `X-Cafe24-Call-Remain` /
 *   `X-Cafe24-Time-Remain` driven backoff with up to 2 retries on 429.
 * - Serialise concurrent calls per Integration via an in-process mutex so
 *   the workflow node and the AI Agent MCP bridge can share the same
 *   rate-limit bucket without overdrive (single-pod scope — Cafe24's
 *   leaky bucket is per-app+per-mall so cross-pod serialization is not
 *   required for rate limits). Refresh operations, by contrast, MUST be
 *   serialized cluster-wide because Cafe24 invalidates the previous
 *   refresh_token on every rotation — see `refreshViaQueue` (BullMQ
 *   `jobId = integrationId` dedup, spec §9.6 resolution).
 * - Translate 401/403 into an atomic Integration.status transition to
 *   `error(auth_failed)` (spec §6.1).
 */

export type Cafe24Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface Cafe24CallOptions {
  method: Cafe24Method;
  /** Template path (e.g. `products/{product_no}`) with placeholders already substituted. */
  path: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  /** Per-call timeout. Defaults to 30s. */
  timeoutMs?: number;
}

export interface Cafe24CallResult {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  callUsage?: number;
  callRemain?: number;
  timeUsage?: number;
  timeRemain?: number;
  callLimit?: string;
  retries: number;
}

export class Cafe24RateLimitedError extends Error {
  readonly code = 'CAFE24_RATE_LIMITED';
  constructor(
    readonly retries: number,
    readonly lastRetryAfterSec: number,
    readonly mallId: string,
  ) {
    super(
      `Cafe24 leaky bucket exhausted after ${retries} retries (mall=${mallId})`,
    );
    this.name = 'Cafe24RateLimitedError';
  }
}

export class Cafe24AuthFailedError extends Error {
  readonly code = 'CAFE24_AUTH_FAILED';
  constructor(
    readonly status: 401 | 403,
    readonly mallId: string,
    readonly responseBody: unknown,
  ) {
    const summary = summarizeCafe24ErrorBody(responseBody);
    const suffix = summary ? ` — ${summary}` : '';
    super(
      `Cafe24 authentication failed (${status}) for mall ${mallId}${suffix}`,
    );
    this.name = 'Cafe24AuthFailedError';
  }
}

/**
 * Extract a compact, user-actionable summary from Cafe24's error body.
 * Cafe24 wraps errors in several shapes depending on which API/endpoint
 * surface — try each one in order. The summary surfaces on the
 * `Cafe24AuthFailedError.message` so the MCP error response carries the
 * real cause ("INVALID_TOKEN: Access token has expired") rather than a
 * generic "authentication failed (403)". Tokens never appear in Cafe24's
 * error bodies, so it's safe to forward.
 */
function summarizeCafe24ErrorBody(body: unknown): string {
  if (body === null || body === undefined) return '';
  if (typeof body === 'string') return body.slice(0, 200);
  if (typeof body !== 'object') return '';
  const b = body as Record<string, unknown>;
  const errorObj =
    typeof b.error === 'object' && b.error !== null
      ? (b.error as Record<string, unknown>)
      : null;
  const code =
    pickString(b.error_code) ||
    (errorObj && pickString(errorObj.code)) ||
    (typeof b.error === 'string' ? b.error : null);
  const message =
    pickString(b.error_message) ||
    (errorObj && pickString(errorObj.message)) ||
    pickString(b.error_description) ||
    pickString(b.message);
  if (code && message) return `${code}: ${message}`.slice(0, 200);
  if (code) return code.slice(0, 200);
  if (message) return message.slice(0, 200);
  // Fall back to a JSON snippet — last resort so we never silently drop
  // diagnostic info on an unfamiliar shape.
  try {
    return JSON.stringify(body).slice(0, 200);
  } catch {
    return '';
  }
}

function pickString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export class Cafe24TransportFailedError extends Error {
  readonly code = 'CAFE24_TRANSPORT_FAILED';
  constructor(readonly cause: unknown) {
    super(extractErrorMessage(cause));
    this.name = 'Cafe24TransportFailedError';
  }
}

export class Cafe24IncompleteCredentialsError extends Error {
  readonly code = 'INTEGRATION_INCOMPLETE';
  constructor(reason: string) {
    super(`Cafe24 credentials incomplete: ${reason}`);
    this.name = 'Cafe24IncompleteCredentialsError';
  }
}

interface Cafe24Credentials {
  mall_id?: string;
  app_type?: 'public' | 'private';
  client_id?: string;
  client_secret?: string;
  access_token?: string;
  refresh_token?: string;
  scopes?: string[];
  expires_at?: string;
  cafe24_operator_id?: string;
}

export const REFRESH_WINDOW_MS = 60_000;
const MAX_RATE_LIMIT_RETRIES = 2;

/**
 * Internal helper — a Promise chain keyed by Integration ID acts as a
 * mutex. Each `call()` chains its work onto the existing tail so only one
 * fetch per Integration is in-flight at a time within this process.
 */
const integrationLocks = new Map<string, Promise<unknown>>();

function withIntegrationLock<T>(
  integrationId: string,
  task: () => Promise<T>,
): Promise<T> {
  const prev = integrationLocks.get(integrationId) ?? Promise.resolve();
  const next = prev.then(task, task);
  const tracked = next.catch(() => undefined);
  integrationLocks.set(integrationId, tracked);
  // Best-effort cleanup once this work is the tail. Use the *tracked*
  // (catch-handled) promise as the chain root so finally never observes
  // an unhandled rejection, and explicitly swallow any error so the
  // cleanup chain itself stays non-throwing.
  tracked
    .finally(() => {
      if (integrationLocks.get(integrationId) === tracked) {
        integrationLocks.delete(integrationId);
      }
    })
    .catch(() => undefined);
  return next;
}

@Injectable()
export class Cafe24ApiClient {
  private readonly logger = new Logger(Cafe24ApiClient.name);
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private readonly refreshQueue: Queue<Cafe24RefreshJobData> | null;
  private readonly refreshQueueEvents: QueueEvents | null;

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    private readonly dataSource: DataSource,
    // `@Optional() @Inject(token)` keeps NestJS from trying to resolve
    // `typeof fetch` / `Function` as a real provider. Bare default-value
    // constructor params trip `UnknownDependenciesException` in the
    // production DI graph (TS default values are invisible to the
    // `design:paramtypes` reflection metadata). Tests construct the
    // client directly with positional arguments and bypass DI entirely.
    @Optional() @Inject(CAFE24_FETCH_IMPL) fetchImpl?: typeof fetch,
    @Optional()
    @Inject(CAFE24_SLEEP_IMPL)
    sleepImpl?: (ms: number) => Promise<void>,
    // BullMQ refresh queue — production binds via Cafe24Module so refresh
    // operations serialize cross-instance (spec §9.6 trade-off resolution).
    // Tests construct the client without the queue and fall through to the
    // legacy in-process refresh path; existing test fixtures need no
    // BullMQ stubbing.
    @Optional()
    @InjectQueue(CAFE24_REFRESH_QUEUE)
    refreshQueue?: Queue<Cafe24RefreshJobData>,
    @Optional()
    @Inject(CAFE24_REFRESH_QUEUE_EVENTS)
    refreshQueueEvents?: QueueEvents,
  ) {
    this.fetchImpl = fetchImpl ?? defaultFetch;
    this.sleepImpl = sleepImpl ?? defaultSleep;
    this.refreshQueue = refreshQueue ?? null;
    this.refreshQueueEvents = refreshQueueEvents ?? null;
  }

  async call(
    integration: Integration,
    opts: Cafe24CallOptions,
  ): Promise<Cafe24CallResult> {
    return withIntegrationLock(integration.id, async () => {
      const creds = (integration.credentials ?? {}) as Cafe24Credentials;
      this.assertCredentials(creds);

      // Refresh proactively if the token expires within the window.
      await this.ensureFreshToken(integration);

      // Re-read credentials after potential refresh.
      const accessToken =
        ((integration.credentials ?? {}) as Cafe24Credentials).access_token ??
        creds.access_token!;
      const mallId = creds.mall_id!;

      return this.executeWithRateLimit(
        integration,
        mallId,
        accessToken,
        opts,
        0,
      );
    });
  }

  private assertCredentials(creds: Cafe24Credentials): void {
    if (!creds.mall_id) {
      throw new Cafe24IncompleteCredentialsError('mall_id is missing');
    }
    if (!creds.access_token) {
      throw new Cafe24IncompleteCredentialsError('access_token is missing');
    }
    if (!creds.refresh_token) {
      throw new Cafe24IncompleteCredentialsError('refresh_token is missing');
    }
    if (creds.app_type === 'private') {
      if (!creds.client_id || !creds.client_secret) {
        throw new Cafe24IncompleteCredentialsError(
          'private app requires client_id and client_secret',
        );
      }
    }
  }

  /**
   * If the token is missing or within REFRESH_WINDOW_MS of expiry, exchange
   * the refresh_token and atomically update credentials + tokenExpiresAt.
   *
   * Source of truth for the expiry instant is `Integration.tokenExpiresAt`
   * (spec/2-navigation/4-integration.md §10.5 — the canonical column the
   * atomic refresh writes). The mirror at `credentials.expires_at` is kept
   * in sync by the refresh path and the OAuth callback path, but older
   * rows or non-cafe24 flows may have a NULL mirror — falling back to the
   * entity column ensures proactive refresh fires for those too. Without
   * this fallback, a freshly-connected integration whose initial callback
   * only set the column would silently skip refresh forever and surface
   * a 401 (`access_token time expired`) on the first call after Cafe24's
   * 2h TTL.
   *
   * **Cross-instance race protection:** when a BullMQ refresh queue is
   * bound (production), the actual refresh is delegated to the queue with
   * `jobId = integrationId` so two pods cannot fire `/oauth/token` with
   * the same old refresh_token simultaneously. The caller waits for the
   * worker to finish, then re-reads the integration row from the DB to
   * see the refreshed credentials. When no queue is bound (unit tests),
   * the legacy in-process refresh path runs — same correctness, single
   * pod.
   *
   * Returns silently on success; throws Cafe24AuthFailedError on refresh
   * failure (caller treats as `error(auth_failed)` state transition).
   */
  private async ensureFreshToken(integration: Integration): Promise<void> {
    const expiresAtMs = resolveTokenExpiry(integration);
    if (expiresAtMs === null) return;
    if (expiresAtMs - Date.now() > REFRESH_WINDOW_MS) return;

    if (this.refreshQueue && this.refreshQueueEvents) {
      await this.refreshViaQueue(integration, 'proactive');
      return;
    }
    await this.refreshAccessToken(integration);
  }

  /**
   * Cross-instance-safe refresh path.
   *
   * Enqueues a refresh job with `jobId = integration.id`. BullMQ rejects
   * duplicate jobIds while the existing job is in waiting/active state and
   * returns the existing job reference instead, so concurrent callers
   * (within the same pod or across pods) all wait on the same worker
   * execution. After the worker completes, we re-read the integration row
   * from the DB and mutate the caller's reference so the subsequent
   * `executeWithRateLimit` sees the refreshed bearer.
   *
   * If the worker called `markAuthFailed` (refresh_token invalid), the
   * fresh row carries `status='error'` — surface as Cafe24AuthFailedError
   * to keep call() error semantics consistent with the in-process path.
   */
  private async refreshViaQueue(
    integration: Integration,
    source: 'proactive' | 'background',
  ): Promise<void> {
    const queue = this.refreshQueue!;
    const events = this.refreshQueueEvents!;
    const job = await queue.add(
      CAFE24_REFRESH_JOB,
      { integrationId: integration.id, source },
      {
        // jobId dedup across the cluster — same id, same job reference.
        jobId: integration.id,
        // attempts:1 because refresh failures (invalid_grant) are terminal
        // — retrying replays the same 401 and just floods the alert path.
        attempts: 1,
        // Keep completed jobs briefly so concurrent `add()` from a slow
        // caller still resolves to a real job reference; the next refresh
        // round (≥1h later in normal use) will not collide.
        removeOnComplete: { age: 60 },
        removeOnFail: { age: 300 },
      },
    );

    try {
      await job.waitUntilFinished(events, REFRESH_JOB_WAIT_TIMEOUT_MS);
    } catch (err) {
      // waitUntilFinished resolves on completion and rejects on failure or
      // timeout. **Critical race**: in a multi-pod cluster the worker can
      // complete the refresh on Pod B while Pod A's `waitUntilFinished` is
      // still pending — if QueueEvents misses the `completed` event (Redis
      // hiccup, brief network blip) Pod A times out **even though the
      // refresh was successful and the DB row carries a fresh token**.
      //
      // Re-fetch the integration and consult the DB state directly:
      // 1. `status='error', statusReason='auth_failed'` — worker called
      //    markAuthFailed (refresh_token invalid). Surface canonical error.
      // 2. `tokenExpiresAt > now + REFRESH_WINDOW_MS` — token IS fresh,
      //    worker succeeded but the event was lost. Treat as success,
      //    fall through to caller mutation below.
      // 3. Otherwise — genuine transport failure. Throw.
      //
      // Without this fall-through, the caller's stale `integration`
      // reference is used in any retry → old access_token → 401 →
      // `markAuthFailed` → the integration the worker just refreshed
      // gets demoted to `error(auth_failed)` (CONC-1).
      const fresh = await this.integrationRepository.findOne({
        where: { id: integration.id },
      });
      if (fresh?.status === 'error' && fresh.statusReason === 'auth_failed') {
        const mallId =
          (fresh.credentials as Cafe24Credentials | undefined)?.mall_id ??
          integration.id;
        throw new Cafe24AuthFailedError(401, mallId, fresh.lastError);
      }
      const freshExpiry = fresh ? resolveTokenExpiry(fresh) : null;
      if (
        !fresh ||
        fresh.status !== 'connected' ||
        freshExpiry === null ||
        freshExpiry - Date.now() <= REFRESH_WINDOW_MS
      ) {
        throw new Cafe24TransportFailedError(err);
      }
      // Worker actually succeeded — the timeout was spurious. Log a
      // debug breadcrumb and fall through (the post-try block below will
      // re-fetch and mutate the caller).
      this.logger.debug(
        `Cafe24 refresh worker succeeded for ${integration.id} but waitUntilFinished timed out — recovered via DB re-read`,
      );
    }

    // Worker succeeded (either via QueueEvents or via the fall-through
    // above). Re-fetch from DB and mutate the caller's reference so the
    // next stage of call() sees the refreshed bearer.
    const fresh = await this.integrationRepository.findOne({
      where: { id: integration.id },
    });
    if (!fresh) {
      throw new Cafe24TransportFailedError(
        new Error('Integration vanished during refresh'),
      );
    }
    integration.credentials = fresh.credentials;
    integration.tokenExpiresAt = fresh.tokenExpiresAt;
    integration.status = fresh.status;
    integration.statusReason = fresh.statusReason;
    integration.lastError = fresh.lastError;
  }

  async refreshAccessToken(integration: Integration): Promise<void> {
    const creds = (integration.credentials ?? {}) as Cafe24Credentials;
    if (!creds.mall_id || !creds.refresh_token) {
      throw new Cafe24IncompleteCredentialsError(
        'mall_id and refresh_token are required for refresh',
      );
    }

    const { clientId, clientSecret } = this.resolveClientCredentials(creds);
    const tokenUrl = `https://${creds.mall_id}.cafe24api.com/api/v2/oauth/token`;
    const form = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refresh_token,
    });

    let response: Response;
    try {
      response = await this.fetchImpl(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(
            `${clientId}:${clientSecret}`,
          ).toString('base64')}`,
        },
        body: form.toString(),
      });
    } catch (err) {
      // REQ-C2: refresh 자체의 transport 실패도 connected 의 연속 실패에
      // 포함시킨다. spec §6 의 카운터는 "노드 실행 중 커넥션 실패" 를
      // 정의하는데, refresh 는 노드 실행의 사전 단계이므로 동일 카운터에
      // 합산하는 것이 일관적.
      await this.recordNetworkFailure(integration, err);
      throw new Cafe24TransportFailedError(err);
    }

    if (response.status === 401 || response.status === 403) {
      const body = await safeReadJson(response);
      // SEC-C2: Cafe24 가 응답에 client_secret 의 일부나 token 조각을
      // echo 하는 비정상 케이스 (운영 보고 2026-05-16) 를 대비해 운영
      // 로그에 그대로 평문 기록하지 않는다. `sanitizeLastErrorMessage`
      // 의 패턴이 적용되어 `client_secret=...`, `Bearer ...`,
      // `Authorization: ...` 등은 `***` 로 마스킹.
      const bodyForLog = sanitizeLastErrorMessage(
        typeof body === 'string'
          ? body.slice(0, 500)
          : JSON.stringify(body).slice(0, 500),
      );
      this.logger.warn(
        `Cafe24 token refresh ${response.status} mall=${creds.mall_id}: ${bodyForLog}`,
      );
      await this.markAuthFailed(integration);
      throw new Cafe24AuthFailedError(response.status, creds.mall_id, body);
    }
    if (!response.ok) {
      const body = await safeReadJson(response);
      // SEC-C2: 옛 코드는 raw body 를 그대로 Error message 에 넣어 throw
      // 했고, 이 message 가 `markIntegrationCallbackError` 의 lastError 에
      // 잔류하는 경로가 있었다. 직접 sanitize 후 message 에 포함.
      throw new Error(
        `Cafe24 token refresh failed (${response.status}): ${sanitizeLastErrorMessage(JSON.stringify(body))}`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const accessToken = readString(data, 'access_token');
    const refreshToken = readString(data, 'refresh_token');
    const expiresIn = readNumber(data, 'expires_in');
    if (!accessToken) {
      throw new Error('Cafe24 token refresh response missing access_token');
    }
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : new Date(Date.now() + 2 * 60 * 60 * 1000); // Cafe24 default 2h

    // Atomic 4-field UPDATE — spec §10.5. credentials + tokenExpiresAt are
    // co-located on the Integration row so a single save() is atomic.
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Integration);
      const fresh = await repo.findOne({ where: { id: integration.id } });
      if (!fresh) throw new Error('Integration vanished during refresh');
      const updatedCreds: Cafe24Credentials = {
        ...((fresh.credentials ?? {}) as Cafe24Credentials),
        access_token: accessToken,
        refresh_token:
          refreshToken ??
          (fresh.credentials as Cafe24Credentials)?.refresh_token,
        expires_at: expiresAt.toISOString(),
      };
      fresh.credentials = updatedCreds as unknown as Record<string, unknown>;
      fresh.tokenExpiresAt = expiresAt;
      fresh.status = 'connected';
      fresh.statusReason = null;
      fresh.lastRotatedAt = new Date();
      await repo.save(fresh);
      // Mutate the live entity passed in so subsequent code in this call
      // chain sees the refreshed token.
      integration.credentials = updatedCreds as unknown as Record<
        string,
        unknown
      >;
      integration.tokenExpiresAt = expiresAt;
      integration.status = 'connected';
      integration.statusReason = null;
    });
  }

  private resolveClientCredentials(creds: Cafe24Credentials): {
    clientId: string;
    clientSecret: string;
  } {
    if (creds.app_type === 'private') {
      if (!creds.client_id || !creds.client_secret) {
        throw new Cafe24IncompleteCredentialsError(
          'private app client_id/secret missing',
        );
      }
      return { clientId: creds.client_id, clientSecret: creds.client_secret };
    }
    const id = process.env.CAFE24_CLIENT_ID;
    const secret = process.env.CAFE24_CLIENT_SECRET;
    if (!id || !secret) {
      throw new Cafe24IncompleteCredentialsError(
        'CAFE24_CLIENT_ID / CAFE24_CLIENT_SECRET env missing for public app',
      );
    }
    return { clientId: id, clientSecret: secret };
  }

  private async markAuthFailed(
    integration: Integration,
    reason: 'auth_failed' | 'insufficient_scope' = 'auth_failed',
  ): Promise<void> {
    try {
      await this.integrationRepository.update(integration.id, {
        status: 'error',
        statusReason: reason,
        lastError: {
          code: 'CAFE24_AUTH_FAILED',
          message:
            reason === 'insufficient_scope'
              ? 'Cafe24 returned 403 (insufficient scope)'
              : 'Cafe24 returned 401/403',
          at: new Date().toISOString(),
        },
      });
      integration.status = 'error';
      integration.statusReason = reason;
    } catch (err) {
      this.logger.warn(
        `Failed to mark Integration ${integration.id} as ${reason}: ${extractErrorMessage(err)}`,
      );
    }
  }

  /**
   * REQ-C3 — spec §6 의 `connected → error(insufficient_scope) | 403 +
   * 서비스별 missing_scope 시그널` 전이. Cafe24 가 403 응답 body 의
   * `error_code` / `error.code` / `error_message` 에 다음 시그널을 echo
   * 하는 경우 insufficient_scope 로 분기.
   *
   * 우리가 토큰 발급 단계에서 부여받지 못한 scope 를 사용하는 노드를
   * 호출하면 Cafe24 가 `403 INSUFFICIENT_SCOPE` 또는 유사 메시지를
   * 반환. 이때 사용자가 reauthorize 만 시도하면 같은 401/403 반복.
   * Spec 은 별도 statusReason 으로 UI 가 "권한 부족" 안내를 띄울 수
   * 있게 한다.
   */
  private detectInsufficientScope(errBody: unknown): boolean {
    if (errBody === null || errBody === undefined) return false;
    if (typeof errBody === 'string') {
      return /\binsufficient[_ ]?scope\b|\bmissing[_ ]?scope\b|\bINVALID[_ ]?SCOPE\b/i.test(
        errBody,
      );
    }
    if (typeof errBody !== 'object') return false;
    const b = errBody as Record<string, unknown>;
    const candidates: unknown[] = [
      b.error_code,
      b.error_message,
      b.error_description,
      b.message,
    ];
    if (typeof b.error === 'object' && b.error !== null) {
      const e = b.error as Record<string, unknown>;
      candidates.push(e.code, e.message, e.description);
    } else if (typeof b.error === 'string') {
      candidates.push(b.error);
    }
    for (const c of candidates) {
      if (typeof c !== 'string') continue;
      if (
        /\binsufficient[_ ]?scope\b|\bmissing[_ ]?scope\b|\bINVALID[_ ]?SCOPE\b/i.test(
          c,
        )
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * REQ-C2 — spec §6 의 `connected → error(network) | 3회 연속 실패` 전이.
   * fetch 가 transport 레벨에서 실패할 때 카운터를 +1 한다. 3 도달 시점에
   * status 를 `error(network)` 로 전이하고 카운터를 리셋. 카운터 리셋은
   * `resetNetworkFailures` 가 담당하며 다음 정상 응답 시 호출된다.
   */
  private async recordNetworkFailure(
    integration: Integration,
    cause: unknown,
  ): Promise<void> {
    try {
      const next = (integration.consecutiveNetworkFailures ?? 0) + 1;
      if (next >= 3) {
        await this.integrationRepository.update(integration.id, {
          status: 'error',
          statusReason: 'network',
          consecutiveNetworkFailures: 0,
          lastError: {
            code: 'CAFE24_TRANSPORT_FAILED',
            message: extractErrorMessage(cause).slice(0, 200),
            at: new Date().toISOString(),
          },
        });
        integration.status = 'error';
        integration.statusReason = 'network';
        integration.consecutiveNetworkFailures = 0;
        this.logger.warn(
          `Cafe24 integration ${integration.id} demoted to error(network) — 3 consecutive transport failures (spec §6)`,
        );
      } else {
        await this.integrationRepository.update(integration.id, {
          consecutiveNetworkFailures: next,
        });
        integration.consecutiveNetworkFailures = next;
      }
    } catch (err) {
      this.logger.warn(
        `Failed to record network failure for ${integration.id}: ${extractErrorMessage(err)}`,
      );
    }
  }

  private async resetNetworkFailures(integration: Integration): Promise<void> {
    if ((integration.consecutiveNetworkFailures ?? 0) === 0) return;
    try {
      await this.integrationRepository.update(integration.id, {
        consecutiveNetworkFailures: 0,
      });
      integration.consecutiveNetworkFailures = 0;
    } catch (err) {
      this.logger.warn(
        `Failed to reset network failures counter for ${integration.id}: ${extractErrorMessage(err)}`,
      );
    }
  }

  private async executeWithRateLimit(
    integration: Integration,
    mallId: string,
    accessToken: string,
    opts: Cafe24CallOptions,
    attempt: number,
  ): Promise<Cafe24CallResult> {
    const url = this.buildUrl(mallId, opts.path, opts.query);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    let bodyString: string | undefined;
    if (opts.body !== undefined && opts.method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      bodyString = JSON.stringify(wrapInCafe24Envelope(opts.body));
    }

    const controller = new AbortController();
    const timeoutMs = opts.timeoutMs ?? 30_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: opts.method,
        headers,
        body: bodyString,
        signal: controller.signal,
      });
    } catch (err) {
      // REQ-C2: 연속 transport 실패 카운터 +1. 3 도달 시 markStatus
      // `error(network)` 로 전이 (spec §6). recordNetworkFailure 내부에서
      // 실패하더라도 본 throw 는 그대로 진행 — caller 가 transport 오류로
      // 처리. 카운터 갱신 실패는 best-effort.
      await this.recordNetworkFailure(integration, err);
      throw new Cafe24TransportFailedError(err);
    } finally {
      clearTimeout(timer);
    }

    const respHeaders = readHeaderMap(response.headers);
    const callMeta = parseRateLimitHeaders(respHeaders);

    // REQ-C2: HTTP 응답이 정상적으로 돌아왔다 = transport 레벨은 성공.
    // 다음 단계의 status 분기와 무관하게 카운터 리셋. 401/403 인 경우는
    // markAuthFailed 가 별도로 status='error(auth_failed)' 로 전이하므로
    // 카운터 리셋은 무해 (그 행은 이미 connected 가 아님).
    await this.resetNetworkFailures(integration);

    // Rate-limited — retry per spec policy with random jitter so multiple
    // concurrent callers sharing the same Integration don't all wake up
    // at the same instant and hammer the server in lockstep (thundering
    // herd → another 429 → another batched retry).
    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const baseSec = Math.max(
        callMeta.callRemain ?? 0,
        callMeta.timeRemain ?? 0,
        1,
      );
      const jitterMs = Math.floor(Math.random() * 500);
      const sleepMs = baseSec * 1000 + jitterMs;
      this.logger.debug(
        `Cafe24 429 (attempt ${attempt + 1}) — sleeping ${baseSec}s (+${jitterMs}ms jitter) for mall=${mallId}`,
      );
      await this.sleepImpl(sleepMs);
      return this.executeWithRateLimit(
        integration,
        mallId,
        accessToken,
        opts,
        attempt + 1,
      );
    }
    if (response.status === 429) {
      throw new Cafe24RateLimitedError(
        attempt,
        Math.max(callMeta.callRemain ?? 0, callMeta.timeRemain ?? 0, 0),
        mallId,
      );
    }

    if (response.status === 401 || response.status === 403) {
      const errBody = await safeReadJson(response);
      // Server-side diagnostic — Cafe24's error code/description rarely
      // contains sensitive info (it never echoes tokens), and without this
      // log there is no way to tell APP_NOT_INSTALLED from EXPIRED_TOKEN
      // from INSUFFICIENT_SCOPE — every cause surfaces to the user as
      // "auth failed (403)". Trimmed to 500 chars so an unexpectedly large
      // body cannot blow up the log line. SEC-C2: 보호 차원으로
      // `sanitizeLastErrorMessage` 적용 — Cafe24 가 echo 하는 비정상
      // 시크릿 조각을 운영 로그에 평문 기록하지 않는다.
      const bodyForLog = sanitizeLastErrorMessage(
        typeof errBody === 'string'
          ? errBody.slice(0, 500)
          : JSON.stringify(errBody).slice(0, 500),
      );
      this.logger.warn(
        `Cafe24 API ${response.status} mall=${mallId} ${opts.method} ${opts.path}: ${bodyForLog}`,
      );
      // REQ-C3: 403 + scope 시그널 시 status_reason='insufficient_scope'
      // 로 분기. 401 은 항상 auth_failed (토큰 자체 문제).
      const reason: 'auth_failed' | 'insufficient_scope' =
        response.status === 403 && this.detectInsufficientScope(errBody)
          ? 'insufficient_scope'
          : 'auth_failed';
      await this.markAuthFailed(integration, reason);
      throw new Cafe24AuthFailedError(response.status, mallId, errBody);
    }

    const body = await safeReadJson(response);

    return {
      status: response.status,
      body,
      headers: respHeaders,
      ...callMeta,
      retries: attempt,
    };
  }

  private buildUrl(
    mallId: string,
    path: string,
    query?: Record<string, unknown>,
  ): string {
    const cleanPath = path.replace(/^\//, '');
    const url = new URL(
      `https://${mallId}.cafe24api.com/api/v2/admin/${cleanPath}`,
    );
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.append(k, stringifyQueryValue(v));
      }
    }
    return url.toString();
  }
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function defaultSleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// Direct alias of the global `fetch`. `globalThis.fetch` is typed as
// `any` in our @types setup, so going through it triggers unsafe-argument
// lint warnings; the bare `fetch` identifier resolves through TypeScript's
// own DOM/Node `lib` declarations and is typed as `typeof fetch` cleanly.
const defaultFetch: typeof fetch = fetch;

/**
 * Wrap a write-request body in Cafe24's `request` envelope.
 *
 * Cafe24 Admin API rejects flat bodies with `400 "Please enter the Request
 * parameter."` — every POST/PUT must be shaped as
 * `{ shop_no?, request: { ...rest } }` where `shop_no` is the only field
 * allowed to live at the top level alongside `request`. Centralising the
 * transform here keeps both the node handler and the MCP tool provider
 * caller-side flat: they pass the metadata-driven body map as-is, and the
 * wire format stays a pure protocol concern of this client.
 *
 * See https://developers.cafe24.com/docs/ko/api/admin/ — every "Request
 * body" example wraps its payload under `request:`.
 */
function wrapInCafe24Envelope(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const { shop_no, ...rest } = body;
  const envelope: Record<string, unknown> = { request: rest };
  if (shop_no !== undefined) envelope.shop_no = shop_no;
  return envelope;
}

/**
 * Coerce a query parameter value to a string without ever producing the
 * `[object Object]` default — Cafe24 only accepts scalar query params, so
 * non-scalars are JSON-serialised explicitly.
 */
function stringifyQueryValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  return JSON.stringify(value);
}

function readHeaderMap(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

function parseRateLimitHeaders(h: Record<string, string>): {
  callUsage?: number;
  callRemain?: number;
  timeUsage?: number;
  timeRemain?: number;
  callLimit?: string;
} {
  const out: ReturnType<typeof parseRateLimitHeaders> = {};
  const num = (key: string): number | undefined => {
    const v = h[key];
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  out.callUsage = num('x-cafe24-call-usage');
  out.callRemain = num('x-cafe24-call-remain');
  out.timeUsage = num('x-cafe24-time-usage');
  out.timeRemain = num('x-cafe24-time-remain');
  if (h['x-api-call-limit']) out.callLimit = h['x-api-call-limit'];
  return out;
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

/**
 * Resolve the access-token expiry instant from an Integration row.
 *
 * Precedence: `Integration.tokenExpiresAt` (spec §10.5 canonical column) →
 * `credentials.expires_at` (JSONB mirror). Returns null when neither is set
 * or both parse as invalid. The entity column wins when both are present
 * because the atomic 4-field UPDATE in `refreshAccessToken` writes the
 * column last and the OAuth callback path historically only wrote the
 * column — trusting the column avoids a stale-mirror trap.
 *
 * Exported because the BullMQ refresh worker re-evaluates expiry on job
 * pickup (race protection: a refresh that completed milliseconds before
 * the worker started should short-circuit).
 */
export function resolveTokenExpiry(integration: {
  tokenExpiresAt?: Date | null;
  credentials?: Record<string, unknown> | null;
}): number | null {
  const col = integration.tokenExpiresAt;
  if (col instanceof Date && Number.isFinite(col.getTime())) {
    return col.getTime();
  }
  if (typeof col === 'string' && col) {
    const parsed = Date.parse(col);
    if (Number.isFinite(parsed)) return parsed;
  }
  const creds = (integration.credentials ?? {}) as Cafe24Credentials;
  if (creds.expires_at) {
    const parsed = Date.parse(creds.expires_at);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readNumber(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Test seam — clears the in-process mutex map. Production code should
 * never call this; tests reset state between cases. */
export function __resetCafe24LocksForTesting(): void {
  integrationLocks.clear();
}

```

---

### 파일 3: plan/in-progress/cafe24-request-envelope-fix.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 97d02fb4fca4be15f05c37fb96a9697ea47c41e9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 15:09:49 2026 +0900

    fix(cafe24): wrap POST/PUT body in `request` envelope
    
    Cafe24 Admin API rejects flat bodies with
    `400 "Please enter the Request parameter."` Every write request must be
    shaped `{ shop_no?, request: { ...rest } }` with shop_no as the only
    field allowed at the top level alongside `request`.
    
    The wrapping is applied centrally inside `Cafe24ApiClient.executeWithRateLimit`
    right before JSON serialisation, so the node handler and the MCP tool
    provider keep passing the metadata-driven body as a flat map and the
    wire format stays a pure protocol concern of the client.
    
    Adds 4 new test cases on `cafe24-api.client.spec.ts` covering PUT
    with/without shop_no, POST, and the degenerate shop_no-only body.
    Existing `cafe24.handler.spec.ts` assertions remain valid because the
    handler→client contract is unchanged (flat body in).
    
    Plan + spec-update note under plan/in-progress for the planner to fold
    the wire-format rule into spec/conventions/cafe24-api-metadata.md.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/plan/in-progress/cafe24-request-envelope-fix.md b/plan/in-progress/cafe24-request-envelope-fix.md
new file mode 100644
index 00000000..979f3b43
--- /dev/null
+++ b/plan/in-progress/cafe24-request-envelope-fix.md
@@ -0,0 +1,42 @@
+---
+worktree: cafe24-request-envelope-fix-a1b2c3
+started: 2026-05-16
+owner: developer
+---
+
+# Cafe24 PUT/POST `request` envelope 누락 버그 수정
+
+## 배경
+
+운영 로그에서 `mcp_b74e1adc__product_update` 호출이 다음 응답으로 실패:
+
+```json
+{ "status": 400, "response": { "error": { "code": 400, "message": "Please enter the Request parameter." } } }
+```
+
+원인: Cafe24 Admin API 의 모든 쓰기(POST/PUT) endpoint 는 본문을 `{ "shop_no": <n>, "request": { ... } }` 형태로 envelope wrapping 해야 하는데, 현재 `Cafe24Handler.buildRequestParts` (backend/src/nodes/integration/cafe24/cafe24.handler.ts:264-315) 는 `location: 'body'` 인 필드 전부를 한 객체에 flat 하게 합쳐서 전송한다. Cafe24 가 `request` 키를 찾지 못해 400.
+
+영향: `product_*`, `customer_*`, `category_*`, `mileage_grant`, `product_variants_inventory_update`, board 댓글 작성 등 **모든 PUT/POST 쓰기 operation**.
+
+DELETE 는 path-only (body 없음) 라 envelope 영향 없음.
+
+## 계획
+
+> **레이어 선택**: handler/provider 가 아닌 `Cafe24ApiClient` 안에서 envelope 을 적용한다.
+> - envelope 은 Cafe24 wire format 의 고유 규약이지 노드/MCP 의 관심사가 아니다 (client 가 이미 URL prefix·leaky bucket·token refresh 같은 Cafe24 고유 책임을 갖는다).
+> - `Cafe24Handler.buildRequestParts` (cafe24.handler.ts:264-315) 와 `Cafe24McpToolProvider.execute` (cafe24-mcp-tool-provider.ts:281-310) 두 곳이 같은 splitting 로직을 중복 보유 — 단일 fix 지점이 drift 를 막는다.
+
+1. **테스트 선작성**
+   - `cafe24-api.client.spec.ts` — fetchImpl mock 의 호출 인자 `body` 가 JSON-deserialize 했을 때 `{ shop_no?, request: {...rest} }` 형태인지 단언. PUT, POST, body 가 없는 DELETE 각각.
+   - `cafe24.handler.spec.ts` — 기존 `'PUT — body fields routed to body, path fields to URL'` 테스트는 client 까지의 인터페이스가 그대로 (flat body 전달) 라 변경 없음. 다만 통합 단언 한 케이스("client 가 받은 body 가 envelope 된 형태로 wire 에 나가는지") 는 client spec 책임.
+2. **구현** — `Cafe24ApiClient.executeWithRateLimit` 의 body JSON.stringify 직전에 helper `wrapInCafe24Envelope(body)` 호출:
+   - `shop_no` 는 top-level 에 유지
+   - 그 외 필드는 `request: { ... }` 안으로
+3. **handler / provider 변경 없음** — flat body 를 그대로 전달.
+4. **spec 갱신 노트** — `spec/conventions/cafe24-api-metadata.md` 에 envelope 규약 명시 + `spec/4-nodes/4-integration/4-cafe24.md` §4.1 wrapper 책임에 envelope wrapping 추가. 권한 밖이라 `plan/in-progress/spec-update-cafe24-request-envelope.md` 에 제안 노트만 남기고 `project-planner` 위임.
+
+## 점검 사항
+
+- `cafe24-api.client.ts` 의 `executeWithRateLimit` 만 envelope 적용. handler / provider 는 flat body 유지.
+- `Cafe24ApiClient.call` 의 외부 시그니처(`Cafe24CallOptions.body: Record<string, unknown>`) 는 그대로 — flat 객체 그대로 받음.
+- 동일 envelope 이 token refresh 의 `POST /oauth/token` 에도 적용되면 OAuth 실패 가능성. **token refresh 는 form-urlencoded 라 envelope 무관** (이미 별도 fetch 경로).

```

#### 전체 파일 컨텍스트
```
---
worktree: cafe24-request-envelope-fix-a1b2c3
started: 2026-05-16
owner: developer
---

# Cafe24 PUT/POST `request` envelope 누락 버그 수정

## 배경

운영 로그에서 `mcp_b74e1adc__product_update` 호출이 다음 응답으로 실패:

```json
{ "status": 400, "response": { "error": { "code": 400, "message": "Please enter the Request parameter." } } }
```

원인: Cafe24 Admin API 의 모든 쓰기(POST/PUT) endpoint 는 본문을 `{ "shop_no": <n>, "request": { ... } }` 형태로 envelope wrapping 해야 하는데, 현재 `Cafe24Handler.buildRequestParts` (backend/src/nodes/integration/cafe24/cafe24.handler.ts:264-315) 는 `location: 'body'` 인 필드 전부를 한 객체에 flat 하게 합쳐서 전송한다. Cafe24 가 `request` 키를 찾지 못해 400.

영향: `product_*`, `customer_*`, `category_*`, `mileage_grant`, `product_variants_inventory_update`, board 댓글 작성 등 **모든 PUT/POST 쓰기 operation**.

DELETE 는 path-only (body 없음) 라 envelope 영향 없음.

## 계획

> **레이어 선택**: handler/provider 가 아닌 `Cafe24ApiClient` 안에서 envelope 을 적용한다.
> - envelope 은 Cafe24 wire format 의 고유 규약이지 노드/MCP 의 관심사가 아니다 (client 가 이미 URL prefix·leaky bucket·token refresh 같은 Cafe24 고유 책임을 갖는다).
> - `Cafe24Handler.buildRequestParts` (cafe24.handler.ts:264-315) 와 `Cafe24McpToolProvider.execute` (cafe24-mcp-tool-provider.ts:281-310) 두 곳이 같은 splitting 로직을 중복 보유 — 단일 fix 지점이 drift 를 막는다.

1. **테스트 선작성**
   - `cafe24-api.client.spec.ts` — fetchImpl mock 의 호출 인자 `body` 가 JSON-deserialize 했을 때 `{ shop_no?, request: {...rest} }` 형태인지 단언. PUT, POST, body 가 없는 DELETE 각각.
   - `cafe24.handler.spec.ts` — 기존 `'PUT — body fields routed to body, path fields to URL'` 테스트는 client 까지의 인터페이스가 그대로 (flat body 전달) 라 변경 없음. 다만 통합 단언 한 케이스("client 가 받은 body 가 envelope 된 형태로 wire 에 나가는지") 는 client spec 책임.
2. **구현** — `Cafe24ApiClient.executeWithRateLimit` 의 body JSON.stringify 직전에 helper `wrapInCafe24Envelope(body)` 호출:
   - `shop_no` 는 top-level 에 유지
   - 그 외 필드는 `request: { ... }` 안으로
3. **handler / provider 변경 없음** — flat body 를 그대로 전달.
4. **spec 갱신 노트** — `spec/conventions/cafe24-api-metadata.md` 에 envelope 규약 명시 + `spec/4-nodes/4-integration/4-cafe24.md` §4.1 wrapper 책임에 envelope wrapping 추가. 권한 밖이라 `plan/in-progress/spec-update-cafe24-request-envelope.md` 에 제안 노트만 남기고 `project-planner` 위임.

## 점검 사항

- `cafe24-api.client.ts` 의 `executeWithRateLimit` 만 envelope 적용. handler / provider 는 flat body 유지.
- `Cafe24ApiClient.call` 의 외부 시그니처(`Cafe24CallOptions.body: Record<string, unknown>`) 는 그대로 — flat 객체 그대로 받음.
- 동일 envelope 이 token refresh 의 `POST /oauth/token` 에도 적용되면 OAuth 실패 가능성. **token refresh 는 form-urlencoded 라 envelope 무관** (이미 별도 fetch 경로).

```

---

### 파일 4: plan/in-progress/spec-update-cafe24-request-envelope.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 97d02fb4fca4be15f05c37fb96a9697ea47c41e9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 15:09:49 2026 +0900

    fix(cafe24): wrap POST/PUT body in `request` envelope
    
    Cafe24 Admin API rejects flat bodies with
    `400 "Please enter the Request parameter."` Every write request must be
    shaped `{ shop_no?, request: { ...rest } }` with shop_no as the only
    field allowed at the top level alongside `request`.
    
    The wrapping is applied centrally inside `Cafe24ApiClient.executeWithRateLimit`
    right before JSON serialisation, so the node handler and the MCP tool
    provider keep passing the metadata-driven body as a flat map and the
    wire format stays a pure protocol concern of the client.
    
    Adds 4 new test cases on `cafe24-api.client.spec.ts` covering PUT
    with/without shop_no, POST, and the degenerate shop_no-only body.
    Existing `cafe24.handler.spec.ts` assertions remain valid because the
    handler→client contract is unchanged (flat body in).
    
    Plan + spec-update note under plan/in-progress for the planner to fold
    the wire-format rule into spec/conventions/cafe24-api-metadata.md.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/plan/in-progress/spec-update-cafe24-request-envelope.md b/plan/in-progress/spec-update-cafe24-request-envelope.md
new file mode 100644
index 00000000..0ee87ea3
--- /dev/null
+++ b/plan/in-progress/spec-update-cafe24-request-envelope.md
@@ -0,0 +1,69 @@
+---
+worktree: cafe24-request-envelope-fix-a1b2c3
+started: 2026-05-16
+owner: developer (→ project-planner 위임 필요)
+---
+
+# spec-update: Cafe24 `request` envelope 규약 문서화
+
+## 배경
+
+운영에서 `mcp_b74e1adc__product_update` 호출이 Cafe24 의 `400 "Please enter the Request parameter."` 로 실패. 원인은 Cafe24 Admin API 의 POST/PUT 본문이 반드시 다음 형태의 envelope 을 요구하는데, 현재 spec 어디에도 이 규약이 명시되어 있지 않아 신규 endpoint metadata 를 추가할 때마다 동일 함정에 빠질 수 있다는 점.
+
+```json
+{
+  "shop_no": 1,
+  "request": { ... }
+}
+```
+
+코드 fix 는 `claude/cafe24-request-envelope-fix-a1b2c3` 브랜치에서 `Cafe24ApiClient` 한 곳에 적용 완료 (handler/provider 는 flat body 그대로 전달 — wire format 변환은 client 의 책임). 본 문서는 spec 갱신 제안만 정리한다 (`spec/` 쓰기 권한은 project-planner).
+
+## 갱신 제안
+
+### 1. `spec/conventions/cafe24-api-metadata.md`
+
+§2 "Operation 메타데이터 형식" 또는 §3 "예시" 뒤에 새 절을 추가:
+
+> ## N. Wire-format 규약 — POST/PUT envelope
+>
+> Cafe24 Admin API 의 POST/PUT 본문은 반드시 다음 형태로 직렬화된다:
+>
+> ```json
+> { "shop_no": <n>, "request": { ...payload } }
+> ```
+>
+> - `shop_no` 만 top-level 에 두고, 나머지 모든 필드는 `request` 안으로 wrap.
+> - envelope 변환은 `Cafe24ApiClient` 가 일괄 처리 — metadata 의 `location: 'body'` 필드는 caller 가 flat 한 객체로 넘기면 client 가 자동으로 wrap.
+> - `shop_no` 가 body 에 없으면 `{ "request": { ... } }` 만 전송.
+> - body 에 `shop_no` 만 있고 다른 필드가 없는 (degenerate) 케이스도 `{ "shop_no": <n>, "request": {} }` 로 보내 Cafe24 의 파서가 `request` 키 부재로 400 을 내지 않도록 한다.
+>
+> 본 규약을 누락하면 Cafe24 가 `400 "Please enter the Request parameter."` 를 반환한다. 신규 metadata row 를 추가할 때는 `location: 'body'` 필드 분류만 신경 쓰면 되고, envelope 은 자동.
+
+### 2. `spec/4-nodes/4-integration/4-cafe24.md` §4.1 (Wrapper 책임)
+
+기존 wrapper 책임 bullet 목록(`Authorization` 부여, leaky bucket, 토큰 refresh, mutex 등) 에 다음 한 줄 추가:
+
+> - POST/PUT 본문을 Cafe24 `request` envelope 으로 자동 wrap (자세한 규약: `spec/conventions/cafe24-api-metadata.md`).
+
+### 3. (선택) Rationale 보강
+
+`spec/4-nodes/4-integration/4-cafe24.md` 끝의 `## Rationale` 절에 다음 결정 기록:
+
+> ### envelope wrapping 의 위치
+>
+> envelope 적용 지점 후보는 (a) handler/provider 의 body 구성 단계, (b) `Cafe24ApiClient` 의 wire 직렬화 단계 두 가지. (b) 채택 이유:
+>
+> - envelope 은 Cafe24 wire format 의 고유 규약이지 노드/MCP 의 관심사가 아니다 — client 가 이미 URL prefix·leaky bucket·token refresh 같은 Cafe24 고유 책임을 갖고 있어 SRP 정합.
+> - handler/provider 두 곳이 같은 splitting 로직을 중복 보유하므로 단일 지점 fix 가 drift 를 방지.
+> - 외부 시그니처(`Cafe24CallOptions.body: Record<string, unknown>`) 는 변경 없음 — caller 는 flat 객체로 넘기면 됨.
+
+## 변경 결과 확인
+
+- 코드: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 의 새 helper `wrapInCafe24Envelope` 와 `executeWithRateLimit` 의 호출부.
+- 테스트: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` 의 `'happy path'` describe 안 envelope 단언 4건.
+
+## 후속 처리
+
+- project-planner 가 본 노트를 검토 후 위 3 절에 해당하는 spec 본문 수정을 진행.
+- 본 plan 문서는 spec 수정 완료 시점에 `plan/complete/` 로 이동.

```

#### 전체 파일 컨텍스트
```
---
worktree: cafe24-request-envelope-fix-a1b2c3
started: 2026-05-16
owner: developer (→ project-planner 위임 필요)
---

# spec-update: Cafe24 `request` envelope 규약 문서화

## 배경

운영에서 `mcp_b74e1adc__product_update` 호출이 Cafe24 의 `400 "Please enter the Request parameter."` 로 실패. 원인은 Cafe24 Admin API 의 POST/PUT 본문이 반드시 다음 형태의 envelope 을 요구하는데, 현재 spec 어디에도 이 규약이 명시되어 있지 않아 신규 endpoint metadata 를 추가할 때마다 동일 함정에 빠질 수 있다는 점.

```json
{
  "shop_no": 1,
  "request": { ... }
}
```

코드 fix 는 `claude/cafe24-request-envelope-fix-a1b2c3` 브랜치에서 `Cafe24ApiClient` 한 곳에 적용 완료 (handler/provider 는 flat body 그대로 전달 — wire format 변환은 client 의 책임). 본 문서는 spec 갱신 제안만 정리한다 (`spec/` 쓰기 권한은 project-planner).

## 갱신 제안

### 1. `spec/conventions/cafe24-api-metadata.md`

§2 "Operation 메타데이터 형식" 또는 §3 "예시" 뒤에 새 절을 추가:

> ## N. Wire-format 규약 — POST/PUT envelope
>
> Cafe24 Admin API 의 POST/PUT 본문은 반드시 다음 형태로 직렬화된다:
>
> ```json
> { "shop_no": <n>, "request": { ...payload } }
> ```
>
> - `shop_no` 만 top-level 에 두고, 나머지 모든 필드는 `request` 안으로 wrap.
> - envelope 변환은 `Cafe24ApiClient` 가 일괄 처리 — metadata 의 `location: 'body'` 필드는 caller 가 flat 한 객체로 넘기면 client 가 자동으로 wrap.
> - `shop_no` 가 body 에 없으면 `{ "request": { ... } }` 만 전송.
> - body 에 `shop_no` 만 있고 다른 필드가 없는 (degenerate) 케이스도 `{ "shop_no": <n>, "request": {} }` 로 보내 Cafe24 의 파서가 `request` 키 부재로 400 을 내지 않도록 한다.
>
> 본 규약을 누락하면 Cafe24 가 `400 "Please enter the Request parameter."` 를 반환한다. 신규 metadata row 를 추가할 때는 `location: 'body'` 필드 분류만 신경 쓰면 되고, envelope 은 자동.

### 2. `spec/4-nodes/4-integration/4-cafe24.md` §4.1 (Wrapper 책임)

기존 wrapper 책임 bullet 목록(`Authorization` 부여, leaky bucket, 토큰 refresh, mutex 등) 에 다음 한 줄 추가:

> - POST/PUT 본문을 Cafe24 `request` envelope 으로 자동 wrap (자세한 규약: `spec/conventions/cafe24-api-metadata.md`).

### 3. (선택) Rationale 보강

`spec/4-nodes/4-integration/4-cafe24.md` 끝의 `## Rationale` 절에 다음 결정 기록:

> ### envelope wrapping 의 위치
>
> envelope 적용 지점 후보는 (a) handler/provider 의 body 구성 단계, (b) `Cafe24ApiClient` 의 wire 직렬화 단계 두 가지. (b) 채택 이유:
>
> - envelope 은 Cafe24 wire format 의 고유 규약이지 노드/MCP 의 관심사가 아니다 — client 가 이미 URL prefix·leaky bucket·token refresh 같은 Cafe24 고유 책임을 갖고 있어 SRP 정합.
> - handler/provider 두 곳이 같은 splitting 로직을 중복 보유하므로 단일 지점 fix 가 drift 를 방지.
> - 외부 시그니처(`Cafe24CallOptions.body: Record<string, unknown>`) 는 변경 없음 — caller 는 flat 객체로 넘기면 됨.

## 변경 결과 확인

- 코드: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 의 새 helper `wrapInCafe24Envelope` 와 `executeWithRateLimit` 의 호출부.
- 테스트: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` 의 `'happy path'` describe 안 envelope 단언 4건.

## 후속 처리

- project-planner 가 본 노트를 검토 후 위 3 절에 해당하는 spec 본문 수정을 진행.
- 본 plan 문서는 spec 수정 완료 시점에 `plan/complete/` 로 이동.

```
