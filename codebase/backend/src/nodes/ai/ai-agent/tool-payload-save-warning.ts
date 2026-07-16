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
 *
 * **통합 조회는 배치(단일 쿼리)** — graph 전체 ai_agent 노드의 `mcpServers`
 * integrationId 를 먼저 모아 caller 가 `In()` 한 번으로 로드한다(노드 수 만큼의
 * N+1 회피). saveCanvas 쓰기 트랜잭션 경로는 caller 가 트랜잭션 매니저 스코프
 * repository 를 주입해 추가 커넥션을 잡지 않는다.
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
  pickCulpritProvider,
  buildBudgetExceededPrefix,
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
   * integrationId 집합 → id별 Integration Map (best-effort, **단일 배치 조회**).
   * not-found / credentials unreadable 항목은 Map 에서 제외(caller 는 해당 server
   * skip). runtime `buildTools` 의 `getForExecution` 과 동일 데이터 소스(복호화된
   * credentials)를 제공해야 재현 정확도가 보장된다. workspaceId 는 loader 클로저가
   * 캡처(테넌트 경계). 노드가 여럿이어도 통합 조회는 이 한 번뿐이다(N+1 회피).
   */
  loadIntegrations: (
    integrationIds: readonly string[],
  ) => Promise<Map<string, Integration>>;
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
 * 통합은 **한 번의 배치 쿼리**로 스냅샷 로드한 뒤 per-node 재현은 동기적으로
 * 수행하므로, 결과는 그 스냅샷에 대해 결정적이다(per-node 최대 1건). 조회 사이
 * row 갱신을 원자적으로 배제하지는 않지만(advisory 경고), 단일 쿼리 스냅샷이라
 * 노드 간 시간차로 인한 불일치는 없다.
 */
export async function evaluateAiAgentToolPayloadWarnings(
  nodes: readonly ToolBudgetGraphNode[],
  deps: AiAgentToolBudgetDeps,
): Promise<GraphWarningRuleResult[]> {
  const agentNodes = nodes.filter((n) => n.type === AI_AGENT_NODE_TYPE);
  if (agentNodes.length === 0) return [];

  // 모든 ai_agent 노드의 mcpServers integrationId 를 모아 단일 배치 로드.
  const integrationIds = new Set<string>();
  for (const node of agentNodes) {
    for (const ref of extractMcpServers(node.config ?? {})) {
      if (ref.integrationId) integrationIds.add(ref.integrationId);
    }
  }
  let integrationsById: Map<string, Integration>;
  try {
    integrationsById =
      integrationIds.size > 0
        ? await deps.loadIntegrations([...integrationIds])
        : new Map<string, Integration>();
  } catch {
    // best-effort — 통합 배치 조회 실패(예: DB 일시 장애) 시 저장/조회를 깨지
    // 않고 mcpServers 기여만 skip(정적 render_* 기여는 아래에서 그대로 집계).
    integrationsById = new Map<string, Integration>();
  }

  const results: GraphWarningRuleResult[] = [];
  for (const node of agentNodes) {
    const tools = await reproduceConfigToolDefs(
      node.config ?? {},
      integrationsById,
    );
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
 *    함수로 재현(사전 로드된 `integrationsById` 스냅샷 사용). 그 외(비-connected·
 *    generic MCP·미로드)는 best-effort skip.
 */
async function reproduceConfigToolDefs(
  config: Record<string, unknown>,
  integrationsById: Map<string, Integration>,
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
    const integration = integrationsById.get(ref.integrationId);
    if (!integration) continue; // 미로드(not-found·unreadable) → skip
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
  const culprit = pickCulpritProvider(estimate.perProvider);
  const label = node.label && node.label.length > 0 ? node.label : node.id;

  // 영문 SoT/fallback 메시지 — 런타임 실패 메시지와 동일 템플릿(`buildBudgetExceeded
  // Prefix`) 재사용, subject 로 노드 라벨 주입. 노드 라벨·수치는 params 로도 분리해
  // frontend 가 GRAPH_WARNING_KO 로 localize (§3-C).
  const message =
    buildBudgetExceededPrefix(
      estimate.bytes,
      estimate.toolCount,
      hardExceeded ? 'budget' : 'soft budget',
      budgetBytes,
      culprit,
      `AI Agent "${label}" tool definitions`,
    ) +
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

function extractMcpServers(config: Record<string, unknown>): McpServerRef[] {
  const raw = config.mcpServers;
  if (!Array.isArray(raw)) return [];
  return raw as McpServerRef[];
}
