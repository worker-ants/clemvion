---
id: "CLE-IX-TYPES"
title: "인터랙션 타입 레지스트리"
type: "convention"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-IX"
ancestors: ["CLE-VISION", "CLE-IX"]
area: "CLE-IX"
content_hash: "9aaced4d852138fcd21bfc1173a3b750d36202e28a126a7da408e80dd5368ceb"
read_as: "approved"
task: null
source_paths: ["spec/conventions/interaction-type-registry.md"]
mirror_sha256: "b4ea25d59a5cc0ca79a2d5b24ed19b2a615f953ed69b463827bec710bc4e2cd0"
etag: "sha256-08f7b143c5edb2a851cc6f475ed55e85ede94f35c2ea6ee346b149159a8a5fb6"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/interaction-type-registry.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

여러 계층(실행 엔진·에디터 프런트엔드·EIA·채팅 채널)이 함께 쓰는 인터랙션 값에는 공통 문제가 있다. 값 하나를 더하면 그 값을 가르는 위치 N곳을 동시에 고쳐야 하는데, 사람이 그중 일부를 빠뜨린다. 이 규약은 값 목록의 단일 기준과 처리 분기 위치 매트릭스를 한 곳에 두고, 명세와 테스트 양쪽에서 누락을 막는다.

다루는 값은 네 가지다.

| 값 | 뜻 | 값의 의미를 정하는 문서 |
|---|---|---|
| 대기 표면(`WaitingInteractionType`) | 입력 대기 노드가 무엇을 기다리는가(`form`·`buttons`·`ai_conversation`·`ai_form_render`) | [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) |
| 항목 출처(`ConversationTurnSource`) | 대화 기록 항목이 어디서 왔는가 | [대화 스레드](CLE-IX-THREAD.md) |
| 표시물 종류(`PresentationType`) | AI Agent `render_*` 표시 도구가 만드는 결과 종류 | [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) |
| AI 노드 종료 사유(`endReason`) | 멀티턴 AI 노드가 끝난 이유 | [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md), [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) |

대기 표면과 사용자 행동 기록(`interaction_data.interactionType`, 사용자가 실제로 한 `form_submitted`·`button_click`·`button_continue`)은 이름만 같은 별개 값이다. 사용자 행동 기록은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다.

## 규칙

1. 새 값은 이 문서의 매트릭스에 반드시 등록한다. 등록하지 않은 값을 코드에 넣으면 단위 테스트 `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 가 실패한다.
2. 매트릭스의 모든 위치를 한 PR 안에서 함께 고친다.
3. 값을 가르는 곳은 exhaustive switch(`switch (value) { case ...; default: const _exhaustive: never = value }`)로 쓴다. `codebase/frontend/src/lib/utils/exhaustive.ts` 의 `assertNever` 헬퍼를 쓴다. 그러면 TypeScript 컴파일러가 누락을 직접 실패로 만든다.
4. AST 가드(단위 테스트의 `REGISTRY_SITES`·`SOURCE_REGISTRY_SITES`)는 매트릭스의 모든 값이 등록된 스캔 대상 파일에 문자열 리터럴로 나오는지 검사한다. switch 가 아닌 if/else·플래그 파생 소비처를 잡는 보조 가드다.
5. AST 가드가 쓰는 값 목록(`ENUM_VALUES`·`SOURCE_ENUM_VALUES`)은 tsc 가 읽는 소스 모듈 `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 에 둔다. `satisfies`(목록 ⊆ 타입)와 `Exclude`(타입 ⊆ 목록)로 두 방향을 모두 잠근다. 테스트 파일은 `tsconfig.json` 의 `src/**/__tests__/**` 제외에 걸려 tsc 가 읽지 않으므로 그곳에 두지 않는다.
6. 대기 표면 값을 더하면 backend 와 frontend 의 기준 위치 두 곳을 동시에 바꾸고 매트릭스에 행을 더한다. 재개 턴 registry 와 park 진입 registry 도 함께 점검한다.
7. 새 blocking 노드 종류는 재개 턴 registry(`resumeTurnRegistry`)와 park 진입 registry(`buildParkEntryRegistry`)에 항목을 한 줄씩 등록해 끼운다.
8. 새 표시물 종류는 backend `PRESENTATION_TYPES` 한 줄 → `SCHEMA_BY_TYPE` 한 줄 → frontend `PresentationType` union → `AssistantPresentationsBlock` switch case 하나 순서로 더한다. exhaustive `default: never` 가 누락을 막는다.
9. AI 노드 종료 사유는 공유 패키지가 기준이다. 매트릭스와 AST 가드를 두지 않는다. 소비처는 패키지를 import 한다.

## 대기 표면

### 기준 위치

| 쪽 | 파일 | 정의 |
|---|---|---|
| Backend | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` | `type WaitingInteractionType = 'form' \| 'buttons' \| 'ai_conversation' \| 'ai_form_render'` |
| Frontend | `codebase/frontend/src/lib/stores/execution-store.ts` | `export type WaitingInteractionType = ...`(값과 순서가 같다) |

### 엔진 네 값과 외부 세 값

`WaitingInteractionType` 은 엔진 내부의 네 값이다. EIA HTTP 쪽은 `ai_form_render` 를 `ai_conversation` 에 합쳐 세 값(`form`·`buttons`·`ai_conversation`)만 내보낸다([EIA 알림 웹훅](CLE-EIA-NOTIFY.md), [웹채팅 구조](../CLE-WEBCHAT/CLE-WEBCHAT-ARCH.md)). 채팅 채널은 서버 안 소비자라 합치지 않고 네 값을 그대로 받는다([서버 안 소비자: 채팅 채널](#서버-안-소비자-채팅-채널)). 외부 경로(상태 조회·SSE·알림 웹훅)에서 실제로 어디서 합치는지와 `ai_form_render` 가 외부에서 어떻게 보이는지는 정의가 갈린다. [미결 사항](#미결-사항) 참조.

에디터 실행 화면처럼 내부 관점의 문서가 네 값을 모두 적지 않아도 외부 세 값과 모순이 아니다. 관점이 다를 뿐이다.

### 명령 허용 판정

재개 명령의 publisher 사전 검증(`waiting-surface-guard.ts` 의 `WaitingSurface` = `form`·`buttons`·`ai_conversation`)도 네 값을 세 값으로 합쳐 쓴다. `ai_form_render` 를 `ai_conversation` 으로 흡수해 대기 표면별 허용 명령 집합을 판정하고, 맞지 않으면 `INVALID_EXECUTION_STATE` 로 거부한다(EIA 에서는 `409 STATE_MISMATCH`). 검증 규칙은 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 가 정한다. `WaitingSurface`(세 값, 명령 허용 판정)는 `WaitingInteractionType`(네 값, 처리 분기)에서 파생한 보기일 뿐 별도 값 목록의 기준이 아니다.

### 처리 분기 매트릭스

| 값 | Backend 발행 위치(최초 입력 대기 진입) | Frontend 처리 분기(필수) |
|---|---|---|
| `form` | 엔진이 `'form'` 으로 발행(Form 노드 핸들러) | (a) `use-execution-events` 의 `handleExecutionResumed` (b) `handleWaitingForInput` 분기 (c) `apply-execution-snapshot.ts` 의 reconcile·대기 hydration·maybeSeed (d) `use-result-detail-waiting.ts` `deriveFlags` 의 `isWaitingForm`(에디터 drawer 와 실행 상세 페이지가 함께 위임) (e) `result-detail.tsx` formPreview |
| `buttons` | 엔진이 `'buttons'` 로 발행(버튼 있는 Presentation 노드, `ButtonInteractionService` 로 위임) | (a)~(d) 같음(`deriveFlags` 의 `isWaitingButtons`) + `pauseForButtons` |
| `ai_conversation` | AI Agent 핸들러 멀티턴 대기 → `AiTurnOrchestrator.emitAiWaitingForInput`(`interactionType` meta) | (a)~(d) 같음(`deriveFlags` 의 `isWaitingConversation`) + (e) 같음 + `pauseForConversation` + 대화 타임라인 hydration |
| `ai_form_render` | AI Agent 핸들러의 `render_form` blocking 진입 → `AiTurnOrchestrator.emitAiWaitingForInput` | (a)~(c) 같음 + `conversationConfig.pendingFormToolCall: { toolCallId, formConfig }` 함께 싣기 + `ai_conversation` 의 모든 hydration 경로 + (d) `deriveFlags` 의 `isWaitingConversation` 으로 흡수(별도 formPreview 가 아님, drawer·페이지 공용) + (e) `AssistantPresentationsBlock` case `"form"` 의 활성 분기(`payload.toolCallId === pendingFormToolCall.toolCallId` 면 interactive `DynamicFormUI`, 아니면 `FormSubmittedContent`) + (f) `resumeFromAiRenderForm`(`pendingFormToolCall` 만 중첩 null 로 바꾸고 나머지 조작 요소는 보존하는 별도 action). 활성 폼 표현의 기준은 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) |

가드가 덮는 범위:

- AST 가드의 `REGISTRY_SITES` 는 세 파일이다. `use-execution-events.ts`((a)·(b)), `apply-execution-snapshot.ts`((c)), `use-result-detail-waiting.ts`((d), 에디터 drawer 와 실행 상세 페이지가 공유하는 `deriveFlags` 파생 위치).
- (e) `result-detail.tsx` formPreview 와 `AssistantPresentationsBlock` 은 AST 가드 대신 TS exhaustive `default: never`(switch)로만 덮인다. 동작은 같고 가드 종류만 다르다.
- drawer 에 남은 `isLiveConversation`(`ai_conversation`·`ai_form_render` 두 값만 구분)은 exhaustive 분기와 달리 부분집합 소비처다(`||` 비교, switch·`assertNever` 아님). 두 가드 어느 쪽에도 걸리지 않고, 새 값은 여기서 자동으로 "실시간 아님" 으로 처리된다. `isLiveConversation` 이 일부러 "실시간 AI 턴" 두 값만 가르는 이진 판정이라 허용한다. 새 blocking AI 종류를 더할 때 함께 점검한다.
- switch 누락은 규칙 3 의 컴파일러 단계에서 따로 실패한다.

### 서버 안 소비자: 채팅 채널

채팅 채널 디스패처는 `ai_form_render` 를 `ai_conversation` 으로 합치지 않고 네 값을 그대로 어댑터에 넘긴다. 채팅 채널에서 `ai_form_render` 는 `ai_conversation` 의 하위 상태로 같은 경로를 탄다. 이벤트 타입과 렌더 규칙의 기준은 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 이다. 값별 분기 위치는 다음과 같다(현재 구현).

| 위치 | 하는 일 |
|---|---|
| `codebase/backend/src/modules/chat-channel/types.ts` | `waiting_for_input` 이벤트의 `interactionType` 을 네 값 union 으로 선언한다 |
| `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` | wire 의 `interactionType` 이 네 값 가운데 하나면 그대로 싣고, 아니면 이벤트를 버린다 |
| `providers/telegram/telegram-message.renderer.ts`, `providers/slack/slack-message.renderer.ts`, `providers/discord/discord-message.renderer.ts` | `ai_conversation`·`ai_form_render` 대기는 빈 배열로 조용히 넘기고 `form`·`buttons` 만 메시지로 바꾼다 |

이 위치들은 백엔드라 프런트엔드 AST 가드(`REGISTRY_SITES`)가 덮지 않는다. 새 대기 표면 값을 더할 때 함께 점검한다.

### 재개 턴 라우팅

위 발행 위치는 최초 입력 대기 진입 기준이다. park 뒤 재개할 때 `form`·`buttons`·`ai_conversation` 턴 라우팅은 `driveResumeAwaited`(최상위)와 `driveResumeFrame`(중첩) 양쪽에서 단일 진입점 `dispatchResumeTurn` 으로 모인다(순서 있는 `resumeTurnRegistry`, 먼저 맞는 항목 사용: form → buttons → ai_conversation, `resume-turn-dispatch.ts`). `ai_form_render` 는 별도 registry 항목 없이 `ai_conversation` AI 턴 경로(`isAiConversation`)를 함께 써서 재개된다. 프런트엔드 쪽 조작 요소 정리는 별도 `resumeFromAiRenderForm` 이 맡는다(매트릭스 `ai_form_render` 행 (f)). 재개 계약은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 가 정한다.

### 최초 park 진입 라우팅

최초 입력 대기 진입 분기는 `runExecution`(메인 루프)·`executeInline`(중첩 서브 워크플로우)·`runNodeDispatchLoop`(재시도·재개 드라이브) 세 곳에서 단일 진입점 `dispatchParkEntry` 로 모인다(순서 있는 `parkEntryRegistry`, 먼저 맞는 항목 사용: form → buttons → ai_conversation, `park-entry-dispatch.ts`). 재개 쪽 `dispatchResumeTurn` 과 대칭이다.

- `form` 은 핸들러 metadata(`getMetadata().interaction === 'form'`)로, `buttons`·AI 는 런타임에 캐시된 `meta.interactionType`(`getInteractionType`)으로 고른다.
- `ai_form_render` 는 별도 항목 없이 `ai_conversation` 항목이 함께 맞춰 `waitForAiConversation` 경로를 쓴다(재개 쪽 `isAiConversation` 정책과 같다).
- 세 위치는 선택 로직만 공유한다. `PARK_RELEASED` 뒤 제어 흐름은 위치마다 다르다(메인 루프는 그냥 `return`, 중첩은 `ParkReleaseSignal` throw, 드라이브는 `{ parked: true }`). 그래서 registry 는 `ProcessTurnResult` 만 돌려주고 빠져나가는 방식은 호출 쪽이 유지한다.

## 항목 출처

값 정의는 [대화 스레드](CLE-IX-THREAD.md) 가 기준이다. 프런트엔드 union 은 일곱 값(`presentation_user`·`ai_user`·`ai_assistant`·`ai_tool`·`system`·`system_error`·`rag`)이고, 백엔드 누적 값은 `system_error`·`rag` 를 뺀 다섯 값이다. 두 값은 프런트엔드가 합성한다(`system_error` 는 WS 에러 이벤트로, `rag` 는 `meta.turnDebug[].ragSources` 로). 아래 매트릭스는 프런트엔드 일곱 값 기준이다.

| 값 | UI 분기 위치 |
|---|---|
| `presentation_user` | `threadTurnsToConversationItems` 의 source switch · `ConversationTimelineItem` 의 🧩 카드 렌더 · [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 매핑표 |
| `ai_user` | 같은 함수 · 👤 사용자 말풍선 |
| `ai_assistant` | 같은 함수 · 🤖 어시스턴트 말풍선(표시물 부착 분기 포함) |
| `ai_tool` | 같은 함수 · 🔧 도구 행 |
| `system` | 같은 함수 · ℹ️ 시스템 메모(v1 은 자동 추가 없음, 분기만 미리 구현) |
| `system_error` | AST 가드 대상은 `threadTurnsToConversationItems` switch 한 곳(`codebase/frontend/src/lib/conversation/conversation-utils.ts`)뿐이다. 렌더 분기(TS exhaustive, AST 가드 대상 아님)는 왼쪽 타임라인 칩 `ConversationTimelineItem`(`conversation-timeline-item.tsx` 의 `item.type === "system_error"`, `result-timeline.tsx` 는 위임만)과 오른쪽 인스펙터 `SelectedItemDetail`·`SystemErrorRow`(`conversation-inspector.tsx`, `[다시 시도]` 버튼)다. 시각 규칙은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) |
| `rag` | AST 가드 대상은 `conversation-utils.ts` 다. `mergeRagRetrievalItems` 가 `meta.turnDebug[].ragSources` 에서 합성하고, `threadTurnsToConversationItems` 의 exhaustive switch 에도 `rag` case 가 있어야 한다. 렌더 분기(TS exhaustive)는 왼쪽 `ConversationTimelineItem`(`item.type === "rag"`)과 오른쪽 `SummaryView` 의 `RagRetrievalRow` 다. `SelectedItemDetail` 도 같은 `RagRetrievalRow` 를 다시 쓴다(행 자체가 문서명과 청크 수를 담고, 청크 본문은 References 탭이 기준이라 중복 정의를 피한다). 시각 규칙은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) |

- `threadTurnsToConversationItems` 의 switch 는 이미 `const _exhaustive: never = turn.source` 패턴이다. 값을 더하면 새 case 를 반드시 적는다.
- `rag` 도 `system_error` 처럼 switch case 가 있다. 둘 다 wire(`conversationThread.turns`, 백엔드 다섯 값)에 실려 오지 않지만 `ConversationTurnSource` union 의 값이라 exhaustive 패턴이 컴파일 때 case 를 강제한다. 실제로는 닿지 않는 방어 case 이고, 실제 `rag` 항목은 후처리 병합 `mergeRagRetrievalItems` 가 만든다. union 에서 빼면 그 함수의 반환 타입이 `ConversationItem['type']` 과 어긋나므로 union 에 두는 편이 맞다.
- WS 이벤트 `execution.user_message` 는 새 항목 출처 값을 더하지 않는다. 낙관적 사용자 말풍선은 기존 `ai_user` 분기를 그대로 쓴다. 이벤트의 store 변환은 프런트엔드 `use-execution-events` 의 핸들러가 맡고(store 의 `conversationMessages` 에 낙관적 `ai_user` 를 붙이고 `receivedAt` 으로 중복 제거), 변환 계약은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 가 정한다. 대기 표면에도 영향이 없다. `user_message` 는 진행 신호이고 입력 대기 진입과 관계없다.

## 표시물 종류

AI Agent 표시 도구(`render_*`)의 `PresentationType` 이다. 값은 다섯 개(`table`·`chart`·`carousel`·`template`·`form`)이고, 도구 정의는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 가 정한다.

| 쪽 | 파일 | 정의 |
|---|---|---|
| Backend | `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` | `PRESENTATION_TYPES` const tuple + 파생 `PresentationType` |
| Frontend | `codebase/frontend/src/lib/conversation/conversation-utils.ts` | `PresentationType`(값 같음) |

| 값 | Backend dispatch | Frontend 렌더 |
|---|---|---|
| `table` | `SCHEMA_BY_TYPE['table'] = tableNodeConfigSchema`(`render-tool-provider`) | `AssistantPresentationsBlock` 의 `TableContent` |
| `chart` | `SCHEMA_BY_TYPE['chart'] = chartConfigSchema` | `ChartContent` |
| `carousel` | `SCHEMA_BY_TYPE['carousel'] = carouselNodeConfigSchema` | `CarouselContent` |
| `template` | `SCHEMA_BY_TYPE['template'] = templateNodeConfigSchema` | `TemplateContent` |
| `form` | `SCHEMA_BY_TYPE['form'] = formNodeConfigSchema` | `AssistantPresentationsBlock` case `"form"`. 활성 분기(`payload.toolCallId === pendingFormToolCall.toolCallId`)면 interactive `DynamicFormUI`, 아니면 `FormSubmittedContent`(표시 전용). 어시스턴트 턴 타임라인 인라인 표현의 기준은 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) |

## AI 노드 종료 사유

`endReason` 도 위 세 값과 같은 문제 계열이다. 백엔드가 선언하고 프런트엔드가 소비하는 여러 계층 공용 값이고, 실제로 `error`·`condition` 누락으로 대화 미리보기 탭이 사라지는 회귀가 두 번 났다. 그러나 해법이 다르다. 위 세 값은 "매트릭스 + AST 가드 + exhaustive switch" 로 사본을 감시하고, `endReason` 은 사본 자체를 없앴다.

| 항목 | 내용 |
|---|---|
| 기준 | 공유 패키지 `@workflow/ai-end-reason`(`codebase/packages/ai-end-reason/`). `AiAgentEndReason`·`InformationExtractorEndReason`·파생 `ConversationEndReason` + 런타임 배열 `CONVERSATION_END_REASONS` |
| 강제 방식 | 패키지 안의 `satisfies`(배열 ⊆ union)와 `Exclude`(union ⊆ 배열). 어느 노드 union 에 값이 늘면 패키지 컴파일이 깨진다 |
| 매트릭스 | 필요 없다. 소비처가 패키지를 import 하므로 "N곳에 흩어진 분기" 가 없다 |
| AST 가드 | 필요 없다. 스캔할 사본이 없다 |

두 union 을 합치지 않는다. 정보 추출기 노드에는 `condition` 라우팅이 없고 대신 `completed`·`max_retries` 가 있다. 합치면 노드마다의 종료 의미가 흐려지므로 각자 union 을 두고 소비자용 파생 union 만 만든다.

값의 의미와 포트 대응은 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)·[정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md), 출력 구조는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다. 패키지에는 값 영역만 있다.

## 미결 사항

- **`ai_form_render` 가 외부 경로에서 어떻게 보이는가**: 원문은 네 값 → 세 값 합침을 채팅 채널 디스패처와 EIA 응답 DTO(`execution-status-response.dto.ts`) 계층의 책임이라 적었다. 채팅 채널 쪽은 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 과 현재 구현에 맞춰 네 값을 받는 서버 안 소비자로 바로잡았다([서버 안 소비자: 채팅 채널](#서버-안-소비자-채팅-채널)). 외부 경로는 계약과 구현이 어긋난다. [EIA 알림 웹훅](CLE-EIA-NOTIFY.md) 과 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 는 외부 `interactionType` 을 세 값으로 적는다. 현재 구현은 경로마다 다르다(코드 확인). (1) 상태 조회(`interaction.service.ts` 의 `getStatus`)는 `ai_form_render` 를 `ai_conversation` 으로 합치지 않고 `null` 로 바꿔 `currentNode.interactionType` 과 `context` 가 `null` 이 된다. (2) SSE 어댑터(`sse-adapter.service.ts`)와 알림 발송(`notification-fanout.service.ts` 가 `event.payload` 를 그대로 싣는다)은 단일 싱크의 payload 를 바꾸지 않으므로 `interactionType: 'ai_form_render'` 가 그대로 나간다. `external-interaction` 모듈 안에 네 값을 세 값으로 합치는 코드는 없다. 외부 경로마다 `ai_form_render` 를 `ai_conversation` 으로 합칠지, 네 값을 외부 계약으로 올릴지 결정 필요.

## 구현 위치

- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` (AST 가드)
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` (가드 값 목록, 양방향 잠금)
- `codebase/frontend/src/lib/conversation/conversation-utils.ts` (`ConversationTurnSource`·`PresentationType`·`threadTurnsToConversationItems`·`mergeRagRetrievalItems`)
- `codebase/frontend/src/lib/utils/exhaustive.ts` (`assertNever`)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`WaitingInteractionType`)
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`, `button-interaction.service.ts`
- `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts`, `park-entry-dispatch.ts`, `waiting-surface-guard.ts`
- `codebase/backend/src/modules/chat-channel/types.ts`, `chat-channel.dispatcher.ts`, `providers/*/*-message.renderer.ts` (채팅 채널의 네 값 소비)
- `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` (`PRESENTATION_TYPES`)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` (`SCHEMA_BY_TYPE`)
- `codebase/packages/ai-end-reason/` (`endReason` 기준)

## Rationale

### 세 겹 가드를 둔다

표시 도구 계열을 들이는 동안 연달아 난 회귀(SchemaForm 키 중복과 buildTools 가드, 실행 내역 렌더, 다국어, 시스템 프롬프트, 페이지 복귀)는 모두 같은 모양이었다. 값 하나를 더했는데 처리 분기 위치 N곳 중 일부를 빠뜨린 것이다. 사람의 작업 기억으로는 5~7곳의 분기를 늘 동시에 다루기 어렵다. 그래서 세 겹으로 막는다.

1. 명세의 매트릭스가 기준이다. 모든 분기 위치를 한 표에 모은다.
2. AST 가드가 매트릭스와 코드 AST 파싱 결과를 단위 테스트에서 비교해 실패로 만든다.
3. TypeScript exhaustive switch 가 컴파일 단계에서 누락을 실패로 만든다.

### 가드 값 목록을 소스 모듈로 옮겼다

예전 문구는 이 세 겹이 회귀를 "영구히 차단한다" 고 했으나 과장이었다(2026-07-17 실측). 세 번째 겹은 제대로 동작했다. `threadTurnsToConversationItems` 의 `const _exhaustive: never = turn.source` 가 실제로 `rag` 추가를 컴파일 단계에서 막았다. 그러나 두 번째 겹의 전제가 무너져 있었다.

- AST 가드는 목록(`ENUM_VALUES`·`SOURCE_ENUM_VALUES`)의 각 값이 각 위치에 나오는지 본다. 그 목록이 타입과 같다는 전제에서만 의미가 있다.
- 그 전제를 지키려던 `const _typecheck: ReadonlyArray<T> = VALUES` 는 "목록 ⊆ 타입" 만 검사해 타입에 값이 늘어도 통과했다. 게다가 그 단언이 있던 파일이 테스트 파일이라 `tsconfig.json` 의 `src/**/__tests__/**` 제외에 걸려 tsc 가 아예 읽지 않았다. 명백한 타입 에러를 넣어도 보고가 0건이었다. 그 축은 사실상 없었다.

그래서 목록을 tsc 가 읽는 소스 모듈로 옮기고 `satisfies` 와 `Exclude` 로 두 방향을 모두 잠갔다(규칙 5). 두 방향 모두 일부러 깨뜨려 실패로 바뀌는 것을 확인했다. 가드는 일부러 깨뜨려 본 뒤에야 믿을 수 있으므로, 이 문서가 보증을 적을 때는 그 보증을 실측했는지 함께 적는다.

### `endReason` 은 이 문서에 적되 매트릭스에 넣지 않는다

이 문서는 "여러 계층 공용 값 누락" 문제를 다루는 입구다. `endReason` 이 다른 메커니즘(사본 제거)을 쓴다는 사실이 여기 없으면, 다음 사람이 같은 문제를 만났을 때 매트릭스에 `endReason` 이 없는 것을 누락으로 오해하거나 중복 가드를 만든다. 사본을 없앨 수 있으면 감시보다 그쪽이 낫다.
