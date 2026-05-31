import crypto from 'crypto';
import request from 'supertest';
import { isoBase64URL, isoCBOR, cose } from '@simplewebauthn/server/helpers';

/**
 * 백엔드 WebAuthn e2e 전용 소프트웨어 인증기.
 *
 * `webauthn.service.spec.ts` 는 `@simplewebauthn/server` 를 통째로 mock 해 24 케이스를
 * 회귀 잠금하지만, mock 은 라이브러리의 실제 verify 동작·에러 메시지를 재현하지 못한다.
 * 본 helper 는 실제 Ed25519 키로 attestation/assertion 을 합성해 backend-e2e 컨테이너의
 * 진짜 `verifyRegistrationResponse` / `verifyAuthenticationResponse` 를 통과(또는 의도적
 * 으로 실패)시킨다 — HTTP → service → DB 전 구간을 mock 없이 검증한다.
 *
 * RP 파라미터는 docker-compose.e2e.yml 의 backend-e2e 환경변수
 * (`WEBAUTHN_RP_ID=localhost`, `WEBAUTHN_ORIGIN=http://localhost:3012`) 와 일치해야 한다.
 * 둘 중 하나라도 어긋나면 origin/rpIdHash 불일치로 모든 verify 가 실패한다.
 */
export const RP_ID = 'localhost';
export const RP_ORIGIN = 'http://localhost:3012';

const { COSEKEYS, COSEKTY, COSEALG, COSECRV } = cose;

function sha256(data: Buffer): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

function b64u(data: Buffer): string {
  return isoBase64URL.fromBuffer(new Uint8Array(data));
}

// authenticatorData flags (WebAuthn §6.1)
const FLAG_UP = 0x01; // User Present
const FLAG_UV = 0x04; // User Verified
const FLAG_AT = 0x40; // Attested credential data included

/**
 * 단일 Ed25519(OKP/EdDSA) 인증기를 모사한다. 등록 시 한 번 키를 생성하고, 매 인증마다
 * sign counter 를 1 씩 올린다. 복제/리플레이(=counter 역행) 를 강제로 만들려면
 * `authenticationResponse(..., { bumpCounter: false })` 로 counter 를 고정한다.
 */
export class SoftWebAuthnDevice {
  private readonly privateKey: crypto.KeyObject;
  private readonly publicKeyRaw: Buffer; // 32-byte Ed25519 공개키
  readonly credentialId: Buffer;
  private readonly aaguid: Buffer;
  /** 마지막으로 합성에 사용한 sign counter (DB 가 기대하는 다음 값의 직전). */
  signCount = 0;

  constructor() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    this.privateKey = privateKey;
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
    this.publicKeyRaw = Buffer.from(jwk.x, 'base64url');
    this.credentialId = crypto.randomBytes(32);
    this.aaguid = Buffer.alloc(16, 0); // attestationType 'none' — 0 AAGUID
  }

  get credentialIdB64Url(): string {
    return b64u(this.credentialId);
  }

  /** COSE_Key (OKP / Ed25519) CBOR 직렬화. attestedCredentialData 에 들어간다. */
  private coseKey(): Buffer {
    const map = new Map<number, number | Uint8Array>();
    map.set(COSEKEYS.kty, COSEKTY.OKP);
    map.set(COSEKEYS.alg, COSEALG.EdDSA);
    map.set(COSEKEYS.crv, COSECRV.ED25519);
    map.set(COSEKEYS.x, new Uint8Array(this.publicKeyRaw));
    return Buffer.from(isoCBOR.encode(map));
  }

  private authenticatorData(opts: {
    includeAttested: boolean;
    uv: boolean;
  }): Buffer {
    const rpIdHash = sha256(Buffer.from(RP_ID, 'utf8'));
    let flags = FLAG_UP;
    if (opts.uv) flags |= FLAG_UV;
    if (opts.includeAttested) flags |= FLAG_AT;
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32BE(this.signCount);

    if (!opts.includeAttested) {
      return Buffer.concat([rpIdHash, Buffer.from([flags]), counterBuf]);
    }
    const credIdLen = Buffer.alloc(2);
    credIdLen.writeUInt16BE(this.credentialId.length);
    return Buffer.concat([
      rpIdHash,
      Buffer.from([flags]),
      counterBuf,
      this.aaguid,
      credIdLen,
      this.credentialId,
      this.coseKey(),
    ]);
  }

  private clientDataJSON(type: string, challenge: string): Buffer {
    return Buffer.from(
      JSON.stringify({
        type,
        challenge,
        origin: RP_ORIGIN,
        crossOrigin: false,
      }),
      'utf8',
    );
  }

  /** navigator.credentials.create() 결과(RegistrationResponseJSON) 합성. */
  registrationResponse(challenge: string, opts: { uv?: boolean } = {}) {
    const uv = opts.uv ?? true; // 정책: requireUserVerification: true
    const clientData = this.clientDataJSON('webauthn.create', challenge);
    const authData = this.authenticatorData({ includeAttested: true, uv });
    const attMap = new Map<string, string | Map<never, never> | Uint8Array>();
    attMap.set('fmt', 'none');
    attMap.set('attStmt', new Map<never, never>());
    attMap.set('authData', new Uint8Array(authData));
    const attestationObject = Buffer.from(isoCBOR.encode(attMap));
    return {
      id: this.credentialIdB64Url,
      rawId: this.credentialIdB64Url,
      type: 'public-key' as const,
      response: {
        clientDataJSON: b64u(clientData),
        attestationObject: b64u(attestationObject),
        transports: ['internal'],
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform' as const,
    };
  }

  /**
   * navigator.credentials.get() 결과(AuthenticationResponseJSON) 합성.
   *  - bumpCounter:false → counter 를 올리지 않아 DB 가 기대하는 값과 같거나 낮음 → 역행.
   *  - uv:false → User Verified 플래그 미설정 → requireUserVerification:true 정책상 실패.
   */
  authenticationResponse(
    challenge: string,
    opts: { uv?: boolean; bumpCounter?: boolean } = {},
  ) {
    const uv = opts.uv ?? true;
    const bumpCounter = opts.bumpCounter ?? true;
    if (bumpCounter) this.signCount += 1;

    const clientData = this.clientDataJSON('webauthn.get', challenge);
    const authData = this.authenticatorData({ includeAttested: false, uv });
    const signature = crypto.sign(
      null, // Ed25519 → algorithm 은 null
      Buffer.concat([authData, sha256(clientData)]),
      this.privateKey,
    );
    return {
      id: this.credentialIdB64Url,
      rawId: this.credentialIdB64Url,
      type: 'public-key' as const,
      response: {
        clientDataJSON: b64u(clientData),
        authenticatorData: b64u(authData),
        signature: b64u(signature),
        userHandle: b64u(Buffer.from('e2e-user')),
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform' as const,
    };
  }
}

// ---------------------------------------------------------------------------
// HTTP ceremony 헬퍼 — 각 시나리오의 보일러플레이트 축약.
// ---------------------------------------------------------------------------

interface RegisterResult {
  credentialUuid: string;
  webauthnRecoveryCodes: string[];
}

/**
 * 등록 ceremony 한 번: options 발급 → 디바이스 attestation 합성 → verify.
 * 첫 등록이면 복구 코드 10개가 함께 반환된다.
 */
export async function registerDevice(
  baseUrl: string,
  accessToken: string,
  device: SoftWebAuthnDevice,
  deviceName = 'e2e-key',
): Promise<RegisterResult> {
  const optionsRes = await request(baseUrl)
    .post('/api/auth/2fa/webauthn/register/options')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({});
  if (optionsRes.status !== 200) {
    throw new Error(
      `register/options failed: ${optionsRes.status} ${JSON.stringify(optionsRes.body)}`,
    );
  }
  const { publicKey, optionsToken } = optionsRes.body.data as {
    publicKey: { challenge: string };
    optionsToken: string;
  };

  const verifyRes = await request(baseUrl)
    .post('/api/auth/2fa/webauthn/register/verify')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      optionsToken,
      response: device.registrationResponse(publicKey.challenge),
      deviceName,
    });
  if (verifyRes.status !== 200) {
    throw new Error(
      `register/verify failed: ${verifyRes.status} ${JSON.stringify(verifyRes.body)}`,
    );
  }
  return verifyRes.body.data as RegisterResult;
}

/** `/auth/login` → WebAuthn 분기 challengeToken 회수. */
export async function loginForWebauthnChallenge(
  baseUrl: string,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(baseUrl)
    .post('/api/auth/login')
    .send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const body = res.body.data as {
    requires2fa?: boolean;
    methods?: string[];
    challengeToken?: string;
  };
  if (!body.requires2fa || !body.challengeToken) {
    throw new Error(`login did not require 2fa: ${JSON.stringify(body)}`);
  }
  if (!body.methods?.includes('webauthn')) {
    throw new Error(`login method not webauthn: ${JSON.stringify(body)}`);
  }
  return body.challengeToken;
}

/** authenticate/options 발급 — 동일 challengeToken 으로 verify 단계까지 재사용 가능. */
export async function fetchAuthOptions(
  baseUrl: string,
  challengeToken: string,
): Promise<{ challenge: string; optionsToken: string }> {
  const res = await request(baseUrl)
    .post('/api/auth/2fa/webauthn/authenticate/options')
    .send({ challengeToken });
  if (res.status !== 200) {
    throw new Error(
      `authenticate/options failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  const { publicKey, optionsToken } = res.body.data as {
    publicKey: { challenge: string };
    optionsToken: string;
  };
  return { challenge: publicKey.challenge, optionsToken };
}
