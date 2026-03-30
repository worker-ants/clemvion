"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  useReactFlow,
} from "@xyflow/react";
import type { ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useEditorStore } from "@/lib/stores/editor-store";
import { getNodeDefinition } from "@/lib/node-definitions";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";

import { CustomNode } from "./custom-node";
import { CustomEdge, EdgeMarkerDefs } from "./custom-edge";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

export function WorkflowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const onNodesChange = useEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useEditorStore((s) => s.onEdgesChange);
  const onConnect = useEditorStore((s) => s.onConnect);
  const addNode = useEditorStore((s) => s.addNode);
  const removeNode = useEditorStore((s) => s.removeNode);
  const selectNode = useEditorStore((s) => s.selectNode);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const pushUndo = useEditorStore((s) => s.pushUndo);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Array<{ id: string }> }) => {
      if (selectedNodes.length === 1) {
        selectNode(selectedNodes[0].id);
      } else if (selectedNodes.length === 0) {
        selectNode(null);
      }
    },
    [selectNode],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if ((event.key === "Delete" || event.key === "Backspace") && selectedNodeId) {
        // Don't delete if an input is focused
        const target = event.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        // Prevent deletion of trigger nodes
        const node = nodes.find((n) => n.id === selectedNodeId);
        if (node?.data?.type === "manual_trigger") return;
        removeNode(selectedNodeId);
      }
    },
    [selectedNodeId, removeNode, nodes],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData("application/reactflow-type");
      if (!nodeType) return;

      const definition = getNodeDefinition(nodeType);
      if (!definition) return;

      // Prevent duplicate Manual Trigger nodes
      if (nodeType === "manual_trigger") {
        const hasTrigger = nodes.some((n) => n.data?.type === "manual_trigger");
        if (hasTrigger) return;
      }

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds || !reactFlowInstance.current) return;

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      pushUndo();

      const newNode = {
        id: crypto.randomUUID(),
        type: "custom",
        position,
        data: {
          type: nodeType,
          label: definition.label,
          config: {},
          category: definition.category,
          isDisabled: false,
        },
      };

      addNode(newNode);
    },
    [addNode, pushUndo, nodes],
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
    instance.fitView({ padding: 0.2 });
  }, []);

  const defaultEdgeOptions = useMemo(
    () => ({
      type: "custom" as const,
    }),
    [],
  );

  return (
    <div ref={reactFlowWrapper} className="h-full w-full" onKeyDown={onKeyDown}>
      <EdgeMarkerDefs />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        deleteKeyCode={null}
        className="bg-[hsl(var(--background))]"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <MiniMap
          position="bottom-right"
          className="!h-[100px] !w-[140px]"
          maskColor="rgba(0,0,0,0.1)"
          nodeStrokeWidth={3}
        />
        <ZoomControls />
      </ReactFlow>
    </div>
  );
}

function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <Panel position="bottom-left" className="flex gap-1">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => zoomIn()}>
        <ZoomIn size={14} />
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => zoomOut()}>
        <ZoomOut size={14} />
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => fitView({ padding: 0.2 })}>
        <Maximize size={14} />
      </Button>
    </Panel>
  );
}
