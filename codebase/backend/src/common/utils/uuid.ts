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

/**
 * canonical 8-4-4-4-12 hex 형태인지만 본다 — **버전·variant nibble 을 보지 않는다.**
 *
 * `isValidUuid` 와 목적이 다르다. 저쪽은 "우리가 발급하는 UUID(v1–v5, RFC variant)인가",
 * 이쪽은 **"Postgres 가 `uuid` 컬럼 값으로 파싱할 수 있는가"** 다. 그래서 nil UUID
 * (`00000000-…`)·v6/v7·비-RFC variant 를 **받아들인다** — Postgres 가 받아들이기 때문이다.
 *
 * 이 구분이 실제로 중요한 이유: 클라이언트가 보낸 식별자를 술어로 거를 때 `isValidUuid` 를
 * 쓰면 **DB 가 정상 조회할 수 있는 값**까지 400 으로 거부하게 되고, 그러면 "그 워크스페이스의
 * 멤버가 아니다"(403) 여야 할 응답이 "요청이 잘못됐다"(400) 로 뒤바뀐다. 실제로 이 저장소의
 * e2e 하나가 nil UUID 를 타 워크스페이스 프로브로 쓴다(`system-status.e2e-spec.ts`).
 * 반대로 Postgres 가 파싱조차 못 하는 값은 `QueryFailedError`(SQLSTATE 22P02)가 되어
 * `GlobalExceptionFilter` 의 어떤 분기에도 안 걸리고 **500 INTERNAL_ERROR 로 마스킹**된다 —
 * 클라이언트 입력 오류가 서버 오류로 보이는 것이 이 술어가 막는 것이다.
 *
 * Postgres 는 하이픈 없는 형태·중괄호 형태도 받지만 여기서는 canonical 형태만 통과시킨다.
 * 그 형태들은 이 저장소의 클라이언트가 보내지 않고, 거부해도 400(형식 오류)이라 응답이
 * 뒤바뀌지 않는다.
 */
const UUID_SHAPE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidShaped(value: string): boolean {
  return UUID_SHAPE_PATTERN.test(value);
}
