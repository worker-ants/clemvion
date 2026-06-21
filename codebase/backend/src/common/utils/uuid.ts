/**
 * UUID v1–v5 형식 검증. `background:run:<id>` / `execution:<id>` 등 UUID 가 식별자인
 * 채널 가드에서 임의 문자열이 DB 쿼리로 전달되는 것을 방어(채널 구독 비-UUID 선차단). 빈 문자열 / 비-UUID
 * 형식이면 false.
 *
 * refactor 02 M-7: 옛 `websocket.gateway.ts` 의 로컬 함수를 channel authorizer 들이 공유하도록
 * shared util 로 승격(authorizer 가 각 도메인 모듈로 분리되며 gateway 로컬 함수를 못 씀).
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
