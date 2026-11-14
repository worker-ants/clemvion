---
id: "CLE-NODE-AGENT"
title: "AI 에이전트 노드"
type: "feature"
version: 12
status: "approved"
requirements: ["REQ-AGENT-001", "REQ-AGENT-002", "REQ-AGENT-003", "REQ-AGENT-004", "REQ-AGENT-005", "REQ-AGENT-006", "REQ-AGENT-007", "REQ-AGENT-008", "REQ-AGENT-009", "REQ-AGENT-010", "REQ-AGENT-011", "REQ-AGENT-012", "REQ-AGENT-013", "REQ-AGENT-014", "REQ-AGENT-015", "REQ-AGENT-016", "REQ-AGENT-017", "REQ-AGENT-018", "REQ-AGENT-019", "REQ-AGENT-020", "REQ-AGENT-021", "REQ-AGENT-022", "REQ-AGENT-023", "REQ-AGENT-024", "REQ-AGENT-025", "REQ-AGENT-026", "REQ-AGENT-027", "REQ-AGENT-028", "REQ-AGENT-029", "REQ-AGENT-030", "REQ-AGENT-031", "REQ-AGENT-032", "REQ-AGENT-033", "REQ-AGENT-034", "REQ-AGENT-035", "REQ-AGENT-036", "REQ-AGENT-037", "REQ-AGENT-038", "REQ-AGENT-039", "REQ-AGENT-040", "REQ-AGENT-041", "REQ-AGENT-042", "REQ-AGENT-043", "REQ-AGENT-044", "REQ-AGENT-045", "REQ-AGENT-046", "REQ-AGENT-047", "REQ-AGENT-048", "REQ-AGENT-049", "REQ-AGENT-050", "REQ-AGENT-051", "REQ-AGENT-052", "REQ-AGENT-053", "REQ-AGENT-054", "REQ-AGENT-055"]
basis_superseded: false
parent: "CLE-NODE-AI"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI"]
area: "CLE-NODE-AI"
content_hash: "42faefc41ea091e2d7ebc4b0f5740a572427597ac6e337902713c87b296241ad"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/4-nodes/3-ai/1-ai-agent.md", "spec/4-nodes/3-ai/_product-overview.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "665f56a820fb20006618ec6b8179f7a699cfc06af79b4c1a2730885a356fa165"
etag: "sha256-a73c49976a0f4731f54c956170ac8d86487c268bc78da5d3320756ef4f504b56"
---
> 구현 상태: 부분 구현 · 원문: `spec/4-nodes/3-ai/1-ai-agent.md` (§1~§6, §9~§12), `spec/4-nodes/3-ai/_product-overview.md` (§3.2), `spec/4-nodes/_product-overview.md` (§6.1) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

AI 에이전트 노드(AI Agent, `ai_agent`)는 LLM 으로 응답을 만든다. LLM 에는 지식 저장소 도구(`kb_*`), MCP 도구(`mcp_*`), 조건 도구(`cond_*`), 표시 도구(`render_*`)를 노출한다. 단일 턴(`single_turn`)은 LLM 을 한 번 불러 끝낸다. 멀티턴(`multi_turn`)은 워크플로우 실행을 멈추고 사용자와 대화한다.

이 문서는 이 노드의 입구다. 요구사항, 미결 사항, 구현 위치를 두고 주제별 규칙은 「하위 문서」 절의 문서가 정한다.

다음 주제는 다른 문서가 정한다.

- 출력 케이스별 구조와 LLM 호출 기록(`meta.turnDebug`): [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md)
- 세 AI 노드 공통 규약(모델 선택, McpServerRef, 대화 맥락 설정, 메모리 전략, 시스템 컨텍스트 접두, 캔버스 요약, 에러 계약): [AI 노드 공통](CLE-NODE-AI-COMMON.md)
- 표시 도구의 스키마 변환·defaults 덮어쓰기·제출 wire 형식: [Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md)
- 지식 저장소 검색: [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md). MCP 도구 노출: [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md). 에이전트 메모리: [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md)
- 입력 대기·재개·마지막 턴 재시도의 상태 전이: [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)

다른 노드를 도구로 연결하던 입력 경로(옛 도구 영역, Tool Area)는 제거됐고 새 설계를 기다린다([도구 연결 입력 경로 제거](#도구-연결-입력-경로-제거)). 조건·지식 저장소·MCP·표시 도구는 영향이 없다.

## 요구사항

- REQ-AGENT-001 WHEN 노드가 실행되면 THE SYSTEM SHALL 설정한 모델로 LLM 을 불러 AI 에이전트를 실행한다. (원본: ND-AG-01)
- REQ-AGENT-002 WHEN 사용자가 시스템 프롬프트를 입력하면 THE SYSTEM SHALL 마크다운과 표현식을 허용한다. (원본: ND-AG-02)
- REQ-AGENT-003 WHEN 사용자가 모델을 고르면 THE SYSTEM SHALL 모델 설정에 등록한 Chat 프로바이더와 모델 중에서 고르게 한다. (원본: ND-AG-03)
- REQ-AGENT-004 WHEN `temperature`·`maxTokens` 를 지정하면 THE SYSTEM SHALL 모델 설정 기본값 대신 그 값을 쓴다. 단 Anthropic 모델에는 `temperature` 를 보내지 않는다. (원본: ND-AG-04)
- REQ-AGENT-005 WHEN 지식 저장소를 연결하면 THE SYSTEM SHALL 지식 저장소 도구를 LLM 에 노출해 RAG 검색을 가능하게 한다. (원본: ND-AG-05)
- REQ-AGENT-006 WHEN 대화 맥락 설정을 켜면 THE SYSTEM SHALL 대화 스레드를 설정한 범위와 형식으로 LLM 입력에 넣는다. (원본: ND-AG-07)
- REQ-AGENT-007 WHEN `responseFormat` 이 `json` 이면 THE SYSTEM SHALL 최종 응답을 JSON 으로 파싱하고 `jsonSchema` 가 있으면 출력 스키마로 쓴다. (원본: ND-AG-08)
- REQ-AGENT-008 IF `responseFormat` 이 `json` 인데 최종 응답 파싱에 실패하면 THE SYSTEM SHALL 원문 문자열을 응답으로 둔다.
- REQ-AGENT-009 WHEN AI 에이전트가 응답을 만들면 THE SYSTEM SHALL 응답을 스트리밍으로 전달한다. (원본: ND-AG-09) (미구현)
- REQ-AGENT-010 WHEN 사용자가 실행 모드를 고르면 THE SYSTEM SHALL 단일 턴 또는 멀티턴으로 실행한다. (원본: ND-AG-11)
- REQ-AGENT-011 WHILE 멀티턴으로 실행 중인 동안 THE SYSTEM SHALL 워크플로우 실행을 멈추고 사용자와 대화한다. (원본: ND-AG-12)
- REQ-AGENT-012 WHEN 멀티턴 대화가 최대 턴 수에 닿거나 사용자가 종료하거나 LLM 이 조건 도구를 부르거나 LLM 에러가 나면 THE SYSTEM SHALL 대화를 끝내고 사유별 포트로 보낸다. (원본: ND-AG-13)
- REQ-AGENT-013 WHILE 멀티턴 사용자 응답을 기다리는 동안 THE SYSTEM SHALL 타임아웃 없이 기다린다.
- REQ-AGENT-014 WHILE 멀티턴 대화 중인 동안 THE SYSTEM SHALL 매 턴 도구 호출과 지식 저장소 검색을 허용한다. (원본: ND-AG-14)
- REQ-AGENT-015 WHEN 사용자가 조건을 정의하면 THE SYSTEM SHALL 라벨과 프롬프트 쌍으로 된 조건 목록을 저장한다. (원본: ND-AG-15)
- REQ-AGENT-016 WHEN 조건이 추가되면 THE SYSTEM SHALL 조건마다 독립된 출력 포트를 만든다. (원본: ND-AG-16)
- REQ-AGENT-017 WHEN LLM 을 부를 때 THE SYSTEM SHALL 조건마다 `cond_` 와 정제한 조건 id 로 이름 지은 조건 도구를 등록하고 조건 프롬프트를 도구 설명으로 쓴다. (원본: ND-AG-17)
- REQ-AGENT-018 WHEN LLM 이 조건 도구만 부르면 THE SYSTEM SHALL 노드를 끝내고 그 조건 포트로 보낸다. (원본: ND-AG-18)
- REQ-AGENT-019 WHEN LLM 이 한 응답에서 조건 도구와 비조건 도구를 함께 부르면 THE SYSTEM SHALL 비조건 도구를 먼저 실행하고 LLM 이 다시 판단하게 한다. (원본: ND-AG-18)
- REQ-AGENT-020 WHEN LLM 이 조건 도구 여러 개를 함께 부르면 THE SYSTEM SHALL 조건 목록에서 먼저 정의된 조건을 고른다. (원본: ND-AG-22)
- REQ-AGENT-021 WHEN 사용자가 조건을 추가·삭제·이름 변경·재정렬하면 THE SYSTEM SHALL 기존 조건의 포트 ID(UUID v4)를 바꾸지 않는다. (원본: ND-AG-20)
- REQ-AGENT-022 WHEN 모드가 단일 턴이면 THE SYSTEM SHALL 조건 포트와 `out`·`error` 포트를 두고 조건이 없으면 `out`·`error` 만 둔다. (원본: ND-AG-23)
- REQ-AGENT-023 WHEN 모드가 멀티턴이면 THE SYSTEM SHALL 조건 포트와 `user_ended`·`max_turns`·`error` 포트를 두고 조건이 없어도 `out` 은 두지 않는다. (원본: ND-AG-24)
- REQ-AGENT-024 IF LLM 오류·타임아웃·rate limit 이 나면 THE SYSTEM SHALL `error` 포트로 보낸다. (원본: ND-AG-19) (부분 구현)
- REQ-AGENT-025 WHEN 캔버스에 노드를 그리면 THE SYSTEM SHALL 조건 포트는 초록, 시스템 포트는 파랑, 에러 포트는 빨강으로 칠하고 조건이 있으면 두 영역 사이에 점선 구분자를 그린다. (원본: ND-AG-25)
- REQ-AGENT-026 WHEN `presentationTools` 에 도구를 등록하면 THE SYSTEM SHALL 그 type 의 `render_{type}` 표시 도구를 LLM 에 노출한다. (원본: ND-AG-26) (부분 구현)
- REQ-AGENT-027 IF `presentationTools` 가 비어 있으면 THE SYSTEM SHALL 표시 도구를 노출하지 않는다.
- REQ-AGENT-028 IF 표시 도구 페이로드가 스키마나 1MB 상한을 어기면 THE SYSTEM SHALL `{error: 'INVALID_PAYLOAD', issues}` 를 돌려 같은 턴에서 한 번 더 시도하게 한다.
- REQ-AGENT-029 IF 재시도한 표시 도구 페이로드도 스키마를 어기면 THE SYSTEM SHALL 그 호출을 버리고 `meta.presentationSchemaViolations[]` 에 쌓으며 `error` 포트로 보내지 않는다.
- REQ-AGENT-030 IF 단일 턴에서 LLM 이 `render_form` 을 부르면 THE SYSTEM SHALL 스키마 위반과 같이 한 번 재시도 후 버린다.
- REQ-AGENT-031 WHEN 사용자가 `render_form` 폼을 제출하면 THE SYSTEM SHALL 제출 값과 재호출 금지 안내를 tool_result 에 담아 LLM 을 다시 부른다.
- REQ-AGENT-032 IF 폼 제출 데이터가 10KB 를 넘으면 THE SYSTEM SHALL 문자열 필드를 고르게 잘라 `...<truncated>` 를 붙이고 `formDataTruncation` 메타를 싣는다.
- REQ-AGENT-033 IF 폼이 활성인 동안 사용자가 일반 메시지를 보내면 THE SYSTEM SHALL 그 폼 호출의 tool_result 를 `{type:'cancelled', reason:'user_sent_message_instead'}` 로 채우고 메시지를 일반 사용자 턴으로 처리한다.
- REQ-AGENT-034 IF 폼 제출이 들어왔는데 대기 중인 폼 호출(`pendingFormToolCall`)이 없으면 THE SYSTEM SHALL 제출 데이터를 일반 사용자 메시지로 넣고 경고 로그를 남긴다.
- REQ-AGENT-035 WHEN LLM 이 도구를 부르면 THE SYSTEM SHALL 호출을 조건·지식 저장소·MCP·표시·일반 도구로 분류한다.
- REQ-AGENT-036 WHEN 한 응답에 지식 저장소·MCP·표시 전용 도구 호출이 여러 개 있으면 THE SYSTEM SHALL 병렬로 실행하고 결과를 결정적 순서로 쌓는다.
- REQ-AGENT-037 IF 지식 저장소나 MCP 서버 호출 하나가 실패하면 THE SYSTEM SHALL 실패를 진단 메타에 기록하고 대화를 계속한다.
- REQ-AGENT-038 IF 한 배치의 도구 호출이 남은 도구 호출 한도를 넘으면 THE SYSTEM SHALL 넘는 호출에 `tool_call_budget_exceeded` tool_result 를 돌려준다.
- REQ-AGENT-039 IF LLM 이 일반 도구로 분류되는 호출을 하면 THE SYSTEM SHALL 도구 미연결을 알리는 `tool_call_not_implemented` 를 돌려준다. (미구현)
- REQ-AGENT-040 WHEN 도구 정의를 만든 직후 THE SYSTEM SHALL 도구 정의 직렬화 크기와 개수를 예산과 비교한다.
- REQ-AGENT-041 IF 도구 정의 크기가 hard 예산을 넘거나 개수가 상한을 넘으면 THE SYSTEM SHALL LLM 을 부르기 전에 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 로 `error` 포트에 보낸다.
- REQ-AGENT-042 IF 도구 정의 크기가 soft 예산만 넘으면 THE SYSTEM SHALL 경고 로그만 남기고 실행을 계속한다.
- REQ-AGENT-043 WHEN 워크플로우를 저장할 때 도구 정의 크기 추정치가 예산을 넘으면 THE SYSTEM SHALL `ai_agent:tool-payload-budget` 그래프 경고를 낸다.
- REQ-AGENT-044 IF `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 이고 저장 시 추정치가 hard 예산을 넘으면 THE SYSTEM SHALL 저장을 `GRAPH_VALIDATION_FAILED` 로 막는다.
- REQ-AGENT-045 WHEN 멀티턴 노드에 처음 들어오면 THE SYSTEM SHALL LLM 을 부르지 않고 바로 입력 대기로 들어간다.
- REQ-AGENT-046 WHEN 멀티턴 턴이 종료 조건 없이 끝나면 THE SYSTEM SHALL 누적 대화를 갱신하고 다시 입력 대기로 들어간다.
- REQ-AGENT-047 WHEN 사용자가 메모리 전략을 고르면 THE SYSTEM SHALL `manual`·`summary_buffer`·`persistent` 중 하나를 적용하고 기본값은 `manual` 이다. (원본: ND-AG-27) (부분 구현)
- REQ-AGENT-048 WHEN 메모리 전략이 `summary_buffer`·`persistent` 이고 working-memory 추정 토큰이 `memoryTokenBudget` 을 넘으면 THE SYSTEM SHALL 오래된 턴부터 롤링 요약으로 압축한다. (원본: ND-AG-28) (부분 구현)
- REQ-AGENT-049 WHILE 토큰 예산 임계치에 닿지 않은 동안 THE SYSTEM SHALL 롤링 요약을 다시 만들지 않는다. (원본: ND-AG-28)
- REQ-AGENT-050 IF `summaryModelConfigId` 가 비어 있으면 THE SYSTEM SHALL 요약 LLM 호출에 노드의 main 모델 설정을 쓴다. (원본: ND-AG-28)
- REQ-AGENT-051 WHEN 메모리 전략이 `persistent` 면 THE SYSTEM SHALL LLM 호출 전에 에이전트 메모리를 동기로 회수하고 턴 경계에서 메모리 추출을 비동기로 넣는다. (원본: ND-AG-29) (부분 구현)
- REQ-AGENT-052 WHEN 멀티턴 롤링 요약이 오래된 교환을 새로 덮으면 THE SYSTEM SHALL 다음 턴 messages 에서 그 교환을 `user` 메시지 경계에서 지운다.
- REQ-AGENT-053 WHEN 메모리 전략이 `manual` 이 아니면 THE SYSTEM SHALL `meta.memory` 에 전략·요약 여부·회수 수·예산 사용량을 싣는다. (원본: ND-AG-30) (부분 구현)
- REQ-AGENT-054 WHEN 턴 응답을 만드는 LLM `chat` 을 부르면(단일 턴과 멀티턴 재개의 첫 호출과 도구 루프 호출) THE SYSTEM SHALL 호출마다 `AI_AGENT_LLM_CALL_TIMEOUT_MS`(기본 10분) 앱 레벨 타임아웃을 건다.
- REQ-AGENT-055 IF 조건이 검증 규칙(최대 20개, id·label·prompt 필수, prompt 2,000자 이하, 예약 포트 이름 금지)을 어기면 THE SYSTEM SHALL 설정을 거부한다.

저장 때의 도구 정의 크기 추정치(REQ-AGENT-043 · REQ-AGENT-044)는 `mcpServers` 가운데 실행 시점과 같은 [개인 통합 사용 판정](../CLE-INT/CLE-INT-MANAGE.md#개인-통합-사용-판정)을 통과한 서버만 센다. 세는 범위 전체는 [도구 정의 크기 예산](CLE-NODE-AGENT-TOOLS.md#도구-정의-크기-예산) 의 저장 시점 경고에 있다.

## 하위 문서

- [AI 에이전트 노드 — 설정과 포트](CLE-NODE-AGENT-CONFIG.md): 설정 필드, ConditionDef · PresentationToolDef 구조, 설정 화면, 입출력 포트와 포트 시각 구분, 캔버스 요약. 요구사항: REQ-AGENT-002, REQ-AGENT-003, REQ-AGENT-004, REQ-AGENT-010, REQ-AGENT-016, REQ-AGENT-021, REQ-AGENT-022, REQ-AGENT-023, REQ-AGENT-025
- [AI 에이전트 노드 — 도구와 조건](CLE-NODE-AGENT-TOOLS.md): 도구 이름 규칙, 도구 호출 분류, 표시 도구, 도구 정의 크기 예산, 조건 도구 등록과 호출 처리. 요구사항: REQ-AGENT-005, REQ-AGENT-015, REQ-AGENT-017, REQ-AGENT-018, REQ-AGENT-019, REQ-AGENT-020, REQ-AGENT-026, REQ-AGENT-027, REQ-AGENT-028, REQ-AGENT-029, REQ-AGENT-035, REQ-AGENT-039, REQ-AGENT-040, REQ-AGENT-041, REQ-AGENT-042, REQ-AGENT-043, REQ-AGENT-044
- [AI 에이전트 노드 — 실행 로직](CLE-NODE-AGENT-EXEC.md): 단일 턴 · 멀티턴 실행 순서, 메모리 전략 적용, `render_form` 대기 · 제출 · 우회, dry-run 재실행의 도구 처리. 요구사항: REQ-AGENT-001, REQ-AGENT-006, REQ-AGENT-007, REQ-AGENT-008, REQ-AGENT-009, REQ-AGENT-011, REQ-AGENT-012, REQ-AGENT-013, REQ-AGENT-014, REQ-AGENT-030, REQ-AGENT-031, REQ-AGENT-032, REQ-AGENT-033, REQ-AGENT-034, REQ-AGENT-036, REQ-AGENT-037, REQ-AGENT-038, REQ-AGENT-045, REQ-AGENT-046, REQ-AGENT-047, REQ-AGENT-048, REQ-AGENT-049, REQ-AGENT-050, REQ-AGENT-051, REQ-AGENT-052, REQ-AGENT-053
- [AI 에이전트 노드 — 에러와 타임아웃](CLE-NODE-AGENT-ERROR.md): 단일 턴의 `error` 포트 범위, LLM 호출 타임아웃, 진단 메타 포함 조건, 에러 코드와 재시도 분류, 실행 전 설정 검증. 요구사항: REQ-AGENT-024, REQ-AGENT-054, REQ-AGENT-055

### 다른 문서가 링크하는 절

#### 도구

→ [도구와 조건](CLE-NODE-AGENT-TOOLS.md#도구)

#### 도구 이름 규칙

→ [도구와 조건](CLE-NODE-AGENT-TOOLS.md#도구-이름-규칙)

#### 도구 호출 분류

→ [도구와 조건](CLE-NODE-AGENT-TOOLS.md#도구-호출-분류)

#### 도구 정의 크기 예산

→ [도구와 조건](CLE-NODE-AGENT-TOOLS.md#도구-정의-크기-예산)

#### 출력 포트

→ [설정과 포트](CLE-NODE-AGENT-CONFIG.md#출력-포트). 단일 턴의 `error` 포트 범위는 [AI 에이전트 노드 — 에러와 타임아웃](CLE-NODE-AGENT-ERROR.md#단일-턴의-error-포트) 에 있다.

#### 단일 턴

→ [실행 로직](CLE-NODE-AGENT-EXEC.md#단일-턴)

#### 멀티턴

→ [실행 로직](CLE-NODE-AGENT-EXEC.md#멀티턴)

#### LLM 호출 타임아웃

→ [에러와 타임아웃](CLE-NODE-AGENT-ERROR.md#llm-호출-타임아웃)

#### 에러 코드

→ [에러와 타임아웃](CLE-NODE-AGENT-ERROR.md#에러-코드)

## 미결 사항

- **조건 id 예약어 집합**: 조건 id 검증은 `out`·`in`·`error`·`user_ended`·`max_turns` 다섯 개만 막는다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 6 의 예약어는 `out`·`error`·`default`·`done`·`user_ended`·`max_turns`·`completed`·`fallback`·`continue` 아홉 개이고 `in` 은 없다. 텍스트 분류기는 아홉 개를 백엔드 스키마에서, Switch 는 세 개만 막는다. 조건 id 는 UUID v4 라 충돌 가능성은 낮다. 규약 집합에 맞출지, UUID 발급 예외 근거를 적을지 결정 필요.
- **`execution.submit_form` 거부와 fallback**: [멀티턴](CLE-NODE-AGENT-EXEC.md#멀티턴) 2.a 는 대기 중인 폼 호출이 없거나 `toolCallId` 가 맞지 않으면 거부한다고 적는다. 2.c.fallback 은 `render_form` 호출이 없는 턴에 `submit_form` 이 직접 오는 경우를 예로 들며 일반 메시지로 넣는다고 적는다. 현재 핸들러(`processMultiTurnMessage`)는 대기 중인 폼 호출이 없으면 fallback 한다. 거부는 명령 검증 계층, fallback 은 경합 대비로 나눌지, 하나로 정리할지 결정 필요.
- 인증 실패 재시도 분류, 포트 type 표기, 캔버스 요약 표시 도구 세그먼트는 [AI 노드 공통](CLE-NODE-AI-COMMON.md) 미결 사항에서 다룬다.
- **dry-run 재실행의 도구 목록 구성 단계**: [단일 턴](CLE-NODE-AGENT-EXEC.md#단일-턴) 9.d.iii 의 부수효과 판정 밖에 있는 도구 목록 구성(`buildTools`) 단계를 판정 범위에 넣을지는 [MCP 클라이언트 미결 사항](../CLE-INT/CLE-INT-MCP.md#미결-사항) 에서 다룬다(CLE-T-8B66BK).
- **dry-run 재실행의 메모리 추출**: `persistent` 전략의 메모리 추출(단일 턴 8단계)은 dry-run 여부를 보지 않는다. 현재 구현은 dry-run 재실행에서도 추출한 사실·선호를 `agent_memory` 에 저장한다(`AiMemoryManager.scheduleMemoryExtraction` 과 공유 헬퍼 `scheduleMemoryExtraction` 에 `isDryRun` 확인이 없다). `memoryKey` 를 주면 이 기록은 실행을 넘어 이후 실행의 회수에 쓰인다. 저장과 회수 규칙의 기준 문서는 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) 다. dry-run 에서 추출을 막을지 정의가 없어 [재실행 미결 사항](../CLE-EXEC/CLE-EXEC-RERUN.md#미결-사항) 으로 넘긴다. 담당 작업은 CLE-T-C9GF9F 다.
- 추출 기준점 저장 키 경로는 [에이전트 메모리 미결 사항](../CLE-AI/CLE-AI-MEMORY.md#미결-사항) 에서 다룬다.
- **실패하거나 취소된 단일 턴이 남긴 항목**: [대화 스레드 §미결 사항](../CLE-IX/CLE-IX-THREAD.md#미결-사항) 이 맡는다(단일 턴 11단계).

## 구현 위치

- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (facade)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (턴 실행)
- `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` (도구 호출 분류)
- `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` (자동 메모리 전략)
- `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts`, `tool-payload-save-warning.ts` (도구 정의 크기 예산)
- `codebase/backend/src/nodes/ai/ai-agent/llm-call-timeout.ts`
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`, `ai-agent.component.ts`
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/*.ts`
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/dry-run-tool-result.ts` (dry-run 재실행에서 부수효과 도구에 돌려주는 모의 응답)
- `codebase/backend/src/nodes/core/dry-run.util.ts` (dry-run 여부 `isDryRun` 과 Cafe24 · MakeShop 부수효과 판정 `isDryRunMockedOperation`)
- `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts`, `agent-memory-schema.ts`
- `codebase/backend/src/nodes/ai/shared/llm-error-payload.ts` (단일 턴 · 멀티턴 공유 LLM 에러 분류)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (멀티턴 park·재개, 에러 종결)
- `codebase/backend/src/shared/llm-tracing/llm-call-record.ts`

진행 중 작업은 NERV Task 로 추적한다.

## Rationale

주제별 결정의 근거는 각 하위 문서 끝의 Rationale 에 있다. 이 절은 노드 전체에 걸치는 결정만 적는다.

### 도구 연결 입력 경로 제거

다른 노드를 캔버스 도구 영역에 끌어다 도구로 등록하던 입력 경로(`toolNodeIds`·`toolOverrides`, 일반 도구 `tool_*` 이름 규칙, 도구 영역 캔버스 UX)를 설정 스키마에서 제거했다. 새 설계가 정해질 때까지 비활성이다. 원본 요구사항 ND-AG-06·ND-AG-10·ND-AG-21 은 이 결정으로 효력이 없다.

### 시스템 컨텍스트 접두

필드와 결정 근거는 [AI 노드 공통](CLE-NODE-AI-COMMON.md) 에 있다. 이 노드는 설정 표, 실행 로직, 설정 에코 세 곳만 맞췄고 Cafe24 도구 description 자동 suffix 와 한 묶음으로 결정했다.

### Anthropic 모델에는 temperature 를 보내지 않는다 (2026-11-12)

Anthropic 예외를 REQ-AGENT-004 에 둔 것은 Anthropic API 버전 `2026-10-21` 이 Messages 요청에 `temperature` 가 있으면 값과 모델에 상관없이 400 으로 거절하기 때문이다. 2026-11-12 사용자가 Anthropic 요청에서 `temperature` 를 빼기로 정했다. 자세한 근거와 기각한 대안은 [LLM 클라이언트 Rationale](../CLE-AI/CLE-AI-LLM.md#anthropic-에-샘플링-파라미터를-보내지-않는다-2026-11-12) 에 있다(NERV Task `CLE-T-GKZPKY`).

### `render_form` 제출 뒤 같은 폼 재호출을 막은 방법

→ [실행 로직](CLE-NODE-AGENT-EXEC.md#render_form-제출-뒤-같은-폼-재호출을-막은-방법)

### 단일 턴 롤링 요약 실패도 `error` 포트로 보낸 이유 (2026-11-05)

→ [에러와 타임아웃](CLE-NODE-AGENT-ERROR.md#단일-턴-롤링-요약-실패도-error-포트로-보낸-이유-2026-11-05)
