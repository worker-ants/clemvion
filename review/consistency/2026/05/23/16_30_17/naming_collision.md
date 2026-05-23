# 신규 식별자 충돌 검토 — multiturn-error-preserve

> target: `plan/in-progress/multiturn-error-preserve.md`
> 검토 일자: 2026-05-23

---

## 발견사항

### [INFO] `retryAfterSec` 는 기존 `output.error.details` 에 이미 존재
- **target 신규 식별자**: `output.error.details.retryAfterSec` — `spec/conventions/node-output.md` Principle 3.2 의 표준 필드로 추가 예정
- **기존 사용처**: `spec/4-nodes/3-ai/1-ai-agent.md` line 827 — §7.9 Multi Turn 오류 예시 JSON 에 이미 `"details": { "provider": "anthropic", "statusCode": 429, "retryAfterSec": 30 }` 형태로 기술되어 있음
- **상세**: 동일 식별자가 동일 의미(provider 가 반환한 재시도 대기 시간, 초 단위)로 사용 중이라 의미 충돌은 없다. 단, target 이 이 필드를 "표준 필드"로 격상해 `node-output.md` Principle 3.2 에 명시하는 것이 목표인데, 현재는 AI Agent 전용 예시에만 암묵적으로 존재한다. 신규 도입이 아니라 격상이므로 실질 충돌은 없으나, `retryable: boolean` 필드는 아직 어떤 spec 파일에도 존재하지 않는다 — 진정한 신규 필드.
- **제안**: `node-output.md` Principle 3.2 에 `retryable` (필수)·`retryAfterSec?` (선택) 추가 시, 기존 `1-ai-agent.md §7.9` 예시의 `details` 에도 `retryable: true` 를 추가해 단일 진실을 유지한다. 중복 정의 없이 cross-ref 만 두는 구조가 적합.

---

### [INFO] `system_error` — `ConversationTurnSource` enum 에 신규 값, 기존 `system` 과 의미 범주 인접
- **target 신규 식별자**: `ConversationTurnSource` 의 새 값 `system_error` (`spec/conventions/conversation-thread.md §1.1`)
- **기존 사용처**: `spec/conventions/conversation-thread.md §1.1` line 19 에 `system` 이 "예약 (v1 자동 push 없음)" 으로 정의됨. 프론트엔드 `codebase/frontend/src/lib/conversation/conversation-utils.ts` line 14–19 에서 `ConversationTurnSource` 타입이 `"ai_user" | "ai_assistant" | "ai_tool" | "presentation_user" | "system"` 5값으로 선언됨.
- **상세**: `system` 과 `system_error` 는 prefix 공유 (`system_` 유사 패턴). spec §1.1 의 `system` 은 "수동 push 전용 예약값"이고, 신규 `system_error` 는 "노드 실패 인라인 표시" — 의미 충돌은 없다. 다만 기존 프론트엔드 코드가 5값 union 으로 `ConversationTurnSource` 를 선언하고 있으며, `conversation-utils.ts` line 264 에 `"unknown ConversationTurnSource"` fallback 분기가 있어 `system_error` 추가 시 해당 fallback 이 발화하지 않으려면 enum 업데이트가 필수이다. 이미 plan §B 에서 다루고 있으나, 누락 시 기존 `threadTurnsToConversationItems` 가 `system_error` 항목을 unknown 처리해 UI 에서 사라지는 회귀 발생 가능.
- **제안**: `conversation-utils.ts` 의 `ConversationTurnSource` type union 에 `"system_error"` 를 추가할 때, 기존 `switch` / `if-else` 분기 모두에 명시적 케이스를 추가하고 default/fallback 은 TypeScript exhaustiveness check 로 보강한다.

---

### [INFO] `Inv-6` — 기존 Inv-1 ~ Inv-5 와 번호 연속. 간격 없음
- **target 신규 식별자**: `Inv-6` ("노드 실패 / 실행 실패 시 store `conversationMessages` 는 비워지지 않는다 — `startExecution` 만 클리어한다") — `spec/conventions/conversation-thread.md §9.9`
- **기존 사용처**: `spec/conventions/conversation-thread.md §9.9` line 452–456 에 `Inv-1` ~ `Inv-5` 가 정의됨. `Inv-N` 레이블은 "본 §9.9 스코프 한정"으로 명시되어 있음.
- **상세**: 의미 충돌 없음. 번호가 연속적으로 이어지므로 명명 충돌이 없다. `Inv-6` 은 스토어 보존 정책이고, `Inv-1`~`Inv-5` 는 tool-call 시각 그룹핑 invariant — 의미 범주가 다르지만 동일 §9.9 에 공존하는 것은 spec 현행 구조상 자연스럽다.
- **제안**: 충돌 없음. 다만 Inv 번호가 지속 추가되면 의미 범주를 주석으로 구분하는 것을 고려(예: "Store 정책 invariant" vs "UI 그룹핑 invariant").

---

### [INFO] `CT-S9` / `CT-S10` — 기존 CT-S1 ~ CT-S8 과 번호 연속. 간격 없음
- **target 신규 식별자**: `CT-S9` ("멀티턴 AI Agent 가 retryable error 로 종결 시 thread 가 store 에 보존되고 system_error item 이 APPEND"), `CT-S10` ("non-retryable error 종결 시 thread 보존 + [다시 시도] 버튼 미노출") — `spec/conventions/conversation-thread.md §9.10`
- **기존 사용처**: `spec/conventions/conversation-thread.md §9.10` line 464–471 에 `CT-S1` ~ `CT-S8` 이 정의됨. `CT-S*` ID 는 "본 §9.10 스코프 한정"으로 명시되어 있음.
- **상세**: 의미 충돌 없음. CT-S8 다음에 CT-S9, CT-S10 을 추가하는 것은 기존 패턴과 완전히 정합한다.
- **제안**: 충돌 없음.

---

### [INFO] `execution.retry_last_turn` — WS 명령 네임스페이스 정합 확인 필요
- **target 신규 식별자**: WS 명령 `execution.retry_last_turn` (`spec/5-system/6-websocket-protocol.md §4.2`)
- **기존 사용처**: `spec/5-system/6-websocket-protocol.md §4.2` line 188–197 에 `execution.start`, `execution.stop`, `execution.continue`, `execution.step`, `execution.submit_form`, `execution.click_button`, `execution.submit_message`, `execution.end_conversation` 이 정의됨.
- **상세**: 의미 충돌 없음. `execution.*` 네임스페이스 안의 기존 명령과 이름이 겹치지 않는다. 기존 명령들의 패턴 (`execution.<동사>_<대상>`) 과 일관성을 유지한다 (`retry_last_turn` = 동사 `retry` + 대상 `last_turn`).
- **제안**: 충돌 없음. ack 응답 타입도 `execution.retry_last_turn.ack` 패턴으로 기존 `execution.start.ack` / `execution.click_button.ack` 와 정합하도록 명시 권장.

---

### [WARNING] WS 에러 코드 `INVALID_RESUME_TOKEN` — `INVALID_*` 네임스페이스 혼동 위험
- **target 신규 식별자**: WS 에러 코드 `INVALID_RESUME_TOKEN`, `NODE_NOT_RETRYABLE`, `RETRY_TOO_EARLY` (`spec/5-system/6-websocket-protocol.md §4.2`)
- **기존 사용처**: `spec/5-system/6-websocket-protocol.md §4.2` 기존 에러 코드: `INVALID_BUTTON_ID`, `INVALID_EXECUTION_STATE`, `INTERACTION_TIMEOUT` (§4.2 버튼 클릭 에러 코드 표). `SUBSCRIPTION_LIMIT_EXCEEDED` (§3.4).
- **상세**: `INVALID_RESUME_TOKEN` 은 기존 `INVALID_BUTTON_ID` / `INVALID_EXECUTION_STATE` 와 `INVALID_` prefix 를 공유한다. 충돌은 없으나 `INVALID_EXECUTION_STATE` 가 "실행이 waiting_for_input 상태가 아님"을 의미하는 반면, `INVALID_RESUME_TOKEN` 은 "retry token 이 유효하지 않거나 만료됨"을 의미해 "invalid" 의 범주가 겹칠 수 있다. 클라이언트 에러 핸들러가 `INVALID_*` prefix 로 일괄 처리하는 로직을 갖고 있다면 혼동 가능.
- **제안**: 현 이름 사용은 수용 가능. 다만 WS spec §4.2 에 새 명령의 에러 코드 표를 추가할 때 `INVALID_RESUME_TOKEN` 의 정확한 의미("_retryState token 이 DB 에 없거나 만료됨"인지 "token 형식 오류"인지)를 명시하면 클라이언트 구현자의 혼동을 줄일 수 있다.

---

### [INFO] `_retryState` — `_resumeState` 와 유사 명명, 역할 구분 명확화 필요
- **target 신규 식별자**: `_retryState` — `NodeExecution.outputData` 안에 nested 로 저장되는 내부 필드 (`spec/4-nodes/3-ai/1-ai-agent.md §7.9` 변경 및 engine `stripControlFields()` 수정 대상)
- **기존 사용처**: `_resumeState` — `spec/4-nodes/3-ai/1-ai-agent.md` line 647 에 정의. 현재 `stripControlFields()` 가 제거하는 대상. 프론트엔드에는 노출되지 않음. `_resumeState` 는 "다음 multi-turn 을 위한 internal continuation state"이고, `_retryState` 는 "retryable error 종결 후 LLM 재개를 위한 snapshot".
- **상세**: 두 필드는 같은 top-level 위치 (`NodeHandlerOutput` 외 top-level) 를 공유하고 `_` prefix 로 "internal" 을 표시하는 관례도 공유한다. 역할은 분리되어 있다 — `_resumeState` 는 진행 중 상태 (waiting_for_input 동안 살아있음), `_retryState` 는 error 종결 후 복원용 snapshot. 혼동 가능성: `stripControlFields()` 를 수정할 때 `_resumeState` 는 strip 하고 `_retryState` 는 보존하는 분기가 추가된다. 이 분기가 명확하지 않으면 유지보수 시 두 필드가 혼동되어 잘못 처리될 수 있다.
- **제안**: spec AI Agent §7.4 의 `_resumeState` 표에 `_retryState` 와의 차이를 명시하는 한 줄 note 추가 권장. 예: "_retryState 와의 차이: _resumeState 는 waiting_for_input 중 유지되다가 engine 이 strip. _retryState 는 retryable error 종결 시 보존되어 retry_last_turn 진입 시 소비됨".

---

### [INFO] `CLEAR_INPUT_AFFORDANCE` / `CLEAR_CONVERSATION_SNAPSHOT` — codebase 상수명 신규 도입
- **target 신규 식별자**: `CLEAR_INPUT_AFFORDANCE`, `CLEAR_CONVERSATION_SNAPSHOT` — `codebase/frontend/src/lib/stores/execution-store.ts` 의 새 상수 (기존 `CLEAR_WAITING` 분리)
- **기존 사용처**: `codebase/frontend/src/lib/stores/execution-store.ts` line 265 에 `CLEAR_WAITING` 상수가 존재하며 line 300, 370, 383, 386, 403, 416, 430, 521 에서 spread 됨.
- **상세**: `CLEAR_WAITING` 이 split 되므로 기존 상수명이 제거(또는 deprecated) 되고 두 새 상수가 그 자리를 나눈다. spec (`conversation-thread.md §9.7`) 에서 새 상수명을 명시적으로 언급하므로 codebase 와 spec 사이에 이름 alignment 의무가 생긴다. spec 에서 상수명을 직접 정의하는 것은 드문 패턴이며, 구현 세부사항이 spec 에 노출된 형태이다.
- **제안**: spec §9.7 에서 상수명 자체보다 "store reset 정책" 의미를 명세하고, 상수명은 구현 세부사항으로 두는 것이 drift 방지에 유리하다. 그러나 기존 spec 이 store 변환 계약(§9.7)을 명시적으로 정의하는 방식이므로 현행 패턴 내에서 일관성 유지로 충분하다.

---

### [INFO] `resumeToken` — `output.error.details` 의 신규 필드
- **target 신규 식별자**: `output.error.details.resumeToken: string` (opaque) — retryable error 종결 시 `NodeExecution.outputData` 와 함께 클라이언트로 전달되는 token
- **기존 사용처**: 현재 `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 의 `details` 는 `{ "provider", "statusCode", "retryAfterSec" }` 만 정의. `spec/conventions/node-output.md` Principle 3.2 의 `details` 는 "optional, 노드별 스키마"로 자유 형식.
- **상세**: `resumeToken` 은 spec 내 어디에도 기존에 사용되지 않으므로 충돌 없음. 다만 "opaque token" 이라고 plan 에 기술된 것과 달리 클라이언트가 이 token 을 `execution.retry_last_turn` 페이로드에 포함하지 않고 `nodeExecutionId` 만 전송하는 것으로도 backend 가 `_retryState` 를 조회할 수 있다. plan §C 의 `execution.retry_last_turn` payload 가 `{ executionId, nodeExecutionId }` 이고 `resumeToken` 을 payload 에 포함하지 않는다 — 즉 `resumeToken` 은 클라이언트가 사용하는 token 이 아니라 backend 가 내부적으로 `_retryState` lookup key 로 사용하는 값. 이 경우 `output.error.details.resumeToken` 을 클라이언트에 노출할 필요가 있는지 재검토가 유용하다.
- **제안**: `resumeToken` 이 클라이언트 UX (버튼 클릭 시 전송)에 실제로 사용된다면 WS spec §4.2 의 `execution.retry_last_turn` payload 에 포함 여부를 명시. 단순 backend 내부 key 라면 `output.error.details` 에 노출하지 않고 DB 레벨에서만 관리하는 편이 간결하다.

---

## 요약

신규 식별자 충돌 관점에서 치명적 혼선은 발견되지 않았다. `retryAfterSec` 는 동일 의미로 이미 `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 예시에 암묵적으로 존재하므로 진정한 신규 도입이 아니라 표준화 격상이다. `system_error` 는 기존 `system` source 와 prefix 가 유사하지만 의미 범주가 명확히 구분되어 있고, 프론트엔드 `ConversationTurnSource` type 에 `system_error` 를 누락하면 기존 fallback 분기가 발화하는 회귀 위험이 있다. `Inv-6`, `CT-S9/CT-S10` 은 기존 번호 체계와 연속적으로 정합한다. `_retryState` 와 `_resumeState` 의 유사 명명은 `stripControlFields()` 구현 수정 시 혼동 가능성이 있으므로 spec 에 두 필드의 생명주기 차이를 명시할 것을 권장한다. `INVALID_RESUME_TOKEN` 등 신규 WS 에러 코드는 기존 패턴과 일관성이 있다. 전체적으로 의미 충돌은 없고, 구현 및 문서 일관성 보완 권고가 주를 이룬다.

---

## 위험도

LOW
