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
    // `token` 계열 — bare `token` 만 있고 접두형이 전부 빠져 있었다(2026-08-16 실측:
    // `csrf_token`·`auth_token`·`session_token`·`csrfToken` 평문 통과). EIA 쪽 두 목록은
    // 같은 라운드에 계열째 닫혔고 이 목록만 남아 **비대칭**이었다.
    //
    // 이 목록은 **키 이름 완전 일치**라 계열을 정규식처럼 못 접는다 — 자매
    // `CREDENTIAL_KEY_PATTERN` 의 `[a-z0-9_-]*token` 과 달리 항목을 손으로 편다.
    // 새 접두형을 만나면 여기에 더한다.
    //
    // **blast radius 를 실측했다 — 다만 정적 grep 이 닿는 범위까지다**
    // (`16_46_56` side_effect W1 → `17_14_18` W1 이 그 한계를 짚었다). 이 상수는
    // `handler-output.adapter.ts` 도 쓰고, 그쪽은 노드 `config` echo 를 DB·WS·표현식으로
    // 내보낸다 — 비-자격증명 config 필드가 이 이름들과 겹치면 멀쩡한 값이 가려진다.
    //
    // **잰 것**: 노드 소스의 **정적 config 필드명** 전수 grep → 충돌 0건. 정확 일치 후보는
    // `http-request.handler.ts` 의 `auth_token` 하나뿐인데 그건 **URL 쿼리파라미터**
    // 블랙리스트라 목적이 다르다. `oauth_token_exchange_failed` 류는 부분 문자열일 뿐이고
    // 이 목록은 완전 일치라 안 걸린다.
    //
    // **못 잰 것 (정적 분석으로는 원리적으로 못 닫는다)**: HTTP Request · Send Email 노드의
    // `headers`/`body` 는 **사용자가 키 이름을 직접 정한다**. 사용자가 `headers.id_token` 을
    // 쓰면 그 값이 config echo 에서 가려진다. 방향이 **과잉 마스킹(안전 쪽)** 이라 유출은
    // 아니고, 이 노출은 **신규가 아니다** — 이미 목록에 있던 `token`·`access_token`·
    // `authorization`·`apiKey` 가 같은 성질을 갖는다. 이번 확장은 접두형으로 넓혔을 뿐
    // 클래스를 새로 만들지 않았다.
    //
    // 넓힐 때 **같은 실측을 다시 하되, 이 한계도 같이 기억해라** — 위험은 목록 자체가
    // 아니라 *자매 표면이 내보내는 키 이름과 겹치는지*이고, 그중 사용자 정의 키는
    // grep 으로 안 보인다.
    'csrfToken',
    'csrf_token',
    'authToken',
    'auth_token',
    'sessionToken',
    'session_token',
    'idToken',
    'id_token',
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
