/**
 * JWT `exp` claim 을 epoch ms 로 반환. signature 검증 안 함.
 *
 * **왜 검증 없이 디코드만 하는가:** 본 helper 의 용도는 *우리가 받은 토큰의
 * 만료 시각 metadata 추출* 이지 위조 방어가 아니다. 토큰 진위는 Cafe24 API
 * 가 호출 시점에 자체 검증한다 — 우리가 위조 토큰을 받아도 Cafe24 가 호출
 * 직후 401 로 거부하므로 보안 침해 경로 없음. 또한 Cafe24 의 JWT public
 * key 가 공개되지 않은 것으로 알려져 있어 구조적으로 검증 불가.
 *
 * **왜 직접 base64url 디코드 하는가:** `@nestjs/jwt` 의 `decode` 도 동일
 * 동작을 하지만 그 lib 은 nest DI 컨테이너 안에서만 의미가 있고, 본 helper
 * 는 OAuth normalizer 와 refresh path 양쪽에서 순수 함수로 호출되므로 DI
 * 의존성 없는 단일 함수가 적합. Node 의 `Buffer.from(str, 'base64url')` 가
 * base64url 디코드를 표준 지원하므로 한 줄로 구현 가능.
 *
 * **반환 규약:**
 * - 정상 JWT + exp 가 양의 finite number → `exp * 1000` (epoch ms)
 * - 그 외 (비-JWT, payload object 가 아님, exp 누락, exp 비-숫자, exp ≤ 0,
 *   exp NaN/Infinity, JSON 파싱 오류, base64 오류) → `null`
 *
 * caller 는 null 을 받으면 fallback chain (예: `expires_in` → `expires_at`
 * ISO → default) 으로 강하해야 한다.
 *
 * spec/2-navigation/4-integration.md ## Rationale "Cafe24 token 만료 SoT —
 * JWT exp 격상 (2026-05-18)".
 */
export function parseJwtExp(token: string | null | undefined): number | null {
  if (typeof token !== 'string' || token.length === 0) return null;
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  let payload: unknown;
  try {
    // Node 18+ 의 Buffer 는 'base64url' 인코딩을 표준 지원 (RFC 4648 §5).
    // `+` / `/` → `-` / `_` 치환 및 padding 보정이 자동.
    const payloadJson = Buffer.from(segments[1], 'base64url').toString('utf8');
    payload = JSON.parse(payloadJson);
  } catch {
    return null;
  }
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null;
  }
  const exp = (payload as Record<string, unknown>).exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0) return null;
  return exp * 1000;
}
