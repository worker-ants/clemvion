---
id: ai-agent
status: partial
code:
  - codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts
  - codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts
  - codebase/backend/src/nodes/ai/ai-agent/ai-agent.component.ts
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/*.ts
  - codebase/backend/src/modules/execution-engine/execution-engine.service.ts
pending_plans:
  - plan/in-progress/ai-agent-tool-connection-rewrite.md
  - plan/in-progress/ai-context-memory-followup-v2.md
---

# Spec: AI Agent

> 관련 문서: [AI 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec MCP Client](../../5-system/11-mcp-client.md) · [Spec RAG 검색](../../5-system/9-rag-search.md) · [Spec Graph RAG](../../5-system/10-graph-rag.md) · [Spec LLM Config](../../2-navigation/6-config.md) · [CONVENTIONS](../../conventions/node-output.md)

LLM 기반 AI Agent를 실행. 프롬프트, RAG, Tool Use를 지원. **Single Turn**(단일 호출) 및 **Multi Turn**(대화형 블로킹) 모드를 제공.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| mode | `single_turn` / `multi_turn` | ✓ | `single_turn` | 실행 모드 |
| llmConfigId | UUID | | — | 사용할 LLM 프로바이더 설정. [공통 §1](./0-common.md#1-llm-모델config-선택) |
| model | String (Expression 가능) | | — | 모델 ID (프로바이더별). `{{ }}` 템플릿 허용 |
| systemPrompt | String (Expression 가능) | | — | 시스템 프롬프트 (마크다운, 표현식 지원) |
| userPrompt | String (Expression 가능) | | — | 사용자 프롬프트. **single_turn 전용** — multi_turn 으로 mode 전환 시 frontend `clearFields` 가 자동 제거하며, backend 도 multi_turn 에서는 무시한다 (server-side safety net) |
| temperature | Float | | LLMConfig 기본값 | 오버라이드 |
| maxTokens | Integer | | LLMConfig 기본값 | 오버라이드 |
| responseFormat | `text` / `json` | ✓ | `text` | 응답 형식 |
| jsonSchema | JSONSchema | | — | `responseFormat=json` 시 출력 스키마 |
| knowledgeBases | UUID[] | | `[]` | 참조할 Knowledge Base ID 목록. [공통 §2](./0-common.md#2-knowledge-base-연동-ai-agent-전용) |
| ragTopK | Integer | | `5` | KB tool 호출 시 반환할 청크 수의 기본값 (LLM 이 호출 인자로 override 가능). KB `rerank_mode ≠ off` (Planned) 면 **리랭크 후** 최종 청크 수로 해석 ([Spec RAG 검색 §3.3](../../5-system/9-rag-search.md#33-검색-후처리--리랭킹-선택적)) |
| ragThreshold | Float | | `0.7` | 최소 유사도 임계값 (0-1) 의 기본값 (LLM 이 호출 인자로 override 가능). KB `rerank_mode ≠ off` (Planned) 면 cosine 임계가 아니라 **리랭크 점수 임계**로 해석 |
| mcpServers | McpServerRef[] | | `[]` | MCP-capable Integration 참조 목록. `service_type ∈ ('mcp', 'cafe24', 'makeshop')` 모두 수용 — `cafe24`·`makeshop` 은 backend `Cafe24McpToolProvider`·`MakeshopMcpToolProvider` 가 in-process `AgentToolProvider` 구현체로 동작 ([Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge-in-process)). [공통 §3](./0-common.md#3-mcp-서버-연결-ai-agent-전용) |
| maxToolCalls | Integer | ✓ | `10` | 최대 도구 호출 횟수 (KB·MCP·일반 합산) |
| includeSystemContext | Boolean | | `true` | systemPrompt 앞에 시각·timezone prefix 자동 prepend. [공통 §11](./0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix) |
| systemContextSections | String[] | | `['time', 'timezone']` | prefix 섹션. 허용 값: `time` / `timezone` / `workspace` / `node`. [공통 §11.1](./0-common.md#111-설정-필드-3-노드-공통) |
| contextScope | `none` / `thread` / `lastN` | ✓ | `none` | 자동 주입할 thread 범위. [공통 §10](./0-common.md#10-conversation-context-자동-컨텍스트-주입). **`memoryStrategy ≠ manual` 시 무효** (자동 전략이 대체) |
| contextScopeN | Integer | | `20` | `lastN` 시 최근 N개 turn. **`memoryStrategy ≠ manual` 시 무효** |
| contextInjectionMode | `messages` / `system_text` | | `messages` | 주입 형식. [공통 §10](./0-common.md#10-conversation-context-자동-컨텍스트-주입). `memoryStrategy ∈ {summary_buffer, persistent}` 시에는 **최근 원문 turn 의 주입 형식**으로만 의미를 갖고 (요약/회수 블록은 항상 system_text 안정 프리픽스, §6.1), `manual` 외 strategy 의 thread 범위 선택은 무효 |
| includeToolTurns | Boolean | | `false` | `ai_tool` turn 도 thread 에 push (default 는 final assistant 만 push). **`memoryStrategy ≠ manual` 시 자동 주입 측면에서는 무효** (push 자체는 thread 누적 컨트랙트라 유지) |
| excludeFromConversationThread | Boolean | | `false` | 본 노드 turn 을 thread 에서 제외 (opt-out). thread 누적 opt-out 이므로 `memoryStrategy` 와 독립 (자동 전략에서도 적용) |
| memoryStrategy | `manual` / `summary_buffer` / `persistent` | | `manual` | 대화 컨텍스트 메모리 **관리 전략** ([공통 §10](./0-common.md#10-conversation-context-자동-컨텍스트-주입)). `manual`(기본) = 위 contextScope 계열 5필드 동작 그대로 (하위호환). `summary_buffer` = 단일 실행 내 토큰예산 롤링 요약 압축. `persistent` = summary_buffer working-memory + 세션 간 추출 메모리 의미검색 회수 ([Spec Agent Memory](../../5-system/17-agent-memory.md)). **`manual` 외 선택 시 contextScope 계열 5필드는 무효** (자동 전략이 대체) |
| memoryTokenBudget | Integer | | `8000` | `memoryStrategy ∈ {summary_buffer, persistent}` 시 working-memory 토큰 예산. 초과분을 오래된 turn 부터 롤링 요약 압축 (§6.1). char-기반 cap (contextScope 계열, [conversation-thread §5.3](../../conventions/conversation-thread.md#53-cap-v1--char-기반)) 과 별개 메커니즘 |
| memoryKey | String (Expression) | | — | `memoryStrategy: 'persistent'` 시 메모리 스코프 키. `(workspace_id, memoryKey)` 가 세션 간 영속 네임스페이스 (개인화). 미설정 시 `execution_id` 로 fallback → 세션 단위 격리 ([Spec Agent Memory §스코프 키](../../5-system/17-agent-memory.md)) |
| memoryTopK | Integer | | `5` | `persistent` 메모리 회수 시 top-k 청크 수. **persistent 메모리 회수 전용 — KB 검색용 `ragTopK` 와 독립** (서로 다른 검색 대상: agent_memory vs KnowledgeBase) |
| memoryThreshold | Float | | `0.7` | `persistent` 메모리 회수 최소 유사도 (0-1). **persistent 메모리 회수 전용 — KB 검색용 `ragThreshold` 와 독립** |
| maxTurns | Integer | | `20` | Multi Turn 모드 시 최대 대화 턴 수 (`0` = 무제한). `mode=multi_turn` 일 때만 UI 표시 |
| conditions | ConditionDef[] | | `[]` | 조건 목록. 조건이 있으면 조건별 동적 출력 포트(`{condition.id}`)를 생성한다 |
| presentationTools | PresentationToolDef[] | | `[]` | LLM 응답 표현용 가상 도구 (`render_*`) 등록 목록. 비어 있으면 기능 OFF (기본). 워크플로 그래프의 다른 노드로 연결하는 방식이 아니라 AI 세션 내부에서 presentation 노드의 렌더링 페이로드를 만들기 위한 도구. 자세한 동작은 §4.1, dispatch 는 §6.1 단계 3, ConversationTurn 의 **top-level** `presentations[]` 운반은 §7.10 참조 (data? 내부가 아니라 별도 독립 필드) |

> Multi Turn 모드에서 사용자 응답은 **무제한 대기**합니다. (외부 cancel 외에는 타임아웃이 발생하지 않습니다.)

> ⚠ **도구 연결 입력 경로 — 재작성 예정 (현재 제거됨)**
>
> `toolNodeIds`, `toolOverrides` 필드, §Tool Area 연동, 캔버스 Tool Area UX(`spec/3-workflow-editor/0-canvas.md` §12), 일반 도구 이름 규칙(`tool_*`) 은 모두 **config 스키마에서 제거**됐다. 새 도구 연결 입력 경로 디자인이 결정될 때까지 비활성. 스키마는 `.passthrough()` 이므로 DB 의 legacy 워크플로 데이터에 두 키가 남아 있어도 silently 통과하지만 핸들러는 읽지 않아 LLM 에 일반 도구가 등록되지 않는다.
>
> 영향 범위: ND-AG-06 / ND-AG-10 / ND-AG-21.
> 영향 없음: 조건 도구(`cond_*`, ND-AG-15~20·22), KB 도구(`kb_*`), MCP 도구(`mcp_*`).

**ConditionDef 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | 조건의 고유 식별자. 출력 포트 ID 로 사용. LLM 도구 이름은 `cond_` 접두사 + 정제된 UUID 로 자동 생성. 생성 시 UUID v4 할당, 이후 불변 |
| label | String | ✓ | 조건 이름 (UI 표시 및 포트 라벨) |
| prompt | String (≤ 2000자) | ✓ | 조건 설명 (LLM 도구의 description 으로 사용 — "언제 이 조건을 선택해야 하는지" 기술) |

**PresentationToolDef 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| type | Enum | ✓ | `carousel` / `table` / `chart` / `form` / `template` — 노출할 presentation 노드 종류 |
| description | String? | | LLM 에게 표시할 도구 description override. 미설정 시 type 별 기본 카피 ([Presentation 공통 §10.2](../6-presentation/0-common.md#102-도구-카탈로그)) |
| defaults | Object? | | 해당 presentation 노드의 config 일부를 미리 박는 brand/style 고정값. LLM 페이로드와 deep-merge 시 **defaults 가 override** ([Presentation 공통 §10.3](../6-presentation/0-common.md#103-defaults-overlay-규칙)). LLM 은 데이터 (items/rows/data/fields 등) 만 채우면 된다 |

- `presentationTools[i].type` 은 한 노드 안에서 **중복 금지** (한 type 당 한 번만 등록).
- `presentationTools` 가 비어 있으면 `render_*` 도구가 LLM 에 노출되지 않으며 동작 변화 없음 (기본 OFF).
- 활성화 시 도구 이름은 `render_{type}` 고정 (예: `render_table`). sanitize 불필요.
- Tool parameters JSON Schema 는 해당 presentation 노드의 input schema 단일 진실 (zod) 재사용 — [Presentation 공통 §10.1](../6-presentation/0-common.md#101-schema-단일-진실).

> Source of truth: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` (export `aiAgentNodeConfigSchema`)
>
> Conversation Thread 자동 주입은 [공통 §10](./0-common.md#10-conversation-context-자동-컨텍스트-주입) 및 [Spec Conversation Thread](../../conventions/conversation-thread.md) 참조.

## 2. 설정 UI

```
┌──────────────────────────────────────────┐
│  AI Agent                                │
│  ──────────────────────────────────────  │
│                                          │
│  LLM Provider: [OpenAI ▼]                │
│  Model:        [gpt-4o ▼]                │
│                                          │
│  ── Mode ──                              │
│  ● Single Turn   ○ Multi Turn            │
│                                          │
│  ── System Prompt ──                     │
│  ┌──────────────────────────────────────┐│
│  │ You are a helpful assistant that     ││
│  │ processes customer inquiries...      ││
│  └──────────────────────────────────────┘│
│                                          │
│  ── User Prompt ── (single_turn 시 표시) │
│  ┌──────────────────────────────────────┐│
│  │ {{ $input.message }}                 ││
│  └──────────────────────────────────────┘│
│                                          │
│  ── Parameters ──                        │
│  Temperature: [0.7___]                   │
│  Max Tokens:  [2048__]                   │
│  Response:    ● Text  ○ JSON             │
│                                          │
│  ── Knowledge Base ──                    │
│  [+ Add Knowledge Base]                  │
│  📚 Customer FAQ        Top-K: 5         │
│                                          │
│  ── MCP Servers ──                       │
│  [+ Add MCP Server]                      │
│   🌐 Generic MCP (HTTP) servers          │
│   🛒 Cafe24 stores (Internal Bridge)     │
│   🛒 MakeShop stores (Internal Bridge)   │
│                                          │
│  ── Conditions ──  (선택 사항)           │
│  ┌──────────────────────────────────────┐│
│  │ 1. 환불 요청 감지                 [×]││
│  │    Prompt: "고객이 환불을 요청하거나 ││
│  │    결제 취소를 원할 때"              ││
│  ├──────────────────────────────────────┤│
│  │ 2. 기술 지원 에스컬레이션         [×]││
│  │    Prompt: "문제가 복잡하여 전문가   ││
│  │    연결이 필요한 경우"               ││
│  └──────────────────────────────────────┘│
│  [+ Add Condition]                       │
│                                          │
│  ── Memory ──                           │
│  Strategy: [Manual ▼]                   │
│  ┊ (strategy ∈ summary_buffer/persistent)│
│  ┊  Token Budget: [8000]                │
│  ┊ (strategy = persistent 시)            │
│  ┊  Memory Key:  [{{ ... }}]            │
│  ┊  Top-K:       [5]                    │
│  ┊  Threshold:   [0.7]                  │
│                                          │
│  ── Conversation Context ──             │
│  ┊ (strategy = manual 시에만 표시)       │
│  Scope:  [None ▼]                       │
│  ┊ (lastN 선택 시)                      │
│  ┊  Last N: [20]                        │
│  ┊ (scope ≠ none 시)                    │
│  ┊  Mode:  [Messages ▼]                 │
│  ┊  ☐ Include tool turns in thread      │
│  ☐ Exclude this node from thread        │
│                                          │
│  ── Multi Turn Settings ── (multi_turn 시) │
│  Max Turns:    [20__]                    │
└──────────────────────────────────────────┘
```

**Memory 섹션 `visibleWhen`**: `Strategy` 드롭다운은 항상 표시. `Token Budget` 은 `memoryStrategy ∈ {summary_buffer, persistent}` 일 때, `Memory Key`/`Top-K`/`Threshold` 는 `memoryStrategy == persistent` 일 때만 노출. `memoryStrategy == manual` (기본) 이면 Memory 섹션은 Strategy 만 보이고 Conversation Context 섹션의 5필드가 그대로 표시된다 (현행 유지). `memoryStrategy != manual` 이면 Conversation Context 섹션 전체가 숨겨진다 (자동 전략이 대체 — §1 비고).

**"Add MCP Server" 클릭 시 노출되는 후보 목록**: `service_type='mcp'`·`service_type='cafe24'`·`service_type='makeshop'` 의 워크스페이스 Integration 을 함께 표시한다 ([Spec 통합 §14.2](../../2-navigation/4-integration.md#142-워크플로우-에디터)). UI 는 그룹을 시각적으로 분리:

- `🌐 Generic MCP (HTTP) servers` — `service_type='mcp'`
- `🛒 Cafe24 stores (Internal Bridge)` — `service_type='cafe24'`
- `🛒 MakeShop stores (Internal Bridge)` — `service_type='makeshop'`

추가 후 행 표시에 Bridge 종류 아이콘(🌐/🛒)을 prefix 로 부착. "Add MCP Server" 라벨은 "MCP-capable Integration" 의 의미로 사용 — 라벨 변경 없이 화이트리스트 확장 (사용자 학습 비용 최소화). Workflow AI Assistant 의 candidate picker 도 두 service_type 을 모두 후보로 수집한다 ([Spec AI Assistant §4.3.1](../../3-workflow-editor/4-ai-assistant.md#431-pendinguserconfig-구조-candidate-picker)).

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 노드 입력 (1개) |

### 3.2 출력 포트

**Single Turn 모드:**

| id | label | type | dynamic | 발생 조건 |
|------|-------|------|---------|-----------|
| `out` | Output | data | false | 정상 완료 (조건 미매칭 또는 조건 0개) |
| `{condition.id}` | `{condition.label}` | data | true | 해당 조건 매칭 시. 조건마다 1개씩 추가 |
| `error` | Error | data | false | LLM 오류, 타임아웃, rate limit 등 모든 오류 |

**Multi Turn 모드:**

| id | label | type | dynamic | 발생 조건 |
|------|-------|------|---------|-----------|
| `{condition.id}` | `{condition.label}` | data | true | 해당 조건 매칭 시. 조건마다 1개씩 추가 |
| `user_ended` | User Ended | data | false | 사용자가 명시적으로 대화를 종료 (`execution.end_conversation`) |
| `max_turns` | Max Turns | data | false | 대화 턴 수가 `maxTurns` 에 도달 (`maxTurns=0` 인 경우 발생 안함) |
| `error` | Error | data | false | LLM 오류, 타임아웃, rate limit 등 모든 오류 |

> Multi Turn 모드에는 **`out` 포트가 존재하지 않는다** — 종료 사유가 항상 명확하므로 전용 포트로 분기. 조건이 0개인 경우에도 동일.

**포트 시각적 구분:**

- 사용자 조건 포트(`{condition.id}`)는 **초록색** 핸들로 표시하고, 상단에 배치
- 시스템 포트(`out`, `user_ended`, `max_turns`)는 **파란색** 핸들로 표시
- 에러 포트(`error`)는 **빨간색** 핸들로 표시
- 조건이 1개 이상인 경우, 사용자 조건 포트와 시스템/에러 포트 사이에 **점선 구분자**를 렌더링하여 영역을 시각적으로 분리
- 조건이 0개인 경우에도 시스템/에러 포트는 동일한 색상 규칙으로 표시

**공통:**

- 조건 추가/삭제/이름 변경/재정렬 시에도 기존 포트 ID(UUID)는 **불변** 이므로 연결된 엣지가 유지됨
- `timeout` 포트는 존재하지 않음 — 타임아웃·rate limit 등은 `error` 포트로 통합 라우팅
- **마이그레이션**:
  - 기존 `timeout` 포트에 연결된 엣지는 프론트엔드에서 dangling 상태가 됨. 사용자가 수동으로 `error` 포트로 재연결 필요 (신규 기능이므로 기존 워크플로우에 `timeout` 엣지 존재하지 않음)
  - 기존 `multi_turn` + 조건 없음 노드의 `out` 포트에 연결된 엣지는 dangling 상태가 됨. `user_ended` 또는 `max_turns` 포트로 수동 재연결 필요

## 4. Tool Area 연동

> ⚠ **재작성 예정 (현재 제거됨)** — 본 절(§Tool Area 연동·도구 이름 규칙 중 `tool_*` 항목·도구 설명 파생 규칙·ToolOverride 구조)에 기술된 내용은 현재 비활성. 관련 config 필드 (`toolNodeIds` / `toolOverrides`) 와 캔버스 UX 가 제거된 상태이며, 새 도구 연결 디자인이 결정될 때 갱신한다. 조건(`cond_*`) / KB(`kb_*`) / MCP(`mcp_*`) 도구는 영향 없음.

도구 관리는 캔버스의 [Tool Area](../../3-workflow-editor/0-canvas.md#12-ai-agent-tool-area)에서 수행한다. 노드를 Tool Area에 드래그하여 등록하면 `toolNodeIds`에 자동 추가된다.

**도구 이름 규칙:**

- 일반 도구 _(제거됨)_: `tool_` 접두사 + 정제된 nodeId (예: `tool_abc1234_5678_...`)
- 조건 도구: `cond_` 접두사 + 정제된 conditionId (예: `cond_def9012_3456_...`)
- KB 검색 도구: `kb_` 접두사 + 정제된 KB id (상세: [Spec RAG 검색 §2.1](../../5-system/9-rag-search.md#21-kb-tool-정의))
- MCP 도구: `mcp_<sid>__<toolName>` — `<sid>` 는 Integration UUID 의 sanitized 8자, `__` 로 server ↔ toolName 분리. 메타도구는 `mcp_<sid>__list_resources`·`mcp_<sid>__read_resource`·`mcp_<sid>__list_prompts`·`mcp_<sid>__get_prompt` (상세: [Spec MCP Client §5.2](../../5-system/11-mcp-client.md#52-도구-이름-규칙))
- 표현 도구 (`render_*`): `render_` 접두사 + presentation 노드 type 고정 단어 (`render_table`/`render_chart`/`render_carousel`/`render_template`/`render_form`). UUID 가 아니라 type 단일 단어이므로 sanitize 불필요. 상세는 §4.1
- 정제(sanitize): UUID 내 `-` 등 비영숫자 문자를 `_`로 치환하여 LLM API 호환성 보장
- 접두사로 도구 카테고리(일반·조건·KB·MCP·표현)를 명확히 구분하여 이름 충돌 방지
- LLM은 도구의 `description`을 기반으로 도구를 선택한다 (이름의 의미를 해석하지 않도록 설계)

**도구 설명 파생 규칙:**

- 기본: Tool 노드의 `description`(설명)에서 파생
- 오버라이드 가능: `toolOverrides`에서 도구별 설명을 커스텀 설정

**ToolOverride 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| nodeId | UUID | Tool Area에 등록된 노드 ID |
| toolName | String? | LLM에게 표시할 도구 이름 (미설정 시 nodeId UUID 사용) |
| toolDescription | String? | LLM에게 표시할 도구 설명 (미설정 시 노드 description 사용) |
| inputMapping | MappingDef[]? | 도구 파라미터 → 노드 입력 매핑 (미설정 시 자동 매핑) |

### 4.1 Presentation Tool Family (`render_*`)

AI Agent 의 응답 surface 를 텍스트로 한정하지 않고, LLM 이 적절한 표현 (표·차트·캐러셀·템플릿·폼) 을 판단해 직접 만들 수 있게 한다. **워크플로 그래프의 다른 노드로 연결하는 방식이 아니라 AI 세션 내부 가상 도구** — `kb_*` / `mcp_*` / `cond_*` 와 동일한 4분류 패턴에 표현 카테고리가 추가된 형태다.

**활성화:**

§1 의 `presentationTools[]` 에 도구를 등록할 때만 LLM 에 노출 (기본 OFF). 비어 있으면 동작 변화 없음 — 기존 워크플로 영향 0.

**도구 카탈로그 (5종):**

| 도구 이름 | 종류 | 모드 | tool_result | turn 종료 |
|---|---|---|---|---|
| `render_table` | display-only | 단일 페이로드 emit 후 즉시 stub 회신 | `{ok: true}` | LLM 응답 안의 텍스트 / 다른 도구 / `cond_*` 가 결정. `render_*` 자체는 종료 트리거 아님 |
| `render_chart` | display-only | 동일 | `{ok: true}` | 동일 |
| `render_carousel` | display-only | 동일 | `{ok: true}` | 동일 |
| `render_template` | display-only | 동일 | `{ok: true}` | 동일 |
| `render_form` | **interactive** | `status: 'waiting_for_input'` 으로 turn 보류. 사용자 제출 시 thread 에 `presentation_user` source push + tool_result content 에 제출 데이터 직렬화 후 LLM 재호출 | `{ok: true, type: 'form_submitted', data: { … }, message: '<재호출 금지 안내문>'}` JSON (가드 필드 SoT: §12.6) | LLM 의 다음 응답이 결정 |

**도구 파라미터 (JSON Schema):**

각 presentation 노드의 input schema (zod `*NodeConfigSchema`) 를 단일 진실로 재사용하여 LLM 에 노출한다. drift 방지의 핵심 결정 — schema 가 한 곳 (`codebase/backend/src/nodes/presentation/<type>/<type>.schema.ts`) 에서만 관리된다. 변환 규약·`defaults` overlay 규칙은 [Presentation 공통 §10](../6-presentation/0-common.md#10-ai-tool-모드-render_) 단일 진실.

**도구 description:**

`PresentationToolDef.description` 이 있으면 그 값을, 없으면 [Presentation 공통 §10.2](../6-presentation/0-common.md#102-도구-카탈로그) 의 type 별 기본 카피를 사용. LLM 이 "언제 이 도구를 호출해야 하는지" 를 판단하는 1차 신호.

**호출 횟수 회계:**

`render_*` 호출은 `maxToolCalls` 카운터에 **포함** 된다 (KB·MCP·일반·표현 모두 합산). 일반적인 텍스트 응답 + 1~2회 render 호출 패턴에서 기본 한도 (`maxToolCalls = 10`) 는 충분하지만, 한 응답이 render 도구 다수와 다른 provider 도구를 섞어 쓰면 한도 초과 truncate 가 가능 — §6.1 단계 3.g 동일 정책.

**Schema 위반 처리:**

LLM 이 정의된 schema 를 어긴 페이로드를 보내면 (예: required 필드 누락, 타입 불일치, 1MB cap 초과):

1. 1차: tool_result 에 `{error: 'INVALID_PAYLOAD', issues: [...]}` 회신. LLM 이 같은 turn 안에서 재시도 가능.
2. 재시도 1회 후에도 실패: 해당 turn 의 `render_*` 시도는 **silent drop**. `meta.presentationSchemaViolations[]` 에 `{toolName, issues, attempts}` 누적. AI Agent 는 `error` 포트로 흐르지 않으며, 텍스트 응답이 있으면 그것만 surface 한다 (텍스트 fallback). turn 자체는 정상 진행.

**역할 분리:**

`render_*` 는 표현 전담 — 워크플로 그래프 분기는 `cond_*` 가 담당한다. presentation 노드 본체의 버튼이 갖는 "버튼 클릭 → 다른 포트로 라우팅" 기능은 `render_*` 도구에는 **없다**. 사용자가 `presentationTools[].defaults` 에 `buttons` 를 넣더라도 그 클릭은 다음 LLM turn 의 user 메시지로 흡수되며 (form 흐름과 동일 — 발화되는 user message 합성 규칙은 [Presentation 공통 §10.8](../6-presentation/0-common.md#108-render_-클릭-user-message-합성) SoT), AI Agent 의 출력 포트 분기에 영향 주지 않는다.

**기존 도구와의 공존:**

- `cond_*` 와 `render_*` 가 같은 응답에 동시 호출되면 §5.2 의 기존 우선순위 유지 — 조건 도구만 있으면 즉시 종료, 비조건 도구 (KB/MCP/일반/표현 포함) 와 혼재면 비조건 먼저 실행 후 LLM 재평가. `render_*` 도 비조건 카테고리.
- KB/MCP 와 `render_*` 가 같은 응답에 호출되면 모두 §6.1 단계 3.f 의 `Promise.all` 병렬 실행에 포함.

**ConversationThread 운반:**

`render_*` 호출이 성공한 turn 은 `ai_assistant` source 의 ConversationTurn 의 **top-level `presentations[]`** 에 페이로드 누적 — `data?` 필드 내부가 아닌 별도 독립 필드 ([Spec Conversation Thread §1.2](../../conventions/conversation-thread.md#12-conversationturn)). `data?` 는 `output.interaction.data` 스냅샷의 단일 진실 ([node-output §4.5](../../conventions/node-output.md#45-interactiondata-payload-규격)) 이므로 다른 의미의 데이터 (LLM tool call 결과) 를 박지 않는다. 텍스트 응답 (`turn.text`) 과 `turn.presentations[]` 가 한 turn 에 공존 가능. WebSocket `execution.ai_message` 누적 스냅샷에도 동일하게 top-level `presentations` 동봉 ([Spec WebSocket §4.4](../../5-system/6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input)).

## 5. 조건 (Conditions)

AI Agent가 대화 중 특정 상황을 감지하면 해당 조건의 출력 포트로 실행을 분기하는 기능이다. Text Classifier가 단일 입력에 대한 정적 분류라면, Condition은 대화 맥락 전체를 고려한 동적 분류이다.

### 5.1 조건 도구 등록

각 조건은 LLM에게 제공되는 도구(tool)로 변환된다:

| 도구 속성 | 값 |
|-----------|-----|
| name | `cond_{sanitizeId(condition.id)}` (예: `cond_abc1234_5678_...`). `cond_` 접두사로 일반 도구(`tool_`)와 구분 |
| description | `condition.prompt` (사용자가 입력한 조건 프롬프트) |
| parameters | `{ type: "object", properties: { reason: { type: "string", description: "이 조건을 선택한 이유" } }, required: [] }` |

조건 도구는 일반 Tool Area 도구 뒤에 추가된다.

**유효성 검증 규칙:**

- 최대 20개 조건 허용 (`warningRules: ai_agent:too-many-conditions`)
- 각 조건의 `id`는 필수, 예약된 포트 ID(`out`, `in`, `error`, `user_ended`, `max_turns`)와 충돌 불가
- 각 조건의 `label`은 필수
- 각 조건의 `prompt`는 필수, 최대 2,000자
- 조건의 `reason` 응답은 최대 500자로 잘림 처리

시스템 프롬프트에 조건 사용 지시를 자동 주입:
> "다음 조건 중 상황이 충족되면 해당 도구를 호출하세요. 조건이 충족되지 않으면 대화를 계속하세요."

### 5.2 조건 도구 호출 감지 및 처리

LLM 응답의 `toolCalls`를 순회할 때 다음 로직을 적용:

1. `toolCalls`를 **조건 도구**와 **일반 도구**로 분류 (조건의 `id` 목록과 대조)
2. **조건 도구만 호출된 경우 (일반 도구 없음):**
   a. 복수의 조건 도구가 호출된 경우, `conditions` 배열에서 인덱스가 가장 작은 조건을 선택
   b. AI Agent를 즉시 종료하고, 선택된 조건의 포트로 라우팅
3. **조건 도구 + 일반 도구가 함께 호출된 경우:**
   a. 조건 도구 호출은 보류하고, 일반 도구를 먼저 실행
   b. 일반 도구의 실행 결과를 LLM에 전달 (조건 도구 호출에 대해서는 "확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요." 메시지를 tool result로 전달)
   c. LLM이 재평가하여 다음 응답을 생성 — 이 응답에서 다시 조건 체크를 수행
   d. 이 과정은 기존 tool call 루프 안에서 자연스럽게 반복됨
4. **조건 도구가 없는 경우:** 기존 로직대로 일반 도구를 실행하고 대화를 계속

## 6. 실행 로직

### 6.1 Single Turn 모드 (mode = `single_turn`)

0.5. **System Context Prefix 빌드** ([공통 §11](./0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix)) — `includeSystemContext !== false` (default `true`) 면 `systemContextSections` 에 따라 prefix 를 생성해 systemPrompt 앞에 prepend. UTC `$now` 는 [공통 §11.3](./0-common.md#113-timezone-sot-정책) 의 SoT precedence (`Workspace.settings.timezone` → `process.env.TZ` → `UTC`) 로 변환.
1. Knowledge Base / MCP 서버 setup:
   a. KB 도구(`kb_*`) 와 MCP 도구(`mcp_*`, 메타도구 포함)를 일반 도구·조건 도구와 함께 LLM 에 노출 — KB 검색은 [Spec RAG §2](../../5-system/9-rag-search.md#2-검색-호출-흐름-llm-tool-calling), MCP 는 [Spec MCP Client §7](../../5-system/11-mcp-client.md#7-실행-흐름-요약) 참조
   b. KB 검색은 LLM 의 능동 호출 시에만 실행되며 prefill 하지 않음
1.3. **persistent 메모리 회수 (`memoryStrategy: 'persistent'` 시, LLM 호출 전 동기)** — 스코프 키 `(workspace_id, memoryKey ?? execution_id)` 로 `agent_memory` 에서 top-k 의미검색 (`memoryTopK` / `memoryThreshold`) 을 동기 수행해 회수된 사실/선호를 **systemPrompt 안정 프리픽스 영역**에 주입한다 (회수 블록은 휘발성 최근 turn 보다 앞 — [공통 §11.4](./0-common.md#114-주입-위치-및-ordering) ordering 의 안정 프리픽스). 회수는 hot path 동기이지만 추출(2.7)은 비동기다. 회수 건수는 `meta.memory.recalledCount` 로 노출. SoT: [Spec Agent Memory §회수](../../5-system/17-agent-memory.md).
1.5. **컨텍스트 메모리 주입** (CONVENTIONS Conversation Thread §5) — LLM 호출 **전**, `memoryStrategy` 에 따라 분기:
    - **`manual`** (기본, 하위호환): `contextScope ≠ 'none'` 일 때 `ConversationThreadService.getThreadExcludingNode(context, this.nodeId)` 로 자기 외 turn 을 가져온다. `contextInjectionMode='messages'` 면 messages 배열 앞에 prepend ([Spec Conversation Thread §5.1](../../conventions/conversation-thread.md#51-messages-모드-매핑) 매핑표), `'system_text'` 면 systemPrompt 끝에 `thread-renderer` 결과 첨부. cap 적용 후 dropped turn 수를 `meta.contextInjection.droppedTurns` 로 노출. (`contextScope` 계열 5필드는 이 분기에서만 적용)
    - **`summary_buffer` / `persistent`** (자동): working-memory (자기 history + 주입 thread) 의 토큰 추정치가 `memoryTokenBudget` 을 초과하면 **오래된 turn 부터 롤링 요약으로 압축**한다 — 요약 블록은 **system_text 안정 프리픽스** ([공통 §11.4](./0-common.md#114-주입-위치-및-ordering)) 에 배치하고 (1.3 의 회수 블록과 같은 안정 프리픽스 영역), 압축되지 않은 최근 원문 turn 만 휘발성 꼬리로 둔다. **요약 갱신은 예산 임계치 도달 시에만** 수행해 prompt cache 안정 프리픽스를 보호한다 (매 turn 재요약 금지). 요약 LLM 콜은 노드 `model`/`llmConfigId` 를 재사용한다 (별도 모델 필드 없음). 요약 보관은 `ConversationThread.runningSummary` / `summarizedUpToSeq` ([conversation-thread §1.3·§5.3](../../conventions/conversation-thread.md#13-conversationthread)). 압축 발생 여부는 `meta.memory.summarized`, 예산 사용량은 `meta.memory.tokenBudgetUsed` 로 노출.
1.7. **`ai_user` turn push** (spec/conventions/conversation-thread.md §2.2) — LLM 호출 **전**, `userPrompt` resolved 직후 1회.
2. systemPrompt + userPrompt로 LLM 호출 (tools 파라미터에 위 도구들이 포함됨)
2.5. **`ai_assistant` turn push** — LLM 응답 직후. 정상 종료 시 최종 `output.result.response` (json 모드는 `JSON.stringify`) 를 push. condition route 시에도 분기 직전 마지막 assistant 응답 push. tool-loop 중 assistant / tool result push 는 `includeToolTurns: true` 시에만.
2.7. **persistent 메모리 추출 (`memoryStrategy: 'persistent'` 시, 턴 경계 비동기)** — 턴 경계에서 직전 turn(들)에서 추출할 사실/선호를 **비동기 background** 로 추출해 스코프 키 `(workspace_id, memoryKey ?? execution_id)` 로 `agent_memory` 에 저장한다 (LLM latency 에 추출 LLM 콜을 얹지 않는다 — hot path 비차단). background 격리는 `scheduleBackgroundBody` 의 turns snapshot shallow-copy 격리 invariant 를 준수한다 ([Spec Agent Memory §추출](../../5-system/17-agent-memory.md)). `summary_buffer` 는 세션 간 추출이 없으므로 본 단계 미적용.
3. LLM이 도구 호출을 요청하면:
   a. `toolCalls`를 **조건 도구**(`cond_*`) / **KB 도구**(`kb_*`) / **MCP 도구**(`mcp_*`) / **표현 도구**(`render_*`) / **일반 도구**(`tool_*`) 로 분류한다. 구현은 먼저 등록된 `toolProviders` 중 `matches(tc.name)` 가 참인 첫 provider 를 찾고 (kb → mcp → render 순으로 등록), provider 매칭이 없으면 condition 이름 집합과 대조하며, 그래도 매칭이 없으면 일반 도구로 분류한다. 모든 provider prefix(`kb_`/`mcp_`/`render_`)·`cond_` 가 서로 disjoint 하므로 provider-우선 검사라도 분류 결과는 결정적이다 (구현: `ai-agent.handler.ts` `classifyToolCalls`). 이름 prefix 가 동일하더라도 provider 가 등록되지 않았으면 (예: `presentationTools` 빈 배열일 때 LLM 이 환각으로 `render_xxx` 를 호출한 경우) 매칭 안 됨 → 일반 도구 분류. `tool_*` 재작성 미완 상태에서 일반 도구로 분류된 호출은 현재 LLM 에 가짜 성공 stub `{result: "Tool <name> executed", arguments: {...}}` tool_result 를 회신한다 (도구 미연결을 알리는 `tool_call_not_implemented` 회신은 **미구현 (Planned)** — `tool_*` 도구 연결 입력 경로 재작성 시 도입 예정).
   b. **조건 도구만 존재:** 해당 조건 포트로 즉시 라우팅
   c. **조건 도구 + 비조건 도구 혼재:** 비조건 도구(KB·MCP·표현·일반)를 먼저 실행, 결과를 LLM에 전달하여 재평가
   d. **비조건 도구만 존재:** 각 provider가 자체 실행 (KB → 검색, MCP → MCP RPC, 일반 → Tool Area 호출, 표현 → §6.1.d.i). 각 호출의 결과는 분리된 tool_result 메시지로 LLM 에 그대로 전달된다 (호출 간 score 병합·재정렬 없음 — 에이전트가 직접 종합).
   d.i. **표현 도구 (`render_*`) display-only (`table`/`chart`/`carousel`/`template`)**: payload 를 해당 presentation 노드의 zod schema 로 validate → `defaults` overlay 적용 → 1MB cap 적용 → 누락 `button.id` 를 UUID v4 로 backfill ([Presentation 공통 §10.5 step 3](../6-presentation/0-common.md#105-schema-위반-처리-및-정규화)) → ConversationTurn (현재 turn 의 `ai_assistant`) 의 **top-level `presentations[]`** 에 push (`data?` 가 아닌 별도 독립 필드 — §7.10) → tool_result 로 `{ok: true}` 스텁 회신. LLM 이 동일 turn 안에서 이어서 텍스트를 생성하거나 다른 도구를 호출할 수 있다. validate 실패 시 §4.1 "Schema 위반 처리 및 정규화" 적용.
   d.ii. **표현 도구 `render_form` (interactive)**: §6.2 의 multi-turn blocking 흐름으로 진입 — 현재 LLM turn 을 보류하고 `status: 'waiting_for_input'` + `meta.interactionType: 'ai_form_render'` (※ `'ai_conversation'` 과 별개 — 클라이언트가 `execution.submit_form` 분기 근거로 사용, [WS §4.4](../../5-system/6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input)) + form payload 를 `ai_assistant` ConversationTurn 의 top-level `presentations[]` 에 push (`type: 'form'`, payload = form 노드 input schema shape). `_resumeState.pendingFormToolCall = {toolCallId, formConfig}` 저장 (§7.4). 사용자 form 제출 시 (§6.2 단계 2) thread 에 `presentation_user` source 로 push + `data.via: 'ai_render'` sentinel 박힘 (UI 분기 근거, [node-output §4.5](../../conventions/node-output.md#45-interactiondata-payload-규격)) + tool_result content = `{ok: true, type: 'form_submitted', data: { … }, message: '<재호출 금지 안내문>'}` 채워 LLM 재호출 (가드 필드 `ok`, `message` 의 도입 근거는 §12.6). **single-turn 모드 (`mode = single_turn`) 에서 `render_form` 이 호출되면 single-turn semantics 와 모순되므로 §4.1 "Schema 위반 처리" 와 동일하게 1회 재시도 후 silent drop** — 사용자가 form 인터랙션이 필요하면 `mode = multi_turn` 으로 전환해야 한다.

   **활성 form 의 UI 표면 — assistant turn 의 timeline 인라인 단일 진실**: `render_form` 활성 단계에서 form 입력 UI 는 별도 surface 가 아니라 **assistant turn 의 `presentations[*]` 중 `type: 'form'` 페이로드 위치에 inline 렌더**된다 ([Conversation Thread §9.1](../../conventions/conversation-thread.md#91-source-별-시각-매핑-강제) `ai_assistant` 행 비고). frontend 의 `AssistantPresentationsBlock` case `"form":` 가 `waitingConversationConfig.pendingFormToolCall.toolCallId === payload.toolCallId` 매칭 시 interactive `DynamicFormUI` 를, 그 외에는 `FormSubmittedContent` (display-only) 를 렌더. 캐러셀·차트가 timeline 안에 inline 되는 시각 패턴과 일관 — `render_form` 만 별도 stack 으로 분리되어 있던 옛 표현은 폐기 (§12.5 Rationale).
   e. 한 서버·KB 의 실패는 격리되어 `meta.mcpDiagnostics.errors` / `meta.ragDiagnostics` 에 기록되며 LLM 대화는 계속됨 (graceful degradation). 표현 도구의 schema 위반은 `meta.presentationSchemaViolations[]` 에 누적 (§4.1)
   f. **provider 도구 (KB·MCP) 와 표현 도구 (`render_*` display-only) 는 동일 turn 내 `Promise.all` 로 병렬 실행** — LLM 이 한 응답에 여러 `tool_use` 를 emit 하면 latency 가 max(N) 으로 단축됨. `render_form` 은 blocking 이므로 병렬에 포함되지 않고 직렬로 진입. tool_result message push 순서는 Promise.all 결과 순서대로 직렬 적용해 누적이 결정적이다.
   g. maxToolCalls 초과 전까지 반복 (KB·MCP·표현·일반 호출 모두 합산). batch 진입 시 잔여 한도를 초과하는 호출은 앞쪽부터 truncate 하고 잔여분에 대해 `tool_call_budget_exceeded` tool_result 회신 (Anthropic 의 tool_use ↔ tool_result 매칭 요건 충족).
4. 최종 응답을 출력 형식에 맞게 변환 (`responseFormat=json` 시 `JSON.parse`, 실패하면 raw 문자열 유지)
5. `out` 포트로 출력 (§7.1)
6. 조건 도구가 매칭되면 `{condition.id}` 포트 (§7.2)
7. LLM 오류, 타임아웃, rate limit 발생 시 `error` 포트 (§7.3)

### 6.2 Multi Turn 모드 (mode = `multi_turn`)

워크플로우 실행을 일시 정지(blocking)하고 사용자와 대화형 인터랙션을 수행한다. 기존 Form 노드의 `waiting_for_input` 메커니즘을 확장하여 구현한다.

1. **첫 번째 턴 (노드 진입 직후):**
   a. systemPrompt 와 KB/MCP/조건 도구를 준비 — systemPrompt 빌드 시 [공통 §11](./0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix) 의 System Context Prefix 를 가장 앞에 prepend (`includeSystemContext` 가 `false` 이면 skip). multi-turn 의 후속 turn 에서도 prefix 는 유지되며, `$now` 가 execution 단위 frozen 이므로 turn 마다 재계산해도 동일 값.
   b. **즉시 `status: 'waiting_for_input'` 으로 진입** — 첫 턴 LLM 호출은 사용자 메시지 수신 후로 미룬다. `output` 에 빈 `messages` 배열 + `_resumeState` 를 운반 (§7.4)
   c. 클라이언트 채팅 UI 가 사용자 입력 박스를 활성화
2. **사용자 메시지 수신 시:**
   a. 클라이언트가 `execution.submit_message` 명령 (일반 채팅) 또는 `execution.submit_form` 명령 (`render_form` 응답) 으로 사용자 메시지를 전송. `submit_form` 은 `_resumeState.pendingFormToolCall` 이 set 된 경우에만 유효 — 매칭하는 `toolCallId` 가 없으면 reject
   b. 엔진이 `status: 'resumed'` 스냅샷을 1회 emit (§7.5) — 일반 채팅은 `output.interaction.{type:'message_received', data:{content, role:'user'}, receivedAt}` 운반, form 제출은 `output.interaction.{type:'form_submitted', data:{<field>:value}, receivedAt}` 운반. **일반 채팅(`message_received`) 시 엔진은 같은 시점에 WS `execution.user_message` 라이브 이벤트도 함께 emit** 해 사용자 발화를 AI 응답 전에 조기 노출한다 (§7.5 의 라이브 조기 노출 노트 / [WebSocket §4.4](../../5-system/6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input))
   c. 사용자 메시지를 대화 이력에 추가 + ConversationThread 에 `ai_user` (채팅) 또는 `presentation_user` (form 제출) source 의 turn 자동 push. form 의 경우 `data.via: 'ai_render'` sentinel 박힘 (그래프 form 노드 출처의 `data.via` 미설정과 구분) — UI 가 `<AI Agent 라벨> · form via AI render` 카드로 렌더. tool_result content 는 `{ok:true, type:'form_submitted', data:{…}, message:'<재호출 금지 안내문>'}` JSON 직렬화로 채워져 LLM 이 다음 호출에서 본다 (가드 필드 `ok`, `message` 는 LLM 의 동일 form 재호출 회귀 차단 — §12.6) + `_resumeState.pendingFormToolCall` 클리어
   c.bypass. **form bypass — 사용자가 form 활성 중 일반 텍스트 메시지 발송**: `_resumeState.pendingFormToolCall` 이 set 인 상태에서 `execution.submit_message` (form 이 아닌 채팅) 가 들어오면 — (i) `pendingFormToolCall.toolCallId` 매칭하는 render_form tool 호출의 tool_result content 를 `{type:'cancelled', reason:'user_sent_message_instead'}` 로 채워 LLM 의 tool_use ↔ tool_result 매칭 요건을 충족시키고, (ii) `_resumeState.pendingFormToolCall` 클리어, (iii) 받은 텍스트를 정상 `ai_user` turn 으로 thread 에 push 한 뒤 다음 LLM 호출 진행. LLM 은 form 호출이 취소됐다는 신호를 reasoning 입력으로 받고 다음 행동 (form 재호출 / 텍스트 응답 / 다른 도구 호출) 을 스스로 결정한다 — 사용자의 form 우회 의도를 LLM 이 인식하도록 보장. UI 측은 MessageInput 이 항상 활성이라 사용자가 form 응답 대신 텍스트를 보낼 수 있다 (§12.5 결정).
   c.fallback. **`pendingFormToolCall` 누락 시 (invariant 예외)**: dispatch ([Presentation 공통 §10.9](../6-presentation/0-common.md#109-form-submission-wire-format-internal-bus-sentinel)) 가 `action.type === 'form_submitted'` 로 form turn 진입했으나 `state.pendingFormToolCall` 가 falsy 인 경우 — 예: 사용자가 `render_form` 호출 없는 turn 에 `execution.submit_form` 명령을 직접 보냄, 또는 race condition 으로 `pendingFormToolCall` 가 이미 클리어된 상태에서 늦은 제출 수신. **silent drop 금지** — form JSON 데이터를 plain `ai_user` 메시지로 thread 에 push 하여 LLM 이 raw JSON 을 reasoning 입력으로 받아 자연어 응답을 생성하도록 fallback 한다. `console.warn('[processMultiTurnMessage] form submission without pendingFormToolCall — fallback to plain user message', { executionId, nodeId, formData })` 로 진단 surface. 이는 §7.4 invariant ("`interactionType: 'ai_form_render'` 진입 ↔ `pendingFormToolCall` set 은 1:1") 의 예외 처리 경로 — invariant 위반 자체는 회귀 신호이나 사용자 surface 는 끊기지 않도록 graceful degradation (§12.4 의 KB/MCP 격리 패턴과 동형).
   d. Knowledge Base 가 설정된 경우 LLM 능동 호출 시 RAG 재검색
   d.5. **컨텍스트 메모리 재주입 (매 turn)**: `memoryStrategy: 'manual'` 이면 `contextScope ≠ 'none'` 일 때 매 turn 마다 messages 배열을 `[system, ...injectedThread, ...selfHistory]` 로 재빌드 — `injectedThread` 는 자기 노드 turn 을 제외해 중복 방지 ([Spec Conversation Thread §5](../../conventions/conversation-thread.md#5-ai-agent-자동-주입)). `memoryStrategy ∈ {summary_buffer, persistent}` 이면 §6.1 의 1.3(persistent 회수)·1.5(자동 분기: 토큰예산 롤링 요약 압축, 요약/회수 블록은 안정 프리픽스) 를 매 turn LLM 호출 전 동일하게 적용하고, 턴 경계에서 §6.1 의 2.7(persistent 비동기 추출) 을 수행한다.
   e. 갱신된 대화 이력으로 LLM 호출 + Tool/Condition 처리 (Single Turn 3단계와 동일한 분류 로직)
   f. 조건이 충족되면 해당 포트로 라우팅하고 종료 (§7.6)
   g. 조건 미충족 시 AI 응답을 WebSocket 으로 전달
   h. 종료 조건 미충족 시 다시 `waiting_for_input` 상태로 전환 (§7.4 — `output.result.messages` 가 누적 상태로 갱신)

3. **종료 조건** (하나라도 충족 시 대화 종료, 각 사유별 전용 포트로 라우팅):
   a. LLM이 조건 도구를 호출 → 해당 조건의 출력 포트(`{condition.id}`) 로 분기 (§7.6)
   b. 사용자가 `execution.end_conversation` 명령 전송 → `user_ended` 포트 (§7.7)
   c. 대화 턴 수가 `maxTurns`에 도달 (`0` = 무제한) → `max_turns` 포트 (§7.8)
   d. LLM 오류, rate limit 등 → `error` 포트 (§7.9)

   > 사용자 응답은 무제한 대기합니다. (외부 cancel 외에는 타임아웃이 발생하지 않습니다.)

4. **종료 시:**
   a. 종료 사유에 해당하는 포트로 출력 (§7.6 ~ §7.9)
   b. 워크플로우 실행 재개

## 7. 출력 구조

> CONVENTIONS Principle 0~11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지 (`_resumeState` / `_resumeCheckpoint` / `_retryState` 는 multi-turn 의 internal 전달·재개 필드로, top-level 에 위치하되 expression resolver 에서는 노출하지 않는다 — Principle 4.2 / Principle 4.2.1).
>
> AI Agent 의 출력은 6 케이스 + multi-turn 의 transient `resumed` 1 케이스 = 총 7 케이스로 분류된다. LLM 공통 wrapper ([공통 §5](./0-common.md#5-응답-형식-규약-principle-11)) 를 따라 도메인 결과는 `output.result.*` 하위에, 에러는 `output.error.{code, message, details?}` 하위에, 사용자 인터랙션은 `output.interaction.{type, data, receivedAt}` 하위에 둔다.
>
> | Sub-section | 모드 | 종결 사유 | port | status |
> |---|---|---|---|---|
> | §7.1 | single_turn | 정상 완료 | `out` | `ended` |
> | §7.2 | single_turn | 조건 매칭 | `{condition.id}` | `ended` |
> | §7.3 | single_turn | 오류 | `error` | `ended` |
> | §7.4 | multi_turn | 사용자 입력 대기 | — | `waiting_for_input` |
> | §7.5 | multi_turn | 사용자 메시지 수신 (transient) | — | `resumed` |
> | §7.6 | multi_turn | 조건 매칭 | `{condition.id}` | `ended` |
> | §7.7 | multi_turn | 사용자 종료 | `user_ended` | `ended` |
> | §7.8 | multi_turn | 최대 턴 도달 | `max_turns` | `ended` |
> | §7.9 | multi_turn | 오류 | `error` | `ended` |
> | §7.10 | both | (cross-cutting) `render_*` payload 운반 | — | — |
>
> **Config echo 정책 (CONVENTIONS Principle 7)**: 모든 종결 시점 (`out` / `{condition.id}` / `user_ended` / `max_turns` / `error`) 과 multi-turn 의 waiting / resumed 시점에서 `output.config` 는 **유저가 입력한 raw 값** (template `{{ ... }}` 보존) 을 echo 한다 — 엔진이 dispatch 직전 평가한 값이 아니다. multi-turn 의 후속 turn 에서도 `state.rawConfig` (engine 이 frozen snapshot 으로 운반) 를 통해 동일하게 raw 가 echo 된다. 후속 노드의 `$node["X"].config.{mode, model, systemPrompt, userPrompt, maxTurns, maxToolCalls, knowledgeBases, conditions, responseFormat, includeSystemContext?, systemContextSections?}` 는 수명 내내 raw 값을 본다. `includeSystemContext` / `systemContextSections` 는 default 값과 일치하면 echo 에서 생략 ([공통 §11.7](./0-common.md#117-config-echo)). multi-turn ended / condition-trigger 출력의 `config.model` 도 `rawConfig.model` 이 template 이면 그대로 echo — 다운스트림이 LLM 식별·로깅용으로 evaluated 값을 원하면 `meta.model` 에서 읽는다. credential (`llmConfigId` 가 가리키는 provider secret 등) 은 `maskSensitiveFields` 에 의해 자동 마스킹 (`adaptHandlerReturn` boundary).

### 7.1 Single Turn 모드 — 정상 완료 (`out` 포트)

```json
{
  "config": {
    "mode": "single_turn",
    "model": "{{ vars.model }}",
    "systemPrompt": "You are a helpful assistant...",
    "userPrompt": "{{ $input.message }}",
    "responseFormat": "text"
  },
  "output": {
    "result": {
      "response": "AI 의 텍스트 응답 또는 JSON 객체",
      "endReason": "out",
      "turnCount": 1
    }
  },
  "meta": {
    "durationMs": 1234,
    "model": "gpt-4o",
    "inputTokens": 1250,
    "outputTokens": 350,
    "totalTokens": 1600,
    "thinkingTokens": 0,
    "toolCalls": 2,
    "ragSources": [
      { "chunkId": "uuid", "documentId": "uuid", "documentName": "Refund Policy", "content": "관련 텍스트...", "score": 0.92, "origin": "seed" }
    ],
    "ragDiagnostics": {
      "attempted": true,
      "searchedKbCount": 1,
      "queriesUsed": ["refund window"],
      "resultCount": 1
    },
    "mcpDiagnostics": {
      "attempted": true,
      "serverCount": 1,
      "toolCalls": 1,
      "resourceReads": 0,
      "promptGets": 0,
      "errors": []
    },
    "turnDebug": [
      {
        "turnIndex": 1,
        "llmCalls": [
          { "requestPayload": {}, "responsePayload": {}, "durationMs": 1234 }
        ],
        "totalDurationMs": 1234,
        "toolCalls": [
          { "toolCallId": "call_abc123", "name": "kb_workspace_main", "providerKey": "kb", "status": "success", "durationMs": 1240 }
        ],
        "ragSources": [],
        "ragDiagnostics": { "attempted": true, "searchedKbCount": 1, "queriesUsed": ["refund window"], "resultCount": 1 }
      }
    ]
  },
  "port": "out",
  "status": "ended"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (사용자 입력 raw) | config echo (Principle 7) | `mode`/`model`/`systemPrompt`/`userPrompt`/`responseFormat`/`conditions?`/`knowledgeBases?` 등 — 표현식 `{{ }}` 보존 |
| `output.result.response` | string \| object | runtime — handler return | LLM 최종 응답 텍스트 (`responseFormat=json` 시 parsed object) |
| `output.result.endReason` | `"out"` | handler return | single turn 의 정상 종료 이유 |
| `output.result.turnCount` | number | handler return | single 은 항상 `1` |
| `meta.durationMs` | number | engine + handler | 노드 실행 소요 시간 (ms) |
| `meta.model` | string | LLM provider response | 실제 호출된 모델 ID (config.model 의 평가 결과) |
| `meta.inputTokens` / `outputTokens` / `totalTokens` | number | LLM provider response | 토큰 회계 (공통 §6) |
| `meta.thinkingTokens` | number? | LLM provider response | 모델이 thinking 토큰을 보고하는 경우만 |
| `meta.toolCalls` | number | handler accumulator | KB·MCP·일반 도구 호출 횟수 합산 (조건 도구 제외) |
| `meta.ragSources` | Array | RagAccumulator | KB tool 의 chunk 누적치 (chunkId dedup 적용). graph 모드 KB 는 `origin: 'seed' \| 'expanded'` 부착. 상세: [Graph RAG §4.3](../../5-system/10-graph-rag.md#43-출력-메타데이터) |
| `meta.ragDiagnostics` | object | RagAccumulator | KB 검색 진단 (`attempted`/`searchedKbCount`/`queriesUsed`/`resultCount`/`skipReason?`) |
| `meta.mcpDiagnostics` | object? | McpDiagnostics | `mcpServers` 가 1개 이상이거나 LLM 이 MCP 도구를 1번 이상 호출한 경우만 포함. 필드: [MCP Client §6.2](../../5-system/11-mcp-client.md#62-진단-누적-mcpdiagnostics) |
| `meta.turnDebug[]` | Array | handler return | 턴 단위 LLM 호출 트레이스. single 은 길이 1 — 멀티턴 출력 스키마와 일관성 유지 |
| `meta.contextInjection` | object? | handler return | `contextScope ≠ 'none'` + thread non-empty 시에만 echo. `{ appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }` — 적용된 결과 (config echo 가 아님, Principle 2 정합). 상세: [Spec Conversation Thread §5.3](../../conventions/conversation-thread.md#53-cap-v1--char-기반) |
| `meta.memory` | object? | handler return | `memoryStrategy ≠ 'manual'` 시에만 echo. `{ strategy, summarized, recalledCount, tokenBudgetUsed }` — `strategy` 는 적용 전략, `summarized` 는 이 turn 에 롤링 요약 압축이 발생했는지 (Boolean), `recalledCount` 는 persistent 회수 청크 수 (summary_buffer 는 `0`), `tokenBudgetUsed` 는 working-memory 토큰 추정 사용량. 적용 결과 (config echo 아님, Principle 2 정합). SoT: [Spec Agent Memory](../../5-system/17-agent-memory.md) |
| `meta.presentationSchemaViolations` | Array? | handler return | `render_*` 도구 호출이 zod schema 또는 1MB cap 위반으로 silent drop 된 경우만 echo. 각 entry `{toolName, issues, attempts}` (§4.1). turn 자체는 정상 종료 (`error` 포트로 흐르지 않음) |
| `port` | `"out"` | handler return | 정상 종료 분기 |
| `status` | `"ended"` | handler return | 노드 실행 완료 |

> `render_*` 도구가 호출되어 성공한 turn 에서는 응당하는 `ai_assistant` ConversationTurn 의 **top-level `presentations[]`** 에 페이로드가 누적되며 (`source: 'ai_assistant'`), WebSocket `execution.ai_message` 누적 스냅샷에도 동일 구조가 surface 한다. 이는 `output.result.response` 와 직교 — 텍스트는 `response`, 표·차트·캐러셀·템플릿 페이로드는 thread 의 `turn.presentations[]` 가 단일 진실. 다운스트림 노드가 페이로드를 직접 다루려면 `$thread.turns[*].presentations` 로 접근. 상세 단일 진실: §7.10 / [Conversation Thread §1.2](../../conventions/conversation-thread.md#12-conversationturn).

> `meta.turnDebug[].toolCalls` 는 해당 턴의 provider tool(KB·MCP) 별 trace `{ toolCallId, name, providerKey, status: 'success' \| 'error', durationMs, error? }`. provider 가 throw 한 경우에도 핸들러가 catch 해 `'error'` 로 마킹하고 LLM 에는 sanitize 된 에러 content 를 그대로 전달한다 (turn 자체는 계속 진행). condition tool / 일반 tool stub 은 즉시 결과를 만들므로 포함하지 않는다. WS `execution.tool_call_started` / `execution.tool_call_completed` 가 손실되어도 동일 데이터로 클라이언트가 복구 가능 (Conversation Inspector tool 항목 success / error 배지의 권위 출처).

### 7.2 Single Turn 모드 — 조건 매칭 (`{condition.id}` 포트)

```json
{
  "config": {
    "mode": "single_turn",
    "model": "gpt-4o",
    "systemPrompt": "You are a customer support assistant...",
    "responseFormat": "text",
    "conditions": [
      { "id": "refund_request", "label": "Refund Request", "prompt": "고객이 환불을 요청하거나 결제 취소를 원할 때" }
    ]
  },
  "output": {
    "result": {
      "response": "환불 요청을 확인했습니다",
      "endReason": "condition",
      "turnCount": 1,
      "messages": [
        { "role": "user", "content": "환불해주세요" },
        { "role": "assistant", "content": "환불 요청을 확인했습니다" }
      ],
      "condition": {
        "id": "refund_request",
        "label": "Refund Request",
        "reason": "사용자가 환불을 명시적으로 요청함"
      }
    }
  },
  "meta": {
    "durationMs": 2345,
    "model": "gpt-4o",
    "inputTokens": 200,
    "outputTokens": 80,
    "totalTokens": 280,
    "thinkingTokens": 0,
    "toolCalls": 0,
    "ragSources": [],
    "turnDebug": [ { "turnIndex": 1, "llmCalls": [], "totalDurationMs": 2345 } ]
  },
  "port": "refund_request",
  "status": "ended"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.conditions` | ConditionDef[] | config echo | 사용자가 정의한 raw 조건 (id/label/prompt) |
| `output.result.response` | string | handler return | 조건 도구 호출 직전의 마지막 assistant 메시지 |
| `output.result.endReason` | `"condition"` | handler return | 조건 매칭으로 종결됨을 표시 |
| `output.result.turnCount` | number | handler return | single 은 `1`. multi-turn 에서 condition 매칭 시에는 누적 턴 수 |
| `output.result.messages` | ChatMessage[] | handler return | system 메시지 제외한 user/assistant/tool 메시지 누적 |
| `output.result.condition.id` | string | handler return | 매칭된 조건 ID (= `port`) |
| `output.result.condition.label` | string | handler return | 매칭된 조건 라벨 |
| `output.result.condition.reason` | string | handler return — `extractConditionReason` | LLM 이 조건 도구 호출 시 `reason` argument 로 보낸 사유 (최대 500자로 잘림) |
| `meta.*` | — | (§7.1 과 동일) | |
| `port` | `condition.id` | handler return | 매칭된 조건의 동적 포트 (사용자 정의 UUID) |
| `status` | `"ended"` | handler return | |

### 7.3 Single Turn 모드 — 오류 (`error` 포트)

타임아웃, rate limit, LLM API 오류, JSON 파싱 실패 등 모든 오류 상황에서 사용.

```json
{
  "config": { "mode": "single_turn", "model": "gpt-4o", "systemPrompt": "..." },
  "output": {
    "error": {
      "code": "LLM_CALL_FAILED",
      "message": "OpenAI API returned 503 after 3 retries",
      "details": { "retryable": true, "retryAfterSec": 30, "provider": "openai", "statusCode": 503, "attempt": 3 }
    }
  },
  "meta": {
    "durationMs": 15230,
    "model": "gpt-4o",
    "turnDebug": [ { "turnIndex": 1, "llmCalls": [], "totalDurationMs": 15230 } ]
  },
  "port": "error",
  "status": "ended"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `output.error.code` | string (UPPER_SNAKE_CASE) | 에러 분류 — §10 에러 코드 표 참조 |
| `output.error.message` | string | 사람이 읽는 메시지 (로그·디버깅용 원문, 국제화 없음) |
| `output.error.details` | object? | 노드별 추가 컨텍스트 (provider/statusCode/attempt 등) — 아래 두 키 포함 |
| `output.error.details.retryable` | boolean | **필수** (LLM 계열 노드, CONVENTIONS Principle 3.2.1) — 일시적 오류 여부. `true` = HTTP 429/5xx/timeout 등 transient (예: 503), `false` = 인증 실패/schema fatal/사용자 취소 |
| `output.error.details.retryAfterSec` | number? | 재시도 권장 대기 초 (있을 때). §7.9 멀티턴과 동일 형식 |
| `status` | `"ended"` | 에러 종결 상태 (handler return) |
| `port` | `"error"` | handler return |

### 7.4 Multi Turn 모드 — 사용자 입력 대기 (`status: "waiting_for_input"`)

첫 진입 직후, 그리고 매 턴 종료 후 (단, 종료 조건 미충족) emit. `output` 은 런타임 누적 대화 상태만 운반하고 리터럴 config 는 echo 하지 않는다 (Principle 1.1).

```json
{
  "config": {
    "mode": "multi_turn",
    "model": "{{ vars.model }}",
    "systemPrompt": "You are a customer support assistant...",
    "maxTurns": 20,
    "maxToolCalls": 10,
    "knowledgeBases": ["kb-1"],
    "conditions": [
      { "id": "refund_request", "label": "Refund Request", "prompt": "..." }
    ]
  },
  "output": {
    "result": {
      "messages": [
        { "role": "user", "content": "안녕하세요" },
        { "role": "assistant", "content": "안녕하세요, 무엇을 도와드릴까요?" }
      ],
      "message": "안녕하세요, 무엇을 도와드릴까요?",
      "turnCount": 1
    }
  },
  "meta": {
    "durationMs": 1500,
    "model": "gpt-4o",
    "inputTokens": 100,
    "outputTokens": 30,
    "totalTokens": 130,
    "toolCalls": 0,
    "interactionType": "ai_conversation",
    "turnDebug": [ { "turnIndex": 1, "llmCalls": [], "totalDurationMs": 1500 } ]
  },
  "status": "waiting_for_input",
  "_resumeState": {
    "llmConfigId": "cfg-1",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 2048,
    "knowledgeBases": ["kb-1"],
    "ragTopK": 5,
    "ragThreshold": 0.7,
    "maxToolCalls": 10,
    "maxTurns": 20,
    "mcpServers": [],
    "conditions": [],
    "messages": [],
    "turnCount": 1,
    "totalInputTokens": 100,
    "totalOutputTokens": 30,
    "totalThinkingTokens": 0,
    "toolCalls": 0,
    "ragSources": [],
    "ragLastDiagnostics": { "attempted": false, "searchedKbCount": 0, "queriesUsed": [], "resultCount": 0 },
    "lastTurnDurationMs": 1500,
    "turnDebugHistory": []
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (raw echo) | Principle 7 | 첫 turn 은 `context.rawConfig`, 후속 turn 은 `state.rawConfig` (frozen snapshot) 를 echo |
| `output.result.messages` | ChatMessage[] | runtime accumulator | 첫 turn 은 빈 배열 (LLM 호출 전). 후속 turn 부터 system 제외한 user/assistant/tool 메시지 누적 |
| `output.result.message` | string | handler return | 현재 턴의 assistant 응답 (waiting 시점) — 첫 진입 시 `""` |
| `output.result.turnCount` | number | handler return | 누적 turn 수 (첫 진입 시 `0`). 진행률 표시(`turnCount / maxTurns`)의 분모 `maxTurns` 는 **`config.maxTurns` 에서 읽는다** — output 에 echo 하지 않음 (Principle 1.1) |
| `meta.interactionType` | `"ai_conversation"` | handler return | run-results UI 의 conversation Preview 탭 식별자 (Principle 1.1.4 의 노드 판별자가 아니라 인터랙션 타입 라벨). 탭 렌더 규칙은 [Spec Conversation Thread §9](../../conventions/conversation-thread.md#9-미리보기-ui-렌더-규칙) 의 강제 매핑표를 따른다 — 1차 소스는 emit messages 가 아닌 `conversationThread` snapshot |
| `meta.durationMs` / 토큰 / `turnDebug` | — | (§7.1 과 동일 위치) | 진행 중 누적치를 노출해 References / LLM Usage 탭이 동작 |
| `status` | `"waiting_for_input"` | handler return | 엔진이 실행을 일시 정지 |
| `_resumeState` | object (top-level) | handler return | 다음 턴 처리에 필요한 internal state. expression resolver 에서는 비노출 (Principle 4.2). credential / 내부 상태 보호 — DB 저장 시 strip. 단 **재시작 후 재개**(§7.5 rehydration)를 위해 엔진이 `_resumeState` 의 **credential-strip 부분집합**을 `_resumeCheckpoint` 로 `outputData` 에 영속한다 (아래 생명주기 비교표) |
| `_resumeState.ragSources` | Array | RagAccumulator (capped) | 직전 `MAX_RESUME_RAG_SOURCES = 200` 건만 유지 — 장기 대화에서 outputData JSONB 비대화 방지 (잘려 나간 chunk 는 향후 dedup 에서 제외 — 의도된 trade-off) |
| `_resumeState.turnDebugHistory` | Array | handler return | 직전 `MAX_TURN_DEBUG_HISTORY = 50` 턴만 유지 (DB 누적 비대 방지) |
| `_resumeState.pendingFormToolCall` | object? | handler return | `render_form` 도구가 호출되어 form 제출 대기 중인 경우만 set. shape: `{ toolCallId: string, formConfig: object }`. 다음 `execution.submit_form` 명령 수신 시 `toolCallId` 매칭으로 검증, 매칭 성공 시 tool_result content 채워 LLM 재호출 + 본 필드 클리어. `interactionType: 'ai_form_render'` 진입 ↔ `pendingFormToolCall` set 은 1:1 invariant. **WS emit 경로**: engine waiting emit 이 본 객체를 그대로 `conversationConfig.pendingFormToolCall` 로 동봉한다 ([WS §4.4](../../5-system/6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input) `conversationConfig.pendingFormToolCall` 행) — `_resumeState` 의 internal shape 와 WS wire shape 가 동일 `{toolCallId, formConfig}`. 상세: §6.1.d.ii / §6.2 step 2 / form bypass §6.2 step 2.c.bypass |

> `_resumeState` 는 `output` 외부 top-level 필드다. credential 누락 / 누적 메모리 비대화 우려로 expression autocomplete 에서 노출하지 않는다.
>
> **`_resumeState` / `_resumeCheckpoint` / `_retryState` 의 생명주기 비교** (모두 top-level internal 필드, Principle 0 예외):
>
> | 필드 | 생명주기 | 영속 | 소비 |
> | --- | --- | --- | --- |
> | `_resumeState` | waiting_for_input 진입부터 다음 turn 처리까지 in-memory `ExecutionContext` 유지. DB 영속 시 `stripControlFields()` 가 **full state 는 무조건 제거** (credential / rawConfig / turn debug 포함 가능) | in-memory 만 | 다음 turn 처리 시 엔진이 읽고 새 `_resumeState` 로 갱신 |
> | `_resumeCheckpoint` (**ai_agent 한정** — `information_extractor` 는 미적용·graceful reset) | waiting_for_input 진입·매 turn 영속 시점에 엔진이 `_resumeState` 의 **credential-strip 부분집합**을 운반. **`stripControlFields()` 가 보존** → DB 영속. `_retryState` 와 동일 masking 정책이되 **TTL(`expiresAt`) 없음**(대화는 장시간 후에도 재개 가능) · `lastUserMessage` 없음(재개 시 도착한 사용자 메시지를 그대로 처리) | `NodeExecution.outputData._resumeCheckpoint` (DB JSONB) | §7.5 rehydration(재시작/타 인스턴스 재개) 시 엔진이 로드 → `node.config` 재평가로 context-binding 필드 재유도 → `_resumeState` 재구성 → multi-turn loop 재진입. 부재/손상 시 graceful reset (§7.5 `RESUME_INCOMPATIBLE_STATE`) |
> | `_retryState` | retryable error 종결 시점에 `buildMultiTurnFinalOutput` 이 운반. **`stripControlFields()` 가 보존** → DB 영속 | `NodeExecution.outputData._retryState` (DB JSONB) | WS `execution.retry_last_turn` 명령이 `nodeExecutionId` 로 lookup → `expiresAt` 검증 → 새 NodeExecution row spawn → multi-turn loop 재진입. TTL 만료 또는 한 번 소비 후 `RETRY_STATE_NOT_FOUND` 응답 |
>
> 세 필드 모두 credential / context-binding 필드(`llmConfigId` 가 가리키는 provider secret, `workspaceId` 등)는 미동봉이며 (`maskSensitiveFields` boundary strip), 재개 시 `node.config` 에서 재유도한다. `_resumeCheckpoint` 와 `_retryState` 는 **재구성 로직(`buildRetryReentryState`)을 공유**한다 — 차이는 trigger(restart-resume vs. retry 명령)와 lifecycle(상시 vs. error-once)뿐이다.
>
> 세 필드의 SoT 는 [CONVENTIONS node-output Principle 4.2 / 4.2.1](../../conventions/node-output.md#42-폐기할-필드--구조) + [Spec 실행 엔진 §1.3](../../5-system/4-execution-engine.md#13-블로킹재개-컨트랙트-nodehandleroutput-status).

### 7.5 Multi Turn 모드 — 사용자 메시지 수신 (`status: "resumed"`, transient)

사용자 메시지 수신 직후, 다음 턴 LLM 호출 전에 1회 emit. 이 스냅샷은 **transient** — 엔진은 곧바로 다음 턴 처리를 이어가 `waiting_for_input` 또는 `ended` 중 하나로 수렴한다. `resumed` 시점에는 후속 엣지 라우팅이 발생하지 않으며, 이 `NodeHandlerOutput` 스냅샷 자체는 run history / timeline observability 에만 기록된다.

> **라이브 조기 노출 (`execution.user_message`)**: 위 observability 기록과 **별개로**, 엔진은 같은 수신 시점(다음 턴 LLM 호출 전)에 WS 이벤트 `execution.user_message` 를 1회 emit 해 사용자 발화(q)를 라이브 대화 surface 에 즉시 노출한다 ([Spec WebSocket §4.4 `execution.user_message`](../../5-system/6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input) / §4.4.6 / §4.4 Reconciliation 노트). 이 이벤트의 `nodeExecutionId` 는 **이 시점에 `waiting_for_input` 상태였던 NodeExecution row 의 PK** ([실행 엔진 §1.3](../../5-system/4-execution-engine.md) 의 `execution_id + node_id + status='waiting_for_input'` 단일 매칭과 동일 row), `receivedAt` 은 `output.interaction.receivedAt` 과 같은 수신 tick 이다 (engine·handler 가 각각 생성해 ms 차이 가능 — dedup·reconcile 이 정확한 일치에 의존하지 않음). 권위 출처는 여전히 turn 종료 `execution.ai_message.messages` 스냅샷이며 (§7.4), `user_message` 는 라이브 전용 비권위 진행 신호다 — `output.result.messages` 의 turn-경계 영속 정책(§7.4)은 불변(라이브 신호는 영속 대상 아님). 본 emit 은 엔진의 multi-turn message turn 공통 경로에서 일어나므로 node-type 에 비의존적이다 — `information_extractor` 등 다른 `ai_conversation` resumable 노드의 multi-turn 메시지 수신에도 동일하게 적용된다 (제외 아님).

```json
{
  "config": { "mode": "multi_turn", "model": "gpt-4o", "maxTurns": 20 },
  "output": {
    "result": {
      "messages": [
        { "role": "user", "content": "환불 문의입니다" }
      ]
    },
    "interaction": {
      "type": "message_received",
      "data": { "content": "환불 문의입니다", "role": "user" },
      "receivedAt": "2026-05-10T06:42:01.123Z"
    }
  },
  "meta": { "durationMs": 0, "interactionType": "ai_conversation", "turnDebug": [] },
  "status": "resumed",
  "_resumeState": { "...": "(§7.4 와 동일 구조)" }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `output.result.messages` | ChatMessage[] | 사용자 메시지가 append 된 직후의 누적 대화 (모델 응답은 아직 없음) |
| `output.interaction.type` | `"message_received"` | interaction 종류 (Principle 4.5) |
| `output.interaction.data.content` | string | 사용자가 입력한 메시지 본문 |
| `output.interaction.data.role` | `"user"` | 고정값 |
| `output.interaction.receivedAt` | ISO8601 string | 수신 시각 |
| `status` | `"resumed"` | 1회성 transient 마커 |

> **D6 결정**: waiting/resumed 의 `messages` / `message` / `turnCount` 가 종결 시점 (`output.result.*`) 과 단일 경로로 통일. 옛 top-level `output.messages` / `.message` / `.turnCount` 는 폐기 — 다운스트림 expression 은 `$node["X"].output.result.messages` 처럼 단일 경로로 접근한다. `maxTurns` 는 static config 값이라 output 으로 echo 하지 않고 `config.maxTurns` 로만 노출한다 (Principle 1.1 — 진행률 분모는 UI 가 config 에서 읽는다). interaction 페이로드는 의미 분리 유지 (`output.interaction.*`).

### 7.6 Multi Turn 모드 — 조건 매칭 (`{condition.id}` 포트)

LLM 이 조건 도구를 호출했을 때. shape 은 §7.2 와 정확히 동일한 `output.result.*` 컨테이너에 멀티턴 누적 메타가 추가된 형태.

```json
{
  "config": {
    "mode": "multi_turn",
    "model": "gpt-4o",
    "systemPrompt": "...",
    "maxTurns": 20,
    "maxToolCalls": 10,
    "conditions": [
      { "id": "refund_request", "label": "Refund Request", "prompt": "..." }
    ]
  },
  "output": {
    "result": {
      "response": "환불 요청을 확인했습니다",
      "endReason": "condition",
      "turnCount": 5,
      "messages": [
        { "role": "user", "content": "..." },
        { "role": "assistant", "content": "..." },
        "..."
      ],
      "condition": {
        "id": "refund_request",
        "label": "Refund Request",
        "reason": "사용자가 환불을 명시적으로 요청함"
      }
    }
  },
  "meta": {
    "durationMs": 3800,
    "model": "gpt-4o",
    "interactionType": "ai_conversation",
    "inputTokens": 3800,
    "outputTokens": 1200,
    "totalTokens": 5000,
    "toolCalls": 5,
    "ragSources": [],
    "turnDebug": [
      { "turnIndex": 1, "llmCalls": [], "totalDurationMs": 1500 },
      "..."
    ]
  },
  "port": "refund_request",
  "status": "ended"
}
```

> `meta.inputTokens` / `outputTokens` / `totalTokens` 는 multi-turn 누적 합. 각 턴 단위 토큰은 `meta.turnDebug[i].llmCalls[j].responsePayload.usage` 에서 확인 가능.

### 7.7 Multi Turn 모드 — 사용자 종료 (`user_ended` 포트)

사용자가 `execution.end_conversation` 명령을 전송 (`endMultiTurnConversation` 진입점). engine 이 누적된 `_resumeState` 로 `buildMultiTurnFinalOutput(..., 'user_ended')` 를 호출.

```json
{
  "config": { "mode": "multi_turn", "model": "gpt-4o", "maxTurns": 20 },
  "output": {
    "result": {
      "response": "마지막 assistant 응답",
      "endReason": "user_ended",
      "turnCount": 3,
      "messages": [ "..." ]
    }
  },
  "meta": {
    "durationMs": 0,
    "model": "gpt-4o",
    "interactionType": "ai_conversation",
    "inputTokens": 1200,
    "outputTokens": 400,
    "totalTokens": 1600,
    "toolCalls": 0,
    "ragSources": [],
    "turnDebug": [ "..." ]
  },
  "port": "user_ended",
  "status": "ended"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `output.result.endReason` | `"user_ended"` | 종료 사유 |
| `output.result.response` | string | 마지막 메시지 (보통 assistant). 메시지가 없으면 빈 문자열 |
| `output.result.messages` | ChatMessage[] | 누적 대화 |
| `port` | `"user_ended"` | (§3.2 시스템 포트) |

### 7.8 Multi Turn 모드 — 최대 턴 도달 (`max_turns` 포트)

`turnCount >= maxTurns` 조건이 충족되면 `processMultiTurnMessage` 가 직접 `buildMultiTurnFinalOutput(..., 'max_turns')` 를 호출 (`endMultiTurnConversation` 경유 아님).

```json
{
  "config": { "mode": "multi_turn", "model": "gpt-4o", "maxTurns": 20 },
  "output": {
    "result": {
      "response": "마지막 assistant 응답",
      "endReason": "max_turns",
      "turnCount": 20,
      "messages": [ "..." ]
    }
  },
  "meta": {
    "durationMs": 1800,
    "model": "gpt-4o",
    "interactionType": "ai_conversation",
    "inputTokens": 8000,
    "outputTokens": 2400,
    "totalTokens": 10400,
    "toolCalls": 4,
    "ragSources": [ "..." ],
    "ragDiagnostics": { "attempted": true, "searchedKbCount": 1, "queriesUsed": [ "..." ], "resultCount": 8 },
    "turnDebug": [ "..." ]
  },
  "port": "max_turns",
  "status": "ended"
}
```

> `maxTurns=0` (무제한) 인 경우에는 이 케이스가 발생하지 않으며, `user_ended` / 조건 매칭 / 에러 만으로 종결된다.

### 7.9 Multi Turn 모드 — 오류 (`error` 포트)

타임아웃, rate limit, LLM API 오류 등 모든 오류 상황에서 사용. shape 은 §7.3 과 동일하되, `meta` 가 멀티턴 누적치를 운반.

```json
{
  "config": { "mode": "multi_turn", "model": "claude-sonnet-4", "maxTurns": 20 },
  "output": {
    "result": {
      "messages": [ "...(부분 누적 messages 배열)" ],
      "turnCount": 3
    },
    "error": {
      "code": "LLM_RATE_LIMIT",
      "message": "Anthropic API returned 429 (Too Many Requests)",
      "details": {
        "provider": "anthropic",
        "statusCode": 429,
        "retryable": true,
        "retryAfterSec": 30
      }
    }
  },
  "meta": {
    "durationMs": 850,
    "model": "claude-sonnet-4",
    "interactionType": "ai_conversation",
    "inputTokens": 6000,
    "outputTokens": 1500,
    "totalTokens": 7500,
    "toolCalls": 2,
    "ragSources": [],
    "turnDebug": [ "..." ]
  },
  "port": "error",
  "status": "ended",
  "_retryState": {
    "...": "(retryable === true 일 때만 set — _resumeState 부분집합 + expiresAt)",
    "messages": [ "...(handler 가 보관한 LLM history)" ],
    "turnCount": 3,
    "totalInputTokens": 6000,
    "totalOutputTokens": 1500,
    "expiresAt": "2026-05-23T08:42:31.123Z"
  }
}
```

**`details` 표준 필드** ([CONVENTIONS Principle 3.2.1](../../conventions/node-output.md#321-details-의-공통-표준-필드-llm-계열-노드-한정-필수)):

| 필드 | 타입 | 의미 |
| --- | --- | --- |
| `retryable` | `boolean` (필수) | 본 에러가 일시적이며 동일 호출 재시도 시 성공 가능성이 있는지. AI Agent 의 분류 규칙은 §10 에러 코드 표 참조 |
| `retryAfterSec` | `number?` | provider 가 `Retry-After` 헤더 또는 동등 신호를 제공한 경우. **invariant**: `retryable === true` 일 때만 set 가능 (Principle 3.2.1) |

**`_retryState` top-level 필드** — `retryable === true` 일 때만 운반. shape 은 §7.4 `_resumeState` 의 부분집합 + `expiresAt: ISO 8601` (TTL — 기본 60분). credential 미포함 (`maskSensitiveFields` boundary strip). expression resolver / autocomplete 비노출 (Principle 4.2 / 4.2.1).

`retryable === false` 케이스에서는 `_retryState` 가 emit 되지 않는다 (재시도 진입 자체가 불가).

> Multi-turn 의 `error` 종결에서도 부분 수집 결과(`output.result.*` 의 `messages` / `turnCount` 등)와 `output.error` 가 **병존** 가능 — 부분 결과를 후속 노드가 활용할 수 있도록 둘 다 보존한다. `output.error` 존재 여부로 에러/정상을 판단한다 ([공통 §5](./0-common.md#5-응답-형식-규약-principle-11)).
>
> **재시도 진입**: 사용자가 conversation thread 의 `system_error` item 우측 `[다시 시도]` 버튼을 클릭하면 WS 명령 `execution.retry_last_turn` 이 송신된다 ([Spec WebSocket §4.2](../../5-system/6-websocket-protocol.md#42-실행-제어-명령-client--server)). backend 가 `_retryState` 를 lookup → `expiresAt` 검증 → 새 NodeExecution row 를 spawn → multi-turn loop 재진입 → 마지막 user message 부터 LLM 재호출. 워크플로우 Re-run ([§13 replay-rerun](../../5-system/13-replay-rerun.md)) 과 다름 — 동일 Execution 안 노드 단위 재시도.
>
> **재진입 시 config expression 재평가**: 재진입은 노드 config 의 `{{ expression }}` 을 best-effort 로 재평가해 operational 필드(`llmConfigId` / `maxTurns` 등)가 정상 dispatch 와 동일한 evaluated 값을 갖게 한다. rehydrated context 기준이라 `$node` / `$var` / `$thread` / `$execution` / `$now` 는 정상 해소되나, 원본 nodeInput 은 영속하지 않으므로 (`_retryState` 는 turn 직전 `_resumeState` snapshot 파생 — [node-output §4.2.1](../../conventions/node-output.md#421-보존-예외--_resumecheckpoint--_retrystate) 보존 예외, 실패 turn 의 nodeInput 미포함) **`$input.*` 는 미해소**(documented limitation). 재평가 실패 시 raw config 로 안전 fallback 하므로 static config 는 영향 없다. 표현식 해석 단계는 [실행 엔진 §5.5](../../5-system/4-execution-engine.md#55-표현식-해석-단계); `output.config` echo 는 재평가 결과가 아닌 **raw 값**을 유지한다 (CONVENTIONS Principle 7 / 위 Config echo 정책 — `rawConfig` frozen snapshot).
>
> **재진입 종결 후 graph 진행**: 재진입한 turn 이 성공 종결되면 spawn 된 NodeExecution 은 일반 노드 `COMPLETED` 와 동일하게 출력 포트의 downstream 노드로 그래프 진행이 이어지며, [실행 엔진 §1.1 Execution 상태](../../5-system/4-execution-engine.md#11-execution-상태) 의 종결 규칙 + [§2.1 토폴로지 traversal](../../5-system/4-execution-engine.md#21-토폴로지-정렬-기반-실행-순환-참조-지원) 을 따른다. 재진입 turn 이 다시 실패하면 일반 노드 `FAILED` 와 동일하게 §10 의 종결 규칙을 따른다 (Execution 도 `FAILED` 마감). 즉 retry 는 "마지막 LLM 호출 재진입" 까지가 단위이고, 그 결과의 downstream 처리·종결 정책은 일반 노드의 그것과 같다 — 워크플로 Re-run ([§13](../../5-system/13-replay-rerun.md)) 과의 구분은 "동일 Execution 안 노드 단위 재진입" 이지 "downstream 차단" 이 아니다 (결정 근거: §12.8).

### 7.10 Presentation Payload (`render_*`) 운반

`presentationTools` 가 설정되고 LLM 이 `render_*` 도구를 호출한 turn 에서 emit 되는 페이로드 구조. §7.1 ~ §7.9 의 어떤 종결 케이스에서도 동일하게 emit 되며 (single/multi 무관), **ConversationTurn 의 top-level `presentations[]`** 단일 운반 경로를 갖는다 (`data?` 필드 내부가 아닌 별도 독립 필드 — `data?` 는 [node-output §4.5](../../conventions/node-output.md#45-interactiondata-payload-규격) 의 `interaction.data` 스냅샷 단일 진실이므로 의미가 다른 데이터를 박지 않음).

**PresentationPayload type 정의 (단일 진실):**

```ts
type PresentationPayload = {
  type: 'table' | 'chart' | 'carousel' | 'template' | 'form';
  toolCallId: string;               // LLM 의 tool_use block id — meta.presentationCalls[] 와 join key
  renderedAt: string;               // ISO 8601 UTC — server side timestamp
  payload: object;                  // 해당 presentation 노드 input schema 와 동일 shape (defaults overlay 후 최종값)
  truncation?: {                    // Carousel/Table 의 tail truncate 적용 시에만 set
    itemsTruncated?: boolean;
    rowsTruncated?: boolean;
    itemsTotalCount?: number;
    rowsTotalCount?: number;
  };
};
```

본 type 의 단일 진실 정의는 본 절. [Conversation Thread §1.2](../../conventions/conversation-thread.md#12-conversationturn) 는 cross-ref 만 둔다 (drift 방지).

```json
{
  "config": { "...": "(§7.1~§7.9 와 동일)" },
  "output": {
    "result": {
      "response": "비교 결과 표로 정리했어요. 영업이익률이 가장 높은 분기는 Q3 입니다.",
      "endReason": "out",
      "turnCount": 1,
      "presentations": [
        { "type": "table", "toolCallId": "call_t1", "renderedAt": "2026-05-22T03:00:00.000Z", "payload": { "...": "(table input schema 동일 shape)" } },
        { "type": "chart", "toolCallId": "call_c1", "renderedAt": "2026-05-22T03:00:00.500Z", "payload": { "...": "(chart input schema 동일 shape)" } }
      ]
    }
  },
  "meta": {
    "...": "(§7.1~§7.9 의 일반 메타)",
    "presentationCalls": [
      { "toolName": "render_table", "toolCallId": "call_t1", "status": "rendered", "bytes": 4823 },
      { "toolName": "render_chart", "toolCallId": "call_c1", "status": "rendered", "bytes": 12039 }
    ]
  },
  "port": "out",
  "status": "ended"
}
```

| 필드 | 타입 | 위치 | 설명 |
|---|---|---|---|
| `output.result.response` | string | handler return | LLM 텍스트 응답. `render_*` 호출이 있어도 텍스트가 비어 있을 수 있다 (예: 차트만 emit). 빈 응답일 때 `response: ""` |
| `output.result.presentations[]` | `PresentationPayload[]?` | handler return | **execution history page 복원용 echo** — `buildMultiTurnFinalOutput` / `buildConditionOutput` 의 `metadata.allPresentations` 가 set 일 때만 운반 (없으면 키 자체 생략). NodeExecution.outputData REST fetch 경로 (live thread snapshot 미동봉) 에서 presentations 를 복원하기 위한 echo. 페이로드 본문의 1차 SoT 는 ConversationTurn `presentations[]` — 두 위치가 동일 데이터 (`metadata.allPresentations` 가 turn-level push 의 합산) |
| `meta.presentationCalls[]` | Array | handler accumulator | `render_*` 호출의 메타 trace. `[{ toolName, toolCallId, status: 'rendered'|'schema_violation'|'dropped'|'form_pending'|'form_submitted', bytes? }]` (Principle 2 메트릭) |
| `meta.presentationSchemaViolations[]` | Array? | handler accumulator | §4.1 의 silent drop 케이스만 echo. `[{ toolName, toolCallId, issues, attempts }]` |
| ConversationTurn `presentations[]` | `PresentationPayload[]` | thread accumulator (1차 SoT) | **top-level 독립 필드 — `data?` 가 아니다**. 실제 페이로드. type 정의는 본 §7.10 의 type block |

**단일 진실 정책 — execution history page 복원 echo**: 페이로드 본문의 1차 SoT 는 ConversationTurn 의 top-level `presentations[]`. 단, `output.result.presentations[]` 도 동일 데이터를 echo 한다 — 사유: live conversation thread snapshot 이 동봉되지 않는 REST fetch 경로 (`/executions/:id` → NodeExecution.outputData) 에서 history view 가 presentations 를 복원하려면 NodeExecution row 안에 데이터가 있어야 한다. thread snapshot 은 in-memory ExecutionContext 의 표현으로, 영속 시 NodeExecution 분산 저장 ([Conversation Thread §4 영속화](../../conventions/conversation-thread.md#4-영속화)) 으로 복원 가능하나 cross-node 조회가 N+1 이라 hydration cost 가 높다. 두 위치는 의도된 echo (Principle 1.1 직교성의 예외) — 두 위치 모두 동일 PresentationPayload 객체 배열을 가지며 drift 방지는 backend 가 한 accumulator (`metadata.allPresentations`) 에서 두 surface 로 동시 push.

`meta.presentationCalls[]` 는 trace/metric 만 (Principle 2) — 본 echo 와 무관.

**다운스트림 접근:**

- `$thread.turns` 에서 `source === 'ai_assistant'` 인 turn 의 `presentations` 로 접근.
- 일반적인 경우 다운스트림 노드는 `output.result.response` 텍스트만 보면 충분. presentation 페이로드를 후속 노드 (예: Send Email) 가 직접 다루려면 thread 접근이 1차.

**`render_form` 의 멀티턴 운반:**

`render_form` 이 호출된 turn 은 §7.4 의 `waiting_for_input` 형식을 따르되 `output.interaction` 가 form preview 를 운반하고, `_resumeState.pendingFormToolCall.toolCallId` 가 set 된다. 사용자 제출 시 §7.5 의 `resumed` 스냅샷이 `output.interaction.{type:'form_submitted', data, receivedAt}` 으로 emit 되고, 다음 turn 의 ConversationTurn 에 `source: 'presentation_user'` push 가 일어난다 (`ai_user` 가 아님 — §6.2 단계 2.c).

## 8. 디버그 데이터 (`meta.turnDebug`)

실행 결과의 `meta.turnDebug` 배열에 포함되는 턴별 디버그 데이터. 프론트엔드 Conversation Inspector / LLM Information Tab 에서 각 LLM 호출의 요청/응답/토큰 사용량을 표시하는 데 사용.

```json
"meta": {
  "turnDebug": [
    {
      "turnIndex": 1,
      "llmCalls": [
        {
          "requestPayload": { "model": "gpt-4o", "messages": [], "tools": [] },
          "responsePayload": { "model": "gpt-4o", "usage": { "inputTokens": 500, "outputTokens": 120 }, "toolCalls": [] },
          "durationMs": 1250
        },
        {
          "requestPayload": { "...tool result 포함...": "..." },
          "responsePayload": { "...최종 응답...": "..." },
          "durationMs": 800
        }
      ],
      "totalDurationMs": 2050,
      "toolCalls": [
        {
          "toolCallId": "call_abc123",
          "name": "kb_workspace_main",
          "providerKey": "kb",
          "status": "success",
          "durationMs": 1240
        }
      ],
      "ragSources": [
        { "documentId": "uuid", "chunkId": "uuid", "documentName": "Refund Policy", "content": "14-day refund window…", "score": 0.92 }
      ],
      "ragDiagnostics": {
        "attempted": true,
        "searchedKbCount": 1,
        "queriesUsed": ["refund window"],
        "resultCount": 1
      }
    }
  ]
}
```

- 한 턴에서 function calling 이 발생하면 `llmCalls` 배열에 여러 항목이 추가됨 — 각 항목은 하나의 LLM API 호출에 대응
- 프론트엔드에서 각 assistant 메시지를 해당 턴의 N번째 LLM 호출과 매칭하여 디버그 정보를 표시
- 실행 결과에 항상 포함됨 (워크플로우 소유자만 실행 결과 조회 가능하므로 별도 접근 제어 불필요)
- `requestPayload` 에 시스템 프롬프트 및 전체 대화 이력이 포함될 수 있음에 유의 — credential 은 `maskSensitiveFields` 가 boundary 에서 자동 마스킹
- 각 turn 항목에 `ragSources` (해당 턴에서 호출된 KB tool 의 chunk delta) 와 `ragDiagnostics` (해당 턴 한정 진단) 가 함께 채워진다. 노드 전체 누적은 `meta.ragSources` / `meta.ragDiagnostics` 를 사용한다 — 두 위치의 값은 **turn delta 의 합 = 전체 누적** 관계를 만족한다.
- MCP 도구가 호출된 턴에는 동일한 delta-누적 관계로 `mcpDiagnostics` 도 turn 단위로 분리되어 노출된다. 노드 전체 누적은 `meta.mcpDiagnostics`.
- `toolCalls` (선택) — 해당 턴에서 실행된 provider tool(KB·MCP) 별 결과 메타. condition tool / 일반 tool stub 은 즉시 결과를 만들므로 포함하지 않는다. `status` 는 `'success' | 'error'` 이며, provider 가 throw 한 경우에도 핸들러가 캐치해 `'error'` 로 마킹하고 LLM 에는 sanitize 된 에러 content 를 그대로 전달한다 (turn 자체는 계속 진행). 이 필드는 Conversation Inspector 의 tool 항목 success / error 배지의 권위 출처. WS `execution.tool_call_started` / `execution.tool_call_completed` 가 손실되어도 동일 데이터로 클라이언트가 복구 가능.
- multi-turn 에서 `turnDebugHistory` 는 직전 `MAX_TURN_DEBUG_HISTORY = 50` 턴만 유지된다 (DB JSONB 비대화 방지).

## 9. Provider 도구 진단 메타

`meta.ragSources` / `meta.ragDiagnostics` / `meta.mcpDiagnostics` 의 의미는 [공통 §7](./0-common.md#7-진단-누적-provider-tool) 참조. 각 필드는 해당 provider 가 호출된 노드에만 존재한다.

| 필드 | 조건 | 출처 |
|------|------|------|
| `meta.ragSources` | `knowledgeBases` 가 1개 이상 | `RagAccumulator.getSources()` (chunkId dedup 적용) |
| `meta.ragDiagnostics` | `knowledgeBases` 가 1개 이상 | `RagAccumulator.getDiagnostics()` |
| `meta.mcpDiagnostics` | `mcpServers` 가 1개 이상이거나 LLM 이 MCP 도구 1번 이상 호출 | MCP provider |

## 10. 에러 코드

AI Agent 의 `output.error.code` 에 사용되는 표준 코드. 단일 진실 공급원: handler / LLM provider 에서 throw 시점.

| code | sub-case / 발생 조건 | retryable | 시점 |
|------|-----------|---|------|
| `LLM_CALL_FAILED` | provider HTTP 5xx | **true** | runtime |
| `LLM_CALL_FAILED` | network timeout | **true** | runtime |
| `LLM_CALL_FAILED` | provider HTTP 401/403 (auth) | false | runtime |
| `LLM_CALL_FAILED` | 분류 불가 fallback — HTTP status·explicit code·network 신호가 모두 없는 throw. 보수적으로 non-retryable 처리 (재시도 안전성 미확인) | false | runtime |
| `LLM_RATE_LIMIT` | provider HTTP 429 (별 sub-case 분리 — `LLM_CALL_FAILED` 의 5xx 와 의미 다름. `LLM_CALL_FAILED` 폐기 안 함, **sub-case 분리** 패턴) | **true** | runtime |
| `LLM_RESPONSE_INVALID` | `responseFormat=json` 인데 JSON 파싱 실패 | false | runtime |
| `TOOL_EXECUTION_FAILED` | 일반 도구 (`tool_*`) 실행 중 예외 — 재작성 후 복원 예정. KB·MCP provider 의 단일 호출 실패는 격리되어 `meta.*Diagnostics.errors` 에 기록되며 대화는 계속됨 (graceful degradation, `error` 포트로 라우팅 안함) | false | runtime |
| `MAX_TOOL_CALLS_EXCEEDED` | (예약) `maxToolCalls` 초과로 강제 종결을 결정한 경우. 현재 핸들러는 `tool_call_budget_exceeded` tool_result 로 회신만 하므로 발생하지 않음. spec §6.1.g 의 budget truncate 정책이 변경되면 이 코드를 사용. | false | runtime (예약) |

**`retryable` 분류 규칙** (CONVENTIONS Principle 3.2.1 LLM 계열 한정 필수):

- `true`: HTTP 429 / 5xx / network timeout — provider 자체적으로 일시 회복 가능. backend 가 `_retryState` 를 운반 (§7.9). UI 는 conversation thread 의 `system_error` item 우측에 `[다시 시도]` 버튼 + `retryAfterSec` 카운트다운 노출.
- `false`: 인증 실패 (401/403) / JSON 파싱 실패 / schema fatal / 사용자 취소 / **분류 불가 fallback** — 재시도해도 동일 실패 예상(또는 안전성 미확인). `_retryState` 미동봉. UI 는 `[다시 시도]` 버튼 미노출.

> **분류는 HTTP status 기반** (멀티턴 `chat()` 경로는 raw provider SDK 에러의 `.status` 를 받는다): 429→`LLM_RATE_LIMIT`, 401/403→`LLM_CALL_FAILED`(non-retryable), 5xx·network·timeout→`LLM_CALL_FAILED`(retryable), 명시 code(`LLM_RESPONSE_INVALID` 등)→보존(non-retryable). status·code·network 신호가 모두 없으면 `LLM_CALL_FAILED`(non-retryable) fallback 으로 매핑한다 — 별도 `AI_*` fallback 코드를 쓰지 않는다(§10 단일 LLM taxonomy 유지). 구현: `ExecutionEngineService.classifyLlmError`.

**`retryAfterSec` 추출**: provider 가 `Retry-After` 헤더 (Anthropic / OpenAI) 또는 동등 신호 (Google Gemini 의 `retryDelay`) 를 제공한 경우 핸들러가 초 단위로 변환해 `details.retryAfterSec` 에 set. invariant: `retryable === true` 일 때만 set 가능.

> **`render_*` 표현 도구 schema 위반은 `error` 포트를 발화시키지 않는다** — 1회 재시도 후 silent drop + `meta.presentationSchemaViolations[]` 누적 (§4.1). 정상 텍스트 응답이 있으면 그것만 surface 한다 (텍스트 fallback). turn 자체는 정상 종결. 본 결정은 `render_*` 가 표현 surface 확장이라 LLM 의 schema 위반이 워크플로 분기를 끊으면 안 된다는 §4.1·§12.4 원칙에서 비롯.

**Pre-flight 에러** (config 검증 실패 — Principle 3.1 `throw`):

| 발생 조건 | 메시지 (warningRule id 또는 validateConfig) | 시점 |
|-----------|---------|------|
| `model` 과 `llmConfigId` 모두 누락 | `ai_agent:no-llm-provider` (`AI_NO_LLM_PROVIDER_MESSAGE` — provider 미설정) | warningRule (캔버스 배지) + handler.validate |
| `mode=multi_turn` 인데 `systemPrompt` 누락 | `Multi Turn 모드에서는 System Prompt 가 필요합니다.` | warningRule + handler.validate |
| `mode=single_turn` 인데 `systemPrompt`·`userPrompt` 모두 누락 | `System Prompt 또는 User Prompt 중 하나는 입력해야 합니다.` | warningRule + handler.validate |
| `conditions.length > 20` | `Conditions 는 최대 20개까지 추가할 수 있습니다.` | warningRule + handler.validate |
| `conditions[i].id` 누락·string 아님 | `conditions[${i}]: id is required` | handler.validate |
| `conditions[i].id` 가 예약 포트 (`out`/`in`/`error`/`user_ended`/`max_turns`) | `conditions[${i}]: id '<id>' conflicts with reserved port name` | handler.validate |
| `conditions[i].label` 누락 | `conditions[${i}]: label is required` | handler.validate |
| `conditions[i].prompt` 누락 | `conditions[${i}]: prompt is required` | handler.validate |
| `conditions[i].prompt` > 2000자 | `conditions[${i}]: prompt must be 2000 characters or less` | handler.validate |
| `mode=multi_turn` 인데 `maxTurns < 0` 또는 number 아님 | `maxTurns must be 0 (unlimited) or a positive integer` | handler.validate |

> 프론트엔드 캔버스 요약/경고는 `getConfigSummary` (`codebase/frontend/src/lib/utils/node-config-summary.ts`) 가 backend `warningRules` 를 평가해 도출한다. `*:no-llm-provider` (AI Agent 의 `ai_agent:no-llm-provider`) blocking 경고는 외부 `hasDefaultLlmConfig` context flag 에 의존 — 워크스페이스 default LLM 이 있으면 (`context.hasDefaultLlmConfig === true`) 캔버스 배지에서 이 규칙을 drop 한다. backend `warningRules` 는 이 context 를 모르므로 `model`/`llmConfigId` 둘 다 missing 시 무조건 fire — frontend 가 context-aware 하게 배지만 suppress 하고 backend review 는 그대로 fire 한다.

## 11. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `AI Agent` 행 인용. mode·model·도구 수·KB 수·MCP 수·조건 수·표현 도구 수를 동적으로 조합 (`multi_turn` 시 `Multi Turn` 접두어).

예: `gpt-4o · 2 tools · 1 KB · 1 MCP · 3 cond` (single) / `Multi Turn · gpt-4o · 1 KB · 2 MCP · 2 cond · 3 render` (multi, `presentationTools.length === 3`)

---

## 12. Rationale

### 12.1 왜 ConversationThread 를 1급 객체로 도입했는가

**문제**: 기존 워크플로우에서 AI Agent 는 두 가지 컨텍스트 격리에 갇혀 있었다.

1. Presentation 노드의 사용자 인터랙션을 자동으로 모름 — 사용자가 매번 `{{ $node["Form1"].output.interaction.data.email }}` 형태로 system prompt 에 명시 참조해야 했다.
2. AI Agent → ... → AI Agent 시 두 번째 AI Agent 가 첫 번째의 multi-turn messages 를 못 봄 — `stripControlFields()` 가 `_resumeState` 를 제거하므로 final response 텍스트만 전달.

**결정**: Conversation Thread 모델을 1급 객체로 정식 도입한다. 표현식 슈가 (`$conversation`) 나 messages 노출 + 명시 주입 방식은 사용자가 매번 표현식으로 결합해야 하고 텍스트 요약 시 구조가 손실되는 반면, Conversation Thread 모델은 진짜 대화 흐름을 보존하고 자동 주입한다. presentation interaction + AI 대화 turn 통합 thread, 노드 설정 자동 주입, messages/system_text 형식 선택.

**v1 vs v2 경계**:
- v1: 단일 thread, char 기반 cap, in-memory + NodeExecution 분산 SoT, `ai_agent` 만 자동 주입 (push 는 3 AI 노드 모두). 신규 DB 컬럼 없음.
- v2: multi-thread, token-aware cap, `text_classifier`/`information_extractor` 도 주입, DB 컬럼 마이그레이션 검토.

상세는 [Spec Conversation Thread §7](../../conventions/conversation-thread.md#7-v2-로드맵) 참조.

### 12.2 `conversationHistory` 제거 사유 (history)

옛 `conversationHistory: 'none' | 'last_n' | 'full'` + `historyCount` 필드는 schema·spec 표에는 정의되어 있었으나 **handler 코드가 한 번도 읽지 않는 deadweight** 였다. 의도된 동작 ("이전 N개 대화 이력 보관") 은 multi-turn 자체 messages 배열로 항상 누적되었으므로 사실상 noop. Conversation Thread 도입과 함께 `contextScope`/`contextScopeN` 으로 완전 대체했고, schema·UI 메타·기본값 초기화 로직까지 모두 제거됐다. 스키마가 `.passthrough()` 이므로 DB legacy 워크플로 데이터에 두 키가 남아 있어도 silently 통과.

### 12.3 System Context Prefix 도입

`includeSystemContext` / `systemContextSections` 필드 도입 — systemPrompt 앞에 현재 시각·timezone 자동 prefix. 설계 SoT 와 결정 근거는 [공통 §11](./0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix) 및 [공통 §Rationale "시스템 컨텍스트 자동 주입"](./0-common.md#rationale). 본 노드는 §1 config 표 + §6.1/§6.2 실행 로직 + §7 config echo 의 3 지점만 갱신했다. [Cafe24 API Metadata §5.3](../../conventions/cafe24-api-metadata.md#53-ai-agent--mcp-도구-description-자동-suffix) 도구 description 자동 suffix 와 한 묶음 결정.

### 12.4 Presentation Tool Family (`render_*`) 도입

**문제**: AI Agent 의 응답 surface 는 텍스트 (`output.result.response`) 한 가지. LLM 이 "표/차트/캐러셀 로 보여줘야 한다" 라고 판단해도 그 결과를 만들 경로가 없어, 사용자는 워크플로 그래프에 별도 Presentation 노드를 명시 연결해 매핑 표현식을 일일이 작성해야 했다. 그래프 분기와 표현 surface 가 한 layer 에 묶여 있어, "LLM 이 응답 형식을 골라 만들도록" 위임할 수 없었다.

**결정**: per-node opt-in `presentationTools[]` + `render_*` prefix + 5종 동시 출시 + display-only / interactive 구분 + schema-violation silent fallback 을 채택한다. per-node 정책이라 과금 추적 / RBAC / 예측 가능성이 자연스럽고 (워크스페이스 전역 토글은 한 노드만 표현 surface 를 쓰고 싶을 때 막음), 단일 진실 schema 를 재사용하며, `cond_*` 와 직교해 기존 워크플로 영향이 0 이다. `render_*` prefix 는 frontend 모듈명 (`presentation-renderers.tsx`) 과 직접 매핑돼 코드 추적 비용이 최저다. 5 도구가 동일 패턴 (zod schema 재사용, dispatcher 분기) 이라 단계 분리 없이 동시 출시한다. Render 결과의 워크플로 분기 흉내 (버튼 클릭 → 다른 출력 포트) 는 `cond_*` 와 책임이 중복돼 배제 — 역할은 "AI 세션 안 표현 (`render_*`) vs 노드 그래프 분기 (`cond_*`)" 로 분리한다.

**`tool_*` 슬롯과의 관계**:

재작성 대기 중인 일반 도구 (`tool_*`) 슬롯과 본 작업은 **직교** — 의도 다름 (외부 노드 사이드이펙트 호출 vs 응답 surface 확장), schema 출처 다름 (`toolNodeIds` 가리키는 노드 vs presentation 노드 input schema 재사용), 결과 라우팅 다름 (해당 노드의 다운스트림 vs AI session 안의 thread). `tool_*` 재작성이 어느 모델로 결정되더라도 `render_*` 와 충돌하지 않으며, dispatcher 분류는 5분류 (cond/kb/mcp/render/tool) 패턴이 유지된다.

**Schema 위반의 silent fallback 결정**:

`error` 포트로 발화시키지 않은 이유 — `render_*` 는 응답 표현 surface 의 확장이라 LLM 의 형식 위반이 워크플로 분기를 끊으면 사용자 입장에서 "AI 가 가끔 텍스트만 보이다가 가끔 멈춤" 처럼 보인다. 텍스트 응답이라는 1차 surface 는 유지하되 표현 시도만 silent drop + `meta.presentationSchemaViolations[]` 로 surface 하여, 사용자가 prompt 를 다듬을 수 있게 한다. KB/MCP 의 graceful degradation 원칙 (`meta.*Diagnostics.errors` 격리) 과 정합.

**v1 vs v2 경계**:
- v1: per-node opt-in, 5 도구 동시 출시, schema 위반 silent drop, presentation 페이로드는 ConversationTurn **top-level `presentations[]`** 단일 진실 (`data?` 와 별개), downstream 은 thread 접근.
- v2 (예정): `render_*` 페이로드를 별도 출력 포트로 라우팅하는 옵션 (사용자가 명시 opt-in 시), presentationTools defaults 의 expression 지원 확장, presentation 노드 종류 추가 시 자동 노출.

**근거**: "AI 노드들이 멀티턴으로 설정되었을 때, LLM의 판단에 따라 적절한 표시 노드(presentation node)를 tool calling 방식으로 호출하여 응답을 표현" 하려는 요구에서 출발 — per-node opt-in / 5종 동시 출시 / 워크플로 분기 흉내 금지 / schema 위반 1회 재시도 후 silent fallback.

### 12.5 `render_form` 활성 form 의 timeline 인라인 표현 통합

**문제**: `render_form` blocking flow 정식 출시 후 활성 단계 UX 에 3가지 회귀가 있었다.

1. submit 직후 timeline 과 detail panel 이 모두 빈 상태로 깜빡인 뒤 AI 응답 도착 시점에 다시 표시 — frontend store 의 `resumeFromForm` 가 `waitingNodeId / waitingInteractionType / waitingConversationConfig / isWaitingAiResponse` 를 한꺼번에 클리어해 ConversationInspector 가 live → completed 분기로 떨어졌는데 server-side 는 아직 waiting → `result.status` 불일치로 preview = null.
2. submit 후에도 form 이 안 사라짐 — execution detail page 의 `isWaitingConversation` 분기가 `ConversationInspector` 만 그리고 DynamicFormUI 분기 자체가 안 그려져, assistant turn 의 `presentations[]` 안 `form` payload 가 `FormSubmittedContent` 로 영구 history 잔존하는 게 form 인 양 보임.
3. form 이 message input UI 아래에 stack 된 시각이 부자연스러움 — `result-detail.tsx` 가 `[ConversationInspector(timeline+MessageInput)] → [DynamicFormUI]` 순으로 stack, 캐러셀이 assistant turn 안에 inline 되는 패턴과 대조.

근본은 같은 layer 의 동일 문제 — "활성 form 의 UI 표면이 timeline 메시지가 아니라 별도 surface" 이기 때문. 3가지가 한 덩어리로 묶여 있다.

**결정**: Assistant turn 의 `presentations[*].form` 이 활성 form 의 UI 단일 진실이 되고, `pendingFormToolCall.toolCallId` 매칭으로 active vs submitted 를 분기한다. 신규 store action `resumeFromAiRenderForm` 가 `pendingFormToolCall` 만 클리어하고 나머지는 보존하며, form bypass 시 cancelled tool_result fallback 을 둔다. 이로써 3가지 회귀가 한 번에 정리되고 캐러셀·차트 시각 패턴과 일관되며 form 우회 자유가 보존된다. Form 활성 중 MessageInput 은 그대로 활성 (form 우회 허용) — 사용자가 form 우회로 텍스트를 보내 LLM 의 다음 행동을 유도하는 자유를 막지 않기 위함이다. Active form 을 별도 ConversationTurn source 로 분리하는 안은 source enum 확장 영향이 커서 배제 — `presentations[]` payload 의 `type: 'form'` 이 이미 분류 정보를 들고 있고 active 여부는 `pendingFormToolCall.toolCallId` 매칭으로 판별 가능하다.

**`formConfig` 위치 단일화**: `pendingFormToolCall` 은 `{ toolCallId, formConfig }` shape 으로 통일한다 — frontend 가 form payload 출처를 단일 위치에서 읽도록 SoT 를 정리한 결정.

**Form bypass 의 cancelled tool_result 선택**: render_form 도구 호출의 tool_result 가 채워지지 않으면 Anthropic/OpenAI 의 다음 호출에서 tool_use ↔ tool_result 매칭 에러가 발생한다. cancelled 신호 (`{type:'cancelled', reason:'user_sent_message_instead'}`) 로 명시 회신 — LLM 이 form 호출이 취소됐음을 인식해 다음 reasoning 에서 form 재호출 / 텍스트 응답 / 다른 도구 호출을 자율 결정. backend 가 강제 prompt 박지 않는 이유: LLM 의 reasoning autonomy 침해를 피함.

**근거**: "submit 후 timeline 이 사라지고, form 이 안 사라지고, 입력창 아래에 form 이 떠 있어 부자연스럽다" 는 보고에서 출발 — form 활성 중 MessageInput 은 그대로 활성 (form 우회 허용) 으로 결정.

### 12.6 `render_form` submit 후 LLM 의 동일 form 재호출 회귀 차단

**문제**: `render_form` 으로 띄운 form 을 사용자가 submit 한 직후, 같은 turn 의 LLM 응답이 **동일한 `render_form`** 을 다시 emit 해 form 이 또 떠 버린다. 재현 시나리오 — 사용자가 "샘플상품 1 → 문의하기" 흐름의 form 에 subject=대량구매 / content=1000개 구매하려는데 납품 가능일… 입력 후 submit → 즉시 같은 "샘플상품 1 문의하기" form 이 재렌더링.

**원인 분석**:

stub `{ok:true, pending:'form_submission'}` shape 에서는 `ok:true` 신호가 살아 있었으나, submit 후 content 를 `{type:'form_submitted', data:{…}}` 로 교체하면서 `ok:true` 가드 신호가 소실됐다. 다음 두 가지가 결합해 회귀를 일으켰다:

1. **system prompt 의 재호출 금지 가드 미커버** — §4.1 `PRESENTATION_TOOLS_GUIDANCE` 의 "재호출 금지" 안내는 `{ok:true, rendered:true, ...}` (display-only) 패턴만 명시. `{type:'form_submitted', data:{…}}` shape 는 가드 대상 밖이라 LLM 이 "표시 여부 불확실 → 다시 호출" 라인의 동형 회귀를 일으킬 가능성.
2. **tool_result content 가 user input 처럼 읽힘** — handler 의 `form_submitted` 분기는 `messages.push({role:'user', ...})` 를 하지 않아 모델이 보는 마지막 메시지가 tool_result 1개뿐. 그 안의 `data.{subject, content}` 가 user 입력처럼 읽혀 LLM 이 "새 문의 요청" 으로 오독해 같은 render_form 을 재호출.

채택안은 tool_result content shape 보강이다 — 기존 `{type, data}` 유지 + 가드 필드 `ok:true`, `message:'<재호출 금지 + 후속 행동 유도 안내문>'` 추가 + `PRESENTATION_TOOLS_GUIDANCE` 에 `form_submitted` 케이스 안내 라인 추가. 4-layer SSOT 의 다른 layer (NodeOutput interaction.type / internal bus sentinel / WS wire) 영향이 0 이고, LLM reasoning 자율성 (§12.5) 을 유지한다 — 안내문은 상태 신호이지 행동 강제가 아니다.

**기각된 추가 필드**:

- `rendered: false` — display-only 경로의 `rendered: true` (성공 표시 신호, §4.1 표 / `PRESENTATION_TOOLS_GUIDANCE`) 와 동일 키를 공유한다. LLM 이 `rendered:false` 를 "표시 실패" 로 오독해 같은 form 을 다시 띄우려 시도할 가능성. 가드의 목적이 재호출 차단인데 오히려 재호출을 유발하는 회귀 위험으로 기각.
- `status: 'form_submitted'` — 기존 `type: 'form_submitted'` 와 동일 값을 중복 운반한다. 두 키가 같은 LLM 입력에 등장하면 권위 신호가 모호하다. `type` 이 이미 4-layer SSOT 의 SoT 키이므로 `status` 는 추가하지 않는다.

**LLM reasoning autonomy 와의 정합**: §12.5 의 form bypass 결정에서 backend 가 강제 prompt 를 박지 않는 이유로 "LLM reasoning autonomy 침해 회피" 를 명시했다. 본 §12.6 의 `message` 필드는 **상태 신호** (form 이 submit 되었음 + 같은 컨텐츠 재호출은 무의미함) 의 전달이며, 다음 행동은 여전히 LLM 이 자율 결정한다 ("후속 답변 / 다른 도구 호출 / turn 종결" 중 택). 따라서 §12.5 의 원칙과 충돌하지 않는다.

**다른 layer 영향 없음**: 본 변경은 [Presentation 공통 §10.9](../6-presentation/0-common.md#109-form-submission-wire-format-internal-bus-sentinel) 의 4-layer SSOT 중 (4) LLM tool_result content layer 한정. (1) 외부 WS wire / (2) internal continuation bus sentinel / (3) NodeOutput `interaction.type` 은 변경 없음 — §10.9 의 "외부 surface 와 internal layer 분리" 원칙과 동형.

### 12.7 `render_form` submit 후 formData 크기 cap

**문제**: §12.6 에서 `form_submitted` tool_result content shape 을 `{ok, type, data, message}` 로 보강했으나, `data` 필드 (사용자가 form 에 입력한 값) 자체에는 크기 제한이 없다. 사용자가 form 의 textarea 에 대량 텍스트 (예: 100KB) 를 입력하면 그 전체가 LLM 컨텍스트로 직접 직렬화되어 token 비용 폭주 + LLM rate limit / context window 초과 위험.

**결정**: 새 상수 `FORM_SUBMITTED_MAX_BYTES = 10 * 1024` (10KB) 의 cap 을 form_submitted tool_result content 의 `data` 필드 에만 적용.

- cap 초과 시: 각 string field 의 값을 균등 truncate (`...<truncated>` 마커 부착). 모든 필드명/구조 보존 — LLM 이 어떤 필드가 잘렸는지 식별 가능. 비-string 필드 (boolean / number / array / object) 는 그대로 유지 (보통 작음).
- tool_result content 에 옵셔널 `formDataTruncation` 메타 필드 부착 (cap 초과 시에만):
  ```json
  {
    "formDataTruncation": {
      "originalBytes": <number>,
      "bytesAfterCap": <number>,
      "truncatedFields": [<string>...]
    }
  }
  ```
  LLM 이 truncate 사실을 reasoning 에 반영하도록 명시 신호.
- `message` 필드 (재호출 금지 + 후속 행동 유도) 는 truncation 케이스에도 동일 유지 — §12.6 의 LLM reasoning autonomy 원칙 (§12.5) 과 정합.

**필드명 충돌 회피**:

- `formDataTruncation` (≠ `truncation`) — `PresentationPayload.truncation` (display-only render_* 의 carousel/table tail-truncate 메타, §7.10) 과 키 이름 분리.
- `bytesAfterCap` (≠ `cappedBytes`) — `render-tool-provider.ts` 의 로컬 변수 `cappedBytes` 와 의미 분리.

**Shape SoT 표기 영향**: §4.1 표 / §6.1.d.ii / §6.2 step 2.c 의 tool_result content 표기는 `{ok, type, data, message}` 그대로 유지. `formDataTruncation` 은 cap 초과 시에만 부착되는 옵셔널 메타라 본문 SoT 표기에 추가하지 않는다. 본 §12.7 + [Presentation 공통 §10.9](../6-presentation/0-common.md#109-form-submission-wire-format-internal-bus-sentinel) (4) layer 행 비고에서만 정의.

채택안은 per-field string 균등 truncate + `formDataTruncation` 메타다 — 모든 필드를 보존해 LLM 이 부분 정보로도 reasoning 가능하고 어떤 필드가 잘렸는지 식별된다. 전체 reject (cap 초과 시 error 회신 + retry 요청) 는 form submit 이 사용자 행위라 retry 의미가 없어 (사용자가 입력 줄여 재제출해야 함) UX 단절로 배제했고, tail-truncate (마지막 필드 통째로 drop) 는 필드 순서가 의미를 갖지 않는 form 에서 무작위 drop 효과라 어느 정보가 사라졌는지 알기 어려워 배제했다.

**알고리즘 — render-tool-provider 의 1MB cap 과의 차이**:

display-only 의 `PRESENTATION_MAX_BYTES = 1MB` 은 `carousel.items` / `table.rows` 배열의 tail-truncate (binary search 로 fitting length 결정) — 배열 원소가 동일 schema 라 일부만 보내도 의미 보존. 본 §12.7 은 **dict (form fields) 의 per-field string truncate** — 알고리즘은 독립이지만 "LLM 입력 cap + 명시적 truncation 메타" 라는 의도는 동형. cap 값도 10KB vs 1MB 로 다름 (form 입력 vs presentation payload 의 크기 분포 차이).

**다른 layer 영향 없음**: §12.6 와 동일하게 [Presentation 공통 §10.9](../6-presentation/0-common.md#109-form-submission-wire-format-internal-bus-sentinel) 의 4-layer SSOT 중 (4) LLM tool_result content layer 한정. (1) 외부 WS wire / (2) internal continuation bus sentinel / (3) NodeOutput `interaction.type` 변경 없음.

### 12.8 `retry_last_turn` 성공 후 downstream graph 진행

본 절은 §7.9 "재진입 종결 후 graph 진행" 단락의 결정 근거다.

**문제**: 초기 구현은 `retry_last_turn` 으로 재진입한 turn 이 성공해도 Execution 을 즉시 `COMPLETED` 로 마감해, 해당 AI 노드의 downstream 으로 연결된 노드 (예: HTTP Request, Send Email) 가 실행되지 않는 갭이 있었다. spec 의 "노드 단위 재시도" 표현이 워크플로 Re-run ([§13](../../5-system/13-replay-rerun.md)) 과의 구분 (Execution 단위 vs 노드 단위) 의도였음에도 일부 독자가 "downstream 도 의도적으로 차단" 으로 오독할 여지가 있었다.

**결정**: retry 성공 시 spawn 된 NodeExecution 은 일반 노드 `COMPLETED` 와 동일하게 downstream graph 로 진행한다. retry 의 단위는 "마지막 LLM 호출 재진입" 까지이며, 그 결과의 graph traversal·종결 정책은 일반 노드와 같다 — 이는 [실행 엔진 §1.1 + §2.1](../../5-system/4-execution-engine.md) 의 워크플로 엔진 기본 invariant ("성공한 노드는 출력 포트의 downstream 으로 진행") 의 자연스러운 적용이지 새 정책이 아니다. 본 §7.9 의 명시는 구현 정렬을 위한 표면 명확화다.

**기각된 대안**:

- **downstream 도 차단 (현 구현 유지)** — 사용자가 retry 로 대화를 살린 뒤 워크플로의 나머지 분기는 별도 Re-run 으로 다시 돌려야 한다는 의미가 되어, "한 노드만 살리고 나머지 흐름은 그대로" 라는 retry 의 본래 목적과 충돌한다.
- **별도 `execution.retry_last_turn_and_resume` 명령으로 분리** — 사용자가 두 가지 retry 행위를 구분해 선택해야 하는 추가 인지 부담. retry 의 본질은 항상 "그 노드를 살리고 워크플로를 정상 진행" 이라 분리할 이유가 없다.

### 12.9 `memoryStrategy` 를 contextScope enum 확장이 아닌 별도 필드로 둔 근거

**문제**: 자동 컨텍스트 메모리 (summary_buffer / persistent) 를 도입할 때 기존 `contextScope` enum (`none`/`thread`/`lastN`) 에 `auto` 값을 끼워넣는 안이 자연스러워 보인다 — UI 드롭다운 하나만 추가하면 되기 때문.

**결정**: 별도 1급 필드 `memoryStrategy` 를 도입한다. `contextScope` 는 "어느 **범위**의 thread turn 을 주입할지" (범위 축) 이고, `memoryStrategy` 는 "메모리를 **어떻게 관리**할지" (관리 축) 라 의미 축이 다르다. enum 에 `auto` 를 섞으면 (1) 한 필드에 두 축이 얽혀 config echo·UI `visibleWhen` 규칙이 상호 의존하고, (2) `contextScopeN`/`contextInjectionMode`/`includeToolTurns` 가 `auto` 일 때 의미가 모호해지며, (3) 하위호환 echo 가 복잡해진다. 별도 필드면 `manual`(기본) 경로가 기존 5필드 동작을 **완전 무변경**으로 보존하고 (하위호환 0 리스크), 자동 전략은 직교 축으로 추가되며, `visibleWhen` 이 strategy 값만 보면 되어 단순하다. `manual` 단어가 `Trigger.type: 'manual'` 과 표면상 겹치나 namespace (`memoryStrategy` vs `Trigger.type`) 가 달라 의미 명료성을 우선해 그대로 둔다.

### 12.10 conversation-thread v1/v2 경계 번복의 근거

**배경**: [conversation-thread §7 v2 로드맵](../../conventions/conversation-thread.md#7-v2-로드맵) 은 "Token-aware cap" 과 "DB 컬럼 신설" 을 v2 로 유보했고, §12.1 의 v1/v2 경계표도 "token-aware cap·DB 컬럼은 v2" 로 기술했다. 본 작업은 토큰예산 압축과 DB 영속 메모리를 v1 노드에 도입하므로 외형상 그 유보를 번복한다.

**근거 (deep-research 적대적 검증)**:
- **번복이 아니라 합의된 실현**: §7 v2 로드맵의 "Token-aware cap" 은 "char-기반 cap 을 토큰 인식 방식으로" 라는 방향성 자체가 본 작업과 일치한다. 다만 본 작업은 **token-budget 근사** 방식 (`memoryTokenBudget`) 이고, provider tokenizer-exact 방식은 여전히 v3 로드맵 잔존이다 — §7 항목을 그 정밀도로 분리 표기했다 (부분 실현).
- **트리거는 턴 수가 아니라 토큰 예산**: LangChain `ConversationSummaryBufferMemory`(max_token_limit), Anthropic compaction docs 등 업계·논문 공통이 토큰 예산을 트리거로 쓴다. 턴 크기 분산이 커서 "턴 수" 는 예산을 제어하지 못한다.
- **요약은 net-positive (캐시 오해 기각)**: "요약이 prompt cache 를 깨서 역효과" 라는 우려는 적대적 검증에서 기각됐다 — 압축의 비용절감이 캐시 재구축을 상회한다. 단 안정 프리픽스(system+요약)/휘발성 꼬리(최근 원문) 분리 + 임계치 도달 시에만 갱신으로 캐시를 보호한다 (§12.11).
- **요약만으로 부족 → 검색 회수 병행**: LongMemEval (arXiv 2410.10813) 에서 장기 대화 정확도가 크게 하락한다 (요약 압축의 디테일 손실). persistent 은 추출 사실의 의미검색 회수를 병행해 보완한다.
- **DB 컬럼은 thread 가 아니라 별도 테이블**: §7 "DB 컬럼 신설" 은 `Execution.conversation_thread jsonb` 를 가리킨다. 본 작업의 DB 영속은 그 컬럼이 아니라 **별도 테이블 `agent_memory`** ([Spec Agent Memory](../../5-system/17-agent-memory.md)) 이며, ConversationThread 본문의 "v1 신규 DB 컬럼 없음" 조항은 그대로 유지된다 (모순 아님 — [conversation-thread §4](../../conventions/conversation-thread.md#4-영속화)). 실행 중 요약 보관 필드 (`runningSummary`/`summarizedUpToSeq`) 는 Redis `ExecutionContext` 직렬화에만 포함되고 신규 DB 컬럼을 만들지 않는다.

### 12.11 요약·회수 블록을 system_text 안정 프리픽스에 배치하는 ordering 근거

**문제**: 롤링 요약 블록과 persistent 회수 블록을 LLM 입력의 어디에 둘지 — messages 배열 안 (휘발성 영역) 인가, systemPrompt 안정 프리픽스 인가.

**결정**: 둘 다 **system_text 안정 프리픽스 영역** ([공통 §11.4 ordering](./0-common.md#114-주입-위치-및-ordering)) 에 배치하고, 압축되지 않은 최근 원문 turn 만 휘발성 꼬리로 둔다. 근거: prompt cache 는 **접두사 안정성** 에 의존한다 — 매 turn 바뀌는 최근 원문이 앞에 오면 캐시가 매번 깨진다. 요약/회수 블록을 안정 프리픽스에 두고 **임계치 도달 시에만 갱신**하면 (매 turn 재요약·재회수 금지), 안정 프리픽스가 오래 유지되어 캐시 히트가 극대화된다. §11.4 ordering 표는 `System Context Prefix → 사용자 systemPrompt → KB/condition suffix → thread injection` 인데, 본 작업은 그 thread injection 단계 안에서 **요약/회수 블록 (안정) → 최근 원문 turn (휘발성)** 의 하위 순서를 추가한다 (휘발성 최근 turn 보다 요약·회수가 앞). ordering 의 단일 SoT 는 여전히 [공통 §11.4](./0-common.md#114-주입-위치-및-ordering) — 본 절은 그 안의 메모리 블록 하위 순서를 기술한다.
