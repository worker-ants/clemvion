import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * Secret store 전용 AES-256-GCM 헬퍼.
 *
 * SoT: `spec/conventions/secret-store.md §3`.
 *
 * 형식: `[IV(12B) ‖ AES-256-GCM ciphertext ‖ authTag(16B)]` raw Buffer concat.
 * AAD : 호출자가 ref 문자열을 전달 — cross-row 교체 공격 차단 (SS-SE-03).
 *
 * 기존 `common/utils/crypto.util.ts` (hex 문자열 포맷, AAD 미지원) 와 별개로,
 * BYTEA 컬럼 + AAD 지원을 위한 secret store 전용 구현. 마스터키는 `ENCRYPTION_KEY` 공용.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * `ENCRYPTION_KEY` → 32-byte Buffer (AES-256 key).
 *
 * 입력 우선 순위:
 *   1. 64-char hex (정확 32 byte) → `Buffer.from(rawHex, 'hex')` 직접 사용. `.env.example` 의 표준 형식.
 *   2. 그 외 길이의 임의 문자열 → SHA-256 derive (`credentials-transformer.ts` 와 동일 패턴). e2e
 *      환경 등 32-char 등 짧은 키 호환.
 *
 * 빈 문자열 / null / undefined → fail-fast.
 *
 * caller (`SecretResolverService.onModuleInit`) 가 부팅 단계에서 fail-fast 시킨다.
 */
export function parseMasterKey(rawHex: string): Buffer {
  if (!rawHex || typeof rawHex !== 'string') {
    throw new Error(
      'ENCRYPTION_KEY is not set — secret store 사용을 위해 ENCRYPTION_KEY 환경변수가 필요합니다.',
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(rawHex)) {
    return Buffer.from(rawHex, 'hex');
  }
  // Fallback — SHA-256 으로 임의 길이 입력을 32 byte 키로 derive.
  return createHash('sha256').update(rawHex).digest();
}

/**
 * plaintext (UTF-8 string) → ciphertext envelope (Buffer).
 *
 * 매 호출 새 IV 발급 (nonce reuse 절대 금지 — SS-SE-02). AAD = `ref`.
 */
export function encryptSecret(
  key: Buffer,
  ref: string,
  plaintext: string,
): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(ref, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, tag]);
}

/**
 * envelope (Buffer) → plaintext (UTF-8 string). AAD mismatch / 길이 위반 / authTag 실패 시 throw.
 *
 * caller (`SecretResolverService.resolve`) 가 throw 를 잡아 logger 로 ref + workspaceId 만 기록
 * (plaintext 미기록 — SS-SE-05).
 */
export function decryptSecret(
  key: Buffer,
  ref: string,
  envelope: Buffer,
): string {
  if (envelope.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error(
      `secret envelope 길이 위반 — 최소 ${IV_LENGTH + TAG_LENGTH} byte 필요 (실제 ${envelope.length} byte).`,
    );
  }
  const iv = envelope.subarray(0, IV_LENGTH);
  const tag = envelope.subarray(envelope.length - TAG_LENGTH);
  const ciphertext = envelope.subarray(IV_LENGTH, envelope.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from(ref, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
