"use client";

import { useQuery } from "@tanstack/react-query";
import { LlmConfigSelector } from "@/components/llm-config/llm-config-selector";
import { KbSelector } from "@/components/knowledge-base/kb-selector";
import {
  McpServerSelector,
  type McpServerRef,
} from "@/components/integrations/mcp-server-selector";
import { workflowsApi, type WorkflowData } from "@/lib/api/workflows";
import { useEditorStore } from "@/lib/stores/editor-store";
import { ExpressionInput } from "@/components/editor/expression";
import { useT } from "@/lib/i18n";
import type { WidgetProps } from "./widgets";

/** Auto-form widget wrapping the app's LlmConfigSelector. */
export function LlmConfigSelectorWidget({ value, onChange }: WidgetProps) {
  return (
    <LlmConfigSelector
      value={typeof value === "string" ? value : ""}
      onChange={(v) => onChange(v)}
    />
  );
}

/** Auto-form widget wrapping the app's KbSelector. */
export function KbSelectorWidget({ value, onChange }: WidgetProps) {
  const safe = Array.isArray(value)
    ? (value as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  return <KbSelector value={safe} onChange={(v) => onChange(v)} />;
}

/** Auto-form widget wrapping the MCP server selector. */
export function McpServerSelectorWidget({ value, onChange }: WidgetProps) {
  // The auto-form passes through the raw config value; coerce to the array
  // shape expected by the underlying selector and let it own validation.
  const safe = Array.isArray(value) ? (value as McpServerRef[]) : [];
  return <McpServerSelector value={safe} onChange={(v) => onChange(v)} />;
}

/**
 * Auto-form widget for the Sub-Workflow node's `Target Workflow` field.
 *
 * Mirrors the bespoke `WorkflowConfig` override (flow-configs.tsx): lists the
 * workspace's workflows, excludes the currently-edited one, and on pick
 * co-writes `workflowId` + `workflowName` (via `onChangeFields`) so the canvas
 * summary / "missing workflow" badge can resolve the human name. Manual UUID
 * entry clears `workflowName` so a since-deleted reference still surfaces the
 * badge. Falls back to writing only `workflowId` when `onChangeFields` is
 * absent (defensive — `SchemaForm` always provides it).
 */
export function WorkflowSelectorWidget({
  value,
  onChange,
  onChangeFields,
}: WidgetProps) {
  const t = useT();
  const currentWorkflowId = useEditorStore((s) => s.workflowId);
  const { data } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => workflowsApi.list(),
    staleTime: 30_000,
  });
  const responseData = (data?.data?.data ?? data?.data) as
    | { items?: WorkflowData[] }
    | WorkflowData[]
    | undefined;
  const allWorkflows: WorkflowData[] = Array.isArray(responseData)
    ? responseData
    : responseData?.items ?? [];
  const workflows = allWorkflows.filter((w) => w.id !== currentWorkflowId);

  const currentId = typeof value === "string" ? value : "";
  const selectValue = workflows.some((w) => w.id === currentId)
    ? currentId
    : "";

  const handleSelect = (id: string) => {
    const selected = workflows.find((w) => w.id === id);
    const patch = { workflowId: id, workflowName: selected?.name ?? "" };
    if (onChangeFields) onChangeFields(patch);
    else onChange(id);
  };

  const handleManualEntry = (v: string) => {
    // A directly typed UUID / expression has no resolved name — clear it so
    // the "missing workflow" badge fires until a selection re-populates it.
    if (onChangeFields) onChangeFields({ workflowId: v, workflowName: "" });
    else onChange(v);
  };

  return (
    <div className="flex flex-col gap-3">
      <select
        value={selectValue}
        onChange={(e) => handleSelect(e.target.value)}
        className="h-8 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
      >
        <option value="">{t("nodeConfigs.flow.selectWorkflow")}</option>
        {workflows.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
            {!w.isActive ? ` ${t("nodeConfigs.flow.inactiveSuffix")}` : ""}
          </option>
        ))}
      </select>
      <ExpressionInput
        label={t("nodeConfigs.flow.workflowId")}
        value={currentId}
        onChange={handleManualEntry}
        placeholder={t("nodeConfigs.flow.workflowIdPlaceholder")}
        hint={t("nodeConfigs.flow.workflowIdHint")}
      />
    </div>
  );
}
