"use client";

import { useState, useCallback, useMemo } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { getNodeDefinition } from "@/lib/node-definitions";
import { NodeConfigRenderer } from "./node-configs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { NodeIcon } from "../canvas/node-icon";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useT, type TranslationKey } from "@/lib/i18n";

type Tab = "settings" | "code" | "info";

const TAB_LABEL_KEYS: Record<Tab, TranslationKey> = {
  settings: "editor.tabSettings",
  code: "editor.tabCode",
  info: "editor.tabInfo",
};

export function NodeSettingsPanel() {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const nodes = useEditorStore((s) => s.nodes);
  const selectNode = useEditorStore((s) => s.selectNode);

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
        {(["settings", "code", "info"] as const).map((tab) => (
          <TabButton
            key={tab}
            tab={tab}
            active={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "settings" ? (
          <SettingsTab
            key={selectedNodeId}
            nodeId={selectedNodeId}
            nodeData={nodeData}
          />
        ) : activeTab === "code" ? (
          <CodeTab
            key={`code-${selectedNodeId}`}
            nodeId={selectedNodeId}
            nodeData={nodeData}
          />
        ) : (
          <InfoTab nodeType={nodeData.type} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: Tab;
  active: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 px-4 py-2 text-xs font-medium transition-colors",
        active
          ? "border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
          : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
      )}
    >
      {t(TAB_LABEL_KEYS[tab])}
    </button>
  );
}

function SettingsTab({
  nodeId,
  nodeData,
}: {
  nodeId: string;
  nodeData: {
    type: string;
    label: string;
    config: Record<string, unknown>;
    isDisabled?: boolean;
  };
}) {
  const t = useT();
  const nodes = useEditorStore((s) => s.nodes);
  const [label, setLabel] = useState(nodeData.label);
  const [isDisabled, setIsDisabled] = useState(nodeData.isDisabled ?? false);
  const [nodeConfig, setNodeConfig] = useState<Record<string, unknown>>(
    nodeData.config ?? {},
  );
  const [notes, setNotes] = useState(
    (nodeData.config?.notes as string) ?? "",
  );
  const [errorPolicy, setErrorPolicy] = useState(
    (nodeData.config?.errorPolicy as string) ?? "stop",
  );

  const handleConfigChange = useCallback(
    (newConfig: Record<string, unknown>) => {
      setNodeConfig(newConfig);
    },
    [],
  );

  const isDuplicateLabel = useMemo(() => {
    return nodes.some(
      (n) =>
        n.id !== nodeId &&
        (n.data as Record<string, unknown>).label === label,
    );
  }, [nodes, nodeId, label]);

  const handleSave = useCallback(() => {
    if (isDuplicateLabel) {
      toast.error(t("editor.duplicateLabelError"));
      return;
    }

    useEditorStore.getState().pushUndo();

    useEditorStore.setState((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                label,
                isDisabled,
                config: { ...nodeConfig, notes, errorPolicy },
              },
            }
          : n,
      ),
      isDirty: true,
    }));

    toast.success(t("editor.settingsSavedToast"));
  }, [nodeId, label, isDuplicateLabel, isDisabled, nodeConfig, notes, errorPolicy, t]);

  const isTrigger = nodeData.type === "manual_trigger";

  return (
    <div className="flex flex-col gap-4">
      {/* Label */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("editor.labelField")}</Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={cn(
            "h-8 text-xs",
            isDuplicateLabel && "border-red-500 focus-visible:ring-red-500",
          )}
        />
        {isDuplicateLabel && (
          <span className="text-[10px] text-red-500">
            {t("editor.duplicateLabelError")}
          </span>
        )}
      </div>

      {/* Node-specific config */}
      <NodeConfigRenderer
        nodeType={nodeData.type}
        config={nodeConfig}
        onChange={handleConfigChange}
      />

      {/* Common fields below node-specific config */}
      {!isTrigger && (
        <>
          {/* Error handling policy */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t("editor.errorHandling")}</Label>
            <select
              value={errorPolicy}
              onChange={(e) => setErrorPolicy(e.target.value)}
              className="h-8 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs text-[hsl(var(--foreground))]"
            >
              <option value="stop">{t("editor.errorStop")}</option>
              <option value="skip">{t("editor.errorSkip")}</option>
              <option value="default_output">{t("editor.errorDefaultOutput")}</option>
              <option value="retry">{t("editor.errorRetry")}</option>
              <option value="error_port">{t("editor.errorRoutePort")}</option>
            </select>
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
              {t("editor.disableNode")}
            </Label>
          </div>
        </>
      )}

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("editor.notesLabel")}</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          placeholder={t("editor.notesPlaceholder")}
        />
      </div>

      {/* Save button */}
      <Button size="sm" onClick={handleSave} className="text-xs">
        {t("editor.saveChanges")}
      </Button>
    </div>
  );
}

function CodeTab({
  nodeId,
  nodeData,
}: {
  nodeId: string;
  nodeData: {
    type: string;
    config: Record<string, unknown>;
  };
}) {
  const t = useT();
  const [configJson, setConfigJson] = useState(
    JSON.stringify(nodeData.config ?? {}, null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    try {
      const parsed = JSON.parse(configJson);
      setJsonError(null);

      useEditorStore.getState().pushUndo();
      useEditorStore.setState((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, config: parsed } }
            : n,
        ),
        isDirty: true,
      }));

      toast.success(t("editor.configApplied"));
    } catch {
      setJsonError(t("editor.invalidJson"));
    }
  }, [nodeId, configJson, t]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("editor.configJson")}</Label>
        <textarea
          value={configJson}
          onChange={(e) => {
            setConfigJson(e.target.value);
            setJsonError(null);
          }}
          rows={16}
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
      <Button size="sm" onClick={handleSave} className="text-xs">
        {t("editor.applyJsonBtn")}
      </Button>
    </div>
  );
}

function InfoTab({ nodeType }: { nodeType: string }) {
  const t = useT();
  const definition = getNodeDefinition(nodeType);

  return (
    <div className="flex flex-col gap-4">
      {definition ? (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[hsl(var(--foreground))]">
              {definition.label}
            </span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {definition.description}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase text-[hsl(var(--muted-foreground))]">
              {t("editor.categoryLabel")}
            </span>
            <span className="text-xs capitalize" style={{ color: definition.color }}>
              {definition.category}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase text-[hsl(var(--muted-foreground))]">
              {t("editor.inputsLabel")}
            </span>
            {definition.inputs.length > 0 ? (
              definition.inputs.map((p) => (
                <span key={p.id} className="text-xs text-[hsl(var(--foreground))]">
                  {p.label} ({p.id})
                </span>
              ))
            ) : (
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {t("editor.noInputsStartNode")}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase text-[hsl(var(--muted-foreground))]">
              {t("editor.outputsLabel")}
            </span>
            {definition.outputs.map((p) => (
              <span key={p.id} className="text-xs text-[hsl(var(--foreground))]">
                {p.label} ({p.id})
              </span>
            ))}
          </div>
        </>
      ) : (
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("editor.unknownNodeType")}
        </span>
      )}
      <div className="border-t border-[hsl(var(--border))] pt-3">
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("editor.noExecutionData")}
        </span>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {t("editor.runToSeeResults")}
        </p>
      </div>
    </div>
  );
}
