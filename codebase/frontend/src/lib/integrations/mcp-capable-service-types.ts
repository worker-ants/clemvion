/**
 * Frontend mirror of backend `MCP_CAPABLE_SERVICE_TYPES`. Kept in sync
 * with `codebase/backend/src/modules/integrations/services/mcp-capable-service-types.ts`.
 *
 * Both lists must move together when a new Internal Bridge service_type
 * is introduced — adding `'shopify'` etc. requires editing this file and
 * the backend twin. A future follow-up could expose this list via
 * `/api/integrations/services` and drop the duplication.
 *
 * NOTE: `makeshop` is an Internal Bridge service (its
 * `MakeshopMcpToolProvider` is registered in `ai-agent.component.ts`), so it
 * belongs on this frontend list — the MCP server picker must surface MakeShop
 * stores. The backend twin's `MCP_CAPABLE_SERVICE_TYPES` should include
 * `makeshop` as well; if it lags, this list only affects the picker's
 * `serviceType` filter (a plain integrations list query), which is harmless.
 */
export const MCP_CAPABLE_SERVICE_TYPES = ["mcp", "cafe24", "makeshop"] as const;
export type McpCapableServiceType =
  (typeof MCP_CAPABLE_SERVICE_TYPES)[number];
