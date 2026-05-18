/**
 * 테스트 전용 JWT 빌더 — header.payload.signature 3 segment, base64url.
 *
 * `parseJwtExp` 동작 검증 용도. signature 검증은 production code 가 하지
 * 않으므로 더미 segment 만 채운다.
 *
 * 본 helper 는 세 spec 파일 (`jwt-exp.spec.ts`, `integration-oauth.service
 * .cafe24.spec.ts`, `cafe24-api.client.spec.ts`) 이 동일 구현을 중복하던
 * 것을 ai-review (2026-05-18) W2 조치로 단일 export 로 통일한 결과.
 *
 * spec/2-navigation/4-integration.md ## Rationale "Cafe24 token 만료 SoT —
 * JWT exp 격상 (2026-05-18)".
 */
export function makeFakeJwt(payload: unknown): string {
  const b64 = (input: string): string =>
    Buffer.from(input, 'utf8')
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const header = b64('{"alg":"RS256","typ":"JWT"}');
  const body = b64(JSON.stringify(payload));
  return `${header}.${body}.sig-not-verified`;
}

/**
 * base64url 인코딩. JWT segment 수동 조립이 필요한 negative-case 테스트
 * (segment 개수 오류, base64 손상, payload non-object 등) 에서 사용.
 */
export function base64url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
