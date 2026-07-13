"use client";

import { memo } from "react";
import { BezierEdge } from "@xyflow/react";
import type { EdgeProps, Edge } from "@xyflow/react";
import {
  PORT_TYPE_COLORS,
  buildEdgeStyle,
  type EdgePortType,
} from "@/lib/utils/edge-utils";

type CustomEdgeType = Edge<Record<string, unknown>, "custom">;

function CustomEdgeComponent(props: EdgeProps<CustomEdgeType>) {
  const data = props.data as Record<string, unknown> | undefined;
  const portType = (data?.portType as EdgePortType | undefined) ?? "data";
  const portColor = PORT_TYPE_COLORS[portType];
  const isHighlighted = data?.isHighlighted === true;
  // §3.2 — 비활성(disabled) 노드에 연결된 엣지는 반투명 점선. 데이터 흐름·완료 flash 는
  // `edge.className`(`edge-flowing`/`edge-completed`)을 globals.css 의 CSS 애니메이션이
  // 소비하므로 여기서는 정적 상태인 inactive 만 스타일링한다. style 조립은 순수 함수
  // `buildEdgeStyle`(단위 테스트) 로 분리.
  const inactive = data?.edgeInactive === true;

  return (
    <BezierEdge
      {...props}
      style={buildEdgeStyle({
        portColor,
        selected: props.selected === true,
        isHighlighted,
        inactive,
        baseStyle: props.style,
      })}
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
