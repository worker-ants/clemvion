---
id: "CLE-EXEC-PREVIEW-RENDER"
title: "대화 미리보기 — 시각 매핑과 데이터 소스"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-PREVIEW"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-PREVIEW"]
area: "CLE-EXEC"
content_hash: "27f76ea483f2bd0498b85f79371b7fa8e22b4c2a2474055f869eea8390627db8"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "718b37eae727f969795aaef1ee8216e656598adecb2887f087ae1054f0dcb01f"
etag: "sha256-bb5454dfc96e1e6c0261bc4dc345c508f59a5fb34e76af406f0ff21aaae5ac87"
---
## 개요

이 문서는 [대화 미리보기](CLE-EXEC-PREVIEW.md) 의 하위 문서로 항목 출처별 시각 형식, 출처 구분 신호, 데이터 소스 선택, 원문 노출 금지와 마커 제거, 도구 호출 묶음, 빈 content 판정, 요소별 시각과 소요 시간을 정한다. `Inv-N` 불변량은 [대화 미리보기 §UI 불변량](CLE-EXEC-PREVIEW.md#ui-불변량) 이 정한다.

## 출처별 시각 매핑

항목 출처와 UI 형식은 1:1 이다. 출처 값의 정의는 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 가 정한다.

| 항목 출처 | UI 형식 | 머리 | 본문 |
| --- | --- | --- | --- |
| `ai_user` | 👤 user 말풍선(오른쪽 정렬, 강조 배경) | 없음 | `text` |
| `ai_assistant` | 🤖 assistant 말풍선(왼쪽 정렬, 일반 배경). 단 `toolCalls?.length ≥ 1` 이고 `isAssistantContentBlank(text)` 면 [도구 호출 묶음](#도구-호출-묶음) 의 **부모** 칩으로 바꾼다 | 없음 | `text`(markdown 렌더). `presentations[]` 가 있으면 말풍선 안에 캐러셀·차트·테이블·템플릿·폼을 인라인으로 렌더한다. `type: 'form'` 페이로드는 `pendingFormToolCall.toolCallId` 와 맞으면 **인터랙티브 `DynamicFormUI`**, 아니면 `FormSubmittedContent` 로 렌더한다. 활성 폼 UI 의 기준은 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 다 |
| `presentation_user` | 🧩 회색 시스템 카드(전체 폭) | `<노드 유형 아이콘> <nodeLabel>` 칩과 인터랙션 라벨(`button clicked`, `form submitted`, `link continue`) | `data` 메타에서 뽑는다(대화 스레드 문서의 인터랙션 표 참조). `text` 의 동사 접두(`clicked:`, `continued:`)는 머리로 옮겨 본문에 다시 쓰지 않는다 |
| `ai_tool` | 🔧 도구 호출 카드(`mcp_*` 카드와 같은 모양). 부모 묶음의 자식이든 단독이든 같은 행 배치다(Inv-1) | 도구 이름과 상태 배지(`pending`, `success`, `error`). 단계와 상관없이 배치는 같고 상태만 바뀐다 | 결과 미리보기(JSON 또는 텍스트, 토글) |
| `rag` | 🔎 **점선 테두리 전체 폭 줄**. 말풍선도 실선 카드도 아니다(`ai_tool` 과 컨테이너로 구분). 세 가지 구분 신호를 모두 적용한다. 도구 호출 묶음 분류 **대상이 아니다** | `KB · <N> chunk(s)` 칩 | 중복을 뺀 문서 이름 목록(📚 칩과 같은 규칙, `MAX_VISIBLE_DOC_NAMES` 를 넘으면 `+N`). 누르면 참조 탭의 해당 턴 그룹으로 이동 |
| `system` | ℹ️ 가운데 정렬 알림 줄(얇은 회색 텍스트). **v1 은 자동으로 쌓지 않는다**(예약 값). 수동으로 쌓거나 v2 에서 자동으로 쌓을 때 쓰이며 UI 는 이 형식을 미리 구현해 둔다 | "System note" | `text` |
| `system_error` | ❌ 가운데 정렬 얇은 빨간 전체 폭 줄. system 알림과 같은 급의 컨테이너지만 빨간 강조다. 말풍선이 아니다. 세 가지 구분 신호를 모두 적용한다. 오른쪽 액션 영역은 `data.retryable === true` 면 `[다시 시도]` 버튼과 `data.retryAfterSec` 카운트다운, `false` 면 비어 있다 | `<nodeLabel> · <code>` 칩(예: `CS Bot · LLM_RATE_LIMIT`) | `data.message`(LLM 프로바이더의 에러 텍스트). markdown 으로 렌더하지 않는다 |

`system_error` 와 `rag` 는 백엔드가 쌓는 값이 아니라 프런트가 합성하는 출처다. `system_error` 는 노드 출력의 `output.error` 로부터, `rag` 는 `meta.turnDebug[].ragSources` 로부터 만든다. `system_error` 의 `data` 형태는 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 가 정한다.

`rag` 줄은 그 턴에 지식 저장소 도구(`kb_*`) 호출이 가져온 청크를 턴 단위로 모아 보여 준다. 엔진은 LLM 호출 전에 지식 저장소를 미리 검색하지 않는다(2026-10-10 결정, [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md)). 그래서 같은 호출이 🔧 `ai_tool` 도구 행으로도 보인다. 도구 행은 호출 하나와 그 결과를, `rag` 줄은 그 턴에 모인 청크를 `chunkId` 중복 없이 보여 준다.

### [다시 시도] 버튼 조건

`system_error` 줄의 [다시 시도] 버튼은 두 조건을 모두 만족할 때만 보인다.

1. `data.retryable === true` 다.
2. 항목에 `nodeExecutionId` 가 있다. 이 값은 마지막 턴 재시도 명령(`execution.retry_last_turn`)의 payload 키다([대화 스레드 §`system_error` 데이터](../CLE-IX/CLE-IX-THREAD.md#system_error-데이터)). 실시간 이벤트로 만든 store 항목에만 있고 내역 화면이 `output.error` 로 합성한 항목에는 없다([데이터 소스](#데이터-소스)).

현재 구현(`conversation-inspector.tsx`)은 이 두 조건에 더해 재시도 명령 콜백(`onRetry`)이 연결돼 있는지도 확인한다. 실시간 `system_error` 는 AI 에이전트 노드(`ai_agent`)이고 store 에 대화가 이미 있을 때만 붙인다(`use-execution-events.ts` 의 `isMultiTurnAiContext`). AI 에이전트 단일 턴의 실패(출력의 설정 에코 `config.mode` 가 `single_turn`)에는 store 에 앞선 대화가 있어도 붙이지 않는다. 근거는 [Rationale](#단일-턴-실패에는-system_error-를-붙이지-않는다-2026-11-01) 에 있다. 정보 추출기는 멀티턴 실패를 `retryable=true` 로 내지만 마지막 턴 재시도 상태(`_retryState`)를 만들지 않는다. 그래서 정보 추출기 실패에는 실시간 `system_error` 가 붙지 않고 버튼도 없다. 이 노드 유형 조건이 없으면 버튼을 눌렀을 때 `RETRY_STATE_NOT_FOUND` 가 난다. 정보 추출기에 마지막 턴 재시도를 들일지는 [정보 추출기 §미결 사항](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md#미결-사항) 에서 다룬다.

## 세 가지 구분 신호

사용자가 진짜 user 메시지와 다른 출처를 헷갈리지 않도록 세 신호를 **동시에** 적용한다. 한 신호만으로 구분하지 않는다. 색약·다크 모드·작은 화면을 고려한 규칙이다.

1. **아이콘**: 👤(user), 🤖(assistant), 🧩(presentation), 🔧(tool), 🔎(rag), ℹ️(system), ❌(system_error). 서로 겹치지 않는 글리프다.
2. **컨테이너 형식**: 말풍선(둥근 배경, 좌우 정렬), 전체 폭 회색 카드, 전체 폭 **점선** 줄(rag), 가운데 정렬 줄(system 회색, system_error 빨간 강조).
3. **출처 칩**: presentation·tool·rag·system·system_error 는 머리에 칩을 단다. system_error 는 `<nodeLabel> · <code>`, rag 는 `KB · <N> chunk(s)` 형식이다. user·assistant 말풍선에는 칩이 없다.

`rag` 와 `ai_tool` 은 세 신호가 모두 달라야 한다. 같은 `kb_*` 호출에서 나오지만 보여 주는 단위가 달라서 한 신호(예: 아이콘)만 다르면 사용자가 같은 검색을 두 번 한 것으로 잘못 읽는다. 그래서 아이콘(🔎/🔧), 컨테이너(점선 줄/실선 카드), 칩(`KB · N chunk(s)`/도구 이름)이 모두 다르다.

이 규칙은 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 의 전송 출처 표시(`live`·`injected`)에 대한 옛 권장(injected 칩)을 강제로 올린 것이다. 근거는 [대화 미리보기 §Rationale](CLE-EXEC-PREVIEW.md#렌더-규칙을-데이터-모델과-분리한다) 에 있다.

## 데이터 소스

| 용도 | 1차 소스 | 비고 |
| --- | --- | --- |
| 대화 미리보기 탭(`meta.interactionType: "ai_conversation"`) | `conversationThread.turns` 스냅샷([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 의 입력 대기 스레드 스냅샷) | source·nodeLabel·data 메타를 바로 쓴다. 언제 어떻게 적용하는지는 [이벤트별 store 변환](CLE-EXEC-PREVIEW-STORE.md#이벤트별-store-변환) 이 정한다 |
| LLM 사용량·요청·응답 탭(디버그) | `ai_message.messages[]` | 전송 출처 표시(`live`·`injected`)와 접두가 LLM 으로 간 모양 그대로 보인다. "Raw payload" 토글로 접두와 마커를 드러낸다 |
| 대화 미리보기의 **보조 관찰성 레인**: 🔎 `rag` 줄과 📚 참조 칩 | **`meta.turnDebug[].ragSources` 만**(라이브와 내역이 같다) | 위 첫 행을 **대신하지 않고 더하는** 별도 축이다. 대화 턴의 1차 소스는 여전히 스레드 스냅샷이다. `meta.turnDebug` 전체가 아니라 `ragSources` 만이다. 형제 필드 `llmCalls` 는 원문 디버그 페이로드로 정해진 필드라 보호 대상이다. 노출 정책은 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 이 정한다. 라이브 출처는 입력 대기 이벤트의 `nodeOutput.meta.turnDebug`, 내역 출처는 영속된 `outputData.meta` 다 |
| 실행 내역(`/executions/:id`) 복원 | 노드 실행의 `output.result.messages`(DB 영속)와 `output.interaction` | 두 경로는 각자 기준이다. `output.result.messages` 는 LLM 호출 결과 누적, `output.interaction` 은 Presentation 인터랙션 한 건이다. 화면이 복원할 때 둘을 합쳐 `conversationThread.turns` 와 같은 모양을 다시 만든다. 여러 노드를 가로지르는 재구성 정책은 [실행 내역](CLE-EXEC-HISTORY.md) 의 EH-DETAIL-12(v2)로 미룬다. 디버그 탭만 emit 형태로 다시 만든다. **오류로 끝난 노드(`output.error` 있음)도 이 행을 따르고 `status` 로 가르지 않는다.** 엔진은 실패해도 `outputData` 를 저장·전송하고 오류 종료 출력에는 `output.error` 와 일부 `output.result.*` 가 함께 있어 다시 만들 수 있다([AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md)). `system_error` 는 `output.error` 로 합성하며 `nodeExecutionId` 를 싣지 않으므로 재시도 버튼이 자동으로 숨는다. Inv-8 참조 |
| 오류 종료 · **라이브** 세션 | store `conversationMessages`([store 초기화 정책](CLE-EXEC-PREVIEW-STORE.md#store-초기화-정책) 의 권위 사본) | 위 내역 행과 같은 대화지만 라이브에서는 store 의 `system_error` 에만 `nodeExecutionId` 가 있어 [다시 시도] 를 켤 수 있다. 그래서 store 에 그 노드의 `system_error` 가 있으면 store 를 우선하고 없으면(새로고침·내역) 위 행으로 되돌아간다. 두 소스는 같은 스레드의 다른 매체이지 서로 다른 기준이 아니다 |

## 원문 노출 금지와 마커 제거

**emit 메시지 원문 노출 금지**: 대화 미리보기 탭과 모든 대화 타임라인 UI 는 `ai_message.messages[]` 의 `content` 를 원문 그대로 노출하지 않는다. 원문이 필요한 디버그 패널(LLM 요청·응답)만 예외이고 그 패널은 "Raw payload" 토글로 원문임을 밝힌다.

**LLM 전용 마커 제거**: 백엔드는 프롬프트 주입 방어용으로 사용자 입력 마커(`[user-input]…[/user-input]`)를 LLM 페이로드에 일부러 넣고 그대로 전송·저장한다. 미리보기 렌더러는 사용자에게 보이기 전에 정규식 `/\[\/?user-input\]/g` 로 마커를 지운다. 안쪽 내용은 남긴다. 마커를 넣는 규칙은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 가 정한다. 지우는 곳은 네 군데다.

- `messagesToConversationItems`: emit 메시지 `user`·`assistant` content
- `threadTurnsToConversationItems`: `conversationThread.turns` 의 프런트 출처 일곱 값 전부(`system_error`·`rag` 포함). switch 에 case 가 일곱 개 있다. 합성 출처 두 값은 전송 데이터에 오지 않지만 `_exhaustive: never` 가 case 를 강제한다
- `parseHistoryMessages`: 내역 재구성 경로
- `mergeOrphanToolItems`: 부모-자식 묶음을 다시 만들 때 이전 항목의 제거 결과를 보존한다

원문이 필요한 탭(LLM 요청·응답·LLM 사용량)만 "Raw payload" 토글로 마커가 있는 원문을 보여 준다. 새 인라인 마커를 도입하려면 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 의 마커 규칙을 먼저 고쳐야 한다.

## 도구 호출 묶음

LLM 호출 한 번이 `ai_assistant` 항목 하나다. 다음 조건을 모두 만족하면 그 항목을 **도구 호출 묶음 부모**로 분류한다.

1. `source === 'ai_assistant'`(전송 데이터) 또는 store `type === 'assistant'`
2. `turn.toolCalls?.length >= 1`(전송 데이터) 또는 store `item.assistantToolCalls?.length >= 1`
3. `isAssistantContentBlank(text|content)` 가 참([빈 content 판정](#빈-content-판정))

같은 턴에서 뒤따르는 `ai_tool` 항목(store 에서는 `type: "tool"`) 가운데 아직 다른 부모에 묶이지 않은 것을 `toolCalls.length`(store: `assistantToolCalls.length`) 개까지 **자식**으로 묶는다. 부모가 나열한 자식 수만큼 뒤따르는 미묶음 도구를 순서대로 가져간다. `assistantToolCalls` 의 `id` 는 앞으로의 호환을 위해 버려져 있어서 순서·개수 매칭이 기준이다.

**단일 결정 함수**: `groupToolCallItems(items: ConversationItem[]): { claimedToolIndices: Set<number>; childrenByParent: Map<number, number[]> }` 를 `codebase/frontend/src/lib/conversation/conversation-utils.ts` 에서 export 한다. 이 함수가 분류와 순서 매칭 결과를 두 화면에 똑같이 공급한다(Inv-5). 묶음 정책을 바꾸면 이 함수 하나만 고치고 모든 화면에 저절로 반영된다.

**`system_error` 와 `rag` 는 묶음 분류 대상이 아니다.** `groupToolCallItems` 는 두 출처 항목을 묶지 않은 상태로 두고 들여쓰기 트리에 넣지 않는다. 부모로도 자식으로도 분류하지 않고 `isAssistantContentBlank` 도 평가하지 않는다. 두 항목은 제자리에 독립 줄로 표시된다(`system_error` 는 빨간 줄, `rag` 는 점선 줄). "묶음 단위로만 줄어든다"(Inv-2)와 맞는다. `rag` 를 부모의 `toolCalls.length` 순서 매칭에 넣으면 실제 도구 자식 하나가 밀려난다([Rationale](#rag-줄을-보조-관찰성-레인으로-둔다)).

| 영역 | 모양 |
| --- | --- |
| 부모 | 작은 칩 머리: `🤖 AI · 🔧 N개 도구 호출`. 둥근 말풍선이 아니라 inline-flex 칩이다 |
| 자식 컨테이너 | 왼쪽 세로줄(`border-l-2`)과 `ml-3 pl-3` 들여쓰기 |
| 각 자식 | `ai_tool` 행 모양 그대로(🔧, 이름, 상태 배지, 결과 미리보기) |

content 가 비어 있지 않은 assistant(LLM 의 생각 텍스트 등)는 부모로 분류하지 않는다. 표준 `ai_assistant` 말풍선으로 렌더하고 본문 아래에 `ToolCallBadge` 를 단다. 자식 행도 누를 수 있다. `onSelectMessage(childIndex)` 가 그대로 불려 `SelectedItemDetail` 의 `ToolDetail` 로 들어간다.

**적용 화면**: 이 정책은 두 타임라인 화면에 **동시에** 적용한다.

1. 미리보기 탭의 대화 미리보기(`SummaryView`, 말풍선형 타임라인). 작은 칩 머리와 들여쓴 자식 그대로다.
2. 왼쪽 실행 트리(`ResultTimeline`, AI 에이전트 노드 아래 대화 항목). 한 줄 형태에 맞춰 부모 행은 `🤖 AI · 🔧 N개 도구 호출` 한 줄이고 자식은 왼쪽 세로줄과 `pl-3` 들여쓰기로 넣는다. 칩과 전체 말풍선 두 형태가 한 화면에 섞이지 않게 해 세 가지 구분 신호의 동치를 지킨다.

두 화면의 모양이 다르면 사용자가 "어느 쪽이 진짜 호출 결과냐" 를 헷갈리므로 분류 결과는 Inv-5 대로 같아야 한다.

## 빈 content 판정

`isAssistantContentBlank(content: unknown): boolean` 이 **단일 결정 함수**다.

```ts
function isAssistantContentBlank(content: unknown): boolean {
  return typeof content !== "string" || content.trim() === "";
}
```

**구현 위치 의무**: `codebase/frontend/src/lib/conversation/conversation-utils.ts` 에서 export 한다. UI 컴포넌트(`conversation-inspector.tsx`)와 변환 함수(`messagesToConversationItems`, `threadTurnsToConversationItems`, `mergeOrphanToolItems`)가 같은 함수를 import 해서 쓴다. 여러 곳에 정의하지 않는다.

다음 네 가지를 모두 **같은 빈 값**으로 처리한다.

- `null`
- `undefined`
- `""`(빈 문자열)
- `" "`, `"\n"`, `"   \t\n"` 처럼 공백만 있는 문자열

입력은 대화 기록 항목의 `text` 다. Anthropic 의 별도 `extended_thinking` content block 은 `turn.text` 에 합쳐지지 않으므로 이 판정에 영향이 없다(extended_thinking 처리는 별도 항목이다).

이 판정을 쓰는 곳은 세 군데다.

1. **묶음 분류**([도구 호출 묶음](#도구-호출-묶음)): `ai_assistant` 가 부모인지 정한다.
2. **머리 라벨**(`SelectedItemDetail`): `hasToolCalls && isAssistantContentBlank(content)` 면 "Tool Call — Turn N", 아니면 "AI Response — Turn N".
3. **자리 표시**(타임라인 말풍선): content 와 toolCalls 가 모두 없을 때만 `(empty)` 를 표시한다.

LLM 프로바이더가 content 를 어떤 모양으로 보내든(Anthropic `null`, OpenAI `null`, Google `null`, 공백 text block) UI 동작은 **같아야** 한다.

## 요소별 시각과 소요 시간

디버깅 화면은 멀티턴 AI 노드의 **모든 대화 요소**에 절대 발생 시각을 표시하고 의미 있는 요소에는 소요 시간도 표시한다. 노드 단위가 아니라 **요소(턴) 단위**로 표시하는 것이 기준이다.

| store `type`(전송 출처) | 발생 시각 출처 | 소요 시간 출처 |
| --- | --- | --- |
| `user`(`ai_user`) | `item.timestamp`(WebSocket `user_message.receivedAt` 또는 `turns[].timestamp`) | 없음(즉시 수신, 표시 안 함) |
| `assistant`(`ai_assistant`), 도구 호출만 있는 응답 포함 | `item.timestamp`(`llmCalls[].startedAt`, [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)) | `item.durationMs`(`llmCalls[].durationMs`, LLM 지연 시간) |
| `tool`(`ai_tool`) | `item.timestamp`(`tool_call_started.startedAt` 또는 `turnDebug[].toolCalls[].startedAt`) | `item.durationMs`(`tool_call_completed.durationMs`) |
| `presentation`(`presentation_user`) | `item.timestamp`(`turns[].timestamp`) | 없음 |
| `system`, `system_error` | `item.timestamp`(`turns[].timestamp` 또는 노드 `finishedAt`) | 없음 |
| `rag` | 같은 `turnIndex` 의 **부모 assistant 턴 `llmCalls[0].startedAt`** 을 대신 쓴다. `RagSource` 스키마([Graph RAG](../CLE-KB/CLE-KB-GRAPH.md))에 시각 필드가 없기 때문이다. 검색 시각이 아니라 턴의 기준 시각이다 | 없음(턴 단위로 모은 표시라 표시 안 함) |

**표시 규칙**

1. **절대 시각**: `@/lib/utils/date` 의 `formatDate(item.timestamp, "time-seconds")`(좁은 행, 같은 분 안 여러 턴을 가르려고 초까지) 또는 `"datetime"`(상세 머리)으로 렌더한다. `toLocaleString` 을 직접 부르지 않는다(AGENTS.md 날짜·시간 규약).
2. **소요 시간**: `assistant`·`tool` 의 `durationMs` 를 `formatDuration` 으로 렌더한다. 도구 호출만 있는 assistant 응답도 LLM 지연 시간을 똑같이 표시한다.
3. **동시 적용 화면**: 도구 호출 묶음의 적용 화면 두 곳과 상세·내역 화면에 모두 적용한다.
   - 미리보기 탭의 대화 미리보기(`SummaryView`)와 `SelectedItemDetail`
   - 왼쪽 실행 트리(`ResultTimeline` → `ConversationTimelineItem`)
   - 실행 내역 화면(`/executions/:id`)의 노드·요소 목록과 상세 머리

   라이브와 영속(실행 내역) 양쪽이 **같은 절대 시각**을 보여야 한다.
4. **결측 허용**: `timestamp`·`durationMs` 는 선택 필드다. 없으면(옛 데이터, 아직 받지 않은 pending) 그 표기를 생략한다(`—` 또는 비표시). 시각이 없어도 배치가 깨지지 않는다.

데이터 모델(`startedAt`·`finishedAt` 함께 싣기)과 영속 정책은 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 이 정하고 그 근거도 그 문서의 "요소별 절대 발생 시각·소요 시간 노출" 항목에 있다.

## 구현 위치

- `codebase/frontend/src/lib/conversation/conversation-utils.ts` (`isAssistantContentBlank`, `groupToolCallItems`, 변환 함수)
- `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx`
- `codebase/frontend/src/components/editor/run-results/result-timeline.tsx`
- `codebase/frontend/src/components/editor/run-results/conversation-timeline-item.tsx`
- `codebase/frontend/src/components/editor/run-results/result-detail.tsx`
- `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx`

## Rationale

### 단일 턴 실패에는 `system_error` 를 붙이지 않는다 (2026-11-01)

AI 에이전트 단일 턴이 실패하면 대화 미리보기 목록에 `system_error` 줄을 붙이지 않는다. 실패는 오류 탭과 노드 결과의 `output.error` 로 보인다. 단일 턴의 LLM 호출 실패가 `error` 포트 출력으로 바뀌어(NERV Task `CLE-T-ZHBMAC`) 단일 턴 실패 출력에도 `output.error` 가 실리게 되면서 이 경우를 따로 정했다.

- **목록에 단일 턴 자신의 대화가 없다**: 미리보기의 대화 목록은 입력 대기 이벤트(`waiting_for_input`)의 스레드 스냅샷과 멀티턴 `execution.ai_message` 이벤트로만 채워진다. 단일 턴은 두 이벤트를 모두 내지 않는다. 그래서 단일 턴이 실패할 때 목록에 있는 대화는 앞선 노드의 것이다. 단일 턴 자신의 턴은 그 시점에 목록에 없어서 실패 줄이 들어갈 자리가 없다.
- **[다시 시도] 가 되돌릴 재시도 상태가 없다**: 단일 턴은 마지막 턴 재시도 상태(`_retryState`)를 만들지 않는다. 줄을 붙이면 [다시 시도] 를 눌러도 `RETRY_STATE_NOT_FOUND` 로 끝난다.
- **Inv-8 과의 관계**: [보존과 도달성을 나눈다 (Inv-8)](CLE-EXEC-PREVIEW.md#보존과-도달성을-나눈다-inv-8) 는 멀티턴 대화 안의 실패 줄을 retryable 과 상관없이 남기고 버튼만 비우는 결정이다. **기각: 단일 턴에도 `system_error` 줄은 두고 버튼만 숨기는 안.** 단일 턴은 대화 미리보기 목록을 스스로 채우지 않으므로 줄을 두면 목록에 있는 앞선 다른 노드의 대화 끝에 붙는다. 그 줄이 보여 줄 정보는 오류 탭과 노드 결과의 `output.error` 에 이미 있다.
- **내역 화면도 합성하지 않는다**: 내역 화면 재구성도 단일 턴 실패에는 `system_error` 를 합성하지 않는다. 단일 턴 실패 출력에는 `output.result.messages` 가 없어 대화형 출력으로 보지 않기 때문이다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md#system_error)).
- **알려진 한계**: 단일 턴은 LLM 호출 전에 백엔드 스레드에 `ai_user` 항목을 쌓는다. 실패하면 최종 `ai_assistant` 항목 없이 `ai_user` 항목이 남는다. 도구 기록(`includeToolTurns`)을 켰으면 실패 전 도구 반복의 assistant 항목과 도구 결과 항목도 남는다. 실행이 다른 노드의 입력 대기로 이어지면 그 스냅샷에 이 항목들이 에러 표시 없이 보일 수 있다. 노드가 취소된 단일 턴도 같은 항목이 남는다. 이 `ai_user` 잔존은 [대화 스레드 §미결 사항](../CLE-IX/CLE-IX-THREAD.md#미결-사항) 에 있다.

### `rag` 줄을 보조 관찰성 레인으로 둔다

그 턴에 지식 저장소 도구(`kb_*`) 호출이 가져온 청크를 대화 타임라인의 일급 이벤트(🔎 `rag` 줄)로 표시하고 같은 호출의 🔧 `ai_tool` 도구 행과 세 신호로 구분한다. 1차 소스는 `meta.turnDebug[].ragSources` 이고 "대화 턴 1차 소스는 스레드" 원칙(D4)을 유지한 채 보조 관찰성 레인으로 정식화한다. 처음 정의("엔진이 LLM 호출 전에 자동으로 한 검색")는 구현된 적이 없고 실행 중 검색은 지식 저장소 도구 경로뿐이라 2026-10-10 에 정의를 코드에 맞췄다. 자동 검색을 새로 만드는 안을 기각한 근거는 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 의 Rationale 에 있다.

- **기각: `ai_tool` 재사용.** `rag` 줄은 도구 호출 하나가 아니라 그 턴의 호출들이 가져온 청크를 모은 표시다. `ai_tool` 로 표현하면 (a) 맞출 `toolCallId` 가 없고 (b) 묶음 분류가 부모 assistant 의 `toolCalls.length` 로 자식을 순서대로 가져가는데 `rag` 는 그 개수에 없어 실제 도구 자식 하나가 밀려나며 (c) 한 턴에 `kb_*` 를 여러 번 불렀을 때 `chunkId` 중복을 뺀 턴 단위 청크 목록을 보일 자리가 없다. 이 목록은 참조 탭과 같아야 하고(Inv-9) 호출마다의 카드로는 보일 수 없다.
- **기각: `system` 과 구분 필드.** `system_error` 때 기각한 논리가 그대로 적용된다. 출처의 1:1 시각 매핑을 1:N 으로 나눠 매핑 표가 단순하지 않게 된다.
- **D4 와 충돌하지 않는 이유**: D4 가 막으려던 것은 출처 접두와 사용자 입력 마커가 든 emit 메시지 원문 노출이다. `ragSources` 는 마커도 접두도 없는 구조화 관찰 데이터(`documentName`, `score`, `content` 미리보기, [Graph RAG](../CLE-KB/CLE-KB-GRAPH.md))라 그 위험 요소가 구조적으로 없다. 또 `rag` 줄은 턴을 대신하지 않고 더해지는 별도 레인이다.
- **범위를 `ragSources` 로 좁힌 이유**: `meta.turnDebug` 전체를 열면 형제 필드 `llmCalls` 까지 열린다. `llmCalls` 는 원문 디버그 페이로드(에디터 전용)로 정해진 필드라 D4 가 막으려던 바로 그 대상이다. 전체를 열면 D4 보호가 다른 경로로 다시 들어온다.
- **새 예외가 아니라 기존 관행의 정식화**: `ragSources` 는 이미 대화 미리보기의 소스였다. 📚 참조 칩이 그 데이터로 assistant 말풍선 아래에 렌더되고 있었고 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 이 그 표면을 명시적으로 승인해 두었다. 두 문서가 서로를 가리키지 않아 어긋났으므로(2026-07-17) 양방향 링크를 함께 두었다.
- **소스로 `turnDebug` 를 고른 이유(옛 `### Relevant Knowledge` 마커 대신)**: 옛 프런트 인라인 파서는 `role:'system'` 메시지의 마커로 지식 저장소 줄을 합성했다. 그런데 그 마커를 만드는 `RagSearchService.buildContext` 는 운영 호출부가 없어 새 실행에서 생기지 않는다. `turnDebug` 는 참조·LLM 사용량 탭이 이미 쓰는 현행 데이터이고 라이브(입력 대기 이벤트의 `nodeOutput.meta`)와 내역(영속 `outputData.meta`) 양쪽에 있어 두 표면이 어긋나지 않는다. 그 인라인 파서는 변환 함수 계약에 없는 넷째 경로라 제거했다.
- **🔎 줄을 턴의 시작 시각에 두는 이유**: 🔎 줄은 그 턴의 `kb_*` 호출들이 가져온 청크를 턴 단위로 모은 표시라 검색 하나의 시각을 갖지 않는다. 그래서 턴의 기준 시각(첫 LLM 호출 시작)에 둔다. 호출마다의 시각은 🔧 `ai_tool` 줄이 가진다.
- **📚 칩을 함께 두는 이유**: 줄과 칩은 답하는 질문이 다르다. 🔎 줄은 "이 턴에 무엇을 가져왔나"(턴 단위 모음), 📚 칩은 "이 응답이 무엇에 근거했나"(출처 귀속)와 참조 탭 진입점이다. 칩을 없애면 응답과 출처의 연결과 진입점을 잃는다.
- **옛 데이터 한계**: `turnDebug` 가 없던 시절 실행에는 🔎 줄이 생기지 않는다. 결측 허용 규칙대로 생략한다(CT-S19). 옛 마커까지 덮는 이중 변환 경로는 단일 결정 함수 원칙에 어긋나 도입하지 않는다.
