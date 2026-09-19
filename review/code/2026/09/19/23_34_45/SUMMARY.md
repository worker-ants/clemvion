# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건은 모두 "이번 PR 이 새로 확장한 컴파일타임 계약(`IntegrationTestResultCode`)이 감싸는 런타임 분기 일부가 여전히 테스트로 고정되지 않았다"는 동일 축의 문제(MakeShop `pingConnection` 런타임 테스트 0건, 타입 계약 테스트가 `TestGateCode` 를 누락)다. 나머지는 대부분 순수 리팩터로 확인된 INFO. forced 화이트리스트(7명) 전원 결과 확보됨 — 강제 항목 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | MakeShop `pingConnection`/`mapPingError` 는 저장소 전체에서 런타임 테스트가 0건 — 이번 PR 이 `MakeshopPingCode` 를 `IntegrationTestResultCode` union 에 편입시켰음에도, 형제 구현인 Cafe24(`cafe24-api.client.spec.ts` 가 4개 코드 분기 전부 리터럴로 고정)와 달리 대칭 테스트가 없다 | `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` (`mapPingError`, `pingConnection`); 대응 spec 파일 매치 0건 | `makeshop-api.client.spec.ts` 에 `describe('pingConnection')` 추가 — `MAKESHOP_AUTH_FAILED`(401/403) · `MAKESHOP_TRANSPORT_FAILED`(네트워크 실패/catch-all) · `INTEGRATION_INCOMPLETE`(자격증명 누락) 세 분기를 리터럴로 고정. 범위 밖이면 plan "테스트 빈칸" 목록에 4번째 항목으로 등재 |
| 2 | Testing | 신설된 타입 수준 계약 테스트(`connection-test-codes.spec.ts`)의 `accepted` 배열이 `IntegrationTestResultCode` 를 구성하는 6개 부분 union 중 `TestGateCode`(`INTEGRATION_CREDENTIALS_UNREADABLE`) 하나를 빠뜨렸고, 그 런타임 반환 분기(`IntegrationsService.testConnection` 의 `isUnreadableCredentials` 분기)도 유닛 테스트에서 전혀 검증되지 않는다 — 타입 테스트·유닛 테스트 어느 쪽도 고정하지 않는 유일한 생산자 | `codebase/backend/src/modules/integrations/connection-test-codes.spec.ts` (`accepted` 배열); `codebase/backend/src/modules/integrations/integrations.service.ts:965` (`INTEGRATION_CREDENTIALS_UNREADABLE` 반환); `integrations.service.spec.ts` `describe('testConnection')` (583~746행, unreadable 분기 매치 0) | (1) `accepted` 배열에 `{ code: 'INTEGRATION_CREDENTIALS_UNREADABLE' }` 추가. (2) `integrations.service.spec.ts` 에 credentials unreadable → `INTEGRATION_CREDENTIALS_UNREADABLE` 반환 유닛 테스트 1건 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Documentation | spec `4-integration.md` §5.3 결과 목록·§14.1 vocabulary 표가 HTTP 연결 테스트의 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` 반환 가능성을 여전히 누락 — 코드는 정확(둘 다 `IntegrationTestResultCode` 에 포함)하고 spec 서술만 비어 있음. 이번 PR 이 만든 갭이 아니라 이미 이번 세션의 `--impl-prep`(`review/consistency/2026/09/19/23_02_33`)에서 WARNING 으로 잡혀 별도 planner 턴으로 인계된 기존 항목 | `spec/2-navigation/4-integration.md` §5.3(451행 부근), §14.1(1092행 부근) | 조치 불필요(이미 등재됨). 후속 planner 턴에서 두 코드를 §5.3 결과 목록 끝과 §14.1 표에 추가 |
| 2 | Documentation | `TestConnectionResultDto.code`(Swagger 응답 DTO) 의 JSDoc 예시 목록이 새 정본 union(`IntegrationTestResultCode`)을 인용하지 않고, `CAFE24_*`/`MAKESHOP_*` 계열도 예시에서 빠져 있음 | `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:479-484` | 선택 사항(스코프 밖). 여유 있으면 JSDoc 에 `{@link IntegrationTestResultCode}` 참조 한 줄 추가 |
| 3 | Maintainability | `TestGateCode`(게이트 코드 2건, `INTEGRATION_CREDENTIALS_UNREADABLE`/`INTEGRATION_INCOMPLETE`)만 상수화 대상에서 빠져 리터럴 문자열로 남아, 같은 파일 안에서 "상수를 쓰는 코드"와 "리터럴을 쓰는 코드" 스타일이 공존 | `codebase/backend/src/modules/integrations/connection-test-codes.ts` (`TestGateCode` 정의부); 사용처 `integrations.service.ts` (965·978행 부근) | 필수 아님(호출부 1곳뿐, 오타 위험 낮음). `TestGateCode` 정의부 주석에 "단일 호출부라 상수화 생략" 한 줄 남기면 반복 지적 방지 |
| 4 | Maintainability | `database-driver-sockets.spec.ts` 의 두 신규 `try/finally` 소켓 정리 블록이 구조적으로 거의 동일 — 정리 로직 변경 시 두 곳을 동시에 고쳐야 함 | `codebase/backend/src/modules/integrations/database-driver-sockets.spec.ts` (pg/mysql2 두 `it` 블록) | 선택 사항. 로컬 헬퍼(예: `const destroySocket = (s) => s?.destroy?.();`)로 `finally` 절 추출 시 중복 감소 |
| 5 | Testing | 타입 수준 계약 테스트(`connection-test-codes.spec.ts`)는 jest 실행 시 항상 no-op — 주석으로 "강제하는 것은 tsc" 임을 명시해 두었으나, jest 만 도는 부분 재실행 워크플로에서는 "테스트 통과=안전" 이라는 착시를 줄 수 있음 | `codebase/backend/src/modules/integrations/connection-test-codes.spec.ts` (`it('타입 수준 계약 (런타임 no-op)')`) | 이번 diff 범위 밖. CI 에서 `check-backend-typecheck-ratchet.py` 가 별도로 반드시 도는지 재확인 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 리팩터, 런타임 동작·에러 노출·인가 로직 불변. 신규 취약점 없음. 추가된 SSL/소켓 테스트는 오히려 SSRF/TLS 회귀 커버리지 개선 |
| requirement | NONE | plan "할 것" 3항목과 diff 1:1 대응, 코드-spec vocabulary line-level 일치 확인(`tsc` 재현 검증 포함). 유일한 갭은 기존 추적 중인 spec 서술 공백(INFO) |
| scope | NONE | plan 이 선언한 범위와 정확히 1:1, 문자열 값 불변 확인. 범위 이탈·불필요한 리팩토링 없음 |
| side_effect | NONE | 타입 좁히기는 컴파일타임 전용, 와이어 값·DTO 계약 불변. 신규 전역상태/네트워크 부작용 없음 |
| maintainability | NONE | 함수 길이·복잡도 문제 없음. `TestGateCode` 상수화 누락·테스트 중복은 사소한 INFO |
| testing | LOW | WARNING 2건 — MakeShop `pingConnection` 런타임 테스트 0건, 타입 계약 테스트가 `TestGateCode` 누락(대응 런타임 분기도 미검증). 신규 rotate 404·SSL 매핑 테스트는 양질 |
| documentation | LOW | 핵심 diff 파일 주석/JSDoc 품질 우수, 오래된 참조 없음. 남은 갭은 기존 spec 공백(INFO, 이미 등재) |

## 발견 없는 에이전트

없음 — 7개 forced 에이전트 전원이 최소 INFO 이상을 보고했음(단, 대부분 "조치 불필요" 확인성 INFO이며 CRITICAL 은 전무).

## 권장 조치사항

1. (WARNING #1) `makeshop-api.client.spec.ts` 에 `pingConnection` 런타임 테스트(`MAKESHOP_AUTH_FAILED`/`MAKESHOP_TRANSPORT_FAILED`/`INTEGRATION_INCOMPLETE` 3분기) 추가 — Cafe24 와의 테스트 비대칭 해소.
2. (WARNING #2) `connection-test-codes.spec.ts` 의 `accepted` 배열에 `INTEGRATION_CREDENTIALS_UNREADABLE` 추가 + `integrations.service.spec.ts` 에 해당 런타임 분기 유닛 테스트 1건 추가 — 6개 부분 union 전원 최소 1회 커버.
3. (INFO #1, 이미 등재) 별도 planner 턴에서 `spec/2-navigation/4-integration.md` §5.3/§14.1 에 HTTP `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` 서술 추가.
4. (INFO #2~#5, 선택) 여유 있을 때 `TestConnectionResultDto` JSDoc 링크 보강, `TestGateCode` 비상수화 사유 주석, `database-driver-sockets.spec.ts` finally 헬퍼 추출, CI 의 typecheck ratchet 실행 여부 재확인.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — forced 전원 결과 확보됨(미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단상 이번 diff(타입 리팩터+테스트 보강)와 무관 (개별 사유 미제공) |
  | architecture | 상동 |
  | dependency | 상동 — 신규 의존성 추가 없음과 일치 |
  | database | 상동 — DB 스키마/쿼리 변경 없음과 일치 |
  | concurrency | 상동 |
  | api_contract | 상동 — 공개 DTO(`TestConnectionResultDto.code`) 타입 불변과 일치 |
  | user_guide_sync | 상동 — 사용자 대면 동작 변경 없음과 일치 |
