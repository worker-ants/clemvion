---
id: "CLE-WF-ASSIST-UI"
title: "워크플로우 AI 어시스턴트 — 패널 화면"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-ASSIST"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-ASSIST"]
area: "CLE-WF"
content_hash: "96a789921ca2a66fdc115d2877220b794f3446f33f2175b34ea715cd092b0805"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "34f0337d2981af14fadc130e8522f352e6c28546405e9e45cd22d6227f5e39ef"
etag: "sha256-c25368d534f7ec9c9985119a6e32de5181d49b1b1931a19a87dc65addbe7047e"
---
## 개요

이 문서는 [워크플로우 AI 어시스턴트](CLE-WF-ASSIST.md) 의 하위 문서로 AI 어시스턴트 패널 화면(위치 · 구성 · 요소별 동작 · 접근성 · 빈 상태 · 단축키)과 패널 i18n 키를 정한다. 에러 코드별 안내 문구는 [에러 처리와 모델 설정](CLE-WF-ASSIST-ERROR.md#에러-처리), 계획 카드의 진행 규칙은 [대화 루프와 턴 가드](CLE-WF-ASSIST-LOOP.md#계획-카드-진행)가 정한다.

## 패널 화면

### 위치와 크기

| 항목 | 값 |
|------|----|
| 위치 | 에디터 오른쪽. 설정 패널과 같은 슬롯 |
| 너비 | 360px 고정 |
| 여는 방법 | 툴바의 AI 어시스턴트 버튼으로 토글 |
| 설정 패널과의 관계 | 서로 배타적이다. AI 어시스턴트를 열면 설정 패널이 자동으로 닫힌다. 노드 클릭 등으로 설정 패널이 필요하면 AI 어시스턴트가 닫힌다. 설정 패널을 연 채 AI 어시스턴트를 열면 설정 패널이 닫히는 것을 애니메이션으로 알린다 |

### 패널 구성

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 헤더 | 맨 위 | 제목 "AI 어시스턴트", 닫기(✕) | 닫아도 어시스턴트 세션은 서버에 남는다 |
| 모델 줄 | 헤더 아래 | 모델 설정 선택기, 새 대화(⟳) 버튼 | 아래 요소 표 참고 |
| 메시지 목록 | 가운데 | 사용자·어시스턴트 메시지, 탐색 배지(예: `list_integrations() → 3 entries`), 계획 카드(제목, 번호 붙은 단계 체크박스, "계획대로 진행" 버튼), 편집 배지(예: `add_node HTTP Request`, `add_edge Manual → HTTP`), 안내 박스, 에러 버블 | 시간순으로 쌓인다 |
| 입력 영역 | 맨 아래 | 입력창("요청을 입력하세요..."), 안내 "Enter: 전송 · Shift+Enter: 줄바꿈", 응답 중단(Stop) 버튼 | 응답 중단 버튼은 스트리밍 중에만 보인다 |

### 요소별 동작

| 요소 | 설명 |
|------|------|
| 헤더 | 제목과 닫기(✕). 닫아도 어시스턴트 세션은 서버에 보존된다 |
| 모델 선택 | 모델 설정 선택기. 라벨은 `assistant.modelLabel`(모델)이다. "기본 Provider"(`assistant.modelDefault`)를 고를 수 있다. 값이 비면 워크스페이스 기본 설정을 쓴다. 고른 설정을 서버가 찾지 못해 기본 설정으로 대신하면 선택 값이 "기본 Provider" 로 돌아간다([모델 설정](CLE-WF-ASSIST-ERROR.md#모델-설정)) |
| 새 대화(⟳) | 확인 다이얼로그를 띄운 뒤 현재 대화를 비운다. 이전 세션은 기록에 남는다 |
| 메시지 목록 | 사용자·어시스턴트 메시지, 도구 호출 배지, 계획 카드, 에러가 시간순으로 쌓인다. 스트리밍 중에는 회색 커서 애니메이션이 보인다. 새 이벤트(텍스트 조각, 도구 호출 배지, 계획 카드, 단계 체크)가 올 때마다 목록이 맨 아래로 자동 스크롤된다 |
| 제어 토큰 거르기 | 일부 모델이 어시스턴트 텍스트에 OpenAI harmony 제어 토큰(`<\|channel\|>...<\|message\|>{...}`)을 흘릴 수 있다. 화면은 그리기 직전에 `sanitizeAssistantText` 로 거르고 거른 결과가 비면 그 버블을 숨긴다. 사용자에게 제어 토큰이나 원시 JSON 이 보이지 않는다 |
| 마크다운 렌더 | 어시스턴트·도구 메시지 본문은 `markdown-renderer.tsx`(react-markdown + `remark-gfm`, `rehype-raw` 미사용이라 raw HTML 은 escape)로 그린다. 제어 토큰 거르기와는 별개의 보안 정책이다. 이 정책을 바꾸면 웹채팅 위젯 렌더러(`safe-html.ts`)와의 보안 동등성이 깨질 수 있으므로 [웹채팅 보안](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md)의 sanitize 정책 매트릭스도 함께 검토한다 |
| 탐색 배지 (🔍 회색) | `list_workflows`, `list_integrations` 같은 탐색 도구 호출. 요약 한 줄을 보이고 접기·펼치기로 전체 결과를 본다 |
| 편집 배지 (✔ 녹색) | `add_node`, `update_node` 등 성공. 인자 요약과 연결된 노드 라벨을 보인다. 서명이 같은 호출이 연달아 오면 `× N` 을 붙인 배지 하나로 줄인다. 서명은 `update_node` 는 patch 필드 집합, `add_node` 는 노드 유형, 나머지는 도구 이름이다. 실패(`ok:false`) 호출은 서명에 `:err` 를 붙여 성공 묶음과 따로 그린다. 에러가 묻히지 않게 하기 위해서다 |
| 재시도 후 성공 배지 (✔ `retried`) | `add_edge` 실패의 에러 코드가 `PORT_NOT_FOUND` 나 `NODE_NOT_FOUND` 이고 같은 `source_id`·`target_id` 의 성공 배지가 곧바로 이어지면 두 배지를 "재시도 후 성공" 하나로 줄인다. 앞선 `NODE_NOT_FOUND` 가 연쇄 실패였으면 같은 source 기준으로 묶는다. 라벨은 성공한 호출 기준에 `retried` 꼬리표를 붙이고 툴팁·hover 에 원래 실패 사유(실패한 포트 값, 에러 코드)와 성공 때의 포트 값을 함께 보인다. i18n `assistant.toolCallBadgeRetryRecovered`. 이 축약은 서버가 `knownPorts` 와 연쇄 실패 FIFO 로 다음 라운드에 자연 복구하도록 설계한 두 코드에만 쓴다. `LABEL_CONFLICT`, `CYCLE_DETECTED` 같은 다른 Shadow 에러는 사용자와 디버깅하는 사람에게 분명히 보여야 하므로 빨간 배지를 유지한다. 성공 배지가 이어지지 않으면 실패 배지를 그대로 둔다 |
| 에러 배지 (⚠ 빨강) | 편집 도구 실패. Shadow 검증 실패 사유를 보인다 |
| 에러 버블 | `error` 이벤트(예: `ASSISTANT_TOO_MANY_TOOL_CALLS`, `ASSISTANT_STREAM_FAILED`)를 토스트가 아닌 해당 어시스턴트 버블 아래 빨간 상자로 그린다. 상자에는 제목(`assistant.errorBubbleTitle`), 에러 코드 배지, 안내 문구가 보인다. `ASSISTANT_NO_LLM_CONFIG` 에는 모델 설정 화면의 Chat 탭(`/models?tab=chat`)으로 가는 링크(`assistant.errorNoLlmConfigLink`)가 붙는다. 사용자는 채팅 맥락에서 왜 멈췄는지와 복구 방법을 보고 다음 행동을 바로 고를 수 있다. 안내 문구 선택(사전 문구, 없으면 서버 `message`)과 코드별 문구는 [에러 처리](CLE-WF-ASSIST-ERROR.md#에러-처리) 표를 따른다 |
| 멈춤 안내 | 어시스턴트가 텍스트 없이(content 공백) 정상 종료(`done`)했고 승인된 계획(버튼 승인이나 자연어 승인으로 단계가 1개 이상 끝남)에 실행 가능한 대기 단계가 남아 있으면 프론트엔드가 그 메시지에 `systemHint.kind = 'info'` 로 `assistant.turnStalledHint` 를 넣고 amber 안내 상자로 그린다. 서버 가드가 진척을 추적해 계획이 끝날 때까지 `finish` 를 계속 막으므로 이 안내는 LLM 이 정말 막혔거나 한도가 다 됐을 때만 보인다 |
| 완료 안내 | 턴이 끝날 때 활성 계획의 `note` 가 아닌 단계가 모두 `done` 이고 `openQuestions` 도 비어 있으면 `systemHint.kind = 'success'` 로 `assistant.turnCompletedHint`("작업을 완료했어요 — N개 단계 실행 성공.")를 넣고 체크 아이콘이 있는 emerald 성공 상자로 그린다. 에러가 났으면 에러 버블이 우선이고 성공 안내는 띄우지 않는다. 우선순위는 에러 > 멈춤 > 완료다 |
| 자동 이어서 진행 구분선 | 서버가 [자동 이어서 진행](CLE-WF-ASSIST-LOOP.md#자동-이어서-진행)으로 다음 라운드를 시작하면 어시스턴트 메시지 행이 나뉘어 새 버블이 생긴다. 경계에는 회전 아이콘과 `assistant.autoResumedHint`("자동으로 이어서 진행했어요 (1/2)")로 구분선을 그린다. 실시간 경로는 `attempt/max` 로 진행도를 보이고 `max` 가 없는 세션 다시 불러오기 경로는 `assistant.autoResumedHintShort` 로 순번("(1번째)")만 보인다. 이 구조 덕분에 gpt-oss-120b 가 이어서 진행 앞뒤 라운드에서 같은 확인 문구를 되풀이해도 다른 버블에 나뉘어 보인다 |
| 후보 선택기 | `add_node`·`update_node` 결과에 `pendingUserConfig` 가 붙고 그 안에 `candidates` 가 1개 이상이면 그 편집 버블의 도구 호출 배지 묶음 바로 아래(에러 버블과 안내 상자보다 위)에 드롭다운 선택기를 그린다. 사용자가 항목을 고르고 Confirm 을 누르면 `editor-store.updateNode(nodeId, { config: { [field]: selectedId } })` 로 바로 반영하고 선택기는 "✓ {label}: {selected} 로 설정됨" 읽기 전용 표시로 바뀐다. LLM 을 다시 부르지 않는다. 프론트엔드 혼자 적용하며 캔버스의 저장 흐름과 되돌리기 스택에 그대로 들어간다. 되돌리기를 해도 선택기 상태는 되돌리지 않는다. 후보가 하나여도 자동으로 넣지 않고 선택지 하나짜리 드롭다운으로 확인을 받는다. `candidates` 가 0개면 선택기 대신 amber 안내 상자(`assistant.candidatePickerEmpty`)와 해당 리소스 등록 화면 딥링크를 그린다. 데이터 구조와 후보 조회 범위는 [AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md#사용자-선택-필드-후보), 세션을 다시 불러올 때의 복원은 [AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md#메시지-응답-필드)에 있다 |
| 계획 카드 | [계획 카드 진행](CLE-WF-ASSIST-LOOP.md#계획-카드-진행) 참고. 화면 제목은 `assistant.planCardTitle`("실행 계획")이다 |
| 입력창 | 기본 1줄, 최대 6줄까지 자동으로 늘어난다. 응답 중단 버튼은 스트리밍 중에만 보인다 |

### 접근성

| 항목 | 값 |
|------|----|
| 패널 루트 | `role="complementary"`. `aria-label` 은 `assistant.panelTitle` 문구다 |
| 메시지 목록 | `role="log"`, `aria-live="polite"`. 스트림 텍스트는 조각 단위로 읽지 않고 메시지가 완결될 때만 알린다 |
| 입력창 | `aria-label` 은 `assistant.placeholder` 문구다 |
| 계획 카드 | 체크박스는 `role="checkbox"` 와 `aria-checked`, `aria-disabled=true` 다. 사용자가 조작할 수 없고 진행도 표시 전용이다 |
| 후보 선택기 | 컨테이너에 `role="group"`. `aria-label` 은 `assistant.candidatePickerTitle` 문구이고 `{{label}}` 에 필드 라벨이 들어간다. 드롭다운은 네이티브 `<select>` 나 같은 기능의 `role="listbox"` 로 만들고 키보드(↑·↓·Enter)로 조작할 수 있어야 한다. Confirm 버튼의 `aria-disabled` 는 후보 선택 여부에 따라 바뀐다. 확정 뒤에는 선택기 영역이 `role="status"` 로 바뀌어 "✓ 설정됨" 을 알린다 |
| 키보드 | `Ctrl+/` 로 패널 토글(단축키 충돌이 없을 때만) |

### 빈 상태

AI 어시스턴트를 처음 열거나 새 대화를 시작하면 보이는 화면이다.

| 요소 | 내용 |
|------|------|
| 제목 | "무엇을 도와드릴까요?" |
| 설명 | "자연어로 원하는 워크플로우를 설명하면 함께 만들어드려요." |
| 예시 칩 | 누르면 입력창에 들어간다: "주문 취소 프로세스 추가해줘", "HTTP 노드에 Authorization 헤더 추가", "현재 워크플로우를 검토하고 개선점 제안해줘", "노드를 예쁘게 재정렬해줘" |

### 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `Ctrl+/` | AI 어시스턴트 패널 토글 |
| `Enter` (입력창) | 메시지 전송 |
| `Shift+Enter` (입력창) | 줄바꿈 |
| `Esc` (입력창 포커스) | 입력 내용을 비우고 포커스를 뗀다 |
| `Ctrl+Z` (캔버스 포커스) | 기존 되돌리기. AI 어시스턴트 변경도 역순으로 되돌린다 |

에디터 전체 단축키 목록은 [워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md)가 정한다.

## i18n 키

도구 호출 배지의 요약 문구는 지금 영문 고정 문자열이다(`tool-call-badge.tsx` 의 `summarize()`). 재시도 후 성공 표시만 `assistant.toolCallBadgeRetryRecovered` 를 쓴다. 이 영문 고정은 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md#규칙) 규칙 1 의 알려진 예외로 적어 둔다. 아래 `assistant.exploreLookup`·`assistant.exploreExecutionsList`·`assistant.exploreExecutionDetails` 등 탐색 계열 키는 에디터의 다른 화면(안내, 에러 버블)에서 쓰기 위한 약속이다. 배지 요약을 사전 키로 옮기는 일은 NERV Task `CLE-T-F9QEJC` 가 맡는다. 다국어 규약은 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md)를 따른다.

| 키 | 한국어 | 영어 |
|----|--------|------|
| `assistant.panelTitle` | AI 어시스턴트 | AI Assistant |
| `assistant.toggleButton` | AI 어시스턴트 열기/닫기 | Toggle AI Assistant |
| `assistant.newSession` | 새 대화 시작 | New session |
| `assistant.modelLabel` | 모델 | Model |
| `assistant.modelDefault` | 기본 Provider | Default provider |
| `assistant.configFallbackToast` | 선택한 모델 설정을 찾지 못해 워크스페이스 기본 설정({{name}})으로 답해요. | The selected model config wasn't found, so the workspace default ({{name}}) will answer. |
| `assistant.placeholder` | 요청을 입력하세요... | Describe what you want to build... |
| `assistant.sendButton` | 전송 | Send |
| `assistant.stopButton` | 중단 | Stop |
| `assistant.thinking` | 생각 중... | Thinking... |
| `assistant.planCardTitle` | 실행 계획 | Plan |
| `assistant.planApproveButton` | 계획대로 진행 | Approve & execute |
| `assistant.planApproveConfirm` | 계획대로 진행해 주세요. | Please proceed with this plan. |
| `assistant.planQuestionsTitle` | 답변이 필요한 항목 | Questions to answer |
| `assistant.planQuestionsHint` | 아래 메시지 입력창에 답변을 적어 보내요. | Type your answer in the message box below. |
| `assistant.turnStalledHint` | 진행이 중단됐어요. `이어서 진행해줘` 라고 답해 주시면 남은 단계를 계속 실행할게요. | The assistant stopped without a message. Send `Continue` and I'll keep executing the remaining steps. |
| `assistant.turnCompletedHint` | 작업을 완료했어요 — {{count}}개 단계 실행 성공. | Done — {{count}} plan steps completed. |
| `assistant.autoResumedHint` | 자동으로 이어서 진행했어요 ({{attempt}}/{{max}}) | Auto-resumed ({{attempt}}/{{max}}) |
| `assistant.autoResumedHintShort` | 자동으로 이어서 진행했어요 ({{attempt}}번째) | Auto-resumed (attempt {{attempt}}) |
| `assistant.candidatePickerTitle` | {{label}} 선택 | Select {{label}} |
| `assistant.candidatePickerConfirm` | 이 항목으로 설정 | Use this |
| `assistant.candidatePickerSelected` | ✓ {{label}}: {{selected}} 로 설정됨 | ✓ {{label}}: {{selected}} set |
| `assistant.candidatePickerEmpty` | 사용 가능한 {{label}} 이(가) 없어요. Settings 에서 먼저 등록해 주세요. | No {{label}} available yet. Register one in Settings first. |
| `assistant.candidatePickerEmptyLink` | 설정 화면으로 이동 | Open Settings |
| `assistant.toolCallBadgeRetryRecovered` | 재시도 후 성공 | Retried and succeeded |
| `assistant.errorBubbleTitle` | 요청 처리 중 문제가 발생했어요 | Something went wrong with this turn |
| `assistant.emptyTitle` | 무엇을 도와드릴까요? | How can I help? |
| `assistant.emptySubtitle` | 자연어로 원하는 워크플로우를 설명하면 함께 만들어드려요. | Describe the workflow you want and I'll build it with you. |
| `assistant.exampleAddCancelFlow` | 주문 취소 프로세스 추가해줘 | Add an order cancellation flow |
| `assistant.exampleAddHeader` | HTTP 노드에 Authorization 헤더 추가 | Add an Authorization header to the HTTP node |
| `assistant.exampleReview` | 현재 워크플로우를 검토하고 개선점 제안해줘 | Review this workflow and suggest improvements |
| `assistant.exampleArrange` | 노드를 예쁘게 재정렬해줘 | Rearrange the nodes into a clean layout |
| `assistant.errorNoLlmConfig` | 사용할 모델 설정이 없어요. 모델 설정 화면에서 Chat 모델을 먼저 등록해 주세요. | No model config is available. Register a Chat model in Model settings first. |
| `assistant.errorNoLlmConfigLink` | 모델 설정으로 이동 | Open Model settings |
| `assistant.errorStreamFailed` | 응답을 끝내지 못했어요. 요청 한도를 넘었거나 응답이 늦어졌을 수 있어요. 잠시 후 같은 메시지를 다시 보내 주세요. | Couldn't finish the response. A rate limit may have been reached or the response may have taken too long. Send your message again in a moment. |
| `assistant.errorRateLimit` | AI 모델의 요청 한도를 넘었어요. 잠시 후 같은 메시지를 다시 보내 주세요. | The AI model's rate limit was reached. Send your message again in a moment. |
| `assistant.errorConnection` | AI 모델과 통신하다가 오류가 났어요. 잠시 후 같은 메시지를 다시 보내 주세요. | Something went wrong while talking to the AI model. Send your message again in a moment. |
| `assistant.errorOutputMalformed` | 모델이 응답에 내부 제어 토큰을 드러내 처리를 멈췄어요. 다른 모델로 바꾸거나 모델 서빙 설정을 확인해 주세요. | The model leaked internal control tokens into its response, so processing was stopped. Switch to another model or check the model's serving settings. |
| `assistant.errorTooManyToolCalls` | 이번 턴에 쓸 수 있는 도구 호출을 다 썼어요. "이어서 진행" 버튼을 누르면 남은 단계를 이어서 해요. | This turn used up all of its available tool calls. Press "Continue" to carry on with the remaining steps. |
| `assistant.continueAfterBudgetButton` | 이어서 진행 | Continue |
| `assistant.continueAfterBudget` | 이어서 진행해줘. | Continue. |
| `assistant.opAdded` | 노드 추가: {{label}} | Added node: {{label}} |
| `assistant.opUpdated` | 노드 수정: {{label}} | Updated node: {{label}} |
| `assistant.opRemoved` | 노드 삭제: {{label}} | Removed node: {{label}} |
| `assistant.edgeAdded` | 연결선 추가 | Edge added |
| `assistant.edgeRemoved` | 연결선 삭제 | Edge removed |
| `assistant.exploreLookup` | {{count}}건 조회됨 | {{count}} found |
| `assistant.exploreExecutionsList` | 실행 이력 {{count}}건 조회 | {{count}} executions found |
| `assistant.exploreExecutionDetails` | 실행 상세 조회 — {{nodeCount}}개 노드 | Execution detail — {{nodeCount}} nodes |
| `assistant.executionNotInScope` | 이 실행은 현재 워크플로우의 것이 아니에요. | This execution does not belong to the current workflow. |

`assistant.planApproveConfirm` 은 안내 상자로는 쓰지 않는다. "계획대로 진행" 버튼(`approveActivePlan`)이 사용자 메시지로 보낼 때 쓴다.

`assistant.continueAfterBudgetButton` 은 에러 버블의 "이어서 진행" 버튼 라벨이다. 버튼을 누르면 `continueAfterBudget` 동작이 현재 언어의 `assistant.continueAfterBudget` 문구를 사용자 메시지로 보낸다.

## 구현 위치

- `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` (통합 목록 도구, 작성자 판정 `requesterIsWorkflowAuthor`)
- `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts` (후보 선택기 후보 조회)
- `codebase/frontend/src/components/editor/assistant-panel/*.ts`, `*.tsx` (패널, 메시지, 배지, 후보 선택기)
- `codebase/frontend/src/lib/i18n/dict/ko/assistant.ts`, `codebase/frontend/src/lib/i18n/dict/en/assistant.ts` (에러 안내 문구 등 패널 문구)
- `codebase/frontend/src/lib/stores/assistant-store.ts` (대화 상태, 안내 상자, 이어서 진행 버튼)
- `codebase/frontend/src/lib/stores/assistant-editor-bridge.ts` (에디터 스토어 연결)

## Rationale

### 후보 선택기 정책

`integration-selector` 같은 사용자 선택 위젯의 ID 는 LLM 이 추측해 넣을 수 없다(시스템 프롬프트가 금지). 그래서 워크스페이스에 쓸 수 있는 후보(예: SMTP 통합 하나)가 있어도 자동으로 연결되지 않고 사용자에게 수동 설정을 떠넘겼다. 이를 풀려고 메시지 안 선택기를 넣었다.

최종 정책은 "설정할 수 있는 항목이 있으면 사용자에게 명시적으로 확인받은 뒤 넣고 없으면 기존 안내를 유지한다" 이다. 적용 대상은 선택기 위젯 다섯 종(`integration-selector`, `mcp-server-selector`, `llm-config-selector`, `kb-selector`, `workflow-selector`) 전체다.

구현자가 기억할 계약은 다음과 같다.

1. **서버**: `collectPendingUserConfig` 는 스키마를 훑어 빈 선택기 필드를 모으고 위젯별 저장소를 워크스페이스 범위로 조회해 `candidates` 를 채운다. 통합은 요청자에게 보이는 것만 담는다(다른 사용자의 개인 통합 제외, 2026-09-25 부터). 요청자가 워크플로우 작성자가 아니면 요청자의 개인 통합도 뺀다. 골라도 노드 저장이 400 이기 때문이다([AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md) Rationale).
2. **프롬프트**: 전의 "You must NOT fill ... surface them in the closing message" 를 "Leave ids empty; server attaches candidates; mention only when candidates list is empty" 로 바꿔 `STATIC_BLOCK_3_EDIT_PLAYBOOK` 에 넣었다.
3. **품질 점검**: `collectUnmentionedPendingUserConfig` 는 `candidates?.length === 0` 인 항목만 빠진 필드로 센다.
4. **화면**: 확정 뒤 선택기는 "✓ 설정됨" 으로 고정한다. 되돌리기로 선택기 상태를 되돌리지 않는 것은 화면 복잡도에 비해 얻는 것이 적기 때문이다.

범위 밖: 도구 영역 노드의 `toolOwnerId` 는 사용자 선택 위젯이 아니라 이 정책 대상이 아니다. UI 컴포넌트 테스트는 RTL 환경이 없어 넣지 않았다.

### 재시도 후 성공 배지

`PORT_NOT_FOUND`·`NODE_NOT_FOUND` 는 서버가 다음 라운드에서 복구하는 경로라 기능은 잘 동작했지만 빨간 배지가 찍혀 "실패가 잦다" 는 인상을 줬다. 백엔드가 포트 목록을 돌려주는 변경([AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md))과 함께 프론트엔드도 배지를 줄이기로 했다.

- 묶기는 `tool-call-badge.tsx` 의 `groupToolCalls` 가 한다. 판정 기준은 [요소별 동작](#요소별-동작)의 재시도 후 성공 배지 항목과 같다.
- 회귀 테스트 `tool-call-badge.test.ts`: 같은 source·target 의 `PORT_NOT_FOUND` → 성공이면 배지 1개, `LABEL_CONFLICT` → 성공이면 배지 2개 유지, 연쇄 `NODE_NOT_FOUND` → 최종 성공이면 배지 1개.

### 계획 전용 턴의 자동 승인 안내를 없앴다

계획 전용 턴이 끝나면 계획 카드와 함께 "계획대로 진행해 주세요." 안내 상자를 넣었다. 카드의 "계획대로 진행" 버튼과 같은 문구가 겹쳐 중복 메시지로 보였다. 버튼이 이미 있으니 안내는 필요 없다는 사용자 피드백을 받아 `assistant-store.ts` 의 `done` 이벤트 안내 분기에서 `planApproveConfirm` 을 넣는 조건을 지웠다. 멈춤 안내와 완료 안내만 남는다. i18n 문자열은 `approveActivePlan` 이 사용자 메시지로 보낼 때 쓰므로 남겼다.

### 에러 버블에 "이어서 진행" 버튼을 더했다

`ASSISTANT_TOO_MANY_TOOL_CALLS` 가 나면 사용자가 입력창에 "이어서 진행해줘" 를 직접 쳐야 복구할 수 있었다. 그래서 `assistant-store.ts` 에 `sendMessage` 를 감싸 현재 언어의 메시지를 보내는 `continueAfterBudget` 동작을 더하고 `assistant-message.tsx` 에 `RESUMABLE_ERROR_CODES` 집합을 두어 에러 버블 아래 버튼을 보이게 했다. `assistant-panel.tsx` 가 `onContinueAfterBudget` 콜백을 `AssistantMessageView` 로 넘겨 스냅샷 결합을 유지한다. 계획 승인 버튼과 같은 패턴이다.

### 에러 상자 대비

패널 에러 상자가 `text-red-800/200` 의 탁한 색을 써서 11px 작은 글씨가 특히 읽기 어려웠다. `assistant-message.tsx` 의 에러 상자를 안내 상자 패턴에 맞춰 본문은 `text-red-950 dark:text-red-50` 와 `font-medium`, 에러 코드 배지는 별도 배경(red-200, 어두운 모드 red-800)과 테두리로 구분했다. 본문은 10px 에서 11px 로 올렸다. 긴 영문 메시지를 위해 더했던 `break-all` 은 2026-10-24 에 뺐다. 에러 버블이 코드별 사전 문구를 보이고 모델 프로바이더 원문을 싣지 않게 되어 긴 URL 이나 토큰 문자열이 더는 오지 않는다. 지금은 단어 단위 줄바꿈(`break-words`)만 쓴다.

### 유지보수 점검

- 에러 상자 스타일을 바꾸면 안내 상자와 일관되게 둔다(밝은·어두운 모드 모두 950/50 대비).
- `RESUMABLE_ERROR_CODES` 에 코드를 더하면 (1) 백엔드가 그 코드를 실제로 내는지, (2) "이어서 진행해줘" 가 의미 있는 복구인지, (3) `continueAfterBudget` 대신 별도 재개 동작이 필요한지 확인한다.
- `RESUMABLE_ERROR_CODES` 를 바꾸면 `assistant.errorTooManyToolCalls` 문구도 함께 본다. 이 문구가 «"이어서 진행" 버튼» 을 가리키기 때문이다. 에러 버블 테스트(`assistant-message-error.test.tsx`)가 이 문구에 버튼 문구(`assistant.continueAfterBudgetButton`)가 들어 있는지 확인한다.
