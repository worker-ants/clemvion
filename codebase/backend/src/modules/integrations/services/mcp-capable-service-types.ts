/**
 * `service_type` values that surface as MCP-capable Integrations to the AI
 * Agent's `mcpServers` picker. Single source of truth so adding a future
 * Internal Bridge (Shopify, Naver Smartstore, ...) only requires editing
 * this constant — every consumer (backend candidate lookup, AI Agent tool
 * provider wiring, frontend selector) imports it instead of redeclaring
 * the array locally.
 *
 * Spec: spec/5-system/11-mcp-client.md §2.3 (Internal Bridge) +
 * spec/2-navigation/4-integration.md §14.2 (IntegrationSelector
 * serviceTypes whitelist for AI Agent.mcpServers).
 */
export const MCP_CAPABLE_SERVICE_TYPES = ['mcp', 'cafe24', 'makeshop'] as const;

export type McpCapableServiceType = (typeof MCP_CAPABLE_SERVICE_TYPES)[number];

/** Mutable array form for query builders that demand `string[]`. */
export const MCP_CAPABLE_SERVICE_TYPES_LIST: string[] = [
  ...MCP_CAPABLE_SERVICE_TYPES,
];
