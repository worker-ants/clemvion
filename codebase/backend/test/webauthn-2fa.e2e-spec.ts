import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import {
  TEST_PASSWORD,
  registerAndLogin,
  extractRefreshCookie,
} from './helpers/auth';
import {
  SoftWebAuthnDevice,
  registerDevice,
  loginForWebauthnChallenge,
  fetchAuthOptions,
} from './helpers/webauthn';

/**
 * e2e: WebAuthn(Passkey · 보안 키) 2FA 의 HTTP → service → DB 전 구간을 실 인프라에서
 * 검증한다. `webauthn.service.spec.ts` 는 `@simplewebauthn/server` 를 mock 하므로 실제
 * attestation/assertion 검증·DB persist·트랜잭션 경계(counter 역행 시 credential 삭제 +
 * 세션 revoke 의 원자성)·실 라이브러리 에러 메시지는 cover 하지 못한다 — 본 suite 가 그
 * 갭을 메운다.
 *
 * spec: spec/5-system/1-auth.md §1.4 + Rationale 1.4.A~E.
 * 활성 전제: docker-compose.e2e.yml backend-e2e 가 WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN 을
 *   설정해 기능을 켜둔다(미설정 시 503). helper 의 RP_ID/RP_ORIGIN 과 반드시 일치.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

interface CredentialRow {
  id: string;
  counter: string;
}

describe('WebAuthn 2FA (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  }, 30_000);

  afterAll(async () => {
    await db.end();
  });

  async function credentialRows(userId: string): Promise<CredentialRow[]> {
    const res = await db.query<CredentialRow>(
      'SELECT id, counter FROM webauthn_credential WHERE user_id = $1',
      [userId],
    );
    return res.rows;
  }

  async function recoveryCodes(userId: string): Promise<string[] | null> {
    const res = await db.query<{ webauthn_recovery_codes: string[] | null }>(
      'SELECT webauthn_recovery_codes FROM "user" WHERE id = $1',
      [userId],
    );
    return res.rows[0]?.webauthn_recovery_codes ?? null;
  }

  it('A. 등록 → 인증 → counter 갱신 (HTTP + DB persist)', async () => {
    const { userId, accessToken } = await registerAndLogin(
      BASE_URL,
      uniqueEmail('webauthn-a'),
      db,
    );

    const device = new SoftWebAuthnDevice();
    const reg = await registerDevice(BASE_URL, accessToken, device);
    expect(reg.webauthnRecoveryCodes).toHaveLength(10);

    // DB: credential 1건, counter 0 으로 persist.
    let rows = await credentialRows(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].counter).toBe('0');

    // 로그인 2FA: 비밀번호만으로는 토큰 미발급 → webauthn 분기.
    const challengeToken = await loginForWebauthnChallenge(
      BASE_URL,
      // registerAndLogin 의 email 을 되돌려받지 않으므로 DB 로 조회.
      (
        await db.query<{ email: string }>(
          'SELECT email FROM "user" WHERE id = $1',
          [userId],
        )
      ).rows[0].email,
      TEST_PASSWORD,
    );
    const { challenge, optionsToken } = await fetchAuthOptions(
      BASE_URL,
      challengeToken,
    );

    const verifyRes = await request(BASE_URL)
      .post('/api/auth/2fa/webauthn/authenticate/verify')
      .send({
        challengeToken,
        optionsToken,
        response: device.authenticationResponse(challenge),
      });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.accessToken).toBeTruthy();
    // 정식 refresh 쿠키 발급.
    expect(
      extractRefreshCookie(
        verifyRes.headers['set-cookie'] as unknown as string[],
      ),
    ).toBeTruthy();

    // DB: counter 0 → 1 갱신 + last_used_at 기록.
    rows = await credentialRows(userId);
    expect(rows[0].counter).toBe('1');
  });

  it('B. counter 역행 → 401 + credential 삭제 + 활성 세션 전체 revoke (트랜잭션 원자성)', async () => {
    const email = uniqueEmail('webauthn-b');
    const { userId, accessToken } = await registerAndLogin(BASE_URL, email, db);
    const device = new SoftWebAuthnDevice();
    await registerDevice(BASE_URL, accessToken, device);

    // 1차 정상 인증 → counter=1, 정식 세션(refresh cookie) 확보.
    const ct1 = await loginForWebauthnChallenge(BASE_URL, email, TEST_PASSWORD);
    const opt1 = await fetchAuthOptions(BASE_URL, ct1);
    const ok = await request(BASE_URL)
      .post('/api/auth/2fa/webauthn/authenticate/verify')
      .send({
        challengeToken: ct1,
        optionsToken: opt1.optionsToken,
        response: device.authenticationResponse(opt1.challenge),
      });
    expect(ok.status).toBe(200);
    const sessionCookie = extractRefreshCookie(
      ok.headers['set-cookie'] as unknown as string[],
    )!;
    expect(sessionCookie).toBeTruthy();
    expect((await credentialRows(userId))[0].counter).toBe('1');

    // 2차: counter 를 올리지 않은 리플레이(복제 인증기) → DB counter(1) 와 동률 → 역행.
    const ct2 = await loginForWebauthnChallenge(BASE_URL, email, TEST_PASSWORD);
    const opt2 = await fetchAuthOptions(BASE_URL, ct2);
    const regress = await request(BASE_URL)
      .post('/api/auth/2fa/webauthn/authenticate/verify')
      .send({
        challengeToken: ct2,
        optionsToken: opt2.optionsToken,
        response: device.authenticationResponse(opt2.challenge, {
          bumpCounter: false,
        }),
      });
    expect(regress.status).toBe(401);
    expect(regress.body.error.code).toBe('WEBAUTHN_COUNTER_REGRESSION');

    // credential row 즉시 삭제 (Rationale 1.4.E — suspend 아님).
    expect(await credentialRows(userId)).toHaveLength(0);

    // 활성 세션 전체 revoke → 1차에서 받은 refresh 쿠키 무효.
    const refresh = await request(BASE_URL)
      .post('/api/auth/refresh')
      .set('Cookie', sessionCookie);
    expect(refresh.status).toBe(401);

    // LoginHistory 에 webauthn_failed(COUNTER_REGRESSION) 기록.
    const hist = await db.query<{ failure_reason: string | null }>(
      `SELECT failure_reason FROM login_history
         WHERE user_id = $1 AND event = 'webauthn_failed'
         ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    expect(hist.rows[0]?.failure_reason).toBe('WEBAUTHN_COUNTER_REGRESSION');
  });

  it('C. 복구 코드 fallback → 2FA 통과, 동일 코드 재사용 차단', async () => {
    const email = uniqueEmail('webauthn-c');
    const { accessToken } = await registerAndLogin(BASE_URL, email, db);
    const device = new SoftWebAuthnDevice();
    const reg = await registerDevice(BASE_URL, accessToken, device);
    const code = reg.webauthnRecoveryCodes[0];

    // 인증기 대신 복구 코드로 2FA 통과.
    const ct1 = await loginForWebauthnChallenge(BASE_URL, email, TEST_PASSWORD);
    const recover = await request(BASE_URL)
      .post('/api/auth/2fa/webauthn/recovery')
      .send({ challengeToken: ct1, code });
    expect(recover.status).toBe(200);
    expect(recover.body.data.accessToken).toBeTruthy();

    // 같은 코드 재사용 → 소비됐으므로 401.
    const ct2 = await loginForWebauthnChallenge(BASE_URL, email, TEST_PASSWORD);
    const reuse = await request(BASE_URL)
      .post('/api/auth/2fa/webauthn/recovery')
      .send({ challengeToken: ct2, code });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('RECOVERY_CODE_INVALID');
  });

  it('D. 마지막 credential 삭제 → webauthn_recovery_codes NULL 화', async () => {
    const email = uniqueEmail('webauthn-d');
    const { userId, accessToken } = await registerAndLogin(BASE_URL, email, db);
    const device = new SoftWebAuthnDevice();
    const reg = await registerDevice(BASE_URL, accessToken, device);

    // 첫 등록으로 복구 코드 set.
    expect(await recoveryCodes(userId)).not.toBeNull();
    const credentialUuid = reg.credentialUuid;

    const del = await request(BASE_URL)
      .delete(`/api/auth/2fa/webauthn/credentials/${credentialUuid}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(del.status).toBe(204);

    // 마지막 credential 이므로 복구 코드도 NULL (애플리케이션 레이어 책임).
    expect(await credentialRows(userId)).toHaveLength(0);
    expect(await recoveryCodes(userId)).toBeNull();
  });

  it('E. requireUserVerification — UV 미설정 assertion → 401, credential 보존', async () => {
    const email = uniqueEmail('webauthn-e');
    const { userId, accessToken } = await registerAndLogin(BASE_URL, email, db);
    const device = new SoftWebAuthnDevice();
    await registerDevice(BASE_URL, accessToken, device);

    const ct = await loginForWebauthnChallenge(BASE_URL, email, TEST_PASSWORD);
    const opt = await fetchAuthOptions(BASE_URL, ct);
    const res = await request(BASE_URL)
      .post('/api/auth/2fa/webauthn/authenticate/verify')
      .send({
        challengeToken: ct,
        optionsToken: opt.optionsToken,
        response: device.authenticationResponse(opt.challenge, { uv: false }),
      });
    expect(res.status).toBe(401);
    // UV 실패는 검증 실패(WEBAUTHN_INVALID)이지 counter 역행이 아니므로 credential 보존.
    expect(res.body.error.code).toBe('WEBAUTHN_INVALID');
    expect(await credentialRows(userId)).toHaveLength(1);
  });
});
