"use client";

import { memo } from "react";
import { BezierEdge } from "@xyflow/react";
import type { EdgeProps, Edge } from "@xyflow/react";
import { PORT_TYPE_COLORS, type EdgePortType } from "@/lib/utils/edge-utils";

type CustomEdgeType = Edge<Record<string, unknown>, "custom">;

function CustomEdgeComponent(props: EdgeProps<CustomEdgeType>) {
  const data = props.data as Record<string, unknown> | undefined;
  const portType = (data?.portType as EdgePortType | undefined) ?? "data";
  const portColor = PORT_TYPE_COLORS[portType];
  const isHighlighted = data?.isHighlighted === true;

  const edgeStroke = props.selected
    ? "hsl(var(--primary))"
    : portColor;

  const strokeWidth = isHighlighted || props.selected ? 2.5 : 1.5;

  return (
    <BezierEdge
      {...props}
      style={{
        stroke: edgeStroke,
        strokeWidth,
        ...props.style,
      }}
      markerEnd={`url(#arrow-${portType})`}
    />
  );
}

export const CustomEdge = memo(CustomEdgeComponent);

function ArrowMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );
}

/**
 * SVG marker definitions for edge arrows.
 * Render this inside the ReactFlow component area.
 */
export function EdgeMarkerDefs() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        <ArrowMarker id="arrow-data" color={PORT_TYPE_COLORS.data} />
        <ArrowMarker id="arrow-system" color={PORT_TYPE_COLORS.system} />
        <ArrowMarker id="arrow-error" color={PORT_TYPE_COLORS.error} />
        <ArrowMarker id="arrow-container" color={PORT_TYPE_COLORS.container} />
      </defs>
    </svg>
  );
}
