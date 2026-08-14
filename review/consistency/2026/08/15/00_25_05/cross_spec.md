# Cross-Spec 일관성 검토 — `spec/5-system/` (target: `14-external-interaction-api.md` §6.4 / `conventions/chat-channel-adapter.md`)

## 검토 방법
- target 문서 전문(§1~§12, Rationale 포함) 및 diff(`git diff origin/main...HEAD -- spec/5-system/14-external-interaction-api.md spec/conventions/chat-channel-adapter.md`)를 실제 워킹트리에서 직접 확인.
- 대응 코드 diff 확인: `terminal-error-payload.ts`(신규) · `execution-engine.service.ts` · `retry-turn.service.ts` · `chat-channel.dispatcher.ts` / `types.ts` · frontend `use-execution-events.ts`.
- 교차 검증 대상: `spec/1-data-model.md`(§2.13/§2.14 Execution/NodeExecution.error), `spec/5-system/4-execution-engine.md`(§7.1/§7.5/§8 에러코드), `spec/5-system/3-error-handling.md`(§1.4/§1.5 에러코드 표), `spec/5-system/6-websocket-protocol.md`(§4.1 필드 집합 포인터), `spec/5-system/15-chat-channel.md`(CCH-ERR-01~05), `spec/conventions/chat-channel-adapter.md`(§1.2/§3.1 classifier), `spec/data-flow/3-execution.md`, `spec/2-api-convention.md`(§5.4 부재 표현), `spec/conventions/error-codes.md`.

## 발견사항

- **[INFO]** §6.4(`execution.failed`) 절의 "code 는 null 일 수 있다" 설명에 취소 전용 코드가 무경계로 나열됨
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.4, "> **`code` 는 `null` 일 수 있다** — 코드를 만드는 경로는 여럿이다(sentinel `ErrorPortFallbackError`/`ExecutionTimeLimitError` · 무조건 붙는 `WORKER_HEARTBEAT_TIMEOUT` · 취소 계열 `RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT`)." (이번 diff 로 신규 추가된 문구)
  - 충돌 대상: 같은 문서의 `### execution.cancelled 의 행동 계약 (normative)` 절 — 여기서 `RESUME_*` / `EXECUTION_QUEUE_WAIT_TIMEOUT` / `WEBCHAT_IDLE_TIMEOUT` 세 코드는 **`execution.cancelled`(`cancelledBy=system|timeout`) 전용**으로 닫혀 있다고 명시(표로 1:1 매핑). `execution.failed` JSON 예시(§6.4 바로 위 코드 블록)의 `code` 후보 목록(`EXECUTION_TIMEOUT` / `EXECUTION_TIME_LIMIT_EXCEEDED` / `MAX_ITERATIONS_EXCEEDED` / `CYCLE_DETECTED` / ...)에도 이 세 코드는 등장하지 않는다.
  - 상세: `execution.failed` 절(§6.4) 본문 안에서 "코드를 만드는 경로" 예시로 취소 전용 코드를 함께 나열하면, 구현자가 "이 세 코드가 `execution.failed.error.code` 에도 등장할 수 있다"로 오독할 여지가 있다. 실제로는 §7.5/§8/§EIA-RL-07 어느 경로도 이 세 코드를 `EXECUTION_FAILED` emit 경로(`execution-engine.service.ts` 4곳)에 쓰지 않고, 전부 `emitCancellationEvent`(→ `execution.cancelled`) 로만 나간다 — 코드 자체는 정확하고 §6.4 표와 "행동 계약" 표는 서로 모순되지 않지만, **문서 텍스트의 스코프 경계**가 흐려졌다. "취소 계열" 이라는 수식어가 최소한의 구분 신호이긴 하나, 바로 앞 두 항목(sentinel · `WORKER_HEARTBEAT_TIMEOUT`)이 실제 `failed` 전용 코드인 것과 나란히 열거되어 있어 대비가 약하다.
  - 제안: 해당 괄호를 "…(`failed` 자체가 만드는 코드: sentinel `ErrorPortFallbackError`/`ExecutionTimeLimitError` · `WORKER_HEARTBEAT_TIMEOUT`. 참고로 `error` 필드를 공유하는 형제 이벤트 `execution.cancelled` 는 별도로 `RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT` 를 쓴다 — [행동 계약](#executioncancelled-의-행동-계약-normative) 참조)…" 식으로 분리하면 스코프 오독을 막을 수 있다. 코드 변경은 불필요(이미 정합).

## 확인했으나 충돌 없음 (참고)

- `error.code`/`nodeId` nullable 전환(§6.4, 필드 집합 표)은 `spec/1-data-model.md` §2.13 `Execution.error ↔ NodeExecution.error 관계` 서술(`{ nodeId: "uuid" | null, code: "ERROR_CODE" | null, ... }`, 이번 PR 이전부터 존재)과 **이미 일치** — 새 모순 없음.
- `chat-channel-adapter.md` §1.2 `EiaEvent` union 의 `execution.failed.error.code: string | null` 변경은 `spec/5-system/15-chat-channel.md` CCH-ERR-04(`error.code === null` → `executionFailedInternal` fallback, PR 이전부터 존재)·`chat-channel-adapter.md` §3.1 분류표(`error.code === null` 포함 unknown fallback, PR 이전부터 존재)와 정합.
- `WORKER_HEARTBEAT_TIMEOUT` / `EXECUTION_QUEUE_WAIT_TIMEOUT` / `WEBCHAT_IDLE_TIMEOUT` 코드 자체의 정의·소유 절(§7.1/§8/EIA-RL-07)은 `spec/5-system/4-execution-engine.md`, `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md` 전 영역에서 서로 동일하게 서술되어 있음 — 이번 diff 는 이 코드들의 의미를 바꾸지 않았다.
- `spec/5-system/6-websocket-protocol.md` §4.1 은 `execution.failed`/`execution.completed`/`execution.cancelled` 필드를 "…필드 집합…" 으로만 가리키고 EIA §6 을 SoT 로 위임 — target 의 필드 집합 갱신과 충돌 없음(포인터 원칙 준수).
- `cancelled` 의 `error` 는 여전히 `{code, message}` 만 수동 구성(`nodeId`/`details` 없음, §6.4 필드 집합 표에 명시)이고, `chat-channel-adapter.md` §1.2 의 `execution.cancelled` variant 도 `error?: { code: string; message?: string }` 로 `nodeId`/`details` 를 요구하지 않아 — 이 갭은 두 문서가 **일관되게** 같은 미완성 상태를 반영하고 있어 충돌이 아니라 정합.
- `EiaFailedEvent`(codebase `types.ts`, spec-linked)의 `nodeId?: string | null`(optional 유지)과 `chat-channel-adapter.md` §1.2 `EiaEvent` 의 `nodeId: string | null`(필수)은 서로 다른 계약층(전자=consumer 타입, 후자=producer wire 계약)으로 문서 자체에 그 구분이 명시돼 있어 모순 아님.
- 신규 요구사항 ID 추가 없음(기존 EIA-* ID 표 변경 없음) — ID 재사용/충돌 해당 없음.
- RBAC/권한 모델, 계층 책임 분할 변경 없음 — 카테고리 5·6 해당 사항 없음.

## 요약

이번 target 변경(§6.4 필드 집합·페이로드 예시 갱신, `chat-channel-adapter.md` union 의 `error.code` nullable 화)은 `toTerminalErrorPayload` 헬퍼 도입으로 실제 emit 이 4개 경로 전부 object 로 일원화된 사실을 spec 에 반영한 것으로, `spec/1-data-model.md`·`spec/5-system/4-execution-engine.md`·`spec/5-system/3-error-handling.md`·`spec/5-system/15-chat-channel.md`·`spec/conventions/chat-channel-adapter.md`·`spec/conventions/error-codes.md` 등 관련 영역과 폭넓게 대조한 결과 데이터 모델·API 계약·요구사항 ID·RBAC·계층 책임 어느 축에서도 CRITICAL/WARNING 급 모순은 발견되지 않았다. 유일한 소견은 §6.4 자체 안에서 취소 전용 에러코드(`RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT`)가 `failed` 전용 코드와 나란히 열거되어 스코프가 흐려진 문구 수준의 INFO 이며, 표 자체(필드 집합·행동 계약)는 서로 모순되지 않는다.

## 위험도

LOW
