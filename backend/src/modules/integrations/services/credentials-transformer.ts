import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { ValueTransformer } from 'typeorm';

/**
 * AES-256-GCM ValueTransformer for sensitive JSONB credentials.
 * Stored format (base64 of): version(1B) || iv(12B) || authTag(16B) || ciphertext
 * Falls back to passthrough when INTEGRATION_ENCRYPTION_KEY is absent in dev,
 * but logs a warning once per process.
 */
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const VERSION = 0x01;
const ENVELOPE_PREFIX = 'enc:v1:';

let warnedMissingKey = false;

function getKey(): Buffer | null {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) {
    if (!warnedMissingKey) {
      console.warn(
        '[integrations] INTEGRATION_ENCRYPTION_KEY is not set — credentials are stored unencrypted. Set a 32+ byte secret for production.',
      );
      warnedMissingKey = true;
    }
    return null;
  }
  // Accept raw string and derive a 32-byte key via SHA-256 to tolerate any length.
  return createHash('sha256').update(raw).digest();
}

export function encryptJson(value: unknown): string {
  const key = getKey();
  const json = JSON.stringify(value ?? null);
  if (!key) return json;

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(json, 'utf8')),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const envelope = Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext]);
  return ENVELOPE_PREFIX + envelope.toString('base64');
}

export function decryptJson<T = unknown>(stored: unknown): T | null {
  if (stored === null || stored === undefined) return null;

  // Plaintext JSON object (when key was absent at write-time, or legacy rows)
  if (typeof stored === 'object') return stored as T;

  if (typeof stored !== 'string') return null;

  if (!stored.startsWith(ENVELOPE_PREFIX)) {
    // Legacy / dev plaintext: stored as JSON string in a jsonb column
    try {
      return JSON.parse(stored) as T;
    } catch {
      return null;
    }
  }

  const key = getKey();
  if (!key) return null;

  const envelope = Buffer.from(stored.slice(ENVELOPE_PREFIX.length), 'base64');
  if (envelope.length < 1 + IV_LEN + TAG_LEN) return null;
  const version = envelope[0];
  if (version !== VERSION) return null;
  const iv = envelope.subarray(1, 1 + IV_LEN);
  const tag = envelope.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ciphertext = envelope.subarray(1 + IV_LEN + TAG_LEN);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as T;
}

/**
 * TypeORM transformer for JSONB columns that hold secret material.
 *
 * On write: emits a tagged base64 envelope string. Postgres JSONB will store
 * that as a JSON string value, so the column still reads back through this
 * transformer regardless of underlying encoding.
 * On read: decrypts or falls back to legacy plaintext.
 */
export const encryptedJsonTransformer: ValueTransformer = {
  to(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    return encryptJson(value);
  },
  from(stored: unknown): unknown {
    return decryptJson(stored);
  },
};
