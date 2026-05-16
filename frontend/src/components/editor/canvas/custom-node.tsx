"use client";

import { memo, useEffect, useMemo } from "react";
import { Handle, Position, useStore, useUpdateNodeInternals } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { getNodeDefinition, getCategoryColor } from "@/lib/node-definitions";
import { resolveDynamicPorts } from "@/lib/node-definitions/resolve-dynamic-ports";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { getConfigSummary, truncateSummary } from "@/lib/utils/node-config-summary";
import type { SummaryContext } from "@/lib/utils/node-config-summary";
import { llmConfigsApi, type LlmConfigData } from "@/lib/api/llm-configs";
import { useLocale } from "@/lib/i18n";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { NodeIcon } from "./node-icon";

type CustomNodeData = {
  type: string;
  label: string;
  config: Record<string, unknown>;
  category: string;
  isDisabled?: boolean;
};

type CustomNodeType = Node<CustomNodeData, "custom">;

// useStore with a boolean selector: only re-renders when crossing the 50% zoom threshold.
// useViewport() would re-render on every pan/zoom change, which is expensive with many nodes.
const zoomSelector = (s: { transform: number[] }) => s.transform[2] >= 0.5;

function CustomNodeComponent({ id, data, selected }: NodeProps<CustomNodeType>) {
  const definition = getNodeDefinition(data.type);
  const categoryColor = getCategoryColor(data.category);
  const inputs = definition?.inputs ?? [];
  const containerId =
    (data as Record<string, unknown>).containerId as string | null | undefined;
  // Look up the container's label so the badge stays in sync with renames.
  // useStore subscribes only when the looked-up label string changes, keeping
  // re-renders cheap even for very large canvases.
  const containerLabel = useStore((s: { nodes: Array<{ id: string; data: { label?: string } }> }) => {
    if (!containerId) return null;
    const found = s.nodes.find((n) => n.id === containerId);
    return found ? (found.data.label ?? null) : null;
  });
  const outputs = useMemo(
    () => resolveDynamicPorts(data.type, data.config, getNodeDefinition(data.type)),
    [data.type, data.config],
  );
  const hasMultipleOutputs = useMemo(() => {
    const defaultIds = new Set(
      (getNodeDefinition(data.type)?.outputs ?? []).map((o) => o.id),
    );
    const hasDynamic =
      outputs.length > 0 && outputs.some((p) => !defaultIds.has(p.id));
    return outputs.length > 1 || hasDynamic;
  }, [outputs, data.type]);
  const isContainer = definition?.isContainer ?? false;

  // Force React Flow to re-measure handle positions when outputs change
  // (e.g. button reorder in presentation nodes, condition changes in AI Agent)
  const updateNodeInternals = useUpdateNodeInternals();
  const outputKey = outputs.map((p) => p.id).join(",");
  useEffect(() => {
    updateNodeInternals(id);
  }, [outputKey, id, updateNodeInternals]);

  const nodeStatus = useExecutionStore((s) => s.nodeStatuses.get(id));
  const showSummary = useStore(zoomSelector);

  const isAiNode = data.type === "ai_agent" || data.type === "text_classifier" || data.type === "information_extractor";
  const { data: llmConfigsData } = useQuery({
    queryKey: ["llm-configs"],
    queryFn: () => llmConfigsApi.getAll(),
    staleTime: 30_000,
    enabled: isAiNode,
  });
  const summaryContext = useMemo<SummaryContext | undefined>(() => {
    if (!isAiNode) return undefined;
    const configs: LlmConfigData[] = llmConfigsData?.data ?? llmConfigsData ?? [];
    return { hasDefaultLlmConfig: configs.some((c) => c.isDefault) };
  }, [isAiNode, llmConfigsData]);

  const locale = useLocale();
  const summary = useMemo(
    () => getConfigSummary(data.type, data.config, summaryContext, locale),
    [data.type, data.config, summaryContext, locale],
  );

  const { display: displayText, isTruncated } = useMemo(
    () => (summary ? truncateSummary(summary.text) : { display: "", isTruncated: false }),
    [summary],
  );

  const statusStyles = useMemo(() => {
    if (!nodeStatus) return "";
    switch (nodeStatus.status) {
      case "running":
        return "ring-2 ring-blue-400 animate-pulse";
      case "completed":
        return "ring-2 ring-green-400";
      case "failed":
        return "ring-2 ring-red-400";
      case "skipped":
        return "opacity-40";
      default:
        return "";
    }
  }, [nodeStatus]);

  const isWarning = summary?.isWarning ?? false;
  // Warnings are unified as a single amber icon in the header for every node
  // type so the body keeps a consistent layout regardless of configuration
  // state. Non-warning summaries still follow the existing split: container
  // nodes render in the header, regular nodes in the body.
  const showHeaderWarning = showSummary && summary && isWarning;
  const showHeaderSummary = isContainer && showSummary && summary && !isWarning;
  const showBodySummary = !isContainer && showSummary && summary && !isWarning;

  return (
    <div
      className={cn(
        "w-[180px] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm transition-shadow",
        selected && "ring-2 ring-[hsl(var(--ring))] shadow-md",
        data.isDisabled && "opacity-50",
        statusStyles,
      )}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 rounded-t-lg px-3 py-2"
        style={{ backgroundColor: categoryColor }}
      >
        <NodeIcon name={definition?.icon ?? "HelpCircle"} size={14} className="text-white shrink-0" />
        <span className="truncate text-xs font-medium text-white">
          {data.label}
        </span>
        {showHeaderSummary && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-auto shrink-0 truncate text-[10px] text-white/70" style={{ maxWidth: "60px" }}>
                {displayText}
              </span>
            </TooltipTrigger>
            {isTruncated && (
              <TooltipContent side="bottom">{summary.text}</TooltipContent>
            )}
          </Tooltip>
        )}
        {showHeaderWarning && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="ml-auto shrink-0 inline-flex items-center justify-center text-white/70 hover:text-white transition-colors"
                role="img"
                aria-label="warning"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{summary.text}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Container membership badge — visible only for body children so users
          can verify which container a node belongs to without opening the
          settings panel. */}
      {containerId && (
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-0.5">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            in <span className="text-[hsl(var(--foreground))]">{containerLabel ?? "(deleted)"}</span>
          </span>
        </div>
      )}

      {/* Body with handles */}
      <div className="relative px-3 py-2">
        {/* Input handles — aligned to center of body. Multi-input nodes
            render a label and per-type color so ports like ForEach's
            "Input" vs "Emit" are distinguishable at a glance. */}
        {inputs.length === 1 ? (
          <Handle
            key={inputs[0].id}
            id={inputs[0].id}
            type="target"
            position={Position.Left}
            className="!h-2.5 !w-2.5 !border-2 !border-white !bg-gray-400"
            style={{ top: "50%" }}
          />
        ) : (
          <div className="flex flex-col gap-0.5">
            {inputs.map((port) => {
              const isEmit = port.id === "emit";
              return (
                <div key={port.id} className="relative flex items-center">
                  <Handle
                    id={port.id}
                    type="target"
                    position={Position.Left}
                    className={cn(
                      "!h-2.5 !w-2.5 !border-2 !border-white",
                      isEmit ? "!bg-purple-400" : "!bg-gray-400",
                    )}
                    style={{ top: "50%", left: "-12px" }}
                  />
                  <span
                    className={cn(
                      "text-[10px]",
                      isEmit
                        ? "text-purple-500"
                        : "text-[hsl(var(--muted-foreground))]",
                    )}
                  >
                    {port.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Config summary */}
        {showBodySummary && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className={cn(
                  "mb-1 truncate text-[10px] leading-tight",
                  isWarning
                    ? "text-amber-500"
                    : "text-[hsl(var(--muted-foreground))]",
                )}
              >
                {displayText}
              </p>
            </TooltipTrigger>
            {isTruncated && (
              <TooltipContent side="bottom">{summary.text}</TooltipContent>
            )}
          </Tooltip>
        )}

        {/* Port labels with co-located output handles */}
        {hasMultipleOutputs ? (
          <div className="flex flex-col gap-0.5">
            {outputs.map((port, index) => {
              const group = (port as { group?: string }).group;
              const prevGroup = index > 0 ? (outputs[index - 1] as { group?: string }).group : undefined;
              const showSystemDivider = index > 0 &&
                outputs[index - 1].type === "data" &&
                (port.type === "system" || port.type === "error");
              const showGlobalDivider = !showSystemDivider && index > 0 && prevGroup && !group;

              // resolveDynamicPorts 가 id 를 dedupe 하지만, 그 전에 port.id
              // 가 빈 문자열이 넘어오거나 미래의 새 dynamic-ports kind 가
              // 중복을 허용할 가능성을 대비해 렌더 key 에도 index 를 함께
              // 포함해 React key warning 이 재발하지 않게 한다.
              return (
              <div key={`${port.id || "port"}-${index}`}>
                {showGlobalDivider && (
                  <div className="border-t border-dashed border-[hsl(var(--border))] my-0.5" />
                )}
                {showSystemDivider && (
                  <div className="border-t border-dashed border-[hsl(var(--border))] my-0.5" />
                )}
                <div className="relative flex items-center justify-end">
                  {group ? (
                    <span className="text-[10px]">
                      <span className="text-[hsl(var(--muted-foreground))/0.6]">{group}</span>
                      <span className="text-[hsl(var(--muted-foreground))/0.4] mx-1">›</span>
                      <span className="text-[hsl(var(--muted-foreground))]">{port.label}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {port.label}
                    </span>
                  )}
                  <Handle
                    id={port.id}
                    type="source"
                    position={Position.Right}
                    className={cn(
                      "!h-2.5 !w-2.5 !border-2 !border-white",
                      port.type === "error"
                        ? "!bg-red-400"
                        : port.type === "system"
                          ? "!bg-blue-400"
                          : "!bg-green-400",
                    )}
                    style={{ top: "50%", right: "-12px" }}
                  />
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <>
            {/* Single output handle — centered */}
            {outputs.map((port) => (
              <Handle
                key={port.id}
                id={port.id}
                type="source"
                position={Position.Right}
                className={cn(
                  "!h-2.5 !w-2.5 !border-2 !border-white",
                  port.type === "error"
                    ? "!bg-red-400"
                    : port.type === "system"
                      ? "!bg-blue-400"
                      : "!bg-green-400",
                )}
                style={{ top: "50%" }}
              />
            ))}
            {!showBodySummary && <div className="h-2" />}
          </>
        )}

        {/* Execution status indicator */}
        {nodeStatus?.status === "completed" && (
          <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {nodeStatus?.status === "failed" && (
          <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold">
            !
          </div>
        )}
      </div>
    </div>
  );
}

export const CustomNode = memo(CustomNodeComponent);
