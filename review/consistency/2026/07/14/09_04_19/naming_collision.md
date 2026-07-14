# 신규 식별자 충돌 검토 — AI Agent 도구 정의 payload 예산 가드레일

대상: `plan/in-progress/ai-agent-tool-payload-budget-guardrail.md` (D1~D5 spec 변경 draft)

## 검토 방법

target 이 새로 도입하는 식별자를 전부 추출해 `spec/`, `plan/`, `codebase/` 전체에 대조했다.

- 에러코드: `TOOL_DEFINITION_PAYLOAD_EXCEEDED`
- ENV var: `AI_AGENT_TOOL_PAYLOAD_MAX_BYTES` / `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES` / `AI_AGENT_TOOL_COUNT_MAX` / `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`
- 함수/메서드: `estimateAgentToolPayload`, `evaluateAiAgentToolPayloadWarnings`
- rule id: `ai_agent:tool-payload-budget`
- spec 절 번호: ai-agent.md §4.2, mcp-client.md §5.8
- 재사용 선언 식별자(target 이 "기존 것 재사용"이라 주장하는 것들): `ToolDef`, `GraphWarningRuleResult`, `GRAPH_VALIDATION_FAILED`, `POST /workflows/:id/save`(`saveCanvas`), `AiTurnExecutor.buildTools`, `WorkflowsService.evaluateGraphWarnings`, `mcpServers[].enabledTools`(§5.6), `AiTurnOrchestrator.classifyLlmError`, `shared/agent-memory-injection.ts`

## 발견사항

- **[WARNING]** `ai_agent:tool-payload-budget` 을 cross-node-warning-rules.md §8 레지스트리에 등재하지만, 그 rule 은 §8 의 기존 모든 행이 만족하는 "shared package 멤버십" 계약을 깨고 있고 target 문서 어디에도 이로 인한 자동 가드 사각지대 보정 작업이 없다.
  - target 신규 식별자: `ai_agent:tool-payload-budget` (D5, `cross-node-warning-rules.md` §8 신규 행)
  - 기존 사용처:
    - `spec/conventions/cross-node-warning-rules.md:58-76` (§3 타입 정의) — `GraphWarningRule.evaluate` 는 **동기·pure** 함수로 정의되고 `codebase/packages/graph-warning-rules/` (shared package, frontend+backend SSOT) 에 거주한다.
    - `spec/conventions/cross-node-warning-rules.md:124-130` (§8 현재 등재된 rule) — 기존 3행 `parallel:nested-depth-exceeded` / `parallel:nested-concurrency-cap` (`codebase/packages/graph-warning-rules/src/rules/parallel.ts`) / `graph:unescapable-cycle` (동일 패키지, graph-level 함수) 은 예외 없이 이 shared package 소속이다.
    - `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts:300-317` (Principle 3-C, P3-C-1 자동 가드) — `ruleIds` 수집 로직이 `GRAPH_WARNING_RULES_BY_TYPE` export + 하드코딩된 graph-level 상수 배열(`UNESCAPABLE_CYCLE_RULE_ID`)만 스캔한다. 둘 다 shared package 산출물에서만 파생된다.
  - 상세: target 은 C2 결정으로 이 rule 을 **backend-only·async**(`WorkflowsService` 가 `evaluateGraphWarnings` 직후 ad hoc append)로 명시 확정했고, 그 이유(async 통합 scope 조회는 pure 함수로 표현 불가)도 타당하다. 문제는 결과 **shape**(`GraphWarningRuleResult`)만 재사용하고 **등재 메커니즘**(shared package 소속 → `GRAPH_WARNING_RULES_BY_TYPE`/graph-level export 를 통한 자동 discovery)은 재사용하지 않는데, D5 는 이 rule 을 마치 기존 §8 행과 동일한 종류인 것처럼 같은 테이블 같은 형식으로 추가한다는 점이다. 결과적으로 `ai_agent:tool-payload-budget` 은 `GRAPH_WARNING_RULES_BY_TYPE` 에도, 현재 하드코딩된 graph-level 배열에도 잡히지 않으므로 P3-C-1 가드가 이 ruleId 를 절대 스캔하지 못한다 — Phase 2 구현자가 `backend-labels.test.ts` 를 **수동으로** 알아서 편집해 이 ruleId 를 추가하지 않는 한, `GraphWarningRuleResult.message` 의 한국어 매핑 누락이 빌드를 통과한 채 조용히 방치된다. 이는 Principle 3-C 의 자동 가드가 막으려는 정확히 그 drift 케이스다. 또한 severity 도 기존 rule 들처럼 고정 필드가 아니라 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` env 로 warning→error 동적 승격되는 신규 패턴이라, 이 rule 은 §8 의 기존 두 카테고리(per-type sync / graph-level pure) 어디에도 정확히 속하지 않는 **세 번째 하위 종**이 된다.
  - target 의 Phase 1 작업 목록(§8 문서화)과 Phase 2 작업 목록(4번, 구현) 어디에도 `backend-labels.test.ts` 의 P3-C-1 배열 갱신이나 `GRAPH_WARNING_KO` 매핑 추가가 언급되지 않는다.
  - 제안: (a) `cross-node-warning-rules.md` §3 또는 §8 테이블에 "backend-only(비-shared-package) rule" 여부를 나타내는 컬럼/각주를 추가해 이 rule 이 기존 두 카테고리와 다른 메커니즘임을 명문화한다. (b) target 의 Phase 1 작업 3(§8 등재)과 Phase 2 작업 4(구현) 에 `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` 의 ruleId 목록 + `GRAPH_WARNING_KO['ai_agent:tool-payload-budget']` 매핑 추가를 명시적 sub-task 로 넣는다 — 그렇지 않으면 이 신규 rule 은 P3-C-1 가드의 영구 사각지대로 남는다.

## 확인 완료 (충돌 없음 — 근거만 기록)

아래는 충돌 가능성이 있어 보였으나 실측 결과 문제 없음으로 확인된 항목들이다 (재작업 불필요, 기록용):

- **에러코드**: `TOOL_DEFINITION_PAYLOAD_EXCEEDED` — spec/codebase 어디에도 기존 사용 없음. 기존 `MAX_TOOL_CALLS_EXCEEDED`(예약, §10) / `tool_call_budget_exceeded`(`ai-turn-executor.ts:567`, 도구 **호출 횟수** 축) 와 문자열·의미 모두 구분됨 — target 이 C3 로 의도한 대로 정합.
- **ENV var**: `AI_AGENT_TOOL_PAYLOAD_MAX_BYTES` / `_HARD_BYTES` / `AI_AGENT_TOOL_COUNT_MAX` / `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` — `codebase/backend/.env.example` 에 `AI_AGENT_` prefix 선례 없음(신규 namespace, 최초 사용). `MCP_MAX_RESPONSE_BYTES`(기존, 호출당 응답 크기 cap) 와는 대상이 달라(도구 **정의** payload 총합 vs 개별 응답) 의미 충돌 없음.
- **타입 재사용**: `ToolDef` — `codebase/backend/src/modules/llm/interfaces/llm-client.interface.ts:22` 의 기존 정의(`{name, description, parameters}`)를 그대로 재사용. 의미 일치.
- **rule id 네임스페이스 선례**: `ai_agent:` prefix 를 mini-DSL 단일 노드 rule(`ai_agent:no-llm-provider` 등, `ai-agent.schema.ts:708-723`)과 cross-node rule 이 공유하는 것 자체는 기존에도 `parallel:` prefix 가 mini-DSL(`parallel:branch-count-out-of-range`, `parallel.schema.ts:179`)과 cross-node(`parallel:nested-depth-exceeded` 등)에 동시에 쓰이는 선례가 있어 이례적이지 않음.
- **API endpoint**: `POST /workflows/:id/save`(`saveCanvas`) — `workflows.controller.ts:429` 에 기존 구현된 endpoint 재사용(신규 endpoint 아님). C1 정정이 정확히 반영됨.
- **함수/필드 재사용**: `AiTurnExecutor.buildTools`(`ai-turn-executor.ts:3421`), `WorkflowsService.evaluateGraphWarnings`(`workflows.service.ts:586`), `AiTurnOrchestrator.classifyLlmError`(기존 §10 문서화됨), `mcpServers[].enabledTools`(mcp-client.md §5.6 기존), `presentationTools`/`mcpServers` config 필드(ai-agent.md §1 기존) — 전부 실제 코드/spec 과 일치.
- **`perProvider[].key`**: `AgentToolProvider.key`(`agent-tool-provider.interface.ts:21`, "Provider 식별자 — 로깅/디버깅용")를 그대로 재사용하는 명명 — `kb`/`mcp`/`cafe24-mcp`/`makeshop-mcp`/`render` 기존 값과 정합.
- **spec 절 번호**: ai-agent.md 는 현재 §4 아래 §4.1 만 존재(§4.2 비어있음) → 신규 §4.2 충돌 없음. mcp-client.md 는 §5 아래 §5.1~§5.7 까지 존재 → 신규 §5.8 이 자연스러운 다음 번호.
- **파일 경로**: `plan/in-progress/ai-agent-tool-payload-budget-guardrail.md` — 기존 `plan/in-progress/ai-agent-tool-connection-rewrite.md` 와 구분되는 이름, 컨벤션(kebab-case, 서술적) 준수.
- **이벤트/메시지명**: 신규 webhook/queue/SSE 이벤트 없음 (해당 없음).

## 요약

target 이 새로 도입하는 식별자(에러코드·ENV var·함수명·spec 절 번호·파일 경로)는 spec/·plan/·codebase/ 전수 대조 결과 리터럴 충돌이 전혀 없으며, "기존 것을 재사용한다"고 주장하는 식별자(`ToolDef`, `GRAPH_VALIDATION_FAILED`, `POST /workflows/:id/save` 등) 역시 실제 코드·spec 의 정의와 정확히 일치해 오용이 없다. 유일한 지적 사항은 `ai_agent:tool-payload-budget` rule id 를 `cross-node-warning-rules.md §8` 레지스트리에 등재하면서, 그 테이블의 기존 모든 행이 암묵적으로 만족하던 "shared package(`@workflow/graph-warning-rules`) 소속 → 자동 i18n parity 가드(P3-C-1) 스캔 대상" 계약을 이 rule 만 깨뜨리는데도 target 의 작업 목록에 그 자동 가드(`backend-labels.test.ts`) 보정이 빠져 있다는 점이다 — 리터럴 이름 충돌은 아니지만 "동일 레지스트리·다른 메커니즘"이 향후 유지보수자를 혼란시키고 KO 매핑 누락을 조용히 통과시킬 수 있는 구조적 허점이다.

## 위험도
LOW
