# Spec: AI Agent

> 관련 문서: [AI 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec MCP Client](../../5-system/11-mcp-client.md) · [Spec RAG 검색](../../5-system/9-rag-search.md) · [Spec Graph RAG](../../5-system/10-graph-rag.md) · [Spec LLM Config](../../2-navigation/6-config.md) · [CONVENTIONS](../../../user_memo/node-specs-improvement/CONVENTIONS.md)

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
| knowledgeBases | UUID[] | | `[]` | 참조할 Knowledge Base ID 목록. [공통 §2](./0-common.md#2-knowledge-base-연동) |
| ragTopK | Integer | | `5` | KB tool 호출 시 반환할 청크 수의 기본값 (LLM 이 호출 인자로 override 가능) |
| ragThreshold | Float | | `0.7` | 최소 유사도 임계값 (0-1) 의 기본값 (LLM 이 호출 인자로 override 가능) |
| mcpServers | McpServerRef[] | | `[]` | MCP 서버 참조 목록. [공통 §3](./0-common.md#3-mcp-서버-연결-ai-agent-전용) |
| maxToolCalls | Integer | ✓ | `10` | 최대 도구 호출 횟수 (KB·MCP·일반 합산) |
| conversationHistory | `none` / `last_n` / `full` | ✓ | `none` | 대화 이력 보관 방식 |
| historyCount | Integer | | — | `last_n` 시 보관 대화 수 |
| maxTurns | Integer | | `20` | Multi Turn 모드 시 최대 대화 턴 수 (`0` = 무제한). `mode=multi_turn` 일 때만 UI 표시 |
| conditions | ConditionDef[] | | `[]` | 조건 목록. 조건이 있으면 조건별 동적 출력 포트(`{condition.id}`)를 생성한다 |

> Multi Turn 모드에서 사용자 응답은 **무제한 대기**합니다. (외부 cancel 외에는 타임아웃이 발생하지 않습니다.)

> ⚠ **도구 연결 입력 경로 — 재작성 예정 (현재 제거됨)**
>
> `toolNodeIds`, `toolOverrides` 필드, §Tool Area 연동, 캔버스 Tool Area UX(`spec/3-workflow-editor/0-canvas.md` §12), 일반 도구 이름 규칙(`tool_*`) 은 모두 **config 스키마에서 제거**됐다. 새 도구 연결 입력 경로 디자인이 결정될 때까지 비활성. 스키마는 `.passthrough()` 이므로 DB 의 legacy 워크플로 데이터에 두 키가 남아 있어도 silently 통과하지만 핸들러는 읽지 않아 LLM 에 일반 도구가 등록되지 않는다.
>
> 영향 범위: ND-AG-06 / ND-AG-10 / ND-AG-21.
> 영향 없음: 조건 도구(`cond_*`, ND-AG-15~20·22), KB 도구(`kb_*`), MCP 도구(`mcp_*`).
> 자세한 사유·복원 절차: `plan/complete/ai-agent-tool-connection-rewrite.md`.

**ConditionDef 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | 조건의 고유 식별자. 출력 포트 ID 로 사용. LLM 도구 이름은 `cond_` 접두사 + 정제된 UUID 로 자동 생성. 생성 시 UUID v4 할당, 이후 불변 |
| label | String | ✓ | 조건 이름 (UI 표시 및 포트 라벨) |
| prompt | String (≤ 2000자) | ✓ | 조건 설명 (LLM 도구의 description 으로 사용 — "언제 이 조건을 선택해야 하는지" 기술) |

> Source of truth: `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` (export `aiAgentNodeConfigSchema`)

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
│  ── Conversation History ──              │
│  Mode: [Last N ▼]  Count: [10]           │
│                                          │
│  ── Multi Turn Settings ── (multi_turn 시) │
│  Max Turns:    [20__]                    │
└──────────────────────────────────────────┘
```

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
- 정제(sanitize): UUID 내 `-` 등 비영숫자 문자를 `_`로 치환하여 LLM API 호환성 보장
- 접두사로 도구 카테고리(일반·조건·KB·MCP)를 명확히 구분하여 이름 충돌 방지
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

1. Knowledge Base / MCP 서버 setup:
   a. KB 도구(`kb_*`) 와 MCP 도구(`mcp_*`, 메타도구 포함)를 일반 도구·조건 도구와 함께 LLM 에 노출 — KB 검색은 [Spec RAG §2](../../5-system/9-rag-search.md#2-검색-호출-흐름-llm-tool-calling), MCP 는 [Spec MCP Client §7](../../5-system/11-mcp-client.md#7-실행-흐름-요약) 참조
   b. KB 검색은 LLM 의 능동 호출 시에만 실행되며 prefill 하지 않음
2. systemPrompt + userPrompt로 LLM 호출 (tools 파라미터에 위 도구들이 포함됨)
3. LLM이 도구 호출을 요청하면:
   a. `toolCalls`를 **조건 도구**(`cond_*`) / **KB 도구**(`kb_*`) / **MCP 도구**(`mcp_*`) / **일반 도구**(`tool_*`) 로 분류 — provider 의 `matches()` 가 우선 판정, 어디에도 매칭 안 되면 일반 도구로 분류
   b. **조건 도구만 존재:** 해당 조건 포트로 즉시 라우팅
   c. **조건 도구 + 비조건 도구 혼재:** 비조건 도구(KB·MCP·일반)를 먼저 실행, 결과를 LLM에 전달하여 재평가
   d. **비조건 도구만 존재:** 각 provider가 자체 실행 (KB → 검색, MCP → MCP RPC, 일반 → Tool Area 호출). 각 호출의 결과는 분리된 tool_result 메시지로 LLM 에 그대로 전달된다 (호출 간 score 병합·재정렬 없음 — 에이전트가 직접 종합).
   e. 한 서버·KB 의 실패는 격리되어 `meta.mcpDiagnostics.errors` / `meta.ragDiagnostics` 에 기록되며 LLM 대화는 계속됨 (graceful degradation)
   f. **provider 도구 (KB·MCP) 는 동일 turn 내 `Promise.all` 로 병렬 실행** — LLM 이 한 응답에 여러 `tool_use` 를 emit 하면 latency 가 max(N) 으로 단축됨. tool_result message push 순서는 Promise.all 결과 순서대로 직렬 적용해 누적이 결정적이다.
   g. maxToolCalls 초과 전까지 반복 (KB·MCP·일반 호출 모두 합산). batch 진입 시 잔여 한도를 초과하는 호출은 앞쪽부터 truncate 하고 잔여분에 대해 `tool_call_budget_exceeded` tool_result 회신 (Anthropic 의 tool_use ↔ tool_result 매칭 요건 충족).
4. 최종 응답을 출력 형식에 맞게 변환 (`responseFormat=json` 시 `JSON.parse`, 실패하면 raw 문자열 유지)
5. `out` 포트로 출력 (§7.1)
6. 조건 도구가 매칭되면 `{condition.id}` 포트 (§7.2)
7. LLM 오류, 타임아웃, rate limit 발생 시 `error` 포트 (§7.3)

### 6.2 Multi Turn 모드 (mode = `multi_turn`)

워크플로우 실행을 일시 정지(blocking)하고 사용자와 대화형 인터랙션을 수행한다. 기존 Form 노드의 `waiting_for_input` 메커니즘을 확장하여 구현한다.

1. **첫 번째 턴 (노드 진입 직후):**
   a. systemPrompt 와 KB/MCP/조건 도구를 준비
   b. **즉시 `status: 'waiting_for_input'` 으로 진입** — 첫 턴 LLM 호출은 사용자 메시지 수신 후로 미룬다. `output` 에 빈 `messages` 배열 + `_resumeState` 를 운반 (§7.4)
   c. 클라이언트 채팅 UI 가 사용자 입력 박스를 활성화
2. **사용자 메시지 수신 시:**
   a. 클라이언트가 `execution.submit_message` 명령으로 사용자 메시지를 전송
   b. 엔진이 `status: 'resumed'` 스냅샷을 1회 emit (§7.5) — `output.interaction.{type:'message_received', data:{content, role:'user'}, receivedAt}` 운반
   c. 사용자 메시지를 대화 이력에 추가
   d. Knowledge Base 가 설정된 경우 LLM 능동 호출 시 RAG 재검색
   e. 갱신된 대화 이력으로 LLM 호출 + Tool/Condition 처리 (Single Turn 3단계와 동일한 분류 로직)
   f. 조건이 충족되면 해당 포트로 라우팅하고 종료 (§7.6)
   g. 조건 미충족 시 AI 응답을 WebSocket 으로 전달
   h. 종료 조건 미충족 시 다시 `waiting_for_input` 상태로 전환 (§7.4 — `output.messages` 가 누적 상태로 갱신)

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

> CONVENTIONS Principle 0~11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지 (`_resumeState` 는 multi-turn 의 internal 전달 필드로, top-level 에 위치하되 expression resolver 에서는 노출하지 않는다 — Principle 4.2).
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
>
> **Config echo 정책 (CONVENTIONS Principle 7)**: 모든 종결 시점 (`out` / `{condition.id}` / `user_ended` / `max_turns` / `error`) 과 multi-turn 의 waiting / resumed 시점에서 `output.config` 는 **유저가 입력한 raw 값** (template `{{ ... }}` 보존) 을 echo 한다 — 엔진이 dispatch 직전 평가한 값이 아니다. multi-turn 의 후속 turn 에서도 `state.rawConfig` (engine 이 frozen snapshot 으로 운반) 를 통해 동일하게 raw 가 echo 된다. 후속 노드의 `$node["X"].config.{mode, model, systemPrompt, userPrompt, maxTurns, maxToolCalls, knowledgeBases, conditions, responseFormat}` 는 수명 내내 raw 값을 본다. multi-turn ended / condition-trigger 출력의 `config.model` 도 `rawConfig.model` 이 template 이면 그대로 echo — 다운스트림이 LLM 식별·로깅용으로 evaluated 값을 원하면 `meta.model` 에서 읽는다. credential (`llmConfigId` 가 가리키는 provider secret 등) 은 `maskSensitiveFields` 에 의해 자동 마스킹 (`adaptHandlerReturn` boundary).

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
| `port` | `"out"` | handler return | 정상 종료 분기 |
| `status` | `"ended"` | handler return | 노드 실행 완료 |

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
      "details": { "provider": "openai", "statusCode": 503, "attempt": 3 }
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
| `output.error.details` | object? | 노드별 추가 컨텍스트 (provider/statusCode/attempt 등) |
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
    "messages": [
      { "role": "user", "content": "안녕하세요" },
      { "role": "assistant", "content": "안녕하세요, 무엇을 도와드릴까요?" }
    ]
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
| `output.messages` | ChatMessage[] | runtime accumulator | 첫 turn 은 빈 배열 (LLM 호출 전). 후속 turn 부터 system 제외한 user/assistant/tool 메시지 누적 |
| `meta.interactionType` | `"ai_conversation"` | handler return | run-results UI 의 conversation Preview 탭 식별자 (Principle 1.1.4 의 노드 판별자가 아니라 인터랙션 타입 라벨) |
| `meta.durationMs` / 토큰 / `turnDebug` | — | (§7.1 과 동일 위치) | 진행 중 누적치를 노출해 References / LLM Usage 탭이 동작 |
| `status` | `"waiting_for_input"` | handler return | 엔진이 실행을 일시 정지 |
| `_resumeState` | object (top-level) | handler return | 다음 턴 처리에 필요한 internal state. expression resolver 에서는 비노출 (Principle 4.2). credential / 내부 상태 보호 — DB 저장 시 strip |
| `_resumeState.ragSources` | Array | RagAccumulator (capped) | 직전 `MAX_RESUME_RAG_SOURCES = 200` 건만 유지 — 장기 대화에서 outputData JSONB 비대화 방지 (잘려 나간 chunk 는 향후 dedup 에서 제외 — 의도된 trade-off) |
| `_resumeState.turnDebugHistory` | Array | handler return | 직전 `MAX_TURN_DEBUG_HISTORY = 50` 턴만 유지 (DB 누적 비대 방지) |

> `_resumeState` 는 `output` 외부 top-level 필드다. credential 누락 / 누적 메모리 비대화 우려로 expression autocomplete 에서 노출하지 않는다.

### 7.5 Multi Turn 모드 — 사용자 메시지 수신 (`status: "resumed"`, transient)

사용자 메시지 수신 직후, 다음 턴 LLM 호출 전에 1회 emit. 이 스냅샷은 **transient** — 엔진은 곧바로 다음 턴 처리를 이어가 `waiting_for_input` 또는 `ended` 중 하나로 수렴한다. `resumed` 시점에는 후속 엣지 라우팅이 발생하지 않으며, run history / timeline observability 에만 기록된다.

```json
{
  "config": { "mode": "multi_turn", "model": "gpt-4o", "maxTurns": 20 },
  "output": {
    "messages": [
      { "role": "user", "content": "환불 문의입니다" }
    ],
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
| `output.messages` | ChatMessage[] | 사용자 메시지가 append 된 직후의 누적 대화 (모델 응답은 아직 없음) |
| `output.interaction.type` | `"message_received"` | interaction 종류 (Principle 4.5) |
| `output.interaction.data.content` | string | 사용자가 입력한 메시지 본문 |
| `output.interaction.data.role` | `"user"` | 고정값 |
| `output.interaction.receivedAt` | ISO8601 string | 수신 시각 |
| `status` | `"resumed"` | 1회성 transient 마커 |

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
  "config": { "mode": "multi_turn", "model": "gpt-4o", "maxTurns": 20 },
  "output": {
    "error": {
      "code": "LLM_RATE_LIMITED",
      "message": "Anthropic API returned 429 (Too Many Requests)",
      "details": { "provider": "anthropic", "statusCode": 429, "retryAfterSec": 30 }
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
  "status": "ended"
}
```

> Multi-turn 의 `error` 종결에서도 부분 수집 결과(`output.result.*` 의 `messages` / `turnCount` 등)와 `output.error` 가 **병존** 가능 — 부분 결과를 후속 노드가 활용할 수 있도록 둘 다 보존한다. `output.error` 존재 여부로 에러/정상을 판단한다 ([공통 §5](./0-common.md#5-응답-형식-규약-principle-11)).

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

| code | 발생 조건 | 시점 |
|------|-----------|------|
| `LLM_CALL_FAILED` | provider HTTP 5xx / 네트워크 오류 / 타임아웃 | runtime |
| `LLM_RATE_LIMITED` | provider HTTP 429 | runtime |
| `LLM_RESPONSE_INVALID` | `responseFormat=json` 인데 JSON 파싱 실패 | runtime |
| `TOOL_EXECUTION_FAILED` | 일반 도구 (`tool_*`) 실행 중 예외 — 재작성 후 복원 예정. KB·MCP provider 의 단일 호출 실패는 격리되어 `meta.*Diagnostics.errors` 에 기록되며 대화는 계속됨 (graceful degradation, `error` 포트로 라우팅 안함) | runtime |
| `MAX_TOOL_CALLS_EXCEEDED` | (예약) `maxToolCalls` 초과로 강제 종결을 결정한 경우. 현재 핸들러는 `tool_call_budget_exceeded` tool_result 로 회신만 하므로 발생하지 않음. spec §6.1.g 의 budget truncate 정책이 변경되면 이 코드를 사용. | runtime (예약) |

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

> 프론트엔드 `aiAgentSummary` 의 "Default provider not configured" 경고는 외부 `hasDefaultLlmConfig` context flag 에 의존 — 워크스페이스 default LLM 이 있으면 캔버스 배지를 suppress 한다. backend `warningRules` 는 이 context 를 모르므로 `model`/`llmConfigId` 둘 다 missing 시 무조건 fire — frontend 가 context-aware formatter 로 중복 표시를 막는다.

## 11. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `AI Agent` 행 인용. mode·model·도구 수·KB 수·MCP 수·조건 수를 동적으로 조합 (`multi_turn` 시 `Multi Turn` 접두어).

예: `gpt-4o · 2 tools · 1 KB · 1 MCP · 3 cond` (single) / `Multi Turn · gpt-4o · 1 KB · 2 MCP · 2 cond` (multi)
