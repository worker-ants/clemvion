"use client";

import { memo } from "react";
import {
  BezierEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from "@xyflow/react";
import type { EdgeProps, Edge } from "@xyflow/react";

type CustomEdgeType = Edge<Record<string, unknown>, "custom">;

const HIDDEN_LABELS = new Set(["out", "in", "body"]);

function formatLabel(port: string): string {
  if (port === "true") return "True";
  if (port === "false") return "False";
  if (port === "default") return "Default";
  if (port === "done") return "Done";
  if (port === "error") return "Error";
  if (port.startsWith("case_")) {
    const num = parseInt(port.replace("case_", ""), 10);
    return `Case ${num + 1}`;
  }
  if (port.startsWith("branch_")) {
    const num = parseInt(port.replace("branch_", ""), 10);
    return `Branch ${num + 1}`;
  }
  return port.charAt(0).toUpperCase() + port.slice(1);
}

function CustomEdgeComponent(props: EdgeProps<CustomEdgeType>) {
  const sourcePort = (props.data as Record<string, unknown>)?.sourcePort as string | undefined;
  const showLabel = sourcePort && !HIDDEN_LABELS.has(sourcePort);
  const isError = (props.data as Record<string, unknown>)?.type === "error" || sourcePort === "error";

  const edgeStroke = isError
    ? "#ef4444"
    : props.selected
      ? "hsl(var(--primary))"
      : "#94a3b8";

  const [, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  return (
    <>
      <BezierEdge
        {...props}
        style={{
          stroke: edgeStroke,
          strokeWidth: props.selected ? 2.5 : 1.5,
          strokeDasharray: isError ? "4 4" : undefined,
          ...props.style,
        }}
        markerEnd={`url(#${isError ? "arrow-error" : props.selected ? "arrow-selected" : "arrow"})`}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] nodrag nopan"
          >
            {formatLabel(sourcePort)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const CustomEdge = memo(CustomEdgeComponent);

/**
 * SVG marker definitions for edge arrows.
 * Render this inside the ReactFlow component area.
 */
export function EdgeMarkerDefs() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
        </marker>
        <marker
          id="arrow-selected"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
        </marker>
        <marker
          id="arrow-error"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
        </marker>
      </defs>
    </svg>
  );
}
