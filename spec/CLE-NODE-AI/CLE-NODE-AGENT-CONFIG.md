---
id: "CLE-NODE-AGENT-CONFIG"
title: "AI 에이전트 노드 — 설정과 포트"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-AGENT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI", "CLE-NODE-AGENT"]
area: "CLE-NODE-AI"
content_hash: "742087c29942ce44fdb3863ada43995889be03673559155ec468b6e186b1c31d"
read_as: "approved_fallback"
task: "CLE-T-GG3WPZ"
source_paths: []
mirror_sha256: "233767ca338a2a8b7a80612584a685f2c0731ba9a1eeddf59cedb14119e7690d"
etag: "sha256-2e7a958d6ef79f5b8f0c06714ddeee6cb8a5ea4ed76c91dbbbeed74a347f5eb9"
---
## 개요

이 문서는 [AI 에이전트 노드](CLE-NODE-AGENT.md) 의 하위 문서로 설정 필드, 설정 화면, 입출력 포트, 캔버스 요약을 정한다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `mode` | `single_turn` / `multi_turn` | ✓ | `single_turn` | AI 실행 모드 |
| `llmConfigId` | UUID | | 없음 | 모델 설정 참조([AI 노드 공통](CLE-NODE-AI-COMMON.md)) |
| `model` | String (표현식) | | 없음 | 모델 ID. `{{ }}` 허용 |
| `systemPrompt` | String (표현식) | | 없음 | 마크다운·표현식 지원 |
| `userPrompt` | String (표현식) | | 없음 | 단일 턴 전용. 멀티턴으로 바꾸면 프런트엔드 `clearFields` 가 지우고 백엔드도 무시한다(서버 쪽 안전망) |
| `temperature` | Float | | 모델 설정 기본 파라미터 | 덮어쓰기. Anthropic 모델에는 보내지 않는다 |
| `maxTokens` | Integer | | 모델 설정 기본 파라미터(`max_tokens`, 새 설정 폼 기본값 4096) | 덮어쓰기. 기본 파라미터는 [모델 설정](../CLE-AI/CLE-AI-MODELS.md#기본-파라미터-기본값) 이 정한다 |
| `responseFormat` | `text` / `json` | ✓ | `text` | 응답 형식 |
| `jsonSchema` | JSONSchema | | 없음 | `responseFormat=json` 일 때 출력 스키마 |
| `knowledgeBases` | UUID[] | | `[]` | 지식 저장소 목록 |
| `ragTopK` | Integer | | 없음 | 주입 상한(선택). 비우면 동적 점수 컷(토큰 예산 + 내부 주입 상한 12)이 정한다([RAG 검색 §동적 점수 컷](../CLE-KB/CLE-KB-SEARCH.md#동적-점수-컷)). LLM 이 인자로 덮어쓸 수 있다. 리랭킹이 켜진 지식 저장소는 리랭크 뒤 적용 |
| `ragThreshold` | Float | | `0.7` | 최소 유사도(0~1) 기본값. LLM 이 인자로 덮어쓸 수 있다. 리랭킹이 켜지면 리랭크 점수 임계 |
| `mcpServers` | McpServerRef[] | | `[]` | MCP 지원 통합 목록(`mcp`·`cafe24`·`makeshop`). `cafe24`·`makeshop` 은 `Cafe24McpToolProvider`·`MakeshopMcpToolProvider` 가 in-process 도구 프로바이더로 동작. 대형 카탈로그는 노출 도구 목록 없이 쓰면 실패한다([도구 정의 크기 예산](CLE-NODE-AGENT-TOOLS.md#도구-정의-크기-예산)) |
| `maxToolCalls` | Integer | ✓ | `10` | 도구 호출 한도(지식 저장소·MCP·표시·일반 합산) |
| `includeSystemContext` | Boolean | | `true` | 시스템 컨텍스트 접두 |
| `systemContextSections` | String[] | | `['time', 'timezone']` | 접두 섹션(`time`·`timezone`·`workspace`·`node`) |
| `contextScope` | `none` / `thread` / `lastN` | ✓ | `none` | 대화 맥락 범위. 메모리 전략이 `manual` 이 아니면 무효 |
| `contextScopeN` | Integer | | `20` | `lastN` 의 N. `manual` 이 아니면 무효 |
| `contextInjectionMode` | `messages` / `system_text` | | `messages` | 주입 형식. 자동 전략에서는 최근 원문 턴의 형식으로만 뜻이 있고(요약·회수 블록은 늘 system_text) 범위 선택은 무효 |
| `includeToolTurns` | Boolean | | `false` | `ai_tool` 턴도 누적. 자동 전략이면 주입 쪽에서만 무효 |
| `excludeFromConversationThread` | Boolean | | `false` | 스레드 opt-out. 메모리 전략과 무관 |
| `memoryStrategy` | `manual` / `summary_buffer` / `persistent` | | `manual` | 메모리 전략([AI 노드 공통](CLE-NODE-AI-COMMON.md)) |
| `memoryTokenBudget` | Integer | | `8000` | 자동 전략의 working-memory 토큰 예산. 스레드 문자 상한과 별개 |
| `memoryKey` | String (표현식) | | 없음 | `persistent` 메모리 범위 키. `(workspace_id, memoryKey)` 가 실행을 넘는 네임스페이스. 비우면 `execution_id` 로 격리 |
| `memoryTopK` | Integer | | `5` | `persistent` 회수 top-k. `ragTopK` 와 독립 |
| `memoryThreshold` | Float | | `0.7` | `persistent` 회수 최소 유사도. `ragThreshold` 와 독립 |
| `memoryTtlDays` | Integer | | 없음 | 추출 메모리 TTL(일). 주면 `expires_at = now() + ttlDays` 를 붙여 만료 뒤 회수에서 빼고 정리한다. 비우면 만료 없음(기존 동작) |
| `embeddingModelConfigId` | 모델 설정 선택 | | 없음 | 회수·저장 임베딩용 embedding 모델 설정 id(`embedding-config-selector`). 회수와 저장이 같은 설정이어야 차원이 맞다. 비우면 워크스페이스 기본(`ModelConfigService.resolveEmbedding`) |
| `summaryModelConfigId` | 모델 설정 선택 | | 없음 | 롤링 요약 LLM 호출용 chat 모델 설정 id(`chat-config-selector`). 비우면 노드 main 모델 설정. 다른 프로바이더의 저가 모델도 된다 |
| `extractionModelConfigId` | 모델 설정 선택 | | 없음 | 메모리 추출 LLM 호출용 chat 모델 설정 id. 비우면 노드 `llmConfigId` → 기본 모델 |
| `maxTurns` | Integer | | `20` | 멀티턴 최대 턴 수. `0` 무제한. 멀티턴일 때만 보인다 |
| `conditions` | ConditionDef[] | | `[]` | 조건 목록. 조건마다 `{condition.id}` 포트 |
| `presentationTools` | PresentationToolDef[] | | `[]` | 표시 도구 등록 목록. 비어 있으면 꺼짐 |

`temperature`·`maxTokens` 를 비우면 모델 설정에 저장한 기본 파라미터(`defaultParams`)를 쓴다. 모델 설정에도 값이 없으면 값 없이 부른다. 이때 Anthropic 클라이언트만 `max_tokens` 를 4096 으로 채우고 나머지 프로바이더는 자체 기본값을 쓴다. Anthropic 클라이언트는 `temperature` 를 지정해도 보내지 않는다([LLM 클라이언트 「Anthropic」](../CLE-AI/CLE-AI-LLM.md#anthropic)). 기본 파라미터는 `LlmService` 가 채운다. 그래서 디버그 기록 `meta.llmCalls[].requestPayload` 에는 노드 설정 값이 그대로 남는다. 병합 규칙은 [LLM 클라이언트 「모델 설정 기본 파라미터 채우기」](../CLE-AI/CLE-AI-LLM-SERVICE.md#모델-설정-기본-파라미터-채우기) 가 정한다.

세 모델 설정 선택 필드는 노드 `llmConfigId` 와 독립이며, 고른 설정 자신의 provider·credential·defaultModel 로 부른다. 설정 스키마의 단일 기준은 `ai-agent.schema.ts` 의 `aiAgentNodeConfigSchema` 다. 스키마는 `.passthrough()` 라 DB 에 남은 옛 키는 조용히 통과하지만 핸들러는 읽지 않는다.

**ConditionDef 구조**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | String (UUID v4) | ✓ | 조건 식별자이자 출력 포트 ID. UUID v4 는 slug 정규식 `^[a-zA-Z0-9_-]{1,64}$` 을 통과하는 유효 포트 ID 다([노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md)). 만들 때 주고 이후 바꾸지 않는다 |
| `label` | String | ✓ | 조건 이름(화면 표시와 포트 라벨) |
| `prompt` | String (2,000자 이하) | ✓ | 조건 설명. LLM 도구 description 으로 쓴다. "언제 이 조건을 골라야 하는지" 를 적는다 |

조건 검증 규칙과 도구 등록은 [도구와 조건 §조건](CLE-NODE-AGENT-TOOLS.md#조건) 이 정한다.

**PresentationToolDef 구조**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | Enum | ✓ | `carousel` / `table` / `chart` / `form` / `template` |
| `description` | String? | | LLM 에 보일 description. 비우면 type 별 기본 문구([Presentation 노드 공통 §도구 카탈로그](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md#도구-카탈로그)) |
| `defaults` | Object? | | 브랜드·스타일 고정값. LLM 은 데이터만 채운다. 병합 규칙은 [Presentation 노드 공통 §defaults 덮어쓰기 규칙](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md#defaults-덮어쓰기-규칙) |

- 한 노드 안에서 `type` 은 중복할 수 없다.
- 켜면 도구 이름은 `render_{type}` 으로 고정이며 정제가 필요 없다.

## 설정 화면

| 영역 | 들어가는 요소 | 동작 |
|------|---------------|------|
| 모델 (맨 위) | "LLM Provider", "Model" 드롭다운 | 프로바이더를 고르면 모델 목록이 바뀐다 |
| 실행 모드 | "Single Turn" / "Multi Turn" 라디오 | 멀티턴으로 바꾸면 `userPrompt` 를 지운다 |
| 시스템 프롬프트 | 여러 줄 입력 | 마크다운·표현식 |
| 사용자 프롬프트 | 여러 줄 입력(예: `{{ $input.message }}`) | 단일 턴일 때만 보인다 |
| 파라미터 | "Temperature", "Max Tokens", "Response"(Text / JSON) | 모델 설정 기본값 덮어쓰기 |
| 지식 저장소 | "Add Knowledge Base" 버튼, 연결 목록 | 주입 상한(`ragTopK`)은 지식 저장소별이 아니라 노드 단위 선택 값 |
| MCP 서버 | "Add MCP Server" 버튼, 연결 목록 | 후보를 세 그룹으로 보여 준다(아래) |
| 조건 | 조건 목록(번호·라벨·프롬프트·삭제), "Add Condition" | 선택 사항 |
| 메모리 | "Strategy" 드롭다운과 조건부 필드 | 아래 노출 규칙 |
| 대화 맥락 | "Scope", "Last N", "Mode", "Include tool turns in thread", "Exclude this node from thread" | 메모리 전략이 `manual` 일 때만 보인다 |
| 멀티턴 설정 (맨 아래) | "Max Turns" | 멀티턴일 때만 보인다 |

**메모리 영역 노출 규칙(`visibleWhen`)**: "Strategy" 는 늘 보인다. "Token Budget"·"Summary Model" 은 `summary_buffer`·`persistent` 일 때, "Memory Key"·"Top-K"·"Threshold"·"TTL (days)"·"Extraction Model" 은 `persistent` 일 때만 보인다. `manual` 이면 대화 맥락 영역 5필드가 그대로 보이고, `manual` 이 아니면 대화 맥락 영역 전체를 숨긴다.

**"Add MCP Server" 후보**: 워크스페이스의 `service_type='mcp'`·`'cafe24'`·`'makeshop'` 통합을 그룹으로 나눠 보여 준다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md)).

- `🌐 Generic MCP (HTTP) servers`: `mcp`
- `🛒 Cafe24 stores (Internal Bridge)`: `cafe24`
- `🛒 MakeShop stores (Internal Bridge)`: `makeshop`

추가한 행 앞에 브리지 아이콘(🌐·🛒)을 붙인다. 라벨은 "MCP 지원 통합" 뜻으로 쓰며, 바꾸지 않고 허용 목록만 넓혀 학습 비용을 줄였다. 워크플로우 AI 어시스턴트의 후보 선택기도 세 `service_type` 을 모두 모은다([AI 어시스턴트 도구](../CLE-WF/CLE-WF-ASSIST-TOOLS.md)).

## 포트

### 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 노드 입력(1개) |

### 출력 포트

**단일 턴**

| id | label | type | dynamic | 발생 조건 |
|------|-------|------|---------|-----------|
| `out` | Output | data | false | 정상 완료(조건 미매칭 또는 조건 0개) |
| `{condition.id}` | `{condition.label}` | data | true | 해당 조건 매칭. 조건마다 1개 |
| `error` | Error | data | false | LLM 오류·타임아웃·rate limit 등 모든 오류(단일 턴의 노드 LLM 설정 조회 실패는 예외. 범위는 표 아래 문단의 링크 문서가 정한다) |

**멀티턴**

| id | label | type | dynamic | 발생 조건 |
|------|-------|------|---------|-----------|
| `{condition.id}` | `{condition.label}` | data | true | 해당 조건 매칭. 조건마다 1개 |
| `user_ended` | User Ended | data | false | 사용자가 `execution.end_conversation` 으로 종료 |
| `max_turns` | Max Turns | data | false | 턴 수가 `maxTurns` 에 닿음(`0` 이면 발생 안 함) |
| `error` | Error | data | false | LLM 오류·타임아웃·rate limit 등 모든 오류 |

멀티턴에는 `out` 포트가 없다. 종료 사유가 늘 분명해 사유별 포트로 나눈다. 조건이 0개여도 같다. 포트 `type` 표기는 AI 노드와 코드 사이에 정의가 갈린다([AI 노드 공통](CLE-NODE-AI-COMMON.md) 미결 사항).

단일 턴이 `error` 포트로 보내는 실패의 범위(LLM 호출 실패, 도구 정의 크기 예산 초과, 롤링 요약 실패, 노드 LLM 설정 조회 실패의 예외, 노드 취소)는 [에러와 타임아웃 §단일 턴의 error 포트](CLE-NODE-AGENT-ERROR.md#단일-턴의-error-포트) 가 정한다. 멀티턴 에러 종결은 엔진 `handleAiTurnError` 경로로 구현돼 있다.

**포트 시각 구분**

- 사용자 조건 포트는 초록 핸들로 위쪽에, 시스템 포트(`out`·`user_ended`·`max_turns`)는 파랑, 에러 포트는 빨강으로 그린다.
- 조건이 1개 이상이면 조건 포트와 시스템·에러 포트 사이에 점선 구분자를 그린다. 조건이 0개여도 색 규칙은 같다.

**공통**

- 조건을 추가·삭제·이름 변경·재정렬해도 포트 ID(UUID)가 바뀌지 않아 연결선이 유지된다.
- `timeout` 포트는 없다. 타임아웃·rate limit 은 `error` 포트로 모은다. 옛 `timeout` 포트 연결선은 끊기므로 `error` 로 다시 연결한다(신규 기능이라 실제 연결선은 없다).
- 조건 없는 옛 멀티턴 노드의 `out` 연결선도 끊긴다. `user_ended` 나 `max_turns` 로 다시 연결한다.

## 캔버스 요약

형식은 [AI 노드 공통](CLE-NODE-AI-COMMON.md) 의 캔버스 요약 절이 정한다. `summaryTemplate` 이 없어 지금 AI 에이전트 요약은 보이지 않는다(미구현).

## Rationale

### 멀티턴에 `out` 포트가 없는 이유 (2026-07-18)

원본 ND-AG-24 는 "멀티턴 조건 0개면 하위 호환으로 `out` + `error`" 라고 적어 포트 절과 코드와 맞지 않았다. 코드는 프런트엔드 `resolve-dynamic-ports.ts` 의 `aiAgentConditionalPorts` 가 멀티턴·조건 없음에서 `user_ended`·`max_turns`·`error` 만 내고, 백엔드 `multiTurnPortForEndReason` 도 어떤 종료 사유도 `out` 으로 보내지 않는다(`condition`·기본값은 방어적으로 `error`). 포트 절의 마이그레이션 규칙이 이미 옛 `out` 연결선을 다시 연결하라고 정해 하위 호환 `out` 은 구현된 적이 없다. 설계 번복이 아니라 어긋난 요구사항 문구를 지운 것이다.
