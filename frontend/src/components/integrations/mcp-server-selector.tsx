"use client";

import { useQuery } from "@tanstack/react-query";
import { integrationsApi, type IntegrationDto } from "@/lib/api/integrations";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useT } from "@/lib/i18n";

/** Bound on the MCP server list fetched for picker — matches API page limit. */
const MCP_LIST_LIMIT = 100;

/**
 * Shape of one entry in the AI Agent's `mcpServers` config field.
 *
 * **Mirror of `McpServerRef` in
 * `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` — keep in sync.**
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
 * AI Agent node. The component is intentionally tight: it does not let the
 * user edit allowlists / per-tool overrides inline (those are advanced
 * surfaces tracked separately) — for now toggling a server on/off and
 * controlling resource/prompt exposure is enough for the 80% case.
 */
export function McpServerSelector({ value, onChange }: Props) {
  const t = useT();
  const safe = Array.isArray(value) ? value : [];
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["integrations", "mcp"],
    queryFn: () =>
      integrationsApi.list({ serviceType: ["mcp"], limit: MCP_LIST_LIMIT }),
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
            return (
              <div
                key={ref.integrationId}
                className="rounded-md border border-[hsl(var(--input))] p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate">
                    {integration?.name ?? `${ref.integrationId.slice(0, 8)}… (missing)`}
                  </span>
                  {integration && (
                    <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[9px] uppercase">
                      {integration.status}
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
            <div className="space-y-0.5">
              {available.map((i) => (
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
