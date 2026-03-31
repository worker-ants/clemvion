"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  useReactFlow,
} from "@xyflow/react";
import type { ReactFlowInstance, Node as RFNode } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useEditorStore } from "@/lib/stores/editor-store";
import { getNodeDefinition } from "@/lib/node-definitions";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize, Trash2 } from "lucide-react";

import { CustomNode } from "./custom-node";
import { CustomEdge, EdgeMarkerDefs } from "./custom-edge";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

export function WorkflowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const onNodesChange = useEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useEditorStore((s) => s.onEdgesChange);
  const onConnect = useEditorStore((s) => s.onConnect);
  const addNode = useEditorStore((s) => s.addNode);
  const removeNode = useEditorStore((s) => s.removeNode);
  const selectNode = useEditorStore((s) => s.selectNode);
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

  const canDeleteNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      return node?.data?.type !== "manual_trigger";
    },
    [nodes],
  );

  // Handle delete via ReactFlow's onNodesDelete — ReactFlow calls this
  // after its internal delete-key handling. We override onNodesChange to
  // filter out remove changes for manual_trigger nodes, so this callback
  // simply closes the context menu if open.
  const onNodesDelete = useCallback(
    () => {
      setContextMenu(null);
    },
    [],
  );

  // Handle right-click on nodes
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: RFNode) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
      selectNode(node.id);
    },
    [selectNode],
  );

  const handleContextMenuDelete = useCallback(() => {
    if (contextMenu && canDeleteNode(contextMenu.nodeId)) {
      removeNode(contextMenu.nodeId);
    }
    setContextMenu(null);
  }, [contextMenu, canDeleteNode, removeNode]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

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
    <div ref={reactFlowWrapper} className="h-full w-full" onClick={closeContextMenu}>
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
        onNodesDelete={onNodesDelete}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        deleteKeyCode={["Delete", "Backspace"]}
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

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            onClick={handleContextMenuDelete}
            disabled={!canDeleteNode(contextMenu.nodeId)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--destructive))] hover:bg-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete Node
          </button>
        </div>
      )}
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
