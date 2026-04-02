"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { getAllFunctionNames } from "@workflow/expression-engine";

const FUNCTION_NAMES = getAllFunctionNames();

export interface ExpressionNodeInfo {
  id: string;
  label: string;
  type: string;
  outputFields: string[];
  outputSample: Record<string, unknown>;
}

export interface ExpressionData {
  /** Fields from direct predecessor node output (for $input. suggestions) */
  inputFields: string[];
  inputSample: Record<string, unknown>;

  /** All workflow nodes (for $node["..."] suggestions) */
  availableNodes: ExpressionNodeInfo[];

  /** Declared variables (for $var. suggestions) */
  variables: Array<{ name: string; type: string }>;

  /** Built-in function names */
  functionNames: string[];
}

function extractFields(data: unknown): string[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.keys(data as Record<string, unknown>);
}

function toRecord(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return data as Record<string, unknown>;
}

/**
 * Provides autocomplete data for ExpressionInput components.
 * Must be called within a component that has access to editor and execution stores.
 */
export function useExpressionContext(selectedNodeId: string | null): ExpressionData {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const nodeResults = useExecutionStore((s) => s.nodeResults);

  return useMemo(() => {
    // Build a map of nodeId -> last execution result
    const resultMap = new Map<string, Record<string, unknown>>();
    for (const r of nodeResults) {
      resultMap.set(r.nodeId, toRecord(r.outputData));
    }

    // Find predecessor nodes for $input. suggestions
    let inputFields: string[] = [];
    let inputSample: Record<string, unknown> = {};
    if (selectedNodeId) {
      const incomingEdges = edges.filter((e) => e.target === selectedNodeId);
      if (incomingEdges.length === 1) {
        const sourceId = incomingEdges[0].source;
        const sourceOutput = resultMap.get(sourceId);
        if (sourceOutput) {
          inputFields = extractFields(sourceOutput);
          inputSample = sourceOutput;
        }
      } else if (incomingEdges.length > 1) {
        // Multiple inputs — keys are source node IDs
        for (const edge of incomingEdges) {
          inputFields.push(edge.source);
        }
      }
    }

    // Build available nodes list for $node["..."] suggestions
    const availableNodes: ExpressionNodeInfo[] = nodes
      .filter((n) => n.id !== selectedNodeId)
      .map((n) => {
        const output = resultMap.get(n.id) ?? {};
        return {
          id: n.id,
          label: (n.data as Record<string, unknown>).label as string ?? n.id,
          type: (n.data as Record<string, unknown>).type as string ?? "unknown",
          outputFields: extractFields(output),
          outputSample: output,
        };
      });

    // Extract declared variables from variable_declaration nodes
    const variables: Array<{ name: string; type: string }> = [];
    for (const n of nodes) {
      const data = n.data as Record<string, unknown>;
      if (data.type === "variable_declaration") {
        const config = data.config as Record<string, unknown> | undefined;
        const vars = config?.variables as
          | Array<{ name: string; type: string }>
          | undefined;
        if (vars) {
          for (const v of vars) {
            variables.push({ name: v.name, type: v.type });
          }
        }
      }
    }

    return {
      inputFields,
      inputSample,
      availableNodes,
      variables,
      functionNames: FUNCTION_NAMES,
    };
  }, [nodes, edges, nodeResults, selectedNodeId]);
}
