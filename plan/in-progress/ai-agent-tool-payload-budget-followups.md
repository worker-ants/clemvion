---
worktree: (unstarted)
started: 2026-07-14
owner: developer
---

# AI Agent 도구 payload 예산 가드레일 — 후속

> 작성일: 2026-07-14
> 선행: [`ai-agent-tool-payload-budget-guardrail.md`](ai-agent-tool-payload-budget-guardrail.md) (런타임 fail-fast 구현·머지)
> 선행 spec: `spec/4-nodes/3-ai/1-ai-agent.md` §4.2·§10·§12.15, `spec/5-system/11-mcp-client.md` §5.8, `spec/conventions/cross-node-warning-rules.md` §5·§8

## 배경

선행 PR 이 **런타임 fail-fast**(`buildTools` 직후 `TOOL_DEFINITION_PAYLOAD_EXCEEDED`)로 도구 정의 payload 팽창의 실질 안전망을 구현했다. spec 이 함께 정의한 아래 두 surface 는 cross-module 배선·별도 설계가 필요해 본 후속으로 분리한다.

## 항목

### A. config-time 저장 경고 (backend-only graph warning)

spec: ai-agent §4.2 "저장 시점 경고" / §10 config 경고 계약 / cross-node-warning-rules §5(backend-only 예외)·§8(`ai_agent:tool-payload-budget`).

- `WorkflowsService` 에 Integration 접근(Repository 또는 IntegrationsService) 주입 — 현재 미주입(모듈 배선 필요).
- backend-only async 평가 `evaluateAiAgentToolPayloadWarnings(nodes, workspaceId): Promise<GraphWarningRuleResult[]>`:
  - 각 ai_agent 노드의 `mcpServers`(cafe24/makeshop 정적 카탈로그)·`presentationTools` 로부터 config-time 도구셋 재현 → 선행 PR 의 `estimateAgentToolPayload` 재사용. generic MCP(`service_type='mcp'`)는 live connect 필요라 best-effort skip.
  - Cafe24/Makeshop 정적 도구 재현: `Cafe24McpToolProvider`/`MakeshopMcpToolProvider` 의 operation→ToolDef 매핑을 pure 함수로 추출(세션 state 없이) 후 config-time·runtime 공유.
  - soft/hard 초과 시 `GraphWarningRuleResult`(rule id `ai_agent:tool-payload-budget`, severity `warning`). `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 면 hard 초과 severity `error`.
- **surface**: `getGraphWarnings`(서버 권위 조회 endpoint)가 결과 배열에 append. **block**: `saveCanvas` 가 severity error 시 기존 `GRAPH_VALIDATION_FAILED` 로 400 (guard ①).
- **i18n**: `GRAPH_WARNING_KO['ai_agent:tool-payload-budget']` KO 매핑 + `backend-labels.test.ts` backend-only ruleId 명시 목록 등록(shared-package 밖이라 P3-C-1 자동 스캔 사각지대 — 수동 등록으로 빌드 시 KO 누락 방지).
- spec frontmatter: 구현 완료 시 cross-node-warning-rules `status: partial → implemented`, 본 plan 을 pending_plans 에서 제거.

### B. resume 턴 LLM 호출 timeoutMs + signal 배선

- `processMultiTurnMessage` chat 호출(`ai-turn-executor.ts:2624`/`:2765`)에 app-level `timeoutMs`(정상 장기 생성 regression 없는 신중한 default — env 노출) + abortSignal.
- resume 경로는 `ExecutionContext`(abortSignal 보유)를 안 받고 `state` 만 받으므로, orchestrator→state(또는 options)로 abortSignal plumbing 배선 필요.
- single-turn(`:1533`)도 현재 `timeoutMs` 부재 → 함께 대칭화.
- 근거: 런타임 payload 가드가 근본 원인을 막지만, 그 외 사유(네트워크·모델 지연)의 hang 에 대한 defense-in-depth.

## Rationale

선행 PR 을 런타임 가드에 집중시켜 리뷰 가능한 크기로 유지하고, config-time(cross-module) 과 timeout(signal plumbing) 은 각자 독립 설계·리뷰가 필요해 분리. 런타임 fail-fast 가 실제 안전망이므로 사용자 영향(6분 hang) 은 선행 PR 로 이미 해소된다.
