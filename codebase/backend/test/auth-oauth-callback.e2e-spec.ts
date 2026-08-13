import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient } from './helpers/db';

/**
 * e2e: OAuth 콜백의 `state` 소비를 **실제 드라이버 위에서** 검증한다.
 *
 * ## 왜 이 파일이 필요한가
 *
 * `handleCallback` 은 `DELETE FROM auth_oauth_state … RETURNING *` 의 결과를 소비한다.
 * TypeORM 0.3.x + pg 는 UPDATE/DELETE 에 **`[rows, rowCount]` 튜플**을 돌려주는데,
 * 코드가 이를 행 배열로 다루면:
 *   - `consumed.length === 0` 이 항상 거짓 → **만료·재사용 state 를 못 거절**
 *   - `consumed[0]` 이 행이 아니라 행 배열 → `provider` 가 `undefined` →
 *     **정상 콜백도 전부 실패**
 *
 * 실제로 그 상태로 4개월간 소셜 로그인이 상시 실패했고, **아무도 못 봤다** —
 * 단위 테스트가 `[validState]`(INSERT 형태)를 mock 했고 e2e 는 없었기 때문이다.
 * mock 은 코드와 같은 오해를 공유할 수 있으므로 **드라이버가 실제로 무엇을 돌려주는지**
 * 는 이렇게 실 인프라에서만 확정된다 (`23_46_00`/`00_00_44` user_guide_sync·testing WARNING).
 *
 * ## 무엇을 고정하나
 *
 * 성공/거절 **양방향**을 리다이렉트 URL 로 관측한다 — 한쪽만 보면 "전부 실패" 도
 * "전부 통과" 도 절반은 초록이다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** state row 직접 시드. `expiresAt`·`rememberMe` 를 파라미터화한다. */
async function seedState(
  db: Client,
  provider: string,
  expiresInMs: number,
  rememberMe = false,
): Promise<string> {
  const state = crypto.randomBytes(24).toString('hex');
  await db.query(
    `INSERT INTO auth_oauth_state (state, provider, mode, remember_me, expires_at)
       VALUES ($1, $2, 'login', $4, NOW() + ($3::text || ' milliseconds')::interval)`,
    [state, provider, String(expiresInMs), rememberMe],
  );
  return state;
}

/** 콜백은 리다이렉트 + Set-Cookie 로만 결과를 알린다. */
async function callbackRaw(provider: string, state: string) {
  return (
    request(BASE_URL)
      // `setGlobalPrefix('api')` — 빠뜨리면 404 라 Location 이 비고 **모든 단언이
      // 똑같이 실패**한다(첫 실행에서 5/5 실패로 잡혔다).
      .get(`/api/auth/oauth/${provider}/callback`)
      .query({ code: 'stub-code', state })
      .redirects(0)
  );
}

async function callback(provider: string, state: string): Promise<string> {
  const res = await callbackRaw(provider, state);
  return String(res.headers.location ?? '');
}

/** refresh 쿠키의 `Max-Age`(초). 없으면 null. */
function refreshCookieMaxAge(setCookie: unknown): number | null {
  const list = Array.isArray(setCookie) ? (setCookie as string[]) : [];
  const cookie = list.find((c) => c.startsWith('refreshToken='));
  const m = cookie?.match(/Max-Age=(\d+)/i);
  return m ? Number(m[1]) : null;
}

const MAX_AGE_REMEMBER_ME = 30 * 24 * 60 * 60; // 2592000
const MAX_AGE_DEFAULT = 7 * 24 * 60 * 60; //      604800

describe('OAuth 콜백 state 소비 (e2e, 실 드라이버)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  }, 30_000);

  afterAll(async () => {
    await db.end();
  });

  it('유효한 state → 성공 리다이렉트 (튜플에서 행을 꺼내야 provider 가 맞는다)', async () => {
    const state = await seedState(db, 'google', 60_000);

    const location = await callback('google', state);

    // 언랩이 깨지면 `record.provider` 가 undefined → `invalid_state` 로 떨어진다.
    expect(location).toContain('success=true');
  });

  it('같은 state 재사용 → 거절 (DELETE 가 1회만 소비돼야 한다)', async () => {
    const state = await seedState(db, 'google', 60_000);

    const first = await callback('google', state);
    const second = await callback('google', state);

    expect(first).toContain('success=true');
    // `consumed.length === 0` 이 항상 거짓이면 두 번째도 통과해 버린다.
    expect(second).toContain('error=');
    expect(second).not.toContain('success=true');
  });

  it('만료된 state → 거절 (`expires_at > NOW()` 가 실제로 걸러야 한다)', async () => {
    const state = await seedState(db, 'google', -60_000); // 이미 만료

    const location = await callback('google', state);

    expect(location).toContain('error=');
    expect(location).not.toContain('success=true');
  });

  it('DB 에 없는 state → 거절', async () => {
    const location = await callback('google', crypto.randomUUID());

    expect(location).toContain('error=');
    expect(location).not.toContain('success=true');
  });

  it('provider 불일치 → 거절 (행이 아니라 배열을 읽으면 이 검사가 항상 참이 된다)', async () => {
    const state = await seedState(db, 'github', 60_000);

    // github 로 발급한 state 를 google 콜백에 넣는다.
    const location = await callback('google', state);

    expect(location).toContain('error=');
    expect(location).not.toContain('success=true');
  });

  /**
   * **`remember_me` 는 컬럼명 축의 같은 함정이다.**
   *
   * raw `.query()` 는 ORM 매핑을 안 타므로 행의 키가 `remember_me`(snake_case)다.
   * 코드가 entity 의 `rememberMe` 를 읽으면 `undefined` → `rememberMe ? 30 : 7` 이
   * 늘 7일을 골라 **"로그인 유지" 가 침묵으로 무시된다**.
   *
   * 단위 테스트가 이걸 4개월간 놓친 이유는 mock 이 코드와 같은 오해를 공유했기
   * 때문이다 — 그래서 여기, 실 드라이버 위에서 한 번 더 못박는다.
   *
   * `true` 케이스가 판별자다. `false` 는 정답과 버그가 같은 값(7일)을 낸다.
   */
  it('remember_me=true → refresh 쿠키가 30일 (버그 상태에선 7일)', async () => {
    const state = await seedState(db, 'google', 60_000, true);

    const res = await callbackRaw('google', state);

    expect(String(res.headers.location ?? '')).toContain('success=true');
    expect(refreshCookieMaxAge(res.headers['set-cookie'])).toBe(
      MAX_AGE_REMEMBER_ME,
    );
  });

  it('remember_me=false → refresh 쿠키가 7일 (대조군)', async () => {
    const state = await seedState(db, 'google', 60_000, false);

    const res = await callbackRaw('google', state);

    expect(String(res.headers.location ?? '')).toContain('success=true');
    expect(refreshCookieMaxAge(res.headers['set-cookie'])).toBe(
      MAX_AGE_DEFAULT,
    );
  });
});
