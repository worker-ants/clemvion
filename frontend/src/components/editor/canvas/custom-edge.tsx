"use client";

import { memo } from "react";
import { BezierEdge } from "@xyflow/react";
import type { EdgeProps, Edge } from "@xyflow/react";

type CustomEdgeType = Edge<Record<string, unknown>, "custom">;

function CustomEdgeComponent(props: EdgeProps<CustomEdgeType>) {
  return (
    <BezierEdge
      {...props}
      style={{
        stroke: props.selected ? "hsl(var(--primary))" : "#94a3b8",
        strokeWidth: props.selected ? 2.5 : 1.5,
        ...props.style,
      }}
      markerEnd={`url(#${props.selected ? "arrow-selected" : "arrow"})`}
    />
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
      </defs>
    </svg>
  );
}
