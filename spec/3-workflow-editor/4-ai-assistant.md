# Spec: Workflow AI Assistant

> 관련 문서: [PRD 워크플로우 에디터 §10](../../prd/2-workflow-editor.md#10-ai-assistant-ed-ai-) · [PRD AI 플랫폼 §3.6](../../prd/6-phase2-ai.md) · [Spec 캔버스 §1 레이아웃](./0-canvas.md) · [Spec 노드 공통](./1-node-common.md) · [Spec 실행/디버깅](./3-execution.md) · [Spec LLM 클라이언트](../5-system/7-llm-client.md) · [Spec 데이터 모델 §2.20~2.21](../1-data-model.md#220-assistantsession) · [Spec WebSocket](../5-system/6-websocket-protocol.md)

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
| Azure 스트리밍 | OpenAI 호환 엔드포인트의 스트리밍 검증 범위 밖 — 후속 작업 |
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

**plan-only turn 강제.** `propose_plan` 이 호출된 턴은 반드시 **plan 발행으로만 끝나야** 한다. 같은 턴에 edit tool 을 호출하면 서버가 `PLAN_AWAITING_APPROVAL` 로 거부(§4.4) 하므로, LLM 은 plan 을 만든 뒤 짧은 한국어 메시지로 사용자에게 approve 를 요청하고 턴을 종료해야 한다. 사용자의 approve 메시지가 시작하는 다음 턴에서 실제 edit 이 실행된다. 이 강제는 "계획 제시 → 사용자 승인 → 실행" 3단계 UX 가 깨지지 않도록 보장한다.

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
| 에러 배지 (⚠ 빨강) | 편집 도구 실패. shadow 검증 실패 사유 표시 |
| **에러 bubble** | `event: error` (예: `ASSISTANT_TOO_MANY_TOOL_CALLS`, `ASSISTANT_STREAM_FAILED`) 를 토스트가 아닌 해당 assistant 메시지 버블 아래 빨간 박스로 렌더한다. 채팅 맥락에서 "왜 중단됐는지" 와 복구 방법(code + message) 이 그대로 보이므로 사용자가 다음 액션을 바로 선택할 수 있다 |
| **Stalled turn hint** | assistant 가 텍스트 출력 없이(= content 공백) 정상 종료(`done`) 되었고 **실행 중 plan**(버튼 승인 또는 자연어 승인으로 step 이 1개 이상 done) 에 실행 가능한 pending step 이 남아있으면, 프론트가 해당 메시지에 `systemHint.kind = 'info'` 로 "이어서 진행해줘 라고 답해 주시면 남은 단계를 계속 실행할게요." 를 자동 주입해 **amber info 박스** 로 렌더한다. 승인 대기 중 plan 에는 "계획대로 진행" 버튼이 이미 노출되므로 힌트를 띄우지 않는다 |
| **Turn completion hint** | 이번 턴 종료 시점에 활성 plan 의 `note` 를 제외한 모든 step 이 `done` 이고 `openQuestions` 도 비어있으면, `systemHint.kind = 'success'` 로 "작업을 완료했어요 — N개 단계 실행 성공." 을 주입해 **emerald success 박스**(체크 아이콘) 로 렌더한다. 사용자가 작업 종료를 즉시 인지하도록 하며, 에러가 발생한 경우 error bubble 이 우선되어 success hint 는 띄우지 않는다 (우선순위: error > stalled > completed) |
| Plan 카드 | §2.2 참조 |
| 입력창 | 1줄 기본, 최대 6줄까지 자동 확장. Stop 버튼은 스트리밍 중에만 노출 |

### 3.3 접근성

| 항목 | 값 |
|------|-----|
| 패널 root | `role="complementary"` + `aria-label="AI Assistant"` |
| 메시지 리스트 | `role="log"` + `aria-live="polite"` — 스트림 텍스트는 delta 단위로 읽어주지 않고 메시지 완결 시점에만 공지 |
| 입력창 | `aria-label="Assistant에게 요청 입력"` |
| Plan 카드 | 체크박스는 `role="checkbox" aria-checked` + `aria-disabled=true` (사용자 조작 불가, 진행도 표시 전용) |
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

> 탐색 도구는 모두 세션의 `workspace_id` 스코프 내에서만 조회한다. 워크스페이스 경계를 넘는 데이터는 반환하지 않는다.
>
> **현재 워크플로우 조회는 2-tier 구조다.** ① 매 턴 시작 시의 스냅샷이 시스템 프롬프트(§8)에 JSON으로 주입되어 있으므로, "현재 캔버스에 무엇이 있나?" 류의 단순 조회는 도구 호출 없이 프롬프트를 직접 읽어 답한다. ② 편집 도구를 호출한 뒤 결과 상태를 재확인해야 할 때만 `get_current_workflow`를 호출한다.

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
| `add_node` | `{type, label, position: {x, y}, config, planStepId?, planStepIds?}` | `{ok, id?, error?}` |
| `update_node` | `{id, patch: {label?, config?, position?}, planStepId?, planStepIds?}` | `{ok, error?}` |
| `remove_node` | `{id, planStepId?, planStepIds?}` | `{ok, removedEdgeIds?, error?}` |
| `add_edge` | `{sourceId, sourcePort?, targetId, targetPort?, type?, planStepId?, planStepIds?}` | `{ok, id?, error?}` |
| `remove_edge` | `{id, planStepId?, planStepIds?}` | `{ok, error?}` |
| `finish` | `{summary?: string}` | 성공: 루프 종료(`finishReason: 'stop'`) · 실패: `{ok: false, error: 'PLAN_NOT_COMPLETE', pendingSteps, openQuestions}` (루프 지속) | 대화 루프 종료 시그널. 활성 plan(이번 턴의 `propose_plan` 또는 히스토리 최근 plan)에 `note` 를 제외한 pending step 이 남아있거나 `openQuestions` 가 비어있지 않으면 서버가 실패를 반환해 LLM 이 한 번 더 작업하도록 유도한다. 같은 턴 안의 두 번째 finish 는 무한 루프 방지를 위해 안전 탈출(정상 `finishReason: 'stop'`)로 허용된다. `planForTurn` 이 없고 현재 턴 편집이 히스토리 plan 의 step 과 매칭되지 않는 단발성 편집은 guard 를 발동시키지 않는다. **같은 턴에서 `clear_plan` 이 먼저 호출된 경우 guard 는 발동하지 않는다** (화제 전환으로 간주) |

### 4.4 Shadow 검증 규칙

| 규칙 | 실패 시 반환 |
|------|--------------|
| `type`이 등록된 노드 타입이어야 함 | `{ok: false, error: 'UNKNOWN_NODE_TYPE'}` |
| `label`은 워크플로우 내 유일해야 함 | `{ok: false, error: 'LABEL_CONFLICT', suggested?: string}` |
| `add_edge`의 source·target이 존재해야 함 | `{ok: false, error: 'NODE_NOT_FOUND'}` |
| Trigger 노드는 컨테이너 child가 될 수 없음 | `{ok: false, error: 'CONTAINER_INVALID_CHILD'}` |
| Manual Trigger 노드는 삭제 불가 | `{ok: false, error: 'MANUAL_TRIGGER_PROTECTED'}` |
| 순환(cycle) 유발 | `{ok: false, error: 'CYCLE_DETECTED'}` |
| 같은 턴에 `propose_plan` 호출 이후 edit tool 시도 (plan-only turn 강제) | `{ok: false, error: 'PLAN_AWAITING_APPROVAL', message}` — LLM 은 한국어 메시지로 턴 종료하고 사용자 approve 대기 |

실패 시 LLM은 tool_result를 받아 재시도하거나 사용자에게 상황을 보고한다.

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
| `usage` | 토큰 사용량 | (UX 표시는 선택) |
| `done` | 어시스턴트 턴 종료 | 스트리밍 UI 종료, 입력창 활성화 |
| `error` | 실패 | 에러 배지 + 재시도 안내 |

#### 5.3.1 `tool_call.data` 구조

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `string` | LLM 이 생성한 tool_call id. history rehydration 및 plan step 매칭에 사용 |
| `name` | `string` | 도구 이름 (§4.1 / §4.3) |
| `arguments` | `object` | LLM 이 생성한 인자 (파싱 완료된 JSON 객체) |
| `result` | `unknown` | 도구 실행 결과. 편집 도구는 `{ok, id?, error?, ...}`, 탐색 도구는 도구별 응답 shape |
| `kind` | `'explore' \| 'edit'` | 후처리 분기 discriminator |
| `planStepId` | `string?` | `kind='edit'` 일 때 LLM 이 매칭한 plan step id (단일, legacy 단축형) |
| `planStepIds` | `string[]?` | 한 tool-call 이 여러 plan step 을 cover 할 때 사용. 소비자는 `planStepId` 와 `planStepIds` 의 union 으로 완료 처리해야 한다 |

`data.kind` 값별 프론트 동작과 포함 도구:

| `data.kind` | 포함 도구 | 프론트 동작 |
|-------------|-----------|-------------|
| `explore` | `get_node_schema`, `list_integrations`, `list_workflows`, `get_workflow`, `get_current_workflow`, `list_knowledge_bases` | 메시지에 탐색 배지 추가 (§3.2) |
| `edit` | `add_node`, `update_node`, `remove_node`, `add_edge`, `remove_edge` | `editor-store` 에 즉시 반영 + 메시지에 편집 배지 추가. `data.planStepId` 가 있으면 해당 plan step 을 ✓ 처리하고, 없거나 매칭 실패 시 순서상 다음 pending step 을 ✓ 처리 (§2.2) |

> `finish` 와 `clear_plan` 은 서버 내부 상태 변경용으로만 쓰여 SSE 로 발행되지 않는다. 프론트는 `clear_plan` 호출 직후 즉시 Plan 카드를 제거하지 않고, 다음 턴 스트림에서 plan 관련 이벤트가 오지 않는 것으로 자연스럽게 "해제됨" 상태를 인지한다. `propose_plan` 은 `tool_call` 이 아닌 전용 `event: plan` 으로 발행된다.

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
| `ASSISTANT_STREAMING_UNSUPPORTED` | 해당 provider가 아직 스트리밍 미지원 (예: Azure) | "이 모델은 현재 Assistant에서 지원하지 않아요. OpenAI/Anthropic/Google을 사용해 주세요." |
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
| 노드 카탈로그 | `NodeComponentRegistry.listDefinitions()` 결과를 요약(type, category, description, 주요 config 필드, ports). `isDynamicPorts` 노드는 static 출력 포트 뒤에 `[dynamic-ports]` 마커를 붙여 LLM 이 `get_node_schema` 선행 호출이 필요함을 알 수 있게 한다. 전체 JSON Schema 는 `get_node_schema` 로 on-demand |
| 워크플로우 조립 규칙 | 새 노드 추가 시 데이터 경로가 `manual_trigger` 에서 시작되도록 반드시 `add_edge` 로 연결, 고립 노드 금지. `isDynamicPorts` 노드에 연결하기 전에는 `get_node_schema` 로 실제 포트 목록을 먼저 확인. `openQuestions` 가 있는 plan 은 사용자 답변을 받기 전에 `finish` 호출 금지 |
| I/O 규약 | [`CONVENTIONS.md`](../../user_memo/node-specs-improvement/CONVENTIONS.md) 의 Principle 0, 1.1, 2, 8 요약을 복사 투입 |
| 현재 워크플로우 | `currentWorkflow` 요약 JSON. 섹션 앞에 "authoritative snapshot" 지침을 동반 — 단순 조회는 프롬프트에서 직접 답하고, 편집 이후 재확인에만 `get_current_workflow` 호출 |
| 레이아웃 지침 | 스냅샷의 노드별 측정값(`width`/`height`, px) 이 있으면 그것을 기준으로 `x = predecessor.x + (predecessor.width ?? 250) + 32` 배치. 분기 시 y offset 은 `max(predecessor.height ?? 80, 80) + 24` 기준. 측정값이 없는 노드(초기 렌더 전 또는 동일 턴에 방금 추가된 노드)는 250×80 px 를 폴백으로 가정 — "발명 금지" |
| 참조 표기 | `$node["label"].output.*` 사용, label은 유일, `manual_trigger`가 진입점 |
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
| `finish` guard 반복 block | 같은 턴 안에서는 최대 1회만 `PLAN_NOT_COMPLETE` 로 block. 두 번째 finish 는 정상 탈출(`finishReason: 'stop'`)로 허용해 LLM 의 해석 오류로 인한 무한 루프를 방지 |
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
| Azure OpenAI | ❌ v1 제외 |
| Local (Ollama/vLLM) | 🚧 OpenAI 호환 API면 자동 지원 가능, MVP에서는 테스트 범위 밖 |

상세 인터페이스는 [Spec LLM 클라이언트 §8 Streaming](../5-system/7-llm-client.md#8-스트리밍-streaming) 참조.

---

## 12. 관련 타 스펙과의 동작 상세

### 12.1 캔버스

- Assistant의 편집은 캔버스 자동 저장(2초 디바운스)에 그대로 편입된다. 사용자는 Assistant 작업 중에 수동 저장(Ctrl+S)·실행(Run)을 언제든 할 수 있다.
- 컨테이너(Loop/ForEach/Map) 관련 편집은 §11.2.1 container 전파 규칙을 그대로 따른다. Assistant는 이 규칙을 시스템 프롬프트로 인지한다.

### 12.2 실행/디버깅

- Assistant는 워크플로우 실행 API를 호출하지 않는다. 실행은 사용자 몫이다.
- 실행 중(Run Results 드로어 노출) 편집 도구는 shadow 단계에서 `ASSISTANT_WORKFLOW_RUNNING` 에러로 거부된다.

### 12.3 LLM Config

- 지정 config가 삭제되었는데 세션 `llm_config_id`에 남아 있으면, 첫 메시지 전송 시 서버가 workspace default로 자동 폴백하고 사용자에게 toast로 안내한다.
- 사용량은 기존 `llm_usage_log`에 `workflow_id`, `workspace_id`와 함께 기록된다(별도 source 구분자는 선택적으로 `source: 'assistant'` 메타 필드 추가).

---

## 13. i18n 키

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

---

## 15. 후속 로드맵 (out of scope for v1)

- 다중 워크플로우 배치 편집 (여러 워크플로우를 한 대화에서 수정)
- 세션 공유/팀 협업 (팀 워크스페이스 RBAC 선행 필요)
- 버전 롤백 제안 ("이 Assistant 편집을 한 묶음으로 버전 스냅샷에 포함할까요?")
- 자동 테스트 케이스 생성 제안
- Azure 스트리밍 지원
