"use client";

import { useEffect, useState } from "react";
import { WorkflowEditor } from "@/components/editor/workflow-editor";
import { useEditorStore } from "@/lib/stores/editor-store";
import { workflowsApi } from "@/lib/api/workflows";
import type { Node, Edge } from "@xyflow/react";
import { getNodeDefinition, loadNodeDefinitions } from "@/lib/node-definitions";
import { dropStaleEdges, enrichEdgesWithPortData } from "@/lib/utils/edge-utils";

interface EditorLoaderProps {
  workflowId: string;
}

export function WorkflowEditorLoader({ workflowId }: EditorLoaderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setWorkflow = useEditorStore((s) => s.setWorkflow);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [wfRes, nodesRes, edgesRes] = await Promise.all([
          workflowsApi.get(workflowId),
          workflowsApi.getNodes(workflowId),
          workflowsApi.getEdges(workflowId),
          loadNodeDefinitions(),
        ]);

        if (cancelled) return;

        const wf = (wfRes.data.data ?? wfRes.data) as unknown as Record<string, unknown>;
        const rawNodes = (nodesRes.data.data ?? nodesRes.data) as unknown as Array<Record<string, unknown>>;
        const rawEdges = (edgesRes.data.data ?? edgesRes.data) as unknown as Array<Record<string, unknown>>;

        const flowNodes: Node[] = (Array.isArray(rawNodes) ? rawNodes : []).map((n) => {
          const def = getNodeDefinition(n.type as string);
          return {
            id: n.id as string,
            type: "custom",
            position: { x: (n.positionX as number) || 0, y: (n.positionY as number) || 0 },
            data: {
              type: n.type,
              label: n.label || def?.label || n.type,
              category: n.category || def?.category,
              config: n.config || {},
              isDisabled: n.isDisabled || false,
              containerId: (n.containerId as string | null) ?? null,
            },
          };
        });

        const rawFlowEdges: Edge[] = (Array.isArray(rawEdges) ? rawEdges : []).map((e) => ({
          id: e.id as string,
          source: e.sourceNodeId as string,
          sourceHandle: e.sourcePort as string,
          target: e.targetNodeId as string,
          targetHandle: e.targetPort as string,
          type: "custom",
        }));
        // Drop edges whose handles no longer exist on the current node config
        // (e.g. AI Agent switched from single_turn to multi_turn removes "out")
        // so React Flow doesn't log "Couldn't create edge for source handle id" warnings.
        const liveEdges = dropStaleEdges(rawFlowEdges, flowNodes);
        if (liveEdges.length !== rawFlowEdges.length) {
          console.warn(
            `[workflow] Dropped ${rawFlowEdges.length - liveEdges.length} stale edge(s) referencing missing handles`,
          );
        }
        const flowEdges: Edge[] = enrichEdgesWithPortData(liveEdges, flowNodes);

        if (cancelled) return;

        setWorkflow(
          workflowId,
          (wf.name as string) || "Untitled",
          flowNodes,
          flowEdges,
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load workflow");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => { cancelled = true; };
  }, [workflowId, setWorkflow]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[hsl(var(--destructive))]">{error}</p>
      </div>
    );
  }

  return <WorkflowEditor />;
}
