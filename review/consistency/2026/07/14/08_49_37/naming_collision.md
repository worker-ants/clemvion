# 신규 식별자 충돌 검토 — AI Agent 도구 정의 payload 예산 가드레일

대상: `plan/in-progress/ai-agent-tool-payload-budget-guardrail.md` (spec draft D1~D4)

## 발견사항

- **[CRITICAL]** 신규 에러코드 `AI_TOOL_BUDGET_EXCEEDED` 가 같은 노드·같은 실행 파일 안의 기존 "tool budget" 개념(도구 **호출 횟수** budget)과 이름·개념이 충돌
  - target 신규 식별자: `AI_TOOL_BUDGET_EXCEEDED` (D2, `spec/4-nodes/3-ai/1-ai-agent.md` §10 신규 행 — "도구 정의 직렬화 크기/개수" 초과, pre-LLM throw)
  - 기존 사용처:
    - `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:567` — `const TOOL_BUDGET_EXCEEDED_ERROR = 'tool_call_budget_exceeded';` (내부 tool_result 신호 상수명이 이미 `TOOL_BUDGET_EXCEEDED_...` 토큰 시퀀스를 사용)
    - `spec/4-nodes/3-ai/1-ai-agent.md:1102` — 예약 에러코드 `MAX_TOOL_CALLS_EXCEEDED` ("`maxToolCalls` 초과로 강제 종결을 결정한 경우. 현재 핸들러는 `tool_call_budget_exceeded` tool_result 로 회신만 하므로 발생하지 않음")
    - `spec/4-nodes/3-ai/1-ai-agent.md:383` — `maxToolCalls` 초과 시 truncate + `tool_call_budget_exceeded` tool_result 회신 흐름 (§6.1.g)
  - 상세: 기존 "tool budget" 계열 이름은 **한 turn 안의 도구 호출 횟수**(`maxToolCalls`, 조건/KB/MCP/표현/일반 합산) 축을 가리킨다. target 이 새로 붙이는 `AI_TOOL_BUDGET_EXCEEDED` 는 **LLM 요청에 실리는 도구 정의(schema) 자체의 직렬화 bytes/개수** 축으로, 완전히 다른 실패 지점(호출 전 vs 호출 중)·다른 해결법(도구 호출 줄이기 vs `enabledTools` allowlist 로 노출 도구 줄이기)이다. 두 축 모두 "tool" + "budget" + "exceeded" 토큰을 공유하고, 코드에는 이미 `TOOL_BUDGET_EXCEEDED_ERROR` 라는 상수가 존재하며, target Phase 2 가 바로 이 파일(`ai-turn-executor.ts`)의 resume 턴 경로(`:2624`/`:2765`)를 손대는 작업이라 구현 시점에 실제 식별자 재사용/오타 충돌 위험이 특히 높다. 더 심각한 것은, 이 사고 자체가 "provider 무관 응답 없음"의 **원인 오인**(도구 개수는 그대로인데 payload 만 팽창)에서 비롯됐는데, 새 에러코드 이름이 기존 "호출 횟수 초과" 코드와 헷갈리면 운영자가 다시 `maxToolCalls` 를 잘못 조정하는 동일한 오진을 반복할 수 있다.
  - 제안: 새 에러코드를 `AI_TOOL_DEFINITION_PAYLOAD_EXCEEDED` 또는 `AI_TOOL_SCHEMA_PAYLOAD_EXCEEDED` 처럼 "정의/스키마" 축임을 이름에서 바로 구분되게 개명 권고. 최소한 D2/§4.2 본문에 "`MAX_TOOL_CALLS_EXCEEDED`(도구 **호출** 횟수)와는 다른 축 — 도구 **정의** payload 크기" 라는 명시적 구분 문구를 추가.

- **[WARNING]** 신규 저장 API 응답 `warnings[]` 필드가 기존 `graphWarningRules` 저장-시점 경고 컨벤션과 같은 endpoint 위에서 중복/비통합 메커니즘을 형성
  - target 신규 식별자: 응답 `warnings[]` (D3, `PATCH /workflows/:id` · `POST /workflows/:id/save` 저장 시점 non-blocking 경고 — `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` 플래그로만 400 차단)
  - 기존 사용처: `spec/conventions/cross-node-warning-rules.md` (§4·§5) — 이 컨벤션이 이미 "workflow save endpoint 에서 severity `error`/`warning` 로 config-time 경고를 평가·반환"하는 **SoT 메커니즘**(`GraphWarningRuleResult { ruleId, severity, nodeId, message, params }`, `evaluateGraphWarningRulesForGraph`)을 정의하고 있고, `codebase/backend/src/modules/workflows/workflows.service.ts:428-433` (`saveCanvas` → `evaluateGraphWarnings`)가 이미 이 endpoint 를 정확히 그 3중 가드(①save endpoint ②frontend canvas ③runtime) 의 ①번 지점으로 쓰고 있다. 컨벤션 문서 §4 는 severity `warning` 이 "저장 통과 (로깅 / **response 에 포함**)" 이라고 명시 — 즉 이 endpoint 응답에 그래프 경고가 실릴 자리를 이미 예약해둔 상태다(현재 `saveCanvas` 실구현은 `{ workflow, nodes, edges }` 만 반환하고 warning 을 response 에 담는 부분은 아직 미구현 — spec 과 구현의 기존 gap).
  - 상세: `mcpServers`/`presentationTools` 로부터의 payload 추정은 "단일 노드(ai_agent) config 만으로 평가 가능하면 `warningRules` 우선"이라는 이 컨벤션 자체의 §2 "작성자 가이드" 기준에 정확히 부합하는 케이스처럼 보인다(그래프 전체 walk 불필요, 자기 노드 config 만 봄). 그런데 target 은 이 컨벤션을 전혀 참조하지 않고 `workflows.service` 에 별도 ad-hoc 검증 + 별도 응답 필드(`warnings[]`, shape 미정 — `ruleId`/`severity`/`params` 규약과 무관)를 신설한다. 두 메커니즘이 같은 endpoint(`POST /workflows/:id/save`)의 응답에 공존하게 되면 (a) "저장 시점 경고" 개념이 두 갈래로 나뉘어 프론트엔드/문서 어느 쪽이 SoT 인지 혼란, (b) 컨벤션 문서가 예약해 둔 것과 동일한 필드명(`warnings`)을 나중에 graph-warning 쪽이 실제로 채우게 되면 **문자 그대로 필드명 충돌**이 발생할 위험.
  - 제안: Phase 1 spec 갱신 시 `spec/conventions/cross-node-warning-rules.md` 를 검토해 (1) payload 예산 체크를 `graphWarningRules`(또는 단일 노드 `warningRules`, 단 async 카탈로그 조회가 필요하면 그 확장 필요성 자체를 컨벤션에 기록) 로 흡수할지, (2) 흡수하지 않는다면 왜 별도 메커니즘이 필요한지(예: async MCP 카탈로그 조회는 현재 두 DSL 모두 표현 불가) 를 D3 본문 또는 §12 Rationale 에 명시하고 응답 필드명을 `warnings`가 아닌 명확히 구분되는 이름(예: `toolPayloadWarnings`)으로 바꿔 향후 graph-warning 필드와의 이름 충돌을 예방.

- **[INFO]** AI Agent 노드 도메인에 "budget" 용어가 3중으로 사용되어 문서 전반의 구분 명확화 권고
  - target 신규 식별자: `AI_AGENT_TOOL_PAYLOAD_MAX_BYTES` / `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES` / `AI_AGENT_TOOL_COUNT_MAX` (D1 §4.2)
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md:55` `memoryTokenBudget` (working-memory 토큰 예산, 완전히 다른 기능), `spec/4-nodes/3-ai/1-ai-agent.md:383` `maxToolCalls`/tool-call budget (위 CRITICAL 항목과 동일 축)
  - 상세: 이름 자체의 직접 충돌은 없음(각각 `AI_AGENT_TOOL_*`, `memoryTokenBudget`, `maxToolCalls` 로 접두사가 다름 — 실제 grep 상 정확 일치하는 기존 정의 없음, 신규 도입 확인됨)이나, 같은 노드 스펙 문서 안에 "budget" 이 3가지 서로 다른 자원(도구 정의 payload bytes / 도구 호출 횟수 / working-memory 토큰)에 재사용되므로 §4.2 본문 및 §10 표에서 "이 budget 은 무엇에 대한 것인가"를 매번 명시적으로 부연할 것을 권고(이미 D1 본문은 "도구 정의 payload 예산"으로 qualifying 하고 있어 대체로 양호 — 최종 spec 반영 시 §10 표 행에도 동일 qualifying 문구 유지 필요).
  - 제안: D2 §10 표 행과 D3 config 경고 문구에도 "(호출 횟수 아님, 정의 payload 크기)" 같은 1회성 명시적 disambiguation 문구를 유지.

- **[INFO]** 전수 검색 결과 확인 — 직접적인 정확 일치 충돌 없음
  - 신규 env var(`AI_AGENT_TOOL_PAYLOAD_MAX_BYTES`, `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES`, `AI_AGENT_TOOL_COUNT_MAX`, `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`), 함수명(`estimateAgentToolPayload`), 섹션 번호(`ai-agent.md` §4.2 — 기존 최댓값 §4.1, `mcp-client.md` §5.8 — 기존 최댓값 §5.7)는 `spec/`·`codebase/`·`plan/in-progress/` 전체에서 grep 했을 때 기존 정의와의 정확 일치 재사용이 없음을 확인.
  - `PATCH /api/workflows/:id`·`POST /api/workflows/:id/save` 는 이미 존재하는 endpoint(각각 `spec/2-navigation/1-workflow-list.md:123`, `spec/3-workflow-editor/0-canvas.md:513`, `spec/3-workflow-editor/5-version-history.md:19`)이며 target 은 새 endpoint 를 만드는 것이 아니라 기존 endpoint 에 검증 로직을 추가하는 것 — endpoint 자체의 충돌은 아님(단, 응답 필드는 위 WARNING 참조).
  - `ToolDef` 타입(D1 estimator 시그니처가 재사용)·`AiTurnExecutor.buildTools`(런타임 판정 위치로 지목)는 모두 기존에 실제로 존재하는 정의(`spec/5-system/7-llm-client.md` §3.4, `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3421`)이며 target 은 이를 그대로 재사용하는 것으로 확인 — 신규 도입이 아니라 올바른 참조.

## 요약

새로 도입하는 env var·함수명·섹션 번호는 grep 전수 확인 결과 문자 그대로의 기존 정의 재사용은 없다. 다만 두 가지는 "새 식별자가 기존 사용처와 충돌"이라는 관점에서 실질적 위험이다: (1) 신규 에러코드 `AI_TOOL_BUDGET_EXCEEDED` 가 같은 AI Agent 노드·같은 실행 파일에 이미 존재하는 "tool budget"(호출 횟수) 계열 이름(`TOOL_BUDGET_EXCEEDED_ERROR`/`tool_call_budget_exceeded`/예약 `MAX_TOOL_CALLS_EXCEEDED`)과 토큰이 거의 동일해 서로 다른 실패 축(정의 payload 크기 vs 호출 횟수)을 헷갈리게 만들 소지가 크고, 이는 이번 장애 원인 오인을 재발시킬 수 있는 방향의 혼동이라 개명을 권고한다. (2) 신규 저장 API 응답 `warnings[]` 는 동일 endpoint 위에 이미 SoT 로 존재하는 `graphWarningRules`/`GraphWarningRuleResult` 저장-시점 경고 컨벤션을 참조하지 않고 별도 shape 로 신설되어, 개념적 중복과 향후 필드명 실충돌 가능성을 남긴다. 나머지 항목(용어 중복 3건, endpoint 재사용, 타입 재사용)은 정보성 확인 또는 경미한 명확화 권고 수준이다.

## 위험도

HIGH
