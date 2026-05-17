/**
 * Frontend mirror of backend `MCP_CAPABLE_SERVICE_TYPES`. Kept in sync
 * with `codebase/backend/src/modules/integrations/services/mcp-capable-service-types.ts`.
 *
 * Both lists must move together when a new Internal Bridge service_type
 * is introduced — adding `'shopify'` etc. requires editing this file and
 * the backend twin. A future follow-up could expose this list via
 * `/api/integrations/services` and drop the duplication.
 */
export const MCP_CAPABLE_SERVICE_TYPES = ["mcp", "cafe24"] as const;
export type McpCapableServiceType =
  (typeof MCP_CAPABLE_SERVICE_TYPES)[number];
