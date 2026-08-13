# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done)

## 발견사항

### [CRITICAL] EIA Outbound Notification / 종결 WS 이벤트 payload 가 spec §6.3–§6.5 계약과 실제 구현에서 크게 다르다

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §6.3 (`execution.completed`, L634-652) · §6.4 (`execution.failed`, L654-672) · §6.5 (`execution.cancelled`, L675-679). 동일 계약을 참조하는 `spec/5-system/6-websocket-protocol.md` §4.1 표 (L176-179, `execution.completed`/`execution.failed`/`execution.cancelled` 행)도 같은 문제를 공유.
- **충돌 대상**:
  - `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts` L123-137 (`eventBody.payload = event.payload`)
  - `codebase/backend/src/modules/external-interaction/notification-dispatcher.types.ts` L29·L44-48 (envelope 필드명을 `payload` 로 명시 — spec 의 `result`/`error`/`durationMs` 아님)
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `EXECUTION_COMPLETED` emit 4곳 전부 `{ status: ExecutionStatus.COMPLETED }` 뿐 (L2369-2374, L2536-2540, 그 외 2곳도 동형); `EXECUTION_FAILED` emit (예: L3289-3296) 는 `{ status, error: '<string>' }` 뿐
  - `codebase/backend/src/modules/chat-channel/types.ts` L388·L405 — `result: { outputs?, finalNodeId?, finalPort? }` / `result: { cancelledBy? }` 를 **기대 타입**으로 선언 (spec 과 동일한 기대)
  - `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` L527-585 — `event.payload.result ?? {}` 로 방어(크래시는 없으나 값 유실), L536-545 주석이 이 drift 를 **스스로 인정**
- **상세**: spec §6.3 은 outbound notification body 가 `{ type, executionId, triggerId, workflowId, result: { outputs, finalNodeId, finalPort }, durationMs, timestamp, seq }` 형태라고 명시하고, §6.4 는 `error: { code, message, nodeId, details? }`, §6.5 는 `result.cancelledBy` 를 요구한다. WS 프로토콜 §4.1 도 `execution.completed`→`duration, nodeCount`, `execution.failed`→`failedNodeId, duration` 을 payload 의 일부로 명시한다.

  그러나 실측 결과 `NotificationFanout.handle()` 은 엔진이 emit 한 내부 fanout envelope 를 가공 없이 `eventBody.payload` 라는 **다른 이름의 필드**에 그대로 넣어 큐에 적재하고, `NotificationWebhookProcessor` 는 그 `eventBody` 를 `JSON.stringify` 해 그대로 고객 URL 로 POST 한다(가공/enrich 단계 없음). 그리고 그 내부 payload 자체가:
  - `execution.completed` → `{ status: 'completed' }` 뿐 — `result`/`outputs`/`finalNodeId`/`finalPort`/`durationMs`/`nodeCount` 전부 부재
  - `execution.failed` → `{ status, error: '<사람용 문자열>' }` (경로에 따라) — `error` 가 object 가 아니라 string 인 경우가 실재하고, `failedNodeId`/`durationMs` 부재
  - `execution.cancelled` → `{ status, result: { cancelledBy }, error? }` — `cancelledBy` 는 있으나 `durationMs`/WS §4.1 이 요구하는 flat `cancelledBy`(아래 WARNING 참조) 와도 다르고, `nodeCount` 류는 애초에 없음

  즉 **실제로 고객에게 발송되는 JSON 최상위 키는 `payload` 이지 spec 이 문서화한 `result`/`error` 가 아니며**, 그 안의 필드도 spec 문서의 부분집합만 존재한다. spec 문서를 그대로 신뢰해 외부 연동을 구현한 고객은 `result`/`error`/`durationMs`/`failedNodeId`/`nodeCount` 를 전부 `undefined` 로 받는다. 내부 소비자(`ChatChannelDispatcher`)는 `?? {}` 로 방어해 크래시는 피하지만 렌더링에 필요한 데이터(최종 outputs 등)가 구조적으로 없다.

  이 drift 는 팀도 이미 인지했다 — `chat-channel.dispatcher.ts` L536-545 주석이 "execution-engine 이 emit 하는 payload.error shape 가 spec EIA §6.4 와 drift, 후속 plan `spec-update-execution-failed-payload-shape` 로 마이그레이션 예정" 이라 적어 두었다. 그러나 `git log --all -- "plan/*execution-failed-payload-shape*"` 및 `git log --all -S "spec-update-execution-failed-payload-shape"` 로 확인한 결과 이 계획 파일은 **저장소 이력상 한 번도 존재한 적이 없다**(주석 도입 커밋 `febff61e7`, PR #324, 2026-05-25 무렵) — 약속된 후속 조치가 붕 뜬 채로 남아 있고, drift 자체는 오늘도 재현된다.

- **제안**: `project-planner` 로 위임해 (a) EIA §6.3–§6.5 의 outbound notification JSON 스키마를 실제 구현("얇은 signal, `payload` 필드, REST 재조회로 상세 획득")에 맞춰 재작성하거나, (b) `NotificationFanout`/`NotificationWebhookProcessor` 에 enrich 단계를 추가해 문서화된 `result`/`error`/`durationMs`/`nodeCount`/`failedNodeId` 를 실제로 채우는 구현 작업을 별도 plan(`spec-update-execution-failed-payload-shape` 또는 동등 후속명)으로 신규 등록한다. 어느 쪽이든 `spec/5-system/6-websocket-protocol.md` §4.1 도 동일 결정에 맞춰 동기화해야 한다(현재 표도 실제 emit 보다 풍부하게 문서화돼 있음).

### [WARNING] `retry-turn.service.ts` 의 `failRetryExecution` 이 `EXECUTION_CANCELLED` emit 시 `cancelledBy` 를 아예 채우지 않는다

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.1 L179 (`execution.cancelled` payload 는 `cancelledBy` 를 필수 포함, 닫힌 3값 union) / `spec/5-system/14-external-interaction-api.md` §6.5 L677-678
- **충돌 대상**: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` L917-966 (`failRetryExecution`) vs 같은 파일 상위의 형제 헬퍼가 없고, `execution-engine.service.ts` 의 `emitCancellationEvent`(L1071-1096, 4개 호출부: L1049·L1162·L2800·L4750)가 이미 구현한 `{status, result:{cancelledBy}}` 관례. 소비자 계약은 `codebase/backend/src/modules/chat-channel/types.ts` L405 (`result: { cancelledBy?: 'user'|'system'|'timeout' }`).
- **상세**: `failRetryExecution` 은 `EXECUTION_CANCELLED` 를 emit 할 때 `{ status: finalStatus, ...(!isCancelled ? { error: errMessage } : {}) }` 만 보낸다 — `cancelledBy` 필드 자체가 없다. 같은 파일 안에도, 같은 모듈의 다른 4개 취소 경로에도 이미 `emitCancellationEvent` 로 통일된 `cancelledBy` 계약이 있는데 이 경로만 우회한다. 이는 이미 `plan/in-progress/retry-turn-terminal-guard.md` L272-278·L329 에서 5R(cross_spec 독립 확인 포함)에 P2 로 등재돼 있으나 **현재도 체크박스 미완료(`- [ ]`) 상태**이며, 이번 세션 실측으로도 코드가 그대로임을 재확인했다.
- **제안**: `failRetryExecution` 도 `emitCancellationEvent`(또는 그 후속 통합 헬퍼)를 재사용하도록 정리 — plan 항목 #2 를 이번 스코프에서 마저 반영할 것.

### [WARNING] `6-websocket-protocol.md` §4.1 표는 `execution.cancelled` payload 를 flat `{ cancelledBy }` 로 문서화하지만, 실제 구현·EIA spec 은 `result.cancelledBy` (nested) 를 쓴다

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.1 L179 — `execution.cancelled` 행: `{ executionId, cancelledBy, duration, error? }` (flat)
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §6.5 L677 — "§6.3 의 `result` 자리에 `cancelledBy` … 만 채운 변형" (nested `result.cancelledBy`); `execution-engine.service.ts` L1084-1085 `result: { cancelledBy: opts.cancelledBy }`; `chat-channel/types.ts` L405 `result: { cancelledBy? }`.
- **상세**: EIA §6.5 는 스스로 "WS §4.1 정합" 이라 주장하지만(L678), 실제로는 필드 위치가 다르다 — WS §4.1 은 최상위 `cancelledBy`, EIA·코드·chat-channel 타입은 `result.cancelledBy`. `spec/5-system/` 내부 두 문서가 같은 이벤트의 wire shape 를 다르게 서술하는 직접 모순이며, 코드는 EIA 쪽(nested)이 맞다.
- **제안**: `6-websocket-protocol.md` §4.1 의 `execution.cancelled`(및 `execution.completed`/`execution.failed`, 위 CRITICAL 참조) 행을 실제 구현 shape 로 정정. `duration` 필드도 현재 어떤 emit 경로에도 존재하지 않으므로 표에서 제거하거나 "미구현" 주석(인접 `execution.paused _(계획·미구현)_` 표기 관례 참고)을 붙일 것.

### [INFO] EIA 계열 Redis 키(`interaction:idempotency:*`, R8 캐시 키 스코프)가 실행 엔진 §9 키 인벤토리 표에 미등재

- **target 위치**: `spec/5-system/4-execution-engine.md` §9 (Redis 키 네이밍 컨벤션) — `interaction:idempotency:<executionId>:<route>:<key>` 행 없음(`exec:seq:*` 등만 등재)
- **충돌 대상**: `spec/conventions/redis-keys.md` L59 (이미 등재) / `spec/data-flow/15-external-interaction.md` L310 ("EIA 계열 키는 그 표에 아직 미등재다(별도 항목)" — self-flag)
- **상세**: 실제로 키는 `conventions/redis-keys.md` 인벤토리에는 있고, `data-flow/15-external-interaction.md` 자신도 이미 이 갭을 알고 있다고 명시했다 — 새로운 발견은 아니지만, `4-execution-engine.md` §9 가 SoT 로 인용되는 다른 문서들과 동기화되지 않은 채 남아 있어 "키 정의는 어디가 최종본인가" 혼동 소지가 있다.
- **제안**: `4-execution-engine.md` §9 에 EIA 계열 키를 별도 행(또는 `conventions/redis-keys.md` 로의 명시적 pointer)으로 추가해 self-flag 를 해소.

## 요약

가장 큰 발견은 **EIA Outbound Notification(및 그 기반이 되는 WS 종결 이벤트)의 실제 payload shape 가 spec §6.3–§6.5·§4.1 이 문서화한 계약보다 현저히 얇다**는 점이다 — 최상위 필드명(`payload` vs `result`/`error`)부터 다르고 `outputs`/`finalNodeId`/`finalPort`/`durationMs`/`nodeCount`/`failedNodeId` 가 실제로는 발송되지 않는다. 이는 외부 고객이 직접 소비하는 API 계약(EIA)의 실질적 파손이며, 코드 주석이 스스로 인정하면서도 가리키는 후속 plan(`spec-update-execution-failed-payload-shape`)이 실제로는 한 번도 생성되지 않아 계획이 붕 뜬 상태다. 그 아래로 `retry_last_turn` 취소 경로의 `cancelledBy` 누락(이미 plan 에 P2 로 추적 중, 미완료)과 WS §4.1 대 EIA §6.5 의 nested/flat shape 모순이 있다. Redis 키 인벤토리 갭은 이미 self-flag 된 저위험 문서 동기화 항목이다.

## 위험도

HIGH
