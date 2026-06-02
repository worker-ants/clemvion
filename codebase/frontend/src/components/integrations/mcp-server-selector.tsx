"use client";

import { useQuery } from "@tanstack/react-query";
import { integrationsApi, type IntegrationDto } from "@/lib/api/integrations";
import { MCP_CAPABLE_SERVICE_TYPES } from "@/lib/integrations/mcp-capable-service-types";
import { Plus, X, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { Cafe24AllowlistEditor } from "@/components/integrations/cafe24-allowlist-editor";

/** Bound on the MCP server list fetched for picker — matches API page limit. */
const MCP_LIST_LIMIT = 100;

/**
 * Shape of one entry in the AI Agent's `mcpServers` config field.
 *
 * **Mirror of `McpServerRef` in
 * `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` — keep in sync.**
 *
 * The two declarations are intentionally duplicated (no shared package)
 * because the UI consumes the JSON-Schema-derived type for auto-form, but
 * this selector needs the structural type up-front for typing the patch
 * helpers. Any change to the backend schema must be reflected here.
 */
export interface McpServerRef {
  integrationId: string;
  enabledTools?: string[];
  includeResources?: boolean;
  includePrompts?: boolean;
  toolOverrides?: Array<{ toolName: string; description?: string }>;
}

/**
 * Defaults for a freshly attached `McpServerRef` — "expose everything the
 * server reports" per spec/5-system/11-mcp-client.md §5.6 default_true semantics.
 * Shared with the workflow-assistant in-message picker
 * (`buildPickerSubmissionValue` in assistant-message.tsx) so both UIs produce
 * identical config shapes when the user picks an MCP server.
 */
export const MCP_SERVER_REF_DEFAULTS: Pick<
  McpServerRef,
  "includeResources" | "includePrompts"
> = {
  includeResources: true,
  includePrompts: true,
};

interface Props {
  value: McpServerRef[];
  onChange: (value: McpServerRef[]) => void;
}

/**
 * Lets the workflow author attach one or more workspace MCP servers to an
 * AI Agent node. Toggling a server on/off and controlling resource/prompt
 * exposure covers the 80% case for generic MCP servers.
 *
 * **Cafe24 servers** additionally expose an expandable "Operations allowlist"
 * editor (`Cafe24AllowlistEditor`) — resource-grouped `enabledTools` editing
 * with ⚠ partner-approval labels (§1 / spec/4-nodes/4-integration/4-cafe24.md
 * §8.3). Per-tool description overrides remain an advanced surface tracked
 * separately.
 */
export function McpServerSelector({ value, onChange }: Props) {
  const t = useT();
  const safe = Array.isArray(value) ? value : [];
  const [pickerOpen, setPickerOpen] = useState(false);
  // Cafe24 server 별 "Operations allowlist" 펼침 상태 (advanced surface — §1).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // MCP-capable integrations cover external HTTP servers (service_type='mcp')
  // and Internal Bridge integrations (currently service_type='cafe24'). Both
  // expose their tools via the `mcp_<sid>__<tool>` naming scheme, so the
  // AI Agent's mcpServers picker treats them as one homogeneous list. See
  // spec/5-system/11-mcp-client.md §2.3 + spec/2-navigation/4-integration.md §14.2.
  const { data, isLoading, isError } = useQuery({
    queryKey: ["integrations", "mcp-capable"],
    queryFn: () =>
      integrationsApi.list({
        serviceType: [...MCP_CAPABLE_SERVICE_TYPES],
        limit: MCP_LIST_LIMIT,
      }),
    staleTime: 30_000,
  });

  const allMcp: IntegrationDto[] = (data?.data ?? []) as IntegrationDto[];
  const attached = new Set(safe.map((r) => r.integrationId));
  const available = allMcp.filter((i) => !attached.has(i.id));

  function add(integrationId: string) {
    onChange([
      ...safe,
      { integrationId, ...MCP_SERVER_REF_DEFAULTS },
    ]);
    setPickerOpen(false);
  }

  function remove(integrationId: string) {
    onChange(safe.filter((r) => r.integrationId !== integrationId));
  }

  function patch(integrationId: string, patch: Partial<McpServerRef>) {
    onChange(
      safe.map((r) =>
        r.integrationId === integrationId ? { ...r, ...patch } : r,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {isError && (
        <p className="text-[10px] text-red-500">
          Failed to load MCP servers. Check the integrations service and reload.
        </p>
      )}
      {!isError && safe.length === 0 && !isLoading && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {allMcp.length === 0
            ? "No MCP server registered. Visit Integrations → Add → MCP Server first."
            : "No MCP servers attached to this AI Agent."}
        </p>
      )}

      {safe.length > 0 && (
        <div className="space-y-1.5">
          {safe.map((ref) => {
            const integration = allMcp.find(
              (i) => i.id === ref.integrationId,
            );
            const isMissing = !integration;
            // Deleted (or revoked-out-of-list) integrations get a red
            // border + warning icon + "삭제된 MCP" label so the user
            // can spot stale references at a glance and remove them.
            // Replaces the previous silent UUID fallback which left the
            // entry indistinguishable from a healthy one (2026-05-15 사용자 보고).
            const containerClasses = isMissing
              ? "rounded-md border border-red-500/60 bg-red-500/5 p-2"
              : "rounded-md border border-[hsl(var(--input))] p-2";
            return (
              <div key={ref.integrationId} className={containerClasses}>
                <div className="flex items-center gap-2">
                  {isMissing && (
                    <AlertTriangle
                      className="h-3.5 w-3.5 shrink-0 text-red-500"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={
                      isMissing
                        ? "text-xs font-medium truncate text-red-600 dark:text-red-400"
                        : "text-xs font-medium truncate"
                    }
                    title={
                      isMissing
                        ? `Integration id ${ref.integrationId} no longer exists in this workspace`
                        : undefined
                    }
                  >
                    {integration?.name ??
                      t("integrations.deletedMcpLabel", {
                        idShort: ref.integrationId.slice(0, 8),
                      })}
                  </span>
                  {integration && (
                    <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[9px] uppercase">
                      {integration.status}
                    </span>
                  )}
                  {isMissing && (
                    <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] uppercase text-red-600 dark:text-red-400">
                      removed
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-6 w-6"
                    onClick={() => remove(ref.integrationId)}
                    aria-label={t("common.aria.removeIntegration")}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </div>
                {isMissing ? (
                  <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">
                    This MCP integration was deleted. Remove this reference or
                    re-attach a valid MCP server.
                  </p>
                ) : (
                  <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px]">
                    <label className="flex cursor-pointer items-center gap-1">
                      <input
                        type="checkbox"
                        checked={ref.includeResources !== false}
                        onChange={(e) =>
                          patch(ref.integrationId, {
                            includeResources: e.target.checked,
                          })
                        }
                        className="h-3 w-3"
                      />
                      Expose Resources
                    </label>
                    <label className="flex cursor-pointer items-center gap-1">
                      <input
                        type="checkbox"
                        checked={ref.includePrompts !== false}
                        onChange={(e) =>
                          patch(ref.integrationId, {
                            includePrompts: e.target.checked,
                          })
                        }
                        className="h-3 w-3"
                      />
                      Expose Prompts
                    </label>
                  </div>
                )}
                {/* Cafe24 server — operation 단위 allowlist 편집 (advanced surface,
                    §1 / spec §8.3). 별도 승인(⚠) 라벨은 에디터가 자동 렌더. */}
                {!isMissing && integration?.serviceType === "cafe24" && (
                  <div className="mt-1.5 border-t border-[hsl(var(--border))] pt-1.5">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(ref.integrationId)}
                      aria-expanded={expanded.has(ref.integrationId)}
                      className="flex w-full items-center gap-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    >
                      {expanded.has(ref.integrationId) ? (
                        <ChevronDown className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-3 w-3" aria-hidden="true" />
                      )}
                      {t("nodeConfigs.integration.cafe24AllowlistTitle")}
                      {ref.enabledTools && (
                        <span className="ml-1 rounded bg-[hsl(var(--muted))] px-1 py-0.5 text-[9px]">
                          {ref.enabledTools.length}
                        </span>
                      )}
                    </button>
                    {expanded.has(ref.integrationId) && (
                      <div className="mt-1.5">
                        <Cafe24AllowlistEditor
                          enabledTools={ref.enabledTools}
                          onChange={(et) =>
                            patch(ref.integrationId, { enabledTools: et })
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pickerOpen ? (
        <div className="rounded-md border border-[hsl(var(--input))] p-1.5">
          {available.length === 0 ? (
            <p className="px-1 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
              All available MCP servers are already attached.
            </p>
          ) : (
            <div className="space-y-1.5">
              {([
                {
                  key: "mcp",
                  heading: "🌐 Generic MCP (HTTP) servers",
                  items: available.filter((i) => i.serviceType === "mcp"),
                },
                {
                  key: "cafe24",
                  heading: "🛒 Cafe24 stores (Internal Bridge)",
                  items: available.filter((i) => i.serviceType === "cafe24"),
                },
              ] as const).map((group) =>
                group.items.length === 0 ? null : (
                  <div key={group.key}>
                    <div className="px-1 pb-0.5 text-[9px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      {group.heading}
                    </div>
                    {group.items.map((i) => (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => add(i.id)}
                        className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-[hsl(var(--accent))]"
                      >
                        <span className="truncate">{i.name}</span>
                        <span className="ml-auto text-[9px] uppercase text-[hsl(var(--muted-foreground))]">
                          {i.status}
                        </span>
                      </button>
                    ))}
                  </div>
                ),
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-6 w-full"
            onClick={() => setPickerOpen(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 self-start"
          onClick={() => setPickerOpen(true)}
          disabled={isLoading}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add MCP Server
        </Button>
      )}
    </div>
  );
}
