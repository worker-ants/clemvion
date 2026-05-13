# Spec: Workflow AI Assistant

> 관련 문서: [PRD 워크플로우 에디터 §10](./_product-overview.md#10-ai-assistant-ed-ai-) · [PRD AI 플랫폼 §3.6](../4-nodes/3-ai/_product-overview.md) · [Spec 캔버스 §1 레이아웃](./0-canvas.md) · [Spec 노드 공통](./1-node-common.md) · [Spec 실행/디버깅](./3-execution.md) · [Spec LLM 클라이언트](../5-system/7-llm-client.md) · [Spec 데이터 모델 §2.20~2.21](../1-data-model.md#220-assistantsession) · [Spec WebSocket](../5-system/6-websocket-protocol.md)

> **구현 상태**: ✅ 구현 완료 — backend `backend/src/modules/workflow-assistant/` (controller·session·stream service·prompts·tools·entities), frontend `frontend/src/components/editor/assistant-panel/` + `frontend/src/lib/stores/assistant-store.ts` + `assistant-editor-bridge.ts` 모두 활성. v1 범위는 §1.2 참조.

---

## 1. 개요

Workflow AI Assistant(이하 "Assistant")는 워크플로우 에디터에 내장된 채팅형 AI 에이전트다. 사용자가 자연어로 요구사항을 전달하면, Assistant는 LLM Config에 등록된 모델을 활용해 **대화 → 계획 제안 → 즉시 반영** 3단계로 노드와 엣지를 자동 생성·수정한다.

### 1.1 설계 목표

| 목표 | 설명 |
|------|------|
| 점진적 구체화 | 사용자의 모호한 요청("주문 취소 프로세스 추가")도 질문으로 요구사항을 채워 완성한다 |
| 단일 대화 루프 | 별도 모드 전환 없이 하나의 채팅 창에서 대화/계획/실행이 순환한다 |
| Reversible 변경 | 에디터의 기존 Undo 스택과 자동 저장 흐름을 재사용한다. 사용자의 승인 없이는 DB에 영구 기록하지 않는다 |
| 세션 복원 | 채팅 기록은 서버에 저장되어 페이지 새로고침이나 재접속 시에도 이어서 진행할 수 있다 |

### 1.2 범위 밖 (v1 제외)

| 항목 | 사유 |
|------|------|
| 여러 워크플로우에 걸친 일괄 편집 | 현재 세션은 단일 워크플로우에 종속 |
| Assistant가 직접 워크플로우를 실행 | 실행은 사용자가 직접 `Run` 버튼으로 수행 |
| 협업 공유 (세션을 다른 멤버와 공유) | 팀 워크스페이스 RBAC이 선행 필요 |

---

## 2. 대화 루프 (Clarify / Plan / Execute)

Assistant는 아래 3단계를 자유롭게 오간다. 단계는 상태 기계가 아닌 **프롬프트 지침과 도구 접근성**으로 유도한다.

| 단계 | 목적 | 사용 도구 | 캔버스 변경 |
|------|------|-----------|-------------|
| **① Clarify** | 요청이 모호할 때 탐색·질문으로 구체화 | 읽기 전용 탐색 도구 (§4.1) | ❌ |
| **② Propose Plan** | 실행 계획을 채팅 카드로 제시 후 승인 요청 | `propose_plan` (§4.2) | ❌ |
| **③ Execute** | 승인된 계획대로 노드·엣지 편집 | 편집 도구 (§4.3) | ✅ 즉시 반영 + Undo |

### 2.1 단계 판단 기준 (시스템 프롬프트)

| 요청 성격 | 권장 경로 |
|-----------|----------|
| 단일 필드·단일 노드 수정 | ① → ③ (계획 카드 생략 가능) |
| 2개 이상 노드 신규 or 도메인 의사결정 포함 | ① → ② → (사용자 승인) → ③ |
| 불확실하거나 판단이 어려운 경우 | 보수적으로 ②까지 진행 후 사용자 승인 대기 |

③ 실행 중 예상 못 한 의사결정이 필요해지면 `finish`로 한 턴을 종료하고 다시 ①/②로 돌아갈 수 있다.

### 2.2 Plan 카드 진행 UX

- ② 단계에서 `propose_plan.steps`가 UI에 체크박스 리스트로 렌더된다.
- ③ 단계에서 각 편집 tool-call이 전달될 때, 인자 `planStepId`(단일, legacy 단축형) 또는 `planStepIds`(배열) 와 매칭해 해당 step 들을 ✓ 처리한다. **한 번의 tool-call 이 여러 step 을 동시에 cover 할 수 있다.** 예: `add_node` 가 config 안에 버튼을 함께 주입해 `update_node` step 까지 대체한 경우 `planStepIds: ["s1","s3"]` 로 호출해 두 step 을 같이 체크한다.
- Step id가 없거나 매칭 실패 시, 순서상 다음 `pending` step을 ✓ 처리한다.
- 사용자는 진행도(3/7 완료 등)를 실시간으로 확인한다.
- **순차 실행 원칙.** LLM 은 step 을 listed order 로 실행하며, 중간 step 을 건너뛰고 뒤 step 을 먼저 `[x]` 처리해서는 안 된다. 어떤 step 이 앞선 tool-call 에 의해 이미 해결됐다면 `propose_plan` 을 다시 호출해 중복 step 을 `{action: 'note'}` 로 표시하거나 병합한 새 plan 으로 교체한다 (활성 plan 이 새 plan 으로 대체됨). "조용히 남겨두기" 는 금지 — 사용자가 unchecked 체크박스를 버그로 오인한다.
- `propose_plan.openQuestions`가 있으면 Plan 카드 안에 **질문 목록만** 노출하고 "아래 메시지 입력창에 답변을 적어 보내 주세요." 안내 문구를 함께 표시한다. 답변은 하단의 일반 메시지 입력창으로 받아 LLM 이 이어서 진행한다 (입력창 이중 노출을 피하기 위한 결정).
- **Active plan context (세션 장기 컨텍스트).** 활성 plan 은 매 턴 서버가 history 에서 derive 해 §8 시스템 프롬프트의 `## Active plan context` 섹션으로 주입한다. 사용자의 원 요청, 승인 여부, step 체크박스, 미답변 질문 목록이 포함되어 LLM 이 중간 턴에서도 plan 을 잊지 않고 이어간다. 상태는 세 가지:
  - `active` — plan 이 진행 중 (step 미완 또는 openQuestions 미답변). 프롬프트에 상세 노출되고 `finish` guard 가 발동한다.
  - `cleared` — `clear_plan` 이 호출되어 해제됨. 다음 턴부터 프롬프트·guard 에서 제외.
  - `completed` — 모든 actionable step done + openQuestions 비움. 짧은 완료 요약 한 줄만 프롬프트에 유지해 후속 대화의 맥락 신호를 제공하고 guard 는 발동하지 않는다.

### 2.3 승인 메커니즘

| 트리거 | 동작 |
|--------|------|
| 카드 하단 **[Approve & execute]** 버튼 | "계획대로 진행해 주세요" 사용자 메시지가 자동 전송되어 다음 턴에서 ③로 진입 |
| 자연어 승인 (예: "좋아", "진행해줘", "그대로 해줘") | LLM이 프롬프트 지침에 따라 바로 ③로 진입 |
| 거부/수정 요청 | 질문/새 정보 반영 후 다시 ②로 돌아감 |

**plan-only turn 강제.** `propose_plan` 이 호출된 턴은 반드시 **plan 발행으로만 끝나야** 한다. 같은 턴에 edit tool 을 호출하면 서버가 `PLAN_AWAITING_APPROVAL` 로 거부(§4.4) 하므로, LLM 은 `propose_plan` 직후 별도 prose 없이 바로 `finish` 를 호출해 턴을 종료한다 — plan card 의 "계획대로 진행" 버튼과 클라이언트가 자동 주입하는 `systemHint: planApproveConfirm`("계획대로 진행해 주세요.") 안내가 사용자 액션을 충분히 유도하므로 추가 한국어 메시지는 노이즈로 작동한다. 사용자의 approve 메시지가 시작하는 다음 턴에서 실제 edit 이 실행된다. 이 강제는 "계획 제시 → 사용자 승인 → 실행" 3단계 UX 가 깨지지 않도록 보장한다. 단 `openQuestions` 가 포함된 plan 은 별도로 plan card 안에 답변 입력 안내를 노출하므로, LLM 은 그 경우 한국어 prose 로 질문을 다시 묻고 `finish` 를 호출하지 않은 채 턴을 끝낸다.

---

## 3. UI 상세

### 3.1 패널 위치·크기

| 항목 | 값 |
|------|-----|
| 위치 | 에디터 우측 (Node Settings Panel과 동일 슬롯) |
| 너비 | 360px 고정 |
| 노출 조건 | 툴바의 AI Assistant 버튼을 눌러 토글 |
| Node Settings Panel과의 관계 | **상호 배타** — Assistant 오픈 시 Node Settings는 자동 닫힘. Node 클릭 등으로 Settings 필요 시 Assistant 닫힘. 사용자가 Settings 유지한 채 Assistant를 연 경우 Settings 닫힘을 애니메이션으로 안내 |

### 3.2 패널 구성 요소

```
┌──────────────────────────────────────────┐
│  AI Assistant                         ✕  │  ← 헤더
│  ──────────────────────────────────────  │
│  Model: [GPT-4o (OpenAI)     ▼]  [⟳]     │  ← LLM Config 선택 + 새 세션
│  ──────────────────────────────────────  │
│                                          │
│  [assistant] 주문 취소 프로세스에 대해   │
│  몇 가지 확인할게요.                     │  ← 메시지 리스트
│                                          │
│  🔍 list_integrations() → 3 entries      │  ← 탐색 배지
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Plan: 주문 취소 플로우              │  │
│  │ ----------------------------------- │  │
│  │ 1. [ ] HTTP 노드 추가 — 주문 조회   │  │
│  │ 2. [ ] If/Else — 취소 가능 시간     │  │
│  │ 3. [ ] Send Email — 취소 확인       │  │
│  │                                     │  │
│  │       [ Approve & execute ]         │  │
│  └────────────────────────────────────┘  │  ← Plan Card
│                                          │
│  [user] 좋습니다, 진행해 주세요.         │
│  ✔ add_node HTTP Request                 │  ← 편집 배지
│  ✔ add_node If/Else                      │
│  ✔ add_edge Manual → HTTP                │
│                                          │
│  ──────────────────────────────────────  │
│  ┌────────────────────────────────────┐  │
│  │ 요청을 입력하세요...                │  │  ← 입력창
│  └────────────────────────────────────┘  │
│  Enter: 전송 · Shift+Enter: 줄바꿈       │
│  [ Stop ] (스트리밍 중에만 노출)          │
└──────────────────────────────────────────┘
```

| 요소 | 설명 |
|------|------|
| 헤더 | 제목 + 닫기(✕). 닫아도 세션은 서버에 보존 |
| 모델 선택 | LLM Config selector. `기본 Provider` 선택 가능. 값이 비면 워크스페이스의 default config 사용 |
| 새 세션(⟳) | 새 세션 생성 확인 다이얼로그 표시 후 현재 대화 비움. 기존 세션은 히스토리에 보존 |
| 메시지 리스트 | 사용자/어시스턴트/툴 호출 배지/Plan 카드/에러가 시간순으로 누적. 스트리밍 중 "말풍선 회색 커서" 애니메이션. 새 이벤트(text delta, tool_call 배지, plan 카드, plan step 체크 진행) 가 들어올 때마다 리스트가 자동으로 하단으로 스크롤된다. 일부 모델이 assistant text 채널에 OpenAI harmony 제어 토큰(`<\|channel\|>...<\|message\|>{...}`) 을 leak 할 수 있는데, UI 가 렌더 직전에 `sanitizeAssistantText` 로 필터링하며 sanitize 결과가 비면 해당 bubble 자체를 숨긴다. 사용자에게는 제어 토큰·원시 JSON 이 노출되지 않는다 |
| 탐색 배지 (🔍 회색) | `list_workflows`·`list_integrations` 등 Clarify 도구 호출. 요약 한 줄 + 접기/펼치기로 전체 결과 확인 |
| 편집 배지 (✔ 녹색) | `add_node`·`update_node` 등 성공. 인자 요약과 연결된 노드 label 표시. **연속으로 동일한 signature** 의 호출은 `× N` 접미사가 붙은 단일 배지로 축약된다 — signature 기준은 `update_node` 의 patch 필드 집합, `add_node` 의 노드 타입, 그 외엔 tool name 만. 실패(`ok:false`) 호출은 signature 에 `:err` 를 더해 성공 그룹과 분리 렌더되어 에러 상태가 묻히지 않는다 |
| **재시도 후 성공 축약** (✔ `retried`) | `add_edge` 실패가 `PORT_NOT_FOUND` 또는 `NODE_NOT_FOUND` 에러코드를 가지고, 같은 `source_id`/`target_id` 조합의 성공 배지가 **곧바로** 따라오면 두 배지를 하나의 "재시도 후 성공" 배지로 축약 렌더한다. 렌더 라벨은 성공한 호출 기준 + `retried` 꼬리표이며, 툴팁/hover 에 원본 실패 이유와 성공 시의 port 값을 함께 노출해 디버깅 정보를 보존한다. i18n `assistant.toolCallBadgeRetryRecovered`. **이 축약은 `PORT_NOT_FOUND` / `NODE_NOT_FOUND` 두 코드에 한정**된다 (두 코드는 서버가 `knownPorts` / cascading 실패 FIFO 로 "다음 라운드 자연 복구" 를 설계한 경로). `LABEL_CONFLICT`·`CYCLE_DETECTED` 등 다른 shadow 에러는 기존처럼 빨간 배지 유지 — 사용자·디버거에게 명시적으로 보여야 유용하다 |
| 에러 배지 (⚠ 빨강) | 편집 도구 실패. shadow 검증 실패 사유 표시 |
| **에러 bubble** | `event: error` (예: `ASSISTANT_TOO_MANY_TOOL_CALLS`, `ASSISTANT_STREAM_FAILED`) 를 토스트가 아닌 해당 assistant 메시지 버블 아래 빨간 박스로 렌더한다. 채팅 맥락에서 "왜 중단됐는지" 와 복구 방법(code + message) 이 그대로 보이므로 사용자가 다음 액션을 바로 선택할 수 있다 |
| **Stalled turn hint** | assistant 가 텍스트 출력 없이(= content 공백) 정상 종료(`done`) 되었고 **실행 중 plan**(버튼 승인 또는 자연어 승인으로 step 이 1개 이상 done) 에 실행 가능한 pending step 이 남아있으면, 프론트가 해당 메시지에 `systemHint.kind = 'info'` 로 "이어서 진행해줘 라고 답해 주시면 남은 단계를 계속 실행할게요." 를 자동 주입해 **amber info 박스** 로 렌더한다. 다만 서버 가드(§10) 가 진척 여부를 추적해 plan 이 끝날 때까지 finish 를 끈질기게 거부하므로 이 힌트는 LLM 이 정말 stuck 되었거나 budget 이 소진되었을 때만 노출된다 |
| **Plan approval hint** | 이번 턴이 **plan-only 턴**(`propose_plan` 만 호출, edit 없음, prose 없음, plan 미승인, `openQuestions` 도 없음) 으로 끝나면 프론트가 `systemHint.kind = 'info'` 로 "계획대로 진행해 주세요." (`assistant.planApproveConfirm`) 를 자동 주입한다. plan card 의 "계획대로 진행" 버튼과 안내 hint 가 함께 보여 사용자가 승인 액션을 즉시 인지한다. LLM 이 어떤 prose 라도 emit 했거나 `openQuestions` 가 있어 plan card 가 답변 입력 안내를 이미 노출 중인 경우엔 중복을 피해 hint 를 띄우지 않는다 |
| **Turn completion hint** | 이번 턴 종료 시점에 활성 plan 의 `note` 를 제외한 모든 step 이 `done` 이고 `openQuestions` 도 비어있으면, `systemHint.kind = 'success'` 로 "작업을 완료했어요 — N개 단계 실행 성공." 을 주입해 **emerald success 박스**(체크 아이콘) 로 렌더한다. 사용자가 작업 종료를 즉시 인지하도록 하며, 에러가 발생한 경우 error bubble 이 우선되어 success hint 는 띄우지 않는다 (우선순위: error > stalled > planApprove > completed) |
| **Auto-resume divider** | 서버가 stall 자동 복구(§10)로 다음 라운드를 시작할 때, assistant 메시지 row 가 **분리**되어 새 버블이 생긴다. 분리 경계에는 `assistant.autoResumedHint` i18n 문구로 "🔄 자동으로 이어서 진행했어요" divider 를 렌더한다. `attempt` 번호를 함께 표시해 복구 시도 순번(1/2, 2/2 등)을 사용자에게 알린다. 이 구조 덕분에 gpt-oss-120b 가 stall 전·후 라운드에서 같은 confirmation 문구를 반복해도 **서로 다른 버블**에 들어가 시각적으로 분산된다 |
| **Candidate picker** | `add_node` / `update_node` 결과로 `pendingUserConfig` 가 딸려 오고 그 안에 `candidates` 가 1개 이상이면, 해당 edit 버블(편집 배지 영역 바로 아래) 에 드롭다운 picker 를 렌더한다. 사용자가 드롭다운에서 항목을 고르고 **Confirm** 버튼을 누르면 `editor-store.updateNode` 로 즉시 반영되고 picker 는 "✓ {label}: {selected} 로 설정됨" 읽기 전용 표기로 전환. Assistant 는 LLM 을 다시 호출하지 않는다 — 프런트 단독 적용이며 캔버스 자동 저장·Undo 스택에 기본 편입. 반대로 `candidates` 가 0 이면 picker 대신 amber 안내 박스 ("해당 종류 Integration 이 없어요. Settings 에서 먼저 등록해 주세요." + 설정 화면 딥링크) 를 렌더. rehydrate 시에는 해당 노드의 현재 canvas 값이 이미 채워져 있으면 "✓ 설정됨" 상태로, 비어있으면 picker 를 다시 보여준다 |
| Plan 카드 | §2.2 참조 |
| 입력창 | 1줄 기본, 최대 6줄까지 자동 확장. Stop 버튼은 스트리밍 중에만 노출 |

### 3.3 접근성

| 항목 | 값 |
|------|-----|
| 패널 root | `role="complementary"` + `aria-label="AI Assistant"` |
| 메시지 리스트 | `role="log"` + `aria-live="polite"` — 스트림 텍스트는 delta 단위로 읽어주지 않고 메시지 완결 시점에만 공지 |
| 입력창 | `aria-label="Assistant에게 요청 입력"` |
| Plan 카드 | 체크박스는 `role="checkbox" aria-checked` + `aria-disabled=true` (사용자 조작 불가, 진행도 표시 전용) |
| Candidate picker | 컨테이너에 `role="group"` + `aria-label="{field.label} 선택"`. 드롭다운은 네이티브 `<select>` 를 사용하거나 동등한 `role="listbox"` 구성 — 키보드 조작(↑/↓/Enter)이 가능해야 한다. Confirm 버튼은 `aria-disabled` 를 후보 선택 여부에 따라 토글. 선택 확정 이후에는 picker 영역이 `role="status"` 로 전환되어 "✓ 설정됨" 을 공지 |
| 키보드 | `Ctrl+/` 로 패널 토글 (단축키 충돌 없는 경우만 활성, §3.5) |

### 3.4 빈 상태(Empty State)

처음 Assistant를 열었을 때 혹은 새 세션을 시작했을 때:

| 요소 | 내용 |
|------|------|
| 제목 | "무엇을 도와드릴까요?" |
| 부연 | "자연어로 원하는 워크플로우를 설명하면 함께 만들어드려요." |
| 예시 칩 | 클릭 시 입력창에 자동 삽입: "주문 취소 프로세스 추가해줘", "HTTP 노드에 Authorization 헤더 추가", "현재 워크플로우를 검토하고 개선점 제안해줘" |

### 3.5 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `Ctrl+/` | Assistant 패널 토글 |
| `Enter` (입력창) | 메시지 전송 |
| `Shift+Enter` (입력창) | 줄바꿈 |
| `Esc` (입력창 포커스) | 입력창 내용 비우고 포커스 해제 |
| `Ctrl+Z` (캔버스 포커스) | 기존 Undo — Assistant 변경도 역순으로 되돌림 |

---

## 4. 도구(Tools) 정의

LLM에 전달되는 function-calling 도구 목록이다. 인자/반환은 JSON Schema로 백엔드가 생성해 `ChatParams.tools`로 전달한다.

### 4.1 탐색 도구 (Clarify, read-only)

| 도구 | 인자 | 반환 | 용도 |
|------|------|------|------|
| `get_node_schema` | `type: string` | `{configSchema, ports, description, category}` | 특정 노드 타입의 상세 스키마. 카탈로그 요약만으로 부족할 때 on-demand 조회 |
| `list_integrations` | `{category?: string}` | `[{id, name, type, category}]` | 현재 워크스페이스에 등록된 Integration 목록 |
| `list_workflows` | `{limit?: number, search?: string}` | `[{id, name, description, tags, updatedAt}]` | 같은 워크스페이스의 워크플로우 목록 (현재 편집 중인 워크플로우 제외 옵션 포함) |
| `get_workflow` | `{id: UUID, mode?: 'summary'\|'full'}` | `{name, nodes, edges, summary}` | **다른** 워크플로우 구조 참조 (예: "주문 생성" 워크플로우 구조를 읽고 "주문 취소" 설계). 현재 편집 중인 워크플로우는 이 도구로 조회하지 않는다 |
| `get_current_workflow` | 없음 | `{ok, nodes, edges}` (config는 redact 적용) | **현재** 편집 중인 캔버스의 최신 nodes/edges. 같은 턴 내 편집 이후 결과를 재확인하거나 시스템 프롬프트 스냅샷의 신선도가 불확실할 때 호출 |
| `list_knowledge_bases` | 없음 | `[{id, name, documentCount}]` | RAG 노드 설계 시 참고 |
| `get_workflow_executions` | `{limit?: number, status?: 'pending'\|'running'\|'completed'\|'failed'\|'cancelled'\|'waiting_for_input'}` | `{ok, workflowId, workflowName, items: [{id, status, startedAt, finishedAt, durationMs, triggerId, nodeStats: {total, completed, failed}}]}` | 현재 세션 워크플로의 최근 실행 목록. 시작 시간 내림차순. 기본 `limit=10`, 상한 50. 사용자가 "최근 실행이 왜 실패했어?" 같이 직전 실행을 특정하지 않고 질문했을 때 후보를 좁히는 용도. `triggerId` 는 manual 실행일 때 `null` |
| `get_execution_details` | `{id: UUID}` | `{ok, execution, timeline, subExecutions}` — 상세는 §4.1.1 | 특정 실행의 전체 타임라인(노드별 status/입출력/에러) 조회. 어시스턴트가 실패 원인을 식별하고 노드 수정 계획을 세우는 데 사용. 1-level sub-workflow 자식 실행까지 같은 응답에 포함 |

> 탐색 도구는 모두 세션의 `workspace_id` 스코프 내에서만 조회한다. 워크스페이스 경계를 넘는 데이터는 반환하지 않는다.
>
> **현재 워크플로우 조회는 2-tier 구조다.** ① 매 턴 시작 시의 스냅샷이 시스템 프롬프트(§8)에 JSON으로 주입되어 있으므로, "현재 캔버스에 무엇이 있나?" 류의 단순 조회는 도구 호출 없이 프롬프트를 직접 읽어 답한다. ② 편집 도구를 호출한 뒤 결과 상태를 재확인해야 할 때만 `get_current_workflow`를 호출한다.
>
> **실행 조회는 `session.workflow_id` 에 스코프된다.** `get_workflow_executions` 는 명시적으로 `workflowId` 를 인자로 받지 않으며 — 세션의 현재 워크플로 실행만 돌려준다. `get_execution_details` 는 실행 id 를 받지만, 해당 id 가 (a) 현재 워크플로의 실행이거나 (b) 그 실행 트리의 직계 자식 실행(부모 실행의 `workflow` 노드에서 호출된 sub-workflow 의 자식 `Execution`) 중 하나여야 하며, 두 조건 모두에 해당하지 않으면 `EXECUTION_NOT_IN_SCOPE` 로 거부된다. 다른 워크플로의 독립 실행을 조회하려면 사용자가 해당 워크플로의 에디터·Assistant 로 이동해야 한다.

#### 4.1.1 `get_execution_details` 응답 구조

```typescript
interface ExecutionDetailsResponse {
  ok: true;
  execution: {
    id: UUID;
    workflowId: UUID;
    workflowName: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_for_input';
    startedAt: string;            // ISO 8601
    finishedAt: string | null;    // null while running/waiting_for_input
    durationMs: number | null;
    inputData: unknown;           // masked, see below
    outputData: unknown | null;   // masked
    error: unknown | null;        // masked
    parentExecutionId: UUID | null;    // 현재 실행이 다른 실행의 sub-workflow 로 호출됐다면 그 부모 id
    recursionDepth: number;       // 최상위 = 0
  };
  timeline: Array<{
    nodeExecutionId: UUID;
    nodeId: UUID;
    nodeLabel: string;
    nodeType: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_for_input';
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    inputData: unknown;           // masked
    outputData: unknown | null;   // masked
    error: unknown | null;        // masked
    retryCount: number;
    parentNodeExecutionId: UUID | null;   // 인라인 sub-workflow / 컨테이너 그룹핑
  }>;
  subExecutions: Array<{          // 이 실행 트리의 직계 자식 실행 (depth 1). 2 단계 이상은 각 자식 execution id 로 별도 호출.
    execution: /* 위 execution 과 동일 필드 */;
    timeline: /* 위 timeline 과 동일 구조 */;
  }>;
  subExecutionsTruncatedDepth?: number;   // 자식 실행 내부에도 추가 sub-workflow 가 있으면 이 필드로 "depth N 이후 생략됨" 신호
  timelineTruncated?: true;               // 본 실행의 timeline 이 row cap(500) 을 초과해 앞 500 개만 담겼음. `subExecutions[*].timelineTruncated` 도 동일 의미로 자식별 개별 발행
}
```

**마스킹 규칙.** `inputData` · `outputData` · `error` 필드는 서버가 `maskSensitiveFields` 공통 유틸을 재귀 적용해 반환한다. 매칭 키(대소문자 무시): `apiKey`, `api_key`, `password`, `token`, `accessToken`, `refreshToken`, `secret`, `clientSecret`, `authorization`. 매칭된 값이 문자열이면 `"****<last4>"` 로, 그 외 타입이면 `"****"` 로 치환. 객체/배열은 재귀 순회. 원본은 DB 에 그대로 남고 read 시점에만 변환한다.

**페이로드 크기 정책.** 개별 필드(`inputData`/`outputData`/`error`)에는 크기 cap 을 두지 않는다 — 2-step 패턴으로 어시스턴트가 폭주를 자연스럽게 회피하도록 유도한다(§8 시스템 프롬프트). 반면 **timeline 행 수**는 루프 노드가 수천 번 회전한 실행을 직렬화하다 컨텍스트를 터뜨리지 않도록 **실행 한 건당 500 행 상한**을 적용한다 — 넘치면 응답의 `timelineTruncated: true` 플래그로 신호하고, 앞 500 행만 담는다(자식 실행 timeline 도 각각 동일 상한). 사용자에게 "앞쪽 500 단계까지만 본 상태" 라고 명확히 알릴 때 이 플래그를 써라. 한 턴에 대량 페이로드를 세 개 이상 조회하면 `ASSISTANT_TOO_MANY_TOOL_CALLS` budget(§10) 에 근접할 수 있다.

**Running 실행 응답은 스냅샷.** `status: 'running' / 'waiting_for_input'` 실행을 조회하면 엔진은 응답 직렬화 시점의 부분 상태를 돌려준다. 서비스가 timeline / 자식 실행 / 2-depth 존재 여부를 병렬 쿼리로 집계하므로 개별 쿼리 사이에 상태 전이가 발생하면 세 결과 사이의 시점이 수 밀리초 어긋날 수 있다. 동일 실행 id 를 연속으로 다시 조회하면 이 불일치는 해소된다 — LLM 도 "조회 시점 스냅샷" 이라는 인식하에 사용자에게 결과를 보고한다.

**실행 상태별 동작.**

| execution.status | 동작 |
|------------------|------|
| `completed` / `failed` / `cancelled` | 완결된 timeline 반환 |
| `running` / `waiting_for_input` | 현재까지 기록된 부분 timeline 을 그대로 반환. 아직 실행 안 된 노드는 생략, 진행 중인 노드는 `status: 'running'`/`waiting_for_input` 으로 표시. 응답의 `execution.finishedAt` · `durationMs` 는 `null`. §12.2 의 "실행 중 편집 도구 거부" 는 **read 도구에는 적용되지 않는다** — Assistant 는 실행 중인 워크플로에 대해서도 진단 목적의 조회를 수행할 수 있다 |
| `pending` | 아직 첫 노드도 시작되지 않은 경우 — timeline 은 빈 배열, execution 필드만 채워 반환 |

**에러 코드.**

| 코드 | 상황 |
|------|------|
| `EXECUTION_NOT_FOUND` | id 가 존재하지 않거나 workspace 경계 밖 |
| `EXECUTION_NOT_IN_SCOPE` | id 는 존재하지만 현재 세션 워크플로의 실행도, 그 직계 자식 실행도 아님 |

#### 4.1.2 Re-run 비트리거 정책

§4.1 의 두 read-only 실행 조회 도구는 **실행을 다시 트리거하지 않는다**. Assistant 가 호출할 수 있는 Re-run 도구 (`re_run_execution` 등) 는 본 spec 에 정의되지 않으며, [Spec Re-run §RR-PL-07](../5-system/13-replay-rerun.md#rr-pl-07--ai-assistant-비트리거-g1) 에서 명시적으로 차단된다.

사용자가 Assistant 에게 "이 실행을 다시 돌려줘", "같은 입력으로 한 번 더" 같이 Re-run 의도를 표현하면 Assistant 는 다음 패턴으로 응답한다:

1. `get_execution_details` 로 원본 실행 정보를 조회해 사용자에게 요약 제시 (status / 노드 통계 / 실패 원인 등)
2. "Re-run 은 외부 부수효과 정책 (RR-PL-01) 에 따라 사용자가 실행 상세 페이지에서 직접 트리거해야 합니다 — `[⟳ Re-run]` 버튼 ([Spec 실행 내역 §3.7](../2-navigation/14-execution-history.md#37-re-run-액션)) 을 사용하세요" 안내
3. 실행 상세 페이지로의 deep link 제공 — `/workflows/:workflowId/executions/:executionId`

i18n 안내 키는 [Spec Re-run §10.4 i18n 키](../5-system/13-replay-rerun.md#104-i18n-키) 의 `history.rerun.assistantBlocked` 참조.

향후 Trust 단계 (사용자가 명시적으로 "AI 에게 Re-run 권한 부여" 토글) 도입 후 G2 옵션이 별도 plan 에서 검토될 수 있으나 본 spec 의 범위 밖이다.

### 4.2 계획 도구 (Plan, no-op on canvas)

| 도구 | 인자 | 반환 | 용도 |
|------|------|------|------|
| `propose_plan` | `{title: string, summary: string, steps: Step[], openQuestions?: string[]}` | `{ok: true, planId: UUID}` | 사용자에게 실행 계획을 카드 형태로 제시. 이미 활성 plan 이 있을 때 호출하면 활성 plan 이 **새 plan 으로 교체**된다 (화제 전환이 아니라 계획 수정 시의 정상 경로) |
| `clear_plan` | `{reason?: string}` | `{ok: true, cleared: true}` | 활성 plan 을 세션 전반 컨텍스트에서 제거. 화제가 완전히 전환된 경우에만 호출 (사용자가 전혀 다른 작업을 요청, plan 을 포기했다고 명시 등). 호출 이후 §8 의 "Active plan context" 섹션이 프롬프트에서 사라지고 `finish` guard 는 더 이상 해당 plan 기반으로 동작하지 않는다 |

```typescript
interface Step {
  id: string;            // LLM이 임의 생성. 후속 편집 도구의 planStepId와 매칭
  action: 'add_node' | 'update_node' | 'remove_node' | 'add_edge' | 'remove_edge' | 'note';
  description: string;   // 사용자 친화적 설명 (i18n 대응)
  rationale?: string;    // 왜 필요한지 (선택)
}
```

### 4.3 편집 도구 (Execute, shadow + frontend)

모든 편집 도구는 백엔드의 `ShadowWorkflow`에서 검증 후 성공 시 SSE 이벤트로 프론트에 전달된다. 모든 편집 도구는 `planStepId?: string` (단일, legacy) 와 `planStepIds?: string[]` (다중, 권장) 을 **선택 필드**로 공통 지원한다. 둘 다 지정된 경우 union 으로 집계되어 해당 step 들이 모두 ✓ 처리된다. 한 번의 tool-call 이 여러 step 을 cover 할 때는 배열을 사용하라 (예: `add_node` 의 config 에 버튼을 함께 넣어 `update_node` step 까지 해결한 경우 `planStepIds: ["s1","s3"]`).

| 도구 | 인자 | 반환 |
|------|------|------|
| `add_node` | `{type, label, position: {x, y}, config, planStepId?, planStepIds?}` | `{ok, id?, ports?, error?, pendingUserConfig?}` — `ports` 는 §4.3.2, `pendingUserConfig` 는 §4.3.1 |
| `update_node` | `{id, patch: {label?, config?, position?}, planStepId?, planStepIds?}` | `{ok, ports?, error?, pendingUserConfig?}` — `ports` 는 §4.3.2, `pendingUserConfig` 는 §4.3.1 |
| `remove_node` | `{id, planStepId?, planStepIds?}` | `{ok, removedEdgeIds?, error?}` |
| `add_edge` | `{sourceId, sourcePort?, targetId, targetPort?, type?, planStepId?, planStepIds?}` | `{ok, id?, error?}` |
| `remove_edge` | `{id, planStepId?, planStepIds?}` | `{ok, error?}` |
| `finish` | `{summary?: string}` | 성공: 루프 종료(`finishReason: 'stop'`) · 실패: `{ok: false, error: 'PLAN_NOT_COMPLETE', pendingSteps, openQuestions}` (루프 지속) | 대화 루프 종료 시그널. 활성 plan(이번 턴의 `propose_plan` 또는 히스토리 최근 plan)에 `note` 를 제외한 pending step 이 남아있거나 `openQuestions` 가 비어있지 않으면 서버가 실패를 반환해 LLM 이 한 번 더 작업하도록 유도한다. **block 이후에도 LLM 이 추가 진척(edit/plan tool 성공)을 만들었다면 가드가 다시 발동**해 plan 이 완전히 끝날 때까지 끌고 간다. 두 번째 finish 시도가 아무 진척 없이 곧장 들어오면 LLM 이 진짜 stuck 으로 판단해 안전 탈출(`finishReason: 'stop'`)을 허용한다 — `toolCallsBudget` 이 절대 상한. **Plan-only 턴 fast-path**: 이번 턴에 새로 propose 된 미승인 plan 이 있으면 (PLAN_AWAITING_APPROVAL 가 별도로 edit 들을 모두 거부하므로) 가드를 즉시 비활성화해 finish 가 한 라운드 안에 통과되도록 한다 — 사용자 approve 전에 LLM 이 edit/finish 핑퐁 루프에 빠지지 않게 하는 핵심 보호. 또한 **이번 턴의 모든 edit 이 `ok:false` 로 실패한 경우** 도 "실행 발생 없음" 으로 간주해 가드 비활성. `planForTurn` 이 없고 현재 턴 편집이 히스토리 plan 의 step 과 매칭되지 않는 단발성 편집은 guard 를 발동시키지 않는다. **같은 턴에서 `clear_plan` 이 먼저 호출된 경우 guard 는 발동하지 않는다** (화제 전환으로 간주) |

#### 4.3.1 `pendingUserConfig` 구조 (candidate picker)

`add_node` · `update_node` 성공 응답에 한해 서버가 노드의 zod `configSchema` 를 훑어 **"사용자가 직접 선택해야 하는 selector 필드"** 중 아직 값이 비어 있는 항목을 모아 `pendingUserConfig: PendingUserConfigField[]` 로 싣는다. 비어 있지 않거나 대상 widget 이 없으면 필드 자체를 생략한다.

```typescript
interface PendingUserConfigField {
  /** config 내 경로 (예: 'integrationId', 'llmConfigId'). */
  field: string;
  /** 스키마 meta 의 ui.label (i18n 된 최종 텍스트가 아닌 raw key/label). */
  label: string;
  widget:
    | 'integration-selector'
    | 'llm-config-selector'
    | 'kb-selector'
    | 'workflow-selector';
  /**
   * 서버가 워크스페이스 범위에서 조회한 후보 목록. 상한 20개.
   * 해당 종류 항목이 아예 없으면 빈 배열(`[]`)로 내려온다 — 빈 배열도
   * "조회했지만 후보가 없음" 의 명시적 신호라 `undefined` 와 구분된다.
   */
  candidates: CandidateEntry[];
}

interface CandidateEntry {
  /** 실제 id (integration.id · llm_config.id · knowledge_base.id · workflow.id). */
  id: string;
  /** 드롭다운에 표시할 주 텍스트. */
  label: string;
  /** 보조 텍스트 (예: serviceType='smtp', model='gpt-4o'). 없을 수 있음. */
  sublabel?: string;
}
```

**widget 별 후보 조회 범위**:

| widget | 조회 | 필터 |
|--------|------|------|
| `integration-selector` | `Integration` | `workspace_id` 일치 + `status='connected'`. 노드 스키마 meta 에 `integrationServiceType` 힌트가 있으면 해당 `service_type` 만, 없으면 전체 connected integration. |
| `llm-config-selector` | `LlmConfig` | `workspace_id` 일치. 최근 업데이트 순. |
| `kb-selector` | `KnowledgeBase` | `workspace_id` 일치. 이름 오름차순. |
| `workflow-selector` | `Workflow` | 같은 `workspace_id` **&&** `id != session.workflow_id` (현재 편집 중 워크플로 제외). 최근 업데이트 순. |

**상한: widget 당 20개.** 초과 분은 응답에서 잘라내며, 프런트는 picker 에 "Settings 에서 더 많은 후보 보기" 링크를 덧붙인다.

**프런트 동작**:

- `candidates.length >= 1` — 해당 edit 버블 아래에 드롭다운 picker + Confirm 버튼 렌더 (`assistant.candidatePickerTitle` / `assistant.candidatePickerConfirm`). Confirm 시 `editor-store.updateNode(nodeId, { config: { [field]: selectedId } })` 로 즉시 반영. 이후 picker 는 `assistant.candidatePickerSelected` 문구의 읽기 전용 상태로 전환.
- `candidates.length === 0` — picker 대신 amber 안내 박스 (`assistant.candidatePickerEmpty`) + 해당 종류 리소스의 등록 화면 딥링크.
- **후보 1개인 경우에도 자동 주입 금지.** 단일 option 드롭다운으로 렌더하되 사용자가 Confirm 을 눌러야 반영된다. 요구사항 ED-AI-39 의 "명시적 확인" 원칙.
- **Rehydrate (세션 재로드)**: 각 assistant row 의 `tool_calls[*].result.pendingUserConfig` 를 훑고, 대상 노드의 현재 canvas 값(`field`) 이 이미 채워져 있으면 picker 를 "✓ 설정됨" 상태로, 비어있으면 다시 interactive picker 로 렌더한다.

**LLM 과의 계약**: LLM 은 `pendingUserConfig` 에 대해 별도 행동을 취하지 않는다 — 응답에 포함되더라도 다음 LLM 라운드로 tool_result 가 feedback 되지 않는다 (프런트 UI 전용). 시스템 프롬프트의 규칙 ("id 를 추측하지 말 것", §8) 을 유지하며, 사용자 선택은 LLM 경유 없이 `editor-store` 로 직행한다.

#### 4.3.2 `ports` 구조 (runtime port hint)

`add_node` · `update_node` 성공 응답에는 해당 노드의 **런타임 포트 목록**이 딸려 온다. dynamic-ports 노드(carousel 버튼, switch 케이스, ai_agent conditions 등)의 경우 현재 `config` 기반으로 resolver 가 뽑아낸 실제 port id 까지 포함되므로, LLM 은 별도 `get_node_schema` 라운드 없이 바로 다음 `add_edge` 에 `source_port` / `target_port` 를 채울 수 있다. 결과적으로 "잘못된 port 로 먼저 쏘고 PORT_NOT_FOUND 로 한 라운드 더" 패턴이 구조적으로 제거된다 (ED-AI-40).

```typescript
interface RuntimePorts {
  outputs: RuntimePortDescriptor[];
  inputs: RuntimePortDescriptor[];
}

interface RuntimePortDescriptor {
  /** add_edge 의 source_port / target_port 에 그대로 사용할 port id. */
  id: string;
  /**
   * 'data' (기본) / 'error'. add_edge 의 `type` 결정 힌트:
   *   - 'data' → `type: 'data'` (정상 흐름)
   *   - 'error' → `type: 'error'` (오류 분기)
   * 생략되면 'data' 로 간주.
   */
  type?: 'data' | 'error';
  /**
   * dynamic-ports 노드의 사용자 설정 label (예: carousel 버튼의 "한식" / "양식").
   * LLM 이 port 식별에 쓰는 것은 `id` 이지만, 배지·툴팁 등 UI 표시 맥락에서
   * 재사용할 수 있도록 함께 싣는다. static port 는 대체로 이 필드를 채우지
   * 않는다.
   */
  label?: string;
}
```

**조립 규칙**:

| 종류 | outputs | inputs |
|------|---------|--------|
| static 노드 | `NodeComponentRegistry` 의 `ports.outputs` id 목록 | 동일하게 `ports.inputs` |
| dynamic-ports 노드 | `resolveEffectiveOutputPorts(config, def)` 결과 — 사용자가 입력한 `cases[*].id` / `buttons[*].id` 가 유효하면 그대로, 누락이면 `case_0` / `btn_0` 같은 index fallback id 가 발행된다 | 기본 `in` (inputs 은 static) |

**상한**: 단일 응답에서 한 쪽(`outputs` 또는 `inputs`) 최대 50개. dynamic 버튼을 극단적으로 많이 넣은 시나리오의 응답 폭주 방지.

**LLM 과의 계약**:
- LLM 은 `add_node` / `update_node` 성공 직후 `result.ports.outputs[*].id` 를 그대로 `add_edge { source_port: ... }` 에 쓴다.
- `type === 'error'` 인 포트에는 `add_edge { type: 'error', ... }` 를 쓴다.
- **`get_node_schema` 는 거의 불필요**해진다. 유일하게 필요한 경우는 "이 턴에 `add_node` / `update_node` 로 직접 수정하지 않은 노드 (예: 기존 워크스페이스 스냅샷만 존재) 에 edge 를 연결할 때" 뿐이다.

### 4.4 Shadow 검증 규칙

| 규칙 | 실패 시 반환 |
|------|--------------|
| `type`이 등록된 노드 타입이어야 함 | `{ok: false, error: 'UNKNOWN_NODE_TYPE'}` |
| `label`은 워크플로우 내 유일해야 함 | `{ok: false, error: 'LABEL_CONFLICT', suggested?: string}` |
| `add_edge` 의 source·target, `update_node`·`remove_node` 의 `id` 가 존재해야 함 | `{ok: false, error: 'NODE_NOT_FOUND', hint?: string}` — hint 규칙은 §4.4.1 |
| Trigger 노드는 컨테이너 child가 될 수 없음 | `{ok: false, error: 'CONTAINER_INVALID_CHILD'}` |
| Manual Trigger 노드는 삭제 불가 | `{ok: false, error: 'MANUAL_TRIGGER_PROTECTED'}` |
| 순환(cycle) 유발 | `{ok: false, error: 'CYCLE_DETECTED'}`. 단, **source 노드의 조상 `containerId` 체인 중 하나와 target 이 일치**하고 **target 포트가 `emit`** 인 경우(=자식 → 자기·조상 컨테이너의 iteration back-edge) 는 정상 반복 제어 흐름으로 간주해 허용한다. 실행 엔진이 containerId 기반으로 컨테이너 내부 그래프를 분리해 처리하는 것과 의미 정합. `emit` 이 아닌 target 포트로 돌아오는 에지(예: `target_port: 'in'`)는 iteration 의도가 아니라 실수·비의도 조작으로 간주해 통상 cycle 판정을 유지 |
| `add_node` / `update_node` 의 최종 config 는 노드별 handler.validate 의 domain rule (버튼 수 상한, static/dynamic 필수 필드, 중복 id 등) 을 통과하는 게 권장되지만 **저장 자체는 차단하지 않는다** | 성공 응답(`ok: true`) 에 `configWarnings?: string[]` 로 handler.validate 의 errors 를 최대 5개 동봉. LLM 은 경고만 받고, 다음 턴에 `update_node` 로 교정하거나 그대로 둘 수 있다. 실행 시점에 execution-engine 이 동일 rule 을 재검출해 최종 차단하므로 의미적 방어선은 유지된다. **저장 차단(hard-reject) 로 두면 LLM 이 같은 실패를 무한 재시도하는 loop 를 유발**하기 때문에 비차단(warning) 으로 설계됨 (2026-04-24 실사용 사례에서 확인된 regression) |
| 같은 턴에 `propose_plan` 호출 이후 edit tool 시도 (plan-only turn 강제) | `{ok: false, error: 'PLAN_AWAITING_APPROVAL', message}` — LLM 은 한국어 메시지로 턴 종료하고 사용자 approve 대기 |

실패 시 LLM은 tool_result를 받아 재시도하거나 사용자에게 상황을 보고한다.

#### 4.4.1 `NODE_NOT_FOUND` hint 규칙

`update_node` / `remove_node` / `add_edge` 가 실패해 `NODE_NOT_FOUND` 를 반환할 때, 복구 가능성이 높은 두 패턴에 대해 서버가 복구 지침을 `hint` 필드로 덧붙인다. 힌트 문자열은 `sanitizeLlmProvidedString` (§ 부록) 으로 LLM 제공 자유 텍스트(label 등) 의 개행·제어 문자·`<>` 를 중화해 프롬프트 인젝션 표면을 좁히고, label-lookalike 계열은 추가로 `[hint] … [/hint]` 고정 마커로 감싸 LLM 이 hint 범위를 자연어 instruction 으로 오인하지 않게 한다.

| 힌트 종류 | 발동 조건 | 대표 문구 |
|-----------|-----------|-----------|
| **Cascading failed-add_node** | `add_edge` 전용. 같은 턴 안에서 `add_node` 가 한 번이라도 실패했던 경우 | `A prior add_node failed in this turn (labels: […]). The UUID you are referencing does not exist because that node was never created. Fix the upstream add_node failures first, then wire the edges.` |
| **Label-lookalike** | `update_node` / `remove_node` 는 항상, `add_edge` 는 cascading 대상 없을 때. 주어진 id 값이 shadow 내 어떤 노드의 `label` 과 정확히 일치하면 그 노드의 UUID 를 hint 에 싣는다 | `[hint] Value "SendEmail" matches the label of an existing node (id: 11111111-…). Tool arguments use UUIDs, not labels — use the id value from a prior add_node result or from currentWorkflow.nodes[*].id. [/hint]` |

**우선순위** (`add_edge` 의 경우): cascading failed-add_node FIFO 가 비어있지 않으면 그 힌트를 우선. FIFO 가 비어있을 때만 label-lookalike 로 fallback — **source 쪽을 먼저** 검사하고 source 가 실제로 missing 이고 label 매치가 있으면 그 힌트를, 아니면 target 쪽을 확인. 두 힌트가 한 응답에 섞이지 않도록 **단일 hint** 만 내려가며, source/target 양쪽이 모두 label 실수인 경우에도 source 힌트 하나만 노출해 LLM 이 우선 source 정정 후 target 재시도하게 유도한다.

**길이·보안 정책**: `value.length > LABEL_HINT_MAX_LEN * 4` 이면 label 후보에서 제외 (터무니없이 긴 값의 Levenshtein-유사 방어). label / value 문자열은 sanitize 후 `JSON.stringify` 로 escape. UUID 자체는 `[0-9a-f-]` 만 포함하므로 추가 escape 없이 그대로 보간. hint 는 기존 `NODE_NOT_FOUND` tool_result 의 optional 필드로만 추가되므로 legacy 소비자 영향 없음.

**경고(warning)** — 성공이지만 UX 힌트가 필요한 경우:

| 규칙 | 반환 |
|------|------|
| 활성 plan 이 있는데 edit 에 `planStepId`/`planStepIds` 누락 | `{ok: true, ..., warning: 'MISSING_PLAN_STEP_ID', warningMessage}` — edit 은 성공했지만 plan 체크박스가 체크되지 않음. LLM 은 이후 edit 호출부터 반드시 step id 를 붙여야 한다 |

---

## 5. SSE 프로토콜 (서버 → 클라이언트)

### 5.1 엔드포인트

| 항목 | 값 |
|------|-----|
| Method | `POST` |
| Path | `/api/v1/workflow-assistant/sessions/{sessionId}/messages` |
| Content-Type | 요청: `application/json` · 응답: `text/event-stream` |
| Auth | JWT (기존 `Authorization: Bearer`) |
| Role | `editor` 이상 |

### 5.2 요청 본문

```typescript
interface AssistantMessageRequest {
  content: string;                 // 사용자 메시지
  currentWorkflow: {               // 현재 에디터 스냅샷 (unsaved 포함)
    nodes: Array<{
      id, type, label, position,
      width?: number,              // React Flow 측정 폭 (px). 초기 렌더 전엔 생략
      height?: number,             // React Flow 측정 높이 (px). 초기 렌더 전엔 생략
      config, containerId?, toolOwnerId?,
    }>;
    edges: Array<{id, sourceNodeId, sourcePort, targetNodeId, targetPort, type}>;
  };
  llmConfigId?: UUID;              // 생략 시 세션 저장값 또는 workspace default
}
```

### 5.3 이벤트 종류

모든 도구 호출(탐색·편집)은 **단일 `event: tool_call` 채널**로 발행되며, 프론트는 `data.kind` 값(`explore` 또는 `edit`)으로 후처리를 분기한다. `propose_plan` 만은 UI 카드 전용이라 별도 `event: plan` 으로 발행된다.

```
event: text
data: {"delta": "안녕하세요..."}

event: tool_call
data: {"id": "call_1", "name": "list_integrations", "arguments": {...}, "result": {...}, "kind": "explore"}

event: tool_call
data: {"id": "call_2", "name": "get_current_workflow", "arguments": {}, "result": {"ok": true, "nodes": [...], "edges": [...]}, "kind": "explore"}

event: plan
data: {"id": "call_3", "planId": "...", "title": "...", "steps": [...]}

event: tool_call
data: {"id": "call_4", "name": "add_node", "arguments": {...}, "result": {"ok": true, "id": "..."}, "kind": "edit", "planStepId": "s1"}

event: auto_resume
data: {"reason": "stall_pending_steps", "attempt": 1, "max": 2}

event: usage
data: {"inputTokens": 1200, "outputTokens": 340, "thinkingTokens": 0, "model": "gpt-4o"}

event: done
data: {"finishReason": "stop"}

event: error
data: {"code": "LLM_RATE_LIMIT", "message": "..."}
```

| 이벤트 | 의미 | 프론트 동작 |
|--------|------|-------------|
| `text` | assistant 텍스트 delta | 현재 assistant 메시지 버블에 append |
| `tool_call` | 모든 도구 호출 결과. `data.kind` 로 후처리 분기 (아래 §5.3.1 참고) | `data.kind` 값에 따라 상이 |
| `plan` | `propose_plan` 결과 | 메시지에 Plan 카드 추가 |
| `auto_resume` | 서버가 **stall 자동 복구**(§10)에 진입했음을 통지. 현재 스트리밍 중인 assistant 버블을 확정·분리하고 **새 assistant 버블**을 시작한다. 같은 턴의 여러 라운드 텍스트가 한 버블에 누적되어 "계속 진행해도 될까요?" 같은 confirmation 문구가 반복 노출되는 UX 문제(특히 gpt-oss-120b)를 구조적으로 제거한다. 새 버블 앞에는 `autoResumedHint` divider 를 렌더 | 현재 버블 `streaming=false` 확정 + 새 assistant 버블 push(`autoResume={reason, attempt}` 메타 포함) + 이후 delta/tool_call 은 새 버블로 |
| `usage` | 토큰 사용량 | (UX 표시는 선택) |
| `done` | 어시스턴트 턴 종료 | 스트리밍 UI 종료, 입력창 활성화 |
| `error` | 실패 | 에러 배지 + 재시도 안내 |

#### 5.3.1 `tool_call.data` 구조

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `string` | LLM 이 생성한 tool_call id. history rehydration 및 plan step 매칭에 사용 |
| `name` | `string` | 도구 이름 (§4.1 / §4.3) |
| `arguments` | `object` | LLM 이 생성한 인자 (파싱 완료된 JSON 객체) |
| `result` | `unknown` | 도구 실행 결과. 편집 도구는 `{ok, id?, ports?, error?, pendingUserConfig?, ...}` — `ports` 는 §4.3.2, `pendingUserConfig` 는 §4.3.1. 탐색 도구는 도구별 응답 shape |
| `kind` | `'explore' \| 'edit'` | 후처리 분기 discriminator |
| `planStepId` | `string?` | `kind='edit'` 일 때 LLM 이 매칭한 plan step id (단일, legacy 단축형) |
| `planStepIds` | `string[]?` | 한 tool-call 이 여러 plan step 을 cover 할 때 사용. 소비자는 `planStepId` 와 `planStepIds` 의 union 으로 완료 처리해야 한다 |

`data.kind` 값별 프론트 동작과 포함 도구:

| `data.kind` | 포함 도구 | 프론트 동작 |
|-------------|-----------|-------------|
| `explore` | `get_node_schema`, `list_integrations`, `list_workflows`, `get_workflow`, `get_current_workflow`, `list_knowledge_bases` | 메시지에 탐색 배지 추가 (§3.2) |
| `edit` | `add_node`, `update_node`, `remove_node`, `add_edge`, `remove_edge` | `editor-store` 에 즉시 반영 + 메시지에 편집 배지 추가. `data.planStepId` 가 있으면 해당 plan step 을 ✓ 처리하고, 없거나 매칭 실패 시 순서상 다음 pending step 을 ✓ 처리 (§2.2) |

> `finish` 와 `clear_plan` 은 서버 내부 상태 변경용으로만 쓰여 SSE 로 발행되지 않는다. 프론트는 `clear_plan` 호출 직후 즉시 Plan 카드를 제거하지 않고, 다음 턴 스트림에서 plan 관련 이벤트가 오지 않는 것으로 자연스럽게 "해제됨" 상태를 인지한다. `propose_plan` 은 `tool_call` 이 아닌 전용 `event: plan` 으로 발행된다.

#### 5.3.2 `auto_resume.data` 구조

| 필드 | 타입 | 설명 |
|------|------|------|
| `reason` | `'stall_pending_steps'` | 발동 사유. 현재는 "active plan 에 pending actionable step 이 남았는데 LLM 이 tool call 없이 `finishReason: 'stop'` 으로 종료" 한 경우 한 종류만 존재. 향후 확장 가능성을 열어 두기 위해 union 형태로 정의 |
| `attempt` | `number` | 이번 턴 내 자동 복구 시도 순번 (1부터 시작). `MAX_STALL_ROUNDS` 까지 증가 후 초과 시 복구를 포기하고 턴 종료 |
| `max` | `number` | 허용되는 최대 시도 횟수 (현재 2). 프론트가 "N/M" 진행도 표기에 사용 |

프론트는 이 이벤트를 수신하는 즉시 **이전 assistant row 를 확정(`streaming: false`)** 하고 **새 assistant row** 를 push 한다. 새 row 에는 `autoResume = {reason, attempt}` 메타가 붙어 divider 렌더링(§3.2 `autoResumedHint`)의 트리거가 된다. 메시지 목록 rehydrate 시에도 `autoResumed=true` row 앞에 동일 divider 가 자동으로 렌더된다 (§6 응답 `autoResumed`/`autoResumeReason`/`autoResumeAttempt` 필드 참고).

### 5.4 클라이언트 → 서버 중단

| 동작 | 처리 |
|------|------|
| 사용자가 Stop 버튼 | 클라이언트가 `AbortController.abort()` — 백엔드는 요청 종료를 감지해 LLM 스트림 중단 및 `done` 이벤트(`finishReason: 'aborted'`)로 flush |
| 브라우저 탭 종료 | 서버 측 LLM 호출은 완료될 수 있으나, 사용량은 usage log에 정상 기록됨 |

---

## 6. REST API (세션/메시지 관리)

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/v1/workflow-assistant/sessions?workflowId={id}` | 특정 워크플로우의 세션 목록 (최근순) |
| `POST` | `/api/v1/workflow-assistant/sessions` | 세션 생성. Body: `{workflowId, llmConfigId?}`. Response: 세션 엔티티 |
| `GET` | `/api/v1/workflow-assistant/sessions/{id}` | 세션 메타데이터 + 메시지 전체 |
| `PATCH` | `/api/v1/workflow-assistant/sessions/{id}` | `{title?, llmConfigId?}` 업데이트 |
| `DELETE` | `/api/v1/workflow-assistant/sessions/{id}` | 세션 삭제 (cascade로 메시지 삭제) |
| `POST` | `/api/v1/workflow-assistant/sessions/{id}/messages` | **SSE 스트림**. 사용자 메시지 전송 + assistant 응답 스트림 (§5) |

모든 엔드포인트는 `editor` 이상 역할이 필요하고, `workspace_id`는 JWT에서 주입된다.

### 6.0 Assistant message 응답 필드

`GET /api/v1/workflow-assistant/sessions/{id}` 응답의 `messages[*]` 는 기본적으로 `WorkflowAssistantMessage` entity 를 그대로 직렬화한다. 다음 필드가 **자동 재개** 이력을 기록한다:

| 필드 | 타입 | 의미 |
|------|------|------|
| `autoResumed` | `boolean` | 이 assistant row 가 stall 자동 복구(§10)로 **새로 시작**된 row 이면 `true`. 정상 단일 턴의 단일 row 는 기본값 `false`. 한 턴이 stall 복구로 여러 row 로 쪼개진 경우, **복구 직전까지의 row 는 `false`**, **복구 이후 새로 시작된 row 는 `true`** 로 찍힌다 |
| `autoResumeReason` | `string \| null` | `autoResumed=true` row 에서만 세팅. 현재 `'stall_pending_steps'` 한 종류 |
| `autoResumeAttempt` | `number \| null` | 같은 턴 내 자동 복구 시도 순번. 1부터 시작하며 `MAX_STALL_ROUNDS` (현재 2) 까지 |
| `finishReason` | `string \| null` | 복구 경계에서 먼저 persist 된 "중간 row" 는 `'auto_resume_pending'` 마커를 사용. 턴 종료 시 persist 되는 최종 row 는 기존 의미의 `'stop'` / `'tool_calls'` / `'error'` |

프론트는 rehydrate 시 `autoResumed=true` row 앞에 §3.2 의 divider 를 렌더해 자동 재개 경계를 시각화한다. 기존 session 의 row (마이그레이션 전) 는 `autoResumed=false`, 나머지 필드는 `null` 로 해석되어 호환성이 유지된다.

**Candidate picker 복원**: `tool_calls[*].result.pendingUserConfig` (§4.3.1) 가 서버 응답에 담긴 채 저장된다. 프런트는 세션 재로드 시 이를 그대로 읽어 edit 버블 아래 picker 를 다시 렌더하되, 대상 노드의 현재 canvas 값(`field`) 이 이미 채워져 있으면 "✓ 설정됨" 읽기 전용 상태로, 비어있으면 interactive picker 로 보여준다. 이 판정은 프런트 단독으로 수행하며 서버 round-trip 불필요.

### 6.1 세션 자동 선택 규칙

패널을 처음 열거나 워크플로우를 다시 로드했을 때:

1. 해당 `workflowId`의 세션 목록 중 `status='active'`이면서 가장 최근에 업데이트된 세션을 자동 선택 (기본 동작)
2. 없으면 패널은 빈 상태로 표시, 사용자 첫 메시지 전송 시 세션 자동 생성

### 6.2 세션 제목 자동 설정

첫 사용자 메시지 전송 후 LLM 응답이 완료되면, 서버가 첫 메시지를 40자 이내로 요약해 세션 `title`에 저장한다. (별도 LLM 호출 없이 규칙 기반으로 40자 잘라쓰기)

---

## 7. 에러 처리

| 코드 | 상황 | 사용자 메시지 |
|------|------|---------------|
| `ASSISTANT_NO_LLM_CONFIG` | LLM Config 없음 & workspace default도 없음 | "LLM 설정을 먼저 등록해 주세요." + 설정 화면 링크 |
| `ASSISTANT_LLM_CONFIG_INVALID` | 지정 config 삭제되었거나 워크스페이스 밖 | "선택한 LLM 설정을 찾을 수 없어요. 다시 선택해 주세요." |
| `ASSISTANT_STREAMING_UNSUPPORTED` | 향후 추가될 provider 가 스트리밍 미지원인 경우 (v1 의 5개 provider — OpenAI / Anthropic / Google / Azure OpenAI / Local — 은 모두 ✅) | "이 모델은 현재 Assistant 에서 지원하지 않아요. 스트리밍 지원 provider 를 선택해 주세요." |
| `LLM_RATE_LIMIT` | 429 (LLM Client §6 위임) | "잠시 후 다시 시도해 주세요." + 재시도 버튼 |
| `LLM_TIMEOUT` | 120초 타임아웃 | "응답이 늦어지고 있어요. 다시 시도할까요?" |
| `ASSISTANT_TOOL_FAILED` | 편집 도구가 shadow 검증 실패 | 배지에 구체 사유(§4.4) 표시 + LLM이 다음 턴에 복구 시도 |
| `ASSISTANT_SESSION_NOT_FOUND` | 세션 삭제됨 | "세션이 만료되었어요. 새 대화를 시작할게요." + 자동 새 세션 생성 |

실패해도 이미 적용된 편집은 `editor-store`에 남아 있으므로 `Ctrl+Z`로 되돌릴 수 있다.

---

## 8. LLM 시스템 프롬프트 구성

백엔드 `buildSystemPrompt(nodeDefs, workflowSnapshot, activePlanContext?)` 이 생성하며 매 호출마다 주입된다.

| 섹션 | 내용 |
|------|------|
| 역할 | Assistant는 워크플로우 에디터의 Planner + Builder. 모호하면 질문·계획 먼저, 명확하면 바로 편집 |
| 판단 heuristic | §2.1 표를 자연어로 서술 |
| **Active plan context** (있을 때만) | 활성 plan 이 있을 때 상단에 주입. 사용자의 원 요청·plan 제목/요약·승인 여부·step 체크박스(`[x]`/`[ ]`)·미답변 openQuestions·RULES(완료된 step 재실행 금지, 화제 전환 시 `clear_plan` 선호출, 미완 상태 `finish` 금지) 를 포함. `cleared` 상태면 섹션 생략, `completed` 상태면 한 줄 완료 요약만 유지 |
| 노드 카탈로그 | `NodeComponentRegistry.listDefinitions()` 결과를 요약(type, category, description, 주요 config 필드, ports). `isDynamicPorts` 노드에는 `[dynamic-ports]` 마커를 붙여 "config 에 따라 실제 포트가 바뀐다" 는 맥락만 안내한다. **실제 port id 는 `add_node`/`update_node` 의 `result.ports` (§4.3.2)** 로 자동 내려오므로 `get_node_schema` 선행 호출은 거의 불필요 — 스냅샷에만 있고 이 턴에 편집하지 않은 노드에 edge 를 연결할 때만 on-demand 호출 |
| 워크플로우 조립 규칙 | 새 노드 추가 시 데이터 경로가 `manual_trigger` 에서 시작되도록 반드시 `add_edge` 로 연결, 고립 노드 금지. **`add_edge` 의 port 값은 직전 `add_node`/`update_node` 성공 응답의 `result.ports.outputs[*].id` 를 그대로 사용** — 추측·하드코딩 금지. **`update_node` / `remove_node` / `add_edge` 의 `id` / `source_id` / `target_id` 자리에는 UUID 만 허용** — 사용자에게 보이는 node label 을 넣으면 `NODE_NOT_FOUND` 가 반환된다 (§4.4.1 label-lookalike hint 가 복구를 안내). UUID 의 유일한 출처는 직전 `add_node` 성공 응답의 `result.id` 또는 `currentWorkflow.nodes[*].id`. `openQuestions` 가 있는 plan 은 사용자 답변을 받기 전에 `finish` 호출 금지. **모든 dynamic-ports 노드의 sub-entry (`switch.cases`, `ai_agent.conditions`, `text_classifier.categories`, `carousel/table/chart/template` 의 `items[*].buttons`·`itemButtons`·`buttons`) 는 안정적·고유한 `id` 가 필수** — 누락 시 resolver 가 `case_0` · `cond_0` · `class_0` · `items_0_btn_1` 같은 index 기반 fallback id 로 포트를 발행하며 `result.ports` 에도 같은 fallback id 가 내려온다. LLM 은 그 id 를 그대로 써도 동작하지만, 추후 사용자가 label 을 수정할 때 index 가 다시 맞춰지는 위험이 있으므로 가급적 안정적인 custom id 를 지정. (`information_extractor` 는 `config.mode` 기반 시스템 포트(`completed`/`user_ended`/`max_turns`/`error` 또는 `out`/`error`)만 발행하므로 sub-entry id 가 없다.) **buttons 자동 부여 정책 (carousel/chart/table/template)**: `add_node`/`update_node` 시 button entry 의 `id` 가 비어있으면 서버 (`shadow-workflow.normalizeNodeButtonIds`) 가 `label` 을 kebab-case 로 변환해 안정적인 slug 를 부여한다 (충돌 시 `-2`/`-3` 접미사). label 이 영문/숫자가 아닌 경우만 index fallback (`btn_${i}` 등) 으로 떨어진다. **기존 id 는 항상 보존** — 사용자가 후속에 label 만 수정해도 slug 가 재생성되지 않으므로 edge 가 안전. 마이그레이션 노트: 본 정책 도입 전에 저장된 워크플로의 빈 button id 는 `backend/scripts/migrate-button-ids.ts` backfill 로 resolver fallback id 가 채워진다 — 즉 도입 시점 기준 모든 button 은 id 가 살아있다. |
| I/O 규약 | [`CONVENTIONS.md`](../conventions/node-output.md) 의 Principle 0, 1.1, 2, 8 요약을 복사 투입 |
| 현재 워크플로우 | `currentWorkflow` 요약 JSON. 섹션 앞에 "authoritative snapshot" 지침을 동반 — 단순 조회는 프롬프트에서 직접 답하고, 편집 이후 재확인에만 `get_current_workflow` 호출 |
| 레이아웃 지침 | 스냅샷의 노드별 측정값(`width`/`height`, px) 이 있으면 그것을 기준으로 `x = predecessor.x + (predecessor.width ?? 250) + 32` 배치. 분기 시 y offset 은 `max(predecessor.height ?? 80, 80) + 24` 기준. 측정값이 없는 노드(초기 렌더 전 또는 동일 턴에 방금 추가된 노드)는 250×80 px 를 폴백으로 가정 — "발명 금지" |
| 참조 표기 | `$node["label"].output.*` 사용, label은 유일, `manual_trigger`가 진입점 |
| 실행 이슈 진단 패턴 | 사용자가 "실행이 실패했어 / 왜 이 결과가 나오지" 류의 질문을 하면, 먼저 `get_workflow_executions` 로 최근 실행 목록을 요약 받은 뒤 가장 가능성 높은 한 건만 `get_execution_details` 로 깊게 조회한다. 타임라인의 실패 노드·에러 메시지·직전 노드의 output을 읽어 원인을 가설화하고, 수정이 필요하면 `propose_plan` → 승인 → `update_node` 순으로 이어간다. 전체 목록을 한 번에 상세 조회하지 않는다 (토큰 낭비) |
| **Selector 필드 정책 (Integration / LLM Config / KB / Workflow)** | `integration-selector`·`llm-config-selector`·`kb-selector`·`workflow-selector` widget 이 붙은 필드의 id 는 **LLM 이 채우지 않는다**. 추측·발명 모두 금지 — 빈 값 그대로 `add_node` / `update_node` 를 호출하면 서버가 워크스페이스의 실제 후보를 조회해 `pendingUserConfig[*].candidates` (§4.3.1) 로 실어주고, 프런트는 해당 edit 버블 내부에 드롭다운 picker 를 렌더해 사용자 확인을 받는다. LLM 은 `pendingUserConfig` 에 대해 별도 action 을 하지 않는다 (tool_result 로 feedback 되지 않음). **Closing message 규칙**: `candidates` 가 0 개인 pending 항목만 한국어 마무리 메시지에 "해당 Integration/LLM/KB/워크플로 를 Settings Panel 에서 직접 등록·선택해 주세요" 로 언급한다 — 후보가 있으면 picker 가 UX 를 완결하므로 mention 은 오히려 중복이다. 이 규칙은 §10 의 review guard (`PENDING_USER_CONFIG_UNMENTIONED`) 에도 반영된다 |
| Few-shot 3개 | ① "HTTP 헤더 추가" → 즉시 `update_node`. ② "템플릿/스위치 노드 찾아봐" → 스냅샷 참조만, 도구 호출 없음. ③ "주문 취소" → 탐색 + 질문 + Plan + 실행 |

시스템 프롬프트는 `spec/5-system/7-llm-client.md`의 인터페이스를 그대로 따르며 별도의 모델 정책을 두지 않는다.

---

## 9. 정합성·보안 고려

| 항목 | 내용 |
|------|------|
| 워크스페이스 경계 | 모든 탐색·편집 도구는 `session.workspace_id` 내에서만 동작 |
| 감사 로그 | 메시지·도구 호출은 `AuditLog` 대상이 아닌 `assistant_message`에만 기록 (MVP) |
| 토큰 사용량 추적 | 각 LLM 호출은 기존 `llm_usage_log` 테이블에 기록되며 `workflow_id`·`workspace_id`가 자동 채워짐 |
| 편집 결과 vs 저장 | Assistant가 수행한 편집은 editor-store에만 반영. **영구 저장은 사용자 Ctrl+S / 자동 저장 디바운스를 통해서만** 일어남 → 실수로 닫아도 세션 시작 시점의 워크플로우 상태로 돌아갈 수 있음 |
| API 키 노출 | LLM API Key는 백엔드에서만 해독·사용 (기존 LLM Client 규칙과 동일) |
| 프롬프트 인젝션 | 시스템 프롬프트는 서버에서만 생성하며, 사용자 메시지는 `role: 'user'`로만 전달됨. 탐색 도구 결과(예: 외부 워크플로우의 사용자 작성 텍스트)는 `role: 'tool'`의 결과로 격리됨 |

---

## 10. 성능·비용 제약

| 항목 | 기준 |
|------|------|
| 단일 턴 타임아웃 | LLM Client §6에 따라 120초 |
| Tool 호출 최대 횟수 | 한 턴의 tool-call 상한은 활성 plan 크기에 맞춰 **동적** 으로 결정된다 (`computeToolCallsBudget`). plan 이 없으면 기본 48, plan 이 있으면 `actionable steps × 3 + 8` (note step 은 제외), 상한은 런어웨이 방어로 200 에 hard-cap. 같은 턴에 새 `propose_plan` 이 발행되면 budget 을 확대 재계산. 초과 시 `ASSISTANT_TOO_MANY_TOOL_CALLS` error 이벤트에 "이어서 진행해줘" 같은 follow-up 메시지 안내가 포함되어 사용자가 다음 턴에서 남은 step 을 계속 실행할 수 있다 |
| Stall 자동 복구 | LLM 이 tool call 없이 텍스트만 뱉고 `finishReason: 'stop'` 으로 종료했는데 active plan 에 pending actionable step 이 남은 경우, 서버가 `"이어서 진행해줘."` user nudge 를 history 에 주입해 **추가 라운드**를 자동으로 시도한다 (gpt-oss-120b 임의 중단 quirk 대응). 연속 `MAX_STALL_ROUNDS = 2` 회까지 허용하고 초과 시 포기. **자동 복구로 추가 라운드가 시작될 때** 서버는 지금까지 누적된 assistant text 를 별도 메시지 row 로 persist 하고 (`finishReason='auto_resume_pending'`) `event: auto_resume` 을 SSE 로 발행한다. 이후 라운드의 텍스트는 `autoResumed=true` 인 새 row 로 누적되어, 한 턴이 여러 버블로 쪼개져 표시된다. 반복 confirmation 문구("계속 진행해도 될까요?" 등) 가 한 버블에 몰리는 UX 문제를 구조적으로 제거 |
| `finish` guard 반복 block | 진척 기반(progress-aware). block 이후에도 LLM 이 edit/plan tool 을 추가 성공시키면 `PLAN_NOT_COMPLETE` 로 다시 block — plan 이 끝날 때까지 LLM 을 끌고 간다. block 후 어떤 진척도 없이 또 finish 를 호출하면 진짜 stuck 으로 간주해 안전 탈출(`finishReason: 'stop'`) 허용. **Plan-only 턴(이번 턴 propose_plan + 미승인) 과 모든 edit 이 ok:false 로 실패한 턴은 가드 비활성** — 사용자 approve 전 자동 진행 시도와 핑퐁 루프 모두 방어. 무한 루프 방어는 `toolCallsBudget` 과 `MAX_TOOL_LOOP_ROUNDS` 가 담당 |
| Workflow self-review 가드 (`WORKFLOW_REVIEW_REQUIRED`) | `finish` 가 plan 완결성 검증을 통과한 뒤 1회, 실행 턴(성공한 edit 이 1건 이상) 에 한해 워크플로 품질을 점검한다. blocking 항목이 있으면 LLM 이 수정 후 `finish` 를 다시 호출하도록 유도. 주요 체크 항목: orphan 노드, 실패 tool_call 미수습, plan step 의 허위 완료, **pendingUserConfig 미안내 (`PENDING_USER_CONFIG_UNMENTIONED`)** 등. `PENDING_USER_CONFIG_UNMENTIONED` 는 §4.3.1 의 candidate 가 **0 개인 경우에만** 발동한다 — 후보가 1건 이상이면 in-message picker 가 UX 를 완결하므로 LLM 의 한국어 mention 이 불필요하다. 상한: 같은 턴에 review 는 최대 2회, 이후에는 자동 통과 (무한 루프 방어) |
| 메시지 히스토리 크기 | 기본 최근 30턴만 LLM에 전달. 그 이전은 서버에는 저장되되 프롬프트에서 제외 |
| 스트리밍 지연 허용치 | 첫 delta까지 3초 이내 권장 (SSE keep-alive: `: ping\n\n` 15초 간격) |
| 동시 활성 세션 | 사용자당 무제한이나, 워크플로우당 활성 스트리밍은 1건만 허용 (중복 POST 시 409) |

---

## 11. 스트리밍 provider 요구사항

| Provider | v1 스트리밍 지원 |
|----------|------------------|
| OpenAI | ✅ 필수 (chat.completions.stream + tool_calls delta 누적) |
| Anthropic | ✅ 필수 (messages.stream + content_block delta 누적) |
| Google (Gemini) | ✅ 필수 (`ChatSession.sendMessageStream` + `EnhancedGenerateContentResponse.candidates[].content.parts` 순회. `functionCall` part는 인자가 한 번에 완결된 JSON으로 내려오므로 `tool_call_delta`+`tool_call_end`를 즉시 emit — OpenAI식 인자 조각 누적 단계 불필요) |
| Azure OpenAI | ✅ 필수 (OpenAI 호환 SDK + deployment name 기반 endpoint — `AzureOpenAIClient` 가 OpenAI 스트리밍 경로를 상속) |
| Local (Ollama/vLLM) | ✅ 필수 (OpenAI 호환 엔드포인트 — Ollama 11434 / vLLM OpenAI-compat 모드 스트리밍 검증 완료) |

상세 인터페이스는 [Spec LLM 클라이언트 §8 Streaming](../5-system/7-llm-client.md#8-스트리밍-streaming) 참조.

---

## 12. 관련 타 스펙과의 동작 상세

### 12.1 캔버스

- Assistant의 편집은 캔버스 자동 저장(2초 디바운스)에 그대로 편입된다. 사용자는 Assistant 작업 중에 수동 저장(Ctrl+S)·실행(Run)을 언제든 할 수 있다.
- 컨테이너(Loop/ForEach/Map) 관련 편집은 §11.2.1 container 전파 규칙을 그대로 따른다. Assistant는 이 규칙을 시스템 프롬프트로 인지한다.

### 12.2 실행/디버깅

- Assistant는 워크플로우 실행 API를 호출하지 않는다. 실행은 사용자 몫이다.
- 실행 중(Run Results 드로어 노출) **편집 도구**는 shadow 단계에서 `ASSISTANT_WORKFLOW_RUNNING` 에러로 거부된다. 반면 **실행 조회 도구**(`get_workflow_executions` · `get_execution_details`, §4.1)는 read-only 이므로 실행 중에도 호출 가능하며, 진행 중인 실행에 대해선 현재까지의 부분 타임라인을 그대로 반환한다 (§4.1.1 의 "실행 상태별 동작" 표 참조).
- Assistant 가 실행 이슈를 진단할 때는 먼저 `get_workflow_executions` 로 요약 목록을 받아 후보를 좁힌 뒤 하나의 id 만 `get_execution_details` 로 깊게 조회하는 2-step 패턴을 따른다(§8 시스템 프롬프트가 이를 가르친다). 한 턴에 여러 건을 동시에 상세 조회하면 tool-call budget(§10 `ASSISTANT_TOO_MANY_TOOL_CALLS`) 과 페이로드 크기 양쪽에서 낭비가 발생한다.

### 12.3 LLM Config

- 지정 config가 삭제되었는데 세션 `llm_config_id`에 남아 있으면, 첫 메시지 전송 시 서버가 workspace default로 자동 폴백하고 사용자에게 toast로 안내한다.
- 사용량은 기존 `llm_usage_log`에 `workflow_id`, `workspace_id`와 함께 기록된다(별도 source 구분자는 선택적으로 `source: 'assistant'` 메타 필드 추가).

---

## 13. i18n 키

> **배지 라벨 관례.** 도구 호출 배지(§3.2)는 현재 영문 고정 문자열을 사용한다(`tool-call-badge.tsx`의 `summarize()`). 아래 `assistant.exploreLookup` · `assistant.exploreExecutionsList` · `assistant.exploreExecutionDetails` 등 "explore" 계열 키는 **에디터 내 다른 UI 표면(힌트·안내·에러 bubble)** 에서 사용하기 위한 contract 이다. 배지 라벨을 한국어/영어로 분기하려면 `useTranslation` 연결이 필요하나 MVP 스코프 밖이다.

| 키 | 한국어 | 영어 |
|----|--------|------|
| `assistant.panelTitle` | AI 어시스턴트 | AI Assistant |
| `assistant.toggleButton` | AI 어시스턴트 열기/닫기 | Toggle AI Assistant |
| `assistant.newSession` | 새 대화 시작 | New session |
| `assistant.modelLabel` | 모델 | Model |
| `assistant.modelDefault` | 기본 Provider | Default provider |
| `assistant.placeholder` | 요청을 입력하세요... | Describe what you want to build... |
| `assistant.sendButton` | 전송 | Send |
| `assistant.stopButton` | 중단 | Stop |
| `assistant.thinking` | 생각 중... | Thinking... |
| `assistant.planCardTitle` | 실행 계획 | Plan |
| `assistant.planApproveButton` | 계획대로 진행 | Approve & execute |
| `assistant.planApproveConfirm` | 계획대로 진행해 주세요. | Please proceed with this plan. |
| `assistant.planQuestionsTitle` | 답변이 필요한 항목 | Questions to answer |
| `assistant.planQuestionsHint` | 아래 메시지 입력창에 답변을 적어 보내 주세요. | Type your answer in the message box below. |
| `assistant.turnStalledHint` | 진행이 중단됐어요. `이어서 진행해줘` 라고 답해 주시면 남은 단계를 계속 실행할게요. | The assistant stopped without a message. Send `Continue` and I'll keep executing the remaining steps. |
| `assistant.turnCompletedHint` | 작업을 완료했어요 — {{count}}개 단계 실행 성공. | Done — {{count}} plan steps completed. |
| `assistant.autoResumedHint` | 🔄 자동으로 이어서 진행했어요 ({{attempt}}/{{max}}) | 🔄 Auto-resumed ({{attempt}}/{{max}}) |
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
| `assistant.errorNoLlmConfig` | LLM 설정을 먼저 등록해 주세요. | Please register an LLM config first. |
| `assistant.errorRateLimit` | 잠시 후 다시 시도해 주세요. | Rate limited. Please retry in a moment. |
| `assistant.errorTimeout` | 응답이 늦어지고 있어요. | Response is taking too long. |
| `assistant.opAdded` | 노드 추가: {label} | Added node: {label} |
| `assistant.opUpdated` | 노드 수정: {label} | Updated node: {label} |
| `assistant.opRemoved` | 노드 삭제: {label} | Removed node: {label} |
| `assistant.edgeAdded` | 엣지 추가 | Edge added |
| `assistant.edgeRemoved` | 엣지 삭제 | Edge removed |
| `assistant.exploreLookup` | {count}건 조회됨 | {count} found |
| `assistant.exploreExecutionsList` | 실행 이력 {count}건 조회 | {count} executions found |
| `assistant.exploreExecutionDetails` | 실행 상세 조회 — {nodeCount}개 노드 | Execution detail — {nodeCount} nodes |
| `assistant.executionNotInScope` | 이 실행은 현재 워크플로의 것이 아니에요. | This execution does not belong to the current workflow. |

---

## 14. PRD 요구사항 매핑

| PRD ID | Spec 섹션 |
|--------|-----------|
| ED-AI-01 (패널 노출/토글) | §3.1 |
| ED-AI-02 (모델 선택) | §3.2, §6 |
| ED-AI-03 (3단계 대화 루프) | §2 |
| ED-AI-04 (즉시 반영 + Undo) | §5.3, §12.1 |
| ED-AI-05 (세션 영속) | §6 |
| ED-AI-06 (Plan 카드·승인) | §2.2, §2.3, §4.2 |
| ED-AI-07 (탐색 도구) | §4.1 |
| ED-AI-08 (편집 도구) | §4.3, §4.4 |
| ED-AI-09 (스트리밍 UX) | §5, §11 |
| ED-AI-10 (에러/중단 처리) | §5.4, §7 |
| ED-AI-11 (i18n) | §13 |
| ED-AI-12 (접근성) | §3.3 |
| ED-AI-35 (실행 조회 도구 2종) | §4.1, §4.1.1 |
| ED-AI-36 (조회 스코프 — 현재 워크플로 + 직계 자식) | §4.1 주석, §4.1.1 |
| ED-AI-37 (민감 필드 마스킹) | §4.1.1 "마스킹 규칙" |
| ED-AI-38 (실행 중에도 read 허용) | §4.1.1 "실행 상태별 동작", §12.2 |
| ED-AI-39 (사용자 선택 필드 in-message picker) | §3.2 "Candidate picker", §3.3 접근성, §4.3.1, §5.3.1, §6.0, §8 "Selector 필드 정책", §10 review 가드, §13 i18n |
| ED-AI-40 (runtime ports 자동 노출 + 재시도 배지 축약) | §3.2 "재시도 후 성공 축약", §4.3, §4.3.2, §5.3.1, §8 "노드 카탈로그"·"워크플로우 조립 규칙", §13 i18n |

---

## 15. 후속 로드맵 (out of scope for v1)

- 다중 워크플로우 배치 편집 (여러 워크플로우를 한 대화에서 수정)
- 세션 공유/팀 협업 (팀 워크스페이스 RBAC 선행 필요)
- 버전 롤백 제안 ("이 Assistant 편집을 한 묶음으로 버전 스냅샷에 포함할까요?")
- 자동 테스트 케이스 생성 제안

---

## Rationale

본 spec 결정 사항의 배경·근거. memory/ 에 남아있던 작업 메모를 inline 흡수한 것이며, 폐기된 대안과 1회성 분석 자료는 `plan/complete/archive/from-memory/` 를 참조.

_원본 메모: memory/workflow-ai-assistant-decisions.md_

### Workflow AI Assistant — 기획 결정 메모

Workflow AI Assistant(에디터 내 채팅형 AI) 스펙 작성 시 사용자와 합의한 결정 사항을 구현자가 재참조할 수 있도록 정리한다.

#### 확정된 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 제품 명칭 | **Workflow AI Assistant** / 워크플로우 AI 어시스턴트 | PRD/Spec/i18n 전 영역에서 통일 사용. "Copilot", "AI Workflow Builder" 후보는 기각 |
| PRD 배치 | `prd/2-workflow-editor.md` §10, 요구사항 ID 접두사 `ED-AI-*` | 에디터 내부 UI/UX가 주 영역이므로 에디터 문서에 포함. PRD 6에서는 cross-ref만 |
| 채팅 세션 영속화 | **서버 저장** (신규 엔티티 `AssistantSession`, `AssistantMessage`) | 페이지 새로고침·재접속 시 이어서 대화 지원. 관련: `spec/1-data-model.md` §2.20~2.21 |
| 변경 적용 방식 | 즉시 반영 + Undo (`editor-store` 재사용) | 기존 자동 저장/Ctrl+S 흐름과 일관. DB 영구 기록은 사용자의 Save를 통해서만 |
| 스트리밍 | SSE + `LLMClient.stream()` 신규 메서드 | 관련: `spec/5-system/7-llm-client.md` §8 |
| 스트리밍 v1 지원 provider | OpenAI, Anthropic만 | Google/Azure는 Tool-use 포맷 차이로 후속. 미지원 provider 선택 시 `ASSISTANT_STREAMING_UNSUPPORTED` 에러 |
| NodeSettings Panel과 동시 오픈 | **상호 배타** (Assistant 열면 Settings 닫힘) | MVP 단순화. 사용자 피드백에 따라 후속 버전에서 나란히 배치 가능 |
| Assistant의 편집 권한 | `editor` 역할 이상 | 기존 RBAC 규약 재사용 |

#### 구현 시 유의 사항 (승인된 기술 플랜 `~/.claude/plans/ui-partitioned-porcupine.md` 대비 변경점)

원래 기술 플랜에는 "채팅 히스토리는 in-memory only (MVP)"로 명시되어 있었으나, **기획 단계에서 서버 영속화로 변경**되었다. 따라서 다음 작업이 추가된다:

1. **DB 엔티티 2개 신규**: `AssistantSession`, `AssistantMessage` (Flyway 마이그레이션 필요)
2. **REST API 5개 신규**: `GET/POST/PATCH/DELETE /workflow-assistant/sessions`, `GET /workflow-assistant/sessions/:id`. SSE 엔드포인트는 `POST /workflow-assistant/sessions/:id/messages`로 경로 변경 (기존 플랜의 `/workflow-assistant/message`가 아님).
3. **백엔드 Service**: 세션/메시지 CRUD + 대화 컨텍스트 조립(최근 30턴 프롬프트 주입 룰).
4. **프론트엔드 스토어**: `assistant-store.ts`가 서버 세션 id를 들고 있어야 하며, 패널 오픈 시 `GET /sessions?workflowId=...`로 기존 세션을 로드.
5. **Cascade 삭제**: `Workspace` 삭제 → `Workflow` 삭제 → `AssistantSession` 삭제 → `AssistantMessage` 삭제. Flyway 마이그레이션에서 ON DELETE CASCADE FK 설정.

#### 미결 UX (발견 시 확인 필요)

- 세션 보관 기간/자동 archive 정책 — 현재 Spec은 "수동 삭제까지 영속". 향후 워크스페이스별 용량 제한과 연계 가능.
- 세션 공유/내보내기 — v1 스코프 밖 명시. 팀 워크스페이스 RBAC 선행 필요.
- Plan 카드의 step을 사용자가 직접 편집/체크 가능한지 — 현재 Spec은 "사용자 조작 불가, 진행도 표시 전용"(§3.3). 필요해지면 별도 RFC.

_원본 메모: memory/workflow-assistant-prompt-restructure.md_

### Workflow AI Assistant 시스템 프롬프트 재구조 (2026-04-22)

`backend/src/modules/workflow-assistant/prompts/system-prompt.ts` 를 5블록 구조로 재편한 작업의 핵심 결정 사항과 향후 주의점을 정리한다.

#### 왜 바꿨나

##### 이전 구조의 문제

1. **규칙 중복.** "plan-only vs execution turn" 분기가 5군데(L84/L85/L129/L138–153/L251)에 흩어져 LLM이 매 턴 파싱해야 했다. `planStepId` 태깅 규칙도 4군데, `get_node_schema` 선행 규칙도 4군데 반복.
2. **토큰/캐시 비효율.** 매 턴 변하는 `workflow snapshot JSON`(L121)과 `activePlanSection`(L87 근처)이 프롬프트 상단에 있어 provider prefix cache가 사실상 매 턴 무효화.
3. **시각적 우선순위 부재.** 섹션이 전부 `##` 동일 레벨, MUST/SHOULD 계층 구분 없음. 서술형 문장 안에 분기 로직이 숨어 있었음.
4. **부정문 지배.** DO NOT / NEVER / MUST NOT 위주. 긍정형 격언이 드물었다.
5. **예시 중복.** 6개 예시 중 3개가 사실상 같은 교훈(trigger 연결 + dynamic-ports + label/id) 반복.

#### 새 구조 (5블록)

1. **ROLE & TURN-OP PROTOCOL** — 역할 1문장 + 툴 호출 규약 + **turn 결정표** (Markdown table: `Turn type | Emit prose? | finish call? | Further tools | When it applies`)
2. **CONTRACTS (MUST)** — Node output contract (CONVENTIONS 0/1.1/2/8), Label vs identifier, Entry-point connectivity, Dynamic-ports (schema-first + stable ids), Plan gating (openQuestions / planStepId / completeness)
3. **EDIT PLAYBOOK** — Closing the turn, pendingUserConfig, Editing existing node's config, Layout guidance, Error handling, Examples (3개)
4. **REFERENCE** — Node catalog, Expression language
5. **DYNAMIC STATE** — Active plan context + Current workflow snapshot JSON (**반드시 프롬프트 끝에 위치**)

##### 주요 효과

- **Prefix cache 친화.** 정적 콘텐츠가 앞, 동적 상태가 뒤로 이동해 prefix-cache hit rate가 크게 개선될 것으로 기대.
- **규칙 단일 소스.** "Call `finish` immediately after `propose_plan`" 문구가 **딱 한 곳(turn 결정표)** 에만 존재. 다른 섹션에서는 "the decision table above" 로만 참조.
- **Expression reference 캐시.** `EXPRESSION_REFERENCE_CACHE` 모듈 스코프 변수로 한 번만 문자열화. 이전엔 매 턴 `getAllFunctionNames().sort().join()` 을 재실행.
- **예시 3개로 축소** — Ex1 단순 edit / Ex2 dynamic-ports+pendingUserConfig (label/id 동시 커버) / Ex3 openQuestions 포함 복잡 요청.

#### 새 구조를 고정하는 테스트

`system-prompt.spec.ts` 에 `5-block structural layout (cache-friendly ordering)` describe 블록 추가. 향후 변경 시 다음이 깨지면 안 된다:

- `## Expression language` 이후에 workflow snapshot JSON(`"nodes":[`) 이 위치.
- `## Expression language` 이후에 `## Active plan context` 위치.
- `Label vs identifier` (CONTRACTS) 는 `## Expression language` (REFERENCE) 보다 앞.
- Turn 결정표 헤더 `| Turn ... | ... prose ... | ... finish ...` 형태가 존재하고 `plan-only` / `execution` 두 턴 종류가 본문에 등장.
- `Call finish immediately after propose_plan` 정규식 매치가 **1회 이하** (중복 금지).

#### 보존한 계약 (기존 테스트가 보장하는 것)

다음은 절대 문구를 깨면 안 된다 (regex 매칭됨):

- `[dynamic-ports]` 카탈로그 마커
- P0 guard rail: `manual_trigger` entry-point / `openQuestions` finish 금지 / `get_node_schema` MANDATORY
- Label vs identifier 예시: `btn_approve`, `승인`, `interaction.data.buttonId`, `interaction.data.email`, `data["승인"]` 금지 사례
- `## Closing the turn ... execution turn` 헤더 (동일 라인에 두 문구)
- `pendingUserConfig`, 4종 selector: `integration-selector`, `llm-config-selector`, `kb-selector`, `workflow-selector`
- `TODO|placeholder` 금지 가드
- `## Expression language`, `validate()`, `INVALID_EXPRESSION`, `Optional chaining`, `` `??` ``, `Arrow`, `Template literal`
- `Editing an existing node's config`, `shallow-merged`, `[REDACTED]`, `minimum patch`, "keep .* id"
- Active plan rendering: `[x] s1 · add_node` / `[ ] s2 · add_edge` / `• [note] ...` / `awaiting approval` / XML fence `<user-request>...</user-request>`

#### 이번 작업에서 발견한 pre-existing 이슈

TEST WORKFLOW 중 다음 테스트가 **main 브랜치에서도 실패** 함을 확인 (git stash 로 재현):

- `backend/src/modules/workflow-assistant/tools/validate-expressions.spec.ts` — "accepts optional chaining" 케이스
- `backend/src/modules/workflow-assistant/tools/shadow-workflow.spec.ts` — "accepts add_node with optional chaining (supported syntax)"

원인은 `@workflow/expression-engine` 패키지의 optional chaining 파서가 한글 키 인덱싱(`$node["1depth 음식 종류"]?.output?.interaction?.data.field`)을 거부하는 것으로 보인다. 최근 커밋 `6f6cfe1 표현식에 ? 지원` 에서 도입하려던 수정이 불완전한 듯하다.

**이번 프롬프트 재구조 작업 범위 밖**이므로 별도 이슈로 처리해야 한다. 프롬프트 재구조는 이 실패들과 독립적으로 완결.

#### 유지보수 시 체크

- 섹션을 추가할 때 **블록 경계를 넘지 말 것.** 정적 내용은 BLOCK 1~4, 동적 내용은 BLOCK 5. 이 규율이 캐시 효과의 근간.
- `STATIC_BLOCK_1_*`, `STATIC_BLOCK_2_*`, `STATIC_BLOCK_3_*` 모듈 스코프 상수로 빌드 타임에 1회만 문자열화됨. 동적 값이 필요하면 이 상수에 넣지 말고 `buildSystemPrompt` 본체에서 조립.
- 새 규칙을 추가하기 전, **기존 섹션에 흡수 가능한지 먼저 검토.** 규칙을 여러 곳에 반복 넣으면 이번 리팩토링이 무효화된다.
- Harmony control token 경고(`<|channel|>` 등) 는 OpenAI gpt-oss 계열 대비 유산. 현 provider (OpenAI/Anthropic/Google) 모두에서 발생하지 않는다는 것이 확인되면 제거 가능.

_원본 메모: memory/workflow-assistant-self-review-and-error-hints.md_

### Workflow Assistant — 자체 점검 + 에러 풍부화 (2026-04-23)

Assistant 가 복합 워크플로우 (예: 설문조사) 를 만들 때 실패 tool call 이 연쇄적으로 발생하던 문제와, 완료 후 자체 점검이 없던 문제를 해결한다. 본 메모는 향후 유지보수 시 놓치면 안 되는 결정·제약을 정리한다.

#### Part A — Tool-call 오류 감소

##### 에러 풍부화 (ShadowResult 확장)

`ShadowResult` 에 optional 필드 추가:
- `knownTypes: string[]` (정렬, 최대 `KNOWN_TYPES_MAX=40`) — `UNKNOWN_NODE_TYPE`
- `suggestedType: string` — alias 맵 hit (`NODE_TYPE_ALIASES`) 우선, 없으면 Levenshtein ≤ 3
- `repeatCount: number` — 같은 label LABEL_CONFLICT 가 `LABEL_CONFLICT_REPEAT_THRESHOLD(=2)` 이상 반복 시
- `hint: string` — 복구 지침 한 문장. 세 케이스에서 set 될 수 있다 (JSDoc 에 명시):
  - UNKNOWN_NODE_TYPE (alias / Levenshtein / 후보 없음 별로 문구 다름)
  - LABEL_CONFLICT (repeatCount ≥ 2)
  - NODE_NOT_FOUND on add_edge (recentFailedAddNodeLabels 가 있을 때 cascading 힌트)

##### alias 별칭 정책

`NODE_TYPE_ALIASES` 는 `error_message | error | alert | notification | message | text → template`.
기준: LLM 이 "UI 메세지용 전용 노드" 가 있다고 가정해 만들어내는 타입명을 `template` 으로 라우팅.
반드시 `this.knownNodeTypes.has(aliasHit)` 를 확인한 뒤에만 suggestedType 으로 싣는다 (registry 변화 대응).

##### LABEL_CONFLICT ≠ 실패한 노드 생성

**규약**: `addNode()` 의 LABEL_CONFLICT 분기에서는 `recordFailedAddNode` 를 호출하지 않는다. 이유: LABEL_CONFLICT 는 "이름만 겹쳤을 뿐 타입·config 자체는 타당" 한 상태이므로, 이후 `add_edge` 가 NODE_NOT_FOUND 로 떨어졌을 때 cascading 힌트에 섞이면 "앞서 노드 생성이 실패했다" 는 잘못된 진단을 LLM 에 준다. 테스트: `shadow-workflow.spec.ts` "LABEL_CONFLICT does NOT poison the cascading NODE_NOT_FOUND hint".

##### LLM 제공 문자열 embedding 규약

LLM 이 자유 텍스트로 채우는 값(label, attemptedType) 을 힌트/에러 메세지에 embed 할 때는 **반드시** `sanitizeLlmProvidedString(value, maxLen)` 경유. 이 헬퍼가 제어 문자·개행 제거, 백틱·꺾쇠 중화, 길이 절단을 일관 처리한다. 이유: LLM 출력이 `\n## HACK` 같은 마크다운 헤더/인젝션을 품은 채 힌트로 재주입되면 다음 라운드 프롬프트에서 지시문으로 오해될 수 있다.

길이 상수:
- `ATTEMPTED_TYPE_MAX_LEN = 64` — node type 후보 embed
- `LABEL_HINT_MAX_LEN = 80` — NODE_NOT_FOUND 힌트 label 목록

##### schemaCache 정책

`workflow-assistant-stream.service.ts` 의 턴 스코프 `schemaCache: Map<string, { result, hits }>`.

카운트 규칙: **hits 값은 호출 순번 그 자체**. 첫 호출 후 1, 두 번째 2, 세 번째 3...
- hits=1 (첫 호출): 정상 실행, cache set
- hits=2 (두 번째): cached + `warning: 'REDUNDANT_SCHEMA_LOOKUP'` + `cached: true`
- hits ≥ 3 (`SCHEMA_LOOKUP_HARD_STOP`): `ok: false, error: 'REDUNDANT_SCHEMA_LOOKUP'` (hard stop)

이 상수를 변경할 때는 서비스 L137–142 주석 + L459–462 inline 주석 + 테스트 3회차 기대값을 모두 동시에 고친다.

#### Part B — 2-stage finish (self-review)

##### 흐름

LLM 이 `finish` 를 호출하면 서버는 아래 순서로 판정:

1. `evaluateFinishGuard` → `PLAN_NOT_COMPLETE` 면 block (기존 동작, 변경 없음).
2. 통과하면 `evaluateReviewGuard` → `WORKFLOW_REVIEW_REQUIRED` 면 block.
3. 둘 다 통과하면 `{ ok: true }` 로 finish 성공.

Review 는 **한 턴에 한 번만** 발동 (`state.reviewCompleted`, `state.reviewRoundCount < 2`). 두 번째 `finish` 는 review 를 건너뛰고 통과해, LLM 이 사용자에게 다음 턴에서 후속 지시를 받을 기회를 보장.

##### review skip 조건 (`shouldSkipReview`)

다음 중 하나라도 참이면 review 는 발동하지 않는다. **시스템 프롬프트의 Self-review 섹션 설명과 반드시 동기화 유지** (프롬프트·구현 drift 가 곧 LLM 혼란으로 이어짐):

- `state.reviewCompleted`
- `state.reviewRoundCount >= 2`
- `state.finishBlockCount > 0` — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복
- `state.planClearedThisTurn`
- 이번 턴 성공 edit 이 0 — 실행 턴 아님
- non-trigger 노드 ≤ 1 — trivial 편집 (plan 유무 무관)

##### 체크리스트 항목 (`review-workflow.ts`)

Blocking:
- **UNRESOLVED_FAILED_CALLS** — `kind === 'edit'` 실패 중 같은 label(add_node) / id(update/remove) / source+target+port 튜플(add_edge, camelCase 도 포함) 로 성공 흔적이 없는 것. **`finish` / `explore` 계열은 제외** (review-guard feedback 이나 `REDUNDANT_SCHEMA_LOOKUP` 은 실패 의미가 아님).
- **`PORT_NOT_FOUND` (2026-04-23 추가, add_edge 단계에서 즉시 반환)** — UNRESOLVED_FAILED_CALLS 과는 다른 class. `ShadowWorkflow.addEdge` 가 `portResolver` (stream.service 에서 `resolveEffectiveOutputPorts` 기반 주입) 로 source/target 포트 존재성을 검사, 없는 포트면 즉시 `PORT_NOT_FOUND` + `portInfo.knownPorts` 로 reject. 사용자가 config update 실패로 생성되지 못한 동적 포트 (carousel 버튼 / switch case 등) 에 edge 를 붙이려는 실수를 첫 시도에서 catch. 컨테이너 loopback `emit` 포트는 여전히 허용 (spec §4.4).
- **ORPHAN_NODES** — trigger category 에서 BFS 도달 불가 + container emit loopback 조상도 미reachable. `byId` Map 은 `collectOrphans` 에서 1회 생성 후 인자로 주입 (O(N²) → O(N+E)).
- **DANGLING_OUTPUT_PORTS** (2026-04-23 추가) — `resolveEffectiveOutputPorts` 가 돌려주는 `isUserConfigured=true` 포트 중 outgoing edge 없는 것. "ORPHAN_NODES 는 입력 방향 reachability, 이 검사는 출력 방향 connectivity" 의 대칭 쌍. weak 포트 (`error`/`default`/`fallback`/`continue`/단일 static `out`) 는 제외 — terminal 노드는 정상 케이스. `nodeDefs` 가 `BuildReviewChecklistInput` 으로 주입되어야 작동; 빈 배열이면 no-op. 상한 `MAX_DANGLING_PORTS=20`.
- **FAKE_STEP_COMPLETION** — `planStepId` 또는 `planStepIds` 가 붙은 호출들이 step 에 연결되어 있으나 모두 `ok: false`.
- **PENDING_USER_CONFIG_UNMENTIONED** — pendingUserConfig 있는 노드의 label 이 assistantText 에 포함되지 않음.

Non-blocking:
- **REQUEST_COVERAGE_LOW** — originalRequest 의미 토큰과 노드 label 겹침 비율 < 30%. 경고만.

##### Port 해석 (resolve-dynamic-ports.ts)

`frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` 의 로직을 backend 로 포팅한 `tools/resolve-dynamic-ports.ts` 가 SSOT. 6 종 `DynamicPortsSpec` (switch-cases, classifier-categories, ai-agent-conditional, info-extractor-mode, presentation-buttons, parallel-branches) 를 전부 지원. 반환 구조에 `isUserConfigured: boolean` 추가 — strong (user-authored) vs weak (framework-synthesized) 구분이 DANGLING_OUTPUT_PORTS 의 핵심 필터. Frontend 사본과 드리프트하지 않도록 `resolve-dynamic-ports.spec.ts` 에 kind 별 시나리오 미러 (16 테스트).

##### 프롬프트 인젝션 방어

`WORKFLOW_REVIEW_REQUIRED` payload 의 `originalRequest` 필드는 `truncateReviewOriginalRequest()` 로 `REVIEW_ORIGINAL_REQUEST_MAX_LEN=200` 자로 잘라 싣는다. 전체 원문은 system prompt 의 Active plan context 에 XML fence 로 이미 중화되어 주입되므로 review 쪽에는 요약만.

##### 프론트엔드 영향

`tool-call-badge.tsx` 는 `kind === 'edit' | 'explore'` 만 SSE 로 구독하므로 `finish` tool_result (`ok: false, error: 'WORKFLOW_REVIEW_REQUIRED'`) 는 UI 빨간 배지로 누출되지 않는다. 사용자는 review 라운드 중 LLM 이 추가로 부른 `get_current_workflow` / 수정 edit 배지 + Korean "검토 완료" 문장만 본다.

#### 유지보수 체크리스트

- `SCHEMA_LOOKUP_HARD_STOP` 변경 시: 상수 정의부 + 인라인 주석 + 테스트 기대값 3곳 동시 수정.
- `ShadowResult` 필드 추가/제거 시: JSDoc 블록 + 테스트 fixture + 후속 `detectPendingUserConfig` / `toChatMessages` rehydration 경로 확인.
- Review skip 조건 변경 시: `prompts/system-prompt.ts` Self-review 섹션 문구 동기화 (테스트 `system-prompt.spec.ts` "teaches the 2-stage finish self-review routine..." 가 고정).
- `NODE_TYPE_ALIASES` 변경 시: alias 가 registry 에 존재하지 않으면 Levenshtein fallthrough 로 빠지는지 회귀 확인 (`shadow-workflow.spec.ts` "falls through to Levenshtein when alias exists but not in knownTypes").
- `resolveEffectiveOutputPorts` 변경 시: **frontend `resolveDynamicPorts` 와 동일 동작** 을 유지하는지 확인. 두 파일이 각자의 spec 을 가지므로 어느 한쪽만 업데이트하면 review false positive/negative 가 생긴다. 새로운 `DynamicPortsSpec.kind` 추가 시 양쪽에 동시에 branch 추가.
- DANGLING_OUTPUT_PORTS 의 weak/strong 경계 변경 시: `resolve-dynamic-ports.spec.ts` 의 `isUserConfigured` 단언 + `review-workflow.spec.ts` "does NOT flag weak ports" 케이스 모두 업데이트.

#### Follow-up (스코프 밖, 별도 이슈)

- `ShadowResult` discriminated union 전환
- `ShadowWorkflow` SRP 분리 (`ShadowWorkflowErrorAdvisor`)
- `schemaCache` 응답 명시 구조 래핑 (`{ ok, data, cached, warning }`)
- CHANGELOG 정책 수립 후 본 변경 소급 반영

_원본 메모: memory/workflow-assistant-provider-quirks-and-review-always.md_

### Workflow Assistant — 프로바이더 이상동작 대응 + review 항상 발동 (2026-04-23)

초기 self-review + 에러 풍부화 배포 후 다양한 LLM 프로바이더에서 관찰된 이슈에 대한 2차 대응을 정리.

#### 1. 프로토콜 이상: tool_call + finishReason=stop (gpt-oss-120b)

##### 증상
gpt-oss-120b 같은 오픈소스 서빙이 edit tool 호출 후에도 `finish` tool 을 부르지 않고 `finishReason: 'stop'` 으로 round 를 종료. LLM text 채널에는 "다음 단계 진행 중" 같은 내레이션을 남겨 사용자는 "멈춤" 으로 체감.

##### 대응
`stream.service.ts` 루프 종료 조건 확장:
```ts
const hadSuccessfulEditThisRound = pendingResultsForLlm.some(...)
const shouldContinueLoop =
  pendingResultsForLlm.length > 0 &&
  (finishReason === 'tool_calls' ||
   (!finishResolved && hadSuccessfulEditThisRound));
```

**edit 가 실제로 성공한 round 에서만** round-trip. propose_plan / explore 만 있는 plan-only round 는 기존처럼 stop 으로 종료 (추가 round 의 ROI 없음).

##### 프롬프트 강화
`STATIC_BLOCK_3_EDIT_PLAYBOOK` Closing the turn 섹션:
- **Past tense only** — "진행 중", "차례대로", "다음 단계", "이어서 진행하겠습니다" 등 미래형 내레이션 금지 (포착된 실제 leak 패턴).
- **finish 필수** — tool 호출 후 반드시 `finish` 를 명시 호출해야 함을 강조. 서버의 round-trip 은 fallback 이며 의존 금지.

#### 2. Harmony control token 누수 (gpt-oss)

##### 증상
gpt-oss-120b 가 `<|channel|>final<|message|>...` 같은 내부 제어 토큰을 응답에 노출. OpenAI SDK 의 SSE 파서가 이를 파싱하다 "Failed to parse input at pos 0: ..." 로 throw → 사용자에게 raw `LLM_CONNECTION_ERROR` 노출.

##### 대응 (2계층)
`openai.client.ts`:
1. **Streaming stripping** — `delta.content` / tool_call arguments 에서 harmony 제어 토큰 제거. 패턴 2개 사용:
   - `HARMONY_CHANNEL_PREAMBLE_REGEX = /<\|channel\|>[\s\S]*?<\|message\|>/g` — preamble 전체 (channel 이름 포함) 한 번에.
   - `HARMONY_STANDALONE_TOKEN_REGEX = /<\|(channel|start|end|message|return|constrain|...)\|>/g` — 잔여 단독 토큰.
2. **Parse error 분류** — catch 블록에서 에러 메세지가 harmony 패턴 매치면 `LLM_OUTPUT_MALFORMED` 로 분류하고 사용자 친화적 한국어 안내문으로 치환. Raw 메세지는 UI 에 노출하지 않음 (로그에만).

#### 3. 에러 UI 시안성 개선

##### 증상
어시스턴트 패널 error box 가 `text-red-800/200` 탁한 shade 사용 → 배경과 대비 부족, 특히 11px 소형 텍스트에서 가독성 낮음.

##### 대응
`assistant-message.tsx` 의 error box 를 systemHint 패턴과 동기화:
- 본문 텍스트: `text-red-950 dark:text-red-50` + `font-medium` — "가장 짙은 shade / 가장 옅은 shade" 대비 극대화.
- 에러 코드 pill: 별도 shade 배경 (red-200 light / red-800 dark) + border 로 명확히 구분.
- 본문 글자 크기 `10px → 11px` 로 상향 (message.error 타이틀과 동일 레벨).
- 긴 영문 에러 메세지 대비 `break-all` 추가.

#### 4. Gemini-3-flash 존재하지 않는 노드 타입 발명

##### 증상
Gemini-3-flash 이 `음식 종류 선택` 같은 label 로 add_node 시도 — catalog 에 없는 type 을 기본 시나리오 표현으로 발명. 첫 `UNKNOWN_NODE_TYPE` 응답의 `suggestedType` / `knownTypes` 힌트도 무시하고 반복 재시도.

##### 대응
1. **`NODE_TYPE_ALIASES` 확장** — LLM 이 빈번히 발명하는 패턴을 실제 존재 타입으로 매핑 추가:
   - `user_input / input / question / prompt / survey / text_input` → `form`
   - `choice / choices / options / selection / selector / button_group / category / buttons` → `carousel`
   - `router / route / branch / conditional` → `switch` (boolean 은 `if_else`)
   - `email / send_mail / mail` → `send_email`
   - `display / show / render / result / output` → `template`

2. **프롬프트 강화** — `STATIC_BLOCK_3_EDIT_PLAYBOOK` Common pitfalls:
   - "Node types are a fixed catalog — do NOT invent new types based on your task wording." 추가.
   - 각 카테고리별 "흔한 오발명 → 실제 타입" 표 내장 (message/input/choice/branching/email 5계열).

3. **UNKNOWN_NODE_TYPE 시 suggestedType 을 알려주는 것에 더해 alias 매핑이 광범위해 대부분의 발명 패턴을 한 번에 교정**.

#### 5. Review guard 항상 발동 (사용자 요구 반영)

##### 증상
`finishBlockCount > 0` skip 조건 때문에 PLAN_NOT_COMPLETE 가 fire 한 다음에는 review 가 발동하지 않음. 사용자 보고: 복잡한 워크플로우에서 plan 가드를 통과한 뒤에도 orphan / pendingUserConfig 미안내 이슈가 여전히 발생.

##### 대응
`evaluateReviewGuard` 의 `shouldSkipReview` 에서 `finishBlockCount > 0` 체크 **제거**. 두 가드는 독립 계층으로 운영:
- PLAN_NOT_COMPLETE — plan 체크박스 충족성 (step ↔ tool call 매핑)
- WORKFLOW_REVIEW_REQUIRED — 워크플로우 품질 (orphan / 실패 미해결 / pendingUserConfig 안내 / fake step 완료)

Plan 가드가 fire 했다는 것은 LLM 이 한 번 보정 했을 뿐, 결과 워크플로우의 품질을 보장하지 않음. 두 가드 모두 fire 하는 3~4 round 시나리오가 현실적 정상 경로.

##### 남은 skip 조건 (최소 안전망)
- `reviewCompleted` / `reviewRoundCount >= 2` — 같은 턴 review 1회 상한
- `planClearedThisTurn` — 화제 전환
- 성공 edit 0 — 실행 턴 아님
- non-trigger 노드 ≤ 1 — trivial 편집 (ROI 낮음)

##### PENDING_USER_CONFIG_UNMENTIONED 상세화
details 문자열에 구체적 노드 label + 빠진 selector 목록을 인라인으로 실어, LLM 이 다음 라운드 한국어 마무리 메세지 작성 시 즉시 참조할 수 있게 함. 예:
> "SendEmail (Integration); AIAgent (LLM Config). In the next round, emit a Korean summary that names each listed node label verbatim..."

> **2026-04-24 업데이트 — 본 가드는 이제 "candidate 0 인 항목" 에만 발동한다.**
> spec ED-AI-39 로 in-message candidate picker 가 도입되어, 워크스페이스에
> 후보가 1건 이상 있으면 프런트 picker 가 UX 를 완결한다. LLM 의 한국어
> mention 은 후보 목록이 비어있어 **사용자가 직접 Integration/LLM/KB/워크플로
> 를 등록해야 하는 경우에만** 필요하다. 상세는
> *workflow-assistant-candidate-picker.md (본 Rationale 섹션 내)*.

#### 6. Plan-only 턴의 핑퐁 루프 차단 (gemini-3-flash-preview)

##### 증상
사용자 보고 (2026-04-23): 복합 설문조사 워크플로우 요청 → gemini-3-flash-preview 가
`propose_plan` 직후 `finish` 를 호출하지 않고 같은 턴에 수십 개의 edit 을 연쇄 발사.
프로바이더가 `finishReason: 'tool_calls'` 로 종료 → 서버가 round-trip → LLM 이
`PLAN_AWAITING_APPROVAL` 피드백을 보고도 또 edit 재시도 → `MAX_TOOL_LOOP_ROUNDS (50)`
도달 → 사용자 UI 에 "진행이 중단됐어요" + 수십 개의 빨간 배지.

##### 대응 (서버 강제)
`stream.service.ts` 의 `shouldContinueLoop` 판정 앞에 단락 가드 추가:
```ts
const planProposedPendingApproval = !!planForTurn && !planForTurn.approvedAt;
if (planProposedPendingApproval) finishReason = 'stop';
const shouldContinueLoop = !planProposedPendingApproval && ...;
```

- Plan 을 제안했는데 아직 미승인 → 이번 턴 내 round-trip 금지 (1 라운드 종료).
- `finishReason` 을 `'stop'` 으로 덮어써 클라이언트가 "승인 대기" UI 로 전환.
- 시스템 프롬프트의 "Plan-only turn | Call finish immediately after propose_plan"
  규칙을 서버가 실제로 enforce. LLM 이 규칙 준수하지 않아도 핑퐁 루프는 발생 안 함.

##### 호환성
- 정상 경로 (`propose_plan` → `finish` 한 라운드 내): `finishResolved=true`,
  `finishReason='stop'` 이 이미 내려가 있어 기존 `shouldContinueLoop=false` 로 자연 종료.
  가드는 중복 발동해도 동일한 최종 결과.
- `clear_plan` 이후 새 plan 없이 edit 만 하는 턴: `planForTurn=null` 이라 가드 미발동.
- History 에서 load 된 approved plan 실행 턴: `planForTurn=null`, 가드 미발동.

##### 회귀 테스트
`stream.service.spec.ts` — "does NOT round-trip when a plan was proposed and is
pending approval, even if the provider reports finishReason=tool_calls
(Gemini-3-flash pattern)". `chatStream` 호출 횟수 1 + `finishReason=stop` + error
이벤트 없음을 동시에 고정.

#### 7. Stall 자동 복구 (gpt-oss-120b 임의 중단)

##### 증상
gpt-oss-120b 가 pending step 이 남은 plan 실행 턴에서 tool call 을 하지 않고
텍스트만 뱉고 `finishReason: 'stop'` 으로 종료. 기존 "edit 성공 round 에만 round-trip"
가드로는 cover 되지 않아 턴이 조용히 끝남. frontend 는 `turnStalledHint` 로
"이어서 진행해줘" 안내를 띄우지만 사용자가 수동으로 follow-up 을 입력해야 했다.

##### 대응 (서버 자동 복구)
`stream.service.ts` 의 기존 `shouldContinueLoop` 뒤에 **stall 복구 블록** 추가:

```ts
const hasPendingActionableSteps = (() => {
  if (planPending || finishResolved) return false;
  if (pendingResultsForLlm.length > 0) return false;  // 이미 위 경로가 cover
  const ctx = findActivePlanContext(...);
  if (!ctx || ctx.status !== 'active') return false;
  return ctx.plan.steps
    .filter(s => s.action !== 'note')
    .some(s => !ctx.completedStepIds.has(s.id));
})();
if (hasPendingActionableSteps && consecutiveStallRounds < MAX_STALL_ROUNDS) {
  consecutiveStallRounds++;
  messages.push({ role: 'assistant', content: roundText });
  messages.push({ role: 'user', content: '이어서 진행해줘.' });
  continue;
}
```

- Text-only stall + pending plan → 서버가 user 역할의 nudge "이어서 진행해줘." 를
  messages 배열에 주입하고 루프 계속. LLM 은 다음 라운드에서 system prompt 의
  Active plan context + user nudge 를 보고 `[ ]` pending step 부터 resume.
- `MAX_STALL_ROUNDS = 2` 로 runaway 방지 — 2 번 연속 stall 하면 실제 막힌 상태로
  간주해 턴 종료 (MAX_TOOL_LOOP_ROUNDS=50 전에 탈출).
- 진척이 있는 라운드는 `consecutiveStallRounds = 0` 으로 리셋.
- 이 값 조정 시 `stream.service.spec.ts` "gives up after MAX_STALL_ROUNDS..." 고정
  테스트도 동시에 업데이트.

##### 호환성
- Plan-only 턴 (미승인): `planPending` 단락으로 stall 가드도 건너뜀 — 사용자 approve
  대기가 올바른 상태.
- 이미 finish 성공: `finishResolved=true` 로 제외.
- Pending step 없음: plan 완료 상태면 nudge 의미 없음 → 가드 비발동.
- `pendingResultsForLlm.length > 0` 인 경우: 기존 shouldContinueLoop 가 이미 cover.

##### 회귀 테스트
`stream.service.spec.ts` "auto-continue on stall with pending plan" describe:
- "auto-nudges LLM when a round ends text-only + stop + plan has pending steps"
- "gives up after MAX_STALL_ROUNDS (2) consecutive text-only stalls to prevent runaway loops"
- "does NOT auto-continue when plan has no pending actionable steps"

#### 8. UX: plan-only 자동 안내 hint 제거 (2026-04-23)

##### 증상
plan-only 턴에서 plan card 와 함께 "계획대로 진행해 주세요." systemHint 가 동시에
노출 → plan card 의 "계획대로 진행" 버튼 + 동일 문구의 info 박스가 중복 메시지로
인식. 사용자 피드백: 버튼이 이미 있으므로 hint 는 불필요.

##### 대응
`frontend/src/lib/stores/assistant-store.ts` 의 done 이벤트 systemHint 분기에서
`planApproveConfirm` 주입 조건을 제거. `turnStalledHint` / `turnCompletedHint` 만
유지. i18n 문자열 자체는 `approveActivePlan` 이 user 메시지로 전송할 때 사용하므로
유지.

#### 9. UX: 에러 버블에 "이어서 진행" 버튼 추가 (2026-04-23)

##### 증상
`ASSISTANT_TOO_MANY_TOOL_CALLS` 에러 발생 시 사용자가 입력창에 "이어서 진행해줘"
를 직접 타이핑해야 복구 가능.

##### 대응
- `continueAfterBudget` action 을 `assistant-store.ts` 에 추가 — `sendMessage`
  래퍼로 locale-aware 메시지 전송.
- `assistant-message.tsx` 에 `RESUMABLE_ERROR_CODES` 집합 (현재 `ASSISTANT_TOO_MANY_TOOL_CALLS`
  1 개) 을 정의, 에러 버블 아래에 "이어서 진행" 버튼 노출. `NO_LLM_CONFIG` /
  `STREAM_FAILED` 는 resume 불가이므로 버튼 없음.
- `assistant-panel.tsx` 가 `onContinueAfterBudget` 콜백을 `AssistantMessageView`
  로 주입해 snapshot 결합 유지 (plan approve 버튼과 동일 패턴).

#### 11. NODE_NOT_FOUND label-lookalike hint (2026-04-24)

##### 증상
LLM 이 `update_node` / `remove_node` / `add_edge` 의 `id` / `source_id` / `target_id`
자리에 사용자에게 보이는 **label** (예: `"SendEmail"`) 을 실수로 넣어
`NODE_NOT_FOUND` 가 연쇄 발생. 이로 인해 config patch 도 전혀 반영 안 되는
2차 증상까지 번짐.

##### 대응 (2-layer)
1. **시스템 프롬프트 강화** (`system-prompt.ts`):
   - Contracts 블록 "Label vs identifier" 섹션에 "Tool arguments: always
     reference a node by its UUID, never by its label" 하위 문단 추가.
     UUID 의 유일한 출처 2가지 (`result.id` / `currentWorkflow.nodes[*].id`)
     명시 + 위반 예 (`update_node({id: "SendEmail"})`) 포함.
   - "Labels are globally unique" 문장에 "유일성은 add_node 충돌 감지용 —
     UUID 대체 근거 아님" 단서 병기.

2. **서버 label-lookalike hint** (`shadow-workflow.ts`):
   - `buildLabelAsIdHint(value)`: shadow 에 `node.label === value` 인 노드가
     있으면 `[hint] Value "<label>" matches the label of an existing node
     (id: <uuid>). ... [/hint]` 형태의 복구 문자열 반환. `findByLabel` 위임으로
     순회 로직 중복 제거. `sanitizeLlmProvidedString` 으로 label 을
     C0+C1+Bidi+zero-width 까지 중화 + `JSON.stringify` 로 escape.
   - `updateNode` / `removeNode`: `NODE_NOT_FOUND` 분기에 바로 hint 부착.
   - `addEdge`: **cascading failed-add_node FIFO 가 먼저**. 비었을 때만
     source 우선 label-lookalike fallback (target 은 source 매치 없을 때만).
     두 힌트가 섞이지 않도록 단일 hint.

##### 호환성·주의
- `ShadowResult.hint` 는 기존부터 optional 필드. 기존 `NODE_NOT_FOUND` 소비자는
  hint 없이도 동일 동작.
- `value.length > LABEL_HINT_MAX_LEN * 4` 는 label 후보에서 제외 (Levenshtein
  유사 방어).
- `[hint] … [/hint]` 마커는 이번부터 label-lookalike 계열에만 적용. 기존
  cascading 힌트 등은 기존 형식 유지.

##### 관련 spec
- `spec/3-workflow-editor/4-ai-assistant.md` §4.4.1 "NODE_NOT_FOUND hint 규칙"
  에 cascading / label-lookalike 의 발동 조건·우선순위·보안 정책 정리.
- §8 "워크플로우 조립 규칙" 행에 "tool argument id 자리 UUID 전용" 한 문장
  추가.

##### 회귀 테스트
`shadow-workflow.spec.ts` → `NODE_NOT_FOUND label-lookalike hint` describe:
- update/remove/add_edge source/target 별 hint 부착
- 양측 label → source 단일 hint
- 공백 전용 id → hint 없음
- cascading FIFO 비어있을 때 label-lookalike fallback 반례
- cascading 우선순위 (FIFO 있으면 cascading hint)
- label sanitisation (newline, `<script>`)

`system-prompt.spec.ts` → "teaches that tool-argument id slots need UUIDs,
never node labels" 로 슬로건 고정 + `result.id` / `nodes[*].id` / "matches the
label of" 매칭.

관련 리뷰: `review/2026-04-24_18-27-09/`.

#### 10. Stall 자동 복구 UX — 메시지 박스 분리 + `auto_resume` SSE 이벤트 (2026-04-24)

##### 배경
§7 의 stall 복구가 발동하면 같은 `assistantText` 에 여러 라운드 텍스트가 누적되어
단일 `WorkflowAssistantMessage` row 로 저장된다. gpt-oss-120b 는 라운드 종료 직전
"계속 진행해도 될까요?" 같은 confirmation 문구를 반복적으로 뱉는 quirk 가 있어,
stall 전·후 라운드의 같은 문구가 한 버블 안에서 2~3번 겹쳐 UX 가 지저분해진다.

##### 대응
**구조적 해결** — 서버가 stall 복구로 추가 라운드를 시작하는 순간, 누적된 텍스트를
별도 row 로 먼저 persist 하고 커서를 리셋한다. 이후 라운드는 새 row 에 누적된다.
프론트에게는 `event: auto_resume` 을 발행해 "새 버블로 분리해 달라" 는 신호를 준다.

**엔티티 변경** — `WorkflowAssistantMessage` 에 3개 필드 추가:
- `autoResumed: boolean` — 이 row 가 복구로 인해 새로 시작된 row 이면 true
- `autoResumeReason: string | null` — 현재 `'stall_pending_steps'` 한 종류
- `autoResumeAttempt: number | null` — 1..MAX_STALL_ROUNDS

마이그레이션 `V020__assistant_message_auto_resume.sql` 로 기본값 false / null 로
기존 row 호환.

**stream.service 변경** — stall 복구 블록 (§7) 에서:
```ts
// 1) 현재까지의 assistant 텍스트를 "중간 row" 로 먼저 persist
await this.persistAssistantTurn(sessionId, assistantText, pendingToolCalls,
  planPersisted ? null : planForTurn, null, 'auto_resume_pending',
  /* resumeMeta */ { autoResumed: false, ... });
if (planForTurn) planPersisted = true;
// 2) 누적 커서 리셋 — 다음 라운드는 새 row
assistantText = ''; pendingToolCalls = [];
// 3) SSE 로 프론트에 신호
yield { event: 'auto_resume', data: { reason, attempt, max } };
// 4) 기존 nudge 주입 + continue
```

턴 종료 시점의 최종 persist 에는 `autoResumed: consecutiveStallRounds > 0` 를 전달.

**`persistAssistantTurn` 시그니처 확장** — 마지막 파라미터로 `resumeMeta` 를 받고
기본값으로 `{autoResumed: false, autoResumeReason: null, autoResumeAttempt: null}`
를 쓴다. 기존 호출부 변경 최소.

**Plan 중복 방지** — 같은 턴 안에 plan 이 최초로 emit 되는 row 에만 plan 을 싣고,
그 뒤로 분리된 row 는 `plan=null` 로 persist. 로컬 `planPersisted` 플래그로 관리.

##### 프론트 변경
- `AssistantSseEvent` union 에 `auto_resume` 추가 (api/assistant.ts)
- `AssistantDisplayMessage` 에 `autoResume?: {reason, attempt, max}` 추가
- `handleSseEvent` 는 그대로 유지하고, `sendMessage` 의 onEvent 콜백에서
  `auto_resume` 이벤트를 가로채 현재 `currentAssistantId` 를 새 UUID 로 갱신하면서
  새 assistant row 를 push.
- `hydrateMessage` 에서 서버의 `autoResumed=true` row 를 `autoResume` 메타로 복원.
- `assistant-message.tsx` 에서 `message.autoResume` 이 있으면 버블 위에 divider
  렌더 ("🔄 자동으로 이어서 진행했어요 (N/M)"). i18n `assistant.autoResumedHint`.

##### 호환성
- 기존 row (autoResumed=false) 는 divider 가 표시되지 않음 → 기존 세션 그대로.
- 정상 턴 (stall 없음): `persistAssistantTurn` 이 한 번만 호출되어 row 1개.
- stall 1회 복구: row 2개 (`auto_resume_pending` + 최종). 최종 row 에만 autoResumed=true.
- stall 2회: row 3개. 최종 row 에 autoResumedAttempt=2.
- `MAX_STALL_ROUNDS` 상한에 걸려 포기하는 경우: 마지막 row 도 autoResumed=true 로
  persist (포기 직전 "이어서 진행해줘" 가 주입되지 않았지만 텍스트가 새 버블로
  분리되는 것은 동일하게 유지 — 서버가 분리 persist 를 이미 수행했음).

##### 회귀 테스트
`stream.service.spec.ts` "auto-continue on stall with pending plan" describe 의
기존 3개 테스트에 다음 어서션 추가:
- `appendMessage` 호출 횟수가 (stall N회) + 1 개 (최종) 임을 확인.
- N+1 개 row 중 중간 row 들은 `finishReason='auto_resume_pending'`, `autoResumed=false`.
- 최종 row 는 `autoResumed=true`, `autoResumeReason='stall_pending_steps'`,
  `autoResumeAttempt=N`.
- SSE 이벤트 스트림에 `event: 'auto_resume'` 이 N회 포함, attempt 가 1..N 순증.
- plan 은 최초 emit 된 row 에만 실리고 이후 row 들의 plan=null.

`assistant-store.test.ts` — `auto_resume` 이벤트 수신 시 messages 배열에 새 row 가
추가되고 `streamingMessageId` 가 갱신되며, `autoResume` 메타가 세팅되는지 검증.

#### 유지보수 체크리스트

- `stripHarmonyTokens` 추가 제어 토큰 관찰 시 `HARMONY_STANDALONE_TOKEN_REGEX` 유니온에 추가.
- `NODE_TYPE_ALIASES` 에 새 alias 추가 시 `shadow-workflow.spec.ts` it.each 케이스에도 추가.
- Review skip 조건 변경 시 `system-prompt.ts` Self-review 섹션 문구 동기화.
- Error UI 스타일 변경 시 systemHint 와 스타일 일관성 유지 (dark/light 모두 950/50 대비 규약).
- Plan-only 가드 (`planProposedPendingApproval`) 의 단락 조건 변경 시 위 "호환성" 3개 시나리오
  모두 회귀 테스트로 고정되어 있는지 확인. `stream.service.spec.ts` 에서 `finishReason=stop`
- `MAX_STALL_ROUNDS` / stall 가드 조건 변경 시: "auto-continue on stall with pending plan"
  describe 의 3 테스트 (auto-nudge / max-stall / no-pending-steps) 동시 업데이트 +
  §10 의 row 분리 / auto_resume 이벤트 어서션도 같이 업데이트.
- `auto_resume` SSE event schema 변경 시: backend `AssistantStreamEvent` union,
  frontend `AssistantSseEvent` union, controller 가 단순 JSON.stringify 하므로
  별도 DTO 없음. `assistant.autoResumedHint` i18n 포맷 (`{{attempt}}/{{max}}`) 도
  페이로드 shape 에 묶여있으니 payload key 이름 변경 시 placeholder 동시 업데이트.
- `WorkflowAssistantMessage` 에 신규 필드 추가 시: migration SQL 과 entity 의
  nullable/default 가 일치해야 한다 (autoResumed default false, 나머지 null).
  `appendMessage` 의 `Partial<WorkflowAssistantMessage>` 수용 패턴 덕분에 서비스
  계층 호출부 변경은 불필요.
- `RESUMABLE_ERROR_CODES` 에 새 에러 코드 추가 시: (1) backend 가 실제로 해당 코드 발행하는지
  확인, (2) "이어서 진행해줘" follow-up 이 의미있는 복구인지 재검토, (3) `continueAfterBudget`
  대신 별도 resume 액션이 필요한지 판단.
  을 기대하는 기존 플래닝 관련 테스트들이 이 가드에 의해 영향받지 않아야 한다.

_원본 메모: memory/workflow-assistant-candidate-picker.md_

### Workflow Assistant — Candidate Picker 정책 결정 (2026-04-24)

#### 배경

2026-04-24 사용자 피드백: "메일전송 노드에 SMTP integration 을 설정해야 하는데, 설정된 항목이 있음에도 스스로 하지를 못해". 기존 정책은 시스템 프롬프트로 `integration-selector` 등 user-action widget 의 id 주입을 **명시적으로 금지** 했고, `PENDING_USER_CONFIG_UNMENTIONED` 리뷰 가드가 "마무리 메시지에 사용자 설정 안내" 를 강제하는 구조였다. 결과적으로 Assistant 는 워크스페이스에 단일 SMTP integration 이 있어도 자동 연결하지 않고 사용자에게 수동 설정을 미뤘다.

#### 최종 정책 (ED-AI-39)

**"설정 가능한 항목이 존재하면 사용자에게 명시적 확인 후 주입, 없으면 기존 안내 유지"** — 방향 B 채택:

- 백엔드 `add_node` / `update_node` 성공 응답의 `pendingUserConfig[i]` 에 **워크스페이스 후보 목록 (`candidates: CandidateEntry[]`)** 을 실어 프런트에 전달.
- 프런트는 해당 edit 버블 아래에 드롭다운 picker 렌더. 사용자 Confirm 클릭 시 `editor-store.updateNode` 로 즉시 반영 (LLM 경유 없음).
- 후보 0개: amber 안내 박스 + Settings 딥링크. 기존 수동 설정 경로 유지.
- 후보 1개도 자동 선택 금지 — 단일 option 드롭다운으로 사용자 확인 필수.
- 적용 scope: 4종 widget 전체 (`integration-selector` · `llm-config-selector` · `kb-selector` · `workflow-selector`).

#### 문서 변경 지도

| 문서 | 섹션 | 변경 요점 |
|------|------|-----------|
| `prd/2-workflow-editor.md` | §10.4 | `ED-AI-39` 신규 — 명시적 확인 + picker UX 의무. |
| `spec/3-workflow-editor/4-ai-assistant.md` | §3.2 | "Candidate picker" 행 추가. |
| | §3.3 | picker 접근성(aria, 키보드) 규정. |
| | §4.3 | 편집 도구 반환 shape 에 `pendingUserConfig?` 명시. |
| | §4.3.1 (신규) | `PendingUserConfigField` / `CandidateEntry` 타입, widget별 조회 범위·상한(20), 프런트 동작, LLM 계약. |
| | §5.3.1 | tool_call.data.result 설명에 `pendingUserConfig` 언급. |
| | §6.0 | rehydrate 시 canvas 현재 값 vs picker 상태 판정 규칙. |
| | §8 | "Selector 필드 정책" 행 추가 — LLM 은 id 빈 값 제출, closing mention 은 candidate 0 case 에만. |
| | §10 | `WORKFLOW_REVIEW_REQUIRED` 행에 `PENDING_USER_CONFIG_UNMENTIONED` 는 candidate 0 에만 발동함을 명시. |
| | §13 | `candidatePicker*` i18n 5키 추가. |
| | §14 | ED-AI-39 매핑. |

#### 구현자가 기억해야 할 계약 (요약)

1. **서버**: `collectPendingUserConfig` 는 기존처럼 schema 를 훑어 비어있는 selector 필드를 수집하되, 추가로 widget 별 저장소(integrationRepo / llmConfigRepo / kbRepo / workflowRepo) 를 워크스페이스 스코프로 쿼리해 `candidates` 를 채운다. 상한 20, connected/최근 등 정렬 규칙은 §4.3.1 표 그대로.
2. **LLM 프롬프트**: §8 "Selector 필드 정책" 행을 `STATIC_BLOCK_3_EDIT_PLAYBOOK` 에 투영. 기존 "You must NOT fill ... surface them in the closing message" 를 "Leave ids empty; server attaches candidates; mention only when candidates list is empty" 로 교체.
3. **Review guard**: `collectUnmentionedPendingUserConfig` 는 `candidates?.length === 0` 인 항목에 대해서만 missingFields 로 카운트. 후보가 1+ 인 항목은 guard 에서 제외.
4. **프런트 렌더**: `AssistantMessageView` 의 tool_call badge 그룹 아래, error bubble 이나 systemHint 보다 **위**에 picker 블록 배치. Confirm 시 `editor-store.updateNode(nodeId, { config: { [field]: selectedId } })` 호출. 이후 picker 는 "✓ 설정됨" 으로 고정 (Undo 로도 picker 상태를 되돌리지 않는다 — UX 복잡도 대비 실익 낮음).
5. **Rehydrate**: `hydrateMessage` 에서 `tool_calls[*].result.pendingUserConfig` 를 읽고, 해당 노드의 현재 canvas 값이 채워져 있으면 "✓ 설정됨", 비어있으면 interactive picker 로 복원. 판정은 editor-store 의 현재 노드 config 에서 `field` 경로를 dot-path 로 읽어 비교.

#### Out of scope (후속)

- Plan 카드 안 picker 통합 UI (현재는 edit 버블 전용).
- Picker 에서 "후보 인라인 등록 (Integration 등록 폼 임베드)" — 현재는 Settings 딥링크.
- Tool-area 노드의 `toolOwnerId` — user-action widget 이 아니라 이번 정책 대상이 아님.
- UI 컴포넌트 테스트 (RTL 환경 미도입).

#### 관련 메모

- *workflow-assistant-provider-quirks-and-review-always.md (본 Rationale 섹션 내)* — 기존 `PENDING_USER_CONFIG_UNMENTIONED` 동작 원본. 본 정책으로 "candidate 0 only" 로 축소됨을 인지.
- *workflow-ai-assistant-decisions.md (본 Rationale 섹션 내)* — Assistant 초기 설계 결정.

#### 실행 계획 (Spec 밖, 구현용)

구현은 `developer` skill 에서 수행. PRD/Spec 업데이트 완료했으므로 다음 단계:

1. Backend: `detect-pending-user-config.ts` 에 widget → repo 매핑 추가. `explore-tools.service` 의 로직 재사용 또는 새 `CandidateLookupService` 를 경유해 per-widget 조회.
2. Backend: `system-prompt.ts` 의 `STATIC_BLOCK_3_EDIT_PLAYBOOK` Selector 정책 블록 교체.
3. Backend: `review-workflow.ts` 의 `collectUnmentionedPendingUserConfig` 를 candidate 0 조건으로 좁힘.
4. Frontend: `assistant-store.ts` 에 picker state / confirm action / rehydrate 판정 추가. `assistant-message.tsx` 에 picker 컴포넌트 삽입.
5. i18n ko/en 사전 5키 추가.
6. 테스트: stream.service.spec 의 pendingUserConfig 기존 케이스를 candidates 포함으로 확장 + 새 review guard 완화 케이스 + frontend store 의 picker 상태 전이 테스트.

_원본 메모: memory/workflow-assistant-execution-tools-decisions.md_

### Workflow AI Assistant — 실행 조회 도구(get_workflow_executions / get_execution_details) 기획 결정 메모

사용자가 어시스턴트의 실행 결과 조회 기능 추가를 요청(2026-04-24)해 project-planner 역할에서 스펙을 확정했다. 배경은 어시스턴트가 자동 생성한 표현식이 분기 `null`로 터졌던 이슈에서 출발 — 어시스턴트가 실행 결과를 읽고 원인을 진단·수정할 수 있어야 유사 실수의 셀프 복구가 가능하다는 사용자 의도.

#### 확정된 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 도구 수 | 2종 (`get_workflow_executions`, `get_execution_details`) | 기존 탐색 도구 6종과 동일 패턴. list→detail 2-step 으로 토큰 경제성 확보 |
| 스코프 | 현재 세션 워크플로의 실행 + 그 실행 트리의 **직계 자식 실행(depth 1)** | 유저의 "sub-workflow node에서 실행된건 1이야 2야?" 질문에 대한 답 — 실행 트리 관점으로 해석. 2 단계 이상 중첩은 별도 호출로 분리해 응답 부피 제어 |
| 민감 필드 마스킹 | `maskSensitiveFields` 공통 유틸 재귀 적용 (apiKey/token/password/secret/authorization/...). 원본은 DB 에 그대로 남김 | 채팅 창에 그대로 렌더되므로 최소 안전 기본값 필수. 기존 유틸 재사용 |
| 페이로드 크기 제한 | **없음** (마스킹만) | 사용자 명시 선택. 대신 2-step 패턴(list → 특정 id detail) 을 프롬프트가 강제 |
| Running/waiting 실행 조회 | 허용 — 현재까지 기록된 부분 타임라인 반환 | §12.2의 "실행 중 편집 도구 거부" 는 read 에 적용하지 않음. 실시간 디버깅 UX |
| 세션 스코프 키 | `session.workflow_id` 에서 자동 유도 — 인자로 `workflowId` 받지 않음 | scope 경계 명확화, LLM 의 잘못된 workflowId 추정 방지 |
| 도구 kind | `'explore'` (read-only) — plan-only 턴에서도 사용 가능, 실행 중 거부 규약 미적용 | 일관성 |

#### 응답 envelope (spec §4.1.1 참조)

```
ExecutionDetailsResponse {
  ok: true,
  execution: { id, workflowId, workflowName, status, startedAt, finishedAt, durationMs,
               inputData(masked), outputData(masked), error(masked),
               parentExecutionId, recursionDepth },
  timeline: [{ nodeExecutionId, nodeId, nodeLabel, nodeType, status,
               startedAt, finishedAt, durationMs,
               inputData(masked), outputData(masked), error(masked),
               retryCount, parentNodeExecutionId }],
  subExecutions: [{ execution, timeline }],   // depth 1
  subExecutionsTruncatedDepth?: number        // 추가 depth 생략 신호
}
```

에러 코드:
- `EXECUTION_NOT_FOUND` — id 없음 or workspace 밖
- `EXECUTION_NOT_IN_SCOPE` — id 는 있지만 현재 세션 워크플로의 실행/직계 자식이 아님

#### 구현 단계에서 유의 사항 (실제 구현 반영)

1. **Repository 직접 주입으로 전환.** 기획 단계에서는 `executions.service.ts` 의 `findById` / `findByWorkflow` 를 어댑터로 감쌀 계획이었으나, 구현 시 다음 이유로 Repository 를 직접 주입했다: (a) `ExecutionsService.findById` 는 `NotFoundException` (Nest HTTP exception) 을 던져 tool-result envelope `{ok: false, error}` 와 맞지 않음. (b) `findByWorkflow` 는 컨트롤러용 DTO 래퍼(`PaginatedResponseDto`) 를 반환해 LLM 응답에는 오버스펙. (c) 기존 `listWorkflows`/`listIntegrations` 도 동일한 Repository 직접 주입 패턴. 향후 `ExecutionsService` 에 RBAC 같은 cross-cutting 규칙이 들어가면 그때 서비스 주입으로 전환한다 — `explore-tools.service.ts` 클래스 상단 주석에 이 trade-off 명시.
2. **스코프 검증.** `get_execution_details` 는 다음 순서로 허용 여부 판정:
   a. `executions.findById(id)` — 없으면 `EXECUTION_NOT_FOUND`.
   b. `execution.workflowId === session.workflowId` 면 통과.
   c. 그렇지 않으면 `execution.parentExecutionId` 가 가리키는 부모를 한 번 조회해 `parent.workflowId === session.workflowId` 면 통과.
   d. 둘 다 아니면 `EXECUTION_NOT_IN_SCOPE`. (workspace 경계 체크는 `execution.workflow.workspaceId === session.workspaceId` 로 별도 수행 → 없으면 `EXECUTION_NOT_FOUND` 와 동일 취급으로 information leak 방지.)
3. **sub-workflow 확장.** 통과한 `execution` 에 대해 `executions.repo.find({ where: { parentExecutionId: execution.id } })` 로 직계 자식 목록을 조회, 각각에 대해 `findById` 를 불러 `subExecutions` 채움. 2-depth 이상은 자식 실행의 `subExecutions` 를 채우지 않고 `subExecutionsTruncatedDepth: 1` 를 세팅. 자식 실행의 `nodeExecutions.length > 0` 이면 이미 내부에 sub-workflow 가 존재한다는 힌트 — `subExecutionsTruncatedDepth` 는 자식 한 건이라도 2-depth 자손이 있으면 발행.
4. **마스킹 구현.** `backend/src/common/utils/mask-sensitive-fields.util.ts` 재사용. 응답 직렬화 직전에 `inputData`/`outputData`/`error` 필드를 각각 한 번씩 통과시킴. 원본 DB row 는 건드리지 않음.
5. **tool kind 분류.** `tool-definitions.ts:15-30` 의 `TOOL_KIND_BY_NAME` 에 두 이름을 `'explore'` 로 추가.
6. **dispatch 추가.** `workflow-assistant-stream.service.ts` 의 `handleExploreCall()` switch 에 두 case 추가.
7. **시스템 프롬프트 갱신.** `system-prompt.ts` 에 "실행 이슈 진단 패턴" 한 단락(2-step: list → detail) 추가. 스펙 §8 에 이미 해당 행 추가됨 — 프롬프트 구현은 그 내용을 옮기기만 하면 됨.
8. **테스트.** `explore-tools.service.spec.ts`(없으면 신설) 에 `EXECUTION_NOT_FOUND` / `EXECUTION_NOT_IN_SCOPE` / 마스킹 / sub-workflow 확장 / running 상태 부분 타임라인 5 케이스 선작성. `workflow-assistant-stream.service.spec.ts` 에도 end-to-end mock 추가.
9. **국제화.** `frontend` 의 `ko.ts`/`en.ts` 에 `assistant.exploreExecutionsList`, `assistant.exploreExecutionDetails`, `assistant.executionNotInScope` 3개 키 추가.

#### 영향 문서 (이번 턴에 개정 완료)

- `prd/2-workflow-editor.md` — §10.9 `ED-AI-35~38` 추가
- `prd/6-phase2-ai.md` — §3.6 cross-ref 에 실행 조회 권한 한 줄 보강
- `prd/7-execution-history.md` — §3.3 `EH-NAV-04` 추가 (❌ 로드맵)
- `spec/3-workflow-editor/4-ai-assistant.md` — §4.1 도구 2 row, §4.1.1 응답 구조 신설, §8 프롬프트 지침, §12.2 read 허용, §13 i18n 3개, §14 매핑
- `spec/0-overview.md` — 매핑표에 `ED-AI-*` → `Spec 3-workflow-editor/4` 로 이미 있음 (변경 불필요)

#### 열린 주제 (후속 개정 시 검토)

- 2-depth 이상 sub-workflow 의 확장 UX: 현재는 `subExecutionsTruncatedDepth` 플래그로만 신호하고 별도 조회. 유저 보고가 누적되면 optional 인자 `depth?: number` 추가를 검토.
- Running 실행의 "부분 타임라인" 응답 포맷 안정성: WebSocket 스트림과 REST 조회 시점의 race 로 동일 실행이 조회 시마다 다른 timeline 을 돌려줄 수 있다. 어시스턴트에게 이를 "스냅샷" 으로 인식하도록 프롬프트에 명시할지 여부 — MVP 에선 별도 지침 없이 진행, 실 사용 중 혼선 보고되면 §8 에 단락 추가.
- `get_workflow_executions` 에 `search` / `dateRange` 옵션 추가 여부: PRD 7 의 `/executions/workflow/:workflowId` REST API 가 이미 status/sort/page 를 지원하므로 서버 측 추가 쿼리 없이도 확장 가능. 사용자 요청이 들어오면 증분 추가.

_원본 메모: memory/workflow-assistant-runtime-ports-hint.md_

### Workflow Assistant — Runtime ports hint (ED-AI-40, 2026-04-24)

#### 배경

사용자 보고: Assistant 가 `add_node` 직후 `add_edge` 를 시도할 때 두 가지 패턴으로 실패가 자주 일어난다.

1. **PORT_NOT_FOUND** — `carousel` / `switch` 의 dynamic 포트(`btn_korean`, `case_yes` 등) 를 몰라 `out` 으로 보내 실패. 서버가 `knownPorts` 힌트를 돌려줘 다음 라운드에서 복구하지만, UI 에 빨간 배지가 찍히는 게 "실패 잦음" 으로 체감.
2. **NODE_NOT_FOUND** — `add_node` 의 server-assigned UUID 를 기다리지 않고 예측한 id 로 `add_edge` 시도. cascading 실패 FIFO 로 복구되지만 역시 빨간 배지.

기능적으로는 복구가 잘 작동 — UX 만 "실패가 잦다" 로 체감되는 문제.

#### 결정 (ED-AI-40)

**A+B 조합**:

- **A (backend)**: `add_node` / `update_node` 성공 응답의 `result` 에 `ports: { outputs, inputs }` 자동 포함. static · dynamic-ports 모두. shape 은 풍부형 `{id, type?, label?}`. LLM 은 별도 `get_node_schema` 없이 이 ports 를 그대로 다음 `add_edge` 의 `source_port` / `target_port` 에 쓴다. 결과: "잘못된 port 로 쏘고 PORT_NOT_FOUND" 경로가 구조적으로 사라짐.

- **B (frontend)**: tool-call 배지 그룹핑을 확장해 `PORT_NOT_FOUND` / `NODE_NOT_FOUND` 실패 직후 같은 source/target 의 성공이 오면 두 배지를 **"재시도 후 성공"** 한 개로 축약. 다른 shadow 에러(LABEL_CONFLICT 등) 는 기존 빨간 배지 유지.

#### 문서 변경 지도

| 문서 | 섹션 | 변경 |
|------|------|------|
| `prd/2-workflow-editor.md` | §10.4 | `ED-AI-40` 신규 — runtime ports + 재시도 배지 축약. |
| `spec/3-workflow-editor/4-ai-assistant.md` | §3.2 | "재시도 후 성공 축약" 행 추가. |
| | §4.3 | 편집 도구 반환 shape 에 `ports?` 명시. |
| | §4.3.2 (신규) | `RuntimePorts` / `RuntimePortDescriptor` 타입·조립 규칙·LLM 계약. |
| | §5.3.1 | tool_call.data.result 설명에 `ports` 언급. |
| | §8 | "노드 카탈로그" / "워크플로우 조립 규칙" 행에서 `get_node_schema` 선행을 "대부분 불필요" 로 완화, `result.ports` 를 "직접 사용" 하도록 명시. |
| | §13 | `toolCallBadgeRetryRecovered` 1 키. |
| | §14 | ED-AI-40 매핑. |

#### 구현자가 기억할 계약

##### Backend

1. `ShadowWorkflow.addNode` / `updateNode` 성공 시 `ports: RuntimePorts` 를 함께 반환.
2. `outputs` 계산은 기존 `resolveEffectiveOutputPorts(config, def)` 재사용 — shadow 의 portResolver 가 이미 호출하는 함수. 여기서는 반환값을 `{id, type?, label?}` 로 매핑.
3. `inputs` 는 `def.ports.inputs` 그대로 (현재 모든 노드가 static inputs).
4. Dynamic-ports 노드의 case/button id 가 없으면 기존과 동일 fallback (`case_0`, `btn_0`) 이 발행되고 그 fallback id 가 `ports.outputs` 에도 실린다 — LLM 은 이 id 로도 add_edge 가능.
5. 상한 50 (한 쪽당). 초과는 truncate 하고 `portsTruncated: true` 같은 플래그 없이 그냥 자른다 (현실 발생 시나리오 없음).
6. System prompt `STATIC_BLOCK_*` 에서 "[dynamic-ports] → MANDATORY `get_node_schema`" 를 "`result.ports.outputs[*].id` 를 그대로 사용" 으로 교체.

##### Frontend

1. `tool-call-badge.tsx` 의 `groupToolCalls` 에 recovery grouping 로직 추가:
   - 실패 배지 `call.result.error ∈ {'PORT_NOT_FOUND', 'NODE_NOT_FOUND'}` 이고
   - 같은 `(source_id, target_id)` (arg 기준) 의 성공 배지가 곧이어 (또는 cascading NODE_NOT_FOUND 는 같은 source 기준) 나타나면
   - 두 배지를 하나의 "재시도 후 성공" 그룹으로 묶음.
   - 성공 배지가 없으면 기존대로 실패 빨간 배지 유지.
2. 축약 배지 클릭/hover 시 원본 실패 이유 (실패 port 값, 실패 에러 코드) 와 성공 시 port 값 모두 노출.
3. i18n `assistant.toolCallBadgeRetryRecovered` 추가.

##### 회귀 테스트

- Backend: `shadow-workflow.spec.ts` — addNode(carousel) 반환에 `ports.outputs` 가 버튼 id 포함. update_node 로 switch.cases 수정 시 새 case_* port 반영.
- Backend: `workflow-assistant-stream.service.spec.ts` — tool_result 에 `ports` 가 실리는지 어서션.
- Backend: `system-prompt.spec.ts` — `[dynamic-ports]` 문구 단독으로 체크하던 어서션을 "ports from add_node" 기조로 교체.
- Frontend: `tool-call-badge.test.ts` — (1) 같은 source/target PORT_NOT_FOUND → 성공 → 1 배지, (2) LABEL_CONFLICT → 성공 → 2 배지 유지 (축약 안 됨), (3) NODE_NOT_FOUND cascading → 최종 성공 → 1 배지.

#### 연관 메모

- *workflow-assistant-candidate-picker.md (본 Rationale 섹션 내)* — `pendingUserConfig` 가 result 에 실리는 것과 동일 채널을 쓴다 (tool_result 에 함께 embed).
- *workflow-assistant-provider-quirks-and-review-always.md (본 Rationale 섹션 내)* — DANGLING_OUTPUT_PORTS review guard 는 그대로 유지. 이번 변경은 "실패→복구" 라운드를 줄일 뿐 guard 자체와는 무관.

#### Out of scope

- `get_node_schema` 도구 자체 제거 — backward compat 로 유지.
- `add_edge` 의 `source_label` / `target_label` 지원 (C 안) — 별도 과제.
- Static 노드 port 의 한글 `label` 보강 — def 에 없으므로 생략.
