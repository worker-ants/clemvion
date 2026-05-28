---
worktree: multiturn-error-preserve
started: 2026-05-23
owner: project-planner
---

# Plan — 멀티턴 AI 에러 시 대화 보존 + retryable 분기 + 재시도 UX

> 사용자 합의 (2026-05-23): 멀티턴 AI Agent 가 LLM 사용량 한도(429)·rate limit·일시적 API 오류로
> 실패해도 진행 중이던 대화가 UI(타임라인 + Preview)에서 사라지지 않도록 한다. 동시에
> retryable 케이스는 "한 번 실패 = 종결" 이 아니라 인라인 [다시 시도] 버튼으로 회복 경로를 제공한다.

## 배경

(코드 추적 보고 = 2026-05-23 사용자 대화, 첨부 스크린샷 — Gemini quota 429 에러)

멀티턴 AI Agent 가 LLM 오류 (예: Gemini `code: 429`, "You exceeded your current quota")
로 종결되면 현재 프론트엔드에서 다음 증상이 발생한다:

1. 실행 트리 타임라인의 AI Agent 행은 남지만, 그 아래 펼쳐 보이던 대화 프리뷰(👤 user / 🤖 assistant / 🔧 tool 항목 전부)가 빈 상태가 된다.
2. 인스펙터의 Conversation Preview 탭도 동일하게 비어 보인다 (모든 turn 사라짐).
3. 오류 정보는 우측 "오류" 탭에서만 확인 가능 — 대화 흐름의 *어느 지점에서* 끊겼는지 사용자가 알기 어렵다.
4. 사용자가 "다시 시도" 할 진입점이 없다. 워크플로우 전체를 다시 실행해야 한다.

### 원인 (단일 라인 발화점)

`codebase/frontend/src/lib/stores/execution-store.ts:265` 의 `CLEAR_WAITING` 상수가
`conversationMessages: []` 를 포함하고, `failExecution()` (line 372) / `completeExecution()` /
`resumeFrom*()` 모두가 이걸 spread 한다. 즉 **노드 하나가 실패하면 실행 전체 live conversation snapshot 이 통째로 비워진다**.

백엔드는 데이터를 잘 보존하고 있다:
- spec [`4-nodes/3-ai/1-ai-agent.md §7.9`](../../spec/4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트): "에러 종결에서도 부분 수집 결과(`output.result.messages` 등) 와 `output.error` 가 **병존**"
- 핸들러 `ai-agent.handler.ts:2227` `buildMultiTurnFinalOutput` 도 `errorPayload` 가 있을 때 `output.result.messages` 를 함께 emit.

타임라인은 `isLiveNode = status === "waiting_for_input"` 인 동안만 store 의 `conversationMessages` 를 보고,
그 외에는 `parseHistoryMessages(result.outputData)` 로 outputData 를 fallback 으로 읽는다.
하지만 `failExecution` 이 store 를 비우는 시점과 outputData 가 도착하는 시점 사이에 frame race 가
발생하고, payload 가 누락되면 영영 빈 채로 남는다.

## 작업 축 (사용자 결정 완료 — 한 PR)

### A. 라이브 conversation snapshot 보존 (store 정책)

- `CLEAR_WAITING` 단일 묶음을 **두 개** 로 분리한다:
  - `CLEAR_INPUT_AFFORDANCE` — 입력 대기 UI 만 (`waitingNodeId`, `waitingFormConfig`, `waitingInteractionType`, `waitingButtonConfig`, `waitingConversationConfig`, `isWaitingAiResponse`, `selectedConversationItemIndex`)
  - `CLEAR_CONVERSATION_SNAPSHOT` — `conversationMessages: []`
- `completeExecution` / `failExecution` / `resumeFromForm` / `resumeFromButtons` / `resumeFromConversation` 은 `CLEAR_INPUT_AFFORDANCE` 만 적용.
- `startExecution` 만 두 묶음 모두 적용 (새 실행이라 이전 대화는 의미 없음).
- 이 정책은 `spec/conventions/conversation-thread.md §9.7` (WS 이벤트 → store 변환 계약) 에 단일 정의된다. 다른 spec (3-execution §10.8 라이프사이클 표) 은 cross-ref.

### B. 에러를 conversation thread 의 system_error item 으로 인라인 표시

- `ConversationTurnSource` 에 새 source `system_error` 추가 (기존 `system` 은 예약 정보용 — `system_error` 는 별 의미·시각). [Conversation Thread §1.1](../../spec/conventions/conversation-thread.md#11-conversationturnsource)
- `ConversationTurn.data` payload (system_error 한정): `{ code: string, message: string, retryable: boolean, retryAfterSec?: number, nodeId: string, nodeLabel: string }`. `code` / `message` 는 `output.error.{code, message}` 와 동일 (single source of truth — 핸들러 emit 단계에서 복사).
- WS `execution.node.failed` 또는 `output.error` 가 set 된 `execution.node.completed` 수신 시 store 가 `conversationMessages` 마지막에 `type: 'system_error'` 항목을 APPEND. payload 의 `nodeId` 가 conversation 의 호스트 AI Agent 노드와 일치할 때만 (또는 multi-turn `interactionType: 'ai_conversation'` 컨텍스트 안에서만) 적용.
- §9.1 source 별 시각 매핑 표에 `system_error` 행 추가 — **§9.2 3중 시각 신호 전체 정의**:
  - **아이콘**: ❌
  - **컨테이너 형식**: 가운데 정렬 얇은 빨간 full-width 라인 (chat bubble 아님, system note 와 동급 컨테이너지만 빨간 강조)
  - **출처 chip**: `<nodeLabel> · <code>` 헤더에 노출 (presentation/tool/system 과 동일 chip 패턴)
  - **본문**: `data.message` (LLM provider 의 에러 텍스트)
  - **우측 액션 영역**: `data.retryable === true` 시 `[다시 시도]` 버튼 + `data.retryAfterSec` 카운트다운, false 면 액션 영역 없음
- 마지막 user turn 이 응답 못 받고 끝났다면 (직전 turn 이 `ai_user` 인데 그 다음 `ai_assistant` 가 비어있는 상황에서 system_error 가 들어옴) carry-over 는 별도 invariant 로 두지 않고 — system_error item 자체가 시각적으로 "이 자리에서 응답이 실패했다" 를 보여주므로 충분. user turn 메타데이터 변형 금지 (Inv-3 의 immutability 정합).
- §9.9 Inv 명시: `system_error` source 는 §9.6 tool-call group parent 분류 대상 외 (`isAssistantContentBlank` 평가 미적용). `groupToolCallItems` 가 system_error 를 보면 unclaim 상태 그대로 두고 indent tree 에 흡수하지 않는다.
- `data?` shape SoT 위치: **`spec/conventions/conversation-thread.md §1.2` 본문 표의 `data?` 행 비고에 인라인 정의** ([node-output.md §4.5](../../spec/conventions/node-output.md#45-interactiondata-payload-규격) 는 presentation interaction 전용이라 system_error 는 scope 외).

### C. Retryable error 분기 + 재시도 UX

- `output.error.details` 에 두 신규 표준 필드를 명시 — **LLM 계열 노드 한정 공통 필수 / 기타 노드는 선택**:
  - `retryable: boolean` — **LLM 계열 노드 (ai_agent / text_classifier / information_extractor) 에서 필수**. 기타 노드 (http_request / database_query / code / cafe24 등) 는 선택 — 점진적 채택.
  - `retryAfterSec?: number` — 선택. provider 가 `Retry-After` 헤더 또는 동등한 신호를 제공한 경우만 set. `retryable=true` 일 때만 set 가능 (false 와 함께 set 시 spec 위반 — `convention-compliance` checker 가 발견).
  - 위치: `spec/conventions/node-output.md Principle 3.2` 를 두 계층으로 분리 — "선택 공통 표준 필드 (LLM 계열 한정 필수)" sub-section 신설 + 기존 "노드별 선택 필드" 유지.
- AI Agent 의 분류 규칙 (`spec/4-nodes/3-ai/1-ai-agent.md §10` 에러 코드 표에 sub-case 분리 열 추가):
  - `retryable=true`: HTTP 429 (`LLM_RATE_LIMITED`), HTTP 5xx (`LLM_CALL_FAILED` 의 5xx sub-case), network timeout (`LLM_CALL_FAILED` 의 timeout sub-case)
  - `retryable=false`: 인증 실패 401/403 (`LLM_CALL_FAILED` 의 auth sub-case), JSON 파싱 실패 (`LLM_RESPONSE_INVALID`), schema fatal, 사용자 취소
- 새 WS 명령 `execution.retry_last_turn`: payload `{ executionId, nodeExecutionId }`. ack 패턴은 기존 `execution.<cmd>.ack` 패턴 준수:
  - **ack type**: `execution.retry_last_turn.ack`
  - **ack payload (성공)**: `{ executionId, nodeExecutionId, resumed: true }` — `execution.click_button.ack` 의 `resumed` flag 패턴. **`nodeId` 생략 사유**: 클라이언트가 송신 시 `nodeExecutionId` 만 보내며 ack 도 동일 식별자만 echo. `nodeId` 는 `nodeExecutionId` 로 backend lookup 가능하므로 redundant — payload 크기 / 불일치 회귀 위험 축소.
  - **ack payload (실패)**: `{ executionId, nodeExecutionId, resumed: false, error: { code, message } }` — `execution.click_button.ack` 의 ack 구조 + `error` 객체 추가. `execution.submit_form` 의 reject 는 현행 spec 에 형식 미정의이나 본 PR 의 ack 패턴이 신규 reject 형식의 baseline 으로도 사용 가능 (별 정합 작업).
  - **에러 코드 3종** (의미 단일 정의 — `spec/5-system/6-websocket-protocol.md §4.2` 본문):
    - `RETRY_STATE_NOT_FOUND`: `_retryState` 가 DB 에 없거나 만료됨 (예: `expiresAt` TTL 초과, 또는 이미 다른 retry 가 소비). **이전 plan 안의 `INVALID_RESUME_TOKEN` 어휘는 채택하지 않음** — R1 결정으로 `resumeToken` payload 필드 자체가 사라졌으므로 외부 개발자가 `resumeToken` 필드를 찾는 오해를 회피하기 위해 `RETRY_STATE_NOT_FOUND` 로 정정. `spec/5-system/6-websocket-protocol.md §4.2` 에 본 코드 의미와 함께 "이 코드는 `_retryState` DB row 만료/부재를 의미하며 별도 token 필드는 payload 에 존재하지 않는다" 명시.
    - `NODE_NOT_RETRYABLE`: 해당 노드의 `output.error.details.retryable === false` 또는 노드가 retryable error 로 종결되지 않음
    - `RETRY_TOO_EARLY`: `retryAfterSec` 카운트다운 종료 전 호출 (선택 — 서버측 enforcement, FE 가 disabled 처리하면 안 발생)
  - **`nodeExecutionId` vs `nodeId` 사용 사유**: 기존 명령 (`submit_form` / `click_button` / `submit_message` / `end_conversation`) 은 `{ executionId, nodeId }` 로 현재 waiting 중인 노드를 식별. `retry_last_turn` 은 동일 nodeId 의 **새 NodeExecution row 를 spawn** 하므로 row 단위 식별자 `nodeExecutionId` 가 필요. spec §4.2 비고에 본 사유 한 줄 명시.
- 백엔드 의미:
  - multi-turn 의 마지막 `_retryState` snapshot (DB `NodeExecution.outputData._retryState` 또는 in-memory `ExecutionContext` 에 살아있는 경우) 으로부터 LLM 호출 재개.
  - messages 배열은 그대로 두고, 마지막 assistant turn 이 비어 있으면 거기서부터 다시 호출.
- **`_retryState` 의 handler return 위치 — `_resumeState` 와 동일하게 top-level**: `NodeHandlerOutput` Principle 0 의 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 internal top-level 필드로 위치 — `_resumeState` 와 동일 패턴. `output.error` 와 같은 레벨이 아니라 `output` 형제. 영속 시 `NodeExecution.outputData` JSONB 안에 nested 보관됨은 영속화 단계의 표현 (adapter 가 `output` + `_retryState` 를 한 JSONB 객체로 직렬화). expression resolver / autocomplete 는 `_resumeState` 와 동일 정책으로 비노출. `spec/4-nodes/3-ai/1-ai-agent.md §7.9` JSON 예시에 `_retryState` 를 top-level 로 추가 (§7.4 의 `_resumeState` 위치와 동일 일관성).
- **`_resumeState` 보존 정책 — OQ1 결정 완료 (R1 확정, 2026-05-23)**: 현행 `buildMultiTurnFinalOutput` 은 error 종결 시에도 `status: 'ended'` 를 emit 하고 `_resumeState` 가 strip 된다 ([Spec 실행 엔진 §1.3](../../spec/5-system/4-execution-engine.md) + [node-output Principle 4.2](../../spec/conventions/node-output.md)). retryable 케이스에서 **R1 채택**:
  - retryable error 종결 시 status 는 그대로 `'ended'` + `port: 'error'`.
  - backend 는 `NodeExecution.outputData._retryState` 필드로 `_resumeState` snapshot 을 보관 (engine 의 `stripControlFields()` 분기에 의해 **strip 제외**).
  - `_retryState` 포함 필드: 기존 `_resumeState` 동일 구조 + `expiresAt: ISO 8601` (TTL — 기본 60분). `messages` / `turnCount` / `model` / RAG / MCP 메타 + `pendingFormToolCall?` 그대로 보존. **credential 비포함** (`maskSensitiveFields` 가 strip — `_resumeState` 와 동일 정책).
  - `execution.retry_last_turn` 명령은 `nodeExecutionId` 로 `_retryState` 를 조회해 새 `NodeExecution` row 를 spawn 하고 거기서 multi-turn loop 재진입. 기존 `nodeExecutionId` 는 종결 상태 유지 (히스토리 보존).
  - **`resumeToken` 필드는 plan 초안에서 제거**. WS payload 가 `nodeExecutionId` 만으로 충분히 식별 가능. token 의 추가 의미가 없어 spec 면적·보안 표면 모두 축소.
  - (R2, 기각) status: `'waiting_for_retry'` 신설. waiting_for_input 패밀리 확장이라 spec 변경 면적이 커지고 (실행 엔진 §1.3 블로킹/재개 컨트랙트 추가), Principle 5 port 활성화 모델과의 정합도 재검토 필요.
- **워크플로우 Re-run 과의 구분** ([Spec Replay/Re-run §10](../../spec/5-system/13-replay-rerun.md)): `execution.retry_last_turn` 은 **동일 Execution 안 특정 노드 단위 재시도** (transient quota/rate limit 회복용). 워크플로우 Re-run (`RR-PL-04`) 은 **새 Execution 생성** (입력 다시 받아 처음부터). 두 경로의 의미가 다르므로 spec `§4.2` 의 `retry_last_turn` 정의에 cross-ref 한 줄 ("Re-run 과 다름 — §13 replay-rerun") 추가.
- 프론트엔드 UX: 인라인 system_error item 우측에 `[다시 시도]` 버튼 + `retryAfterSec` 카운트다운. 클릭 시 `execution.retry_last_turn` 송신 + 해당 노드 status `running` 전환 + system_error item 우측 버튼을 spinner 로 교체. 새 LLM 응답이 오면 시각적으로 새 `ai_assistant` turn 이 system_error 아래 추가된다 (timeline 자연 순서).

## 영향 spec

| 파일 | 변경 |
| --- | --- |
| `spec/5-system/4-execution-engine.md` §1.3 | **(본 PR 갱신)** "최종 출력 저장 시 엔진이 `_resumeState` / `_multiTurnState` 양쪽 모두를 제거한다" 문장을 조건부로 갱신 — "단, retryable error 종결 시 `_retryState` 는 strip 예외로 `NodeExecution.outputData` 안에 보존됨 (TTL: 기본 60분, `expiresAt` 필드)". 해당 spec Rationale 절에 R1 채택 사유 요약. |
| `spec/conventions/node-output.md` Principle 4.2 | **(본 PR 갱신)** 본 절 본문 폐기 필드 목록 **뒤** 별도 sub-item `**보존 예외**:` 신설 — `_retryState` strip 예외 명시. `stripControlFields()` 가 `_resumeState` 는 제거하지만 `_retryState` 는 보존 (retryable error 종결 시점, TTL `expiresAt`). expression resolver / autocomplete 비노출은 두 필드 동일 정책. |
| `spec/4-nodes/3-ai/1-ai-agent.md` §7.4 | **(본 PR 갱신 — `_resumeState` / `_retryState` 비교)** `_resumeState` 표 직후 비고 추가: `_resumeState` 와 `_retryState` 의 생명주기 비교 — `_resumeState` 는 waiting_for_input 중 in-memory 유지 후 DB 영속 시 strip / `_retryState` 는 retryable error 종결 시 DB 영속에도 보존 후 retry_last_turn 진입 시 소비 (또는 TTL 만료). |
| `spec/4-nodes/3-ai/1-ai-agent.md` §7.9 | error JSON 예시에 `retryable: true`, `retryAfterSec: 30` 추가 (`resumeToken` 은 R1 결정으로 미사용 — 제거). 본문 한 줄로 retryable 정의 + retry 진입 (§7.4 와의 관계) cross-ref. `retryAfterSec` 는 `retryable=true` 일 때만 set 됨을 명시. |
| `spec/4-nodes/3-ai/1-ai-agent.md` §10 | 에러 코드 표에 retryable / non-retryable 분류 열 추가. `LLM_CALL_FAILED` 를 sub-case 3종 (5xx → retryable / timeout → retryable / auth → non-retryable) 으로 분리. |
| `spec/4-nodes/3-ai/0-common.md` §5 | 응답 형식 wrapper 표의 `output.error.{code, message, details?}` 행 비고에 "LLM 계열 노드는 `details.retryable: boolean` 필수, `details.retryAfterSec?: number` 선택 (true 일 때만 set)" 명시화. |
| `spec/conventions/node-output.md` Principle 3.2 | **(본 PR 갱신) — 2계층 sub-section 분리**: <br> · **§3.2.1** 신설 — "선택 공통 표준 필드 (LLM 계열 노드 한정 필수)". `retryable: boolean` 필수, `retryAfterSec?: number` 선택. <br> · **§3.2.2** — 기존 "노드별 선택 스키마" 본문 유지. 비-LLM 노드는 `details` 가 여전히 노드별 선택. <br> · **불변량 명문화**: `retryAfterSec` 는 `retryable === true` 일 때만 set 됨. false 와 함께 set 시 spec 위반 (convention-compliance checker 가 발견). 본 invariant 의 SoT 는 본 §3.2.1. <br> · Principle 3.3 의 LLM 3 노드 표 각주에 retryable 분류 의무 cross-ref. |
| `spec/conventions/conversation-thread.md` §1.1 | `ConversationTurnSource` 표에 `system_error` 신규 행 추가. `system` 행은 그대로 reserved 유지 (v2 매뉴얼 system note 도입 시 활성화). |
| `spec/conventions/interaction-type-registry.md` §2 서두 | **(본 PR 갱신)** enum 값 카운트 "5개" → "6개" 갱신. 새 값 `system_error` 를 5값 목록에 추가. |
| `spec/conventions/interaction-type-registry.md` §2.1 | **(본 PR 갱신 — AST 가드 충족)** `ConversationTurnSource` 처리 분기 매트릭스에 `system_error` 행 추가. 분기 위치 — **AST 가드 대상 코드 파일 2종**: `threadTurnsToConversationItems` switch (`codebase/frontend/src/lib/conversation/conversation-utils.ts`), `ConversationTimelineItem` 렌더 분기 (`conversation-inspector.tsx` + `result-timeline.tsx`). + **spec cross-ref (AST 가드 비대상)**: `conversation-thread.md §9.1` 매핑표. 미등록 시 `interaction-type-exhaustiveness.test.ts` 가 hard fail. |
| `spec/conventions/node-output.md` Principle 0 | **(본 PR 갱신)** 비고에 "internal top-level 필드 `_resumeState` / `_retryState` 는 5필드 외 허용 예외 — Principle 4.2 참조" 한 줄 추가. expression resolver / autocomplete 비노출 정책은 두 필드 동일. |
| `spec/4-nodes/3-ai/1-ai-agent.md` §7 서두 | **(본 PR 갱신)** 5필드 외 top-level 키 예외 목록의 괄호 주석에 `_retryState` 병기 — 현재 `_resumeState` 만 등재됨. |
| `spec/conventions/conversation-thread.md` §8 Rationale | **(본 PR 갱신)** `system_error` 신설 결정 (2026-05-23) 항 추가. `system` source 재사용 대신 별 source 분리 사유 + system note 와의 의미·시각 차이 + `data` discriminator 안 기각 사유 명시 (plan Rationale "system_error vs system source 재사용" 단락의 SoT 본 spec 절로 이전). |
| `spec/conventions/data-hydration-surfaces.md` §1 + §3 | **(본 PR 갱신)** Output field → hydration surface 매트릭스에 `output.error` (multi-turn error 종결) 행 추가 — surface 4종: (a) `parseHistoryMessages` last system_error 합성 (OQ3 결정), (b) `threadTurnsToConversationItems` system_error turn 매핑, (c) `applyExecutionSnapshot` waiting/ended 분기, (d) WS `execution.node.failed` / `node.completed` (with error) APPEND. **backend echo 위치**: `buildMultiTurnFinalOutput` 의 `errorPayload` 경로 (single source — `ai-agent.handler.ts:2227` 참조). §3 "신규 field 추가 절차" 충족. `NodeExecution.outputData (REST fetch, no live thread)` 행 비고에 "`output.error` set + multi-turn → 마지막에 system_error item 합성" 추가. |
| `spec/5-system/14-external-interaction-api.md` EIA-IN-02 | **(본 PR 갱신 — 외부 표면 미노출 결정)** 외부 허용 command 목록에 `retry_last_turn` 미포함. 본 PR 1차 범위는 내부 UI (Run Results 드로어) 한정. 외부 표면 노출은 별 PR 에서 다룬다 (사유: 외부 토큰 `per_execution` 의 retry 권한 매트릭스 정의 + Notification 흐름과의 정합 + retry 횟수 제한 정책이 별도 결정 필요). 본 명령은 §4.6 매핑표에 "외부 미노출" 로 명시. |
| `spec/conventions/conversation-thread.md` §1.2 | `data?` 행 비고에 system_error source 의 payload shape 인라인 정의: `{ code: string, message: string, retryable: boolean, retryAfterSec?: number, nodeId: UUID, nodeLabel: string }`. node-output §4.5 는 presentation interaction 전용이므로 system_error 는 scope 외 — 본 §1.2 가 단일 진실. |
| `spec/conventions/conversation-thread.md` §9.1 | source 별 시각 매핑 표에 `system_error` 행 추가 — **§9.2 3중 시각 신호 전체**: <br> · UI 형식: `❌ 가운데 정렬 얇은 빨간 full-width 라인 (system note 와 동급 컨테이너지만 빨간 강조)` <br> · 헤더: `<nodeLabel> · <code>` chip <br> · 본문: `data.message` <br> · 우측 액션: `data.retryable === true` 일 때 `[다시 시도]` 버튼 + `data.retryAfterSec` 카운트다운 |
| `spec/conventions/conversation-thread.md` §9.2 | 3중 시각 신호 표의 "아이콘" 행에 `❌ (system_error)` 추가. "컨테이너 형식" 행에 system_error 가 system note 와 동일 가운데정렬 라인이되 빨간 강조임을 명시. |
| `spec/conventions/conversation-thread.md` §9.6 | tool-call 그룹 시각 정책에 명시: `system_error` source 는 §9.6 parent/child 분류 대상 외 — `groupToolCallItems` 는 system_error 항목을 unclaim 상태 그대로 둔다 (indent tree 미흡수). `isAssistantContentBlank` 평가 미적용. |
| `spec/conventions/conversation-thread.md` §9.7 | WS 이벤트 → store 변환 계약 표 + 본문 갱신: <br> · `node.failed` (interactionType=ai_conversation 컨텍스트) → APPEND `system_error` item. <br> · `node.completed` 인데 `output.error` set + multi-turn error 종결 → 동일 처리. <br> · `failExecution` / `completeExecution` 의 store reset 정책: `CLEAR_INPUT_AFFORDANCE` 만 적용 (conversation snapshot 보존). 본 SoT 의 의미는 "store reset 정책" 으로 명세하고 상수명 (`CLEAR_INPUT_AFFORDANCE` / `CLEAR_CONVERSATION_SNAPSHOT`) 은 구현 세부사항으로 표기 (spec-코드 drift 회피). |
| `spec/conventions/conversation-thread.md` §9.9 | **Inv-6 신설**: "노드 실패 / 실행 실패 시 store `conversationMessages` 는 비워지지 않는다 — `startExecution` 만 클리어한다. 정의 단일 진실: §9.7 store reset 정책." §9.9 서두 스코프를 "§9 변경 또는 store lifecycle 정책 변경 시" 로 확장. |
| `spec/conventions/conversation-thread.md` §9.10 | 회귀 차단 시나리오 신설: <br> · CT-S9: "멀티턴 AI Agent 가 retryable error 로 종결 시 thread 가 store 에 보존되고 system_error item 이 APPEND" <br> · CT-S10: "non-retryable error 종결 시 thread 보존 + `[다시 시도]` 버튼 미노출 (액션 영역 비어있음)" <br> · CT-S11: "retry_last_turn 명령 송신 후 새 ai_assistant turn 이 system_error item 아래에 자연 순서로 추가" |
| `spec/conventions/conversation-thread.md` §10 CHANGELOG | 2026-05-23 row 추가 — system_error source 신설 + §9.7 CLEAR 분리 정책 + Inv-6 + CT-S9/S10/S11. |
| `spec/3-workflow-editor/3-execution.md` §10.5 / §10.6 | conversation 인스펙터의 입력 영역 행에 retry 진입점 비고: "마지막 항목이 retryable system_error 이면 입력 영역 자리에 `[다시 시도]` 버튼 노출 + retryAfterSec 카운트다운". §10.6 디폴트 탭 우선순위 비고: "AI multi-turn retryable error 종결 시 Preview 우선 (conversation thread 안에 system_error 가 표시되므로). Error 탭은 `output.error` JSON 형식으로 계속 접근 가능." |
| `spec/3-workflow-editor/3-execution.md` §10.8 | 라이프사이클 표 갱신: <br> · `노드 실행 완료` 행 — output.error 가 set 이면 timeline 항목 + system_error append. <br> · `실행 실패` 행 — "드로어 유지. 실패 시점까지 + **conversation snapshot 보존** ([Conversation Thread §9.7](../conventions/conversation-thread.md#97-ws-이벤트--store-변환-계약) store reset 정책)". <br> · `새 실행 시작` 행 — "이전 히스토리 클리어, 드로어 리셋, conversation snapshot 도 클리어 (Conversation Thread §9.7 — `startExecution` 만 적용되는 reset 묶음)". <br> · 신규 행: `Multi Turn 재시도 클릭 (execution.retry_last_turn)` → 노드 status `running` 전환 + system_error item 의 버튼을 spinner 로 교체. |
| `spec/5-system/6-websocket-protocol.md` §4.2 | **(본 PR 갱신)** 실행 제어 명령 표에 `execution.retry_last_turn` 신규 행 추가: payload `{ executionId, nodeExecutionId }`. ack 정의: `execution.retry_last_turn.ack` payload `{ executionId, nodeExecutionId, resumed: boolean, error?: { code, message } }` — `execution.click_button.ack` (resumed flag) + `execution.submit_form` reject (error 객체) 패턴 결합. 에러 코드 표에 `INVALID_RESUME_TOKEN` ("_retryState token 이 DB 에 없거나 만료됨"), `NODE_NOT_RETRYABLE` ("`output.error.details.retryable === false` 또는 노드가 retryable error 로 종결되지 않음"), `RETRY_TOO_EARLY` ("`retryAfterSec` 카운트다운 종료 전 호출 — 서버측 enforcement") 추가. 본 행 비고에 "Re-run (§13 replay-rerun) 과 다름 — 동일 Execution 안 노드 단위 재시도" cross-ref. |
| `spec/5-system/6-websocket-protocol.md` §4.1 | **(본 PR 갱신)** `execution.node.failed` payload `error` 필드 shape 을 `output.error` 전체 구조 (`{ code, message, details?: { retryable?, retryAfterSec?, ... } }`) 로 명시. `execution.node.completed` payload `output` 도 `output.error` 동봉 시 동일 구조. **구현 착수 전 확인 필요**: 현행 backend 가 error port 종결 시 `execution.node.completed` payload 의 `output` 에 `output.error` 를 실제 동봉하는지 코드 확인. 동봉되어 있으면 spec 명시화만, 미동봉이면 backend emit 변경 + WS consumer 코드 회귀 검증. (영향 codebase 표 FE WS 행에 이미 반영됨.) |
| `spec/5-system/6-websocket-protocol.md` §4.6 | **(본 PR 갱신)** 외부 표면 매핑 표에 `execution.retry_last_turn` 행 추가하되 **"(외부 미노출 — 향후 별 PR 에서 노출 예정)"** 비고로 표시 — `submit_form` / `click_button` / `submit_message` / `end_conversation` 처럼 REST 매핑을 갖지 않고, 내부 WS 전용. **`execution.start` 의 "원칙적 배제 — webhook 대체" 와 의미 다름** (retry_last_turn 은 외부 표면 노출 가능하나 별 PR 로 미룸). EIA spec EIA-IN-02 와 정합. SSE event 매핑은 영향 없음 (응답은 기존 `execution.node.started` / `execution.node.completed` 가 새 nodeExecutionId 로 재발화). |
| `spec/4-nodes/3-ai/2-text-classifier.md` §5.3 · `spec/4-nodes/3-ai/3-information-extractor.md` §5.3/§5.6.4 | **(별 plan 에서 처리됨 — 본 PR scope 외)** 두 노드의 error 예시·필드 표에 `details.retryable` (필수) 보강은 [`spec-update-ai-error-output-fields`](./spec-update-ai-error-output-fields.md) plan 에서 2026-05-29 완료 (`review/consistency/2026/05/29/00_45_44/`). 본 PR 은 §3.2.1 규약·ai-agent §7.9/§10 만 갱신했고 형제 노드 본문 정합은 위 plan 이 담당. |

## 영향 codebase (구현 turn 에서 다룸)

| 영역 | 파일 (예상) | 변경 |
| --- | --- | --- |
| FE store | `codebase/frontend/src/lib/stores/execution-store.ts` | `CLEAR_WAITING` 분리 (`CLEAR_INPUT_AFFORDANCE` / `CLEAR_CONVERSATION_SNAPSHOT`). `addConversationMessage` 가 system_error type 지원. `ConversationItem` type union 에 `"system_error"` 추가. |
| FE store | `codebase/frontend/src/lib/conversation/conversation-utils.ts` | `ConversationTurnSource` type union 에 `"system_error"` 추가 (line 14-19 부근). `messagesToConversationItems` / `threadTurnsToConversationItems` 에 system_error mapping. `isAssistantContentBlank` 영향 없음. switch / if-else 명시적 case 추가 + TypeScript exhaustiveness check 보강 (fallback 분기가 system_error 를 누락하지 않도록). |
| FE store | `codebase/frontend/src/lib/conversation/parseHistoryMessages` 가 정의된 파일 | OQ3 결정 — 새로고침 후 history view 에서 `output.error` 가 set 된 경우 마지막에 system_error item 합성. `output.error.{code, message}` + `output.error.details.{retryable, retryAfterSec}` 를 읽어 ConversationItem 구성. |
| FE WS | `codebase/frontend/src/lib/websocket/use-execution-events.ts` (또는 동등) | `execution.node.failed` / `node.completed` (with error) → conversation store 에 system_error append. `execution.retry_last_turn` 송신 핸들러 + ack 처리. **shape 변경 영향**: `execution.node.failed` 의 `error` 필드가 본 PR 에서 `output.error` 전체 구조 (`{code, message, details?}`) 로 정식화되므로, 기존 소비 코드가 `error` 를 문자열 또는 `{code, message}` 로 가정했다면 타입 가드 보강 필요. `failExecution(error?: string)` 시그니처를 `failExecution(error?: { code, message, details? } | string)` 로 확장하거나 호출 경로에서 normalize. |
| FE UI | `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` | system_error item 렌더 + `[다시 시도]` 버튼 + 카운트다운. 3중 시각 신호 (❌ + 빨간 라인 + chip) 구현. |
| FE UI | `codebase/frontend/src/components/editor/run-results/result-timeline.tsx` | timeline 의 conversation 항목 펼침 부분에 system_error row 시각. `groupToolCallItems` 가 system_error 를 unclaim 상태로 두는지 단위 테스트 검증. |
| FE i18n | `codebase/frontend/src/messages/{ko,en}.json` (또는 i18n dict) | retry 버튼 / 카운트다운 / system_error 라벨 키 추가. |
| BE handler | `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` | `buildMultiTurnFinalOutput` 시 `errorPayload.details` 에 `retryable` / `retryAfterSec` 분류. error 종결 시 `_retryState` 보존 (snapshot of `_resumeState` + `expiresAt`). |
| BE LLM provider | `codebase/backend/src/services/llm-service/...` | provider 별 에러를 retryable 분류로 매핑 (Anthropic 429 / Google 429 / OpenAI 429 / 5xx / network timeout). `Retry-After` 헤더 또는 동등 신호를 `retryAfterSec` 로 추출. |
| BE engine | `codebase/backend/src/modules/execution-engine/...` | `stripControlFields()` 가 `_retryState` 보존하도록 분기 — strip 예외는 `_retryState` 만, `_resumeState` 는 기존 동작 유지. `execution.retry_last_turn` 명령 핸들러: `nodeExecutionId` 로 `_retryState` 조회 → `expiresAt` 검증 → 새 NodeExecution row spawn → multi-turn loop 재진입. |
| BE WS | `codebase/backend/src/modules/websocket/...` | 신규 명령 `execution.retry_last_turn` 라우팅 + ack 응답 + 3종 에러 코드 매핑. |

## TDD 순서 (구현 turn 에서 따름)

A → B → C 순. 각 phase 마다 RED → GREEN → REFACTOR.

1. **A1 (FE TDD)**: `execution-store.test.ts` 신규 — "노드 실패 시 conversationMessages 가 비워지지 않는다", "completeExecution 후 conversationMessages 가 비워지지 않는다", "startExecution 만 비운다". RED → store 분리 → GREEN.
2. **A2 (FE TDD)**: 회귀 — 기존 `result-timeline.test.tsx` / `conversation-inspector.test.tsx` 가 깨지지 않는지 확인.
3. **B1 (FE TDD)**: `conversation-utils.test.ts` 의 새 describe `groupSystemErrorItems` (또는 변환 함수 내 system_error mapping) — "system_error item 은 parent 그룹 child 로 흡수되지 않는다", "마지막 system_error 는 timeline 마지막에 append".
4. **B2 (FE TDD)**: `use-execution-events.test.ts` — "node.failed 수신 시 system_error item APPEND", "ai_conversation 컨텍스트 밖이면 무시" (= timeline UI 변형 없이 nodeStatus 만 갱신).
5. **B3 (FE TDD)**: `conversation-inspector.test.tsx` — system_error item 의 시각 매핑 (icon, chip, button presence).
6. **C1 (BE TDD)**: `ai-agent.handler.spec.ts` 의 새 describe `retryable classification` — 429 / 5xx / timeout 은 `details.retryable=true`, 401 / JSON parse fail 은 `false`. `retryAfterSec` 추출.
7. **C2 (BE TDD)**: handler/engine 통합 — error 종결 시 `_retryState` 가 outputData 에 보존되는지.
8. **C3 (BE TDD)**: `retry_last_turn` 명령 — `_retryState` 로부터 LLM 재호출, 새 NodeExecution spawn.
9. **C4 (FE TDD)**: `use-execution-interaction-commands.test.ts` — retry 송신 + 노드 상태 전환 + ack 처리 + 3종 에러 코드 시각화.
10. **C5 (FE TDD)**: `parseHistoryMessages.test.ts` — `output.error` 가 set 된 multi-turn 종결 NodeExecution 으로부터 history view 가 마지막 system_error item 을 합성하는지 (OQ3 결정에 따른 항목).
11. **CT-S9 / CT-S10 / CT-S11** (FE TDD): conversation-thread §9.10 의 신규 시나리오 3건 단위 테스트.

## 비범위 (out of scope)

- DB 컬럼 신설 — `_retryState` 는 기존 `NodeExecution.outputData` JSONB 안에 nested 로 보관. 별도 마이그레이션 없음.
- Multi-thread / Token-aware cap 등 conversation-thread §7 v2 로드맵 항목.
- Background 본문 노드의 retry — 격리 격벽이라 본 PR 에서 다루지 않음 (메인 흐름 동기 노드만).
- Storybook / visual regression 인프라 — §7 v2 로드맵.
- 다른 LLM 노드 (`text_classifier`, `information_extractor`) 의 retryable 분류 — AI Agent (multi-turn) 가 1차. 다른 노드는 conventions/node-output.md 의 신규 필드 정의는 따르지만 실제 retry 진입은 별 PR.
- 비-LLM 노드 (http_request / database_query / code / cafe24 등) 의 retryable 필수 적용 — 본 PR 은 Principle 3.2 의 LLM 계열 한정 sub-section 만 도입. 다른 노드는 선택 채택.

## 의존성·리스크 (병렬 작업 조율)

- **`plan/in-progress/spec-drift-ws-button-config.md`**: 동일 파일 `spec/5-system/6-websocket-protocol.md` 의 `§4.4` (button config 예시) 를 수정 중. 본 PR 은 `§4.1` / `§4.2` / `§4.6` 을 수정 — 섹션이 다르나 같은 파일이라 머지 순서에 따라 conflict 가능. 본 PR 머지 직전 `spec-drift-ws-button-config` 상태 확인 후 한쪽이 먼저 들어가면 다른 쪽이 rebase.
- **`plan/in-progress/ai-agent-tool-connection-rewrite.md`**: 일반 도구 (`tool_*`) 슬롯 재설계. `_resumeState` schema 가 변경될 수 있음 — 완료 시 `_retryState` 형식도 검토 (`_resumeState` snapshot 이라 자동 추적되어야 하지만 schema 변경의 비호환 케이스에 대비).
- **`plan/in-progress/replay-rerun.md`**: 워크플로우 Re-run (RR-PL-04) 의미와 `execution.retry_last_turn` 의 의미 차이를 `§4.2` 비고 + `spec/5-system/13-replay-rerun.md` cross-ref 로 명시. 충돌 없음 — 두 경로 직교.
- **`plan/in-progress/ai-presentation-tools.md`**: 이미 main 머지 완료 (`PR #269`). 동일 spec 영역 (`§9.6` / `§9.10`) 을 수정하므로 본 PR 의 §9.6 `system_error` 흡수 안함 정책 + §9.10 CT-S9/S10/S11 신설 시 기존 §9.6 의 `groupToolCallItems` 동작 / §9.10 의 CT-S1~S8 fixture 와 정합 확인.

## Open Questions (사용자 escalate 후보)

- **OQ1 (R1 vs R2)**: ✅ **결정 완료 (2026-05-23)** — R1 채택. status `ended` + `_retryState` 동봉 (DB `outputData._retryState`). 사유는 본 plan `## Rationale` 의 "R1 채택 사유". consistency-check (`review/consistency/2026/05/23/16_30_17/`) 의 C1 Critical 은 `spec/5-system/4-execution-engine.md §1.3` + `spec/conventions/node-output.md Principle 4.2` + `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 동반 갱신으로 해소 (영향 spec 표 참조).
- **OQ2 (retry 회수 한도)**: 사용자가 retry 를 무한 클릭할 수 있는가? 본 PR 은 **명시적 한도 없음 — 의식적 수용** — provider 가 자체적으로 429 를 다시 던지면 그게 한도. `_retryState.expiresAt` (TTL 60분) 이 사실상 상한 역할. 5xx / timeout 케이스에서는 TTL 안에서 무제한 retry 가능. 남용 방지가 필요한 경우 (예: per-execution 5회 cap, exponential backoff 강제) 별 PR 에서 다룬다. `plan/in-progress/0-unimplemented-overview.md` 후속 인덱스에 등재 권고.
- **OQ3 (system_error 의 영속화)**: ✅ **결정 완료 (2026-05-23)** — 본 PR 범위 안. `parseHistoryMessages` 가 `output.error` 가 set 된 multi-turn 종결 노드에서 마지막에 system_error item 을 합성하도록 변경. TDD 순서 단계에 `CT-S9` 의 history view 검증 추가. 영향 codebase 표 `parseHistoryMessages` 행 신설.

## Rationale

### 왜 한 PR 로 묶는가

- A 만 단독 적용해도 증상은 사라지지만 (대화 보존), 사용자가 "다시 시도" 진입점이 없다 — quota 가 잠시 회복돼도 워크플로우 전체를 재실행해야 한다. B+C 가 같이 가야 사용자 가치가 완결된다.
- B 가 A 의 시각적 보완 — A 만 적용하면 대화는 보존되지만 "여기서 끊겼다" 가 보이지 않아 "왜 더 진행이 안 되지?" 라는 혼동이 남는다. system_error item 이 그 자리를 메운다.
- C 는 B 의 인라인 위치를 그대로 활용 — system_error item 우측에 버튼이 붙는 형태가 자연스럽다. 별 PR 로 분리하면 B 만 머지 시 사용자가 "이게 다인가?" 의 미완성 인상.
- spec 변경 면적이 spec/conventions/conversation-thread.md 한 곳에 집중되므로 분리 PR 의 spec 흔들림 비용이 크다 (drift 위험). 한 PR 로 §9.1 / §9.7 / §9.9 / §9.10 / §10 CHANGELOG 를 한 번에 갱신.

### system_error vs `system` source 재사용

- `system` source 는 §1.1 표에 "예약 (v1 자동 push 없음)" 으로 남아있다. 의미 부담이 작다.
- 그러나 system_error 는 시각·인터랙션 (`[다시 시도]` 버튼) · 동작 의미 (실패 신호) 가 system note 와 다르므로 별 source 분리가 더 명확하다.
- `data.kind: 'error' | 'note'` discriminator 로 system 안에 박는 안은 source enum 의 디스패치를 무력화 (§9.1 매핑 표가 1:1 → 1:N) — UI 분기 비용 증가.
- 결정: `system_error` 새 source 추가. `system` 은 그대로 reserved 유지 (v2 에서 매뉴얼 system note 도입 시 활성화).

### R1 (status `ended` + `_retryState`) 채택 사유

- status `waiting_for_retry` 신설 (R2) 은 실행 엔진의 블로킹/재개 컨트랙트 [Spec 실행 엔진 §1.3](../../spec/5-system/4-execution-engine.md) 확장 — 노드 외 다른 노드가 `waiting_for_input` 패밀리를 어떻게 다루는지 spec 면적이 커진다.
- R1 은 기존 `'ended'` + `port: 'error'` 의미를 그대로 유지하므로 후속 노드 (예: `error` 포트에 연결된 알림 노드) 의 의미가 변하지 않는다. retry 는 `error` 포트로의 라우팅 후에도 별도 사용자 인터랙션으로 진입 가능 (의미: "에러 분기는 실행됐고, 사용자가 추가로 retry 해서 새 결과를 만들 수도 있다").
- `_retryState` 는 internal 필드라 expression resolver 비노출 (`Principle 4.2`) — `_resumeState` 와 같은 정책. credential 누락 등 보호 정책도 동일하게 적용.
- R2 의 장점 (status 단계로 retryable 여부가 단일 신호) 은 `output.error.details.retryable` boolean 으로 충분히 대체 가능.

**`_retryState` 포함 필드 범위 (credential-free 보장)**:

| 필드 | 출처 | 보장 |
|---|---|---|
| `messages` | `_resumeState.messages` 그대로 | LLM history (credential 미포함 — `maskSensitiveFields` 가 boundary 에서 strip) |
| `turnCount` / `totalInputTokens` / `totalOutputTokens` / `toolCalls` | runtime accumulator | 메트릭만, credential 무관 |
| `model` / `temperature` / `maxTokens` | `_resumeState` 그대로 | LLM 설정 값. `llmConfigId` 자체는 보존되나 그 안의 secret 은 `_resumeState` 단계에서 이미 strip 됨 (`maskSensitiveFields`) |
| `knowledgeBases` / `ragTopK` / `ragThreshold` | `_resumeState` 그대로 | KB ID 목록 — credential 무관 |
| `mcpServers` | `_resumeState` 그대로 | MCP server ID 목록 — secret 은 별도 store 에서 lookup 이라 `_retryState` 에 포함 안됨 |
| `pendingFormToolCall?` | `_resumeState` 그대로 | retryable error 가 form 대기 중에 발생한 케이스 — toolCallId + formConfig (credential 없음) |
| `expiresAt` | 신규 — `Date.now() + TTL` | TTL 60분. 만료 후 `INVALID_RESUME_TOKEN` 에러 코드 |

→ 모든 필드가 `_resumeState` 와 동등하거나 그 부분집합 + `expiresAt`. credential 노출 표면은 `_resumeState` 보다 늘어나지 않는다.

**TTL `expiresAt` 60분 선택 근거**:

- 일반적인 provider rate limit 회복 상한 (대부분 1~5분) 을 충분히 커버.
- 사용자가 자리를 잠깐 비웠다 와도 retry 가 살아있도록 (10~30분 휴식 시나리오).
- 60분 초과는 stale state 누적 우려 — `_retryState` 는 `NodeExecution.outputData` JSONB 안에 누적되므로 무한 보존 시 DB 비대화. 기각 대안: 24시간 (실용 가치 낮음 — 1시간 후 quota 가 회복 안 됐다면 사용자 개입 필요), 5분 (사용자가 자리 비울 때 짧음).
- 향후 사용량 데이터로 적정값 재검토 (별 PR).

**`LLM_RATE_LIMITED` 도입 — "대체" 가 아닌 "sub-case 분리" 패턴**:

- 현행 `LLM_CALL_FAILED` 는 429 를 포함해 모든 호출 실패를 포괄. 본 PR 에서 `LLM_RATE_LIMITED` 를 도입할 때 기존 `LLM_CALL_FAILED` 를 폐기/대체하지 않고 **sub-case 분리** — 429 만 `LLM_RATE_LIMITED` 로 분기. 5xx / timeout / auth 는 여전히 `LLM_CALL_FAILED` 의 sub-case (5xx → retryable=true, timeout → retryable=true, auth → retryable=false).
- 기존 코드의 `code === 'LLM_CALL_FAILED'` 분기를 깨지 않고 `code === 'LLM_RATE_LIMITED'` 가 추가됨 — breaking change 없음.

### Inv-6 의 범위

- Inv-6 ("실패 시 store 보존") 는 §9.9 의 5개 invariant 와 같은 의무 강도. 단위 테스트는 §9.10 의 CT-S9 / CT-S10 / CT-S11 으로 보장.
- "어떤 상태에서 클리어 되는가" 의 단일 정의는 §9.7 (store reset 정책 — `CLEAR_INPUT_AFFORDANCE` vs `CLEAR_CONVERSATION_SNAPSHOT` 분리). Inv-6 은 그 정의를 "변하지 않는다" 로 격상한 invariant.
- §9.9 서두 스코프 ("§9 변경 / 구현 변경 시") 가 store lifecycle 정책 변경에도 적용되도록 "§9 변경 또는 store lifecycle 정책 변경 시" 로 확장.

### 상수명을 spec 본문에 노출하지 않는 이유

- `CLEAR_INPUT_AFFORDANCE` / `CLEAR_CONVERSATION_SNAPSHOT` 는 frontend store 의 구현 세부 식별자. spec 본문이 상수명을 직접 인용하면 향후 리팩토링 (예: 묶음 이름 변경, hook 분리) 시 spec-코드 drift 가 영구 발생.
- 따라서 spec §9.7 본문은 "store reset 정책" 의 의미만 명세 (어떤 이벤트에서 어떤 필드 묶음이 클리어/보존되는가). 상수명은 plan 의 영향 codebase 표 + 코드 inline 주석에 둔다.

### Re-run 과 retry_last_turn 의 분리

- 사용자 관점에서 두 액션이 비슷해 보일 수 있어 spec 차원에서 의미 분리가 중요:
  - **Re-run** (`spec/5-system/13-replay-rerun.md` RR-PL-04): 워크플로우 전체를 새 Execution 으로 다시 실행. 사용자가 입력을 다시 받을 수 있음. multi-turn AI 노드는 새 대화로 시작.
  - **retry_last_turn**: 동일 Execution 안에서 특정 multi-turn AI 노드만 마지막 LLM 호출부터 재진입. 대화 history (`messages` 배열) 그대로 유지. 일시적 quota / rate limit 회복 시나리오.
- 두 경로의 진입점 위치도 다르다 — Re-run 은 Run Results 드로어 헤더의 `[⟳ Re-run]` 버튼 ([Spec 실행 §10.14](../../spec/3-workflow-editor/3-execution.md#1014-re-run-진입점)), retry_last_turn 은 conversation thread 인라인 `[다시 시도]` 버튼.
