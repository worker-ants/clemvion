---
id: "CLE-NODE-PRES-COMMON-FORMWIRE"
title: "Presentation 노드 공통 — 폼 제출 wire format"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-PRES-COMMON"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-PRES", "CLE-NODE-PRES-COMMON"]
area: "CLE-NODE-PRES"
content_hash: "8443c582c726e552db0ea4f29a573875bc2a06ae65f5d929f72a2a3497fac3d0"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "511bc33294046e6eef9a4801430874543696ac1796769de072a0a2512df9b0ae"
etag: "sha256-547a269c2ddea18faf714b50fcfb73e8125339a1b8fdf721e93f945a2ee6e9fa"
---
## 개요

이 문서는 [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md) 의 하위 문서로 `render_form` 과 그래프 Form 노드의 사용자 제출이 지나는 층과 엔진 내부 재개 큐 payload 의 wire format 을 정한다. 표시 도구 모드 전반은 [표시 도구 모드](CLE-NODE-PRES-COMMON-TOOLS.md) 가 정한다.

## 폼 제출 wire format

`render_form` 과 그래프 Form 노드의 사용자 제출은 다음 네 층을 지난다. 이 절은 **엔진 내부 재개 큐 payload 층**의 wire format 단일 기준이다. 바깥 표면(WebSocket wire, 사용자 입력 기록, LLM 도구 결과 content, DB enum)은 이 층과 독립이고 각자의 기준을 유지한다.

`type: file` 필드 값이 `formData` 에 어떤 모양으로 담기는지(파일 본문 없이 메타데이터 배열)는 [표시 표면](CLE-NODE-PRES-COMMON-DISPLAY.md#파일-필드는-메타데이터만-보낸다) 이 정한다.

네 층 모두에 문자열 `'form_submitted'` 가 나오지만 뜻은 서로 독립이다.

| 층 | 위치 | 모양 | 기준 |
|---|---|---|---|
| (1) 외부 WebSocket wire | 클라이언트 → 서버 | `execution.submit_form` payload `{ executionId, formData }`. `nodeId`·`toolCallId` 는 클라이언트가 보내는 필드가 아니다. 대기 노드는 서버가 찾고 `toolCallId` 는 서버가 보관한 `pendingFormToolCall` 로 맞춘다 | [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) |
| (2) **내부 재개 큐 payload(이 절이 기준)** | 서버 내부 재개 큐(`execution-continuation`, BullMQ)의 `'continue'` 메시지 안 payload. 옛 Redis pub/sub `execution:continuation` 채널은 폐기했다([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)) | `{ type: 'form_submitted', formData }` 로 감싼 표시 값(sentinel) | 이 절 |
| (3) 사용자 입력 기록 | 노드 출력의 `output.interaction.type` | enum 값 `'form_submitted'`. Presentation 노드는 `button_click`·`button_continue`·`form_submitted` 세 값을 쓴다 | [노드 출력 규약 §4.5](../CLE-NODE/CLE-NODE-OUTPUT.md#45-interactiondata-형태) |
| (4) LLM 도구 결과 content | AI 에이전트 `render_form` 의 도구 결과 content(`render_form` 만 해당) | `{ ok: true, type: 'form_submitted', data: { …formData }, message: '<재호출 금지 안내문>' }` JSON. `ok`·`message` 는 LLM 이 같은 폼을 다시 부르지 않게 막는 가드 필드다. `data` 가 10KB 한도(`FORM_SUBMITTED_MAX_BYTES`)를 넘으면 선택 메타 `formDataTruncation: {originalBytes, bytesAfterCap, truncatedFields[]}` 를 함께 붙여 LLM 이 잘림을 추론에 반영하게 한다 | [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) |

**(2) 내부 payload 를 표시 값으로 감싼다**: `continueExecution(executionId, formData)` 는 `formData` 를 그대로 넣지 않는다. `{ type: 'form_submitted', formData }` 로 감싼 뒤 재개 큐에 넣는다. 호출 모양은 `bus.add({ type: 'continue', executionId, nodeExecutionId, payload: { type: 'form_submitted', formData } }, { jobId, attempts })` 다. consumer 는 감싼 payload 를 풀지 않고 그대로 `applyContinuation → rehydrateAndResume` 로 넘긴다. 처리기 dispatcher 가 표시 값으로 분기한다.

재개 큐 메시지 종류 여섯 가지(`continue` / `cancel` / `button_click` / `ai_message` / `ai_end_conversation` / `retry_last_turn`)는 **바뀌지 않는다**. 이 규약이 더하는 것은 `'continue'` 메시지 **payload 안의 `action.type` 표시 값** 한 가지다. 메시지 종류에 `'form_submitted'` 가 추가되지 않는다. 메시지 종류와 payload `action.type` 은 다른 층이다.

`retry_last_turn` 은 이 절의 Presentation 재개 분기 **범위 밖**이다. AI 에이전트 멀티턴 재진입(WebSocket `execution.retry_last_turn`) 전용이고 대상 행이 입력 대기가 아니라 새로 만든 실행 중 행이다([비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md)). 여섯 종은 재개 큐 전체 목록이고 Presentation 이 쓰는 것은 `continue` 와 `button_click` 이다.

### processAiResumeTurn 분기 네 경우를 명시적으로 맞춘다

AI 에이전트 멀티턴은 턴마다 rehydration 으로 단발 처리기 `processAiResumeTurn` 을 부른다. 오래 도는 루프가 아니다. 턴이 올 때마다 새로 띄우고 처리한 뒤 다시 park 해 세그먼트를 끝낸다. 처리기는 consumer 가 넘긴 action 의 `action.type` 으로 명시적으로 분기한다.

| `action.type` | 분기 | 처리 |
|---|---|---|
| `'ai_end_conversation'` | 종료 | `user_ended` 포트로 라우팅 |
| `'ai_message'` | AI 메시지 턴 | `handleAiMessageTurn(executionId, node, action.message, ...)` |
| `'form_submitted'` | 폼 제출 턴 | `handleAiMessageTurn(executionId, node, JSON.stringify(action.formData), ...)`. 핸들러 `processMultiTurnMessage` 의 폼 분기가 도구 결과 content `{ok:true, type:'form_submitted', data:{…}, message:'<재호출 금지 안내문>'}` JSON 을 채워 LLM 을 다시 부른다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)) |
| `'button_click'` | 버튼 클릭 | 다른 경로([블로킹 모드 실행 흐름](CLE-NODE-PRES-COMMON.md#블로킹-모드-실행-흐름)). AI 대화 대기 중에는 도달하지 않는다(아래) |
| 그 밖(`!type` 또는 매칭 실패) | **경고 로그 + 이번 턴 처리 없이 다시 park** | 조용히 건너뛰지 않는다. `logger.warn('[processAiResumeTurn] unknown action.type', { executionId, action })` 를 남기고 다음 재개를 기다린다. 턴 누적 방어는 `maxTurns` 한도가 다른 층에서 맡는다 |

`!('type' in action)` 으로 추측하는 매칭은 **폐기**했다. 폼 필드 이름이 `type` 이면 조용히 버려지는 원인이었다.

**`'form_submitted'` 의 `action.formData ?? {}` 대체값**: 처리기는 `handleAiMessageTurn(executionId, node, JSON.stringify(action.formData ?? {}), ...)` 로 부른다. `action.formData` 가 `null`·`undefined` 이면(예: `continueExecution(executionId, undefined)` 로 빈 폼 제출) 빈 객체 `{}` 로 대신한다. 외부 wire `execution.submit_form` 의 `formData` 는 늘 값이 있지만 내부 API 호출 경로가 깨지지 않게 하려는 것이다.

**AI 대화 대기 중에는 `'button_click'` 이 오지 않는다**: `processAiResumeTurn` 은 위 표의 네 경우 가운데 실제로는 `ai_end_conversation`·`ai_message`·`form_submitted` 세 경우만 받도록 설계됐다. `button_click` 은 `continueButtonClick → bus.publish({type:'button_click'})` 경로로 재개 큐의 별도 메시지 종류로 온다. `'continue'` 메시지의 payload 표시 값이 아니다. 지금 UI 는 AI 대화 대기 중(`interactionType: 'ai_conversation' | 'ai_form_render'`)에 그래프 노드의 버튼을 보여 주거나 라우팅하지 않는다. 그래서 이 경로로 `'button_click'` 이 오지 않는다. 표에 `'button_click'` 을 적은 것은 enum 을 빠짐없이 적기 위해서다. 나중에 UI 가 바뀌어 도달하면 그 밖 분기(경고 로그 + 다시 park)가 동작한다.

**재개 모델**: 단발 폼·버튼과 멀티턴 AI 모두 park 할 때 코루틴을 바로 풀고(park 는 세그먼트 종료) 재개는 rehydration 한 경로로 모은다. 메모리 안 resolver Map(`pendingContinuations`·`resolvePending`)은 제거했다. 모든 재개는 영속 rehydration(`applyContinuation → rehydrateAndResume`)으로 처리기를 새로 부른다. 위 그 밖 분기의 동작도 이 모델 기준이다([실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md)).

**외부 wire (1)은 그대로다**: WebSocket `execution.submit_form` payload `{ executionId, formData }` 는 바뀌지 않았다. 표시 값으로 감싸는 일은 백엔드 내부 경계(`continueExecution` → 재개 큐 → `applyContinuation → rehydrateAndResume`) 안에서만 한다. 프런트엔드와 외부 API 소비자에는 영향이 없다. [대화 스레드 운반](CLE-NODE-PRES-COMMON-TOOLS.md#대화-스레드-운반)의 "바깥 표면과 내부 층 분리" 원칙과 같은 모양이다.

## 구현 위치

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`continueExecution` 의 표시 값 감싸기)
- 폼 제출 경로: `continueExecution`(감싸기) → `ContinuationExecutionProcessor` → `ExecutionEngineService.applyContinuation → rehydrateAndResume`(전달) → `AiTurnOrchestrator.processAiResumeTurn`(네 경우 분기, `ai-turn-orchestrator.service.ts`, 엔진의 `EngineDriver` 위임) → `ai-agent.handler.processMultiTurnMessage`(`pendingFormToolCall` 매칭과 누락 시 대체 처리).

## Rationale

### 폼 제출을 표시 값으로 감싼다

[폼 제출 wire format](#폼-제출-wire-format) 에서 `continueExecution` 의 내부 재개 큐 payload 를 `{ type: 'form_submitted', formData }` 로 감싼다.

**배경**: 이전에는 `continueExecution(executionId, formData)` 가 `formData` 를 그대로 `payload` 에 넣어 publish 했다. `'continue'` listener 가 그 payload 를 그대로 action 으로 넘기면 `processAiResumeTurn` 은 `!('type' in action)` 으로 "type 키가 없으면 폼 제출" 이라고 추측했다. 사용자가 정의한 폼 필드 이름이 우연히 `type` 이면(예: `{type: '주문 문의', contact: '...'}`) `'type' in action === true` 인데 `'ai_end_conversation'`·`'ai_message'` 어느 분기에도 맞지 않아 **조용히 버려졌다**.

**결정**: 추측을 없애고 `{type:'form_submitted', formData}` 로 감싼다. 분기 네 경우(`ai_end_conversation`·`ai_message`·`form_submitted`·`button_click`)를 명시적으로 맞추고 맞지 않으면 경고 로그 + 처리 없이 다시 park 한다. `formData` 를 그대로 publish 하고 분기 순서만 바꾸는 안은 쓰지 않았다. 본질이 추측이라 폼 필드 이름이 `message` 같은 다른 경우에 다시 터진다. 감싸기는 분기가 명시적이고 검사 비용이 같으며 외부 wire 와 호환되고 같은 모양의 `ai_message`·`button_click`·`ai_end_conversation` 과 일관된다.

`option.value` 채우기, `button.id` 채우기([폼 옵션 값 채우기](CLE-NODE-PRES-COMMON-TOOLS.md#폼-옵션-값-채우기) · [버튼 ID 채우기](CLE-NODE-PRES-COMMON-TOOLS.md#버튼-id-채우기))와 원인이 같다. LLM 이나 사용자가 자유롭게 만든 데이터에 분기·비교·매칭 추측을 쓰면 조용한 실패가 생긴다. 해결도 같다. 표시 값이나 채우기로 명시하고 백엔드 기준 가드와 프런트엔드 방어를 함께 둔다.

**내부 재개 큐 층에만 적용하는 이유**:

- 외부 WebSocket wire(`execution.submit_form` payload `{executionId, formData}`)는 프런트엔드·외부 API 소비자와 맞물린 호환 표면이다. 바꾸면 클라이언트 SDK·사용자 가이드·외부 통합이 모두 흔들린다. 그래서 외부 wire 는 그대로 둔다.
- DB 의 사용자 행동 기록(`interaction_data.interactionType`, [인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md))과 노드 출력의 `output.interaction.type` 도 바깥에서 보이는 표면이다. 바꿀 필요가 없다. 표시 값은 엔진 내부 분기 층에만 쓴다.
- LLM 도구 결과 content(`{ok:true, type:'form_submitted', data:{…}, message:'<...>'}`)는 LLM 쪽 층이다. 기존 `{type, data}` 기준을 유지하고 재호출 가드 필드 `ok`·`message` 를 함께 직렬화한다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)). 가드 필드는 LLM 쪽 층에만 있고 (1)(2)(3) 층 형식은 바꾸지 않는다.

**맞지 않는 action 의 처리**: `action.type` 이 네 값 어디에도 없거나 `'type'` 키가 없으면 조용히 건너뛰지 않고 **경고 로그 + 처리 없이 다시 park** 한다. AI 에이전트의 "지식 저장소·MCP 는 우아하게 성능을 낮춘다" 패턴(한 서버나 지식 저장소 실패를 격리해 진단 메타로 알리고 대화는 이어 감)과 같은 모양이다. 사용자 화면은 끊기지 않고 운영자는 로그에서 분기 회귀를 바로 찾을 수 있다.

**`pendingFormToolCall` 이 없을 때**: 분기가 `'form_submitted'` 로 `handleAiMessageTurn` 을 부르면 핸들러 `processMultiTurnMessage` 가 `state.pendingFormToolCall` 이 맞는지 확인한다. 없으면(예: `render_form` 호출이 없는 턴에 사용자가 `execution.submit_form` 을 직접 보냄, 또는 경쟁 상태) 대체 규약은 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 가 정한다. 폼 JSON 을 평문 사용자 메시지로 대화 스레드에 쌓고 경고 로그를 남긴다. "`interactionType: 'ai_form_render'` 와 `pendingFormToolCall` 설정은 1:1" 불변식의 예외 처리다([AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md)).
