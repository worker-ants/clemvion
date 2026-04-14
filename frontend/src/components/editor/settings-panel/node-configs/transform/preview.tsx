"use client";

import { useMemo, useState } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { applyOperations } from "@/lib/transform/apply-operation";
import type { TransformOperation } from "@/types/transform";
import { SectionTitle } from "../shared";

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
      return { ok: false, error: "루트는 객체여야 합니다" };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "JSON 파싱 실패",
      };
    }
  }, [sampleText]);

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
        error: e instanceof Error ? e.message : "연산 적용 중 오류",
      };
    }
  }, [input, operations]);
  const steps = stepsResult.ok ? stepsResult.steps : [];

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>Preview</SectionTitle>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        {"{{ $input.x }}"} 같은 표현식은 실행 시 평가되며, Preview 에서는
        리터럴로 표시됩니다.
      </p>
      {hasExecutionInput ? (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          마지막 실행 결과의 입력 데이터를 사용합니다.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            실행 이력이 없어 샘플 입력을 사용합니다. JSON을 직접 수정해 보세요.
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
      {input && <JsonCard title="Input" value={input} />}
      {!stepsResult.ok && (
        <span className="text-[10px] text-red-500">
          {stepsResult.error}
        </span>
      )}
      {steps.map((step, i) => (
        <JsonCard
          key={`${i}-${step.op.type}`}
          title={`Step ${i + 1} · ${step.op.type}`}
          value={step.result}
        />
      ))}
      {input && stepsResult.ok && steps.length === 0 && (
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
          연산이 없습니다.
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
