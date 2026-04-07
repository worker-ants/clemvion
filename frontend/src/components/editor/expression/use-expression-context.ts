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

  /** Whether the selected node is a table node in dynamic mode (enables $sourceItem/$dataSource variables) */
  isTableContext: boolean;

  /** Sample of a single item from table data source (for $sourceItem. field drill-down, requires execution results) */
  sourceItemSample: Record<string, unknown> | null;
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
    // Build maps of nodeId -> last execution result
    const resultMap = new Map<string, Record<string, unknown>>();
    const rawResultMap = new Map<string, unknown>();
    for (const r of nodeResults) {
      resultMap.set(r.nodeId, toRecord(r.outputData));
      rawResultMap.set(r.nodeId, r.outputData);
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

    // Detect table node context and compute sourceItemSample
    let isTableContext = false;
    let sourceItemSample: Record<string, unknown> | null = null;
    if (selectedNodeId) {
      const selectedNode = nodes.find((n) => n.id === selectedNodeId);
      const selectedData = selectedNode?.data as Record<string, unknown> | undefined;
      if (selectedData?.type === "table") {
        const config = selectedData.config as Record<string, unknown> | undefined;
        const mode = (config?.mode as string) ?? "dynamic";
        if (mode === "dynamic") {
          isTableContext = true;
          // Try to resolve data source sample (use rawResultMap to preserve arrays)
          let resolvedSource: unknown = null;

          // Check if dataSource expression references a specific node
          const dataSourceExpr = config?.dataSource as string | undefined;
          const nodeRefMatch = dataSourceExpr?.match(/\$node\["([^"]+)"\]\.output/);
          if (nodeRefMatch) {
            const refLabel = nodeRefMatch[1];
            const refNode = availableNodes.find((n) => n.label === refLabel);
            if (refNode) {
              const refOutput = rawResultMap.get(refNode.id);
              if (refOutput) resolvedSource = refOutput;
            }
          }

          // Fallback: use predecessor node output
          if (!resolvedSource) {
            const tableIncoming = edges.filter((e) => e.target === selectedNodeId);
            if (tableIncoming.length === 1) {
              const predOutput = rawResultMap.get(tableIncoming[0].source);
              if (predOutput) resolvedSource = predOutput;
            }
          }

          // Extract first item from array, or use object directly
          if (resolvedSource) {
            if (Array.isArray(resolvedSource) && resolvedSource.length > 0) {
              const first = resolvedSource[0];
              if (first && typeof first === "object" && !Array.isArray(first)) {
                sourceItemSample = first as Record<string, unknown>;
              }
            } else if (typeof resolvedSource === "object" && !Array.isArray(resolvedSource)) {
              sourceItemSample = resolvedSource as Record<string, unknown>;
            }
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
      isTableContext,
      sourceItemSample,
    };
  }, [nodes, edges, nodeResults, selectedNodeId]);
}
