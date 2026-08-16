# Requirement Review — `10_19_30`

## 발견사항

- **[WARNING][SPEC-DRIFT]** `spec/5-system/14-external-interaction-api.md` §6.4 가 `execution.failed` 의 `error.message`/`error.details` 에 대해 새로 도입된 egress 마스킹(`deepRedactSecrets`)을 문서화하지 않는다
  - 위치: `spec/5-system/14-external-interaction-api.md:770`-`806` (§6.4 페이로드 정의 + 그 아래 두 개의 `>` 보충 노트), 대응 구현은 `codebase/backend/src/shared/utils/terminal-error-payload.ts:47`-`104` (`redactTerminalError`)
  - 상세: 이번 PR 은 `toTerminalErrorPayload` 안에서 `message`·`details` 에 `deepRedactSecrets` 를 적용해 `execution.failed`(WS/SSE/webhook) wire 의 바이트를 바꾼다 — CHANGELOG 자신이 "⚠️ wire 변화" 로 명시한다(`CHANGELOG.md:15`-`18`). 그런데 §6.4 본문과 그 아래 두 보충 노트(`code`가 `null` 일 수 있는 이유, "이제 전 경로 object 다")는 이 마스킹을 전혀 언급하지 않는다. 이 저장소는 같은 문서 안에서 R17(§`1371`)이 `conversationThread`/`turns[].data`/`presentations[].payload` 에 대해 정확히 같은 종류의 egress-only 마스킹(같은 SoT `sanitize-error-message.ts`)을 도입했을 때 전용 Rationale 절("표면 제약(보안)")을 붙여 무엇이 마스킹되는지·왜 egress 시점인지·무엇을 못 잡는지를 명시했다. 이번 변경은 같은 성격(같은 SoT, 같은 egress-only 원칙, 같은 "자격증명만 겨냥·연결문자열/호스트명은 통과" 잔여 갭)인데 §6.4 본문에는 그 사실이 반영되지 않았다. 구현·테스트·plan·CHANGELOG 는 모두 정확하고 상호 일치한다(아래 "요약" 참조) — 이는 코드가 틀린 것이 아니라 spec 본문이 새 wire 동작을 아직 못 따라가는 case다.
  - 판단 근거: (a) plan(`plan/in-progress/eia-terminal-error-sanitize.md:56`-`62`)이 "spec `§6.4` 는 새니타이즈를 요구하지 않는다 → `spec_impact: none`" 이라고 스스로 적어 뒀지만, 이 근거는 "spec 이 금지하지 않는다"(위반 아님)에 대한 것이지 "spec 이 이 wire-affecting 동작을 문서화해야 하는가"에 대한 답은 아니다. (b) 이 저장소의 관행(R6·R14·R16·R17 노트들)은 wire 바이트에 영향을 주는 결정을 계약 문서 옆에 남기는 것이다. `spec-sync-external-interaction-api-gaps.md` 는 `plan/` 트래커일 뿐 `spec/` 본문이 아니므로 이 문서를 읽는 외부 통합사·차기 구현자에게 안 보인다.
  - 제안: 코드는 그대로 두고, `spec/5-system/14-external-interaction-api.md` §6.4 페이로드 정의 아래 이미 있는 두 `>` 보충 노트 뒤에 R17 과 같은 형식의 짧은 노트(또는 신규 R-note)를 추가해 (1) `message`/`details` 가 `deepRedactSecrets`(자격증명 패턴)로 egress 시점에 마스킹됨, (2) `code`/`nodeId` 는 대상이 아님, (3) 자격증명 없는 연결 문자열·내부 호스트명은 여전히 통과하는 알려진 잔여 갭(이미 `spec-sync-external-interaction-api-gaps.md` 에 등재)임을 명시한다. spec 수정 자체는 `project-planner` 위임.

- **[INFO]** `chat-channel.dispatcher.ts:551` 이 이미 `toTerminalErrorPayload` 를 통과한(이미 마스킹된) `error` 객체에 같은 함수를 재적용한다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:551` (이 PR 이 만든 코드가 아니라 기존 구조 — `errorRaw` 는 `websocketService.executionEvents$` 로 fan-out 된, 발행 시점에 이미 `redactTerminalError` 를 거친 `wire.error`)
  - 상세: `redactTerminalError` 는 이미 마스킹된 문자열(예: `***` 로 치환된 세그먼트)에 다시 걸어도 추가로 값이 바뀌지 않는 한 부작용이 없다(idempotent) — 새 결함은 아니다. 다만 두 egress 소비자가 같은 헬퍼를 이중 호출하는 구조가 향후 헬퍼가 상태를 갖게 되면(현재는 없음) 조용히 깨질 수 있는 지점이라는 점만 기록해 둔다.
  - 제안: 조치 불필요(이번 PR 범위 밖). 향후 `redactTerminalError` 가 idempotent 하지 않은 로직을 추가할 경우 이 이중 호출 지점을 함께 재검토할 것.

## 검증한 사실관계 (긍정 확인 — 발견사항 아님, 근거로 남김)

- `redactTerminalError`(`terminal-error-payload.ts:96`-`104`)는 `toTerminalErrorPayload` 의 **모든** 반환 경로(문자열/숫자·불리언·bigint/그 외 스칼라/객체)에서 호출되어, 새 분기가 생겨도 마스킹이 구조적으로 빠질 수 없다는 JSDoc 의 주장이 코드와 일치한다(`terminal-error-payload.ts:118`-`149` 전 분기 확인).
- `toTerminalErrorPayload` 호출부 5곳(EXECUTION_FAILED emit 4 + `chat-channel.dispatcher` 1) 전부 emit 경로이고 DB write 는 0 — grep 으로 실측 일치(`execution-engine.service.ts:668,3400,5030`, `retry-turn.service.ts:1001`, `chat-channel.dispatcher.ts:551`).
- `execution.failed` 의 `error.message` raw 출처 3곳(`execution-engine.service.ts:636` `failFirstSegmentSetup`, `execution-engine.service.ts:4991` 부근 `finalizeFailedExecution`, `retry-turn.service.ts:958` 부근 `failRetryExecution`) 모두 `err instanceof Error ? err.message : String(err)` 형태의 raw 예외 메시지를 `Execution.error` 에 쓰고 있음을 확인 — plan 의 "3곳 전수" 주장과 일치.
- `execution.cancelled` 의 `error.message` (`emitCancellationEvent` 경유, `execution-engine.service.ts:1206,2852,2901` 등)는 전부 고정 문자열/`resumeErrorMessage(code)` 룩업이고 raw 예외 메시지를 담지 않음 — plan 이 "cancelled 는 범위 밖" 이라고 스스로 밝힌 근거가 실측과 일치, 누락 아님.
- `websocketService.executionEvents$` 가 WS/`NotificationFanout`(webhook)/`SseAdapter`/`chat-channel.dispatcher` 가 공유하는 단일 스트림이고, `emitExecutionEvent` 가 발행 **전에** `sanitizePayloadForWs`(키-이름 기반, 값 패턴 미검사 — `websocket.service.ts:57`-`60` 자체 주석이 "값 자체의 entropy 분석은 false positive 가 너무 많음" 이라 명시)만 적용함을 확인 — "WS 방어는 키 이름 기반이라 자유 텍스트 내부 토큰을 못 잡는다" 는 JSDoc/plan 의 핵심 전제가 코드로 뒷받침된다.
- `sanitizeErrorMessage`(`execution-engine/sanitize-error-message.ts`)의 호출부는 정확히 3곳(`execution-engine.service.ts:5090`, `background-execution.processor.ts:70`, `schedule-runner.service.ts:243`)이고 전부 `channel: 'in_app'|'email'|'both'` 알림 조립 지점 — 좁혀 적은 docstring 이 실측과 일치.
- `EXTERNAL_STRIPPED_FIELDS = ['llmCalls']`(`strip-external-only-fields.ts:91`) — CHANGELOG/plan 의 "`llmCalls` 하나만 지운다" 주장과 일치.
- `spec/5-system/14-external-interaction-api.md` §R17(`:1371`-`1430`)이 egress-only masking 원칙과 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` 을 이미 다른 필드(`conversationThread`)에 적용한 선례임을 확인 — 이번 결정이 그 선례를 그대로 재사용한다는 JSDoc 주장과 일치, DB-write 시점에 걸지 않는 근거도 R17 문구와 부합.
- `toTerminalErrorPayload.spec.ts` 신규 `describe` 블록 8개 테스트를 `jest` 로 직접 실행 — **24/24 PASS**(전체 파일). W7 이 지적한 "판별력 없는 fixture" 문제는 `Bearer sk-live-…`/`api-key=…` 로 교체돼 있고, `code`/`nodeId` 미변형 단언(`toEqual`)이 실제로 판별력을 갖는 입력에 대해 성립함을 확인.
- 변경 파일에 대해 `tsc --noEmit` 실행 결과 `terminal-error-payload.ts`/`sanitize-error-message.ts` 관련 신규 오류 없음.
- TODO/FIXME/HACK/XXX 주석 없음(`terminal-error-payload.ts`, `terminal-error-payload.spec.ts`, `sanitize-error-message.ts` 전수 grep).
- `redactTerminalError`(`:96`-`104`)의 spread 순서 — `{ ...p, message: masked, ...(details ? {details: masked} : {}) }` — 는 `p.details`(원문)가 먼저 스프레드되고 마스킹된 `details` 가 뒤에 덮어써 최종적으로 마스킹본이 승리함을 코드 순서로 확인, 원문이 새어나가는 순서 버그 없음.

## 요약

핵심 로직(`redactTerminalError` + `toTerminalErrorPayload`)은 의도한 기능 — WS/SSE/webhook 종결 이벤트의 `error.message`/`error.details` 에 대한 자격증명 값-패턴 마스킹을 egress 단일 초크포인트에서 강제 — 을 완전하고 정확하게 구현한다. 5개 호출부 전수 확인, raw 소스 3곳 전수 확인, 공유 이벤트 스트림 구조 확인, 테스트 24/24 실행 통과까지 모두 코드·plan·CHANGELOG 의 주장과 일치했고 과장·누락을 찾지 못했다(이전 라운드 `09_51_00` 의 W1/W7 지적이 이미 정확히 반영되어 있음). 유일한 실질 발견사항은 spec fidelity 관점의 SPEC-DRIFT — `spec/5-system/14-external-interaction-api.md` §6.4 가 이번에 도입된 byte-level wire 변화(마스킹)를 문서화하지 않는다는 것이며, 이는 코드 결함이 아니라 spec 갱신 누락이다. 그 외 하나의 INFO(이중 마스킹 호출, idempotent 라 무해)를 제외하면 엣지 케이스·에러 시나리오·반환값·데이터 유효성 전부 기존 테스트와 신규 테스트로 커버돼 있다.

## 위험도

LOW
