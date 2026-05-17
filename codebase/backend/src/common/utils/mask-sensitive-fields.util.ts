const DEFAULT_SENSITIVE_KEYS: ReadonlySet<string> = new Set(
  [
    'apiKey',
    'api_key',
    'apikey',
    'password',
    'passwd',
    'token',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'secret',
    'client_secret',
    'clientSecret',
    'authorization',
  ].map((k) => k.toLowerCase()),
);

/**
 * 로깅 대상 객체에서 민감한 필드 값을 mask — `****<last4>` 형태.
 * - 중첩 객체·배열을 재귀 순회
 * - 원본 값을 변경하지 않고 얕은 복사본을 반환
 * - 문자열 외 타입은 그대로 `"****"` 로 치환 (객체·배열이 값인 경우 포함)
 *
 * 호출자는 request body·response payload 등을 로깅 직전에 이 함수로 감싸 쓴다.
 */
export function maskSensitiveFields(
  value: unknown,
  sensitiveKeys: ReadonlySet<string> = DEFAULT_SENSITIVE_KEYS,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => maskSensitiveFields(v, sensitiveKeys, seen));
  }
  if (typeof value !== 'object') return value;
  // 순환 참조 방어.
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (sensitiveKeys.has(k.toLowerCase())) {
      out[k] = maskValue(v);
    } else {
      out[k] = maskSensitiveFields(v, sensitiveKeys, seen);
    }
  }
  return out;
}

function maskValue(value: unknown): string {
  if (typeof value !== 'string') return '****';
  if (value.length <= 4) return '****';
  return `****${value.slice(-4)}`;
}
