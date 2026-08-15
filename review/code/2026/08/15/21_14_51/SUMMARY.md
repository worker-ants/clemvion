# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 1건(신설 회귀 가드 `websocket-events.types.spec.ts` 자체의 오탐 가능 논리 결함, 오늘 코드베이스엔 해당 패턴 없어 당장 CI 를 깨지 않음). 나머지는 전부 INFO. forced 화이트리스트(7개: documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 확인 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | 신설 회귀 가드가 "개별 `type` 태그를 단 named import"(예: `import { type Foo } from '../websocket/websocket.service'`)를 값(value) 간선으로 오탐할 수 있다. `clause.isTypeOnly` 는 선언 전체 형태만 반영하고 개별 specifier 의 `type` 태그는 `names` 계산에서만 반영돼 `value` 계산에 누락됨 — TS 파서로 직접 프로브해 재현(`{"declClauseTypeOnly":false,"value":true,"names":[]}`). 결과적으로 이 형태를 쓰면 3번째 테스트가 무조건 offender 로 판정하는 반면 5번째 테스트는 바로 그 스타일을 권장하는 자기모순. 오늘 코드베이스엔 해당 패턴 없어 당장 CI 를 깨지 않음(grep 확인) | `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:131,138,272` (`export…from` 분기 `:151-157`도 동일 패턴) | `value` 계산을 선언 레벨이 아니라 "네임드 바인딩이 없거나 하나라도 값으로 남는 specifier 가 있는가"로 재정의. 또는 `ModuleRef` 에 `namedBindingsPresent` 플래그 추가해 "바인딩 없음"과 "전부 타입이라 걸러짐"을 구분 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security/architecture/side_effect/dependency (중복) | `websocket.service.ts` 가 겸하던 enum/interface/type 선언을 의존성-프리 신규 모듈 `websocket-events.types.ts` 로 추출한 순수 리팩터(#1174 ES-module 순환 위 모듈 스코프 평가 `undefined` 버그 근본 해소). 보안 통제(`CREDENTIAL_KEY_PATTERN` 마스킹, `stripExternalOnlyFields`)·클래스 구현부는 원문 그대로, re-export facade 로 하위호환 12종 표면 완전 보존 | `codebase/backend/src/modules/websocket/websocket-events.types.ts`(신규), `websocket.service.ts` export 블록 | 조치 불필요 |
| 2 | architecture/security/dependency/testing (중복) | 이전 리뷰 라운드가 지적했던 잔여 순환 노드 `websocket.gateway.ts` 가 이번 diff 에서 `./websocket-events.types` 직접 import 로 전환 완료 — 갭 해소 확인 | `codebase/backend/src/modules/websocket/websocket.gateway.ts:23` | 조치 불필요 |
| 3 | performance/side_effect/maintainability/requirement (중복) | `TERMINAL_SHAPE` 를 함수-지역 리터럴에서 모듈-스코프 `const` 로 승격 — export 되지 않는 module-private 상수, 파생 값 동일, 쓰기 경로 없음. 순환 밖에 있다는 전제는 신설 정적 가드가 강제. 기존 테스트(`emitTerminalExecution`)가 completed/failed/cancelled 3분기·`error:null`·`cancelledBy` 키 부재까지 실제 enum 값 대조로 캐너리 역할 | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:71,143` | 조치 불필요(선택: 상수명을 `TERMINAL_TYPE_TO_WIRE_SHAPE` 로 좁히면 가독성 향상, maintainability 제안) |
| 4 | testing | 신규 회귀 가드(`websocket-events.types.spec.ts`)는 TS AST 파서 기반 5개 테스트로 "값 간선 0줄" 불변식을 검증하는 우수 사례 — 직접 실행 확인(4 suites / 118 tests GREEN) | `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` | 없음 — 우수 사례로 기록 |
| 5 | architecture/scope/maintainability (중복) | 커밋 `fa1bca013` 가 `moduleRefs()` 단일 헬퍼로 간선 판별 로직을 통합 — 4라운드 연속(`export…from` 미검출→별칭 오판정→`require()` 미검출→…) 반복되던 "판별 로직 이원화" 결함 부류를 구조적으로 닫음. eager/lazy·value/type 을 데이터 모델(`ModuleRef.eager/value`)로 명시 | `websocket-events.types.spec.ts` `moduleRefs`(118행경), `collectOffenders`(217-228행) | 조치 불필요 |
| 6 | scope | 회귀 가드가 원래 "타입 추출"이라는 범위보다 훨씬 큰 318줄짜리 AST 분석 스위트로 성장(5차례 편집: 130줄→318줄). 매 확장이 직전 라운드 리뷰의 구체적 지적에 대한 대응이라 임의 기능 확장으로 보기 어려움 | `websocket-events.types.spec.ts` 전체 | 조치 불필요 — 병합 전 사람 리뷰어가 이 정도 정적 가드 인프라 포함 여부를 한 번 명시 승인 권장(정책 판단, 코드 결함 아님) |
| 7 | dependency | 하위호환 re-export 경로가 향후 실수로 다시 순환에 편입될 수 있는 잠재 표면 — lint 레벨 자동 가드(`no-restricted-imports`) 부재는 이전 라운드와 동일하게 남음 | `websocket.service.ts` export 블록 | 범위 밖 개선 제안 — 후속 작업에서 `no-restricted-imports` 로 `websocket.service` 경로 enum 값 import 금지 고려 |
| 8 | documentation | 신설 정규식 상수 2개(`SERVICE_MODULE`/`EVENT_MODULES`)에 설명 주석 없음 — 파일의 나머지 부분과 달리 목적이 바로 안 드러남(`EVENT_MODULES` 가 실제로는 `websocket.service` 경로도 매치) | `websocket-events.types.spec.ts:72-73` | 두 상수 위에 한 줄씩 근거 주석 추가(급하지 않음) |
| 9 | maintainability | `originalName`/`destructuredKeys` 두 헬퍼가 "원 식별자 판정"이라는 같은 개념을 서로 다른 AST 노드 타입에 대해 각각 구현 — 로직이 작아 중복 비용 낮음 | `websocket-events.types.spec.ts:106-108,197-205` | 조치 불필요 |
| 10 | testing | `execution-event-emitter.service.spec.ts` 가 `WebsocketService` mock 을 `as unknown as` 로 캐스팅 — TS 타입체크 우회. 이번 PR 이 도입/확대한 패턴 아니고 저장소 전반의 기존 컨벤션 | `execution-event-emitter.service.spec.ts` beforeEach | 범위 밖. 후속 개선 시 `jest.Mocked<WebsocketService>` 고려 |
| 11 | security | 종결 이벤트 `error` 필드가 credential-key 패턴 마스킹만 거치고 메시지 새니타이징(`sanitizeErrorMessage`)은 거치지 않음 — 3라운드 연속 등재된 기존 설계, 이번 PR 이 도입한 결함 아님 | `execution-event-emitter.service.ts` `emitTerminalExecution` | 범위 밖 — 별도 turn 에서 전수 확인 사항 |
| 12 | dependency/performance | 새 외부 패키지/버전/라이선스 변경 없음(`package.json`/lockfile diff 0건) | 전체 diff | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 통제 원문 그대로, 잔여 순환 노드 해소 확인, 신규 시크릿/취약점 없음 |
| performance | NONE | 순수 컴파일타임 리팩터, `TERMINAL_SHAPE` 모듈 스코프화는 미세 개선 방향 |
| architecture | NONE | `moduleRefs()` 통합이 4라운드 반복 결함 부류를 구조적으로 해소, DI 순환은 의도적으로 문서화된 채 잔존 |
| requirement | LOW | 신설 가드의 개별 `type` specifier 오탐 가능성(WARNING) 신규 발견, 나머지 wire 계약 불변 확인 |
| scope | LOW | 가드 파일이 5차례 편집으로 318줄까지 성장 — 임의 확장 아님, 정책적 승인 권장 |
| side_effect | NONE | re-export 12종 표면 완전 보존, 함수 시그니처/emit 경로/전역상태 변경 없음 |
| maintainability | NONE | 이전 라운드 지적 전부 반영 재확인, 상수명/헬퍼 중복은 사소한 INFO |
| testing | NONE | 신규 가드 GREEN(118/118), `TERMINAL_SHAPE` 캐너리 테스트로 충분히 커버 |
| documentation | NONE | 정규식 상수 2개 무주석만 INFO, 나머지 JSDoc/체크리스트 정합 확인 |
| dependency | NONE | 신규 의존성 없음, 순환 해소 완결, re-export 잠재 표면은 INFO |

## 발견 없는 에이전트

없음 (전 에이전트가 최소 1건 이상 INFO 이상 발견사항 기록, 단 대다수는 "문제 없음 확인" 성격의 INFO).

## 권장 조치사항
1. (WARNING) `websocket-events.types.spec.ts` 의 `value` 계산 로직을 선언 레벨 `isTypeOnly` 가 아니라 specifier 단위로 정정 — "네임드 바인딩이 없거나 하나라도 값으로 남는 specifier 가 있음"으로 재정의하거나 `namedBindingsPresent` 플래그 도입. `import`/`export…from` 두 분기 모두 적용. 오늘 코드베이스엔 트리거 패턴이 없어 당장 CI 를 깨지 않으므로 이번 PR 을 막을 필요는 없으나, 이 파일이 이미 4라운드 연속 "형태를 놓치는" 결함을 낸 이력을 고려해 후속 커밋에서 조속히 정정 권장.
2. (INFO, 선택) `TERMINAL_SHAPE` → `TERMINAL_TYPE_TO_WIRE_SHAPE` 등으로 리네이밍해 module-private 상수의 의도를 이름만으로 드러나게 개선.
3. (INFO, 선택) `SERVICE_MODULE`/`EVENT_MODULES` 정규식 상수에 근거 주석 한 줄씩 추가.
4. (정책 판단) 병합 전 사람 리뷰어가 "타입 추출" 범위의 리팩터 PR 에 318줄 정적 가드 인프라를 포함하는 것을 한 번 명시 승인 — 코드 결함은 아니나 스코프 성장 이력이 큼.
5. (범위 밖, 백로그) `no-restricted-imports` 로 `websocket.service` 경로에서 enum 값 import 를 금지하는 lint 규칙 도입 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명, 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | database | router 판단상 이번 diff 와 무관 (DB 스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 diff 와 무관 (동시성 로직 변경 없음, import 재배선뿐) |
  | api_contract | router 판단상 이번 diff 와 무관 (외부 API 계약 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 와 무관 (사용자 가이드 문서 대상 변경 없음) |