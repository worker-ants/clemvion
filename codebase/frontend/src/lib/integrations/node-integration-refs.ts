import type { Node } from "@xyflow/react";
import type { IntegrationScope } from "@/lib/api/integrations";

/*
 * 에디터가 노드 `config` 안의 통합 참조를 고르는 규칙(CLE-INT-MANAGE 「개인 통합 사용 판정」 의 고르는 화면).
 *
 * - 통합 선택기는 지금 사용자가 워크플로우 작성자가 아니면 자기 개인 통합을 고를 수 없는 항목으로 보인다(REQ-INTMGMT-056).
 * - 붙여넣기와 복제는 지금 사용자가 그 워크플로우에서 고를 수 없는 참조를 비운다(REQ-EDITOR-059).
 *
 * 둘 다 사용자 편의이고 권위는 서버의 저장 검사다. 참조의 자리는 CLE-PLAT-DATA 「참조의 소속」 의 「통합 참조」 목록을 따르고
 * 백엔드 `modules/integrations/node-integration-refs.ts` 와 같게 둔다.
 */

/** `config.integrationId` 로 통합을 참조하는 노드. */
const INTEGRATION_ID_REF_NODE_TYPES: ReadonlySet<string> = new Set([
  "send_email",
  "database_query",
  "http_request",
  "cafe24",
  "makeshop",
]);

/** `config.mcpServers[].integrationId` 로 통합을 참조하는 노드. */
const MCP_SERVER_REF_NODE_TYPES: ReadonlySet<string> = new Set(["ai_agent"]);

/** 지금 사용자가 볼 수 있는 통합. 목록 조회는 남의 개인 통합을 돌려주지 않는다. */
export interface VisibleIntegration {
  scope: IntegrationScope;
  createdBy: string;
}

/**
 * 지금 사용자가 이 워크플로우의 노드에 이 통합을 넣을 수 있는지. 조직 통합은 누구나 넣는다. 개인 통합은 지금 사용자가 그
 * 통합의 소유자이면서 워크플로우 작성자일 때만 넣는다(저장 검사의 저장자 조건과 워크플로우 작성자 조건).
 */
export function canUseIntegrationInWorkflow(
  integration: VisibleIntegration,
  currentUserId: string,
  workflowAuthorId: string,
): boolean {
  if (integration.scope === "organization") return true;
  return (
    integration.createdBy === currentUserId && currentUserId === workflowAuthorId
  );
}

export interface IntegrationRefFilterContext {
  currentUserId: string | null;
  workflowAuthorId: string | null;
  /** 지금 사용자가 볼 수 있는 통합 전체(id 별). 불러오는 중이거나 전체를 받지 못했으면 `null` 이다. */
  integrations: ReadonlyMap<string, VisibleIntegration> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 이 자리의 참조를 비워야 하는지. 고르지 않은 자리와 표현식 참조는 비우지 않는다. */
function shouldClear(
  value: unknown,
  integrations: ReadonlyMap<string, VisibleIntegration>,
  currentUserId: string,
  workflowAuthorId: string,
): boolean {
  if (value === undefined || value === null || value === "") return false;
  // 문자열이 아닌 값은 어느 통합도 가리키지 못한다. 저장 검사는 없는 통합과 같이 거절한다.
  if (typeof value !== "string") return true;
  if (value.includes("{{")) return false;
  const integration = integrations.get(value);
  return (
    integration === undefined ||
    !canUseIntegrationInWorkflow(integration, currentUserId, workflowAuthorId)
  );
}

/**
 * 노드 하나의 `config` 에서 지금 사용자가 고를 수 없는 통합 참조를 비운다. `config.integrationId` 는 키를 지우고 MCP 서버
 * 항목은 항목째 뺀다(CLE-PLAT-DATA 「참조의 소속」 의 «비울 때»). 비운 것이 없으면 받은 `config` 를 그대로 돌려준다.
 *
 * 통합 목록 · 지금 사용자 · 워크플로우 작성자 가운데 하나라도 모르면 비우지 않는다. 모르는 참조를 비우면 쓸 수 있는 참조까지
 * 잃는다. 남긴 참조가 쓸 수 없는 통합이면 저장 검사가 막는다(CLE-WF-EDITOR Rationale R-5).
 */
export function clearUnusableIntegrationRefs(
  type: string,
  config: unknown,
  ctx: IntegrationRefFilterContext,
): { config: unknown; cleared: boolean } {
  const { integrations, currentUserId, workflowAuthorId } = ctx;
  if (
    integrations === null ||
    currentUserId === null ||
    workflowAuthorId === null ||
    !isRecord(config)
  ) {
    return { config, cleared: false };
  }
  const clear = (value: unknown) =>
    shouldClear(value, integrations, currentUserId, workflowAuthorId);

  let next: Record<string, unknown> = config;
  // HTTP Request 는 `authentication='integration'` 일 때만 이 값을 쓴다. 저장 검사도 그때만 본다.
  const usesIntegrationId =
    INTEGRATION_ID_REF_NODE_TYPES.has(type) &&
    (type !== "http_request" || config.authentication === "integration");
  if (usesIntegrationId && clear(config.integrationId)) {
    next = { ...next };
    delete next.integrationId;
  }
  const servers = config.mcpServers;
  if (MCP_SERVER_REF_NODE_TYPES.has(type) && Array.isArray(servers)) {
    const kept = servers.filter(
      (item) => !isRecord(item) || !clear(item.integrationId),
    );
    if (kept.length !== servers.length) next = { ...next, mcpServers: kept };
  }
  return { config: next, cleared: next !== config };
}

/**
 * 붙여넣거나 복제한 노드들에 `clearUnusableIntegrationRefs` 를 건다. 비운 노드의 레이블을 순서대로 돌려준다. 경고 토스트가
 * 이 레이블을 적는다.
 */
export function clearUnusableIntegrationRefsInNodes<T extends Node>(
  nodes: T[],
  ctx: IntegrationRefFilterContext,
): { nodes: T[]; clearedLabels: string[] } {
  const clearedLabels: string[] = [];
  const out = nodes.map((node) => {
    const data = (node.data as Record<string, unknown> | undefined) ?? {};
    const type = typeof data.type === "string" ? data.type : "";
    const result = clearUnusableIntegrationRefs(type, data.config, ctx);
    if (!result.cleared) return node;
    clearedLabels.push(typeof data.label === "string" ? data.label : type);
    return { ...node, data: { ...data, config: result.config } };
  });
  return { nodes: out, clearedLabels };
}
