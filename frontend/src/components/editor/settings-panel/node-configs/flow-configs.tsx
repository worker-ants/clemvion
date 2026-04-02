"use client";

import { SelectField, NumberField } from "./shared";
import { ExpressionInput } from "@/components/editor/expression";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

// ===== Workflow (Sub-Workflow) =====
export function WorkflowConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput
        label="Workflow ID"
        value={(config.workflowId as string) ?? ""}
        onChange={(v) => onChange({ ...config, workflowId: v })}
        placeholder="Target workflow UUID"
        hint="The workflow to call as a sub-workflow"
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
