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
import { useT, useLocale } from "@/lib/i18n";
import { translateBackendHint } from "@/lib/i18n/backend-labels";
import { FieldGroup } from "../node-configs/shared";
import type { WidgetProps } from "./widgets";

/**
 * Auto-form widget wrapping the app's LlmConfigSelector.
 *
 * FieldGroup 으로 감싸지 않는다 — `LlmConfigSelector` 가 자체 라벨("LLM Provider")을
 * 렌더하므로 FieldGroup label 을 더하면 라벨이 이중으로 표시된다. 이 필드는 schema hint
 * 가 없으므로 추가로 렌더할 캡션도 없다. (자체 라벨이 없는 위젯은 FieldGroup 필수 —
 * model-selector / mcp-server / workflow selector 참고.)
 */
export function LlmConfigSelectorWidget({ value, onChange }: WidgetProps) {
  return (
    <LlmConfigSelector
      value={typeof value === "string" ? value : ""}
      onChange={(v) => onChange(v)}
    />
  );
}

/**
 * Auto-form widget wrapping the app's KbSelector.
 *
 * `KbSelector` 가 자체 라벨("Knowledge Bases")을 렌더하므로 FieldGroup 으로 감싸지 않는다
 * (이중 라벨 방지). 단 schema 의 `ui.hint`(필드 설명)는 자체 컴포넌트가 그리지 않으므로
 * 셀렉터 아래에 캡션으로 직접 렌더한다.
 */
export function KbSelectorWidget({ ui, value, onChange }: WidgetProps) {
  const locale = useLocale();
  const safe = Array.isArray(value)
    ? (value as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const hint = translateBackendHint(ui?.hint, locale);
  return (
    <div className="flex flex-col gap-1.5">
      <KbSelector value={safe} onChange={(v) => onChange(v)} />
      {hint && (
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {hint}
        </span>
      )}
    </div>
  );
}

/**
 * Auto-form widget wrapping the MCP server selector.
 *
 * `McpServerSelector` 는 자체 라벨이 없으므로 FieldGroup 으로 감싸 schema 의 label("MCP
 * Servers")·hint 를 렌더한다(미사용 시 필드 설명이 사라짐).
 */
export function McpServerSelectorWidget({
  ui,
  label,
  value,
  onChange,
  required,
}: WidgetProps) {
  const locale = useLocale();
  // The auto-form passes through the raw config value; coerce to the array
  // shape expected by the underlying selector and let it own validation.
  const safe = Array.isArray(value) ? (value as McpServerRef[]) : [];
  return (
    <FieldGroup
      label={label}
      hint={translateBackendHint(ui?.hint, locale)}
      required={required}
    >
      <McpServerSelector value={safe} onChange={(v) => onChange(v)} />
    </FieldGroup>
  );
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
  ui,
  label,
  value,
  onChange,
  onChangeFields,
  required,
}: WidgetProps) {
  const t = useT();
  const locale = useLocale();
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
    <FieldGroup
      label={label}
      hint={translateBackendHint(ui?.hint, locale)}
      required={required}
    >
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
    </FieldGroup>
  );
}
