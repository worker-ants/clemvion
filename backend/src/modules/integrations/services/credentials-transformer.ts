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
 *
 * **Non-throwing contract**: `decryptJson()` never throws. On any failure
 * (auth tag mismatch, invalid base64, truncated envelope, JSON.parse error,
 * missing key for an encrypted value, …) it returns the {@link UNREADABLE_SENTINEL}
 * — an empty object carrying `__unreadable: true`. Callers identify it via
 * {@link isUnreadableCredentials}. This keeps single-row corruption from
 * killing whole list endpoints; the service layer surfaces the row as
 * `credentialsStatus: 'needs_reauth'` so the user can reconnect.
 */
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const VERSION = 0x01;
const ENVELOPE_PREFIX = 'enc:v1:';

/** Sentinel marker key. `__` prefix keeps it from colliding with real OAuth / API-key fields. */
export const UNREADABLE_KEY = '__unreadable' as const;
/**
 * Original stored value preserved on the sentinel so that an unrelated
 * `save()` (status reset, name update, …) round-trips the row unchanged
 * rather than destructively re-encrypting the sentinel marker itself.
 */
export const UNREADABLE_ORIGINAL_KEY = '__original_ciphertext' as const;

let warnedMissingKey = false;
let warnedUnreadable = false;

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

function unreadable(original?: unknown): Record<string, unknown> {
  if (!warnedUnreadable) {
    console.warn(
      '[integrations] decryptJson failed for a stored credential — surfacing as needs_reauth. Further occurrences suppressed.',
    );
    warnedUnreadable = true;
  }
  const sentinel: Record<string, unknown> = { [UNREADABLE_KEY]: true };
  if (original !== undefined) {
    sentinel[UNREADABLE_ORIGINAL_KEY] = original;
  }
  return sentinel;
}

export function isUnreadableCredentials(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>)[UNREADABLE_KEY] === true
  );
}

export function encryptJson(value: unknown): string {
  // If the runtime value is a sentinel returned from a previous failed
  // decryption, preserve the original stored string verbatim. Encrypting the
  // sentinel marker would permanently destroy any chance of recovering the
  // row when the operator restores the original key.
  if (isUnreadableCredentials(value)) {
    const original = (value as Record<string, unknown>)[
      UNREADABLE_ORIGINAL_KEY
    ];
    if (typeof original === 'string') return original;
    // Defensive: fallback to plain JSON if the original was non-string (e.g.
    // a JSONB object). Loss of the sentinel marker on this rare path is
    // preferable to corrupting the stored shape.
    if (original !== undefined) return JSON.stringify(original);
  }

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
      return unreadable(stored) as T;
    }
  }

  const key = getKey();
  if (!key) return unreadable() as T;

  let envelope: Buffer;
  try {
    envelope = Buffer.from(stored.slice(ENVELOPE_PREFIX.length), 'base64');
  } catch {
    return unreadable(stored) as T;
  }
  if (envelope.length < 1 + IV_LEN + TAG_LEN) return unreadable() as T;
  const version = envelope[0];
  if (version !== VERSION) return unreadable() as T;
  const iv = envelope.subarray(1, 1 + IV_LEN);
  const tag = envelope.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ciphertext = envelope.subarray(1 + IV_LEN + TAG_LEN);

  let plain: Buffer;
  try {
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return unreadable(stored) as T;
  }

  try {
    return JSON.parse(plain.toString('utf8')) as T;
  } catch {
    return unreadable(stored) as T;
  }
}

/**
 * TypeORM transformer for JSONB columns that hold secret material.
 *
 * On write: emits a tagged base64 envelope string. Postgres JSONB will store
 * that as a JSON string value, so the column still reads back through this
 * transformer regardless of underlying encoding.
 * On read: decrypts, falls back to legacy plaintext, or returns the
 * {@link UNREADABLE_KEY} sentinel object on any decryption failure.
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
