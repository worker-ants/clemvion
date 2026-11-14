---
id: "CLE-EXEC-PREVIEW"
title: "대화 미리보기"
type: "feature"
version: 4
status: "approved"
requirements: ["REQ-CONVPV-001", "REQ-CONVPV-002", "REQ-CONVPV-003", "REQ-CONVPV-004", "REQ-CONVPV-005", "REQ-CONVPV-006", "REQ-CONVPV-007", "REQ-CONVPV-008", "REQ-CONVPV-009", "REQ-CONVPV-010", "REQ-CONVPV-011", "REQ-CONVPV-012", "REQ-CONVPV-013", "REQ-CONVPV-014", "REQ-CONVPV-015", "REQ-CONVPV-016", "REQ-CONVPV-017", "REQ-CONVPV-018", "REQ-CONVPV-019", "REQ-CONVPV-020", "REQ-CONVPV-021", "REQ-CONVPV-022", "REQ-CONVPV-023", "REQ-CONVPV-024", "REQ-CONVPV-025", "REQ-CONVPV-026", "REQ-CONVPV-027", "REQ-CONVPV-028", "REQ-CONVPV-029", "REQ-CONVPV-030", "REQ-CONVPV-031", "REQ-CONVPV-032", "REQ-CONVPV-033", "REQ-CONVPV-034", "REQ-CONVPV-035", "REQ-CONVPV-036", "REQ-CONVPV-037", "REQ-CONVPV-038", "REQ-CONVPV-039", "REQ-CONVPV-040", "REQ-CONVPV-041", "REQ-CONVPV-042", "REQ-CONVPV-043", "REQ-CONVPV-044", "REQ-CONVPV-045", "REQ-CONVPV-046", "REQ-CONVPV-047"]
basis_superseded: false
parent: "CLE-EXEC"
ancestors: ["CLE-VISION", "CLE-EXEC"]
area: "CLE-EXEC"
content_hash: "adb39f27a7d1d4e19e5a3f8a60350d5b0b757c8a7e4788be26e3fb6a982499b2"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/conventions/conversation-thread.md"]
mirror_sha256: "81444ae84fe713b3cf3677fd7d2d0dccf76d147ba1d57316092a80ec5941f1bb"
etag: "sha256-ac449f68f3d9b2d0389921886fed741ba437af033f535fc56926b2e6b0388111"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/conversation-thread.md` (§9 미리보기 UI 렌더 규칙, 줄 433–756. 근거는 §8.1·§8.2·§8.3·§8.5·§8.6) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

대화 미리보기(Conversation Preview)는 실행 결과의 미리보기 탭 안에서 대화 스레드(`ConversationThread`)를 항목 출처별 모양으로 그리는 화면이다. 이 문서는 대화 미리보기와 실행 트리의 대화 타임라인이 지켜야 하는 렌더 규칙을 정한다. 두 축으로 나뉜다.

- **시각 매핑**: 항목 출처(`ConversationTurnSource`)마다 어떤 모양으로 그리는지, 무엇으로 서로 구분하는지, 어떤 데이터를 1차 소스로 쓰는지.
- **UI 계약**: 실시간 이벤트가 프런트 store 를 어떻게 바꾸는지, 실행 단계별 store 초기화, 빈 content 판정, UI 불변량(Inv-1~Inv-9), 회귀 차단 시나리오(CT-S1~CT-S21), 변환 함수 계약, 요소별 시각 표시.

대상 화면은 에디터와 콘솔의 디버깅 화면이다. 실행 결과 드로어의 미리보기 탭과 실행 트리, 실행 내역 화면의 실행 상세가 여기에 들어간다. 탭 가시성과 기본 탭 고르기는 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 이 정한다.

범위 밖:

- 대화 스레드 자료구조, 대화 기록 항목(`ConversationTurn`)의 필드, 항목 출처 값의 정의, 자동 누적 규칙, 영속화, AI 노드 주입은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 가 정한다.
- 실시간 이벤트의 필드 계약은 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md), 출처 값이 여러 계층에서 갈리는 위치는 [인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md) 가 정한다.
- 노드 출력 필드가 실시간·대기·내역 화면에서 복원되는 경로 목록은 [실행 화면 복원 규약](CLE-EXEC-HYDRATION.md) 이 정한다.
- 임베드 웹채팅 위젯의 말풍선 렌더는 [웹채팅 위젯](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) 이 정한다. 이 문서는 위젯이 따라야 하는 최소 규칙만 적는다.

## 요구사항

- REQ-CONVPV-001 WHEN 대화 미리보기가 대화 기록 항목을 그리면 THE SYSTEM SHALL 항목 출처마다 정해진 시각 형식 하나로 렌더한다. (원본: CT §9.1)
- REQ-CONVPV-002 IF `ai_assistant` 항목에 도구 호출이 하나 이상 있고 본문이 비어 있으면 THE SYSTEM SHALL 그 항목을 말풍선이 아니라 도구 호출 묶음의 부모 칩으로 렌더한다. (원본: CT §9.1, §9.6)
- REQ-CONVPV-003 WHEN `ai_assistant` 항목에 `presentations[]` 가 있으면 THE SYSTEM SHALL 말풍선 안에 캐러셀·차트·테이블·템플릿·폼을 인라인으로 렌더한다. (원본: CT §9.1)
- REQ-CONVPV-004 IF `type: 'form'` 페이로드가 `pendingFormToolCall.toolCallId` 와 맞으면 THE SYSTEM SHALL 인터랙티브 `DynamicFormUI` 를 렌더한다. (원본: CT §9.1)
- REQ-CONVPV-005 IF `type: 'form'` 페이로드가 활성 폼과 맞지 않으면 THE SYSTEM SHALL `FormSubmittedContent` 로 렌더한다. (원본: CT §9.1)
- REQ-CONVPV-006 WHEN `presentation_user` 항목을 그리면 THE SYSTEM SHALL `text` 의 동사 접두(`clicked:`, `continued:`)를 머리 라벨로 옮기고 본문에 다시 표시하지 않는다. (원본: CT §9.1)
- REQ-CONVPV-007 IF `system_error` 항목의 `data.retryable` 이 true 면 THE SYSTEM SHALL 오른쪽 액션 영역에 [다시 시도] 버튼과 `data.retryAfterSec` 카운트다운을 표시한다. (원본: CT §9.1)
- REQ-CONVPV-008 IF `system_error` 항목의 `data.retryable` 이 false 면 THE SYSTEM SHALL 액션 영역을 비워 둔다. (원본: CT §9.1)
- REQ-CONVPV-009 WHEN `rag` 항목을 그리면 THE SYSTEM SHALL 점선 테두리 전체 폭 줄에 `KB · <N> chunk(s)` 칩과 중복을 뺀 문서 이름 목록을 표시한다. (원본: CT §9.1)
- REQ-CONVPV-010 WHEN 사용자가 `rag` 줄을 누르면 THE SYSTEM SHALL 참조 탭의 해당 턴 그룹으로 이동한다. (원본: CT §9.1)
- REQ-CONVPV-011 WHEN 대화 미리보기가 항목을 그리면 THE SYSTEM SHALL 아이콘·컨테이너 형식·출처 칩 세 신호를 동시에 적용해 출처를 구분한다. (원본: CT §9.2)
- REQ-CONVPV-012 WHEN 대화 미리보기 탭이 대화 턴을 그리면 THE SYSTEM SHALL `conversationThread.turns` 스냅샷을 1차 소스로 쓴다. (원본: CT §9.3)
- REQ-CONVPV-013 WHEN LLM 사용량·요청·응답 탭이 데이터를 그리면 THE SYSTEM SHALL `ai_message.messages[]` 를 소스로 쓴다. (원본: CT §9.3)
- REQ-CONVPV-014 WHEN `rag` 줄과 📚 참조 칩을 그리면 THE SYSTEM SHALL `meta.turnDebug[].ragSources` 만 읽고 형제 필드 `llmCalls` 는 대화 미리보기에 쓰지 않는다. (원본: CT §9.3)
- REQ-CONVPV-015 WHEN 실행 상세 화면이 끝난 대화를 복원하면 THE SYSTEM SHALL `output.result.messages` 와 `output.interaction` 을 합쳐 스레드 스냅샷과 같은 모양을 다시 만든다. (원본: CT §9.3)
- REQ-CONVPV-016 IF store 에 오류로 끝난 노드의 `system_error` 가 있으면 THE SYSTEM SHALL store 를 우선하고 없으면 영속된 노드 출력으로 복원한다. (원본: CT §9.3)
- REQ-CONVPV-017 WHEN 대화 미리보기나 대화 타임라인이 메시지를 표시하면 THE SYSTEM SHALL `ai_message.messages[]` 의 `content` 원문을 그대로 노출하지 않는다. (원본: CT §9.4)
- REQ-CONVPV-018 IF 디버그 패널이 원문을 보여 줘야 하면 THE SYSTEM SHALL "Raw payload" 토글을 켰을 때만 원문을 노출한다. (원본: CT §9.4)
- REQ-CONVPV-019 WHEN 미리보기 렌더러가 텍스트를 표시하면 THE SYSTEM SHALL `[user-input]`·`[/user-input]` 마커를 지우고 안쪽 내용은 남긴다. (원본: CT §9.5)
- REQ-CONVPV-020 WHEN `ai_assistant` 항목이 도구 호출 묶음 부모로 분류되면 THE SYSTEM SHALL 뒤따르는 아직 묶이지 않은 도구 항목을 `toolCalls.length` 개까지 자식으로 묶는다. (원본: CT §9.6)
- REQ-CONVPV-021 IF 항목 출처가 `system_error` 나 `rag` 면 THE SYSTEM SHALL 그 항목을 도구 호출 묶음에 넣지 않고 제자리에 따로 표시한다. (원본: CT §9.6)
- REQ-CONVPV-022 WHEN 대화 미리보기와 실행 트리가 같은 항목을 받으면 THE SYSTEM SHALL `groupToolCallItems` 한 함수의 결과로 같은 묶음 구성·자식 수를 표시한다. (원본: Inv-5)
- REQ-CONVPV-023 WHEN `execution.tool_call_started` 를 받으면 THE SYSTEM SHALL `toolCallId` 로 도구 항목을 pending 상태로 추가하거나 갱신한다. (원본: CT §9.7)
- REQ-CONVPV-024 WHEN `execution.tool_call_completed` 를 받으면 THE SYSTEM SHALL `toolCallId` 로 항목의 상태·결과·소요 시간·에러를 갱신한다. (원본: CT §9.7)
- REQ-CONVPV-025 WHEN `execution.user_message` 를 받으면 THE SYSTEM SHALL 같은 발화의 말풍선이 이미 있으면 권위 `receivedAt` 만 찍고 없을 때만 `ai_user` 항목을 붙인다. (원본: CT §9.7)
- REQ-CONVPV-026 WHEN `execution.ai_message` 를 받으면 THE SYSTEM SHALL 항목을 `messages` 스냅샷으로 교체하면서 같은 `toolCallId` 항목의 `toolStatus`·`durationMs`·`error` 를 이어받는다. (원본: CT §9.7)
- REQ-CONVPV-027 WHEN `interactionType` 이 `ai_conversation` 인 입력 대기 이벤트를 받으면 THE SYSTEM SHALL 스레드 스냅샷으로 교체하고 스냅샷에 없는 도구·중간 assistant 항목을 합친다. (원본: CT §9.7)
- REQ-CONVPV-028 IF 이미 적용한 `nextSeq` 의 스냅샷이 다시 오면 THE SYSTEM SHALL 그 스냅샷을 적용하지 않는다. (원본: CT §9.7)
- REQ-CONVPV-029 WHEN `interactionType` 이 `ai_form_render` 인 입력 대기 이벤트를 받으면 THE SYSTEM SHALL `ai_conversation` 과 같이 적용하고 `pendingFormToolCall` 을 store 에 저장한다. (원본: CT §9.7)
- REQ-CONVPV-030 WHEN 멀티턴 AI 에이전트 노드가 `node.failed` 로 끝나거나 `port: 'error'` 와 `output.error` 를 실은 `node.completed` 가 오면 THE SYSTEM SHALL `payload.output.output.error` 로 `system_error` 항목을 만들어 대화 끝에 붙인다. (원본: CT §9.7)
- REQ-CONVPV-031 WHEN 새 실행이 시작되면 THE SYSTEM SHALL 입력 대기 UI 상태와 대화 스냅샷을 모두 초기화한다. (원본: CT §9.7.1)
- REQ-CONVPV-032 WHEN 실행이 정상 종료되거나 실패하면 THE SYSTEM SHALL 입력 대기 UI 상태만 초기화하고 대화 스냅샷은 보존한다. (원본: CT §9.7.1, Inv-6)
- REQ-CONVPV-033 WHEN `render_form` 활성 폼이 제출되면 THE SYSTEM SHALL `pendingFormToolCall` 만 비우고 나머지 멀티턴 대기 상태를 보존한다. (원본: Inv-7)
- REQ-CONVPV-034 WHEN 대화 UI 가 assistant content 가 비었는지 판정하면 THE SYSTEM SHALL `null`·`undefined`·빈 문자열·공백만 있는 문자열을 모두 빈 값으로 본다. (원본: CT §9.8)
- REQ-CONVPV-035 WHEN 도구 행 상태가 pending·success·error 로 바뀌면 THE SYSTEM SHALL 행 배치를 유지하고 상태 배지만 바꾼다. (원본: Inv-1)
- REQ-CONVPV-036 IF 도구 행이 부모 묶음에 합쳐지는 경우가 아니면 THE SYSTEM SHALL 한 번 표시한 도구 행을 없애지 않는다. (원본: Inv-2)
- REQ-CONVPV-037 WHILE 스레드 스냅샷이 도구 항목을 뺀 lean 형태인 동안 THE SYSTEM SHALL store 의 라이브 도구 행을 보존한다. (원본: Inv-4)
- REQ-CONVPV-038 IF 대화형 노드가 오류로 끝났으면 THE SYSTEM SHALL `result.status` 와 상관없이 그 대화를 대화 미리보기에서 볼 수 있게 한다. (원본: Inv-8)
- REQ-CONVPV-039 WHEN `rag` 줄·📚 칩·참조 탭이 같은 `turnIndex` 를 표시하면 THE SYSTEM SHALL 같은 `sources[]` 를 보여 준다. (원본: Inv-9)
- REQ-CONVPV-040 WHEN 대화 타임라인 관련 코드를 고치는 PR 이 올라오면 THE SYSTEM SHALL 회귀 차단 시나리오 CT-S1~CT-S21 의 단위 테스트 통과를 요구한다. (원본: CT §9.10)
- REQ-CONVPV-041 WHEN 새 변환 경로를 도입하면 THE SYSTEM SHALL 변환 함수 계약 표를 갱신하고 등가성 정의를 만족하는지 검토한다. (원본: CT §9.11)
- REQ-CONVPV-042 WHEN 디버깅 화면이 멀티턴 대화 항목을 표시하면 THE SYSTEM SHALL 항목마다 절대 발생 시각을 표시하고 assistant·tool 항목에는 소요 시간도 표시한다. (원본: CT §9.12)
- REQ-CONVPV-043 IF 항목에 발생 시각이나 소요 시간이 없으면 THE SYSTEM SHALL 그 표기를 생략하고 배치를 깨지 않는다. (원본: CT §9.12)
- REQ-CONVPV-044 WHEN 라이브 화면과 실행 내역 화면이 같은 항목을 표시하면 THE SYSTEM SHALL 같은 절대 시각을 보여 준다. (원본: CT §9.12)
- REQ-CONVPV-045 WHEN 임베드 웹채팅 위젯이 대화를 그리면 THE SYSTEM SHALL 출처를 user·assistant 두 말풍선으로 줄여 렌더한다. (원본: CT §9 스코프 예외)
- REQ-CONVPV-046 WHEN 임베드 웹채팅 위젯이 대화를 그리면 THE SYSTEM SHALL 1차 소스 선택·원문 노출 금지·마커 제거 규칙은 그대로 지킨다. (원본: CT §9 스코프 예외)
- REQ-CONVPV-047 IF `system_error` 항목에 `nodeExecutionId` 가 없으면 THE SYSTEM SHALL `data.retryable` 과 상관없이 [다시 시도] 버튼을 숨긴다. (원본: CT §1.2.1, §9.3)

## 적용 범위

이 문서의 규칙은 에디터와 콘솔의 **디버깅 화면**에 강제된다.

- 실행 결과 드로어의 미리보기 탭 안 대화 미리보기(`SummaryView`)와 선택 항목 상세(`SelectedItemDetail`)
- 실행 결과 드로어 왼쪽 실행 트리의 대화 항목(`ResultTimeline`, `ConversationTimelineItem`)
- 실행 내역 화면의 실행 상세(`/executions/:id`)

**임베드 웹채팅 위젯은 예외다.** 위젯은 호스트 페이지 안 좁은 패널에서 최종 사용자에게 보인다. 그래서 [출처별 시각 매핑](CLE-EXEC-PREVIEW-RENDER.md#출처별-시각-매핑) 과 [세 가지 구분 신호](CLE-EXEC-PREVIEW-RENDER.md#세-가지-구분-신호) 를 따르지 않고 user·assistant 두 말풍선으로 줄여 렌더한다. 항목 출처를 어느 말풍선으로 보내는지는 [웹채팅 위젯 §패널](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md#패널) 이 정한다.

출처별 시각 매핑 표는 일곱 행이지만 `system_error` 와 `rag` 는 프런트가 합성하는 출처라 위젯이 받는 데이터에 오지 않는다. `rag` 는 위젯 코드가 `mergeRagRetrievalItems` 를 부르지 않는다는 코드 분리에도 기댄다. 위젯이 받는 값은 백엔드 enum 다섯 값뿐이다. 다만 [데이터 소스](CLE-EXEC-PREVIEW-RENDER.md#데이터-소스) 의 1차 소스(`conversationThread.turns`), [원문 노출 금지와 마커 제거](CLE-EXEC-PREVIEW-RENDER.md#원문-노출-금지와-마커-제거) 규칙은 위젯에도 그대로 강제된다.

## 하위 문서

- [대화 미리보기 — 시각 매핑과 데이터 소스](CLE-EXEC-PREVIEW-RENDER.md): 출처별 시각 매핑, [다시 시도] 버튼 조건, 세 가지 구분 신호, 데이터 소스, 원문 노출 금지와 마커 제거, 도구 호출 묶음, 빈 content 판정, 요소별 시각과 소요 시간. 다루는 요구사항: REQ-CONVPV-001~022, REQ-CONVPV-034, REQ-CONVPV-042~044, REQ-CONVPV-047.
- [대화 미리보기 — store 변환과 변환 함수](CLE-EXEC-PREVIEW-STORE.md): 한 턴이 표시되는 흐름, 이벤트별 store 변환, store 초기화 정책, 변환 함수 계약. 다루는 요구사항: REQ-CONVPV-023~033, REQ-CONVPV-041. Inv-4(REQ-CONVPV-037)를 지키는 MERGE 규칙도 이 문서에 있다.
- [대화 미리보기 — 회귀 차단 시나리오](CLE-EXEC-PREVIEW-TESTS.md): 회귀 차단 시나리오 CT-S1~CT-S21, fixture 위치, 충족 테스트 매핑. 다루는 요구사항: REQ-CONVPV-040.

요구사항 줄(REQ-CONVPV-001~047)은 모두 이 문서의 요구사항 절에 있다. 위 목록의 "다루는 요구사항" 은 그 요구사항의 본문 규칙이 어느 하위 문서에 있는지를 가리킨다. 적용 범위(REQ-CONVPV-045~046)와 UI 불변량(REQ-CONVPV-035~039)은 세 하위 문서에 함께 걸치는 규칙이라 본문도 이 문서에 둔다.

## 옮긴 절

예전 앵커로 들어오는 링크를 위해 남긴 안내다.

### [다시 시도] 버튼 조건

→ [대화 미리보기 — 시각 매핑과 데이터 소스](CLE-EXEC-PREVIEW-RENDER.md#다시-시도-버튼-조건)

### 데이터 소스

→ [대화 미리보기 — 시각 매핑과 데이터 소스](CLE-EXEC-PREVIEW-RENDER.md#데이터-소스)

## UI 불변량

다음 아홉 불변량은 이 문서와 하위 문서의 규칙, 구현, store 단계 정책을 바꿀 때 반드시 지킨다. `Inv-N` 라벨은 이 문서와 하위 문서에서만 쓴다.

| ID | 불변량 |
| --- | --- |
| Inv-1 | 도구 행 모양(🔧, 이름, 상태 배지, 결과 미리보기)은 단계(pending, success, error)와 상관없이 같은 배치를 유지한다. 상태만 바뀐다 |
| Inv-2 | 타임라인 항목 수는 *묶음 단위*로만 줄어든다. 부모-자식 묶기는 허용한다. 한 번 표시한 도구 행은 부모 묶음에 합쳐지는 경우 말고는 사라지지 않는다 |
| Inv-3 | `SummaryView` 와 `SelectedItemDetail` 의 "Tool Call"·"AI Response" 라벨 판정은 같은 `isAssistantContentBlank` 에서 나온다 |
| Inv-4 | 스레드 스냅샷이 lean(`includeToolTurns: false`)이어도 라이브 도구 행은 store 에 보존한다. [이벤트별 store 변환](CLE-EXEC-PREVIEW-STORE.md#이벤트별-store-변환) 의 MERGE 가 맡는다 |
| Inv-5 | 도구 호출 묶음 분류와 순서 매칭 결과는 단일 결정 함수 `groupToolCallItems` 에서 나온다. 대화 미리보기(`SummaryView`)와 실행 트리(`ResultTimeline`)가 같은 결과를 쓴다. 행 모양 차이(칩과 한 줄)는 허용하지만 묶음 구성·자식 수·매칭 결과는 같다 |
| Inv-6 | 노드 실패나 실행 실패 때 store `conversationMessages` 를 비우지 않는다. 대화 스냅샷을 비우는 것은 `startExecution` 뿐이다([store 초기화 정책](CLE-EXEC-PREVIEW-STORE.md#store-초기화-정책)). `system_error` 항목은 스레드 끝에 APPEND 하고 기존 user·assistant·tool 항목은 바꾸지 않는다(불변) |
| Inv-7 | AI 에이전트 `render_form` 활성 폼을 제출한 직후 store 의 멀티턴 맥락(`waitingNodeId`, `waitingInteractionType: 'ai_form_render'`, `pendingFormToolCall` 을 뺀 `waitingConversationConfig`, `isWaitingAiResponse: true`)을 보존한다. `pendingFormToolCall` 만 null 로 비운다. `resumeFromAiRenderForm` 의 중첩 patch 가 맡는다. 기준은 [store 초기화 정책](CLE-EXEC-PREVIEW-STORE.md#store-초기화-정책) 표의 `resumeFromAiRenderForm` 행이다 |
| Inv-8 | **렌더 층 도달성**: 오류로 끝난(`output.error` 가 있어 `system_error` 가 붙은) 대화형 노드의 대화는 **`result.status` 로 막지 않고** 대화 미리보기로 볼 수 있어야 한다. Inv-6 은 store 의 **보존**을 보장하고 이 불변량은 그 보존분과 `outputData` 로 영속된 같은 대화의 **도달성**을 보장한다. 둘은 별개다. 보존만으로는 "왜 대화가 사라졌지?" 증상을 막지 못한다. 데이터 소스는 [데이터 소스](CLE-EXEC-PREVIEW-RENDER.md#데이터-소스), 탭 가시성·기본 탭 규칙은 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 이 정한다. 회귀 차단: CT-S15~CT-S17 |
| Inv-9 | **RAG 표시 정합성**: 같은 `meta.turnDebug[].ragSources` 를 쓰는 표면(🔎 `rag` 줄, 📚 참조 칩, 참조 탭)은 **같은 `turnIndex` 에 같은 `sources[]`** 를 보여야 한다. 어긋나면 사용자가 "참조 탭에는 청크가 있는데 미리보기 줄에는 없다" 같은 모순을 본다. 같은 소스 함수를 다시 써서(`turnRefIndex` 파생) 보장하고 별도 매칭 로직을 만들지 않는다. 회귀 차단: CT-S18 |

**취소된 대화 노드는 Inv-8 대상이 아니다.** `handleNodeCancelled` 는 `conversationMessages` 를 건드리지 않고 `execution.node.cancelled` 는 `node.failed` 와 다른 이벤트다. 취소는 오류가 아니므로 `system_error` 가 없는 것이 정상이다. 그 결과 취소된 대화 노드에는 귀속 신호가 없어 Inv-8 판정에 들지 않는다. "진행 중 대화를 중지하면 대화가 안 보인다" 는 증상은 별도 귀속 방식이 필요하고 아직 다루지 않았다.

**여러 노드가 섞인 스레드는 의도한 동작이다.** 대화 미리보기는 노드별로 거르지 않고 스레드 전체를 그린다. 스레드가 실행 범위로 노드 사이에 이어지고 1차 소스가 스레드 스냅샷 전체이며 single-turn AI 에이전트도 스레드에 항목을 쌓기 때문이다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)). Presentation 노드의 `presentation_user` 항목이 AI 노드 미리보기에 함께 보이는 것도 같은 설계다. 노드 필터가 없는 것은 누락이 아니라 의도다.

**🔎 `rag` 줄은 선택한 노드의 턴에만 붙는다.** 스레드는 실행 범위로 공유되지만 `meta` 는 **노드 범위**다. 화면에는 선택한 노드의 `meta` 만 있으므로 그 노드가 만든 턴에만 줄이 붙는다. 위 "노드 필터 없음" 원칙의 예외가 아니라 두 데이터의 범위가 원래 다르기 때문이다(CT-S20).

## Rationale

### 렌더 규칙을 데이터 모델과 분리한다

`ConversationTurn` 스키마는 그대로 두고 UI 렌더 규칙만 이 문서로 명문화했다. emit 메시지와 스레드 스냅샷의 역할을 나누고 출처별 시각 매핑을 강제한다. 데이터 모델을 바꾸지 않는다. 스레드 스냅샷은 이미 입력 대기 이벤트로 전송되고 source·nodeLabel·data 메타가 있어 원문을 파싱하지 않고도 분기할 수 있다.

- **기각: `displayKind` 필드 신설.** `source` enum 에서 이미 1:1 로 도출되므로 중복이다.
- **기각: emit 메시지 원문을 그대로 표시.** 출처 접두(`[from <nodeLabel>]`)와 사용자 입력 마커가 그대로 보여 사용자 오인의 근본 원인이 된다.
- **마커는 지우되 없애지 않는다.** 사용자 입력 마커는 다언어 프롬프트 주입 방어용으로 백엔드가 일부러 넣는다. 마커를 없애면 주입 표면이 넓어진다. 사용자 오인 문제는 마커를 없애는 대신 UI 에 보이기 직전에 지워서 푼다. 백엔드는 LLM 쪽 보안을 유지하고 UI 는 사용자에게 보이기 전에 지운다.
- **출처 칩을 "권장" 에서 "필수" 로 올린 이유.** 사용자 오인을 없애려면 칩 한 신호로는 부족하다. 색약·다크 모드·작은 화면·스크롤 상태 모두에서 안정적으로 구분하려면 아이콘, 컨테이너 형식, 칩 세 신호를 동시에 적용해야 한다.
- **emit 메시지를 대화 미리보기에서 떼어 낸 이유(D4).** 대화 미리보기의 대화 턴 1차 소스를 스레드 스냅샷으로 두고 emit 메시지는 LLM 디버그 패널 전용으로 뗐다. emit 메시지는 LLM 으로 간 페이로드와 1:1 로 맞추려고 출처 접두를 담아 그대로 표시하면 오인을 부르고 매 렌더마다 정리해야 한다. D4 의 대립 축은 "무엇이 대화 턴을 표현하는가"(스레드냐 emit 메시지냐)이지 "미리보기가 스레드 밖 데이터를 전혀 읽지 못한다" 가 아니다(2026-07-17 명확화, 번복 아님).

### UI 계약을 이 문서 한 곳에 모은다

데이터 모델과 LLM 맥락 정책만 적혀 있던 규약을 UI 라이프사이클·렌더 계약의 기준으로 넓혔다. 도구 호출 묶음, 이벤트별 store 변환, 빈 content 판정, UI 불변량, 회귀 차단 시나리오, 변환 함수 계약이 이 문서와 하위 문서에 들어간다.

- **배경**: 대화 미리보기 UI 가 같은 영역에서 되풀이해 회귀했다. 공통 원인은 스펙에 데이터 모델과 LLM 맥락 정책만 있고 UI 의 동적 라이프사이클이 없어 구현자가 매번 짐작으로 결정한 것이었다. 시각 매핑과 UI 계약을 한 문서에 두면 서로 바로 링크되고 회귀가 생기면 회귀 시나리오 표만 갱신해 추적할 수 있다.
- **기각: 시각 매핑 표 비고만 조금 보태기.** 그 표는 정적 매핑이지 라이프사이클 계약이 아니라 효과가 없다.
- **기각: 별도 스펙 파일 신설.** 데이터 모델과 UI 계약이 같은 도메인이라 링크 부담과 어긋남 위험이 커진다. 데이터 모델은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md), UI 계약은 이 문서로 나누고 두 문서가 서로 링크해 이 위험을 줄인다. 이 문서를 하위 문서 셋으로 나눈 것은 편당 크기 한도 때문이다. 하위 문서는 이 문서 아래에 묶인 한 스펙이고 UI 불변량과 요구사항 줄이 이 문서에 그대로 있어 기각한 "별도 스펙 파일" 과는 다르다.
- **기각: storybook 도입.** 회귀 시나리오의 fixture 인프라는 단위 테스트 입력만 export 한다. 시각 회귀를 자동화하려면 storybook 이나 playwright 스냅샷 통합이 필요한데 별도 인프라 의존이 크다. 그래서 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) v2 로드맵의 "시각 회귀 인프라" 항목으로 넘겼다.
- **적용 범위**: 세 신호 강제와 UI 계약은 모두 에디터·콘솔 디버깅 화면을 대상으로 한 결정이다. 임베드 위젯의 두 말풍선 렌더는 적용 범위를 나눈 것이고 세 신호가 막으려던 "사용자 발화 오인" 은 위젯의 user 말풍선 매핑([웹채팅 위젯 §패널](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md#패널))으로 그대로 피한다.

### 새 실행만 대화를 지운다 (Inv-6)

실행이 실패할 때 대화 전체를 지우면 사용자가 "왜 대화가 사라졌지?" 하고 혼란스러워한다(예: 할당량 에러로 멀티턴 대화 전체가 사라짐). 대화 스레드는 사용자가 직접 한 발화, LLM 응답, 도구 호출을 합친 것이라 노드 실패와 상관없이 가치가 있다. `startExecution` 만 지우면 세 가지를 한 정책으로 얻는다. (a) 사용자 발화가 보존되고 (b) `system_error` 가 스레드의 자연 위치에서 끊긴 곳을 보여 주고 (c) 재시도하면 자연스럽게 이어진다.

`system_error` 는 system 알림과 모양이 다르다. system 알림은 얇은 회색 텍스트, `system_error` 는 얇은 빨간 줄과 오른쪽 액션 영역이다. 한 신호(예: 색)만으로 구분하지 않는 세 신호 원칙을 `system_error` 에도 똑같이 강제한다. 출처 값 `system_error` 를 새로 둔 결정 자체는 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 가 다룬다.

### 보존과 도달성을 나눈다 (Inv-8)

store 보존(Inv-6)과 별도로 렌더 층 도달성을 Inv-8 로 두고 [데이터 소스](CLE-EXEC-PREVIEW-RENDER.md#데이터-소스) 에 오류 종료 경로를 적었다. 탭 가시성과 기본 탭 규칙은 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 이 정하고 이 문서는 그 예외를 넓힌 근거만 준다. 기준이 두 곳에 생기지 않게 하려는 것이다.

- **배경**: Inv-6 은 `failExecution` 이 `conversationMessages` 를 지우지 않음을 보장했고 구현도 지켰다. 그런데도 사용자에게는 대화가 통째로 사라져 보였다. 보존과 도달성은 별개 불변량인데 Inv-6 이 store 층만 정했기 때문이다. 결함은 두 겹이었다. (a) 프런트 `node.failed` 핸들러가 엔진이 함께 실은 `output`(대화 전체)을 버리고 `outputData: null` 로 고정했다(`node.completed` 는 `payload.output` 을 썼다). (b) 대화 미리보기 표시 조건이 `status === 'completed'` 를 요구했다. 대화는 store 와 DB 에 있는데 UI 로 가는 길만 없었다.
- **`status` 를 게이트로 쓰지 않는 이유**: 엔진은 실패해도 `nodeExec.outputData` 를 저장하고 `node.failed` 이벤트에 함께 싣는다. 즉 `status` 는 대화 데이터가 있는지와 상관없는 축이다. 데이터 유무(`isConversationOutput(outputData)` 또는 store 의 `system_error` 보유)로 판정해야 매체가 있는 한 늘 닿을 수 있다. `status` 로 막으면 데이터가 있는데도 막는 거짓 음성이 생긴다.
- **retryable 과 상관없이 넓힌 이유**: 원래 예외의 근거는 [다시 시도] 버튼에 묶여 있어 저절로 넓어지지 않는다. 그래서 따로 근거를 둔다. 대화 시간축을 보존하는 가치는 재시도 가능성과 독립이다. retryable 이 아닌 종료(예: 인증 실패)에서도 사용자는 "어느 턴에서 어떤 맥락으로 끊겼는지" 를 먼저 봐야 한다. `system_error` 는 retryable 여부와 상관없이 스레드에 인라인으로 표시된다(retryable 이 아니면 액션 영역만 빈다). 오류 탭은 명시적으로 골라 계속 열 수 있어 에러 정보에 닿는 길은 줄지 않는다. 원래 예외가 기본 탭 일반 원칙(ED-EX-13)과의 긴장을 푼 것과 같은 논증이다.
- **기각: 백엔드가 실패 노드에 대화 페이로드를 더 싣기.** 이미 싣고 있다(실측). 프런트가 버렸을 뿐이라 백엔드 계약을 바꿀 필요가 없다. `node.failed` 는 노드와 상관없는 공통 실패 경로라 AI 전용 페이로드를 더하면 계층을 침범한다.

### 단일 턴 실패에는 `system_error` 를 붙이지 않는다 (2026-11-01)

→ [대화 미리보기 — 시각 매핑과 데이터 소스](CLE-EXEC-PREVIEW-RENDER.md#단일-턴-실패에는-system_error-를-붙이지-않는다-2026-11-01)

### `rag` 줄을 보조 관찰성 레인으로 둔다

→ [대화 미리보기 — 시각 매핑과 데이터 소스](CLE-EXEC-PREVIEW-RENDER.md#rag-줄을-보조-관찰성-레인으로-둔다)
