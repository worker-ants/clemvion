"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  useReactFlow,
} from "@xyflow/react";
import type { ReactFlowInstance, Node as RFNode, Edge as RFEdge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useEditorStore } from "@/lib/stores/editor-store";
import { getNodeDefinition, NODE_DEFINITIONS } from "@/lib/node-definitions";
import { generateUniqueLabel } from "@/lib/utils/generate-unique-label";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Trash2,
  Settings,
  Copy,
  EyeOff,
  Eye,
  Plus,
  Crosshair,
  Search,
} from "lucide-react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useCanvasHoverStore } from "@/lib/stores/canvas-hover-store";
import { CustomNode } from "./custom-node";
import { CustomEdge, EdgeMarkerDefs } from "./custom-edge";
import { useEdgeHighlighting } from "./use-edge-highlighting";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

function getExistingLabels(nodes: RFNode[]): string[] {
  return nodes.map(
    (n) => (n.data as Record<string, unknown>).label as string,
  );
}

interface NodeContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

interface CanvasContextMenuState {
  x: number;
  y: number;
  flowPosition: { x: number; y: number };
}

interface NodeSearchPopupState {
  x: number;
  y: number;
  flowPosition: { x: number; y: number };
}

export function WorkflowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [nodeContextMenu, setNodeContextMenu] =
    useState<NodeContextMenuState | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] =
    useState<CanvasContextMenuState | null>(null);
  const [nodeSearchPopup, setNodeSearchPopup] =
    useState<NodeSearchPopupState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const lastClickTime = useRef(0);

  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const onNodesChange = useEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useEditorStore((s) => s.onEdgesChange);
  const onConnect = useEditorStore((s) => s.onConnect);
  const addNode = useEditorStore((s) => s.addNode);
  const removeNode = useEditorStore((s) => s.removeNode);
  const selectNode = useEditorStore((s) => s.selectNode);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const updateNodeConfig = useEditorStore((s) => s.updateNodeConfig);
  const setHoveredNode = useCanvasHoverStore((s) => s.setHoveredNode);
  const setHoveredEdge = useCanvasHoverStore((s) => s.setHoveredEdge);

  const { enhancedEdges, isFocusActive, hoveredEdgeNodes } = useEdgeHighlighting(edges);

  // Apply glow className to source/target nodes when an edge is hovered
  const glowNodes = useMemo(() => {
    if (!hoveredEdgeNodes) return nodes;
    const glowIds = new Set([hoveredEdgeNodes.sourceId, hoveredEdgeNodes.targetId]);
    return nodes.map((node) => {
      if (glowIds.has(node.id)) {
        const existing = node.className ?? "";
        if (existing.includes("node-edge-glow")) return node;
        return { ...node, className: `${existing} node-edge-glow`.trim() };
      }
      if (node.className?.includes("node-edge-glow")) {
        const cleaned = node.className.replace("node-edge-glow", "").trim();
        return { ...node, className: cleaned || undefined };
      }
      return node;
    });
  }, [nodes, hoveredEdgeNodes]);

  const onNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: RFNode) => {
      setHoveredNode(node.id);
    },
    [setHoveredNode],
  );

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, [setHoveredNode]);

  const onEdgeMouseEnter = useCallback(
    (_: React.MouseEvent, edge: RFEdge) => {
      setHoveredEdge(edge.id);
    },
    [setHoveredEdge],
  );

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdge(null);
  }, [setHoveredEdge]);

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

  const onNodesDelete = useCallback(() => {
    setNodeContextMenu(null);
  }, []);

  // Node right-click
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: RFNode) => {
      event.preventDefault();
      setCanvasContextMenu(null);
      setNodeSearchPopup(null);
      setNodeContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
      selectNode(node.id);
    },
    [selectNode],
  );

  // Canvas right-click
  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setNodeContextMenu(null);
      setNodeSearchPopup(null);
      const flowPos = reactFlowInstance.current?.screenToFlowPosition({
        x: (event as React.MouseEvent).clientX,
        y: (event as React.MouseEvent).clientY,
      }) ?? { x: 0, y: 0 };
      setCanvasContextMenu({
        x: (event as React.MouseEvent).clientX,
        y: (event as React.MouseEvent).clientY,
        flowPosition: flowPos,
      });
    },
    [],
  );

  // Double-click on empty canvas
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastClickTime.current < 300) {
        // Double click
        setNodeContextMenu(null);
        setCanvasContextMenu(null);
        const flowPos = reactFlowInstance.current?.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }) ?? { x: 0, y: 0 };
        setNodeSearchPopup({
          x: event.clientX,
          y: event.clientY,
          flowPosition: flowPos,
        });
        setSearchQuery("");
      }
      lastClickTime.current = now;
    },
    [],
  );

  // Node context menu actions
  const handleNodeMenuAction = useCallback(
    (action: string) => {
      if (!nodeContextMenu) return;
      const nodeId = nodeContextMenu.nodeId;
      const node = nodes.find((n) => n.id === nodeId);

      switch (action) {
        case "settings":
          selectNode(nodeId);
          break;
        case "duplicate": {
          if (!node) break;
          pushUndo();
          const definition = getNodeDefinition(
            node.data?.type as string,
          );
          if (!definition) break;
          const existingLabels = getExistingLabels(nodes);
          const currentLabel =
            (node.data as Record<string, unknown>).label as string ??
            definition.label;
          const newNode = {
            id: crypto.randomUUID(),
            type: "custom",
            position: {
              x: node.position.x + 50,
              y: node.position.y + 50,
            },
            data: {
              ...node.data,
              label: generateUniqueLabel(currentLabel, existingLabels),
            },
          };
          addNode(newNode);
          break;
        }
        case "disable": {
          if (!node) break;
          pushUndo();
          updateNodeConfig(nodeId, {
            ...((node.data?.config as Record<string, unknown>) ?? {}),
          });
          // Toggle isDisabled in the node data
          onNodesChange([
            {
              type: "replace" as const,
              id: nodeId,
              item: {
                ...node,
                data: {
                  ...node.data,
                  isDisabled: !node.data?.isDisabled,
                },
              },
            },
          ]);
          break;
        }
        case "delete":
          if (canDeleteNode(nodeId)) {
            removeNode(nodeId);
          }
          break;
      }
      setNodeContextMenu(null);
    },
    [
      nodeContextMenu,
      nodes,
      selectNode,
      pushUndo,
      addNode,
      removeNode,
      canDeleteNode,
      updateNodeConfig,
      onNodesChange,
    ],
  );

  // Canvas context menu actions
  const handleCanvasMenuAction = useCallback(
    (action: string) => {
      if (!canvasContextMenu) return;
      switch (action) {
        case "add-node":
          setNodeSearchPopup({
            x: canvasContextMenu.x,
            y: canvasContextMenu.y,
            flowPosition: canvasContextMenu.flowPosition,
          });
          setSearchQuery("");
          break;
        case "select-all":
          onNodesChange(
            nodes.map((n) => ({ type: "select" as const, id: n.id, selected: true })),
          );
          break;
        case "fit-view":
          reactFlowInstance.current?.fitView({ padding: 0.2 });
          break;
      }
      setCanvasContextMenu(null);
    },
    [canvasContextMenu, nodes, onNodesChange],
  );

  // Add node from search popup
  const handleAddNodeFromSearch = useCallback(
    (nodeType: string) => {
      if (!nodeSearchPopup) return;
      const definition = getNodeDefinition(nodeType);
      if (!definition) return;

      if (nodeType === "manual_trigger") {
        const hasTrigger = nodes.some((n) => n.data?.type === "manual_trigger");
        if (hasTrigger) return;
      }

      pushUndo();
      const existingLabels = nodes.map(
        (n) => (n.data as Record<string, unknown>).label as string,
      );
      const newNode = {
        id: crypto.randomUUID(),
        type: "custom",
        position: nodeSearchPopup.flowPosition,
        data: {
          type: nodeType,
          label: generateUniqueLabel(definition.label, existingLabels),
          config: { ...(definition.defaultConfig ?? {}) },
          category: definition.category,
          isDisabled: false,
        },
      };
      addNode(newNode);
      setNodeSearchPopup(null);
    },
    [nodeSearchPopup, nodes, pushUndo, addNode],
  );

  const closeAllMenus = useCallback(() => {
    setNodeContextMenu(null);
    setCanvasContextMenu(null);
    setNodeSearchPopup(null);
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

      if (nodeType === "manual_trigger") {
        const hasTrigger = nodes.some((n) => n.data?.type === "manual_trigger");
        if (hasTrigger) return;
      }

      if (!reactFlowInstance.current) return;

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      pushUndo();

      const existingLabels = nodes.map(
        (n) => (n.data as Record<string, unknown>).label as string,
      );
      const newNode = {
        id: crypto.randomUUID(),
        type: "custom",
        position,
        data: {
          type: nodeType,
          label: generateUniqueLabel(definition.label, existingLabels),
          config: { ...(definition.defaultConfig ?? {}) },
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
      interactionWidth: 20,
    }),
    [],
  );

  // Filtered node definitions for search popup
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return NODE_DEFINITIONS;
    const q = searchQuery.toLowerCase();
    return NODE_DEFINITIONS.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  return (
    <TooltipProvider delayDuration={300}>
    <div
      ref={reactFlowWrapper}
      className="h-full w-full"
      data-edge-focus-active={isFocusActive || undefined}
      onClick={closeAllMenus}
    >
      <EdgeMarkerDefs />
      <ReactFlow
        nodes={glowNodes}
        edges={enhancedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={onSelectionChange}
        onNodesDelete={onNodesDelete}
        onNodeContextMenu={onNodeContextMenu}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        deleteKeyCode={["Delete", "Backspace"]}
        className="bg-[hsl(var(--background))]"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <ZoomControls />
      </ReactFlow>

      {/* Node context menu */}
      {nodeContextMenu && (
        <div
          className="fixed z-50 min-w-[180px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg"
          style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleNodeMenuAction("settings")}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
          >
            <Settings className="h-4 w-4" />
            Open Settings
          </button>
          <button
            type="button"
            onClick={() => handleNodeMenuAction("duplicate")}
            disabled={
              nodes.find((n) => n.id === nodeContextMenu.nodeId)?.data
                ?.type === "manual_trigger"
            }
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => handleNodeMenuAction("disable")}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
          >
            {nodes.find((n) => n.id === nodeContextMenu.nodeId)?.data
              ?.isDisabled ? (
              <>
                <Eye className="h-4 w-4" />
                Enable
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4" />
                Disable
              </>
            )}
          </button>
          <div className="my-1 border-t border-[hsl(var(--border))]" />
          <button
            type="button"
            onClick={() => handleNodeMenuAction("delete")}
            disabled={!canDeleteNode(nodeContextMenu.nodeId)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--destructive))] hover:bg-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete Node
          </button>
        </div>
      )}

      {/* Canvas context menu */}
      {canvasContextMenu && (
        <div
          className="fixed z-50 min-w-[180px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg"
          style={{ left: canvasContextMenu.x, top: canvasContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleCanvasMenuAction("add-node")}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
          >
            <Plus className="h-4 w-4" />
            Add Node
          </button>
          <button
            type="button"
            onClick={() => handleCanvasMenuAction("select-all")}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
          >
            <Crosshair className="h-4 w-4" />
            Select All
          </button>
          <button
            type="button"
            onClick={() => handleCanvasMenuAction("fit-view")}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]"
          >
            <Maximize className="h-4 w-4" />
            Fit to View
          </button>
        </div>
      )}

      {/* Node search popup (double-click add) */}
      {nodeSearchPopup && (
        <div
          className="fixed z-50 w-[260px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg"
          style={{ left: nodeSearchPopup.x, top: nodeSearchPopup.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2">
            <Search className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
              autoFocus
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto py-1">
            {filteredNodes.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
                No nodes found
              </div>
            ) : (
              filteredNodes.map((def) => (
                <button
                  key={def.type}
                  type="button"
                  onClick={() => handleAddNodeFromSearch(def.type)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-[hsl(var(--accent))]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: def.color }}
                  />
                  <span>{def.label}</span>
                  <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
                    {def.category}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}

function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <Panel position="bottom-left" className="flex gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => zoomIn()}
      >
        <ZoomIn size={14} />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => zoomOut()}
      >
        <ZoomOut size={14} />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => fitView({ padding: 0.2 })}
      >
        <Maximize size={14} />
      </Button>
    </Panel>
  );
}
