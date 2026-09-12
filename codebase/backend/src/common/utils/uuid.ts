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
 * 멤버가 아니다"(403) 여야 할 응답이 "요청이 잘못됐다"(400) 로 뒤바뀐다.
 *
 * > **앵커 정정 (2026-08-09, `#1112` 실측).** 이 문단은 원래 회귀 캐너리로
 * > `system-status.e2e-spec.ts` 의 nil-UUID 프로브를 지목했으나 **그 e2e 는 이 술어에 닿지
 * > 않는다** — `system-status.controller.ts` 에는 `@Roles()` 도 `@WorkspaceId()` 도 없어
 * > `RolesGuard` 가 `resolveRequestWorkspaceContext` 호출 이전에 통과시킨다. 결정·근거는
 * > 영향 없고 앵커만 바뀐다.
 * >
 * > **캐너리를 닫힌 목록으로 적지 않는다** — 원래 이 문단은 *"진짜 캐너리는 `uuid.spec.ts` 와
 * > `workspace-context.util.spec.ts` 둘"* 이라 단언했는데, 2026-09-13 커서 검증 배치가 소비처
 * > 둘을 더 만들면서 그 목록이 낡았다(`review/code/2026/09/13/00_13_51` documentation
 * > WARNING). 소비처와 캐너리를 세는 법은 `uuid.spec.ts` 의 docstring 이 SoT 다 — 거기 적힌
 * > grep 을 돌려라. **새 소비처를 만들면 그 자리에 캐너리도 함께 둔다**, 이 파일의 테스트
 * > 하나로는 경계가 지켜지지 않는다.
 *
 * ## 이 술어가 막는 것 — 22P02 마스킹 (소비처 공용 근거)
 *
 * Postgres 가 파싱조차 못 하는 값은 `QueryFailedError`(SQLSTATE 22P02)가 되어
 * `GlobalExceptionFilter` 의 어떤 분기에도 안 걸리고 **500 INTERNAL_ERROR 로 마스킹**된다 —
 * 클라이언트 입력 오류가 서버 오류로 보이는 것이 이 술어가 막는 것이다. 실측: 2026-09-13
 * 커서 배치가 검증을 떼고 e2e 를 돌려 **두 엔드포인트 모두 실 Postgres 에서 500 을 관측**했다.
 *
 * **필터에 22P02 → 400 분기를 넣는 안은 기각됐다** — 필터는 값의 출처를 모르는데
 * `spec/5-system/3-error-handling.md §1` 이 *"서버가 서명한 값에 400 을 내면 서버 버그를
 * 클라이언트 오류로 보고하게 된다"* 를 원칙으로 적어 두었다. 그래서 방어는 **입구마다 조기
 * 거부**이고, 이 함수가 그 술어다. 근거 전문: `plan/in-progress/keyset-cursor-uuid-validation.md §A`.
 *
 * > **호출부는 이 문단을 복제하지 말고 참조하라.** 같은 ~12줄이 세 곳에 복제돼 세 라운드 연속
 * > 지적됐다(`23_19_03` INFO#1 · `23_40_57` W4 · `00_13_51` W2). 상세 근거의 SoT 는 여기다.
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
