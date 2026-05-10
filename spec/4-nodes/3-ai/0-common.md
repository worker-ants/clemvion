# Spec: AI 노드 공통 규약

> 관련 문서: [PRD 노드 시스템](../../../prd/3-node-system.md#6-ai-노드-3종) · [PRD Graph RAG](../../../prd/9-graph-rag.md) · [Spec 노드 개요](../0-overview.md) · [Spec Knowledge Base](../../2-navigation/5-knowledge-base.md) · [Spec RAG 검색](../../5-system/9-rag-search.md) · [Spec Graph RAG](../../5-system/10-graph-rag.md) · [Spec LLM Config](../../2-navigation/6-config.md) · [Spec MCP Client](../../5-system/11-mcp-client.md)

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

## 2. Knowledge Base 연동

AI Agent / Information Extractor 노드는 다음 필드로 Knowledge Base 검색을 활성화한다:

| 필드 | 타입 | 설명 |
|------|------|------|
| knowledgeBases | UUID[] | 참조할 Knowledge Base ID 목록. 모드(`vector` / `graph`)는 KB 마다 다를 수 있으며 RagSearchService 가 KB 별로 흐름을 분기한다 |
| ragTopK | Integer | RAG 검색 결과 수 (기본: 5). graph 모드 KB 에서도 동일 (rerank 후 상위 K 만 컨텍스트에 주입) |
| ragThreshold | Float | RAG 유사도 임계값 (기본: 0.7). graph 모드 KB 의 vector seed 단계에 적용 |

KB 검색은 LLM 의 능동 호출 시에만 실행되며 prefill 하지 않는다. 도구 인터페이스/이름 규칙은 [Spec RAG 검색 §2.1](../../5-system/9-rag-search.md#21-kb-tool-정의) 참조.

## 3. MCP 서버 연결 (AI Agent 전용)

AI Agent 노드는 워크스페이스에 등록된 MCP Integration 을 다중 선택해 도구로 사용한다:

| 필드 | 타입 | 설명 |
|------|------|------|
| mcpServers | McpServerRef[] | 활용할 MCP 서버 목록 (`service_type='mcp'` Integration 참조). 서버별로 도구 allowlist·resource/prompt 노출 여부 설정 |
| maxToolCalls | Integer | 최대 도구 호출 횟수 (기본: 10). KB tool · MCP tool · 일반 tool 호출이 모두 합산됨 |

**McpServerRef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| integrationId | UUID | FK → Integration (`service_type='mcp'`). 워크스페이스에 등록된 MCP 서버 |
| enabledTools | String[]? | 일반 도구 allowlist. `['*']` 또는 미설정 = 전체 노출. 메타도구(resources/prompts)에는 영향 없음 |
| includeResources | Boolean? | 서버가 `resources` capability 를 보고할 때 메타도구 노출 여부. 기본 `true` |
| includePrompts | Boolean? | 서버가 `prompts` capability 를 보고할 때 메타도구 노출 여부. 기본 `true` |
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
| `output.error.{code, message, details?}` | LLM 호출 실패, JSON 파싱 실패, 재시도 소진 등 |
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

KB / MCP / 일반 provider 도구 호출이 발생한 노드는 `meta.ragSources` / `meta.ragDiagnostics` / `meta.mcpDiagnostics` 누적치를 메타에 노출한다. multi-turn 에서는 turn 단위 delta 가 `meta.turnDebug[i].{ragSources, ragDiagnostics, mcpDiagnostics}` 에도 분리되어 노출되며, "delta 의 합 = 전체 누적" 관계를 만족한다. 자세한 필드 의미:

- RAG: [Spec Graph RAG §4.3](../../5-system/10-graph-rag.md#43-출력-메타데이터)
- MCP: [Spec MCP Client §6.2](../../5-system/11-mcp-client.md#62-진단-누적-mcpdiagnostics)

---

## 8. 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| AI Agent | `{mode} · {model}`. Tool Area에 등록된 도구 수가 있으면 `· {N} tools`, Knowledge Base 연결 시 `· {N} KB`, MCP 서버가 있으면 `· {N} MCP`, 조건이 있으면 `· {N} cond` 추가. mode가 `multi_turn`이면 `Multi Turn` 표기, `single_turn`이면 생략 | `gpt-4o · 2 tools · 1 KB · 1 MCP · 3 cond` (single) / `Multi Turn · gpt-4o · 1 KB · 2 MCP · 2 cond` (multi) |
| Text Classifier | `{model} · {N} categories` (카테고리 수) | `gpt-4o-mini · 3 categories` |
| Info Extractor | `{model} · {N} fields` (outputSchema 필드 수). mode가 `multi_turn`이면 `Multi Turn` 접두어 추가 | `claude-sonnet · 4 fields` (single) / `Multi Turn · claude-sonnet · 4 fields` (multi) |
