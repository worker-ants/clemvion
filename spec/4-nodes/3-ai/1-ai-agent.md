# Spec: AI Agent

> 관련 문서: [AI 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec MCP Client](../../5-system/11-mcp-client.md) · [Spec RAG 검색](../../5-system/9-rag-search.md) · [Spec Graph RAG](../../5-system/10-graph-rag.md) · [Spec LLM Config](../../2-navigation/6-config.md)

LLM 기반 AI Agent를 실행. 프롬프트, RAG, Tool Use를 지원. **Single Turn**(단일 호출) 및 **Multi Turn**(대화형 블로킹) 모드를 제공.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| llmConfigId | UUID | 사용할 LLM 프로바이더 설정. [공통 §1](./0-common.md#1-llm-모델config-선택) |
| model | String | 모델 ID (프로바이더별) |
| mode | Enum | `single_turn` (기본) / `multi_turn` |
| systemPrompt | String | 시스템 프롬프트 (마크다운, 표현식 지원) |
| userPrompt | Expression | 사용자 프롬프트 (입력 데이터 참조) |
| temperature | Float? | 오버라이드 (없으면 LLMConfig 기본값) |
| maxTokens | Integer? | 오버라이드 |
| responseFormat | Enum | `text` / `json` |
| jsonSchema | JSONSchema? | responseFormat=json 시 출력 스키마 |
| knowledgeBases | UUID[] | 참조할 Knowledge Base ID 목록. [공통 §2](./0-common.md#2-knowledge-base-연동) |
| ragTopK | Integer | RAG 검색 결과 수 (기본: 5) |
| ragThreshold | Float | RAG 유사도 임계값 (기본: 0.7) |
| mcpServers | McpServerRef[] | MCP 서버 참조 목록. [공통 §3](./0-common.md#3-mcp-서버-연결-ai-agent-전용) |
| maxToolCalls | Integer | 최대 도구 호출 횟수 (기본: 10) |
| conversationHistory | Enum | `none` / `last_n` / `full` |
| historyCount | Integer? | last_n 시 보관 대화 수 |
| maxTurns | Integer? | Multi Turn 모드 시 최대 대화 턴 수 (기본: 20, 0=무제한) |
| conditions | ConditionDef[] | 조건 목록. 각 조건은 라벨과 프롬프트로 구성. 조건이 있으면 조건별 동적 출력 포트를 생성한다 |

> Multi Turn 모드에서 사용자 응답은 무제한 대기합니다. (외부 cancel 외에는 타임아웃이 발생하지 않습니다.)

> ⚠ **도구 연결 입력 경로 — 재작성 예정 (현재 제거됨)**
>
> `toolNodeIds`, `toolOverrides` 필드, §Tool Area 연동, 캔버스 Tool Area UX(`spec/3-workflow-editor/0-canvas.md` §12), 일반 도구 이름 규칙(`tool_*`) 은 모두 **config 스키마에서 제거**됐다. 새 도구 연결 입력 경로 디자인이 결정될 때까지 비활성. 스키마는 `.passthrough()` 이므로 DB 의 legacy 워크플로 데이터에 두 키가 남아 있어도 silently 통과하지만 핸들러는 읽지 않아 LLM 에 일반 도구가 등록되지 않는다.
>
> 영향 범위: ND-AG-06 / ND-AG-10 / ND-AG-21.
> 영향 없음: 조건 도구(`cond_*`, ND-AG-15~20·22), KB 도구(`kb_*`), MCP 도구(`mcp_*`).
> 자세한 사유·복원 절차: `plan/complete/ai-agent-tool-connection-rewrite.md`.

**ConditionDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 조건의 고유 식별자. 출력 포트 ID로 사용. LLM 도구 이름은 `cond_` 접두사 + 정제된 UUID로 자동 생성. 생성 시 UUID v4 할당, 이후 불변 |
| label | String | 조건 이름 (UI 표시 및 포트 라벨) |
| prompt | String | 조건 설명 (LLM 도구의 description으로 사용 — "언제 이 조건을 선택해야 하는지" 기술) |

## 2. 설정 UI

```
┌──────────────────────────────────────────┐
│  AI Agent                                │
│  ──────────────────────────────────────  │
│                                          │
│  LLM Provider: [OpenAI ▼]               │
│  Model:        [gpt-4o ▼]               │
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
│  ── User Prompt ──                       │
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
│  ── Tool Area ──                         │
│  ℹ️ 캔버스의 Tool Area에 노드를 드래그   │
│    하여 도구를 등록하세요.               │
│  ┌──────────────────────────────────────┐│
│  │ 🌐 HTTP Request "Ticket API"        ││
│  │    이름: [Create Ticket___]          ││
│  │    설명: [티켓 생성 API 호출___]     ││
│  ├──────────────────────────────────────┤│
│  │ 🗄️ DB Query "Search DB"             ││
│  │    이름: [Search DB_________]        ││
│  │    설명: [데이터베이스 검색__]       ││
│  └──────────────────────────────────────┘│
│                                          │
│  ── Conditions ──  (선택 사항)            │
│  ┌──────────────────────────────────────┐│
│  │ 1. 환불 요청 감지                 [×]││
│  │    Prompt: "고객이 환불을 요청하거나 ││
│  │    결제 취소를 원할 때"              ││
│  ├──────────────────────────────────────┤│
│  │ 2. 기술 지원 에스컬레이션         [×]││
│  │    Prompt: "문제가 복잡하여 전문가   ││
│  │    연결이 필요한 경우"              ││
│  └──────────────────────────────────────┘│
│  [+ Add Condition]                       │
│                                          │
│  ── Conversation History ──              │
│  Mode: [Last N ▼]  Count: [10]          │
│                                          │
│  ── Multi Turn Settings ──  (mode=multi_turn 시 표시) │
│  Max Turns:    [20__]                    │
└──────────────────────────────────────────┘
```

## 3. 포트

- 입력: `in` (1개)
- 출력 (모드별로 다름):

  **Single Turn 모드 (조건 ≥ 1):**
  - `{condition.id}` (동적, 조건별): 각 조건마다 UUID v4 기반 포트. 포트 라벨은 `condition.label`
  - `out` (정적, 기본 출력): 조건 없이 정상 완료되었을 때의 기본 경로
  - `error` (정적): LLM 오류, 타임아웃, rate limit 등 모든 오류 시 라우팅

  **Multi Turn 모드 (조건 ≥ 1):**
  - `{condition.id}` (동적, 조건별): 각 조건마다 UUID v4 기반 포트. 포트 라벨은 `condition.label`
  - `user_ended` (정적): 사용자가 명시적으로 대화를 종료한 경우
  - `max_turns` (정적): 대화 턴 수가 `maxTurns`에 도달한 경우
  - `error` (정적): LLM 오류, 타임아웃, rate limit 등 모든 오류 시 라우팅
  - ※ `out` 포트 없음 — Multi Turn 모드에서는 종료 사유가 항상 명확하므로 전용 포트로 분기

  **포트 시각적 구분:**
  - 사용자 조건 포트(`{condition.id}`)는 **초록색** 핸들로 표시하고, 상단에 배치
  - 시스템 포트(`out`, `user_ended`, `max_turns`)는 **파란색** 핸들로 표시
  - 에러 포트(`error`)는 **빨간색** 핸들로 표시
  - 조건이 1개 이상인 경우, 사용자 조건 포트와 시스템/에러 포트 사이에 **점선 구분자**를 렌더링하여 영역을 시각적으로 분리
  - 조건이 0개인 경우에도 시스템/에러 포트는 동일한 색상 규칙으로 표시

  **공통:**
  - 조건 추가/삭제/이름 변경/재정렬 시에도 기존 포트 ID(UUID)는 불변이므로 연결된 엣지가 유지됨
  - 조건이 0개인 경우에도 모드별 시스템 포트를 항상 표시:
    - Single Turn: `out` + `error`
    - Multi Turn: `user_ended` + `max_turns` + `error` (`out` 포트 없음 — 조건 유무와 관계없이 Multi Turn은 종료 사유별 전용 포트로 분기)
  - `timeout` 포트는 존재하지 않음 — 타임아웃, rate limit 등은 `error` 포트로 통합 라우팅
  - **마이그레이션**:
    - 기존 `timeout` 포트에 연결된 엣지는 프론트엔드에서 dangling 상태가 됨. 사용자가 수동으로 `error` 포트로 재연결 필요 (신규 기능이므로 기존 워크플로우에 `timeout` 엣지 존재하지 않음)
    - 기존 `multi_turn` + 조건 없음 노드의 `out` 포트에 연결된 엣지는 dangling 상태가 됨. `user_ended` 또는 `max_turns` 포트로 수동 재연결 필요

## 4. Tool Area 연동

> ⚠ **재작성 예정 (현재 제거됨)** — 본 절(§Tool Area 연동·도구 이름 규칙 중 `tool_*` 항목·도구 설명 파생 규칙·ToolOverride 구조)에 기술된 내용은 현재 비활성. 관련 config 필드 (`toolNodeIds` / `toolOverrides`) 와 캔버스 UX 가 제거된 상태이며, 새 도구 연결 디자인이 결정될 때 갱신한다. 조건(`cond_*`) / KB(`kb_*`) / MCP(`mcp_*`) 도구는 영향 없음.

도구 관리는 캔버스의 [Tool Area](../../3-workflow-editor/0-canvas.md#11-ai-agent-tool-area)에서 수행한다. 노드를 Tool Area에 드래그하여 등록하면 `toolNodeIds`에 자동 추가된다.

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
- 최대 20개 조건 허용
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
4. 최종 응답을 출력 형식에 맞게 변환
5. `out` 포트로 출력
6. LLM 오류, 타임아웃, rate limit 발생 시 `error` 포트로 출력

### 6.2 Multi Turn 모드 (mode = `multi_turn`)

워크플로우 실행을 일시 정지(blocking)하고 사용자와 대화형 인터랙션을 수행한다. 기존 Form 노드의 `waiting_for_input` 메커니즘을 확장하여 구현한다.

1. **첫 번째 턴:**
   a. Single Turn과 동일하게 RAG 검색 + LLM 호출 + Tool/Condition 처리 수행
   b. 조건이 충족되면 해당 포트로 라우팅하고 종료
   c. 조건 미충족 시 AI 응답을 WebSocket으로 클라이언트에 전달
   d. `status: 'waiting_for_input'`, `interactionType: 'ai_conversation'`을 반환하여 실행 일시 정지
   e. 대화 이력(messages)을 노드 내부 상태로 유지

2. **후속 턴 (사용자 메시지 수신 시):**
   a. 클라이언트가 `execution.submit_message` 명령으로 사용자 메시지를 전송
   b. 사용자 메시지를 대화 이력에 추가
   c. Knowledge Base가 설정된 경우 사용자 메시지로 RAG 재검색
   d. 갱신된 대화 이력으로 LLM 호출 + Tool/Condition 처리 (Single Turn 3단계와 동일한 분류 로직)
   e. 조건이 충족되면 해당 포트로 라우팅하고 종료
   f. 조건 미충족 시 AI 응답을 WebSocket으로 전달
   g. 종료 조건 미충족 시 다시 `waiting_for_input` 상태로 전환

3. **종료 조건** (하나라도 충족 시 대화 종료, 각 사유별 전용 포트로 라우팅):
   a. LLM이 조건 도구를 호출 → 해당 조건의 출력 포트(`{condition.id}`)로 분기
   b. 사용자가 `execution.end_conversation` 명령 전송 → `user_ended` 포트로 출력
   c. 대화 턴 수가 `maxTurns`에 도달 (0=무제한) → `max_turns` 포트로 출력
   d. LLM 오류, rate limit 등 → `error` 포트로 출력

   > 사용자 응답은 무제한 대기합니다. (외부 cancel 외에는 타임아웃이 발생하지 않습니다.)

4. **종료 시:**
   a. 종료 사유에 해당하는 포트로 출력
   b. 워크플로우 실행 재개

## 7. 출력 구조

> **Config echo 정책 (CONVENTIONS Principle 7)**: 모든 종결 시점 (`out` / `{condition.id}` / `user_ended` / `max_turns` / `error`) 과 multi-turn 의 waiting / resumed waiting 시점에서 `output.config` 는 **유저가 입력한 raw 값** (template `{{ ... }}` 보존) 을 echo 한다 — 엔진이 dispatch 직전 평가한 값이 아니다. multi-turn resumed 턴에서도 `state.rawConfig` (engine 이 frozen snapshot 으로 운반) 를 통해 동일하게 raw 가 echo 된다. 후속 노드의 `$node["X"].config.{model, systemPrompt, userPrompt, maxTurns, maxToolCalls, knowledgeBases, conditions, responseFormat}` 는 수명 내내 raw 값을 본다.

### 7.1 Single Turn 모드 — 정상 완료 (`out` 포트)

```json
{
  "response": "AI의 텍스트 응답 또는 JSON 객체",
  "metadata": {
    "model": "gpt-4o",
    "inputTokens": 1250,
    "outputTokens": 350,
    "totalTokens": 1600,
    "toolCalls": 2,
    "ragSources": [
      { "documentId": "uuid", "chunk": "관련 텍스트...", "score": 0.92, "origin": "seed" }
    ],
    "graphTraversal": {
      "mode": "graph",
      "seedChunkCount": 5,
      "traversedEntityCount": 12,
      "maxDepth": 1,
      "expandedChunkCount": 8
    },
    "mcpDiagnostics": {
      "attempted": true,
      "serverCount": 1,
      "toolCalls": 1,
      "resourceReads": 0,
      "promptGets": 0,
      "errors": []
    }
  }
}
```

> `graphTraversal` 객체는 검색에 참여한 KB 중 하나라도 `rag_mode = 'graph'` 일 때만 포함된다. 모두 `vector` 면 생략. `ragSources[].origin` 도 graph 모드일 때만 채워지며, `seed` (vector 결과) / `expanded` (그래프 확장 결과) 두 값을 가진다. 상세: [Spec Graph RAG §4.3](../../5-system/10-graph-rag.md#43-출력-메타데이터)
>
> `mcpDiagnostics` 는 노드 config 의 `mcpServers` 가 1개 이상이거나 LLM 이 MCP 도구를 1번 이상 호출한 경우에만 포함된다. 필드 의미는 [Spec MCP Client §6.2](../../5-system/11-mcp-client.md#62-진단-누적-mcpdiagnostics) 참조.

### 7.2 Single Turn 모드 — 조건 충족 시 (`{condition.id}` 포트)

```json
{
  "response": "AI의 마지막 응답",
  "condition": {
    "id": "uuid-of-condition",
    "label": "환불 요청 감지",
    "reason": "LLM이 전달한 선택 이유 (있을 경우)"
  },
  "metadata": {
    "model": "gpt-4o",
    "inputTokens": 1250,
    "outputTokens": 350,
    "totalTokens": 1600,
    "toolCalls": 2,
    "ragSources": [...]
  }
}
```

### 7.3 Single Turn 모드 — 오류 (`error` 포트)

타임아웃, rate limit, LLM API 오류 등 모든 오류 상황에서 사용.

```json
{
  "error": {
    "code": "LLM_TIMEOUT | LLM_API_ERROR | LLM_RATE_LIMIT",
    "message": "오류 상세 메시지"
  },
  "metadata": { "model": "gpt-4o" }
}
```

### 7.4 Multi Turn 모드 — 조건 충족 시 (`{condition.id}` 포트)

```json
{
  "response": "마지막 AI 응답",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "첫 번째 사용자 메시지" },
    { "role": "assistant", "content": "첫 번째 AI 응답" },
    { "role": "user", "content": "두 번째 사용자 메시지" },
    { "role": "assistant", "content": "마지막 AI 응답" }
  ],
  "turnCount": 5,
  "endReason": "condition",
  "condition": {
    "id": "uuid-of-condition",
    "label": "환불 요청 감지",
    "reason": "LLM이 전달한 선택 이유"
  },
  "metadata": {
    "model": "gpt-4o",
    "totalInputTokens": 3800,
    "totalOutputTokens": 1200,
    "totalTokens": 5000,
    "toolCalls": 5,
    "ragSources": [...]
  }
}
```

### 7.5 Multi Turn 모드 — 사용자 종료 (`user_ended` 포트)

```json
{
  "response": "마지막 AI 응답",
  "messages": [...],
  "turnCount": 3,
  "endReason": "user_ended",
  "metadata": { "..." }
}
```

### 7.6 Multi Turn 모드 — 최대 턴 도달 (`max_turns` 포트)

```json
{
  "response": "마지막 AI 응답",
  "messages": [...],
  "turnCount": 20,
  "endReason": "max_turns",
  "metadata": { "..." }
}
```

### 7.7 Multi Turn 모드 — 오류/타임아웃 (`error` 포트)

타임아웃, rate limit, LLM API 오류 등 모든 오류 상황에서 사용.

```json
{
  "messages": [...],
  "turnCount": 3,
  "endReason": "error",
  "error": {
    "code": "LLM_TIMEOUT | LLM_API_ERROR | LLM_RATE_LIMIT",
    "message": "오류 상세 메시지"
  },
  "metadata": { "..." }
}
```

`endReason` enum: `condition | user_ended | max_turns | error`

## 8. 디버그 데이터 (`_turnDebugHistory`)

실행 결과에 포함되는 턴별 디버그 데이터. 프론트엔드 Conversation Inspector에서 각 LLM 호출의 요청/응답/토큰 사용량을 표시하는 데 사용.

```json
{
  "_turnDebugHistory": [
    {
      "turnIndex": 1,
      "llmCalls": [
        {
          "requestPayload": { "model": "gpt-4o", "messages": [...], "tools": [...] },
          "responsePayload": { "model": "gpt-4o", "usage": { "inputTokens": 500, "outputTokens": 120 }, "toolCalls": [...] },
          "durationMs": 1250
        },
        {
          "requestPayload": { "...tool result 포함..." },
          "responsePayload": { "...최종 응답..." },
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

- 한 턴에서 function calling이 발생하면 `llmCalls` 배열에 여러 항목이 추가됨
- 각 `llmCalls` 항목은 하나의 LLM API 호출에 대응
- 프론트엔드에서 각 assistant 메시지를 해당 턴의 N번째 LLM 호출과 매칭하여 디버그 정보를 표시
- 실행 결과에 항상 포함됨 (워크플로우 소유자만 실행 결과 조회 가능하므로 별도 접근 제어 불필요)
- `requestPayload`에 시스템 프롬프트 및 전체 대화 이력이 포함될 수 있음에 유의
- 각 turn 항목에 `ragSources` (해당 턴에서 호출된 KB tool 의 chunk delta) 와 `ragDiagnostics` (해당 턴 한정 진단) 가 함께 채워진다. 노드 전체 누적은 `meta.ragSources` / `meta.ragDiagnostics` 를 사용한다 — 두 위치의 값은 turn delta 의 합 = 전체 누적 관계를 만족한다.
- MCP 도구가 호출된 턴에는 동일한 delta-누적 관계로 `mcpDiagnostics` 도 turn 단위로 분리되어 노출된다. 노드 전체 누적은 `meta.mcpDiagnostics`.
- `toolCalls` (선택) — 해당 턴에서 실행된 provider tool(KB·MCP) 별 결과 메타. 각 항목은 `{ toolCallId, name, providerKey, status, durationMs, error? }`. `status` 는 `'success' \| 'error'` 이며, provider 가 throw 한 경우에도 핸들러가 캐치해 `'error'` 로 마킹하고 LLM 에는 에러 content 를 그대로 전달한다 (turn 자체는 계속 진행). 이 필드는 Conversation Inspector 의 tool 항목 success / error 배지의 권위 출처. WS `execution.tool_call_started` / `execution.tool_call_completed` 가 손실되어도 동일 데이터로 클라이언트가 복구 가능. condition tool / 일반 tool stub 은 즉시 결과를 만들므로 포함하지 않는다.
