---
id: "CLE-NODE-AI-COMMON"
title: "AI 노드 공통"
type: "convention"
version: 12
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-AI"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI"]
area: "CLE-NODE-AI"
content_hash: "ba55e8d10e400912604362847ffddb6043de35b5afe0a820871af196d19275dd"
read_as: "approved_fallback"
task: "CLE-T-0R5SYN"
source_paths: ["spec/4-nodes/3-ai/0-common.md", "spec/4-nodes/3-ai/_product-overview.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "05144902b305308fc07a44dfe65ac870683cdebbe936a49a143eee4adcdd4eea"
etag: "sha256-6325788861f263acbc6ffa26802968f7167cbeb346392a1a7d4b6bc00f113aeb"
---
> 구현 상태: 구현됨 (캔버스 요약 일부 미구현) · 원문: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/_product-overview.md` (§4 기술 결정, §5 비기능 요구사항), `spec/4-nodes/_product-overview.md` (§6 머리말) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

AI 노드(AI nodes)는 LLM 을 부르는 세 노드다. [AI 에이전트 노드](CLE-NODE-AGENT.md)(AI Agent, `ai_agent`), [텍스트 분류기 노드](CLE-NODE-CLASSIFIER.md)(Text Classifier, `text_classifier`), [정보 추출기 노드](CLE-NODE-EXTRACTOR.md)(Information Extractor, `information_extractor`)가 여기에 속한다. 이 문서는 세 노드가 함께 따르는 규약을 정한다. 노드별 설정과 동작은 각 노드 문서가 정한다.

이 문서는 공통 규칙, 모델 선택 필드, AI 에이전트 전용인 지식 저장소·MCP 연결 필드, 멀티턴 차단 모드의 공통 동작, AI 영역의 기술 결정과 비기능 기준을 직접 정한다. 출력 · 에러 · 토큰 회계와 대화 맥락 · 메모리 · 시스템 컨텍스트 접두는 [하위 문서](#하위-문서)가 정한다.

다음 주제는 다른 문서가 정한다.

- 노드 출력 5필드의 일반 규칙: [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)
- 대화 스레드 자료구조·누적·영속화·주입 메커니즘: [대화 스레드](../CLE-IX/CLE-IX-THREAD.md)
- 에이전트 메모리 저장·추출·회수: [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md)
- 지식 저장소 검색 동작: [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md), [Graph RAG](../CLE-KB/CLE-KB-GRAPH.md)
- MCP 도구 노출·이름·실행 규칙: [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)
- 모델 설정 화면과 API: [모델 설정](../CLE-AI/CLE-AI-MODELS.md). LLM 호출 추상화: [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md)
- 입력 대기·재개 상태 전이: [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)

## 규칙

1. AI 노드는 모두 `llmConfigId`(모델 설정 참조 필드)와 `model`(모델 ID) 두 필드로 LLM 호출 설정을 고른다.
2. 지식 저장소 연결 필드(`knowledgeBases`·`ragTopK`·`ragThreshold`)와 MCP 연결 필드(`mcpServers`·`maxToolCalls`)는 AI 에이전트 노드만 갖는다. 텍스트 분류기와 정보 추출기에는 이 필드가 없다.
3. 지식 저장소 검색은 LLM 이 지식 저장소 도구(`kb_*`)를 부를 때만 실행한다. 엔진은 LLM 호출 전에 지식 저장소를 미리 검색(prefill)하지 않는다([RAG 검색](../CLE-KB/CLE-KB-SEARCH.md)).
4. 멀티턴(`multi_turn`)은 AI 에이전트와 정보 추출기만 쓴다. 종료 조건을 채우지 못하면 `status: 'waiting_for_input'`, `interactionType: 'ai_conversation'` 으로 멈춘다.
5. 멀티턴의 사용자 응답 대기에는 타임아웃이 없다. 외부 취소만 대기를 끝낸다.
6. 도메인 결과는 `output.result.*`, 에러는 `output.error.{code, message, details?}`, 사용자 입력 기록은 `output.interaction.*` 에 둔다.
7. AI 노드의 에러는 `details.retryable: boolean` 을 반드시 싣는다. `details.retryAfterSec` 은 `retryable === true` 일 때만 싣는다.
8. 멀티턴이 에러로 끝나도 부분 결과(`output.result`)를 `output.error` 와 함께 남긴다. 에러인지는 `output.error` 가 있는지로 판단한다.
9. LLM 호출 결과의 `meta` 에는 `model`·`inputTokens`·`outputTokens`·`totalTokens`·`durationMs` 를 싣는다. `thinkingTokens` 와 `turnDebug` 는 있을 때만 싣는다. 단 AI 에이전트 단일 턴이 LLM 호출 단계까지 간 출력은 `meta.thinkingTokens` 를 늘 싣고 보고가 없으면 `0` 으로 채운다([토큰 회계](CLE-NODE-AI-COMMON-OUTPUT.md#토큰-회계)).
10. provider 도구를 부른 노드는 `meta.ragSources`·`meta.ragDiagnostics`·`meta.mcpDiagnostics` 누적치를 싣는다. 멀티턴에서는 턴별 delta 의 합이 누적치와 같아야 한다.
11. 대화 맥락 설정의 기본값은 `contextScope: 'none'` 이다. 사용자가 명시적으로 켤 때만 주입한다.
12. 메모리 전략이 자동(`summary_buffer`·`persistent`)이면 범위 필드 4개(`contextScope`·`contextScopeN`·`contextInjectionMode`·`includeToolTurns`)는 무효다.
13. 시스템 컨텍스트 접두는 기본으로 켜져 있고(`includeSystemContext: true`), 항상 시스템 프롬프트 맨 앞에 붙는다.
14. 접두의 시간대는 워크스페이스 설정 → 서버 `process.env.TZ` → `UTC` 순서로 정한다.
15. 시스템 프롬프트 조립 순서의 단일 기준은 [AI 노드 공통 — 대화 맥락 · 메모리 · 시스템 컨텍스트](CLE-NODE-AI-COMMON-CONTEXT.md#시스템-프롬프트-조립-순서) 절이다.
16. `includeSystemContext`·`systemContextSections` 는 기본값과 같으면 설정 에코에서 뺀다.

## 하위 문서

이 문서에는 요구사항 줄이 없다. 위 「규칙」 번호 기준으로 하위 문서가 맡는 범위를 적는다.

- [AI 노드 공통 — 출력 · 에러 · 토큰 회계](CLE-NODE-AI-COMMON-OUTPUT.md): 출력 형태, 에러 계약, 토큰 회계, 진단 누적, 출력 구조 색인, 캔버스 요약. 규칙 6~10 을 자세히 정한다.
- [AI 노드 공통 — 대화 맥락 · 메모리 · 시스템 컨텍스트](CLE-NODE-AI-COMMON-CONTEXT.md): 대화 맥락 설정, 메모리 전략, 시스템 컨텍스트 접두(설정 필드 · 섹션 · 시간대 결정 순서 · 시스템 프롬프트 조립 순서 · 토큰 비용 · 설정 에코). 규칙 11~16 을 자세히 정한다.

## 모델 선택

세 노드 모두 다음 두 필드로 LLM 호출 설정을 고른다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `llmConfigId` | UUID | 사용할 모델 설정([모델 설정](../CLE-AI/CLE-AI-MODELS.md)) |
| `model` | String | 모델 ID (프로바이더별) |

설정 화면은 같은 패턴을 쓴다. 모델 프로바이더 드롭다운을 먼저 고르고, 그다음 모델 드롭다운을 고른다. 모델 목록은 고른 프로바이더에 따라 바뀐다.

## 지식 저장소 연결 (AI 에이전트 전용)

AI 에이전트 노드는 다음 필드로 지식 저장소 검색을 켠다. 텍스트 분류기와 정보 추출기에는 지식 저장소·RAG 설정 필드가 없다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `knowledgeBases` | UUID[] | 참조할 지식 저장소 ID 목록. 검색 모드(`vector`·`graph`)는 지식 저장소마다 다를 수 있고, 검색 서비스(`RagSearchService`)가 지식 저장소별로 흐름을 나눈다 |
| `ragTopK` | Integer | 주입 상한(선택). 비우면 동적 점수 컷이 주입 수를 정하고, 값을 주면 그 값이 상한이 된다. graph 모드 지식 저장소도 최종 주입 단계에 같은 동적 점수 컷을 적용한다 |
| `ragThreshold` | Float | 유사도 임계값. 기본 `0.7`. graph 모드 지식 저장소에서는 vector seed 단계에 적용한다. 리랭킹이 켜진 지식 저장소(`rerank_mode ≠ off`)에서는 리랭크 점수 임계로 해석한다 |

LLM 은 도구 호출 인자로 `ragTopK`·`ragThreshold` 를 덮어쓸 수 있다. 두 값의 의미, 동적 점수 컷, 리랭킹 해석, 도구 인터페이스와 이름 규칙은 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 에서 정한다.

검색 시점은 규칙 3 을 따른다. 대화 미리보기의 🔎 `rag` 행은 그 턴의 도구 호출이 가져온 청크를 모아 보여 준다([대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md)).

## MCP 서버 연결 (AI 에이전트 전용)

AI 에이전트 노드는 워크스페이스에 등록된 MCP 지원 통합(MCP-capable Integration)을 여러 개 골라 도구로 쓴다. MCP 지원 통합에는 외부 MCP 서버(`service_type='mcp'`)와 백엔드 안에서 도는 내부 MCP 브리지(Internal MCP Bridge)가 노출하는 통합(`service_type='cafe24'`·`'makeshop'`, 앞으로 늘어날 수 있음)이 모두 들어간다. 내부 MCP 브리지는 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 에서 정한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `mcpServers` | McpServerRef[] | 쓸 MCP 지원 통합 목록. `service_type ∈ ('mcp', 'cafe24', 'makeshop')` 를 모두 받는다. 서버마다 노출 도구 목록과 resource·prompt 노출 여부를 정한다 |
| `maxToolCalls` | Integer | 도구 호출 한도. 기본 `10`. 지식 저장소·MCP·표시·일반 도구 호출을 모두 더한다. 조건 도구는 세지 않는다 |

**McpServerRef 구조**

| 필드 | 타입 | 설명 |
|------|------|------|
| `integrationId` | UUID | 통합 FK(`service_type ∈ ('mcp', 'cafe24', 'makeshop')`). 외부 HTTP MCP 서버 또는 내부 MCP 브리지를 쓰는 first-party 통합 |
| `enabledTools` | String[]? | 노출 도구 목록(bare operation id 배열). `['*']` 이거나 비우면 전체를 노출한다. 메타도구(resources·prompts)에는 영향이 없다. Cafe24 는 도구가 많아(2026-07-17 실측 485개, 전체 수의 기준은 [Cafe24 API 카탈로그 §5 Coverage Matrix](CLE-C24-CATALOG#5-coverage-matrix)) 화면에서 Resource 단위로 묶어 보여 준다. 대형 카탈로그는 비워 두면 `AI_AGENT_TOOL_COUNT_MAX`(128)를 늘 넘으므로 목록 지정이 사실상 필수다([AI 에이전트 노드](CLE-NODE-AGENT.md) 의 도구 정의 크기 예산) |
| `includeResources` | Boolean? | 서버가 `resources` capability 를 보고할 때 메타도구를 노출할지. 기본 `true`. Cafe24 내부 브리지는 `resources` 를 보고하지 않아 영향이 없다 |
| `includePrompts` | Boolean? | 서버가 `prompts` capability 를 보고할 때 메타도구를 노출할지. 기본 `true`. Cafe24 도 같다 |
| `toolOverrides` | `{ toolName: string; description?: string }[]`? | 도구별 description 덮어쓰기. 이름은 바꿀 수 없다 |

도구 이름·메타도구·실행 모델·에러 격리 정책의 단일 기준은 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 다. 이 표는 노드 설정 쪽 요약이다.

**실행 중에 정하는 표현식 여부**: McpServerRef 항목에는 위 표의 설정 필드만 싣는다. AI 에이전트 핸들러는 첫 턴에 항목마다 `integrationId` 가 평가 전 원본에서 표현식이었는지 계산해 항목 밖의 불리언 배열 `mcpServerFromExpression`(i 번째 값이 i 번째 항목의 값)에 담는다. 사용자 설정의 항목에 `fromExpression` 키가 있으면 지우고 판정에 쓰지 않는다. 배열 값이 `false` 인 항목만 리터럴이고, 배열이 없거나 길이가 항목 수와 다르면 모든 항목이 표현식이다. 이 값은 개인 통합 판정([통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#integrationsservice-api-실행-엔진용))에 쓰인다. 재개·재시도 턴으로 이어지는 규칙과 옛 체크포인트의 항목 값을 옮기는 규칙은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md#보존-예외-_resumecheckpoint) 가 정한다. 표현식 여부를 항목 밖 배열로 옮긴 이유와 기각한 대안은 [실행 상태 머신과 대기·재개 Rationale](../CLE-EXEC/CLE-EXEC-STATE.md#표현식-여부를-서버-항목-밖-배열로-옮긴다-2026-11-07) 에 있다.

## 멀티턴 차단 모드

AI 에이전트와 정보 추출기의 멀티턴 모드는 워크플로우 실행을 멈추고(blocking) 사용자와 대화한다. Form 노드의 입력 대기 메커니즘을 넓힌 것이다.

- 첫 턴이나 후속 턴에서 종료 조건을 채우지 못하면 `status: 'waiting_for_input'`, `interactionType: 'ai_conversation'` 으로 멈춘다.
- 클라이언트가 `execution.submit_message` 명령으로 사용자 메시지를 보내면 재개한다. 사용자가 `execution.end_conversation` 명령을 보내면 대화를 끝낸다. 두 명령은 AI 에이전트와 정보 추출기가 함께 쓴다. 명령 정의는 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md), 외부 표면 매핑은 [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md), 대기 표면 값 집합은 [인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md) 에서 정한다.
- 사용자 응답은 무제한으로 기다린다. 외부 취소 말고는 타임아웃이 없다.
- 재개하면 엔진이 다음 턴 LLM 호출 전에 `status: 'resumed'` 와 `output.interaction.{type, data, receivedAt}` 스냅샷을 한 번 낸다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md), 형식과 저장 범위는 [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md) 의 재개 절). 같은 수신 시점에 WS `execution.user_message` 라이브 신호도 보낸다.

종료 사유별 출력 포트는 각 노드 문서의 포트 절이 정한다. park 와 rehydration 은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 에서 정한다.

## 토큰 회계

→ [AI 노드 공통 — 출력 · 에러 · 토큰 회계](CLE-NODE-AI-COMMON-OUTPUT.md#토큰-회계)

## 시스템 컨텍스트 접두

→ [AI 노드 공통 — 대화 맥락 · 메모리 · 시스템 컨텍스트](CLE-NODE-AI-COMMON-CONTEXT.md#시스템-컨텍스트-접두)

## AI 영역 기술 결정과 비기능 기준

AI 영역의 기술 결정과 비기능 요구사항이다. 자세한 규칙은 소유 문서가 정한다.

| 항목 | 결정 | 근거 | 소유 문서 |
|------|------|------|-----------|
| 벡터 DB | pgvector (PostgreSQL 확장) | 기존 PostgreSQL 인프라를 쓰고 별도 서비스가 필요 없다 | [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) |
| 임베딩 처리 | BullMQ `document-embedding` 큐 | 처음 결정은 in-process 비동기였고 뒤에 큐로 바꿨다(Rationale) | [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) |
| 파일 저장소 | S3 호환 (AWS S3 / MinIO) | 기존 MinIO 인프라를 쓴다 | [파일 저장소](../CLE-PLAT/CLE-PLAT-STORAGE.md) |
| PDF 파싱 | pdf-parse | 가벼운 라이브러리이고 텍스트 추출에 충분하다 | [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) |
| API 키 암호화 | AES-256-GCM | 기존 encrypt·decrypt 유틸리티를 재사용한다 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md) |

| ID | 요구사항 | 기준 | 소유 문서 |
|----|----------|------|-----------|
| NF-AI-01 | LLM API 호출 타임아웃 | 호출 경로마다 다르다. `timeoutMs` 를 주지 않은 `chat` 호출에는 `LlmService.chat` 기본값 10분이 걸린다. 옛 공통 기준 120초는 두지 않는다. 경로별 값은 [LLM 호출 경로별 타임아웃](#llm-호출-경로별-타임아웃) | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md), [AI 에이전트 노드](CLE-NODE-AGENT.md) |
| NF-AI-02 | 임베딩 처리 속도 | 100 청크/분 이상 | [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) |
| NF-AI-03 | RAG 검색 응답 시간 | 500ms 미만 (청크 1만 개 기준) | [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) |
| NF-AI-04 | API 키 저장 시 암호화 | AES-256-GCM 필수 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md) |
| NF-AI-05 | 문서 업로드 크기 제한 | 파일당 50MB | [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md) |
| NF-AI-06 | 동시 임베딩 처리 | 최소 3건 병렬 | [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) |

LLM 프로바이더 관리 요구사항(LLM-01~07)은 [모델 설정](../CLE-AI/CLE-AI-MODELS.md), 지식 저장소 요구사항(KB-*)은 [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md), 워크플로우 AI 어시스턴트는 [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) 가 정한다.

### LLM 호출 경로별 타임아웃

아래 표가 NF-AI-01 의 기준이다. 앱이 호출에 거는 타임아웃(`LlmService.chat` 의 `timeoutMs` 등)을 호출 경로별로 적는다. 값과 동작은 각 소유 문서가 정한다.

| 호출 경로 | 앱 타임아웃 | 한도를 넘거나 호출이 실패하면 | 소유 문서 |
|-----------|-------------|-------------------------------|-----------|
| AI 에이전트 턴의 LLM 호출(단일 턴과 멀티턴 재개의 첫 호출과 도구 루프 호출. 마지막 턴 다시 시도도 재개 경로다) | 호출마다 10분. `AI_AGENT_LLM_CALL_TIMEOUT_MS` 로 바꾸고 `0` 이면 끈다 | 타임아웃이 나면 단일 턴과 멀티턴 재개 모두 재시도할 수 있는 `LLM_CALL_FAILED` 로 끝난다. 그 밖의 실패 분류는 [AI 에이전트 노드의 에러 분류](CLE-NODE-AGENT.md#에러-코드)를 따른다. 단일 턴에서는 노드가 두 경우의 에러를 모두 `error` 포트로 낸다 | [AI 에이전트 노드](CLE-NODE-AGENT.md) |
| AI 에이전트 롤링 요약(`summary_buffer`·`persistent` 메모리 전략의 요약 호출) | 턴의 LLM 호출과 같은 값(`AI_AGENT_LLM_CALL_TIMEOUT_MS`). 단일 턴은 노드 취소 신호(`context.abortSignal`)도 넘긴다. 멀티턴 재개에는 신호 소스가 없어 그 턴의 다른 `chat` 호출과 같다 | 그 턴이 실패하고 단일 턴과 멀티턴 재개 모두 `error` 포트로 낸다. 타임아웃은 재시도할 수 있는 `LLM_CALL_FAILED` 다. 요약 모델 설정(`summaryModelConfigId`)을 조회하지 못할 때도 `error` 포트로 낸다. 분류는 [AI 에이전트 노드 §출력 포트](CLE-NODE-AGENT.md#출력-포트), 근거는 [AI 에이전트 노드 Rationale](CLE-NODE-AGENT.md#단일-턴-롤링-요약-실패도-error-포트로-보낸-이유-2026-11-05) 에 있다 | [AI 에이전트 노드](CLE-NODE-AGENT.md) |
| 텍스트 분류기·정보 추출기 | `LlmService.chat` 기본값 10분 | `LLM_CALL_FAILED` | [텍스트 분류기 노드](CLE-NODE-CLASSIFIER.md), [정보 추출기 노드](CLE-NODE-EXTRACTOR.md) |
| 워크플로우 AI 어시스턴트 턴 | 없음. 스트리밍 호출(`chatStream`)만 쓴다 | 스트림 에러 코드로 턴이 끝난다 | [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) |
| 문서 임베딩 배치 | 60초 | 그 호출이 실패하고, 일시 오류로 보아 다시 시도한다 | [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) |
| Graph RAG 추출(청크 하나의 `chat`) | 90초 | 그 호출이 실패하고, 일시 오류로 보아 문서 단위로 다시 시도한다 | [Graph RAG](../CLE-KB/CLE-KB-GRAPH.md) |
| 모델 목록 조회 | 30초 | `LLM_MODEL_LIST_FAILED` | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| 그 밖의 `chat` 호출(지식 저장소 검색의 LLM 채점 리랭킹, 에이전트 메모리 추출 등) | `LlmService.chat` 기본값 10분 | 호출한 쪽의 실패 처리를 따른다 | 각 기능 문서 |
| `chat` 이 아닌 호출(연결 테스트, RAG 검색어 임베딩, 에이전트 메모리 임베딩 등) | 없음 | 호출한 쪽의 실패 처리를 따른다 | 각 기능 문서 |

- `timeoutMs` 를 주지 않은 `chat` 호출에는 `LlmService.chat` 이 기본값 10분(`LLM_CHAT_DEFAULT_TIMEOUT_MS`)을 건다. `timeoutMs` 를 `0` 으로 주면 끈다. `chatStream` · `embed` 에는 기본값이 없다.
- 앱 타임아웃과 나란히 프로바이더에 따라 SDK 요청 타임아웃이 걸린다. 먼저 걸리는 쪽이 실제 상한이다. 그 값과 재전송, SDK 타임아웃이 없는 프로바이더는 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#호출-신뢰성-계약) 가 정한다.
- Google 은 SDK 요청 타임아웃이 없어서 비스트리밍 호출의 상한은 앱 타임아웃이다. `timeoutMs` 를 주지 않은 Google 호출도 기본값 10분에서 끊긴다.
- 어느 경로도 LLM 타임아웃을 `LLM_TIMEOUT` 코드로 내보내지 않는다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)).

## 미결 사항

- **인증 실패(401·403)의 재시도 가능 분류**: [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 과 [AI 에이전트 노드](CLE-NODE-AGENT.md)·[텍스트 분류기 노드](CLE-NODE-CLASSIFIER.md) 문서는 인증 실패를 `retryable: false` 로 정한다. [정보 추출기 노드](CLE-NODE-EXTRACTOR.md) 문서는 `LLM_CALL_FAILED` 면 무조건 `true` 로 고정한다. 코드도 갈린다. 정보 추출기 핸들러(`retryabilityDetails`)는 코드 기준이라 늘 `true` 이고, 텍스트 분류기 핸들러(`text-classifier.handler.ts` 234~241행)는 자기 문서와 달리 `LLM_CALL_FAILED` 를 늘 `true` 로 채운다. 같은 인증 실패에서 노드마다 [다시 시도] 버튼 노출이 달라진다. HTTP status 기준 분류로 통일할지, 정보 추출기의 코드 기준 예외를 규약에 적을지 결정 필요.
- **자동 메모리 전략에서 opt-out 필드 노출**: 이 문서는 자동 전략에서 `excludeFromConversationThread` 가 유효하다고 정한다. 설정 화면은 자동 전략일 때 대화 맥락 필드 5개를 모두 숨긴다(`gateOnManualMemoryStrategy`). 원문 AI 에이전트 문서의 `memoryStrategy` 행과 원본 ND-AG-27 은 "`manual` 외 선택 시 5필드 무효" 라고 적었다. 자동 전략에서 opt-out 필드를 화면에 보일지 결정 필요.
- **에러 출력의 `meta` 필수 여부**: [토큰 회계](CLE-NODE-AI-COMMON-OUTPUT.md#토큰-회계) 표는 `model`·토큰 필드를 필수로 둔다. 정보 추출기 에러는 `meta.model` 을 선택(호출이 일부라도 성공했을 때만)으로 두고 토큰을 생략한다. 텍스트 분류기 에러는 토큰을 `0` 으로 채운다. 텍스트 분류기는 `turnDebug` 대신 `meta.llmCalls` 평면 구조를 쓰는데 공통 규약에 없는 형태다. AI 에이전트 단일 턴의 LLM 호출 실패 에러는 실패 전에 성공한 호출의 usage 를 더해 토큰으로 싣는다. 첫 호출이 실패하면 토큰은 `0` 이다. 이 에러는 `turnDebug` 를 늘 싣는다. 같은 노드의 도구 정의 예산 초과 에러(`TOOL_DEFINITION_PAYLOAD_EXCEEDED`)는 LLM 호출 전에 나므로 `meta` 에 `model` · `durationMs` 만 싣는다. 에러 케이스 규칙(0 채움 여부)과 `llmCalls` 형태를 공통 규약에 적을지 결정 필요.
- **포트 type 표기**: [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 의 포트 정의 `type` enum 은 `data`·`control`·`error` 세 값이다. [정보 추출기 노드](CLE-NODE-EXTRACTOR.md) 는 시스템 포트에 `system` 을 쓴다. [AI 에이전트 노드](CLE-NODE-AGENT.md) 는 시스템 포트와 에러 포트를 `data` 로 적는다. [텍스트 분류기 노드](CLE-NODE-CLASSIFIER.md) 는 에러 포트를 `error` 로 적는다. 현재 프런트엔드 `resolve-dynamic-ports.ts` 는 `DynamicPortType` 에 `system` 을 두고 AI 에이전트 시스템 포트에도 `system` 을 쓴다. enum 에 `system` 을 더할지, 노드 포트 표를 어느 값으로 맞출지 결정 필요.
- **AI 에이전트 캔버스 요약의 표시 도구 세그먼트**: 원문 AI 에이전트 문서는 목표 형식에 표시 도구 수(`· {N} render`, 예: `Multi Turn · gpt-4o · 1 KB · 2 MCP · 2 cond · 3 render`)를 넣었다. [캔버스 요약](CLE-NODE-AI-COMMON-OUTPUT.md#캔버스-요약) 의 목표 형식에는 없다. 아직 구현 전이라 영향은 작다. 어느 쪽으로 맞출지 결정 필요.

## 구현 위치

- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
- `codebase/backend/src/nodes/ai/ai-agent/mcp-server-ref-use.ts` (MCP 서버의 표현식 여부 배열을 정하고 읽는다)
- `codebase/backend/src/nodes/ai/text-classifier/text-classifier.handler.ts`
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`

출력 공통 타입과 대화 맥락 · 시스템 컨텍스트 공유 모듈의 위치는 각 하위 문서의 구현 위치 절에 있다.

## Rationale

### LLM 호출 타임아웃을 호출 경로별 현행 값으로 적는다 (2026-10-10)

**문제**: NF-AI-01 은 LLM 호출 타임아웃을 120초(스트리밍 제외)로 요구했다. 코드에는 모든 호출에 거는 120초가 없다. AI 에이전트 턴은 앱 기본값 10분을 걸고, 그 밖의 경로는 대부분 `timeoutMs` 를 주지 않아 SDK 요청 타임아웃만 받는다. Google SDK 에는 그 타임아웃도 없다. [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) 는 NF-AI-01 을 근거로 스트리밍 턴에 120초와 `LLM_TIMEOUT` 을 약속했지만, NF-AI-01 은 스트리밍을 빼고 어느 경로도 `LLM_TIMEOUT` 을 내지 않는다.

**결정**: 2026-10-10 에 사람이 문서를 코드에 맞추기로 정했다. 공통 120초 기준을 거두고 호출 경로별 현행 값을 [LLM 호출 경로별 타임아웃](#llm-호출-경로별-타임아웃) 표에 적는다. LLM 타임아웃은 `LLM_TIMEOUT` 코드로 내지 않는다. 이 결정은 문서를 코드에 맞추는 데까지였고 앱 타임아웃이 없는 호출의 상한은 정하지 않았다(2026-10-23 명시). 그 상한은 [2026-11-14 결정](#앱-타임아웃이-없던-호출의-상한을-정한다-2026-11-14) 이 정했다.

- 기각: AI 에이전트의 앱 기본값 10분을 120초로 낮추는 안. 처음에는 큰 출력이나 extended thinking 처럼 정상이지만 오래 걸리는 생성이 끊긴다는 이유를 적었다. 그런데 OpenAI 계열과 Anthropic 은 SDK 가 이미 요청마다 약 120초를 건다. 에이전트의 `chat` 은 비스트리밍이라 응답 헤더가 생성이 끝난 뒤에 오므로, 이 네 프로바이더의 긴 생성은 지금도 SDK 쪽에서 약 120초에 끊긴다. 120초로 낮췄을 때 달라지는 것은 SDK 타임아웃이 없는 Google 과, SDK 가 타임아웃 난 요청을 다시 보내며 늘어나는 누적 시간이다. 긴 생성이 끊긴다는 이유는 Google 에만 맞는다(2026-10-23 정정). 지금 10분을 유지하는 근거는 문서를 코드에 맞춘다는 2026-10-10 결정이다. 2026-11-14 에 상한을 다시 정할 때도 AI 에이전트의 10분은 그대로 두었다([2026-11-14 결정](#앱-타임아웃이-없던-호출의-상한을-정한다-2026-11-14)). AI 에이전트 턴에 10분을 둔 근거는 [AI 에이전트 노드](CLE-NODE-AGENT.md) 의 Rationale 에 있다.
- 기각: 어시스턴트의 스트리밍 턴에 앱 타임아웃을 두는 안. 턴 전체에 한도를 걸면 길지만 정상인 응답도 끊긴다. 토큰이 멈춘 것만 잡는 유휴 감지는 이번 결정에서 검토하지 않았다. 2026-11-14 에 감지하지 않기로 정했다([2026-11-14 결정](#앱-타임아웃이-없던-호출의-상한을-정한다-2026-11-14)).

### 앱 타임아웃이 없던 호출의 상한을 정한다 (2026-11-14)

**문제**: 2026-10-10 결정 뒤에도 앱 타임아웃이 없는 호출이 남았다. 롤링 요약 호출은 타임아웃도 노드 취소 신호도 받지 않았다. 그래서 요약 응답이 오지 않으면 턴이 끝나지 않았고 노드를 취소해도 요약 요청은 남았다. Google 은 SDK 요청 타임아웃이 없어서 `timeoutMs` 를 주지 않는 텍스트 분류기·정보 추출기·메모리 호출에 상한이 없었다. 스트림이 열린 뒤 토큰이 멈추는 경우는 어느 프로바이더에서도 잡지 못했다.

**결정**: 2026-11-14 에 사람이 다음과 같이 정했다(NERV Task `CLE-T-0R5SYN`, 질문 `01a1d93a-cd66-73ab-a2e9-37ffa7ee1312`).

- 롤링 요약 호출은 AI 에이전트의 다른 LLM 호출과 같은 앱 타임아웃(`AI_AGENT_LLM_CALL_TIMEOUT_MS`, 기본 10분, `0` 은 끔)과 노드 취소 신호를 받는다. 노드 취소 신호가 전달되는 경로는 단일 턴(`context.abortSignal`)뿐이다. 멀티턴 재개에는 신호 소스가 없어서 요약 호출도 그 턴의 다른 `chat` 호출처럼 앱 타임아웃과 턴 경계의 취소 관측으로 끝난다.
- `LlmService.chat` 은 `timeoutMs` 를 받지 못한 호출에 기본값 10분을 건다. `0` 은 지금처럼 끈다. `chatStream` · `embed` 에는 걸지 않는다.
- 그래서 `timeoutMs` 를 넘기지 않던 텍스트 분류기·정보 추출기·지식 저장소·메모리 내부 호출도 10분 상한을 받는다.
- 10분은 OpenAI · Anthropic 의 SDK 상한보다 길다. SDK 는 요청마다 120초를 걸고 재전송 2회를 더하면 약 6분이다. 그래서 이 기본값은 실제로 Google 호출과 SDK 가 멈춘 경우에만 걸린다.
- Google 비스트리밍 호출은 이 기본값으로 상한이 생긴다.
- 스트림 유휴는 감지하지 않는다.

기각한 대안은 셋이다.

- **공통 기본값을 120초로 두는 안**: Google 호출에서 정상인 긴 생성이 끊긴다. 10분은 긴 생성을 끊지 않고 멈춘 호출만 끊는다. 120초 하향안을 기각한 이력은 [2026-10-10 결정](#llm-호출-타임아웃을-호출-경로별-현행-값으로-적는다-2026-10-10) 에 있다.
- **Google SDK 에 요청 타임아웃을 따로 거는 안**: 공통 기본값으로 Google 비스트리밍 호출에도 상한이 생긴다. 같은 상한을 SDK 에 한 번 더 둘 필요가 없다.
- **스트림 유휴 감지**: 추론 모델은 첫 토큰 전에 몇 분씩 조각 없이 기다리는 일이 정상이다. 유휴 한도는 턴 타임아웃을 기각한 것과 같은 이유로 정상 응답을 끊는다. 턴 타임아웃을 기각한 이력은 [2026-10-10 결정](#llm-호출-타임아웃을-호출-경로별-현행-값으로-적는다-2026-10-10) 에 있다.

### 임베딩 처리를 in-process 에서 큐로 바꾼 이력

AI 제품 정의는 처음에 임베딩을 in-process 비동기로 처리하기로 했다(초기 단순화, 나중에 BullMQ 로 바꿀 수 있음). 지금은 BullMQ `document-embedding` 큐로 처리한다. 자세한 결정은 [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) 에 있다.
