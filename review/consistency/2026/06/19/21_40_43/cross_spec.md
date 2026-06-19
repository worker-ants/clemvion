# Cross-Spec 일관성 검토 결과

Target: `plan/in-progress/spec-draft-c1-spec-drift.md`

---

## 발견사항

### 1. **[WARNING]** 변경 1c: `retryLastTurn`/`applyRetryLastTurn` 엔진 잔류 vs. 제거 — 본문 §3 설명과 Rationale L1464 의 이중 기술

- **target 위치**: draft 변경 1c — L1463 NEW 에서 `retryLastTurn`·`applyRetryLastTurn`·`resumeGraphAfterRetry`·`completeRetryExecution`·`failRetryExecution` 전부를 `RetryTurnService` 소유로 명시하고 "외부 진입점이 `RetryTurnService` 를 직접 호출" 한다고 기술. L1464 NEW 는 엔진 잔류 목록에서 `retryLastTurn`·`applyRetryLastTurn` thin delegator 를 제거.
- **충돌 대상**: `spec/5-system/4-execution-engine.md` L193 (§3 본문 callout) — "retry(`applyRetryLastTurn`·`resumeGraphAfterRetry` 등)는 `RetryTurnService`" 라고 이미 기술하면서도, L1463-1464(현재 Rationale) 은 "엔진은 thin forwarding delegator 진입점만 잔류" + "외부 진입점(`retryLastTurn`·`applyRetryLastTurn` thin delegator)" 를 동시에 서술한다. 즉 §3 본문은 이미 "RetryTurnService 에 있다" 고 하는데 Rationale 은 "엔진에도 thin delegator 가 잔류한다" 고 하여 본문 vs. Rationale 이 현재도 모순된 상태.
- **상세**: draft 가 제안하는 L1463/L1464 갱신은 이 모순을 해소하는 방향이 맞다. 그러나 §3 L193 callout("엔진 내부 통신 = `EngineDriver`" 주석 하단)도 "retry(`applyRetryLastTurn`·`resumeGraphAfterRetry` 등)는 `RetryTurnService`" 라고 하므로, draft 적용 후에도 §3 body 와 Rationale 이 정합한지 확인이 필요하다. 별도로 spec §4.2 WS retry 설명 (L1391: "`execution.retry_last_turn`(기대 상태 = `failed`) 도 동일 의미로 재사용") 에 "게이트웨이가 직접 RetryTurnService 를 호출한다"는 표현이 없어 구현과 괴리.
- **제안**: 변경 1c 를 적용할 때 §3 L193 callout 도 함께 "외부 진입점(`websocket.gateway`·`continuation-execution.processor`)이 `RetryTurnService` 를 직접 호출" 로 동기화. §4.2 WS 사용처 설명도 동반 갱신 권장.

---

### 2. **[WARNING]** 변경 1e: `ExecutionEventEmitter→WebsocketService` forwardRef 가 §4.4 "추상화 금지" 정책과 의미 충돌 가능성

- **target 위치**: draft 변경 1e — "ws.service↔gateway↔retry↔event-emitter ES-module 순환은 `ExecutionEventEmitter→WebsocketService` forwardRef 지연 해석" 으로 해소.
- **충돌 대상**: `spec/5-system/4-execution-engine.md §4.4` (L438) — "별도 추상화(`IExecutionEventEmitter` 같은 인터페이스 / Nest `EventEmitter2`)를 도입하지 않는다". 그리고 L1466 Rationale 에는 "추출 서비스도 `ExecutionEventEmitter` 직접 주입을 유지한다" 고 이미 언급되어 있으나, §4.4 본문에는 `ExecutionEventEmitter` 라는 facade 가 무엇인지 전혀 기술되지 않은 상태.
- **상세**: 코드(`execution-event-emitter.service.ts`)에는 `ExecutionEventEmitter` 가 `WebsocketService` 의 thin facade 로 존재하며 C-1 후속 ④ 분할의 결과물이다. 그러나 §4.4 는 여전히 "WebsocketService 가 canonical, 추상화 금지" 라는 기존 결정만 기술하고, 이 facade 가 등장한 이유·범위·§4.4 와의 관계를 설명하지 않는다. draft 변경 1e 가 Rationale 에 이 facade 를 추가하면, §4.4 본문과 긴장이 생긴다.
- **제안**: 변경 1e 적용 시 §4.4 본문에 "thin delegation facade `ExecutionEventEmitter` 는 추상화 계층이 아니라 forwardRef DI 해소 + call-site 일원화를 위한 동형 래퍼이며 §4.4 정책의 예외가 아님" 취지의 주석 한 줄을 추가. 또는 Rationale "C-1 god-class" 섹션 끝에 §4.4 와의 관계를 명시.

---

### 3. **[WARNING]** 변경 4: `LLM_PROVIDER_QUOTA`·`LLM_API_ERROR` 미등록 코드 passthrough — §10 에러 코드 표와의 정합 필요

- **target 위치**: draft 변경 4 — "미등록 vendor 코드(예: `LLM_PROVIDER_QUOTA`·`LLM_API_ERROR`)도 그대로 보존(passthrough)·`retryable=false`". `§10 단일 LLM taxonomy 유지` 근거로 별도 `AI_*` fallback 미사용 확인.
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §10` (L1083-1099) — 에러 코드 표는 `LLM_CALL_FAILED`, `LLM_RATE_LIMIT`, `LLM_RESPONSE_INVALID`, `TOOL_EXECUTION_FAILED`, `MAX_TOOL_CALLS_EXCEEDED` 만 열거하고, passthrough 경로는 "분류 불가 fallback → `LLM_CALL_FAILED`(non-retryable)" 으로 기술. L1099 분류 규칙도 "status·code·network 신호가 모두 없으면 `LLM_CALL_FAILED` fallback" 으로 쓰여 있어 passthrough 패스가 보이지 않는다.
- **상세**: 코드가 passthrough 를 구현했다면 §10 분류 규칙 설명과 직접 모순. "등록 code 는 보존, 미등록은 LLM_CALL_FAILED fallback" 이 현 spec 의 의미인지, "등록/미등록 모두 보존" 인지 spec 을 읽고는 알 수 없다. `LLM_PROVIDER_QUOTA`·`LLM_API_ERROR` 가 실제로 어떤 provider 로부터 관측되는 코드인지도 spec 에 없다.
- **제안**: 변경 4 적용 시 §10 분류 규칙 문단 끝에 "provider SDK 가 명시 code 를 포함해 throw 하면 code 보존(passthrough)·`retryable=false` — 별도 `AI_*` 코드로 래핑하지 않는다. `status`·`code`·network 신호가 **모두** 없는 경우에만 `LLM_CALL_FAILED` fallback." 을 추가. `LLM_PROVIDER_QUOTA`·`LLM_API_ERROR` 가 예시이면 에러 코드 표에 "(passthrough 예시)" 로 행을 추가해 카탈로그 가시성 확보.

---

### 4. **[WARNING]** 변경 3: `spec/5-system/3-error-handling.md §1.4/§3.2` 확장이 `spec/4-nodes/2-flow/0-common.md §1.4` 와 동기화 필요

- **target 위치**: draft 변경 3 — §1.4/§3.2 의 Sub-workflow 행을 `SUB_WORKFLOW_FAILED · SUB_WORKFLOW_NOT_FOUND · SUB_WORKFLOW_TIMEOUT · SUB_WORKFLOW_QUEUE_FAILED` 4종으로 확장.
- **충돌 대상**: `spec/4-nodes/2-flow/0-common.md` L51-52 — "SUB_WORKFLOW_NOT_FOUND / SUB_WORKFLOW_TIMEOUT / 그 외 generic SUB_WORKFLOW_FAILED" + "SUB_WORKFLOW_QUEUE_FAILED" 로 이미 4종 모두 기술. 반면 `spec/5-system/3-error-handling.md §1.4/§3.2` 는 `SUB_WORKFLOW_FAILED` 단독 행으로 stale.
- **상세**: 이미 `1-workflow.md §6` 과 `2-flow/0-common.md` 에 4종이 정의되어 있으므로 변경 3 의 방향은 정확하다. §3.2 에도 동일 링크·형식을 추가해야 한다.
- **제안**: 변경 3 적용 시 §3.2 행도 §1.4 와 완전히 동일한 형태(링크 포함)로 작성 확인.

---

### 5. **[INFO]** 변경 5b: `mcpDiagnostics?` 필드가 `0-common.md §6` 표에는 없지만 §7 본문에 이미 존재

- **target 위치**: draft 변경 5b — `meta.turnDebug` 행에 `mcpDiagnostics?` 추가 제안.
- **충돌 대상**: `spec/4-nodes/3-ai/0-common.md §6` (L106) — 표의 `meta.turnDebug` 는 `[{ turnIndex, llmCalls, totalDurationMs, toolCalls?, ragSources?, ragDiagnostics? }]` 로 `mcpDiagnostics?` 가 없음. 그러나 §7 (L112) 에는 "turn 단위 delta 가 `meta.turnDebug[i].{ragSources, ragDiagnostics, mcpDiagnostics}`" 이 명시되어 있다.
- **상세**: §6 표와 §7 본문이 이미 inconsistent 한 상태. draft 의 변경 5b 가 §6 표를 §7 과 정합하게 만드는 수정이므로 올바른 방향이며 충돌 없음.
- **제안**: 변경 5b 적용 후 §6 표와 §7 정합 확인.

---

### 6. **[INFO]** 변경 6: presentation `0-common.md §4.5` `button_continue` shape 이 `node-output.md §4.5` 와 이미 정합

- **target 위치**: draft 변경 6 — presentation `0-common.md §4.5` L131 `button_continue` 의 `url` 을 조건부(`url?`)로, `selectedItem?` 추가.
- **충돌 대상**: `spec/conventions/node-output.md` L259 — 이미 `{ buttonId, buttonLabel, url?, selectedItem? }` 로 정의됨. presentation `0-common.md §4.5` 현재 값은 `{ buttonId, buttonLabel, url }` (조건부 아님, `selectedItem?` 없음) 으로 stale.
- **상세**: draft 의 변경 6 방향은 `node-output.md` 와의 정합을 이루는 수정이다. 충돌 없음.
- **제안**: 변경 6 적용 후 presentation `0-common.md` L131 이 `node-output.md §4.5` 와 일치하는지 확인.

---

### 7. **[INFO]** 변경 2: `executeSync` 가 현재 spec 에 없는 메서드명

- **target 위치**: draft 변경 2 — W-6 callout 갱신에서 진입점을 "`executeInline`/`executeSync`/`executeAsync`" 로 명시.
- **충돌 대상**: `spec/4-nodes/2-flow/1-workflow.md` L103-104 — 진입점은 `executeInline` (sync) 와 `executeAsync` (async) 두 가지. 현재 spec 어디에도 `executeSync` 라는 메서드는 없음.
- **상세**: `executeSync` 는 실제 코드에 없는 이름으로 보인다. sync 경로 = `executeInline` 이 canonical.
- **제안**: 변경 2 에서 `executeSync` 를 제거하고 `executeInline`/`executeAsync` 두 가지만 표기.

---

## 요약

target draft 가 제안하는 6개 변경은 전반적으로 코드 실체에 맞춰 stale spec 을 갱신하는 방향이며, CRITICAL 충돌은 없다. 가장 주목할 WARNING 은 두 가지다: (1) 변경 4 의 "미등록 vendor 코드 passthrough·`retryable=false`" 가 `ai-agent.md §10` 의 기존 "분류 불가 fallback → `LLM_CALL_FAILED`" 설명과 명시적 모순을 일으킨다 — §10 표와 분류 규칙 문단을 함께 갱신하지 않으면 두 경로가 spec 에 동시에 존재한다. (2) 변경 1c·1e 가 `retryLastTurn`/`applyRetryLastTurn` 이 엔진에서 제거됐음을 Rationale 에 반영하지만, spec §3 본문 callout(L193) 과 §4.2 WS 사용처 설명이 함께 갱신되지 않으면 spec 내 이중 기술 상태가 지속된다. 나머지 항목(변경 3 §1.4/§3.2 동기화, 변경 5b `mcpDiagnostics?` 표 정합, 변경 6 shape 정합)은 draft 적용으로 해소되는 stale 상태이며 충돌이 아닌 동기화 작업이다. `executeSync` 오타 가능성(변경 2)은 경미한 명명 불일치다.

## 위험도

MEDIUM
