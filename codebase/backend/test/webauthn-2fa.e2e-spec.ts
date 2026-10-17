import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';
import { verifyRegistrationResponse } from '@simplewebauthn/server';

import { createDbClient, uniqueEmail } from './helpers/db';
import {
  TEST_PASSWORD,
  registerAndLogin,
  extractRefreshCookie,
} from './helpers/auth';
import {
  RP_ID,
  RP_ORIGIN,
  SoftWebAuthnDevice,
  type SoftKeyAlgorithm,
  registerDevice,
  loginForWebauthnChallenge,
  fetchAuthOptions,
  fetchRegistrationOptions,
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
  last_used_at: string | null;
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
      'SELECT id, counter, last_used_at FROM webauthn_credential WHERE user_id = $1',
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
    expect(rows[0].last_used_at).not.toBeNull();
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
    const rows = await credentialRows(userId);
    expect(rows).toHaveLength(1);
    // 검증 실패는 counter 를 갱신하지 않는다 (성공 verify 만 newCounter 반영).
    expect(rows[0].counter).toBe('0');
  });

  // 단위 테스트는 라이브러리를 mock 해서 인자만 본다. 실제 라이브러리가 그 인자로
  // 응답의 pubKeyCredParams 를 만드는지는 여기서 본다. v14 는 PQC 를 지원하는 런타임에서
  // 인자가 없으면 ML-DSA-44(-48)를 맨 앞에 넣는다.
  it('F. 등록 옵션의 pubKeyCredParams 가 EdDSA · ES256 · RS256 순서로 고정된다', async () => {
    const { accessToken } = await registerAndLogin(
      BASE_URL,
      uniqueEmail('webauthn-f'),
      db,
    );
    const res = await request(BASE_URL)
      .post('/api/auth/2fa/webauthn/register/options')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(200);
    const params = (
      res.body.data as {
        publicKey: { pubKeyCredParams: { alg: number; type: string }[] };
      }
    ).publicKey.pubKeyCredParams;
    expect(params.map((p) => p.alg)).toEqual([-8, -7, -257]);
  });

  /** `deviceName` 이 `undefined` 면 본문에 싣지 않는다. */
  async function postRegisterVerify(
    accessToken: string,
    optionsToken: string,
    response: unknown,
    deviceName?: string,
  ) {
    return request(BASE_URL)
      .post('/api/auth/2fa/webauthn/register/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ optionsToken, response, deviceName });
  }

  async function storedTransports(userId: string): Promise<string[][]> {
    const res = await db.query<{ transports: string[] }>(
      'SELECT transports FROM webauthn_credential WHERE user_id = $1',
      [userId],
    );
    return res.rows.map((r) => r.transports);
  }

  async function storedDeviceNames(userId: string): Promise<(string | null)[]> {
    const res = await db.query<{ device_name: string | null }>(
      'SELECT device_name FROM webauthn_credential WHERE user_id = $1',
      [userId],
    );
    return res.rows.map((r) => r.device_name);
  }

  // 케이스 F 와 짝이다. F 는 등록 옵션이 브라우저에 안내하는 목록을 본다. G 는 등록 검증이
  // 실제로 받는 목록을 본다. 옵션을 따르지 않는 클라이언트가 목록 밖 알고리즘의 키를 보내도
  // 등록 검증이 거부해야 한다. 대조군은 같은 응답을 실제 라이브러리로 검증해 응답이 올바르다는
  // 것을 보인다. 그래서 서버의 거부 이유는 알고리즘 목록뿐이다.
  it.each<{ algorithm: SoftKeyAlgorithm; controlAlgorithmIDs?: number[] }>([
    // ES384(-35)는 라이브러리 기본 목록에도 없어서 대조군에 직접 허용한다.
    { algorithm: 'ES384', controlAlgorithmIDs: [-35] },
    // ML-DSA-44(-48)는 v14 가 PQC 를 지원하는 런타임에서 기본 목록에 넣는다. 대조군은 기본
    // 목록을 그대로 쓰므로 서버가 등록 검증의 목록을 고정하지 않으면 이 케이스가 실패한다.
    { algorithm: 'ML-DSA-44' },
  ])(
    'G. 등록 검증이 목록 밖 알고리즘($algorithm)의 credential 을 400 으로 거부하고 저장하지 않는다',
    async ({ algorithm, controlAlgorithmIDs }) => {
      const { userId, accessToken } = await registerAndLogin(
        BASE_URL,
        uniqueEmail('webauthn-g'),
        db,
      );
      const { challenge, optionsToken } = await fetchRegistrationOptions(
        BASE_URL,
        accessToken,
      );
      const device = new SoftWebAuthnDevice({ algorithm });
      const response = device.registrationResponse(challenge);

      const control = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: RP_ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: true,
        supportedAlgorithmIDs: controlAlgorithmIDs,
      });
      expect(control.verified).toBe(true);
      expect(control.registrationInfo?.credential.id).toBe(
        device.credentialIdB64Url,
      );

      const res = await postRegisterVerify(accessToken, optionsToken, response);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('WEBAUTHN_VERIFY_FAILED');
      expect(await credentialRows(userId)).toHaveLength(0);
    },
  );

  // 라이브러리는 transports 를 검증하지 않고 그대로 돌려준다. 고치기 전에는 문자열이면 text[]
  // 컬럼 저장에서 500 이 났다. 숫자가 섞인 배열은 숫자가 문자열로 바뀌어 저장됐다. NUL 문자가
  // 든 문자열은 PostgreSQL text 가 저장하지 못해서 검증이 막지 않으면 같은 500 이 난다.
  it.each([
    ['문자열', 'usb'],
    ['숫자가 섞인 배열', ['usb', 1]],
    ['NUL 문자가 든 배열', ['usb', 'a\u0000b']],
  ])(
    'H. transports 가 %s이면 등록 검증이 400 으로 거부하고 저장하지 않는다',
    async (_label, transports) => {
      const { userId, accessToken } = await registerAndLogin(
        BASE_URL,
        uniqueEmail('webauthn-h'),
        db,
      );
      const { challenge, optionsToken } = await fetchRegistrationOptions(
        BASE_URL,
        accessToken,
      );
      const device = new SoftWebAuthnDevice();

      const res = await postRegisterVerify(
        accessToken,
        optionsToken,
        device.registrationResponse(challenge, { transports }),
      );
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('WEBAUTHN_VERIFY_FAILED');
      expect(await credentialRows(userId)).toHaveLength(0);

      // 대조군: 같은 인증기 · 같은 옵션에서 transports 만 바로잡으면 등록된다.
      const ok = await postRegisterVerify(
        accessToken,
        optionsToken,
        device.registrationResponse(challenge),
      );
      expect(ok.status).toBe(200);
      expect(await credentialRows(userId)).toHaveLength(1);
    },
  );

  it('I. 표준 목록에 없는 transport 도 바꾸지 않고 저장한다', async () => {
    const { userId, accessToken } = await registerAndLogin(
      BASE_URL,
      uniqueEmail('webauthn-i'),
      db,
    );
    const { challenge, optionsToken } = await fetchRegistrationOptions(
      BASE_URL,
      accessToken,
    );
    const device = new SoftWebAuthnDevice();

    const res = await postRegisterVerify(
      accessToken,
      optionsToken,
      device.registrationResponse(challenge, {
        transports: ['internal', 'future-transport'],
      }),
    );
    expect(res.status).toBe(200);
    expect(await storedTransports(userId)).toEqual([
      ['internal', 'future-transport'],
    ]);
  });

  it.each([
    ['필드가 없으면', undefined],
    ['값이 빈 배열이면', []],
  ])('J. transports %s 빈 목록으로 저장한다', async (_label, transports) => {
    const { userId, accessToken } = await registerAndLogin(
      BASE_URL,
      uniqueEmail('webauthn-j'),
      db,
    );
    const { challenge, optionsToken } = await fetchRegistrationOptions(
      BASE_URL,
      accessToken,
    );
    const device = new SoftWebAuthnDevice();

    const res = await postRegisterVerify(
      accessToken,
      optionsToken,
      device.registrationResponse(challenge, { transports }),
    );
    expect(res.status).toBe(200);
    expect(await storedTransports(userId)).toEqual([[]]);
  });

  // 표시 이름은 varchar(100) 컬럼에 들어간다. PostgreSQL 은 NUL 문자를 저장하지 못하고 길이를
  // 코드 포인트로 센다. class-validator 의 MaxLength 는 변형 선택자(U+FE0F)를 앞 글자와 묶어 한
  // 글자로 세서 코드 포인트 101개짜리 이름도 통과시킨다. 고치기 전에는 두 이름 모두 저장에서
  // 500 이 났다.
  // 변형 선택자 16(U+FE0F). 화면에 보이지 않아 리터럴로 적으면 핵심 입력이 사라진 것처럼 보인다.
  const VS16 = '\uFE0F';
  const INVALID_DEVICE_NAMES: [string, string][] = [
    ['NUL 문자가 든 이름', 'a\u0000b'],
    // 글자 100개 + 변형 선택자 = 코드 포인트 101개. MaxLength 는 100으로 센다.
    ['코드 포인트가 100개를 넘는 이름', `${'a'.repeat(100)}${VS16}`],
  ];
  // 대조군에 쓰는 경계값이다. 글자 99개 + 변형 선택자 = 코드 포인트 100개는 받는다.
  const LONGEST_DEVICE_NAME = `${'a'.repeat(99)}${VS16}`;
  // 등록 검증은 표시 이름을 빼도 되므로 빈 이름 거부는 이름 변경에만 있다.
  const INVALID_RENAME_DEVICE_NAMES: [string, string][] = [
    ...INVALID_DEVICE_NAMES,
    ['빈 이름', ''],
  ];

  it.each(INVALID_DEVICE_NAMES)(
    'K. 등록 검증이 %s을 400 으로 거부하고 저장하지 않는다',
    async (_label, deviceName) => {
      const { userId, accessToken } = await registerAndLogin(
        BASE_URL,
        uniqueEmail('webauthn-k'),
        db,
      );
      const { challenge, optionsToken } = await fetchRegistrationOptions(
        BASE_URL,
        accessToken,
      );
      const device = new SoftWebAuthnDevice();

      const res = await postRegisterVerify(
        accessToken,
        optionsToken,
        device.registrationResponse(challenge),
        deviceName,
      );
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(await credentialRows(userId)).toHaveLength(0);

      // 대조군: 같은 인증기 · 같은 옵션에서 이름만 바로잡으면 등록된다.
      const ok = await postRegisterVerify(
        accessToken,
        optionsToken,
        device.registrationResponse(challenge),
        LONGEST_DEVICE_NAME,
      );
      expect(ok.status).toBe(200);
      expect(await storedDeviceNames(userId)).toEqual([LONGEST_DEVICE_NAME]);
    },
  );

  it.each(INVALID_RENAME_DEVICE_NAMES)(
    'L. 이름 변경이 %s을 400 으로 거부하고 이름을 바꾸지 않는다',
    async (_label, deviceName) => {
      const { userId, accessToken } = await registerAndLogin(
        BASE_URL,
        uniqueEmail('webauthn-l'),
        db,
      );
      const { credentialUuid } = await registerDevice(
        BASE_URL,
        accessToken,
        new SoftWebAuthnDevice(),
        'before-rename',
      );
      const rename = (name: string) =>
        request(BASE_URL)
          .patch(`/api/auth/2fa/webauthn/credentials/${credentialUuid}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ deviceName: name });

      const res = await rename(deviceName);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(await storedDeviceNames(userId)).toEqual(['before-rename']);

      // 대조군: 같은 credential 에 경계값 이름을 주면 바뀐다.
      const ok = await rename(LONGEST_DEVICE_NAME);
      expect(ok.status).toBe(200);
      expect(ok.body.data.deviceName).toBe(LONGEST_DEVICE_NAME);
      expect(await storedDeviceNames(userId)).toEqual([LONGEST_DEVICE_NAME]);
    },
  );
});
