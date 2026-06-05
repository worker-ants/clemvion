---
id: common
status: partial
code:
  - codebase/backend/src/nodes/ai/shared/system-context-prefix.ts
  - codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts
  - codebase/backend/src/nodes/ai/text-classifier/text-classifier.handler.ts
  - codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts
pending_plans:
  - plan/in-progress/ai-context-memory-followup-v2.md
---

# Spec: AI 노드 공통 규약

> 관련 문서: [PRD 노드 시스템](../_product-overview.md#6-ai-노드-3종) · [PRD Graph RAG](../../5-system/10-graph-rag.md) · [Spec 노드 개요](../0-overview.md) · [Spec Knowledge Base](../../2-navigation/5-knowledge-base.md) · [Spec RAG 검색](../../5-system/9-rag-search.md) · [Spec Graph RAG](../../5-system/10-graph-rag.md) · [Spec LLM Config](../../2-navigation/6-config.md) · [Spec MCP Client](../../5-system/11-mcp-client.md)

본 문서는 AI 카테고리 노드 전체에 공통되는 규약을 정의한다. 노드별 동작·설정은 각 노드 문서를 참조한다.

- [AI Agent](./1-ai-agent.md)
- [Text Classifier](./2-text-classifier.md)
- [Information Extractor](./3-information-extractor.md)

---

## 1. LLM 모델/Config 선택

세 노드 모두 다음 두 필드를 통해 LLM 호출 설정을 선택한다:

| 필드 | 타입 | 설명 |
|------|------|------|
| llmConfigId | UUID | 사용할 LLM 프로바이더 설정 ([Spec LLM Config](../../2-navigation/6-config.md)) |
| model | String | 모델 ID (프로바이더별) |

설정 UI 는 LLM Provider 드롭다운 → Model 드롭다운 (provider 선택에 따라 동적 갱신) 패턴을 공유한다.

## 2. Knowledge Base 연동 (AI Agent 전용)

AI Agent 노드는 다음 필드로 Knowledge Base 검색을 활성화한다 (Text Classifier / Information Extractor 노드에는 KB·RAG 설정 필드가 없다 — KB 연동은 AI Agent 한정):

| 필드 | 타입 | 설명 |
|------|------|------|
| knowledgeBases | UUID[] | 참조할 Knowledge Base ID 목록. 모드(`vector` / `graph`)는 KB 마다 다를 수 있으며 RagSearchService 가 KB 별로 흐름을 분기한다 |
| ragTopK | Integer | RAG 검색 결과 수 (기본: 5). graph 모드 KB 에서도 동일 (rerank 후 상위 K 만 컨텍스트에 주입) |
| ragThreshold | Float | RAG 유사도 임계값 (기본: 0.7). graph 모드 KB 의 vector seed 단계에 적용 |

KB 검색은 LLM 의 능동 호출 시에만 실행되며 prefill 하지 않는다. 도구 인터페이스/이름 규칙은 [Spec RAG 검색 §2.1](../../5-system/9-rag-search.md#21-kb-tool-정의) 참조.

## 3. MCP 서버 연결 (AI Agent 전용)

AI Agent 노드는 워크스페이스에 등록된 MCP-capable Integration 을 다중 선택해 도구로 사용한다. MCP-capable 의 범주에는 외부 MCP 서버 (`service_type='mcp'`) 와 backend in-process Internal Bridge 가 노출하는 Integration (`service_type='cafe24'` / `'makeshop'`, 향후 확장 가능)이 모두 포함된다 — [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge-in-process) 참조.

| 필드 | 타입 | 설명 |
|------|------|------|
| mcpServers | McpServerRef[] | 활용할 MCP-capable Integration 목록. `service_type ∈ ('mcp', 'cafe24', 'makeshop')` 모두 수용. 서버별로 도구 allowlist·resource/prompt 노출 여부 설정 |
| maxToolCalls | Integer | 최대 도구 호출 횟수 (기본: 10). KB tool · MCP tool · 일반 tool 호출이 모두 합산됨 |

**McpServerRef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| integrationId | UUID | FK → Integration (`service_type ∈ ('mcp', 'cafe24', 'makeshop')`). 워크스페이스에 등록된 MCP 서버 (외부 HTTP) 또는 Internal Bridge 적용 first-party Integration |
| enabledTools | String[]? | 일반 도구 allowlist (bare operation id 배열). `['*']` 또는 미설정 = 전체 노출. 메타도구(resources/prompts)에는 영향 없음. Cafe24 의 경우 도구 수가 많아(~180) UI 는 Resource 단위 grouping 으로 노출 |
| includeResources | Boolean? | 서버가 `resources` capability 를 보고할 때 메타도구 노출 여부. 기본 `true`. Cafe24 Internal Bridge 는 `resources` 미보고이므로 무영향 |
| includePrompts | Boolean? | 서버가 `prompts` capability 를 보고할 때 메타도구 노출 여부. 기본 `true`. Cafe24 동일 |
| toolOverrides | { toolName: string; description?: string }[]? | 도구별 description 오버라이드 (이름 변경 불가) |

> 도구 이름·메타도구·실행 모델·에러 격리 정책의 단일 진실 공급원은 [Spec MCP Client](../../5-system/11-mcp-client.md). 본 표는 노드 설정 측면의 요약이다.

## 4. Multi-turn 차단 모드

AI Agent / Information Extractor 노드의 `multi_turn` 모드는 워크플로우 실행을 일시 정지(blocking)하고 사용자와 대화형 인터랙션을 수행한다. Form 노드의 `waiting_for_input` 메커니즘을 확장한다.

- 첫 턴 또는 후속 턴에서 종료 조건 미충족 시 `status: 'waiting_for_input'`, `interactionType: 'ai_conversation'` 으로 중단
- 클라이언트가 `execution.submit_message` 명령으로 사용자 메시지를 전송하면 재개
- 사용자 응답은 무제한 대기 (외부 cancel 외에는 타임아웃이 발생하지 않음)
- Stage 2 의 공통 resume 컨트랙트에서 `status: 'resumed'` + `output.interaction.{type, data, receivedAt}` 스냅샷이 한 차례 emit 된다 (CONVENTIONS §4.5)

종료 사유별 출력 포트 매핑은 각 노드 문서의 "포트" 섹션 참조.

## 5. 응답 형식 규약 (Principle 11)

LLM 3 노드는 `output.result.*` / `output.error.*` / `output.interaction.*` wrapper 를 공유한다 (CONVENTIONS Principle 11). 도메인 결과는 `output.result.*` 하위에 두고, 에러는 `output.error.{code, message, details?}`, 사용자 인터랙션은 `output.interaction` 에 둔다.

| Wrapper | 용도 |
|---------|------|
| `output.result.*` | 성공 시 도메인 결과 (extracted, response, category, …) |
| `output.error.{code, message, details?}` | LLM 호출 실패, JSON 파싱 실패, 재시도 소진 등. **LLM 계열 노드는 `details.retryable: boolean` 필수, `details.retryAfterSec?: number` 선택** — `retryable === true` 일 때만 set ([CONVENTIONS Principle 3.2.1](../../conventions/node-output.md#321-details-의-공통-표준-필드-llm-계열-노드-한정-필수)) |
| `output.interaction.{type, data, receivedAt}` | 멀티턴 resume 직후 1회 emit (Principle 4.5) |

> Multi-turn 에서 `max_retries` 등으로 종료 시 `output.error` 와 `output.result` 가 **병존** 가능 — 부분 수집 결과를 후속 노드가 활용할 수 있도록 둘 다 보존한다. `output.error` 존재 여부로 에러/정상을 판단한다.

## 6. 토큰 회계 (meta)

모든 AI 노드의 LLM 호출 결과 메타에는 다음 필드가 포함된다:

| 필드 | 위치 | 설명 |
|------|------|------|
| `meta.model` | 필수 | 실제 호출된 모델 ID |
| `meta.inputTokens` | 필수 | 입력 토큰 수 |
| `meta.outputTokens` | 필수 | 출력 토큰 수 |
| `meta.totalTokens` | 필수 | input + output |
| `meta.thinkingTokens` | 선택 | 모델이 thinking 토큰을 보고하는 경우 |
| `meta.durationMs` | 필수 | 실행 소요 시간 |
| `meta.turnDebug` | 선택 | 턴별 LLM 호출 트레이스 (multi-turn) — `[{ turnIndex, llmCalls, totalDurationMs, toolCalls?, ragSources?, ragDiagnostics? }, ...]` |

상세는 각 노드 문서 참조.

## 7. 진단 누적 (provider tool)

KB / MCP / 일반 provider 도구 호출이 발생한 노드는 `meta.ragSources` / `meta.ragDiagnostics` / `meta.mcpDiagnostics` 누적치를 메타에 노출한다. multi-turn 에서는 turn 단위 delta 가 `meta.turnDebug[i].{ragSources, ragDiagnostics, mcpDiagnostics}` 에도 분리되어 노출되며, "delta 의 합 = 전체 누적" 관계를 만족한다. `mcpDiagnostics.serverSummaries[]` 는 buildTools 결과의 정적 스냅샷으로 노드 실행 단위로 1회 결정되며 turn 단위 delta 와 무관하다. 자세한 필드 의미:

- RAG: [Spec Graph RAG §4.3](../../5-system/10-graph-rag.md#43-출력-메타데이터)
- MCP: [Spec MCP Client §6.2](../../5-system/11-mcp-client.md#62-진단-누적-mcpdiagnostics) (`serverSummaries[].skipReason` vocabulary 포함)

---

## 8. 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| AI Agent | `{mode} · {model}`. Tool Area에 등록된 도구 수가 있으면 `· {N} tools`, Knowledge Base 연결 시 `· {N} KB`, MCP-capable Integration 이 있으면 `· {N} MCP` (외부 MCP server + Internal Bridge integration 합산 — 사용자 입장에서는 모두 "AI 가 호출하는 외부 도구 소스"이므로 카운트 일원화), 조건이 있으면 `· {N} cond` 추가. mode가 `multi_turn`이면 `Multi Turn` 표기, `single_turn`이면 생략 | `gpt-4o · 2 tools · 1 KB · 1 MCP · 3 cond` (single) / `Multi Turn · gpt-4o · 1 KB · 2 MCP · 2 cond` (multi) |
| Text Classifier | `{model} · {N} categories` (카테고리 수) | `gpt-4o-mini · 3 categories` |
| Info Extractor | `{model} · {N} fields` (outputSchema 필드 수). mode가 `multi_turn`이면 `Multi Turn` 접두어 추가 | `claude-sonnet · 4 fields` (single) / `Multi Turn · claude-sonnet · 4 fields` (multi) |

---

## 9. 출력 구조 색인

각 AI 노드의 출력 구조 케이스 색인. 각 노드 문서의 §X (출력 구조 섹션) 로 링크. AI 노드는 정상/조건/에러/waiting/resumed/ended 등 가장 다양한 케이스를 갖는다.

| 노드 | 정상 | 분기 (조건/클래스) | 에러 | Waiting / Resumed | 종결 (ended) |
|------|------|---------------------|------|---------------------|----------------|
| [ai_agent (single)](./1-ai-agent.md#7-출력-구조) | §7.1 (`out`) | §7.2 (`<cond_id>`) | §7.3 (`error`) | — | — |
| [ai_agent (multi)](./1-ai-agent.md#7-출력-구조) | — | §7.6 (`<cond_id>`) | §7.9 (`error`) | §7.4 (`waiting_for_input`) / §7.5 (`resumed` transient) | §7.7 (`user_ended`) / §7.8 (`max_turns`) |
| [text_classifier](./2-text-classifier.md#5-출력-구조) | §5.1 (`out`) | §5.2 (`class_<i>`) | §5.3 (`error`) | — | — |
| [info_extractor (single)](./3-information-extractor.md#5-출력-구조) | §5.1 (`out`) | — | §5.3 (`error`) | — | — |
| [info_extractor (multi)](./3-information-extractor.md#5-출력-구조) | — | — | §5.3 (`error`) | (Waiting/Resumed) | §5.6 (`completed` / `user_ended` / `max_turns` / `max_retries`) |

> AI 노드의 출력 구조는 [공통 §5 응답 형식 규약 (Principle 11)](#5-응답-형식-규약-principle-11) 의 `output.result.*` / `output.error.*` / `output.interaction.*` wrapper 컨트랙트를 따른다.

## 10. Conversation Context (자동 컨텍스트 주입)

AI 카테고리 3 노드 공통 규약. **세 노드 (`ai_agent` / `text_classifier` / `information_extractor`) 모두 push (final assistant 누적) 와 `contextScope` 기반 자동 주입을 구현**한다 (handler 의 `pushClassifierTurn` / `pushExtractorTurn` + 공유 inject 유틸 `shared/conversation-context-injection.ts`). 단 **`memoryStrategy` (summary_buffer / persistent) 자동메모리 주입만 `ai_agent` 한정** — 상태누적 메모리는 ai_agent 의 multi-turn 라이프사이클과 결합돼 있어 v2 로드맵으로 유지한다. `contextScope` (stateless thread 주입) 와 `memoryStrategy` (상태누적 메모리) 의 적용 범위 차이를 구분한다 ([Spec Conversation Thread §2.3](../../conventions/conversation-thread.md#23-적용-범위-push-vs-inject-구분)). 두 노드의 final assistant text 변환 규칙은 §1.4 의 해당 행 참조.

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| contextScope | `none` / `thread` / `lastN` | ✓ | `none` | 자동 주입할 thread 범위 |
| contextScopeN | Integer | (lastN 시) | `20` | `lastN` 일 때 최근 N개 turn |
| contextInjectionMode | `messages` / `system_text` | (scope ≠ none 시) | `messages` | 주입 형식 — LLM messages 배열 prepend / system prompt 텍스트 첨부 |
| includeToolTurns | Boolean | | `false` | `ai_tool` turn (KB/MCP/condition 결과) 도 thread 에 push 할지. `memoryStrategy ≠ manual` 시 자동 주입 측면에서는 무효 — push (thread 누적) 는 전략과 독립 유지 |
| excludeFromConversationThread | Boolean | | `false` | 본 노드의 user/assistant turn 을 thread 에서 제외 (opt-out) |
| memoryStrategy | `manual` / `summary_buffer` / `persistent` | | `manual` | 메모리 **관리 전략** 축. `manual`(기본) = 위 4 범위 필드 동작 그대로. `summary_buffer`/`persistent` = 자동 전략 (위 4필드 무효 — 자동 전략이 대체). **`ai_agent` 한정** — `text_classifier` / `information_extractor` 는 본 필드를 갖지 않으며 항상 `manual`(=`contextScope` 동작) 로 해석한다 (memoryStrategy 자동메모리는 v2). 별도 필드 채택 근거 [AI Agent §12.9](./1-ai-agent.md#129-memorystrategy-를-contextscope-enum-확장이-아닌-별도-필드로-둔-근거). 상세: [Spec AI Agent §1·§6](./1-ai-agent.md#1-설정-config) + [Spec Agent Memory](../../5-system/17-agent-memory.md) |

> **Default `contextScope: 'none'`** — 기존 워크플로우 영향 없음. 명시 opt-in 시에만 자동 주입 활성화.

> **노드별 적용** — `contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread` 5필드는 **세 노드 공통**이다 (공유 fragment `shared/conversation-context-schema.ts` 의 `buildConversationContextSchemaFields()`). 자동 주입 로직도 공유 유틸 `shared/conversation-context-injection.ts` (`injectConversationContext()`) 로 세 노드가 동일하게 사용한다. `memoryStrategy` 필드는 `ai_agent` 만 갖는다 — `text_classifier` / `information_extractor` 는 본 필드가 없으므로 `contextScope` 가 (manual 분기 없이) 항상 적용된다.

> **`memoryStrategy` 와의 관계** — 위 표의 `contextScope`/`contextScopeN`/`contextInjectionMode`/`includeToolTurns` 4필드 (범위 축) 는 `memoryStrategy: 'manual'` (기본) 일 때만 유효하다. `memoryStrategy ∈ {summary_buffer, persistent}` (관리 축) 이면 자동 전략이 컨텍스트 구성을 대체해 이 4필드는 무효가 된다 (`excludeFromConversationThread` 는 thread 누적 opt-out 이라 strategy 와 독립). 두 축의 분리 근거는 [AI Agent §12.9](./1-ai-agent.md#129-memorystrategy-를-contextscope-enum-확장이-아닌-별도-필드로-둔-근거), 자동 전략의 압축·회수·추출 동작은 [AI Agent §1·§6.1](./1-ai-agent.md#1-설정-config) 및 [Spec Agent Memory](../../5-system/17-agent-memory.md) 단일 진실.

상세 규약 (자료구조·스코프·영속화·v2 로드맵) 은 [Spec Conversation Thread](../../conventions/conversation-thread.md) 단일 진실 공급원 참조.

---

## 11. AI 노드 시스템 프롬프트 자동 prefix (System Context Prefix)

AI 카테고리 3 노드 (AI Agent / Information Extractor / Text Classifier) 의 systemPrompt 앞에 **현재 시각·timezone 등 실행 환경 메타정보를 자동 prefix** 한다. LLM 이 시각 추론 (예: "최근 7일", "오늘 자정", "어제 미발송") 을 할 때 timezone 모호성에 의한 9시간 오차 같은 회귀를 사전 차단한다.

> **§10 Conversation Context (대화 thread 자동 주입)** 과 의미가 다르다 — §10 은 *과거 turn 의 user/assistant 메시지* 를 LLM messages 배열·systemPrompt 끝에 붙이는 것이고, §11 은 *실행 환경 메타정보* (지금 몇 시인지·어느 timezone 인지) 를 systemPrompt **앞** 에 한 묶음 prefix 로 prepend 한다. 빌드 순서는 §11.4 참고.

### 11.1 설정 필드 (3 노드 공통)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| includeSystemContext | Boolean | | `true` | 시스템 컨텍스트 prefix 활성화. `false` 시 사용자 systemPrompt 만 LLM 에 전달 |
| systemContextSections | String[] | | `['time', 'timezone']` | prefix 에 포함할 섹션. 허용 값: `time` / `timezone` / `workspace` / `node`. 빈 배열 (`[]`) 은 `includeSystemContext: false` 와 동일 |

> **Default `includeSystemContext: true`** — 기존 워크플로우의 LLM 호출에 시각·timezone 한 줄이 자동 prepend 된다. 토큰 비용은 ~30 토큰 (§11.5). 응답 동작 변화 우려가 있는 워크플로우는 명시적으로 `false` 로 끄거나 `systemContextSections` 를 좁힌다.
>
> **기존 row 해석 정책**: 본 필드 신설 시점 이전에 저장된 워크플로우 row 는 config 에 두 필드가 부재하다. backend 는 두 필드 부재 시 default (`includeSystemContext: true`, `systemContextSections: ['time', 'timezone']`) 로 해석한다 — DB 마이그레이션으로 명시 `false` 를 박지 않는다. 회귀 우려가 있는 워크플로우만 사용자가 인지 후 명시적 opt-out.

### 11.2 섹션별 내용

| 섹션 | 출력 한 줄 | 데이터 출처 |
|---|---|---|
| `time` | `Current time: <ISO8601 with TZ>` | `$now` (execution 단위 frozen, UTC). prefix 본문에는 §11.3 의 timezone 으로 변환된 ISO 출력 |
| `timezone` | `Timezone: <IANA name> (UTC<offset>)` | §11.3 SoT |
| `workspace` | `Workspace: <name> (id: <uuid>)` | `context.workspace.{id, name}` |
| `node` | `Node: <nodeLabel> (type: <nodeType>, id: <nodeId>)` | `context.currentNode.{id, label, type}` |

기본 (`['time', 'timezone']`) 출력 예시 (KST 워크스페이스):

```
## System Context
- Current time: 2026-05-18T12:45:12+09:00
- Timezone: Asia/Seoul (UTC+9)
```

UTC 워크스페이스의 출력:

```
## System Context
- Current time: 2026-05-18T03:45:12Z
- Timezone: UTC
```

### 11.3 Timezone SoT 정책

다음 precedence 로 prefix 의 timezone 을 결정한다:

1. **워크스페이스 설정**: `Workspace.settings.timezone` (IANA, NAV-SC-06 필수 항목 — [spec/2-navigation/_product-overview.md](../../2-navigation/_product-overview.md))
2. **서버 default**: `process.env.TZ` (배포 환경 변수)
3. **fallback**: `UTC`

각 단계의 결과 IANA name 으로 `Intl.DateTimeFormat(...).resolvedOptions().timeZone` 을 검증하고, 검증 실패 시 다음 단계로 fall through 한다. UTC offset 은 `$now` 시점 기준 (DST 가 있는 timezone 의 경우 실행 시점의 offset 적용).

> Schedule 의 timezone ([spec/1-data-model.md §2.9](../../1-data-model.md#29-schedule)) 은 cron trigger 의 firing 기준 — 본 §11 의 AI 시스템 컨텍스트와 별개 SoT. AI Agent 가 Schedule trigger 로 실행되더라도 prefix 의 timezone 은 워크스페이스 설정을 따른다.

### 11.4 주입 위치 및 ordering

systemPrompt 의 최종 본문은 다음 순서로 build 된다 ([Spec AI Agent §6.1/6.2](./1-ai-agent.md#6-실행-로직), [Spec Information Extractor §5/§6](./3-information-extractor.md#5-출력-구조)):

```
[1] System Context Prefix (본 §11)
[2] 사용자 systemPrompt
[3] KB_TOOL_GUIDANCE (knowledge base 가 있을 때)
[4] Condition suffix (conditions 가 있을 때)
[5] Memory / Thread injection (안정 프리픽스):
      [5a] persistent 회수 블록 (memoryStrategy='persistent' 일 때 — agent_memory top-k 회수)
      [5b] 롤링 요약 블록 (memoryStrategy ∈ {summary_buffer, persistent} 일 때 — runningSummary)
      [5c] manual thread injection (memoryStrategy='manual' + contextScope ≠ 'none' + contextInjectionMode='system_text' 때만)
[6] (휘발성 꼬리) 압축되지 않은 최근 원문 turn — system_text 안정 프리픽스 [1]~[5] 보다 뒤
```

- **[5a]/[5b] 는 안정 프리픽스** — 휘발성 최근 turn ([6]) 보다 앞에 둔다. 요약/회수 블록은 임계치 도달 시에만 갱신해 prompt cache 접두사 안정성을 보호한다 (근거: [AI Agent §12.11](./1-ai-agent.md#1211-요약회수-블록을-system_text-안정-프리픽스에-배치하는-ordering-근거)). messages 모드에서는 최근 원문 turn ([6]) 만 messages 배열 prepend 이고 [5a]/[5b] 는 여전히 system_text 안정 프리픽스에 둔다.
- `messages` 모드의 manual thread injection ([5c]) 은 systemPrompt 본문이 아닌 messages 배열 prepend 이므로 [5c] 가 적용되지 않는다.
- `includeSystemContext: false` 면 [1] 단계만 skip — 나머지 ordering 유지.
- [1] 은 항상 가장 앞 — 사용자 systemPrompt 가 시각 정보를 override 할 수 없도록 (사용자가 시각을 의도적으로 다르게 주입하려면 prefix 후 본문에서 명시).
- multi-turn 의 후속 turn 에서도 prefix 는 systemPrompt 의 앞에 유지된다. `$now` 가 execution 단위 frozen 이므로 turn 마다 재계산해도 동일 값 — multi-turn 경로의 LLM 은 일관된 시각 정보를 본다.

본 ordering 의 단일 SoT 는 본 §11.4. [`spec/conventions/conversation-thread.md §5`](../../conventions/conversation-thread.md#5-contextscope-자동-주입-세-ai-노드-공통) 는 thread injection 의 책임을, [Spec AI Agent §6](./1-ai-agent.md#6-실행-로직) 등은 노드별 실행 단계를 다룬다 — ordering 자체는 본 §11.4 만 참조.

### 11.5 토큰 회계

- 기본 (`['time', 'timezone']`): ~30 토큰
- 전체 (`['time', 'timezone', 'workspace', 'node']`): ~60-80 토큰
- `meta.inputTokens` 에 그대로 합산. 별도 회계 필드 신설 없음.

### 11.6 Cafe24 등 MCP 도구와의 cross-check

§11 의 systemPrompt prefix 와 [Cafe24 API Metadata §5.3](../../conventions/cafe24-api-metadata.md#53-ai-agent--mcp-도구-description-자동-suffix) 의 도구 description 자동 suffix 는 서로 보완 관계다:

- systemPrompt prefix: LLM 의 일반적 시각 추론 ("어제 자정") 의 기준
- 도구 description suffix: 특정 도구 호출 인자 ("`since` 필드") 가 어느 timezone 인지

두 채널이 일치하면 LLM 은 `$now`(UTC) ↔ prefix(워크스페이스 timezone) ↔ cafe24 도구(KST) 의 변환을 정확히 수행한다. 한 채널만 있어도 동작은 하나, 두 채널을 함께 노출하는 것이 회귀 위험 최소화 측면에서 권장된다.

### 11.7 config echo

본 §11 의 두 필드 (`includeSystemContext` / `systemContextSections`) 는 CONVENTIONS Principle 7 의 raw config echo 대상에 포함된다. 단, **default 값과 일치하면 생략** (Principle 7 의 optional 필드 echo 규약과 정합) — 사용자가 명시 변경한 경우에만 `output.config` 에 노출된다. 각 노드의 §7 출력 구조 표가 이를 명시한다.

---

## Rationale

### 시스템 컨텍스트 자동 주입 (§11)

**문제**: AI 카테고리 3 노드 어디에도 LLM 에게 "지금이 몇 시인지·어느 timezone 인지" 를 자동으로 알려주는 경로가 없었다. 사용자는 systemPrompt 본문에 수동으로 `"오늘은 {{ $now }}"` 같은 표현식을 박아야 했고, 그것마저 `$now` 가 UTC ISO8601 ([Spec 실행 엔진 §6.2](../../5-system/4-execution-engine.md#62-저장-전략)) 이라 KST 사용자가 인지하지 못한 채 9시간 어긋난 reasoning 을 받는 회귀 가능성이 있었다.

**결정**: §11 신설로 systemPrompt 앞에 `Current time` + `Timezone` prefix 자동 prepend. 기본 활성화 (`includeSystemContext: true`) + systemPrompt 앞 prefix + 섹션 단위 opt-out + 3 노드 공통 규약. 섹션은 default `['time', 'timezone']` 로 최소 정보만 — 워크스페이스/노드 정보는 디버깅 용도라 opt-in. 시각 정보는 LLM reasoning 의 일반 prefix 패턴이고 토큰 비용도 ~30 토큰으로 미미하므로 opt-in 이 아닌 default 활성화로 두어 시각 정보 누락에 의한 회귀 누적을 막는다. suffix 가 아닌 prefix 인 이유는 사용자 systemPrompt 의 마지막 지시 (`"답변은 JSON 으로"` 등) 가 묻히지 않도록 하기 위함이고, 노드별 별도 필드가 아닌 `0-common.md §11` 단일 정의인 이유는 3 노드가 동일 컨텍스트를 필요로 하여 drift 를 방지하기 위함이다.

**Cafe24 와의 cross-channel 정합**: [Cafe24 API Metadata §5.3](../../conventions/cafe24-api-metadata.md#53-ai-agent--mcp-도구-description-자동-suffix) 의 도구 description 자동 suffix 와 본 §11 시스템 프롬프트 prefix 는 보완 관계 — 두 채널이 함께 노출되어야 LLM 이 `$now`(UTC) ↔ prefix(워크스페이스 timezone) ↔ cafe24 도구(KST) 의 변환을 정확히 수행한다.

**기존 워크플로 점진 적용**: §11.1 의 "기존 row 해석 정책" 참고. config 부재 시 default 해석 (`true` + `['time','timezone']`) — DB 마이그레이션으로 명시 `false` 를 박지 않는다. 회귀 우려 워크플로만 사용자가 인지 후 명시적 opt-out.
