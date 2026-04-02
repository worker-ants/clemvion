"use client";

import { useEffect, useState } from "react";
import { WorkflowEditor } from "@/components/editor/workflow-editor";
import { useEditorStore } from "@/lib/stores/editor-store";
import { workflowsApi } from "@/lib/api/workflows";
import type { Node, Edge } from "@xyflow/react";
import { getNodeDefinition } from "@/lib/node-definitions";

interface EditorLoaderProps {
  workflowId: string;
}

export function WorkflowEditorLoader({ workflowId }: EditorLoaderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setWorkflow = useEditorStore((s) => s.setWorkflow);

  useEffect(() => {
    async function load() {
      try {
        const [wfRes, nodesRes, edgesRes] = await Promise.all([
          workflowsApi.get(workflowId),
          workflowsApi.getNodes(workflowId),
          workflowsApi.getEdges(workflowId),
        ]);

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
            },
          };
        });

        const flowEdges: Edge[] = (Array.isArray(rawEdges) ? rawEdges : []).map((e) => ({
          id: e.id as string,
          source: e.sourceNodeId as string,
          sourceHandle: e.sourcePort as string,
          target: e.targetNodeId as string,
          targetHandle: e.targetPort as string,
          type: "custom",
        }));

        setWorkflow(
          workflowId,
          (wf.name as string) || "Untitled",
          flowNodes,
          flowEdges,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workflow");
      } finally {
        setLoading(false);
      }
    }

    void load();
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
