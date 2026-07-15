/**
 * AI Agent 도구 정의 payload 예산 — **저장 시점(config-time) graph warning**.
 *
 * 런타임 fail-fast(`tool-payload-budget.ts` / `TOOL_DEFINITION_PAYLOAD_EXCEEDED`)
 * 는 실제 안전망이지만 노드 실행 시점에야 발동한다. 본 모듈은 워크플로 **저장·
 * 조회** 시점에 각 AI Agent 노드가 노출할 도구 정의 payload 를 정적 재현해
 * 예산 초과를 미리 경고한다 (backend-only graph warning, cross-node-warning-rules
 * §5 예외 — async 통합 조회 필요라 shared pure rule 로 표현 불가).
 *
 * SoT: spec/4-nodes/3-ai/1-ai-agent.md §4.2 · §10(저장 시점 경고) ·
 *      spec/conventions/cross-node-warning-rules.md §5 · §8
 *      (`ai_agent:tool-payload-budget`).
 *
 * 재현 대상: `presentationTools`(render_*, `RenderToolProvider` 재사용) +
 * `mcpServers` 의 **connected** cafe24/makeshop 정적 카탈로그(provider 의 pure
 * 추출 함수 재사용, runtime 과 drift 0). generic MCP(`service_type='mcp'`)·
 * 비-connected·lookup 실패는 live connect/side-effect 없이 재현 불가라 best-effort
 * skip — 그래서 기본 severity 는 `warning`(근사 오차단 회피, §12.15).
 */

import type { GraphWarningRuleResult } from '../../core/graph-warning-rule';
import type { ToolDef } from '../../../modules/llm/interfaces/llm-client.interface';
import type { Integration } from '../../../modules/integrations/entities/integration.entity';
import {
  estimateAgentToolPayload,
  toolPayloadSoftBytes,
  toolPayloadHardBytes,
  toolCountMax,
  toolBudgetStrictSave,
  type ToolPayloadPerProvider,
} from './tool-payload-budget';
import { buildCafe24ToolDefsForIntegration } from './tool-providers/cafe24-mcp-tool-provider';
import { buildMakeshopToolDefsForIntegration } from './tool-providers/makeshop-mcp-tool-provider';
import { RenderToolProvider } from './tool-providers/render-tool-provider';

/** graph warning rule id — cross-node-warning-rules §8 등재 (backend-only). */
export const AI_AGENT_TOOL_PAYLOAD_BUDGET_RULE_ID =
  'ai_agent:tool-payload-budget';

/** ai_agent 노드 type 문자열. */
const AI_AGENT_NODE_TYPE = 'ai_agent';

/**
 * 평가 대상 노드의 최소 shape — TypeORM `Node` entity 가 그대로 만족한다
 * (`saveCanvas`/`getGraphWarnings` 가 로드한 nodes 를 직접 전달).
 */
export interface ToolBudgetGraphNode {
  id: string;
  type?: string | null;
  config?: Record<string, unknown> | null;
  label?: string | null;
}

export interface AiAgentToolBudgetDeps {
  /**
   * integrationId → Integration (best-effort). not-found / credentials
   * unreadable / lookup 실패 시 **null** 반환(caller 는 해당 server skip).
   * runtime `buildTools` 의 `getForExecution` 과 동일 데이터 소스(복호화된
   * credentials)를 제공해야 재현 정확도가 보장된다. workspaceId 는 loader
   * 클로저가 캡처(테넌트 경계).
   */
  loadIntegration: (integrationId: string) => Promise<Integration | null>;
}

interface McpServerRef {
  integrationId?: string;
  enabledTools?: string[];
}

/**
 * graph 의 모든 AI Agent 노드에 대해 도구 정의 payload 예산 경고를 평가한다.
 * backend-only async rule — `WorkflowsService.getGraphWarnings`(조회) 가 결과
 * 배열에 append 하고, `saveCanvas`(저장) 가 severity `error` 시 차단한다.
 *
 * 결정적 — 동일 (nodes, 통합 상태) 스냅샷에 동일 결과. per-node 최대 1건.
 */
export async function evaluateAiAgentToolPayloadWarnings(
  nodes: readonly ToolBudgetGraphNode[],
  deps: AiAgentToolBudgetDeps,
): Promise<GraphWarningRuleResult[]> {
  const results: GraphWarningRuleResult[] = [];
  for (const node of nodes) {
    if (node.type !== AI_AGENT_NODE_TYPE) continue;
    const config = node.config ?? {};
    const tools = await reproduceConfigToolDefs(config, deps);
    // 재현된 도구가 없으면(비-connected·generic MCP·presentation 없음 등) 경고
    // 대상 아님 — 근사가 0 이면 skip.
    if (tools.length === 0) continue;
    const result = evaluateNodeToolPayload(node, tools);
    if (result) results.push(result);
  }
  return results;
}

/**
 * 노드 config 로부터 config-time 도구 정의 배열을 재현한다.
 *  - presentation render_* : `RenderToolProvider` 재사용(사실상 pure, drift 0).
 *  - mcpServers : connected cafe24/makeshop 정적 카탈로그만 provider pure 추출
 *    함수로 재현. 그 외(비-connected·generic MCP·lookup 실패)는 best-effort skip.
 */
async function reproduceConfigToolDefs(
  config: Record<string, unknown>,
  deps: AiAgentToolBudgetDeps,
): Promise<ToolDef[]> {
  const tools: ToolDef[] = [];

  // render_* — RenderToolProvider.buildTools 는 ctx.config.presentationTools 만
  // 읽는 사실상 pure 로직이라 config-time 에 그대로 재사용(정의 drift 0).
  try {
    const renderTools = await new RenderToolProvider().buildTools({
      config,
      workspaceId: '',
    });
    tools.push(...renderTools);
  } catch {
    // 방어적 — presentationTools 형태 이상 시 render 기여만 skip.
  }

  for (const ref of extractMcpServers(config)) {
    if (!ref.integrationId) continue;
    let integration: Integration | null = null;
    try {
      integration = await deps.loadIntegration(ref.integrationId);
    } catch {
      integration = null; // best-effort skip
    }
    if (!integration) continue;
    // config-time 은 토큰 refresh 등 side-effect 없이 재현 가능한 경우만 집계.
    // 비-connected(expired/pending/error)는 runtime 이 skip 하거나 refresh 를
    // 시도하므로 저장 시점에는 skip 해 오차단을 피한다.
    if (integration.status !== 'connected') continue;
    if (integration.serviceType === 'cafe24') {
      tools.push(
        ...buildCafe24ToolDefsForIntegration(integration, ref.enabledTools)
          .tools,
      );
    } else if (integration.serviceType === 'makeshop') {
      tools.push(
        ...buildMakeshopToolDefsForIntegration(integration, ref.enabledTools)
          .tools,
      );
    }
    // service_type='mcp'(외부 HTTP MCP)·기타 → live connect 필요라 skip.
  }

  return tools;
}

/**
 * 단일 노드의 도구 정의 배열에 대해 예산을 평가해 GraphWarningRuleResult 를
 * 만든다. 예산 이내면 null. hard/count 초과가 있고 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`
 * 면 severity `error`(저장 차단), 아니면 `warning`.
 */
function evaluateNodeToolPayload(
  node: ToolBudgetGraphNode,
  tools: ToolDef[],
): GraphWarningRuleResult | null {
  const estimate = estimateAgentToolPayload(tools);
  const hardBytes = toolPayloadHardBytes();
  const softBytes = toolPayloadSoftBytes();
  const countMax = toolCountMax();

  const hardExceeded =
    estimate.bytes > hardBytes || estimate.toolCount > countMax;
  const softExceeded = estimate.bytes > softBytes;
  if (!hardExceeded && !softExceeded) return null;

  const severity: 'error' | 'warning' =
    hardExceeded && toolBudgetStrictSave() ? 'error' : 'warning';
  // budget label 은 실제 위반한 축 기준: hard 초과면 hard 예산, soft 만이면 soft.
  const budgetBytes = hardExceeded ? hardBytes : softBytes;
  const culprit = pickCulprit(estimate.perProvider);
  const label = node.label && node.label.length > 0 ? node.label : node.id;

  // 영문 SoT/fallback 메시지 — 런타임 실패 메시지와 동일 어휘(§4.2). 노드 라벨·
  // 수치는 params 로 분리해 frontend 가 GRAPH_WARNING_KO 로 localize (§3-C).
  const message =
    `AI Agent "${label}" tool definitions serialize to ${estimate.bytes} bytes ` +
    `across ${estimate.toolCount} tools, exceeding the ` +
    `${hardExceeded ? 'budget' : 'soft budget'} of ${budgetBytes} bytes` +
    (culprit ? ` (largest contributor: "${culprit}")` : '') +
    `. Reduce exposed tools via mcpServers[].enabledTools allowlist or disable the server.`;

  const params: Record<string, string | number> = {
    node: label,
    bytes: estimate.bytes,
    budget: budgetBytes,
    toolCount: estimate.toolCount,
  };
  if (culprit) params.culprit = culprit;

  return {
    ruleId: AI_AGENT_TOOL_PAYLOAD_BUDGET_RULE_ID,
    severity,
    nodeId: node.id,
    message,
    params,
  };
}

/** perProvider 중 bytes 최대 그룹 key ("범인 provider"). 빈 배열이면 undefined. */
function pickCulprit(
  perProvider: ToolPayloadPerProvider[],
): string | undefined {
  let top: ToolPayloadPerProvider | undefined;
  for (const g of perProvider) {
    if (!top || g.bytes > top.bytes) top = g;
  }
  return top?.key;
}

function extractMcpServers(config: Record<string, unknown>): McpServerRef[] {
  const raw = config.mcpServers;
  if (!Array.isArray(raw)) return [];
  return raw as McpServerRef[];
}
