# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `execution.failed` WS payload 의 `error` 가 string → object 로 바뀌면서, 아직 갱신되지 않은 프런트엔드 소비자(`use-execution-events.ts` / `execution-store.ts` / `ConversationInspector`)가 흔한 실사용 시나리오(진행 중 tool 호출 상태에서 실행 실패)에서 React 렌더 크래시로 이어진다. 그 외에는 spec 정합·설계 품질이 전반적으로 양호(요구사항 line-level 일치, 헬퍼 설계·테스트 밀도 높음)하지만 emit 경계의 `unknown` 타입·docstring 이 실제 구현보다 넓은 범위를 주장하는 패턴이 여러 reviewer 에서 중복 관측됐다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용(Side Effect) | `execution.failed` WS wire payload 의 `error` 가 string→object 로 바뀌었는데, 같은 payload 를 그대로 받는 내부 에디터 프런트엔드 WS 소비자가 갱신되지 않았다. `use-execution-events.ts` 의 `handleExecutionFailed` 는 여전히 `payload.error` 를 문자열로 캐스팅해 `flushPendingToolItemsAsError`/`failExecution` 에 넘기고, `ConversationInspector` 의 `ToolDetail` 이 `{item.error}` 를 JSX child 로 직접 렌더한다 — object 가 들어오면 React 가 "Objects are not valid as a React child" 런타임 에러를 던진다. 재현 조건은 흔함(진행 중 tool 호출 상태에서 execution 실패). 기존 프런트 테스트(`use-execution-events.test.ts`)도 여전히 문자열을 전제해 이 계약 불일치를 못 잡는다. | 백엔드: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:664,3312,4870`, `retry-turn.service.ts:965-967` (emit 지점). 프런트: `codebase/frontend/src/lib/websocket/use-execution-events.ts:253-264`, `codebase/frontend/src/lib/stores/execution-store.ts:24,170,736-754,947-959`, `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:475-479` | `use-execution-events.ts`/`execution-store.ts` 의 `error` 타입을 `string \| {code, message, nodeId?, details?} \| null` 로 갱신하고, `ToolDetail` 에서 object 인 경우 `.message` 만 추출해 렌더. 프런트 유닛 테스트에 object 케이스 추가. 같은 wire 이벤트를 공유하는 이상 이번 PR 스코프에 반드시 포함하거나 최소한 후속 작업으로 명시 등재 필요. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | 보안 | 신규 `toTerminalErrorPayload` 가 `message`/`details` 에 value-pattern 시크릿 마스킹(`redactSecrets`/`deepRedactSecrets`)을 적용하지 않는다. `error.message` 의 실제 출처(`error instanceof Error ? error.message : String(error)`)는 임의의 내부 예외 메시지 원문이며, 이 저장소는 이미 이 위험 클래스를 문서화한 전용 방어 모듈(`sanitize-error-message.ts`)을 갖고 있지만 알림 경로에만 적용되고 WS/SSE live push 경로(`websocket.service.ts` → `SseAdapter` 외부 스트림)는 키-이름 기반 `sanitizePayloadForWs` 만 통과해 자유 텍스트 내 토큰을 못 거른다. Pre-existing 갭이나 이 diff 가 이를 공식 wire-format 으로 굳히는 지점. | `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:42-76` (특히 66-71행), 소비처 `execution-engine.service.ts:664,4870`, `retry-turn.service.ts:966` | `toTerminalErrorPayload` 내부에서 `message`/`details` 에 `redactSecrets`/`deepRedactSecrets` 적용해 REST `getStatus` 의 `stripAndRedact` 와 대칭 맞출 것. defer 한다면 근거를 헬퍼 JSDoc/plan 에 명시. |
| 3 | 아키텍처 / 문서화 | `toTerminalErrorPayload` 의 JSDoc 이 "시스템 `execution.cancelled`" 커버리지를 주장하지만 실제 호출부 4곳은 전부 `EXECUTION_FAILED` 경로다. `emitCancellationEvent`(및 5개 호출부)는 여전히 `{code, message}` 를 손으로 만들고 `nodeId`/`details` 가 없다. spec §6 표는 `failed`/`cancelled` 를 같은 목표 형태로 규정하는데 `EiaCancelledEvent.error` 타입도 더 좁다. (문서화·API계약 리뷰에서도 동일 관측 — 통합) | `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:2`, `execution-engine.service.ts:1079` (`emitCancellationEvent`), `chat-channel/types.ts:413-417` (`EiaCancelledEvent.error`) | JSDoc 범위를 `execution.failed` 로 좁히거나, `emitCancellationEvent` 5개 호출부도 `toTerminalErrorPayload` 로 통일. 후자를 미룬다면 plan 에 명시 등재. |
| 4 | API 계약 | `spec/5-system/14-external-interaction-api.md` §6 필드 표의 `error` 행이 "일부 경로는 string" 캐비엇을 아직 서술하는데, 이번 PR 이 정확히 그 4개 emit 지점을 전부 object 로 일원화해 이미 stale 해졌다. 인접 행(`durationMs`)은 같은 diff 로 갱신됐는데 이 행만 놓쳤다. | `spec/5-system/14-external-interaction-api.md:572` | `error` 행에서 "일부 경로는 string" 캐비엇 제거 또는 "본 PR로 해소됨"으로 갱신. `cancelled` 캐비엇은 유지. |
| 5 | API 계약 | `execution.failed` 의 `error` shape 변경(string→object, `'INTERNAL_ERROR'`→`null`)은 실제 webhook/SSE 구독자 관점에서 breaking change 인데, 이 프로젝트는 URL 버전 세그먼트 없는 단일 버전 운영 정책이라 이를 구분할 버전 신호가 없다. | `terminal-error-payload.ts:42`, `execution-engine.service.ts:664`, `notification-fanout.service.ts:134` (가공 없이 그대로 전달) | PR 설명/릴리스 노트에 "error 가 항상 object" 임을 명시. 외부 통합 문서 있으면 반영. |
| 6 | 유지보수성 / 아키텍처 | 종결 이벤트 `error` wire 형태가 `TerminalErrorPayload`(execution-engine) / dispatcher 로컬 타입 / `EiaFailedEvent.error`(types.ts) 세 곳에 독립 선언돼 있고, 그중 `nodeId` optionality 만 다르다(`TerminalErrorPayload` 는 필수, 나머지 둘은 optional). emit 경계(`emitExecution(payload: unknown)`)가 `unknown` 이라 컴파일러가 producer/consumer 정합을 못 본다. | `terminal-error-payload.ts:30-35`, `chat-channel.dispatcher.ts:545-550`, `chat-channel/types.ts:399-404`, `events/execution-event-emitter.service.ts:40` | 세 선언을 `TerminalErrorPayload` 재사용/`Pick`으로 통일하거나 공용 위치로 승격. `EiaFailedEvent.error.nodeId` 의 `?` 제거해 실제 불변식과 일치. |
| 7 | 유지보수성 | `finalizeStalledExhausted` 안에서 매직 문자열 `'WORKER_HEARTBEAT_TIMEOUT'` 이 `stalledError.code` 도입 이유(DB-emit drift 방지)를 세운 직후, 30줄 아래 자식 `NodeExecution` cascade UPDATE 에서 다시 손으로 반복된다. | `execution-engine.service.ts:3269`(신규 `stalledError.code`), `:3297`(중복 리터럴) | `:3297` 을 `stalledError.code` 참조로 교체. |
| 8 | 테스팅 | `finalizeStalledExhausted`/`finalizeFailedExecution` 의 `EXECUTION_FAILED` emit 호출에서 `error` 필드 실제 값을 검증하는 테스트가 없다 — 뮤테이션으로 두 지점 모두 GREEN 유지됨을 실측(회귀 시 무증상). 나머지 2개 emit 지점(`failFirstSegmentSetup`, `failRetryExecution`)은 이번 diff 로 object shape 전체 assert 로 갱신됐는데 이 두 곳만 비대칭. | `execution-engine.service.ts:3312,4870`, 대응 테스트 `execution-engine.service.spec.ts` (해당 케이스들) | 형제 테스트와 동일 패턴으로 `error: {code, message, nodeId}` 명시적 assertion 추가. |
| 9 | 테스팅 | `toTerminalErrorPayload` 의 `typeof err === 'bigint'` 분기가 어떤 테스트로도 검증되지 않는다 — 뮤테이션으로 해당 조건 제거해도 14개 테스트 전부 GREEN 실측. | `terminal-error-payload.ts` (`toTerminalErrorPayload` 스칼라 분기), `terminal-error-payload.spec.ts` | `it.each` 에 `[BigInt(9), '9']` 케이스 추가. |
| 10 | 문서화 | 외부 wire 형태를 바꾸는 PR인데 `CHANGELOG.md` 갱신이 없다. 직전 유사 성격 커밋(`589914d6d`, `f9d31041d`)은 이 관례를 지켰다. | 저장소 루트 `CHANGELOG.md` (이번 diff 에 미포함) | `## Unreleased — <제목>` 절 추가 — string→object 전환, stalled 경로 DB/wire 문구 불일치 해소, `'INTERNAL_ERROR'`→`null` 변경 포함. |
| 11 | 요구사항 | plan 체크리스트(`eia-terminal-payload.md`)의 실행 체크리스트가 이 diff 자체가 이미 완료한 "구현 + 테스트"(9개 파일, unit test 589건 pass, lint clean)를 반영하지 못한 채 미체크로 남아 있다. companion plan 3개 동시 갱신도 미수행. | `plan/in-progress/eia-terminal-payload.md:225-228` | 이번 turn(또는 push 직전) `:225-226` 체크 및 `:228` 이 지시하는 3개 자매 plan 동시 갱신. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 12 | 보안 | 위조 에러 코드 `'INTERNAL_ERROR'` 제거는 개선 — `code: null` + `?? ''` 로 classifier unknown-fallback 에 안전하게 fail-closed 유지 확인. | `chat-channel.dispatcher.ts:546-558`, `terminal-error-payload.ts:68` | 조치 불요. |
| 13 | 보안 | `terminal-error-payload.ts` 의 필드 대입이 전부 named/typeof 가드 경유로, prototype pollution 벡터 없음 확인. | `terminal-error-payload.ts:66-74` | 조치 불요. |
| 14 | 아키텍처 | `chat-channel.dispatcher.ts` 에 조사 경위를 서술하는 긴 내러티브 주석이 프로덕션 코드에 남아 있다. | `chat-channel.dispatcher.ts:536-543,560-567` | 요약 1-2줄만 남기고 조사 경위는 plan/handoff 문서로 이동(선택). |
| 15 | 요구사항 | dispatcher 의 §6.4 object hot-path 분기(`errorRaw && typeof errorRaw === 'object'`)가 필드 타입을 런타임 검증하지 않는다 — pre-existing, 같은 프로세스 내 참조 전달이라 실질 위험 낮음. | `chat-channel.dispatcher.ts:551-553` | 조치 불요(비차단). 별도 프로세스/큐 경유 시 재검토. |
| 16 | 부작용 | `[CCH-ERR-04]` unknown-fallback warn 로그의 `code` 값이 `'INTERNAL_ERROR'`→`''` 로 바뀐다 — 저장소 내 소비자 없음(grep 0건) 확인, 저장소 밖 로그 대시보드가 있다면 영향 가능. | `execution-failure-classifier.ts:105,136-143` | 조치 불요, 참고용. |
| 17 | 부작용 | `finalizeStalledExhausted` 에서 DB `.set()` 과 emit 이 같은 객체 참조를 공유 — 의도된 설계, `toTerminalErrorPayload` 는 입력 미변형 확인. | `execution-engine.service.ts:3268-3271,3277,3312` | 조치 불요. |
| 18 | 스코프 | `toTerminalErrorPayload` 의 방어 범위(number/boolean/bigint/symbol 분기)가 실제 DB 소스(객체 또는 레거시 string)보다 넓다 — 일부 도달 불가 분기 포함, 과설계 성향. | `terminal-error-payload.ts:52-64` | 필요 시 `bigint` 분기 제거 또는 "일반 유틸리티 방어용, DB 경로 미도달" 주석 명시. |
| 19 | 스코프 | 코드 변경 9개 파일 대비 프로세스/문서 산출물 13개 파일 비중이 크나, 각 항목이 plan 이 선언한 이번 PR 범위(재판정 ③ 근거 정정, WARNING 4·5 해소, 백로그 분리)와 1:1 대응 확인 — 스코프 이탈 아님. | `review/consistency/2026/08/14/22_29_16/*`, `plan/**` 5개 문서 | 조치 불요. 문서 비중이 반복되면 코드/프로세스 diff 분리 커밋 고려(선택). |
| 20 | 테스팅 | `execution-failure-classifier.spec.ts` 가 신규 타입 `code: null` 을 명시 케이스로 테스트하지 않음 — 기존 "empty code" 케이스가 `??` 연산자 특성상 동일 경로를 이미 검증하나 명시적 갭. | `execution-failure-classifier.spec.ts:8` (`makeEvent`) | `code: null → executionFailedInternal` 케이스 추가. |
| 21 | 문서화 | `chat-channel.dispatcher.ts` 신규 주석이 실제 대입값(`null`)과 다운스트림 값(`""`)을 혼용 표기해 순간적으로 오독 가능. | `chat-channel.dispatcher.ts:566` | 대입값과 다운스트림 값을 명시적으로 구분해 표기. |
| 22 | API 계약 | `EiaFailedEvent.error.nodeId` 타입이 `nodeId?: string \| null` 로, 바로 위 주석("명시적 null, 키 생략 아님")보다 느슨함 — #6 과 동일 근본 원인. | `chat-channel/types.ts:402` | `nodeId: string \| null;` 로 옵셔널 제거(#6 조치와 통합). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | value-pattern 시크릿 마스킹 비대칭(WARNING), 위조 코드 제거는 개선(INFO) |
| architecture | LOW | JSDoc 이 cancelled 커버리지 과대 주장, 주석-타입 불일치, 3중 독립 타입 선언 + `unknown` 경계 (WARNING×3) |
| requirement | LOW | spec §6.4/§5.4/CCH-ERR-04 line-level 완전 일치, 589건 테스트 pass. plan 체크리스트 미반영(WARNING) |
| scope | LOW | 요청 범위 정확히 대응, 무관한 변경 없음. 과설계 성향 1건(INFO) |
| side_effect | **CRITICAL** | 프런트엔드 WS 소비자 미갱신으로 React 렌더 크래시 가능 |
| maintainability | LOW | 매직 문자열 중복, 3중 타입 선언, docstring 과대 범위 (WARNING×3) — 핵심 리팩터 자체는 긍정 평가 |
| testing | MEDIUM | 2개 emit 지점 + bigint 분기 뮤테이션 생존 실측(WARNING×2) |
| documentation | LOW | CHANGELOG 누락, JSDoc 범위 과대 주장 (WARNING×2) |
| api_contract | MEDIUM | breaking change 버전 신호 부재, cancelled/failed 스키마 불일치, spec 표 stale (WARNING×3) |

## 발견 없는 에이전트

없음 (9개 reviewer 전원 발견사항 보고).

## 권장 조치사항

1. **[Critical, 최우선]** 프런트엔드 `use-execution-events.ts`/`execution-store.ts`/`ConversationInspector` 를 신규 `error` object 계약에 맞게 갱신 — object 케이스 렌더링(`.message` 추출) 및 타입 확장, 대응 유닛 테스트 추가. 이번 PR 스코프에 포함하거나 최소 후속 작업으로 명시 등재.
2. `execution.cancelled` 경로(`emitCancellationEvent`)도 `toTerminalErrorPayload` 로 통일하거나, 최소한 JSDoc/spec 표에서 "cancelled 는 스코프 밖" 임을 명시해 문서-구현 괴리 제거 (#3, #4).
3. `toTerminalErrorPayload` 에 value-pattern 시크릿 마스킹 적용 — WS/SSE live push 경로가 REST `getStatus` 와 비대칭 상태로 신규 wire-format 이 되는 것을 방지 (#2).
4. `TerminalErrorPayload`/`EiaFailedEvent.error`/dispatcher 로컬 타입 3중 독립 선언을 통일하고 `nodeId` optionality 를 실제 불변식(항상 채움)에 맞게 고정 (#6, #22).
5. 테스트 갭 보강 — `finalizeStalledExhausted`/`finalizeFailedExecution` emit 인자 assertion, `bigint` 분기 케이스, `code: null` classifier 케이스 (#8, #9, #20).
6. `CHANGELOG.md` Unreleased 항목 추가, spec §6 필드 표 `error` 행 stale 캐비엇 갱신, breaking change 신호를 PR 설명에 명시 (#10, #4, #5).
7. `plan/in-progress/eia-terminal-payload.md` 체크리스트 및 companion plan 3개를 실제 완료 상태로 동기화 (#11).
8. 낮은 우선순위: `finalizeStalledExhausted` 매직 문자열 중복 제거(#7), 조사 경위 주석 이동(#14), dispatcher 주석 표기 명확화(#21), 과설계 분기 정리 또는 주석 보강(#18).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 해당 diff 범위에서 성능 관련 표면 낮음 |
  | dependency | router 판단 — 의존성 변경 없음 |
  | database | router 판단 — 스키마/마이그레이션 변경 없음 |
  | concurrency | router 판단 — 동시성 표면 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 가이드 동기화 대상 아님 |

**주의**: 강제 whitelist(router_safety) 7명 전원 결과가 확보되어 이행 결손 없음. 다만 CRITICAL 발견(#1, side_effect)이 있으므로 전체 위험도를 "clean" 으로 해석하지 말 것.