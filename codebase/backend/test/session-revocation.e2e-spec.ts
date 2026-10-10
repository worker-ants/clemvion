import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import {
  TEST_PASSWORD,
  browserCookieFor,
  cookiePathMatches,
  extractRefreshBrowserCookie,
  type BrowserCookie,
} from './helpers/auth';
import {
  assertMatchesContract,
  contractForDto,
  type DtoContract,
} from '../src/shared/testing/response-contract';
import { SessionDto } from '../src/modules/auth/dto/responses/session.dto';
import { LoginHistoryPageDto } from '../src/modules/auth/dto/responses/login-history.dto';

/**
 * e2e: 사용자 세션(refresh token family) 라이프사이클을 실 인프라에서 검증.
 *
 * NERV CLE-ACCT-SESSION 「세션 목록과 강제 종료」. 본인 인증(비밀번호 또는 TOTP) 없이
 * revoke 불가, 단일 revoke 와 revoke-others 가 각각 family 단위로 refresh 토큰을
 * 무효화하는지 확인.
 *
 * **쿠키는 브라우저처럼 붙인다.** refresh cookie 는 `Path=/api/auth` 라서 브라우저는 그
 * 아래 경로에만 쿠키를 보낸다. 예전 테스트는 Cookie 헤더를 모든 요청에 손으로 붙여서
 * 세션 API 가 `/api/users/me/sessions` 에 있을 때 현재 세션 판별이 늘 실패하는 것을
 * 보지 못했다(CLE-T-ERAJ7P). 여기서는 `browserCookieFor` 로 Path 가 맞는 요청에만 붙인다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const SESSIONS = '/api/auth/sessions';

function browserGet(path: string, accessToken: string, cookie: BrowserCookie) {
  const req = request(BASE_URL)
    .get(path)
    .set('Authorization', `Bearer ${accessToken}`);
  const header = browserCookieFor(cookie, path);
  return header ? req.set('Cookie', header) : req;
}

function browserPost(
  path: string,
  accessToken: string,
  cookie: BrowserCookie,
  body: object,
) {
  const req = request(BASE_URL)
    .post(path)
    .set('Authorization', `Bearer ${accessToken}`);
  const header = browserCookieFor(cookie, path);
  return (header ? req.set('Cookie', header) : req).send(body);
}

function refreshAsBrowser(cookie: BrowserCookie) {
  const path = '/api/auth/refresh';
  const header = browserCookieFor(cookie, path);
  if (!header)
    throw new Error(`refresh cookie Path ${cookie.path} misses ${path}`);
  return request(BASE_URL).post(path).set('Cookie', header);
}

async function login(
  email: string,
  userAgent: string,
): Promise<{ cookie: BrowserCookie; accessToken: string }> {
  const res = await request(BASE_URL)
    .post('/api/auth/login')
    .set('User-Agent', userAgent)
    .send({ email, password: TEST_PASSWORD });
  expect(res.status).toBe(200);
  return {
    cookie: extractRefreshBrowserCookie(
      res.headers['set-cookie'] as unknown as string[],
    ),
    accessToken: (res.body.data as { accessToken: string }).accessToken,
  };
}

describe('cookiePathMatches (RFC 6265 §5.1.4)', () => {
  it.each([
    ['/api/auth', '/api/auth', true],
    ['/api/auth', '/api/auth/sessions', true],
    ['/api/auth', '/api/authx', false],
    ['/api/auth', '/api/users/me/sessions', false],
    ['/api/auth/', '/api/auth/refresh', true],
    ['/', '/api/users/me/sessions', true],
  ])('Path=%s, 요청 %s → %s', (cookiePath, requestPath, expected) => {
    expect(cookiePathMatches(cookiePath, requestPath)).toBe(expected);
  });
});

describe('Session revocation (e2e)', () => {
  let db: Client;

  let sessionContract: DtoContract;

  beforeAll(async () => {
    sessionContract = await contractForDto(SessionDto);
    db = createDbClient();
    await db.connect();
  }, 30_000);

  afterAll(async () => {
    await db.end();
  });

  async function familyOf(email: string, userAgent: string): Promise<string> {
    const { rows } = await db.query<{ family_id: string }>(
      `SELECT DISTINCT rt.family_id FROM refresh_token rt
         JOIN "user" u ON u.id = rt.user_id
        WHERE u.email = $1 AND rt.user_agent = $2`,
      [email, userAgent],
    );
    expect(rows).toHaveLength(1);
    return rows[0].family_id;
  }

  async function setupUser(prefix: string): Promise<{
    email: string;
    cookieA: BrowserCookie;
    cookieB: BrowserCookie;
    accessTokenA: string;
    familyA: string;
    familyB: string;
  }> {
    const email = uniqueEmail(prefix);
    await request(BASE_URL)
      .post('/api/auth/register')
      .send({
        name: 'Session User',
        email,
        password: TEST_PASSWORD,
        termsAccepted: true,
      })
      .expect(201);
    await db.query('UPDATE "user" SET email_verified = true WHERE email = $1', [
      email,
    ]);

    const a = await login(email, 'e2e-device-A/1.0');
    const b = await login(email, 'e2e-device-B/2.0');

    // 테스트가 브라우저와 같은 Path 를 전제하는지 고정한다. Path 가 넓어지면 아래
    // 단언들은 이 버그 없이도 통과하므로 여기서 먼저 멈춘다.
    expect(a.cookie.path).toBe('/api/auth');
    expect(a.cookie.pair).not.toBe(b.cookie.pair);
    return {
      email,
      cookieA: a.cookie,
      cookieB: b.cookie,
      accessTokenA: a.accessToken,
      familyA: await familyOf(email, 'e2e-device-A/1.0'),
      familyB: await familyOf(email, 'e2e-device-B/2.0'),
    };
  }

  it('A. 두 기기 로그인 → 활성 세션 2건, 현재 세션 isCurrent=true', async () => {
    const { cookieA, accessTokenA, familyA } = await setupUser('sess-a');

    const list = await browserGet(SESSIONS, accessTokenA, cookieA);
    expect(list.status).toBe(200);
    const sessions = list.body.data.items as Array<{
      familyId: string;
      isCurrent: boolean;
    }>;
    expect(sessions.length).toBeGreaterThanOrEqual(2);

    // 응답 1건 vs `SessionDto` 선언 전수 대조 (API 규약 §5.4).
    assertMatchesContract(sessions[0], sessionContract);

    const currents = sessions.filter((s) => s.isCurrent);
    expect(currents.map((s) => s.familyId)).toEqual([familyA]);
  });

  it('B. revoke without password → 401/400 (재인증 누락)', async () => {
    const { cookieA, accessTokenA, familyB } = await setupUser('sess-b');

    const noAuth = await browserPost(
      `${SESSIONS}/${familyB}/revoke`,
      accessTokenA,
      cookieA,
      {}, // 비번/TOTP 없음
    );
    expect([400, 401]).toContain(noAuth.status);
  });

  it('C. 단일 revoke → 해당 family refresh 401, 다른 family 는 계속 동작', async () => {
    const { cookieA, cookieB, accessTokenA, familyB } =
      await setupUser('sess-c');

    const revoke = await browserPost(
      `${SESSIONS}/${familyB}/revoke`,
      accessTokenA,
      cookieA,
      { password: TEST_PASSWORD },
    );
    expect(revoke.status).toBe(200);

    // 옛 cookieB 로 refresh 시도 → 401.
    expect((await refreshAsBrowser(cookieB)).status).toBe(401);

    // cookieA refresh 는 정상.
    expect((await refreshAsBrowser(cookieA)).status).toBe(200);
  });

  it('C2. 현재 세션 revoke → 400 CANNOT_REVOKE_CURRENT_SESSION, 현재 세션은 유지', async () => {
    const { cookieA, accessTokenA, familyA } = await setupUser('sess-c2');

    const revoke = await browserPost(
      `${SESSIONS}/${familyA}/revoke`,
      accessTokenA,
      cookieA,
      { password: TEST_PASSWORD },
    );
    expect(revoke.status).toBe(400);
    expect(revoke.body.error?.code).toBe('CANNOT_REVOKE_CURRENT_SESSION');

    expect((await refreshAsBrowser(cookieA)).status).toBe(200);
  });

  it('D. revoke-others → 현재 세션만 남고 나머지 모두 무효', async () => {
    const { email, cookieA, cookieB, accessTokenA, familyA } =
      await setupUser('sess-d');

    // 추가 세션 1개 더 (총 3 family).
    const c = await login(email, 'e2e-device-C/3.0');

    const before = await browserGet(SESSIONS, accessTokenA, cookieA);
    expect(
      (before.body.data.items as Array<unknown>).length,
    ).toBeGreaterThanOrEqual(3);

    const revokeOthers = await browserPost(
      `${SESSIONS}/revoke-others`,
      accessTokenA,
      cookieA,
      { password: TEST_PASSWORD },
    );
    expect(revokeOthers.status).toBe(200);

    const after = revokeOthers.body.data.items as Array<{
      familyId: string;
      isCurrent: boolean;
    }>;
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ familyId: familyA, isCurrent: true });

    // 옛 cookieB · cookieC → 401, cookieA 는 정상.
    expect((await refreshAsBrowser(cookieB)).status).toBe(401);
    expect((await refreshAsBrowser(c.cookie)).status).toBe(401);
    expect((await refreshAsBrowser(cookieA)).status).toBe(200);
  });

  // regression: void → await race (fix-login-history-race).
  // AuthService.login() 이 loginHistory.record() 를 fire-and-forget 으로 두면, 직후
  // 호출되는 GET /api/users/me/login-history 가 두 번째 INSERT commit 보다 먼저 SELECT
  // 를 띄워 첫 번째 row 만 보이는 race 가 재현된다. 본 테스트는 setupUser 가 같은 사용자로
  // 2회 로그인한 직후 정확히 ≥ 2 건이 노출되는지 확인해 race 재발을 차단한다.
  it('E. login-history 가 login_success 이벤트를 시간 역순으로 노출', async () => {
    const { cookieA, accessTokenA } = await setupUser('sess-e');

    const hist = await browserGet(
      '/api/users/me/login-history',
      accessTokenA,
      cookieA,
    );
    expect(hist.status).toBe(200);
    // LoginHistoryPageDto = { items: LoginHistoryItem[], nextCursor: string | null }
    // 외부 wrapping 까지 합치면 res.body.data.items 가 배열.
    const items = hist.body.data.items as Array<{ event: string }>;
    expect(items.length).toBeGreaterThanOrEqual(2); // 두 번 로그인 했음
    assertMatchesContract(
      hist.body.data,
      await contractForDto(LoginHistoryPageDto),
    );
    expect(items.every((i) => typeof i.event === 'string')).toBe(true);
    expect(items.some((i) => i.event === 'login_success')).toBe(true);
  });

  /**
   * **mock 이 원리적으로 말해 주지 못하는 것을 여기서만 확인한다.**
   *
   * `login-history.service.spec.ts` 는 `createQueryBuilder` 를 mock 해 *"검증이 값을
   * 거부하는가"* 만 본다. 그 값을 **통과시켰을 때 Postgres 가 정말 SQLSTATE 22P02 를 내는지**,
   * 그래서 응답이 정말 500 이 됐는지는 실 DB 를 태우지 않으면 알 수 없다 — 이 결함의 전제가
   * 통째로 그 사슬에 걸려 있었다. 같은 판단의 선례가 `webhook-trigger.e2e-spec.ts` B4 다
   * (*"단위 테스트가 mock 하는 드라이버 에러 형태가 실제와 같은지는 이 케이스만 확인한다"*).
   *
   * 계약: 이 엔드포인트는 잘못된 커서를 **무시하고 1페이지**를 준다(날짜·구분자 오류와 같은
   * 처분). 형제 `background-runs` 는 같은 상황에서 400 `INVALID_CURSOR` 다 — 비대칭은 의도이며
   * 통일 여부는 planner 항목으로 등재돼 있다.
   */
  it('F. 커서 id 가 비-UUID 여도 500 이 아니라 200 + 1페이지 (22P02 마스킹 회귀)', async () => {
    const { cookieA, accessTokenA } = await setupUser('sess-f');

    // 날짜·구분자는 **멀쩡하고** id 만 파싱 불가 — 이 조합이 종전에 `lh.id`(uuid 컬럼)까지
    // 흘러 22P02 → 500 이 됐다.
    const res = await request(BASE_URL)
      .get('/api/users/me/login-history')
      .query({ cursor: '2026-05-01T00:00:00.000Z|not-a-uuid' })
      .set('Authorization', `Bearer ${accessTokenA}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{ event: string }>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);

    // **대조군** — 유효한 커서는 실제로 필터링한다(무조건 1페이지를 주는 게 아니다).
    // 이게 없으면 위 단언은 "커서를 아예 안 본다" 로도 참이 된다.
    const first = await request(BASE_URL)
      .get('/api/users/me/login-history')
      .query({ limit: 1 })
      .set('Authorization', `Bearer ${accessTokenA}`);
    expect(first.status).toBe(200);
    const nextCursor = first.body.data.nextCursor as string | null;
    expect(nextCursor).toBeTruthy();

    const second = await request(BASE_URL)
      .get('/api/users/me/login-history')
      .query({ limit: 1, cursor: nextCursor })
      .set('Authorization', `Bearer ${accessTokenA}`);
    expect(second.status).toBe(200);
    const firstId = (first.body.data.items as Array<{ id: string }>)[0].id;
    const secondId = (second.body.data.items as Array<{ id: string }>)[0].id;
    expect(secondId).not.toBe(firstId);
  });
});
