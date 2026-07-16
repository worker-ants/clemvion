# 신규 식별자 충돌 검토 — spec/4-nodes/3-ai/ (impl-done)

## 검토 범위 확인

target 은 `spec/4-nodes/3-ai/` 전체이나, diff-base(`origin/main`) 대비 이번 PR("ai-agent-tool-payload-followups")이 실제로 새로 도입하는 식별자는 다음으로 좁혀진다 (선행 PR #948 "도구 정의 payload 예산 가드레일"에서 이미 도입된 `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES`/`_HARD_BYTES`/`AI_AGENT_TOOL_COUNT_MAX`/`TOOL_DEFINITION_PAYLOAD_EXCEEDED`/`estimateAgentToolPayload` 등은 재사용이지 신규 도입이 아님):

- **항목 A (config-time 저장 경고)**: 함수 `evaluateAiAgentToolPayloadWarnings`, `toolBudgetStrictSave`, `buildCafe24ToolDefsForIntegration`, `buildMakeshopToolDefsForIntegration`; 파일 `tool-payload-save-warning.ts`; i18n 키 `GRAPH_WARNING_KO['ai_agent:tool-payload-budget']`; `cross-node-warning-rules.md` status `partial→implemented` 승격 (rule id `ai_agent:tool-payload-budget` 자체는 선행 PR 스펙 draft 에서 이미 등재돼 있었음 — 신규 ID 아님).
- **항목 B (resume timeoutMs+signal)**: 환경변수 `AI_AGENT_LLM_CALL_TIMEOUT_MS`; 파일 `llm-call-timeout.ts`; 인터페이스 필드 `ResumableMessageOptions.signal`.

각 식별자를 실제 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003`)의 spec + codebase 전체에 대해 `git grep` 으로 교차 검증했다.

## 발견사항

검증 결과, **CRITICAL/WARNING 급 충돌 없음**. 확인한 항목별 근거:

- **환경변수 `AI_AGENT_LLM_CALL_TIMEOUT_MS`**: `codebase/backend/.env.example` 의 기존 `*_TIMEOUT_MS` 계열(`DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`, `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`, `MCP_CONNECT_TIMEOUT_MS`, `MCP_LIST_TIMEOUT_MS`, `MCP_CALL_TIMEOUT_MS`)와 이름 중복 없음. 도입처(`llm-call-timeout.ts`) 1곳이 유일한 정의.
- **환경변수 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`**: `.env.example` 내 다른 `_STRICT_` 계열 변수 없음 — 유일.
- **에러코드 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` vs 기존 `MAX_TOOL_CALLS_EXCEEDED`/`tool_call_budget_exceeded`(호출 횟수 축)**: spec §10·§12.15 Rationale 에 "같은 노드에 이미 'tool budget'이 호출 횟수 축으로 존재하므로 정의(스키마) payload 축임을 이름에서 구분" 이라는 명시적 개명 근거(구 안 `AI_TOOL_BUDGET_EXCEEDED`→현재 안, consistency C3)가 있고 실제로 서로 다른 실패 지점(pre-flight vs runtime truncate)이라 의미 충돌 없음.
- **`AI_AGENT_LLM_CALL_TIMEOUT_MS`(§12.16, ai_agent 전용 app-level timeout) vs 기존 `LLM_TIMEOUT` 에러코드(`codebase/backend/src/nodes/core/error-codes.ts:42`)**: spec 이 "`LLM_TIMEOUT` 은 Workflow AI Assistant 전용 taxonomy 로 ai_agent 노드 실행 경로는 사용하지 않는다"고 명시적으로 disambiguate — 실제로 ai_agent 타임아웃은 `LLM_CALL_FAILED`(retryable, network/timeout 분류)로 귀결되도록 설계돼 이름·의미 모두 충돌 없음.
- **경고 rule id `ai_agent:tool-payload-budget`**: `spec/conventions/cross-node-warning-rules.md` §8 에 이미 등재돼 있던 rule (선행 PR의 spec draft 단계에서 "Planned"로 먼저 기재, 본 PR 에서 구현 완료로 status 만 전진). 신규 ID 부여가 아니라 기존 예약 ID 의 구현 완료 처리 — 충돌 대상 아님. 코드(`tool-payload-save-warning.ts:44`, `backend-labels.ts:643`, `backend-labels.test.ts:304`, e2e spec `RULE_ID` 상수)와 spec 값이 정확히 일치.
- **endpoint `GET /workflows/:id/graph-warnings`(`getGraphWarnings`)**: 신규 endpoint 아님 — `cross-node-warning-rules.md`(§8 인용부), `spec/3-workflow-editor/2-edge.md`, `spec/data-flow/11-workflow.md` 에 이미 "조회 전용 보조 API"로 정의돼 있던 기존 endpoint 를 재사용(append)하는 것으로 정확히 서술됨. `POST /workflows/:id/save`(`saveCanvas`) 도 기존 저장 endpoint 재사용.
- **함수명 `evaluateAiAgentToolPayloadWarnings`**: 코드베이스 내 `evaluateGraphWarningRules`/`evaluateGraphWarningRulesForGraph`/`evaluateGraphCycleWarnings`(모두 `@workflow/graph-warning-rules` 계열, graph-level 순회)와 `evaluateWarnings`(`packages/node-summary`, 캔버스 요약 배지용 — 별개 서브시스템)가 있으나 접두사(`evaluateAiAgentToolPayload*`)가 명확히 구분되고 반환 타입(`Promise<GraphWarningRuleResult[]>`)도 기존 계약을 따르므로 혼동 소지 낮음. INFO 수준으로도 별도 조치 불요.
- **파일 `tool-payload-save-warning.ts` vs `tool-payload-budget.ts`**: 두 파일이 codebase 에 공존하며 역할이 명확히 분리(런타임 fail-fast SoT 는 `tool-payload-budget.ts`, config-time 저장 경고는 `tool-payload-save-warning.ts`). 이 분리 자체가 이전 회차 naming-collision checker 지적(plan 문서 각주: "naming-collision checker INFO 반영")을 수용한 결과로, 현재는 이미 해소된 상태 — 재지적 불요.
- **`buildCafe24ToolDefsForIntegration`/`buildMakeshopToolDefsForIntegration`**: 각각 `tool-providers/cafe24-mcp-tool-provider.ts`/`makeshop-mcp-tool-provider.ts` 에 1곳씩만 정의되고 provider 이름이 접두어로 붙어 있어 서로 충돌하지 않음.
- **`ResumableMessageOptions.signal`**: 기존 공유 인터페이스(`node-handler.interface.ts`)에 필드 추가. `source` 필드와 이름 충돌 없고, JSDoc 이 defense-in-depth 목적과 기존 `node-cancellation.md` gap 을 명확히 cross-link.

## 요약

이번 target(`spec/4-nodes/3-ai/`, 특히 ai-agent-tool-payload-followups PR 이 추가하는 부분)이 신규 도입하는 식별자(env var 1개, 함수 4개, 파일 2개, 인터페이스 필드 1개)를 워킹트리 spec+codebase 전역에서 grep 대조한 결과 기존 사용처와의 의미 충돌은 발견되지 않았다. 오히려 `TOOL_DEFINITION_PAYLOAD_EXCEEDED`(vs `MAX_TOOL_CALLS_EXCEEDED`) 개명 근거, `tool-payload-save-warning.ts`/`tool-payload-budget.ts` 파일 분리, `LLM_TIMEOUT`(Workflow AI Assistant) vs `AI_AGENT_LLM_CALL_TIMEOUT_MS`(ai_agent) 범위 disambiguation 등 이전 검토 라운드에서 지적된 잠재 충돌이 spec Rationale 에 명시적으로 해소돼 있어 명명 위생이 양호하다. 경고 rule id(`ai_agent:tool-payload-budget`)와 조회 endpoint(`GET /workflows/:id/graph-warnings`)는 신규가 아니라 선행 PR/기존 spec 이 이미 등록한 식별자의 재사용·status 전진이므로 충돌 검토 대상에서 제외했다.

## 위험도
NONE
