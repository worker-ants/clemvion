# Cross-Spec 일관성 검토 결과

**대상 문서**: `plan/in-progress/multiturn-error-preserve.md`
**검토 일시**: 2026-05-23
**검토 모드**: spec draft 검토 (--spec)

---

## 발견사항

### [CRITICAL] `_resumeState` 의 "DB 저장 시 strip" 정책과 `_retryState` 보존 정책 충돌

- **target 위치**: Plan §C "작업 축 C. Retryable error 분기 + 재시도 UX" — R1 채택 설명 및 §C 마지막 `_retryState` 보존 정책 상세
- **충돌 대상**: `spec/5-system/4-execution-engine.md §1.3` ("최종 출력 저장 시 엔진이 `_resumeState` / `_multiTurnState` 양쪽 모두를 제거한다") 및 `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 필드 설명 ("credential / 내부 상태 보호 — DB 저장 시 strip")
- **상세**: 현행 실행 엔진 spec 의 `stripControlFields()` 는 `_resumeState` 를 최종 출력 저장 시 무조건 제거한다. target 은 retryable error 종결 시 `_retryState` (= `_resumeState` snapshot) 를 `NodeExecution.outputData` 에 **보존**하도록 `stripControlFields()` 를 분기하겠다고 제안한다. 두 개의 spec 문서가 서로 다른 "strip 여부" 정책을 정의하게 된다 — 어느 한 쪽이 변경 없이는 양립 불가.
- **제안**: `spec/5-system/4-execution-engine.md §1.3` 의 "양쪽 모두를 제거한다" 문장을 "retryable error 종결 시 `_retryState` 는 예외적으로 보존 (§7.9 retryable 경로)" 조건부 문장으로 갱신. `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 의 `_resumeState` 필드 설명 비고에도 동일 조건 cross-ref 추가.

---

### [CRITICAL] WS 신규 명령 `execution.retry_last_turn` 이 `spec/5-system/6-websocket-protocol.md §4.2` 표에 미존재

- **target 위치**: Plan §C "새 WS 명령 `execution.retry_last_turn`" + "영향 spec" 표의 `spec/5-system/6-websocket-protocol.md §4.2` 행
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2` 현행 표 — `execution.start`, `execution.stop`, `execution.continue`, `execution.step`, `execution.submit_form`, `execution.click_button`, `execution.submit_message`, `execution.end_conversation` 만 정의되어 있음. `execution.retry_last_turn` 없음.
- **상세**: target 이 "영향 spec" 표에 §4.2 갱신을 명시하고 있으므로 이 자체가 gap 은 아니다. 그러나 target 의 ack 응답 형식, 에러 코드 (`INVALID_RESUME_TOKEN`, `NODE_NOT_RETRYABLE`, `RETRY_TOO_EARLY`) 가 현재 §4.2 의 기존 명령 ack 패턴과 일치하는지 검토가 필요하다. 특히 기존 `execution.submit_form.ack` 같은 패턴 (`type: "execution.<명령>.ack"`) 을 따르는지, `execution.retry_last_turn.ack` 형태여야 하는지 target 이 명시하지 않는다. 명령을 추가할 때 이 패턴을 따르지 않으면 WS 프로토콜 일관성이 깨진다.
- **제안**: target spec 또는 plan 에 ack type 형태 (`execution.retry_last_turn.ack`) 를 명시. `spec/5-system/6-websocket-protocol.md §4.2` 갱신 시 기존 ack 패턴과 동일한 형태로 정의.

---

### [WARNING] `ConversationTurnSource` 에 `system_error` 추가 — `system` source 의 "예약" 의미와 구분 모호성

- **target 위치**: Plan §B "ConversationTurnSource 에 새 source `system_error` 추가" 및 "영향 spec" 표 `spec/conventions/conversation-thread.md §1.1`
- **충돌 대상**: `spec/conventions/conversation-thread.md §1.1` 현행 표 — `system` 항목의 설명이 "명시적으로 push 한 system text (예약, v1 자동 누적 없음). **주의**: AssistantMessage `role: 'system'` 과 무관" 이며, §1.1 에는 `system_error` 행이 없음. §9.1 시각 매핑 표도 `system` 만 정의되어 있고 `system_error` 없음.
- **상세**: target 이 `system_error` 를 신규 source 로 추가하는 것은 §1.1 표 및 §9.1 표의 변경을 수반하므로 "영향 spec" 에 이미 명시되어 있어 자기 인식은 있다. 그러나 현행 `system` 의 비고에 "v1 자동 push 없음" 이 있고, 새 `system_error` 는 WS 이벤트 핸들러가 자동으로 APPEND 하는 동작이다. 두 source 의 명명이 prefix 공유(`system_*`) 라 코드 단에서 `source.startsWith('system')` 패턴이 잘못 묶어 처리하는 회귀 위험이 있다. §9.2 시각 구분 신호 표(아이콘 매핑)에 `system_error` 아이콘이 현재 지정되지 않아 `❌` 아이콘을 기존 `ℹ️` 체계와 함께 정의하면 Inv-1 ~ Inv-5 가 `system_error` source 를 어떻게 처리하는지 불명확하다.
- **제안**: §1.1 표에 `system_error` 추가 시 §9.2 아이콘 목록에도 동시에 `❌` 를 추가하고 "서로 겹치지 않는 글리프" 목록을 갱신. 시각 구분 3중 신호 (아이콘·컨테이너·chip) 가 `system_error` 에도 동일하게 적용됨을 §9.2 에 명시. §9.9 Invariants 의 Inv-1 ~ Inv-5 설명에 `system_error` source 가 tool-call group 로직에 흡수되지 않음을 명시 (§B 의 "system_error item 은 parent 그룹 child 로 흡수되지 않는다" 와 정합).

---

### [WARNING] `output.error.details` 의 `retryable` 필드가 `spec/conventions/node-output.md §3.2` 현행 정의와 불일치

- **target 위치**: Plan §C "output.error.details 에 두 신규 표준 필드 명시" — `retryable: boolean` (필수), `retryAfterSec?: number`
- **충돌 대상**: `spec/conventions/node-output.md Principle 3.2` 현행 정의 — `output.error` 구조가 `{ code, message, details?: { /* optional, 노드별 */ } }` 로 정의되어 있고, `details` 는 "선택적, 노드별 스키마" 로만 언급. `retryable` 필드는 현재 존재하지 않음. §3.3 "에러 포트 보유 노드" 에도 retryable 분류 의무 없음.
- **상세**: target 이 `details.retryable` 을 "필수" 로 명시하면서 `spec/conventions/node-output.md §3.2` 의 `details` 가 "optional, 노드별" 임과 모순된다. target 의 "영향 spec" 표에 `node-output.md Principle 3.2` 갱신이 명시되어 있으나, §3.3 에서 "retryable 분류 의무 명시" 를 추가하면 기존에 `details` 를 emit 하지 않던 노드들 (`send_email`, `database_query`, `http_request` 등) 도 `retryable` 을 설정해야 하는지 불명확해진다. 특히 `code` 가 LLM 관련이 아닌 노드에서 `retryable=false` 를 항상 명시해야 하는지 여부가 정의되지 않으면 schema 불완전성이 남는다.
- **제안**: `node-output.md §3.2` 갱신 시 "LLM 계열 노드 (`ai_agent`, `text_classifier`, `information_extractor`) 에서만 `retryable` 필수, 기타 노드는 선택" 으로 범위를 명시. `§3.3` 에도 동일 범위 한정 추가. target 의 plan §C "AI Agent (그리고 점진적으로 다른 LLM 노드)" 설명과 정합.

---

### [WARNING] `spec/conventions/conversation-thread.md §9.7` store 변환 계약에 `node.failed` 처리가 현재 정의되지 않음 — target 의 추가 정책과 충돌 가능

- **target 위치**: Plan §C "WS `execution.node.failed` 또는 `output.error` 가 set 된 `execution.node.completed` 수신 시 store 가 `conversationMessages` 마지막에 `system_error` 항목을 APPEND"
- **충돌 대상**: `spec/conventions/conversation-thread.md §9.7` 현행 표 — 5개 이벤트 (`tool_call_started`, `tool_call_completed`, `ai_message`, `waiting_for_input` 2종) 만 정의. `node.failed` 와 `node.completed` (with error) 이벤트에 대한 mutation 정책이 없음. `spec/5-system/6-websocket-protocol.md §4.1` 표에도 `execution.node.failed` payload 에 `error.details.retryable` 이 현재 없음.
- **상세**: target 은 §9.7 에 두 이벤트 행을 추가하고 §9.10 에 CT-S9 / CT-S10 시나리오를 신설하겠다고 명시하므로 갱신 계획은 있다. 그러나 `execution.node.failed` 의 현행 payload `{ executionId, nodeId, nodeExecutionId, nodeName, error }` 에서 `error` 가 `output.error` 풀 구조를 운반한다는 가정 (`spec/5-system/6-websocket-protocol.md §4.1` 에 명시 예정) 이 현재 검증되지 않았다. §4.1 현행 표에서 `execution.node.failed` 의 `error` payload 구조는 단순히 `error` 로만 기재되어 있어 `output.error.details` 를 포함하는지 불명확하다.
- **제안**: `spec/5-system/6-websocket-protocol.md §4.1` 에 `execution.node.failed` payload 의 `error` 가 `{ code, message, details?: { retryable?, retryAfterSec?, ... } }` 임을 명시하는 작업을 target 의 "영향 spec" 에 포함. 현재 plan 에는 "§4.1 `execution.node.failed` payload 에 `error.details.retryable` / `retryAfterSec` 신규 필드 명시" 가 있으나 `error` wrapper 자체의 구조가 `output.error` 동일 shape 임을 명시해야 §9.7 carry-over 정책이 가능하다.

---

### [WARNING] `CLEAR_WAITING` 분리 정책의 단일 SoT 위치 결정 — `spec/conventions/conversation-thread.md §9.7` vs `store` 구현 책임

- **target 위치**: Plan §A "CLEAR_WAITING 단일 묶음을 두 개로 분리" + "이 정책은 `spec/conventions/conversation-thread.md §9.7` 에 단일 정의된다. 다른 spec (3-execution §10.8 라이프사이클 표) 은 cross-ref"
- **충돌 대상**: `spec/3-workflow-editor/3-execution.md §10.8` 현행 "라이프사이클" 표 — "새 실행 시작" 행에 "이전 히스토리 클리어" 가 있고 "실행 실패" 행에 "드로어 유지. 실패 시점까지의 노드 히스토리 표시" 만 있다. `conversationMessages` 클리어 동작에 대한 언급이 없어, 현행 spec 이 실제로 `CLEAR_WAITING` 이 `conversationMessages: []` 를 spread 함을 암묵적으로 허용하고 있다고 볼 수 있다.
- **상세**: target §A 의 정책 (`startExecution` 만 두 묶음 모두 적용, 나머지는 `CLEAR_INPUT_AFFORDANCE` 만) 을 conversation-thread §9.7 SoT 에 명시하고 §10.8 은 cross-ref 만 두겠다는 설계는 타당하다. 그러나 §10.8 의 "새 실행 시작" 행 설명이 "이전 히스토리 클리어" 이므로 여기에 명시적으로 "conversationMessages 도 클리어 — §9.7 CLEAR_CONVERSATION_SNAPSHOT 참조" 를 추가하지 않으면 두 문서가 각각 부분적 진실만 담게 된다. 또한 §10.8 의 "실행 실패" 행도 conversation snapshot 보존 여부를 명시해야 spec reader 가 §9.7 을 찾지 않아도 이해할 수 있다.
- **제안**: §10.8 갱신 시 "새 실행 시작" 행에 "conversationMessages 클리어 (`CLEAR_CONVERSATION_SNAPSHOT`) — [Conversation Thread §9.7](../conventions/conversation-thread.md#97-ws-이벤트--store-변환-계약) 정책" cross-ref 추가. "실행 실패" 행도 target 이 명시한 "conversation snapshot 보존" 을 기입.

---

### [WARNING] `output.error.details.resumeToken` 이 신규 필드인데 `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 예시에 현재 없음

- **target 위치**: Plan §C R1 채택 설명 — "retryable error 종결 시 `output.error.details.resumeToken: string` (opaque) 을 운반"
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 현행 JSON 예시 — `details` 에 `provider`, `statusCode`, `retryAfterSec` 만 있음. `resumeToken` 없음.
- **상세**: target 의 "영향 spec" 표에 §7.9 JSON 예시에 `resumeToken` 추가가 명시되어 있어 계획 자체는 인식하고 있다. 그러나 `resumeToken` 이 opaque string 임에도 FE 가 `execution.retry_last_turn` 명령의 payload `{ executionId, nodeExecutionId }` 에 `resumeToken` 을 포함하지 않는 점이 주목된다. target 은 BE 가 `nodeExecutionId` 로 `_retryState` 를 조회한다고 정의한다 (WS 명령 payload 에 token 없음). 그렇다면 `resumeToken` 은 FE 가 실제로 사용하지 않는 필드인가? FE 가 retry 시 `nodeExecutionId` 만 보내고 token 은 보내지 않는다면, `resumeToken` 을 `output.error.details` 에 노출하는 이유가 불명확해진다 (FE replay 용도인지, 외부 API 용도인지).
- **제안**: Plan §C 에 `resumeToken` 의 FE 사용 여부를 명확히 기술. 사용하지 않는다면 `output.error.details` 에서 제외하거나 "향후 REST API replay 경로 예비 필드" 로 명시. 사용한다면 `execution.retry_last_turn` payload 에 포함 여부를 결정하고 §4.2 갱신에 반영.

---

### [WARNING] `spec/conventions/conversation-thread.md §9.9` Inv-6 추가 시 Inv-1 ~ Inv-5 의 스코프 표기와 일관성

- **target 위치**: Plan §B "§9.9 Inv-6 신설" — "노드 실패 / 실행 실패 시 store `conversationMessages` 는 비워지지 않는다 — `startExecution` 만 클리어한다."
- **충돌 대상**: `spec/conventions/conversation-thread.md §9.9` 현행 표 — "다음 5가지 불변량은 §9 변경 / 구현 변경 시 반드시 유지돼야 한다. `Inv-N` 레이블은 본 §9.9 스코프 한정." 이라는 서두 + Inv-1 ~ Inv-5 정의.
- **상세**: 현행 Inv-1 ~ Inv-5 는 tool-call group, timeline 항목 수, `isAssistantContentBlank`, live tool row 보존, `groupToolCallItems` 단일 결정 함수 에 관한 불변량이다. 새 Inv-6 의 주제 ("store 클리어 정책") 는 앞의 5개와 도메인이 다르다 (기존 Inv 는 conversation item 렌더 논리, Inv-6 는 store lifecycle). 이 자체는 충돌이 아니지만, §9.9 의 서두 설명 ("§9 변경 / 구현 변경 시") 이 Inv-6 에도 동일하게 적용되는지, Inv-6 는 §9 렌더 규칙 변경과 무관하게 store 정책 변경 시에도 적용되는지 확인이 필요하다. §9.7 SoT 와 Inv-6 의 중복 의미 여부도 검토 필요 (§9.7 이 이미 "startExecution 만 클리어" 를 정의하면 Inv-6 는 그것의 invariant 승격인데, 양측이 동일 조건을 중복 표기하면 drift 위험).
- **제안**: Inv-6 추가 시 §9.9 서두를 "§9 변경 또는 store lifecycle 정책 변경 시" 로 확장 수정. §9.7 SoT 정의와 Inv-6 가 동일 정책의 "정의" vs "불변량 격상" 임을 명확히 — 예: Inv-6 비고에 "정의 단일 진실: §9.7 CLEAR_INPUT_AFFORDANCE / CLEAR_CONVERSATION_SNAPSHOT 분리 정책" cross-ref.

---

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md §10` 에러 코드 표에 `LLM_RATE_LIMITED` retryable 분류 열 추가 — 기존 `§7.9` 예시의 `LLM_RATE_LIMITED` 와 정합 필요

- **target 위치**: Plan "영향 spec" 표 `spec/4-nodes/3-ai/1-ai-agent.md §7.9` + "§10 에러 코드 표에 retryable / non-retryable 분류 열 추가"
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 현행 예시 — `"code": "LLM_RATE_LIMITED"` 와 `"details": { "provider": "anthropic", "statusCode": 429, "retryAfterSec": 30 }` 가 이미 있음. `retryable` 필드는 없으나 `retryAfterSec` 가 있어 사실상 retryable 의도가 내포되어 있음.
- **상세**: target 이 `details.retryable: true` 를 추가할 때 기존 `retryAfterSec` 는 `retryable=true` 일 때만 의미 있다는 점이 spec 에서 명시되어야 한다. 또한 §10 에러 코드 표 (현재 보이지 않아 AI agent spec 의 뒷 부분에 있을 것으로 추정) 에 분류 열 추가 시, `LLM_CALL_FAILED` 가 "HTTP 5xx 분기" 와 "다른 분기" 를 모두 포함하는 코드인지 확인 필요 — target 의 "retryable=true: HTTP 5xx (`LLM_CALL_FAILED` 중 5xx 분기)" 서술이 `LLM_CALL_FAILED` 가 5xx 이상의 범위를 커버한다고 암시.
- **제안**: §7.9 갱신 시 `details.retryAfterSec` 가 `retryable=true` 케이스에서만 set 된다는 조건을 명시. §10 분류 열에서 `LLM_CALL_FAILED` 의 `retryable` 이 에러의 원인(5xx vs 인증 vs 파싱)에 따라 달라질 수 있다면 단일 행으로 표기하지 말고 sub-case 를 명시.

---

### [INFO] `spec/3-workflow-editor/3-execution.md §10.5 / §10.6` 의 retry 진입점 비고 — 현행 §10.6 탭 목록과 정합 확인 필요

- **target 위치**: Plan "영향 spec" 표 `spec/3-workflow-editor/3-execution.md §10.5 / §10.6` — "마지막 항목이 retryable system_error 이면 입력 영역 자리에 `[다시 시도]` 버튼 노출 + retryAfterSec 카운트다운"
- **충돌 대상**: `spec/3-workflow-editor/3-execution.md §10.6` 현행 탭 목록 및 §10.6.1 탭 표 — 현재 "대기 상태(waiting_for_input) 노드의 탭" 에서 "AI Multi Turn 대기: Preview 탭에 ConversationInspector(메시지 입력 포함)" 로 정의. 에러 종결 후 상태에서 retry 진입점에 대한 탭 동작이 정의되지 않음.
- **상세**: 현행 §10.6 의 "디폴트 탭 선택 우선순위" 가 "1. Error — 에러가 있으면 최우선" 이다. target 이 system_error item 을 conversation thread 안에 inline 으로 표시하면, 에러 종결 시 기존 "Error 탭 최우선" 정책과 "Preview 탭의 conversation thread 에 system_error inline" 이 어느 탭에서 사용자가 [다시 시도] 를 클릭하는지 모호해진다. Error 탭에는 기존 `output.error` JSON 이 있고 Preview 탭에는 system_error item 이 있으면 두 곳에 에러가 나타나는 이중 표시 문제가 발생할 수 있다.
- **제안**: §10.6 "디폴트 탭 선택 우선순위" 비고에 "AI multi-turn retryable error 종결 시에는 Preview (ConversationInspector 에 system_error item 과 [다시 시도] 버튼이 있음) 를 우선하고, Error 탭에는 `output.error` JSON 을 계속 표시" 방침 명시. 이중 표시 허용 여부를 spec 에 기술.

---

### [INFO] `spec/conventions/interaction-type-registry.md` 의 `system_error` 등록 필요 여부

- **target 위치**: Plan §B — `ConversationTurnSource` 에 `system_error` 추가
- **충돌 대상**: `spec/conventions/interaction-type-registry.md` — 현재 이 파일의 내용을 직접 확인하지 못했으나 파일이 존재함. interaction type 과 source 의 레지스트리가 관리된다면 신규 source 추가 시 여기에도 등록 필요.
- **상세**: `system_error` 는 `ConversationTurnSource` enum 값이므로 interaction-type-registry 에 별도 항목으로 등록해야 하는지는 해당 파일의 스코프에 따라 다르다.
- **제안**: `spec/conventions/interaction-type-registry.md` 를 검토해 `ConversationTurnSource` 값을 추적하는 경우 `system_error` 추가 여부 확인.

---

## 요약

Target 문서 (`plan/in-progress/multiturn-error-preserve.md`) 는 멀티턴 AI Agent 에러 시 대화 보존 + retryable 분기 + 재시도 UX 를 한 PR 에 구현하는 계획으로, spec 변경 면적을 "영향 spec" 표에 체계적으로 기술하고 있다. Cross-spec 일관성 관점에서 두 가지 CRITICAL 충돌이 발견된다: (1) `_resumeState` 의 "DB 저장 시 strip" 정책이 `spec/5-system/4-execution-engine.md §1.3` 과 직접 모순되어 `_retryState` 보존을 위해 해당 spec 의 무조건 strip 문장을 수정하지 않으면 두 spec 이 동시에 옳을 수 없다. (2) 신규 WS 명령 `execution.retry_last_turn` 의 ack 형태가 `spec/5-system/6-websocket-protocol.md §4.2` 기존 패턴과 명시적으로 정합되지 않아 WS 프로토콜 일관성 위험이 있다. 추가로 4개의 WARNING 이 발견된다: `system_error` source 추가 시 §9.2 아이콘 목록과 Invariant 업데이트 누락, `output.error.details.retryable` 필수성 범위 불명확, `execution.node.failed` payload 의 `output.error` 구조 미정의, `CLEAR_WAITING` 분리 정책의 §10.8 cross-ref 누락. 이들은 spec 갱신 시 함께 처리하면 해소되며 독립적 작동을 막는 수준은 아니다. 전체적으로 target 은 영향 범위를 잘 인식하고 있으나, CRITICAL 두 건은 관련 spec 파일의 선행 수정 없이는 진행 불가하다.

---

## 위험도

**HIGH**

STATUS: SUCCESS
