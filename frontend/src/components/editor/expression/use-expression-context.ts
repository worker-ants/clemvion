import { useMemo } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type { JsonSchemaNode } from "@/lib/node-definitions/types";
import { getAllFunctionNames, buildDisambiguatedKeys } from "@workflow/expression-engine";
import { enrichInfoExtractorOutputSchema } from "./node-output-schema-enrichers";

const FUNCTION_NAMES = getAllFunctionNames();

export interface ExpressionNodeInfo {
  id: string;
  label: string;
  /** Disambiguated key used in $node["..."] expressions (label or label#N for duplicates) */
  resolvedKey: string;
  type: string;
  outputFields: string[];
  outputSample: Record<string, unknown>;
  /** Static output schema from the node definition (used when execution sample is unavailable) */
  outputSchema?: JsonSchemaNode;
  /** Static config schema from the node definition (used for $node["X"].config.<field> hints) */
  configSchema?: JsonSchemaNode;
}

export interface ExpressionData {
  /** Fields from direct predecessor node output (for $input. suggestions) */
  inputFields: string[];
  inputSample: Record<string, unknown>;
  /** Static schema for $input (predecessor node's outputSchema) — enables hints before execution */
  inputSchema?: JsonSchemaNode;

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
  const nodeDefinitions = useNodeDefinitionsStore((s) => s.definitions);

  return useMemo(() => {
    // Build maps of nodeId -> last execution result and nodeId -> node for
    // O(1) reuse across the several places that need to look a node up
    // (predecessor, table dataSource ref, selected node).
    const resultMap = new Map<string, Record<string, unknown>>();
    const rawResultMap = new Map<string, unknown>();
    for (const r of nodeResults) {
      resultMap.set(r.nodeId, toRecord(r.outputData));
      rawResultMap.set(r.nodeId, r.outputData);
    }
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Find predecessor nodes for $input. suggestions
    let inputFields: string[] = [];
    let inputSample: Record<string, unknown> = {};
    let inputSchema: JsonSchemaNode | undefined;
    if (selectedNodeId) {
      const incomingEdges = edges.filter((e) => e.target === selectedNodeId);
      if (incomingEdges.length === 1) {
        const sourceId = incomingEdges[0].source;
        const sourceOutput = resultMap.get(sourceId);
        if (sourceOutput) {
          inputFields = extractFields(sourceOutput);
          inputSample = sourceOutput;
        }
        // Schema fallback: predecessor's outputSchema enables hints before execution
        const sourceNode = nodeById.get(sourceId);
        const sourceData = sourceNode?.data as Record<string, unknown> | undefined;
        const sourceType = sourceData?.type as string | undefined;
        if (sourceType) {
          inputSchema = nodeDefinitions[sourceType]?.outputSchema;
          if (inputSchema && sourceType === "information_extractor") {
            inputSchema = enrichInfoExtractorOutputSchema(
              inputSchema,
              sourceData?.config as Record<string, unknown> | undefined,
            );
          }
        }
      } else if (incomingEdges.length > 1) {
        // Multiple inputs — keys are source node IDs
        for (const edge of incomingEdges) {
          inputFields.push(edge.source);
        }
      }
    }

    // Build disambiguation keys from ALL nodes (matching backend execution scope)
    const allDisambiguatedKeys = buildDisambiguatedKeys(
      nodes.map((n) => ({
        id: n.id,
        label: (n.data as Record<string, unknown>).label as string ?? n.id,
      })),
    );
    // Filter out selected node for display, but use keys computed from full set
    const filteredNodes = nodes.filter((n) => n.id !== selectedNodeId);
    const availableNodes: ExpressionNodeInfo[] = filteredNodes.map((n) => {
      const output = resultMap.get(n.id) ?? {};
      const data = n.data as Record<string, unknown>;
      const nodeType = (data.type as string) ?? "unknown";
      const definition = nodeDefinitions[nodeType];
      const config = data.config as Record<string, unknown> | undefined;
      let outputSchema = definition?.outputSchema;
      if (nodeType === "information_extractor") {
        outputSchema = enrichInfoExtractorOutputSchema(outputSchema, config);
      }
      return {
        id: n.id,
        label: (data.label as string) ?? n.id,
        resolvedKey: allDisambiguatedKeys.get(n.id) ?? n.id,
        type: nodeType,
        outputFields: extractFields(output),
        outputSample: output,
        outputSchema,
        configSchema: definition?.configSchema,
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
      const selectedNode = nodeById.get(selectedNodeId);
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
            const refNode = availableNodes.find((n) => n.resolvedKey === refLabel);
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
      inputSchema,
      availableNodes,
      variables,
      functionNames: FUNCTION_NAMES,
      isTableContext,
      sourceItemSample,
    };
  }, [nodes, edges, nodeResults, selectedNodeId, nodeDefinitions]);
}
