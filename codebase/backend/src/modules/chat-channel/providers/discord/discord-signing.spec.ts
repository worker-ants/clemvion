/**
 * Discord ed25519 signature 검증 단위 테스트.
 * 실 ed25519 keypair 를 generateKeyPairSync 로 만들어 round-trip 검증.
 */
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import { verifyDiscordSignature } from './discord-signing';

function makeKeypair(): {
  publicKeyHex: string;
  sign: (data: string) => string;
} {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  // Extract raw 32-byte public key from SPKI DER (last 32 bytes).
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  const raw = spki.subarray(spki.length - 32);
  const publicKeyHex = raw.toString('hex');
  return {
    publicKeyHex,
    sign: (data: string) =>
      cryptoSign(null, Buffer.from(data, 'utf8'), privateKey).toString('hex'),
  };
}

function nowSec(offset = 0): string {
  return String(Math.floor(Date.now() / 1000) + offset);
}

describe('verifyDiscordSignature', () => {
  let kp: ReturnType<typeof makeKeypair>;
  beforeAll(() => {
    kp = makeKeypair();
  });

  it('정상 — 진짜 signature → true', () => {
    const body = '{"type":1}';
    const ts = nowSec();
    const sig = kp.sign(ts + body);
    expect(verifyDiscordSignature(body, sig, ts, kp.publicKeyHex)).toBe(true);
  });

  it('잘못된 signature (가짜 hex) → false', () => {
    const body = '{}';
    const ts = nowSec();
    const fake = 'f'.repeat(128);
    expect(verifyDiscordSignature(body, fake, ts, kp.publicKeyHex)).toBe(false);
  });

  it('body 변조 → false', () => {
    const ts = nowSec();
    const sig = kp.sign(ts + 'orig');
    expect(verifyDiscordSignature('tampered', sig, ts, kp.publicKeyHex)).toBe(
      false,
    );
  });

  it('timestamp 변조 → false', () => {
    const ts = nowSec();
    const sig = kp.sign(ts + '{}');
    expect(
      verifyDiscordSignature(
        '{}',
        sig,
        String(Number(ts) - 1),
        kp.publicKeyHex,
      ),
    ).toBe(false);
  });

  it('5분+1초 과거 → false (replay window)', () => {
    const ts = nowSec(-(5 * 60 + 1));
    const sig = kp.sign(ts + '{}');
    expect(verifyDiscordSignature('{}', sig, ts, kp.publicKeyHex)).toBe(false);
  });

  it('public key hex 가 64 chars 아님 → false', () => {
    const body = '{}';
    const ts = nowSec();
    const sig = kp.sign(ts + body);
    expect(verifyDiscordSignature(body, sig, ts, 'abc')).toBe(false);
  });

  it('signature hex 가 128 chars 아님 → false', () => {
    expect(verifyDiscordSignature('{}', 'aa', nowSec(), kp.publicKeyHex)).toBe(
      false,
    );
  });

  it('public key 가 hex 아님 → false', () => {
    expect(
      verifyDiscordSignature('{}', 'a'.repeat(128), nowSec(), 'g'.repeat(64)),
    ).toBe(false);
  });

  it('빈 필드 → false', () => {
    expect(verifyDiscordSignature('{}', '', nowSec(), kp.publicKeyHex)).toBe(
      false,
    );
    expect(
      verifyDiscordSignature('{}', 'a'.repeat(128), '', kp.publicKeyHex),
    ).toBe(false);
    expect(verifyDiscordSignature('{}', 'a'.repeat(128), nowSec(), '')).toBe(
      false,
    );
  });

  it('timestamp 가 숫자 아님 → false', () => {
    const sig = kp.sign('not-a-number{}');
    expect(
      verifyDiscordSignature('{}', sig, 'not-a-number', kp.publicKeyHex),
    ).toBe(false);
  });
});
