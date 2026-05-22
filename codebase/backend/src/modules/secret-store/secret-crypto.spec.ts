import { randomBytes } from 'crypto';
import { decryptSecret, encryptSecret, parseMasterKey } from './secret-crypto';

describe('secret-crypto', () => {
  const validKey = randomBytes(32).toString('hex'); // 64-char hex

  describe('parseMasterKey', () => {
    it('정상 — 64-char hex', () => {
      const buf = parseMasterKey(validKey);
      expect(buf.length).toBe(32);
    });

    it('실패 — empty', () => {
      expect(() => parseMasterKey('')).toThrow(/ENCRYPTION_KEY is not set/);
    });

    it('정상 — 비 hex 임의 문자열은 SHA-256 derive 로 32 byte', () => {
      const buf = parseMasterKey('not-hex-passphrase');
      expect(buf.length).toBe(32);
    });

    it('정상 — 32-char hex 도 SHA-256 derive 경로로 (정확 64자 아니므로)', () => {
      const buf = parseMasterKey('0123456789abcdef0123456789abcdef');
      expect(buf.length).toBe(32);
    });

    it('정상 — 같은 입력 → 같은 derived 키 (deterministic)', () => {
      const a = parseMasterKey('any-passphrase');
      const b = parseMasterKey('any-passphrase');
      expect(a.equals(b)).toBe(true);
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('정상 — 일반 plaintext', () => {
      const key = parseMasterKey(validKey);
      const ref = 'secret://triggers/abc/bot-token';
      const plaintext = '1234567890:AAAAA-BBBBB-CCCCC';
      const envelope = encryptSecret(key, ref, plaintext);
      expect(decryptSecret(key, ref, envelope)).toBe(plaintext);
    });

    it('정상 — UTF-8 다국어', () => {
      const key = parseMasterKey(validKey);
      const ref = 'secret://triggers/abc/note';
      const plaintext = '한글 + ☃️ + 中文';
      const envelope = encryptSecret(key, ref, plaintext);
      expect(decryptSecret(key, ref, envelope)).toBe(plaintext);
    });

    it('정상 — 매번 다른 IV (nonce 재사용 금지)', () => {
      const key = parseMasterKey(validKey);
      const ref = 'secret://triggers/abc/bot-token';
      const e1 = encryptSecret(key, ref, 'same');
      const e2 = encryptSecret(key, ref, 'same');
      expect(e1.equals(e2)).toBe(false);
      // IV 12B prefix 가 달라야 함.
      expect(e1.subarray(0, 12).equals(e2.subarray(0, 12))).toBe(false);
    });

    it('실패 — AAD mismatch (cross-row 교체 공격)', () => {
      const key = parseMasterKey(validKey);
      const refA = 'secret://triggers/abc/bot-token';
      const refB = 'secret://triggers/xyz/bot-token';
      const envelope = encryptSecret(key, refA, 'tokenA');
      expect(() => decryptSecret(key, refB, envelope)).toThrow();
    });

    it('실패 — 다른 키로 복호화', () => {
      const k1 = parseMasterKey(validKey);
      const k2 = parseMasterKey(randomBytes(32).toString('hex'));
      const ref = 'secret://triggers/abc/bot-token';
      const envelope = encryptSecret(k1, ref, 'plain');
      expect(() => decryptSecret(k2, ref, envelope)).toThrow();
    });

    it('실패 — envelope 변조 (authTag 검증)', () => {
      const key = parseMasterKey(validKey);
      const ref = 'secret://triggers/abc/bot-token';
      const envelope = encryptSecret(key, ref, 'plain');
      // ciphertext 1바이트 변조.
      envelope[envelope.length - 17] ^= 0xff;
      expect(() => decryptSecret(key, ref, envelope)).toThrow();
    });

    it('실패 — envelope 길이 부족', () => {
      const key = parseMasterKey(validKey);
      expect(() =>
        decryptSecret(key, 'secret://a/b/c', Buffer.alloc(5)),
      ).toThrow(/길이 위반/);
    });
  });
});
