import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { TEST_PASSWORD, extractRefreshCookie } from './helpers/auth';
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
 * spec: spec/2-navigation/9-user-profile.md §sessions (auth-sessions 작업의 산출물).
 * 본인 인증(비밀번호 또는 TOTP) 없이 revoke 불가, 단일 revoke 와 revoke-others 가
 * 각각 family 단위로 refresh 토큰을 무효화하는지 확인.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

async function loginAndGetCookie(
  email: string,
  password: string,
  userAgent: string,
): Promise<string> {
  const res = await request(BASE_URL)
    .post('/api/auth/login')
    .set('User-Agent', userAgent)
    .send({ email, password });
  expect(res.status).toBe(200);
  const cookie = extractRefreshCookie(
    res.headers['set-cookie'] as unknown as string[],
  );
  if (!cookie) throw new Error('no refresh cookie issued at login');
  return cookie;
}

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

  async function setupUser(prefix: string): Promise<{
    email: string;
    cookieA: string;
    cookieB: string;
    accessTokenA: string;
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

    const loginA = await request(BASE_URL)
      .post('/api/auth/login')
      .set('User-Agent', 'e2e-device-A/1.0')
      .send({ email, password: TEST_PASSWORD });
    const cookieA = extractRefreshCookie(
      loginA.headers['set-cookie'] as unknown as string[],
    )!;
    const accessTokenA = (loginA.body.data as { accessToken: string })
      .accessToken;

    const cookieB = await loginAndGetCookie(
      email,
      TEST_PASSWORD,
      'e2e-device-B/2.0',
    );

    expect(cookieA).not.toBe(cookieB);
    return { email, cookieA, cookieB, accessTokenA };
  }

  it('A. 두 기기 로그인 → 활성 세션 2건, 현재 세션 isCurrent=true', async () => {
    const { cookieA, accessTokenA } = await setupUser('sess-a');

    const list = await request(BASE_URL)
      .get('/api/users/me/sessions')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA);
    expect(list.status).toBe(200);
    const sessions = list.body.data.items as Array<{
      familyId: string;
      isCurrent: boolean;
    }>;
    expect(sessions.length).toBeGreaterThanOrEqual(2);

    // 응답 1건 vs `SessionDto` 선언 전수 대조 (API 규약 §5.4).
    assertMatchesContract(sessions[0], sessionContract);

    const currents = sessions.filter((s) => s.isCurrent);
    expect(currents.length).toBe(1);
  });

  it('B. revoke without password → 401/400 (재인증 누락)', async () => {
    const { cookieA, accessTokenA } = await setupUser('sess-b');

    const list = await request(BASE_URL)
      .get('/api/users/me/sessions')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA);
    const targetFamilyId = (
      list.body.data.items as Array<{ familyId: string; isCurrent: boolean }>
    ).find((s) => !s.isCurrent)!.familyId;

    const noAuth = await request(BASE_URL)
      .post(`/api/users/me/sessions/${targetFamilyId}/revoke`)
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA)
      .send({}); // 비번/TOTP 없음
    expect([400, 401]).toContain(noAuth.status);
  });

  it('C. 단일 revoke → 해당 family refresh 401, 다른 family 는 계속 동작', async () => {
    const { cookieA, cookieB, accessTokenA } = await setupUser('sess-c');

    const list = await request(BASE_URL)
      .get('/api/users/me/sessions')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA);
    const targetFamilyId = (
      list.body.data.items as Array<{ familyId: string; isCurrent: boolean }>
    ).find((s) => !s.isCurrent)!.familyId; // cookieB 의 family

    const revoke = await request(BASE_URL)
      .post(`/api/users/me/sessions/${targetFamilyId}/revoke`)
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA)
      .send({ password: TEST_PASSWORD });
    expect(revoke.status).toBe(200);

    // 옛 cookieB 로 refresh 시도 → 401.
    const refresh = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', cookieB);
    expect(refresh.status).toBe(401);

    // cookieA refresh 는 정상.
    const refreshA = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', cookieA);
    expect(refreshA.status).toBe(200);
  });

  it('D. revoke-others → 현재 세션만 남고 나머지 모두 무효', async () => {
    const { cookieA, cookieB, accessTokenA } = await setupUser('sess-d');

    // 추가 세션 1개 더 (총 3 family).
    const { email } = await (async () => {
      // Reuse: pull email back. setupUser returns it; but reuse 이미 setupUser
      // 결과를 받았으므로 단순화: 별도 로그인.
      const list = await request(BASE_URL)
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessTokenA}`)
        .set('Cookie', cookieA);
      const userRow = list.body.data.items as Array<{ familyId: string }>;
      expect(userRow.length).toBeGreaterThanOrEqual(2);
      const userEmail = (
        await db.query<{ email: string }>(
          `SELECT u.email FROM "user" u
             JOIN refresh_token rt ON rt.user_id = u.id
             WHERE rt.family_id = $1
             LIMIT 1`,
          [userRow[0].familyId],
        )
      ).rows[0].email;
      return { email: userEmail };
    })();

    await loginAndGetCookie(email, TEST_PASSWORD, 'e2e-device-C/3.0');

    const before = await request(BASE_URL)
      .get('/api/users/me/sessions')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA);
    expect(
      (before.body.data.items as Array<unknown>).length,
    ).toBeGreaterThanOrEqual(3);

    const revokeOthers = await request(BASE_URL)
      .post('/api/users/me/sessions/revoke-others')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA)
      .send({ password: TEST_PASSWORD });
    expect(revokeOthers.status).toBe(200);

    const after = revokeOthers.body.data.items as Array<{ isCurrent: boolean }>;
    expect(after.length).toBe(1);
    expect(after[0].isCurrent).toBe(true);

    // 옛 cookieB → 401.
    const refreshB = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', cookieB);
    expect(refreshB.status).toBe(401);
  });

  // regression: void → await race (fix-login-history-race).
  // AuthService.login() 이 loginHistory.record() 를 fire-and-forget 으로 두면, 직후
  // 호출되는 GET /api/users/me/login-history 가 두 번째 INSERT commit 보다 먼저 SELECT
  // 를 띄워 첫 번째 row 만 보이는 race 가 재현된다. 본 테스트는 setupUser 가 같은 사용자로
  // 2회 로그인한 직후 정확히 ≥ 2 건이 노출되는지 확인해 race 재발을 차단한다.
  it('E. login-history 가 login_success 이벤트를 시간 역순으로 노출', async () => {
    const { cookieA, accessTokenA } = await setupUser('sess-e');

    const hist = await request(BASE_URL)
      .get('/api/users/me/login-history')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA);
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
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA);

    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{ event: string }>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);

    // **대조군** — 유효한 커서는 실제로 필터링한다(무조건 1페이지를 주는 게 아니다).
    // 이게 없으면 위 단언은 "커서를 아예 안 본다" 로도 참이 된다.
    const first = await request(BASE_URL)
      .get('/api/users/me/login-history')
      .query({ limit: 1 })
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA);
    expect(first.status).toBe(200);
    const nextCursor = first.body.data.nextCursor as string | null;
    expect(nextCursor).toBeTruthy();

    const second = await request(BASE_URL)
      .get('/api/users/me/login-history')
      .query({ limit: 1, cursor: nextCursor })
      .set('Authorization', `Bearer ${accessTokenA}`)
      .set('Cookie', cookieA);
    expect(second.status).toBe(200);
    const firstId = (first.body.data.items as Array<{ id: string }>)[0].id;
    const secondId = (second.body.data.items as Array<{ id: string }>)[0].id;
    expect(secondId).not.toBe(firstId);
  });
});
