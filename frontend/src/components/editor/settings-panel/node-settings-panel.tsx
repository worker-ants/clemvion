"use client";

import { useState, useCallback } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { getNodeDefinition } from "@/lib/node-definitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { NodeIcon } from "../canvas/node-icon";
import { X } from "lucide-react";

type Tab = "settings" | "info";

export function NodeSettingsPanel() {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const nodes = useEditorStore((s) => s.nodes);
  const selectNode = useEditorStore((s) => s.selectNode);
  const updateNodeConfig = useEditorStore((s) => s.updateNodeConfig);

  const node = nodes.find((n) => n.id === selectedNodeId);
  const [activeTab, setActiveTab] = useState<Tab>("settings");

  if (!node || !selectedNodeId) return null;

  const definition = getNodeDefinition(node.data.type as string);
  const nodeData = node.data as {
    type: string;
    label: string;
    config: Record<string, unknown>;
    category: string;
    isDisabled?: boolean;
  };

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
        <NodeIcon
          name={definition?.icon ?? "HelpCircle"}
          size={16}
          style={{ color: definition?.color }}
        />
        <span className="flex-1 truncate text-sm font-medium text-[hsl(var(--foreground))]">
          {nodeData.label}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => selectNode(null)}
        >
          <X size={14} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[hsl(var(--border))]">
        {(["settings", "info"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 px-4 py-2 text-xs font-medium capitalize transition-colors",
              activeTab === tab
                ? "border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "settings" ? (
          <SettingsTab
            key={selectedNodeId}
            nodeId={selectedNodeId}
            nodeData={nodeData}
            updateNodeConfig={updateNodeConfig}
          />
        ) : (
          <InfoTab />
        )}
      </div>
    </div>
  );
}

function SettingsTab({
  nodeId,
  nodeData,
  updateNodeConfig,
}: {
  nodeId: string;
  nodeData: {
    type: string;
    label: string;
    config: Record<string, unknown>;
    isDisabled?: boolean;
  };
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void;
}) {
  // Use nodeId as key to reset state when switching nodes (via key prop on parent)
  const [label, setLabel] = useState(nodeData.label);
  const [isDisabled, setIsDisabled] = useState(nodeData.isDisabled ?? false);
  const [configJson, setConfigJson] = useState(
    JSON.stringify(nodeData.config ?? {}, null, 2),
  );
  const [notes, setNotes] = useState(
    (nodeData.config?.notes as string) ?? "",
  );
  const [errorPolicy, setErrorPolicy] = useState(
    (nodeData.config?.errorPolicy as string) ?? "stop",
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(configJson);
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON");
      return;
    }

    // Store updates node data including the config
    const nodes = useEditorStore.getState().nodes;
    const currentNode = nodes.find((n) => n.id === nodeId);
    if (!currentNode) return;

    useEditorStore.getState().pushUndo();

    // Update the full node data
    useEditorStore.setState((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                label,
                isDisabled,
                config: { ...parsedConfig, notes, errorPolicy },
              },
            }
          : n,
      ),
      isDirty: true,
    }));
  }, [nodeId, label, isDisabled, configJson, notes, errorPolicy]);

  return (
    <div className="flex flex-col gap-4">
      {/* Label */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Label</Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {/* Disabled */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="node-disabled"
          checked={isDisabled}
          onChange={(e) => setIsDisabled(e.target.checked)}
          className="h-4 w-4 rounded border-[hsl(var(--input))]"
        />
        <Label htmlFor="node-disabled" className="text-xs">
          Disabled
        </Label>
      </div>

      {/* Error handling policy */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Error Handling</Label>
        <select
          value={errorPolicy}
          onChange={(e) => setErrorPolicy(e.target.value)}
          className="h-8 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs text-[hsl(var(--foreground))]"
        >
          <option value="stop">Stop on Error</option>
          <option value="continue">Continue on Error</option>
          <option value="retry">Retry</option>
        </select>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Notes</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          placeholder="Add notes about this node..."
        />
      </div>

      {/* Config JSON */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Configuration (JSON)</Label>
        <textarea
          value={configJson}
          onChange={(e) => {
            setConfigJson(e.target.value);
            setJsonError(null);
          }}
          rows={6}
          className={cn(
            "rounded-md border bg-transparent px-3 py-2 font-mono text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
            jsonError
              ? "border-red-500"
              : "border-[hsl(var(--input))]",
          )}
          placeholder="{}"
        />
        {jsonError && (
          <span className="text-[10px] text-red-500">{jsonError}</span>
        )}
      </div>

      {/* Save button */}
      <Button size="sm" onClick={handleSave} className="text-xs">
        Save Changes
      </Button>
    </div>
  );
}

function InfoTab() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <span className="text-sm text-[hsl(var(--muted-foreground))]">
        No execution data
      </span>
      <span className="text-xs text-[hsl(var(--muted-foreground))]">
        Run the workflow to see execution results here.
      </span>
    </div>
  );
}
