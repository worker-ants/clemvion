/**
 * 워크스페이스 UUID 픽스처 — `X-Workspace-Id` 헤더와 토큰 클레임 경로를 검증하는 세
 * 스위트가 공유한다 (`common/decorators/workspace.decorator.spec.ts` ·
 * `common/guards/roles.guard.spec.ts` · `common/utils/workspace-context.util.spec.ts`).
 *
 * ## 왜 실제 형태의 UUID 인가
 *
 * `X-Workspace-Id` 는 Postgres `uuid` 컬럼으로 흘러가므로 `'ws1'`·`'header-id'` 같은 임의
 * 문자열은 프로덕션에서 존재할 수 없는 값이다. `#1108` 이 헤더 형식 검증(`isUuidShaped`,
 * `common/utils/workspace-context.util.ts`)을 붙이자 그런 픽스처들이 일제히 400 을 받았다
 * — 구현이 아니라 픽스처가 틀렸던 것이다.
 *
 * ## 왜 공용 모듈인가
 *
 * 세 스위트가 사실상 같은 값들을 **각자 다른 이름으로** 선언하고 있었다: 같은 UUID 가
 * 한쪽에서 `OTHER_WS`, 다른 쪽에서 `VICTIM_WS` 였고 `DECOY_WS` 는 파일마다 값이 달랐다.
 * 헤더 vs 토큰이 이 결함 클래스(`#1103` cross-tenant)의 축이므로 어휘를 한 곳에 고정한다.
 * **이름은 역할이고 값은 불투명하다** — 테스트가 의존하는 것은 값 자체가 아니라 서로
 * 다르다는 사실뿐이라, 파일 간 값이 어긋나던 것은 무의미한 차이였다.
 *
 * jest 타입 비의존 — build tsc 가 `__test-utils__` 를 컴파일하므로 의도적으로 상수만 둔다
 * (`modules/integrations/__test-utils__` 와 같은 관례).
 */

/** 클라이언트가 보낸 `X-Workspace-Id`. 서버가 서명하지 않은 **무검증** 입력이다. */
export const HEADER_WS = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';

/**
 * `jwt.strategy` 가 **멤버십 검증 후** 채운 `request.user.workspaceId` — 즉 "내"
 * 워크스페이스라 이 값만 쓰는 경로는 재검증이 불요하다.
 * (종전 `roles.guard.spec.ts` 의 `OWN_WS` 가 같은 역할이었다.)
 */
export const TOKEN_WS = 'bbbbbbbb-2222-4222-9222-bbbbbbbbbbbb';

/** 헤더로 노리는 **남의** 워크스페이스 — 호출자가 멤버가 아닌 쪽. */
export const VICTIM_WS = 'cccccccc-3333-4333-a333-cccccccccccc';

/** 멤버이긴 하나 토큰이 확정한 곳과는 다른 제3의 워크스페이스 (정당한 헤더 전환). */
export const OTHER_WS = 'dddddddd-4444-4444-b444-dddddddddddd';

/** 중복 헤더(배열)의 **두 번째** 값 — 정규화가 첫 값을 고르므로 채택되면 안 되는 쪽. */
export const DECOY_WS = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee';

/** 헤더와 토큰 클레임이 **같은 값**인 시나리오용. */
export const SAME_WS = 'ffffffff-6666-4666-9666-ffffffffffff';

/**
 * nil UUID. **형식은 유효하다** — Postgres 가 정상 파싱하므로 헤더 검증을 통과해야 하고,
 * 여기서 400 을 내면 "그 워크스페이스의 멤버가 아니다"(403)여야 할 응답이 "요청이
 * 잘못됐다"(400)로 뒤바뀐다. 술어를 `isValidUuid`(RFC 버전·variant 검사)가 아니라
 * `isUuidShaped` 로 고른 이유가 이것이며, `test/system-status.e2e-spec.ts` 가 실제로
 * 이 값을 타 워크스페이스 프로브로 쓴다.
 */
export const NIL_WS = '00000000-0000-0000-0000-000000000000';
