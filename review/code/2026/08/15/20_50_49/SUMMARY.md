# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 8개 reviewer 중 7개는 NONE(1개는 LOW), 유일하게 **testing** 이 MEDIUM 을 냈다: 신설 회귀 가드(`websocket-events.types.spec.ts`)가 CommonJS `require()` 를 통한 값 import 를 검출하지 못한다는 것을 실제 `npx jest` 프로브(5/5 GREEN, 즉 미검출)로 재현했다. 이 PR 자체의 존재 이유(#1174 재발 방지)를 정확히 비켜가는 미검출 경로이므로 낮은 위험도로 뭉개지 않는다. forced 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7개 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 회귀 가드 `valueEdgeToWebsocketService` 가 top-level `import`/`export ... from`/`import = require()` 3형태만 검사하고, 자매 함수 `moduleSpecifiersOf` 가 이미 구현한 `require()` 호출(변수 선언 initializer 형태) 검출을 재사용하지 않는다. 가드 자신의 헤더 JSDoc 이 "require() 로도 값 간선이 생긴다"고 명시하는데도 실제로는 검사 안 함. `src/modules/websocket/__probe_bare_require.ts` 에 `const { ExecutionEventType } = require('../websocket/websocket.service')` 를 넣고 `npx jest`로 실행 → 5/5 PASS(미검출) 재현. 저장소에 지역 모듈을 `require()`로 지연 로드하는 선례(`undici-dispatcher.spec.ts:32`)가 이미 있어 이론적 위험이 아니다. `import`/`export from`/별칭 오판정에 이어 **4번째로 재발**한 "식별 기준을 한 칸 좁게 잡은" 결함. | `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:112-173` (`valueEdgeToWebsocketService`) | `ts.isVariableStatement` 분기를 추가해 top-level `require('.../websocket.service')` initializer 를 값 간선으로 잡는다. 구조분해 바인딩은 프로퍼티 키(별칭 아님) 기준으로 `WebsocketService` 예외 판정. `moduleSpecifiersOf` 의 `ts.isCallExpression` 분기를 공유/재사용해 두 함수가 같은 로직을 따로 구현하지 않게 할 것. 뮤테이션 표에 "M15: 지역 모듈 bare `require()`" 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 보안 통제(`CREDENTIAL_KEY_PATTERN` 마스킹, `sanitizePayloadForWs`, `stripExternalOnlyFields`, `NotificationsChannelAuthorizer`)는 원 파일에 문자 단위로 그대로 남아 무결 — 리팩터가 보안 로직을 우회/약화시키지 않음 | `codebase/backend/src/modules/websocket/websocket.service.ts` | 조치 불필요 |
| 2 | security | `TERMINAL_SHAPE` 모듈 스코프 부활은 export 되지 않는 module-private 상수이며 파생 값이 이전과 동일 — 안전 | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` | 조치 불필요 |
| 3 | security | (범위 밖, 기존 설계) 종결 이벤트 `error` 필드는 credential-key 마스킹만 거치고 메시지 새니타이징은 거치지 않음 — 이전 라운드부터 기존 설계로 처분됨 | `execution-event-emitter.service.ts` → `WebsocketService.emitExecutionEvent` | 별도 턴에서 `TerminalErrorPayload` 채우는 모든 호출부의 `sanitizeErrorMessage` 적용 여부 전수 확인(비차단) |
| 4 | security | 신설 정적 가드(`websocket-events.types.spec.ts`)는 CI 전용 로컬 AST 분석이라 공격 표면 없음 | `websocket-events.types.spec.ts` | 조치 불필요 |
| 5 | architecture | re-export facade 가 3중 수동 동기화 지점(export 블록/타입 모듈 선언/가드의 `EXPECTED_EXPORTS`) — 이전 라운드부터 합의된 비차단 관찰 | `websocket.service.ts` export 블록, `websocket-events.types.spec.ts` `EXPECTED_EXPORTS` | 조치 불필요(합의 유지) |
| 6 | architecture | 순환 재편입 가드가 단위 테스트 계층에서 `src/` 전체(~1,230 파일)를 스캔 — lint 계층 미승격 상태로 테스트가 계속 쌓이는 구조 | `websocket-events.types.spec.ts` | 후속 PR 에서 `no-restricted-imports`/`*.arch.spec.ts` 로 승격 고려(비차단) |
| 7 | requirement | plan 문서의 re-export 개수 서술("타입 9")이 실제 구현(타입 8, 값 4=총 12)과 하나 어긋남 — 코드/가드는 서로 일치, plan 서술만 stale | `plan/in-progress/ws-event-types-extract.md` §"조치" | "타입 9"→"타입 8"로 정정(다음 plan 편집에 묶어서), 코드 변경 불요 |
| 8 | requirement | 병렬 리뷰 세션의 뮤테이션 프로브가 남긴 일시적 ENOENT 관측 — 재실행 시 5/5 GREEN, 재현 불가로 확인된 비-결함 | 해당 없음(관측 시점 FS 상태) | 조치 불필요 |
| 9 | scope | 신규(added) 파일은 3개뿐(`websocket-events.types.ts`, `.spec.ts`, plan 문서) — 스코프 확장 없음. `TERMINAL_SHAPE` 모듈 스코프 복원은 plan 이 사전 명시한 성공 기준 | 브랜치 전체 diff | 조치 불필요 |
| 10 | side_effect | `TERMINAL_SHAPE` 가 함수-지역 리터럴→모듈 스코프 공유 객체로 승격, 평가 시점이 "호출마다"→"모듈 로드 1회"로 변경 — 안전성이 "타입 모듈 import 0줄" 전제 하나에 의존(현재는 성립, 정적 가드로 고정됨). 재발 리스크는 위 testing WARNING 과 동일 계열 | `execution-event-emitter.service.ts:71,143` | 조치 불요(근거 문서화됨). 위 WARNING #1 해소가 이 리스크의 실질적 방어선 |
| 11 | maintainability | `websocket-events.types.spec.ts` 안에 "원 export 식별자 추출"(`originalName`) 로직이 함수-지역 헬퍼와 인라인 표현으로 2곳 중복 — 향후 헬퍼 수정 시 자매 지점이 안 따라갈 위험 | `websocket-events.types.spec.ts:126-127` (헬퍼), `:272` (인라인 중복) | `originalName` 을 모듈 스코프로 끌어올려 두 지점에서 공유 |
| 12 | maintainability | 파일 전수 파싱·순회 boilerplate 가 3번째·5번째 테스트에 거의 동일하게 반복(저장소 전체를 2번 독립 파싱) | `websocket-events.types.spec.ts:213-222`, `:253-281` | `collectOffenders(predicate)` 공용 순회 헬퍼로 추출(우선순위 낮음) |
| 13 | maintainability | 공허 방지 단언이 `toBeGreaterThan(N-1)` 형태로 우회 표현돼 의도가 즉시 안 읽힘 | `websocket-events.types.spec.ts:190` | `toBeGreaterThanOrEqual(EXPECTED_EXPORTS.length)` 로 교체 |
| 14 | documentation | 이전 3라운드 지적(JSDoc 고아화, 이중 블록, stale 주석, import type 누락) 전부 최종 커밋에 반영됨을 재확인 — 신규 결함 없음 | 다수 | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 통제 무결 보존, 순수 리팩터 확인 |
| architecture | NONE | 구조 변경 없음, 순환 노드 이탈 재확인 |
| requirement | NONE | plan 요구사항 충족, 문서 숫자 사소한 stale 1건 |
| scope | NONE | 스코프 이탈 없음, 신규 파일 3개뿐 |
| side_effect | LOW | `TERMINAL_SHAPE` 모듈 스코프 재평가 시점 변경 — 안전하나 전제 의존적 |
| maintainability | NONE | 테스트 코드 내 사소한 중복 3건, 기능 영향 없음 |
| testing | MEDIUM | 회귀 가드가 `require()` 값 import 를 미검출 — 실측 프로브로 재현 |
| documentation | NONE | 이전 지적 전부 반영 확인, 신규 결함 없음 |

## 발견 없는 에이전트

documentation (신규 결함 없음, 이전 지적 반영 재확인만)

## 권장 조치사항
1. **(WARNING, testing)** `websocket-events.types.spec.ts` 의 `valueEdgeToWebsocketService` 에 top-level `require()` 값 간선 검출 분기를 추가한다 — `moduleSpecifiersOf` 의 기존 `ts.isCallExpression` 로직을 재사용하고, 구조분해 바인딩은 프로퍼티 키(별칭 아님) 기준으로 판정한다. 이 PR 이 막으려는 결함(#1174)과 동일 실패 모드의 미검출 경로이므로 다음 라운드로 미루지 말고 이번에 닫는다.
2. (INFO, requirement) plan 문서의 "타입 9" → "타입 8" 표기 정정(다음 plan 편집 turn 에 묶어서, 비차단).
3. (INFO, maintainability) `originalName` 헬퍼 모듈 스코프 승격 + 파일 순회 boilerplate 공용화 — 우선순위 낮음, 기능 영향 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 누락 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위(순수 import 재배선 + 상수 스코프 변경)와 무관 |
  | dependency | 신규 외부 의존성/패키지 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | 공개 API/엔드포인트 계약 변경 없음 |
  | user_guide_sync | 사용자 대상 문서/가이드 영향 없음 |