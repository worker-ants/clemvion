"use client";

import { memo, useMemo } from "react";
import { Handle, Position, useStore } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { cn } from "@/lib/utils/cn";
import { getNodeDefinition, CATEGORY_COLORS } from "@/lib/node-definitions";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { getConfigSummary, truncateSummary } from "@/lib/utils/node-config-summary";
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
  const categoryColor = CATEGORY_COLORS[data.category] ?? "#6B7280";
  const inputs = definition?.inputs ?? [];
  const outputs = definition?.outputs ?? [];
  const hasMultipleOutputs = outputs.length > 1;
  const isContainer = definition?.isContainer ?? false;

  const nodeStatus = useExecutionStore((s) => s.nodeStatuses.get(id));
  const showSummary = useStore(zoomSelector);

  const summary = useMemo(
    () => getConfigSummary(data.type, data.config),
    [data.type, data.config],
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
  // Container nodes show non-warning summary in the header
  const showHeaderSummary = isContainer && showSummary && summary && !isWarning;
  // Body summary: regular nodes always, container nodes only for warnings
  const showBodySummary = showSummary && summary && (!isContainer || isWarning);

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
      </div>

      {/* Body with handles */}
      <div className="relative px-3 py-2">
        {/* Input handles */}
        {inputs.map((port, index) => (
          <Handle
            key={port.id}
            id={port.id}
            type="target"
            position={Position.Left}
            className="!h-2.5 !w-2.5 !border-2 !border-white !bg-gray-400"
            style={{
              top: inputs.length === 1
                ? "50%"
                : `${((index + 1) / (inputs.length + 1)) * 100}%`,
            }}
          />
        ))}

        {/* Output handles */}
        {outputs.map((port, index) => (
          <Handle
            key={port.id}
            id={port.id}
            type="source"
            position={Position.Right}
            className={cn(
              "!h-2.5 !w-2.5 !border-2 !border-white",
              port.type === "error" ? "!bg-red-400" : "!bg-green-400",
            )}
            style={{
              top: outputs.length === 1
                ? "50%"
                : `${((index + 1) / (outputs.length + 1)) * 100}%`,
            }}
          />
        ))}

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

        {/* Port labels for multi-output nodes */}
        {hasMultipleOutputs && (
          <div className="flex flex-col gap-0.5">
            {outputs.map((port) => (
              <div key={port.id} className="flex items-center justify-end">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {port.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Minimal body height for single output nodes */}
        {!hasMultipleOutputs && !showBodySummary && <div className="h-2" />}

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
