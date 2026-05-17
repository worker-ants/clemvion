"use client";

import { useMemo, useState } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { applyOperations } from "@/lib/transform/apply-operation";
import type { TransformOperation } from "@/types/transform";
import { SectionTitle } from "../shared";
import { useT } from "@/lib/i18n";

function toDisplayObject(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function TransformPreview({
  operations,
}: {
  operations: TransformOperation[];
}) {
  const t = useT();
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const nodeResults = useExecutionStore((s) => s.nodeResults);

  const latestInput = useMemo<unknown>(() => {
    if (!selectedNodeId) return undefined;
    for (let i = nodeResults.length - 1; i >= 0; i--) {
      if (
        nodeResults[i].nodeId === selectedNodeId &&
        nodeResults[i].inputData !== undefined
      ) {
        return nodeResults[i].inputData;
      }
    }
    return undefined;
  }, [selectedNodeId, nodeResults]);

  const hasExecutionInput = toDisplayObject(latestInput) !== null;

  const [sampleText, setSampleText] = useState<string>(
    JSON.stringify({ name: "  Kim  ", age: "30" }, null, 2),
  );

  const parsedSample = useMemo<
    { ok: true; value: Record<string, unknown> } | { ok: false; error: string }
  >(() => {
    try {
      const parsed = JSON.parse(sampleText);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return { ok: true, value: parsed as Record<string, unknown> };
      }
      return { ok: false, error: t("nodeConfigs.preview.rootMustBeObject") };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : t("nodeConfigs.preview.jsonParseFailed"),
      };
    }
  }, [sampleText, t]);

  const input = hasExecutionInput
    ? toDisplayObject(latestInput)
    : parsedSample.ok
      ? parsedSample.value
      : null;
  const sampleError =
    !hasExecutionInput && !parsedSample.ok ? parsedSample.error : null;

  const stepsResult = useMemo<
    | { ok: true; steps: ReturnType<typeof applyOperations> }
    | { ok: false; error: string }
  >(() => {
    if (!input) return { ok: true, steps: [] };
    try {
      return { ok: true, steps: applyOperations(input, operations) };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : t("nodeConfigs.preview.operationErrorPrefix"),
      };
    }
  }, [input, operations, t]);
  const steps = stepsResult.ok ? stepsResult.steps : [];

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>{t("nodeConfigs.preview.title")}</SectionTitle>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        {t("nodeConfigs.preview.expressionHint")}
      </p>
      {hasExecutionInput ? (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {t("nodeConfigs.preview.usingLastRunInput")}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {t("nodeConfigs.preview.usingSampleInput")}
          </span>
          <textarea
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            rows={5}
            className="rounded-md border border-[hsl(var(--input))] bg-transparent px-2 py-1 font-mono text-[10px] text-[hsl(var(--foreground))]"
          />
          {sampleError && (
            <span className="text-[10px] text-red-500">{sampleError}</span>
          )}
        </div>
      )}
      {input && <JsonCard title={t("nodeConfigs.preview.input")} value={input} />}
      {!stepsResult.ok && (
        <span className="text-[10px] text-red-500">
          {stepsResult.error}
        </span>
      )}
      {steps.map((step, i) => (
        <JsonCard
          key={`${i}-${step.op.type}`}
          title={t("nodeConfigs.preview.stepHeader", { index: i + 1, type: step.op.type })}
          value={step.result}
        />
      ))}
      {input && stepsResult.ok && steps.length === 0 && (
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {t("nodeConfigs.preview.noOperations")}
        </span>
      )}
    </div>
  );
}

function JsonCard({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-1.5">
      <summary className="cursor-pointer text-[10px] font-semibold text-[hsl(var(--foreground))]">
        {title}
      </summary>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-[hsl(var(--foreground))]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
