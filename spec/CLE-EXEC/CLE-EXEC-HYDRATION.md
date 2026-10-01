---
id: "CLE-EXEC-HYDRATION"
title: "실행 화면 복원 규약"
type: "convention"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-EXEC"
ancestors: ["CLE-VISION", "CLE-EXEC"]
area: "CLE-EXEC"
content_hash: "33ad468d6038937f91ada935375aaa5c489d003113c0ff5a7b4dc47c01db562a"
read_as: "approved"
task: null
source_paths: ["spec/conventions/data-hydration-surfaces.md"]
mirror_sha256: "3a9eb1aa3fb2249193980b3d7e3083d8234c6c2b9bdb87228e2d27974d0171bc"
etag: "sha256-1a7cbd2c9f719be39fe50cc9546997359eb7e9b93b3e130eaaa4ba3f6ede0150"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/data-hydration-surfaces.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

실행 화면 복원(hydration)은 저장되거나 전송된 노드 출력을 프런트 화면에 되살리는 동작이다. 같은 노드 출력 필드가 여러 화면에서 서로 다른 복원 함수를 거친다. 이 규약은 필드마다 어느 화면에서 어느 함수로 복원되는지를 매트릭스로 정하고 새 필드를 더할 때 모든 복원 함수를 함께 고치게 강제한다.

화면은 네 가지다.

| 화면 | 뜻 |
| --- | --- |
| 라이브(Live) | 실행 중 실시간 이벤트로 채우는 에디터 실행 결과 드로어 |
| 대기 맞추기(Waiting reconcile) | 입력 대기 실행을 페이지 진입이나 재구독 때 REST·스냅샷으로 다시 채우는 경우 |
| 완료 내역(Completed history) | 실행 내역 화면처럼 라이브 스레드 없이 저장된 노드 출력으로 채우는 경우 |
| Replay(v2) | 여러 노드를 가로지르는 대화 스레드 재구성 보기. 아직 없다 |

이 규약이 막으려는 회귀는 "실행 내역 화면에서 presentations 인라인 렌더가 사라지는" 종류다. 한 화면만 고치고 다른 화면을 빠뜨리는 실수를 스펙과 하네스 양쪽에서 막는다.

범위 밖:

- 노드 출력 다섯 필드의 뜻과 배치는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md), AI 에이전트 노드 출력 필드는 [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md) 가 정한다.
- 실시간 이벤트 정의는 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 이 정한다.
- 대화 기록의 1차 데이터 소스와 이벤트별 store 변환 규칙은 [대화 미리보기](CLE-EXEC-PREVIEW.md) 가 정한다. 이 문서는 그 규칙을 어느 함수가 맡는지 목록으로 정리한다.
- 엔진이 DB 에서 실행 컨텍스트를 되살리는 rehydration 은 이 문서와 다른 개념이다([실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md)).

## 규칙

1. 노드 출력 필드를 새로 더하면 이 문서의 [출력 필드별 복원 매트릭스](#출력-필드별-복원-매트릭스) 에 행을 더한다. 백엔드가 그 필드를 싣는 위치와 프런트 복원 함수 N개를 모두 적는다.
2. 백엔드는 핸들러의 모든 종료 분기(single-turn `out`, 멀티턴 `user_ended`·`max_turns`·`condition`·`error`, 에러 출력)에 같은 필드를 함께 더한다. 재개 상태(`_resumeState`)에 누적이 필요하면 이어받는 패턴(`state.allFoo`)도 함께 더한다.
3. 프런트는 매트릭스가 가리키는 모든 복원 함수에 처리를 함께 더한다. 누락을 알리려면 exhaustive 패턴(TypeScript `assertNever`)을 쓰거나 필드 optional chaining 과 경고 로그를 쓴다.
4. 단위 테스트 `codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts` 가 매트릭스 행과 코드 검색 결과를 자동으로 비교한다. 빠지면 실패한다.
5. 매트릭스가 가리키는 함수는 이 규약에 등록된 경로만 쓴다. 대화 기록 변환 함수의 등가성과 목록은 [대화 미리보기](CLE-EXEC-PREVIEW.md) 의 변환 함수 계약이 정한다.

## 출력 필드별 복원 매트릭스

### AI 에이전트 멀티턴·single-turn

| 필드 | 백엔드가 싣는 위치 | 프런트 복원 함수(필수 N개) |
| --- | --- | --- |
| `output.result.response` | single-turn `out`, 멀티턴 `user_ended`·`max_turns`·`condition`·`error` | (a) `messagesToConversationItems` (b) `parseHistoryMessages` (c) `applyExecutionSnapshot` 대기 분기 |
| `output.result.messages` | 모든 멀티턴 종료와 대기 틱 | (a)~(c)와 (d) `threadTurnsToConversationItems`(라이브 스레드 스냅샷의 대체 경로) |
| `output.result.turnCount`(와 `config.maxTurns`) | 위와 같다 | (a)~(c)에 더해 두 곳. `SummaryView`(`ConversationInspector`)의 라이브 턴 카운터는 분모 `M` 을 별도 prop `conversationConfig.maxTurns`(종료 노드 출력의 최상위 `config.maxTurns`)에서 읽는다. `ResultTimeline` 의 "Turn N/M" 은 구조화 출력(`{config, output}`)이면 `buildConvConfigFromStructured`(`apply-execution-snapshot.ts` 와 공유하는 헬퍼)로 최상위 `config.maxTurns` 와 `output.result.turnCount` 를 합쳐 분모 `M` 을 표시한다. 옛 형태만 `output.conversationConfig` 를 직접 읽는다. `maxTurns` 는 정적 설정 값이라 `output.result.*` 에 싣지 않는다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 원칙 1.1) |
| `output.result.presentations` | AI 에이전트 출력 규약의 presentations 싣기. single-turn `out`, 멀티턴 최종, 조건 경로(`buildMultiTurnFinalOutput`·`buildConditionOutput` 의 `metadata.allPresentations`) | (a) `parseHistoryMessages` 의 마지막 assistant 부착 (b) `threadTurnsToConversationItems` 의 턴 단위 presentations 부착 (c) `AssistantPresentationsBlock` 렌더 (d) `applyExecutionSnapshot` 의 대화 채우기 경로 |
| `output.interaction`(resumed) | 멀티턴 `resumed` transient, `ai_form_render` 대기. AI 메시지 턴의 structured `resumed` 스냅샷(`message_received`)은 현재 내보내지 않는다(Planned, [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md)). `resumed` 스냅샷은 form·buttons 경로에만 있다 | (a) `pauseForConversation` 의 대화 설정 부착 (b) WebSocket `handleAiMessage` |
| `output.error`(멀티턴 에러 종료) | 멀티턴 `port: 'error'`. `buildMultiTurnFinalOutput` 의 `errorPayload` 경로(단일 출처 `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`). `details.retryable`·`retryAfterSec` 표준 필드는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 LLM 계열 `details` 공통 필드가 정한다 | (a) `parseHistoryMessages` 가 `output.error` 가 있는 멀티턴 종료 노드의 스레드 끝에 `system_error` 항목 합성 (b) `threadTurnsToConversationItems` 의 `system_error` 출처 매핑 (c) `applyExecutionSnapshot` 의 종료 분기 (d) WebSocket `execution.node.failed`·에러가 있는 `node.completed` → `useExecutionStore` APPEND([대화 미리보기](CLE-EXEC-PREVIEW.md) 의 이벤트별 store 변환) |
| `meta.interactionType` | 모든 멀티턴 대기 | (a) `isConversationOutput` (b) `inferInteractionTypeFromNodeType` 대체 경로 (c) `applyExecutionSnapshot` 의 interactionType 분기 |
| `meta.presentationCalls`, `meta.presentationSchemaViolations` | AI 에이전트의 `render_*` 호출 기록 | 디버그 패널만(대화 미리보기의 도구 항목) |

### Presentation 노드 (Carousel·Table·Chart·Form·Template)

| 필드 | 백엔드가 싣는 위치 | 프런트 복원 |
| --- | --- | --- |
| `output.items`, `output.rows`, `output.data`, `output.rendered` | Presentation 핸들러의 대기·재개 출력 | `PresentationContent`(미리보기 탭) |
| `output.interaction`(`form_submitted`, `button_click`, `button_continue`) | 재개 틱 | `inferInteractionTypeFromData`(`conversation-utils.ts`)와 `submitForm`(`use-execution-interaction-commands.ts`)의 인라인 `addConversationMessage` 로 optimistic `presentation_user` 항목을 넣는다. 그 뒤 WebSocket 권위 스레드 스냅샷이 덮어쓴다 |

## 화면별 복원 함수

### 라이브 (실행 중 실시간 이벤트)

| 트리거 | 함수 |
| --- | --- |
| `execution.ai_message` 이벤트 | `handleAiMessage` → `messagesToConversationItems` |
| `execution.user_message` 이벤트 | 현재 구현은 `handleUserMessage`. store 반영 규칙(같은 발화의 말풍선이 있으면 `receivedAt` 만 찍고 없을 때만 `ai_user` 항목을 붙임)은 [대화 미리보기](CLE-EXEC-PREVIEW.md) 가 정한다 |
| `execution.waiting_for_input` 이벤트(`ai_conversation`, `ai_form_render`) | `handleWaitingForInput` → `threadTurnsToConversationItems` 와 `mergeOrphanToolItems`(스레드 스냅샷 우선) |
| `execution.tool_call_started`, `execution.tool_call_completed` 이벤트 | `upsertToolItem`, `updateToolItem` |

### 대기 맞추기 (페이지 진입·재구독)

| 트리거 | 함수 |
| --- | --- |
| REST `/executions/:id` 응답 | `applyExecutionSnapshot` 대기 분기 → `maybeSeedAiConversationMessages` 와 `pauseForConversation` |
| `execution.snapshot` 이벤트 | 위와 같다 |

### 완료 내역 (실행 내역 화면)

| 트리거 | 함수 |
| --- | --- |
| 노드 실행 `outputData`(REST 조회, 라이브 스레드 없음) | `parseHistoryMessages` → `messagesToConversationItems` 와 마지막 assistant presentations 부착. **`output.error` 가 있는 멀티턴**이면 끝에 `system_error` 항목을 합성한다([대화 미리보기](CLE-EXEC-PREVIEW.md) 의 CT-S9) |

### Replay (예정, v2)

| 트리거 | 함수 |
| --- | --- |
| 대화 스레드 재구성 보기 | EH-DETAIL-12. 실행 내역의 여러 노드 대화 재구성(v2, [실행 내역](CLE-EXEC-HISTORY.md)) |

## 구현 위치

- `codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts` (매트릭스와 코드 비교 가드)
- `codebase/frontend/src/lib/conversation/conversation-utils.ts` (변환 함수)
- `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` (대기 맞추기)
- `codebase/frontend/src/components/editor/run-results/result-timeline.tsx` ("Turn N/M" 표기)

## Rationale

### 매트릭스와 가드로 여러 화면을 함께 고치게 한다

"실행 내역 화면에서 presentations 가 안 보인다" 는 회귀의 원인은 단순했다. 백엔드가 presentations 를 대화 기록 항목(`ConversationTurn.presentations`)에만 저장했고 실행 내역 화면은 스레드 스냅샷을 가져오지 않아 프런트가 볼 수 없었다.

근본 원인은 같은 데이터가 화면마다 다른 복원 경로를 거치는데 새 필드를 더할 때 "어느 경로에서 어떻게 보여야 하는지" 가 스펙에 없었던 것이다. 그래서 개발자가 한 화면만 고치고 다른 화면을 빠뜨렸다. 이 규약은 매트릭스와 가드로 N개 화면을 함께 고치게 강제한다. `output.result.presentations` 행이 첫 적용 사례다.
