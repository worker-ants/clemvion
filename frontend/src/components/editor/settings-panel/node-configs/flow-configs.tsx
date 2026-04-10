import { useQuery } from "@tanstack/react-query";
import { FieldGroup, SelectField, NumberField } from "./shared";
import { ExpressionInput } from "@/components/editor/expression";
import { workflowsApi, type WorkflowData } from "@/lib/api/workflows";
import { useEditorStore } from "@/lib/stores/editor-store";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

// ===== Workflow (Sub-Workflow) =====
export function WorkflowConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const currentWorkflowId = useEditorStore((s) => s.workflowId);
  const { data } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => workflowsApi.list(),
    staleTime: 30_000,
  });
  const responseData = data?.data?.data ?? data?.data;
  const allWorkflows: WorkflowData[] = responseData?.items ?? responseData ?? [];
  const workflows = allWorkflows.filter(
    (w: WorkflowData) => w.id !== currentWorkflowId,
  );

  const handleSelectWorkflow = (id: string) => {
    const selected = workflows.find((w) => w.id === id);
    onChange({
      ...config,
      workflowId: id,
      workflowName: selected?.name ?? "",
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <FieldGroup label="Target Workflow" hint="Select an existing workflow or enter UUID directly">
        <select
          value={workflows.some((w) => w.id === (config.workflowId as string)) ? (config.workflowId as string) : ""}
          onChange={(e) => handleSelectWorkflow(e.target.value)}
          className="h-8 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs text-[hsl(var(--foreground))]"
        >
          <option value="">Select a workflow...</option>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}{!w.isActive ? " (inactive)" : ""}
            </option>
          ))}
        </select>
      </FieldGroup>
      <ExpressionInput
        label="Workflow ID"
        value={(config.workflowId as string) ?? ""}
        onChange={(v) => onChange({ ...config, workflowId: v, workflowName: "" })}
        placeholder="Target workflow UUID"
        hint="Or enter a workflow ID / expression directly"
      />
      <SelectField
        label="Execution Mode"
        value={(config.mode as string) ?? "sync"}
        onChange={(v) => onChange({ ...config, mode: v })}
        options={[
          { value: "sync", label: "Synchronous (wait for result)" },
          { value: "async", label: "Asynchronous (fire and forget)" },
        ]}
      />
      {(config.mode as string) !== "async" && (
        <NumberField
          label="Timeout (seconds)"
          value={(config.timeout as number) ?? 300}
          onChange={(v) => onChange({ ...config, timeout: v })}
          min={1}
          hint="Max wait time for synchronous execution"
        />
      )}
    </div>
  );
}
