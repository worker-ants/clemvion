---
id: "CLE-EXEC-PREVIEW-TESTS"
title: "대화 미리보기 — 회귀 차단 시나리오"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-PREVIEW"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-PREVIEW"]
area: "CLE-EXEC"
content_hash: "91be9002ff9925216668f4f83c84733f5a6517f2c64472794108051160905cb3"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "2624e511b2583f07b9308e41c8b51bb4ff1eb1cffb49408430d1eee6687dfa50"
etag: "sha256-ef9a4dffc24a83087cfca27800aa9cf4b9f82c8c344f31454fabed9105997cc9"
---
## 개요

이 문서는 [대화 미리보기](CLE-EXEC-PREVIEW.md) 의 하위 문서로 대화 타임라인 회귀 차단 시나리오(CT-S1~CT-S21), 입력 fixture 위치, 충족 테스트 매핑을 정한다. `Inv-N` 불변량은 [대화 미리보기 §UI 불변량](CLE-EXEC-PREVIEW.md#ui-불변량) 이 정한다.

## 회귀 차단 시나리오

[대화 미리보기](CLE-EXEC-PREVIEW.md) 와 하위 문서의 규칙이나 대화 타임라인 관련 코드(`conversation-inspector.tsx`, `conversation-utils.ts`, `use-execution-events.ts`, `result-timeline.tsx`, `conversation-timeline-item.tsx`, 그리고 탭 가시성·데이터 소스 선택의 렌더 게이트가 있는 **`result-detail.tsx`**)를 고치는 PR 은 아래 시나리오의 **단위 테스트 통과가 의무**다. 사용자가 눈으로 확인하는 것에 기대지 않는다. `CT-S*` ID 는 이 절 안에서만 쓴다. 두 화면의 시각 일관성 시나리오(CT-S8)도 의무다.

| ID | 시나리오 | 검증 | 1차 테스트 파일 |
| --- | --- | --- | --- |
| CT-S1 | LLM 이 공백 content 와 tool_use 를 함께 보낸다(Anthropic 의 빈 text block) | content 빈 값 동치, 부모 묶음으로 분류 | `conversation-utils.test.ts` |
| CT-S2 | `includeToolTurns: false` 와 도구 호출 1개 | lean 스레드 스냅샷 적용 뒤에도 🔧 도구 행 보존 | `use-execution-events.test.ts` |
| CT-S3 | `includeToolTurns: false` 와 한 턴 안 LLM 호출 2회 × 도구 N개 | 부모마다 자기 도구만 묶고 중복 묶음 없음 | `conversation-inspector.test.tsx` |
| CT-S4 | `includeToolTurns: true` | 스레드가 이미 나열한 도구·중간 항목이 중복 추가되지 않음(`mergeOrphanToolItems` 무동작) | `conversation-utils.test.ts` |
| CT-S5 | LLM 이 생각 텍스트와 tool_use 를 함께 보낸다 | 부모 묶음 아님. 본문과 `ToolCallBadge` 가 함께 보임 | `conversation-inspector.test.tsx` |
| CT-S6 | 멀티턴(턴 1 도구, 턴 2 도구) | 턴 경계를 넘어 부모-자식이 매칭되지 않음 | `conversation-inspector.test.tsx` |
| CT-S7 | `tool_call_completed` 가 `ai_message` 보다 늦게 도착 | `toolStatus` 이어받기로 success 가 pending 으로 되돌아가지 않음 | `use-execution-events.test.ts` |
| CT-S8 | 대화 미리보기와 실행 트리가 같은 항목을 받음 | `groupToolCallItems` 결과의 `claimedToolIndices`·`childrenByParent` 가 두 화면에서 같음(Inv-5) | `conversation-utils.test.ts`, `result-timeline.test.tsx` |
| CT-S9 | 멀티턴 AI 에이전트가 retryable 에러(예: HTTP 429, `details.retryable=true`)로 종료(`port: 'error'`, `status: 'ended'`) | (a) store `conversationMessages` 가 비지 않음(Inv-6) (b) 스레드 끝에 `system_error` APPEND (c) `[다시 시도]` 와 `retryAfterSec` 카운트다운 표시. 라이브와 내역 양쪽 검증(`parseHistoryMessages` 가 `output.error` 로 `system_error` 합성) | `execution-store.test.ts`, `use-execution-events.test.ts`, `conversation-utils.test.ts` |
| CT-S10 | 멀티턴 AI 에이전트가 retryable 이 아닌 에러(예: 인증 실패, `details.retryable=false`)로 종료 | (a) Inv-6 (b) `system_error` APPEND (c) `[다시 시도]` **없음**, 액션 영역 비어 있음 | `conversation-inspector.test.tsx`, `use-execution-events.test.ts` |
| CT-S11 | `execution.retry_last_turn` 을 보낸 뒤 새 `ai_assistant` 턴 수신 | (a) 기존 `system_error` 항목 그대로 보존 (b) 새 턴이 `system_error` 아래에 자연 순서로 추가 (c) 재시도 버튼 자리가 스피너로 바뀌었다가 새 응답이 오면 사라짐 | `use-execution-interaction-commands.test.ts` |
| CT-S12 | AI 에이전트 멀티턴의 `render_form` 활성 폼 제출 뒤 LLM 다음 응답까지 | (a) `resumeFromAiRenderForm` 뒤 `waitingNodeId`·`waitingInteractionType: 'ai_form_render'`·`waitingConversationConfig`(`pendingFormToolCall` 만 null)·`isWaitingAiResponse: true` 보존(Inv-7) (b) 대화 미리보기가 라이브 분기를 유지해 타임라인이 비지 않음 (c) 응답이 오면 새 `ai_assistant` 턴이 자연스럽게 붙음 | `execution-store.test.ts`, `assistant-presentations-block.test.tsx` |
| CT-S13 | 한 스레드에서 여러 턴에 걸쳐 `render_form` 활성·제출·재활성 | (a) `pendingFormToolCall.toolCallId` 와 맞는 턴 하나의 폼만 인터랙티브 `DynamicFormUI` (b) 나머지 폼(이미 제출됐거나 다른 도구 호출)은 `FormSubmittedContent` (c) `pendingFormToolCall` 이 null 이면 모든 폼이 `FormSubmittedContent` | `assistant-presentations-block.test.tsx` |
| CT-S14 | `render_form` 활성 중 사용자가 일반 텍스트 메시지를 보냄(폼 건너뜀) | (a) 백엔드 `processMultiTurnMessage` 가 `pendingFormToolCall` 과 맞는 도구의 tool_result 를 `{type:'cancelled', reason:'user_sent_message_instead'}` 로 채움 (b) `_resumeState.pendingFormToolCall` 비움 (c) 받은 텍스트가 `ai_user` 항목으로 쌓임 (d) 다음 LLM 응답에서 폼이 `FormSubmittedContent`(cancelled)로 바뀜 | `ai-agent.handler.test`, 통합 테스트 |
| CT-S15 | 멀티턴 AI 에이전트가 `node.failed` 와 `details.retryable === true` 로 종료 | (a) Inv-6 (b) **미리보기 탭 표시**(Inv-8), 대화 전체와 마지막 `system_error` (c) `nodeExecutionId` 가 있어 `[다시 시도]` 표시. 이벤트의 `output` 이 `NodeResult.outputData` 로 전달되는지도 함께 검증(엔진이 `node.failed` 에 대화 출력을 함께 싣는다, [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md)) | `use-execution-events.test.ts`, `result-detail.test.tsx` |
| CT-S16 | 멀티턴 AI 에이전트가 `node.failed` 와 `details.retryable === false` 로 종료(CT-S10 과 같은 조건) | (a) Inv-8 탭 표시 (b) **기본 탭이 미리보기**(retryable 무관 예외, [에디터 실행과 디버깅](CLE-EXEC-RUN.md)) (c) `[다시 시도]` 없음 (d) **대화형이 아닌 노드(`http_request` 등)는 여전히 오류 탭이 기본**. 일반 원칙 ED-EX-13 보존 회귀 | `result-detail.test.tsx` |
| CT-S17 | 오류로 끝난 대화 노드를 **새로고침 뒤 내역 화면**(`/executions/:id`, store 비어 있음)에서 조회 | (a) `outputData`(REST 스냅샷)로 미리보기 재구성, `status: 'failed'` 는 게이트가 아님(Inv-8) (b) `parseHistoryMessages` 가 `output.error` 로 `system_error` 합성 (c) `nodeExecutionId` 가 없어 `[다시 시도]` 자동 숨김 | `result-detail.test.tsx`, `conversation-utils.test.ts` |
| CT-S18 | 한 턴에 **지식 저장소 도구(`kb_*`) 호출**이 청크를 가져옴(`turnDebug[].ragSources` 가 비어 있지 않음). 같은 호출이 🔧 `ai_tool` 줄로도 보임 | (a) 🔎 `rag` 줄과 🔧 `ai_tool` 줄이 **각각 독립 행** (b) 세 가지 구분 신호가 모두 다름 (c) `groupToolCallItems` 가 `rag` 를 묶지 않아 도구 자식이 밀려나지 않음 (d) 📚 칩 병존 (e) **대화 미리보기와 실행 트리 두 화면에 동시에 표시** (f) **Inv-9**, 같은 turnIndex 에서 🔎 줄·📚 칩·참조 탭의 `sources[]` 가 같음 | `conversation-utils.test.ts`, `result-detail.test.tsx`, `result-timeline.test.tsx` |
| CT-S19 | `meta.turnDebug` 없음(옛 실행, legacy payload) | 🔎 줄 **생략**, 배치 손상 없음([요소별 시각과 소요 시간](CLE-EXEC-PREVIEW-RENDER.md#요소별-시각과-소요-시간) 의 결측 허용). 나머지 턴 렌더는 영향 없음 | `conversation-utils.test.ts`, `result-detail.test.tsx` |
| CT-S20 | **여러 노드가 공유하는 스레드**: 다른 노드(Presentation, 다른 AI 노드)의 턴이 섞인 스레드에서 선택한 노드의 `meta.turnDebug` 만 있음 | 선택한 노드가 만들지 않은 턴 앞에는 🔎 줄이 **붙지 않는다**. 스레드는 실행 범위지만 `meta` 는 노드 범위라 두 데이터의 범위가 다름을 고정한다. "노드 필터 없음" 원칙의 **예외가 아니다** | `conversation-utils.test.ts` |
| CT-S21 | AI 에이전트 단일 턴(설정 에코 `config.mode: 'single_turn'`)의 LLM 호출이 실패해 `port: 'error'` 와 `output.error` 를 실은 `node.failed` 나 `node.completed` 가 옴. store 에는 앞선 노드의 대화가 있음 | (a) 대화 미리보기 목록에 `system_error` 줄이 붙지 않음. `details.retryable === true` 여도 같음 (b) `[다시 시도]` **없음** (c) 실패는 오류 탭과 노드 결과 `output.error` 로 보임 | `use-execution-events.test.ts` |

시나리오의 **입력 fixture** 는 `codebase/frontend/src/components/editor/run-results/__tests__/fixtures/conversation-scenarios.ts` 에 한 export 로 둔다. 새 시나리오를 찾으면 이 표, fixture, 해당 테스트를 함께 추가하는 것이 PR 리뷰의 의무다.

**충족 테스트 매핑**: 아래 표는 CT-S1~CT-S8 을 채우는 기존 단위 테스트다. CT-S9~CT-S21 은 위 시나리오 표의 "1차 테스트 파일" 열이 대응 파일을 가리키고 테스트 이름 단위 매핑은 아직 이 표에 적지 않았다. 새 시나리오를 더하면 이 표의 충족 테스트도 함께 갱신한다.

| ID | 충족 테스트 |
| --- | --- |
| CT-S1 | `conversation-utils.test.ts`(`mergeOrphanToolItems` 공백 회귀 케이스와 `groupToolCallItems` describe), `conversation-inspector.test.tsx`("blank intermediate assistant 는 도구 호출 부모 헤더로 묶이고…") |
| CT-S2 | `conversation-utils.test.ts`(`mergeOrphanToolItems` "includeToolTurns:false 시 누락된 tool 아이템을…") |
| CT-S3 | `conversation-utils.test.ts`(`mergeOrphanToolItems` "같은 turn 에 tool 이 여러 개면…"), `conversation-inspector.test.tsx`("동일 turn 에 intermediate assistant 가 여러 개…") |
| CT-S4 | `conversation-utils.test.ts`(`mergeOrphanToolItems` "thread 가 이미 같은 toolCallId 를 들고 있으면 (includeToolTurns:true) no-op") |
| CT-S5 | `conversation-utils.test.ts`(`mergeOrphanToolItems` "content 가 있는 intermediate assistant…"), `conversation-inspector.test.tsx`("assistant content + toolCalls 가 둘 다 있으면…") |
| CT-S6 | `conversation-utils.test.ts`(`mergeOrphanToolItems` "multi-turn: 각 turn 의 tool 은 그 turn 의 final assistant 직전에…") |
| CT-S7 | `use-execution-events.test.ts`("ai_message snapshot preserves toolStatus from prior tool_call_completed events", "tool_call_completed creates a synthetic item when no started arrived first (out-of-order)") |
| CT-S8 | `conversation-utils.test.ts`(`groupToolCallItems` "CT-S8 — 양 surface 가 같은 items 에서 동일 결과"), `result-timeline.test.tsx`("live 대화 노드 expand 시 blank intermediate assistant + tool 이 parent-child tree 로 묶인다 (Inv-5)") |
