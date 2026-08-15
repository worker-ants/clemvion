# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음, 코드 로직 결함도 없음(순수 리팩터 + 문서화된 버그 흡수). 위험도를 끌어올리는 유일한 요인은 `documentation` 리뷰어의 MEDIUM 판정(plan/CHANGELOG 문서 위생 갭 2건)이며, forced 화이트리스트(`documentation`/`maintainability`/`requirement`/`scope`/`security`/`side_effect`/`testing`) 7명 전원 결과가 확보되어 결측으로 인한 거짓 음성은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `CHANGELOG.md` 에 이번 변경(종결 emit 타입 파사드 + `cancelledBy` 결함 흡수)이 반영되지 않음. 동일 커밋 계열(#1169~#1173)이 종결 이벤트 wire payload 에 영향을 주는 수정마다 예외 없이 `## Unreleased — ...` 섹션을 추가해왔던 관행과 대비된다. `failRetryExecution` cancelled 분기는 종전엔 `result` 키 자체를 emit 하지 않았는데, 이번 파사드로 `result.cancelledBy: 'user'` 를 새로 emit 하게 되어 수신자가 보는 wire payload 가 바뀌는 실제 동작 변경이다. | `CHANGELOG.md` (신규 섹션 부재); 근거: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `failRetryExecution` (cancelled 분기) | 기존 스타일대로 `## Unreleased — retry-turn cancelled 경로에 cancelledBy 누락` 항목 추가, 수신자 영향 명시 |
| 2 | Documentation | `retry-turn-terminal-guard.md` W1 항목의 취소선이 `~~원문:~~` 라벨 단어에만 걸리고 그 아래 실제 옛 문단(이미 완료된 "deep-equality 단언도 함께 갱신 필요" 문장 포함)은 컨텍스트 줄로 그대로 남아 stale 하다. 동일 PR 계열의 `durationMs` 항목이 이미 겪고 고친("절반만 취소선" 오독) 정확히 같은 결함 클래스가 인접 plan 파일에서 재발. | `plan/in-progress/retry-turn-terminal-guard.md:311`~`:317` | `durationMs` 항목이 쓴 패턴(안내 문장 + 옛 문단 전체 취소선 또는 삭제)을 동일 적용 |
| 3 | Requirement | `retry-turn-terminal-guard.md` 가 스스로 "단일 진실 목록"으로 지정한 "코드 — 우선순위 순" 표의 #2 행이 갱신되지 않음. 동결하기로 선언한 옛 라운드별 체크박스만 `[x]` 로 바뀌었고, `eia-terminal-emit-facade.md` 는 "자매 plan #2 흡수 완료"를 주장하지만 SoT 표 상에서는 여전히 미완료로 읽힌다. 이 정확한 리스크는 impl-prep consistency-check 가 사전에 WARNING #1 로 예견했었다. | `plan/in-progress/retry-turn-terminal-guard.md:368` (표 #2 행) | 1행과 동일 패턴으로 "**P2 완료**"(+근거: `eia-terminal-emit-facade.md`) 를 표에 추가 |
| 4 | Scope | `ExecutionEventEmitter` 클래스 레벨 JSDoc(파사드 존재 이유, "C-6 strangle step 1", 24곳 직접호출 이력, 향후 비-WS 채널 확장 노트)이 삭제되고 신규 `TerminalEventPayload` 타입용 JSDoc으로 완전히 치환됨 — 원본 내용은 저장소 어디에도 보존되지 않음(`grep` 전수 확인, 다른 "C-6 strangle" 언급은 step 2/3뿐). 클래스 선언부(`@Injectable() export class ExecutionEventEmitter`)에는 이제 docstring이 없다. | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:11-30` | 신규 타입 JSDoc은 유지하되, 원래 클래스 docstring을 클래스 선언부 위로 이동시켜 보존 |
| 5 | Maintainability / Testing / Documentation | `retry-turn.service.spec.ts` 안에 `TYPE_TO_EVENT` 매핑 상수(+ 동일 3줄 설명 주석)가 두 `describe` 블록에 글자 그대로 중복 정의됨. 매핑이 어떤 describe-지역 상태에도 의존하지 않아 지역 정의로 남길 이유가 없고, 향후 `ExecutionEventType` 값이 바뀌면 두 곳을 함께 갱신해야 해 한쪽만 갱신되면 조용히 stale해질 위험이 있다. | `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:788-797`(`emittedTypesOuter`), `:963-972`(`emittedTypes`) | 파일 상단(모듈 스코프) 또는 공용 테스트 헬퍼로 `TYPE_TO_EVENT` 를 한 번만 선언해 공유 |
| 6 | Testing | `TerminalEventPayload` 판별 union의 핵심 가치("컴파일 타임에 필수 필드를 강제한다")를 지키는 영구 type-level 회귀 테스트가 없음. plan 체크리스트의 "cancelledBy/durationMs 제거 시 TS2345" 검증은 개발 중 수작업 확인으로 보이며 저장소에 `@ts-expect-error` 류로 박제되어 있지 않다 — 누군가 필드를 optional로 완화해도 기존 unit 테스트는 그대로 GREEN이다. | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:31`(`TerminalEventPayload` 정의) | `execution-event-emitter.service.spec.ts`에 각 variant 필수 필드를 하나씩 제거한 리터럴 + `// @ts-expect-error` no-op 선언을 추가해 판별력을 회귀 테스트로 고정 |
| 7 | Architecture | 기존 ES-module 순환(`websocket.service` ↔ `websocket.gateway` ↔ `execution-engine`/`retry-turn` ↔ `execution-event-emitter`)을 근본 해소가 아니라 "호출 시점 지연 평가"로 한 번 더 우회. `ExecutionEventType` 을 모듈 스코프 상수로 옮겼을 때 72 suite 가 깨졌다는 사실(plan에도 기록)은 이 순환이 `tsc` 로는 안 잡히고 런타임 평가 순서에 의존하는 실질적 취약 구조임을 보여준다. 진단은 정밀했지만 근본 원인(서비스 구현 파일이 순수 타입/enum 을 함께 export)은 그대로 남아 다음 리팩터로 부채가 이월된다. | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:91-108`(매핑 객체 + 주석); 순환 경로: `websocket.gateway.ts:14-15` → `ExecutionEngineService`/`RetryTurnService` → `ExecutionEventEmitter` → `execution-event-emitter.service.ts:1-7`(`websocket.service.ts` 에서 enum 정적 import) | `ExecutionEventType` 등 런타임 값이 필요한 선언을 의존성-프리 모듈(예: `websocket-events.types.ts`)로 추출해 순환을 그래프 차원에서 끊는 후속 작업을 백로그에 등재 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `cancelledBy: 'user'` 고정값은 실제 취소 주체(user/system/timeout)를 구분하지 못해, system/timeout 취소에도 `'user'` 가 배정되고 §6.5 규칙상 `error` 필드가 함께 실리지 않아 정보가 축소 노출됨(정보 은폐이지 노출 아님, 기밀성 문제 아님). plan 문서에 이미 기지 한계로 명시됨. | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `failRetryExecution` | 조치 불요(문서화된 한계). 후속으로 `error.code` 기반 원인 파생 고려 가능 |
| 2 | Architecture | `ExecutionEventEmitter` 가 순수 이벤트 전달 파사드에서 `type→status` 매핑·`result.cancelledBy` 조립 등 도메인 상태 파생 책임까지 흡수 — 트레이드오프가 JSDoc에 정직하게 문서화되어 위반은 아니나, 향후 도메인 로직이 더 얹히지 않도록 리뷰 시 주의 필요 | `execution-event-emitter.service.ts` `emitTerminalExecution` 본문(95-120줄) | 조치 불요. 도메인 로직이 더 붙으면 "wire 조립"과 "채널 전송" 분리 고려 |
| 3 | Requirement | `TerminalEventPayload` 의 `cancelled.error` 가 spec §6.5 의 "optional" 명시보다 코드가 더 엄격(`message: string` 필수)함. 현재 3개 호출부 전부 리터럴을 채우므로 런타임 결함 아니며 §6.4 형태와 통일된 안전한 방향 | `execution-event-emitter.service.ts:48` | 코드 유지. spec 문구를 "message 는 현재 전 경로 필수"로 갱신할지는 planner 재량 |
| 4 | Scope | "타입 초크포인트 도입" 범위에 `retry-turn.service.ts` 의 기존 결함(`cancelledBy` 누락) 수정이 같은 커밋에 흡수됨 — 은폐 아니라 plan/spec/커밋에서 명시적으로 교차 참조·정당화된 흡수 | `retry-turn.service.ts` `failRetryExecution`; `plan/in-progress/eia-terminal-emit-facade.md:18-38` | 조치 불요. 커밋 메시지 제목에 `refactor`+`fix` 혼합임을 드러내면 추적에 유리 |
| 5 | Side Effect | `failRetryExecution` cancelled 경로에 `result.cancelledBy: 'user'` 가 신규로 실리는 것은 외부 관측자(webhook/frontend/webchat) 입장에서 관측 가능한 wire 계약 변화 — 의도된 결함 흡수이나 소비자가 필드 부재를 신호로 쓰고 있었다면 영향 가능 | `retry-turn.service.ts` `failRetryExecution` | 별도 조치 불요. 웹훅/프론트 소비 코드 중 이 필드 부재를 신호로 쓰는 곳 있는지 grep 권장 |
| 6 | Side Effect | `ExecutionEventEmitter` 에 신규 value import `ExecutionStatus` 추가로, 이미 순환 위상 위에 있는 이 파일의 모듈 의존 그래프가 한 겹 더 넓어짐. 함수 스코프 지연 평가로 안전하게 처리됐으나 향후 유지보수 시 동일 원칙 유지 필요 | `execution-event-emitter.service.ts:8` | 조치 불요. 향후 값 import 추가 시 모듈 스코프 파생 금지 원칙 유지 |
| 7 | Maintainability | plan 문서 "설계" 절이 초안 단계 메서드명(`emitTerminalExecutionEvent`)을 그대로 사용 — 실제 구현·체크리스트는 `emitTerminalExecution` | `plan/in-progress/eia-terminal-emit-facade.md:72` | 문서 내 함수명을 실제 구현과 통일 |
| 8 | Maintainability | `emitTerminalExecution` 이 조립하는 `wire` 가 `Record<string, unknown>` 이라, "컴파일 타임 강제"가 입력(`TerminalEventPayload`)에만 적용되고 조립 결과(출력)는 오타(`wire.eror`)를 `tsc` 가 못 잡음 — 현재는 테스트로 방어되어 실질 위험 낮음 | `execution-event-emitter.service.ts:94-121` | 명시적 union 리턴 타입 또는 필드명 오타 방지 헬퍼 타입 고려(급하지 않음) |
| 9 | Testing | `failed` variant 의 `error: null` 경로(§6.4 명시적 null 허용)가 emitter spec 에서 직접 검증되지 않음 — 현재 무조건 대입 코드라 동작은 맞지만 향후 조건부 대입으로 잘못 리팩터돼도 못 잡음 | `execution-event-emitter.service.spec.ts` | `type: 'failed', error: null` 케이스를 추가해 `'error' in wire` 로 키 유지 명시적 단언 |
| 10 | Documentation | `eia-terminal-emit-facade.md` 설계 절 예시 코드가 `error: TerminalErrorPayload`(non-nullable)로 되어 있으나 실제 구현은 `| null` — 예시가 뒤처짐 | `plan/in-progress/eia-terminal-emit-facade.md:78` | 설계 스니펫에 `| null` 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/인증/시크릿 노출 없음. `cancelledBy` 고정값은 정보 정확성 이슈(INFO)일 뿐 보안 취약점 아님 |
| architecture | LOW | 파사드 설계는 정당한 개선. 기존 ES-module 순환을 근본 해소 대신 지연 평가로 재우회(WARNING) |
| requirement | LOW | spec §6/§6.3~§6.5 와 line-level 정합, 회귀 테스트로 잠김. plan SoT 표 #2 행 미갱신(WARNING) |
| scope | LOW | 변경 전량이 선언된 리팩터 목적과 일치. 클래스 JSDoc 삭제·미보존(WARNING) |
| side_effect | LOW | 기존 시그니처/이벤트 감지 로직 불변. `cancelledBy` 신규 emit 은 의도된 wire 계약 변화(INFO) |
| maintainability | LOW | 파사드 도입은 유지보수성 개선 방향. 테스트 내 `TYPE_TO_EVENT` 중복(WARNING) |
| testing | LOW | 3개 spec 실행 GREEN(52+454 tests) 확인. 판별력 고정 회귀 테스트 부재(WARNING) |
| documentation | MEDIUM | 코드 레벨 문서화는 강점. CHANGELOG 미반영 + plan 취소선 절반 처리(재발 패턴) 2건 WARNING |
| user_guide_sync | NONE | doc-sync-matrix 21행 중 실질 매칭 없음(spec-major-change 는 consistency 영역, run-debug 그레이존은 pre-existing gap) |

## 발견 없는 에이전트

없음 — 전 9개 reviewer 모두 최소 1건 이상의 발견(WARNING 또는 INFO)을 보고함 (security 는 WARNING/CRITICAL 없이 INFO만, user_guide_sync 는 INFO 1건 및 위험도 NONE).

## 권장 조치사항
1. `CHANGELOG.md` 에 이번 PR 의 `cancelledBy` 결함 흡수(수신자 영향 포함) 항목 추가 — 동일 커밋 계열이 예외 없이 지켜온 관행과의 괴리를 해소.
2. `plan/in-progress/retry-turn-terminal-guard.md` W1 항목의 옛 문단을 완전히 취소선 처리(또는 삭제) — "절반만 취소선" 오독 패턴 재발 방지.
3. `plan/in-progress/retry-turn-terminal-guard.md` 의 "코드 — 우선순위 순" SoT 표 #2 행에 "P2 완료" 를 반영해 `eia-terminal-emit-facade.md` 의 "자매 plan 흡수 완료" 주장과 정합시킴.
4. `execution-event-emitter.service.ts` 의 원래 클래스 JSDoc(파사드 존재 이유·C-6 strangle 이력)을 클래스 선언부로 이동해 보존.
5. `retry-turn.service.spec.ts` 의 `TYPE_TO_EVENT` 중복 정의를 파일 스코프 상수 하나로 통합.
6. `execution-event-emitter.service.spec.ts` 에 `TerminalEventPayload` 판별력을 고정하는 type-level 회귀 테스트(`@ts-expect-error`) 추가.
7. (후속 백로그, 급하지 않음) `ExecutionEventType` 등을 의존성-프리 types 모듈로 분리해 `websocket.service`↔`gateway`↔`execution-engine` ES-module 순환을 그래프 차원에서 근본 해소.

## 라우터 결정

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync` (9명)
- **제외**: 아래 표 (5명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명, 전원 결과 확보됨 — forced 화이트리스트 미이행 없음)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | router 판단상 이번 changeset 과 무관(비-종결 이벤트/성능 경로 무변경) |
| dependency | 패키지 의존성 변경 없음 |
| database | DB 스키마/쿼리 변경 없음 (순수 in-memory wire payload 조립 리팩터) |
| concurrency | 동시성 제어 로직 무변경 |
| api_contract | 외부 REST/DTO 계약 변경 없음 (WS 이벤트 payload 는 requirement/scope/side_effect 가 커버) |