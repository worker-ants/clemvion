/**
 * Remove likely-sensitive values from an arbitrary config object before we
 * ship it to an external LLM. Keys matching the SECRET_KEY_PATTERN anywhere
 * in the nested structure are replaced with a literal marker. Node configs
 * can legitimately reference integrations by id or expressions like
 * `{{ $integration.apiKey }}`; those are fine — we only strip actual
 * credential strings / values users may have pasted directly into a field.
 */
const SECRET_KEY_PATTERN =
  /(api[_-]?key|secret|password|passwd|pwd|token|bearer|authorization|credential|private[_-]?key|client[_-]?secret)/i;
const REDACTED = '[REDACTED]';

export function redactConfig<T>(value: T): T {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactConfig(v)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(k) && typeof v === 'string' && v.length > 0) {
        // keep expressions like "{{ ... }}" readable because they aren't
        // actual secrets — they'll be resolved server-side at runtime.
        out[k] = v.includes('{{') ? v : REDACTED;
      } else {
        out[k] = redactConfig(v);
      }
    }
    return out as T;
  }
  return value;
}
