"use client";

import { useEffect, useMemo, useRef } from "react";
import ForceGraph3D, {
  type ForceGraphMethods,
  type NodeObject,
} from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import type {
  EntityType,
  GraphVisualizationData,
} from "@/lib/api/knowledge-bases";

// Entity type 별 노드 색상 (run-results 의 RAG 칩과 같은 톤). HSL CSS 변수가
// three.js material 에서 동작하지 않으므로 hex 로 박는다.
const TYPE_COLOR: Record<EntityType, string> = {
  person: "#3b82f6",
  organization: "#a855f7",
  concept: "#f97316",
  location: "#22c55e",
  event: "#ef4444",
  other: "#6b7280",
};

interface Graph3DNode {
  id: string;
  label: string;
  type: EntityType | string;
  mentionCount: number;
}

interface Graph3DLink {
  source: string;
  target: string;
  predicate: string;
  weight: number;
}

interface Graph3DRendererProps {
  data: GraphVisualizationData;
  /** 컨테이너 높이 — 부모가 wrapper 의 box 를 책임지므로 px 로 받는다. */
  height: number;
  /** 컨테이너 너비. ResizeObserver 가 부모 width 를 알려주고 here 에서 반영. */
  width: number;
}

/**
 * 3D force-directed knowledge graph renderer.
 *
 * `react-force-graph-3d` 는 three.js 와 WebGL 에 의존해 SSR 환경에서 import 자체가
 * 실패한다. 이 컴포넌트는 부모 (`graph-visualization.tsx`) 에서 `next/dynamic` +
 * `ssr: false` 로 lazy load 되어 클라이언트 마운트 후에만 초기화된다.
 *
 * 디자인 결정:
 * - 노드 라벨은 `three-spritetext` sprite 로 — 카메라 회전과 무관하게 항상 정면.
 * - 노드 크기는 mentionCount 의 √ 비례 (큰 entity 가 너무 압도하지 않도록 완화).
 * - edge label 은 화면 노이즈가 커서 default off — link tooltip 으로 확인.
 * - 노드 클릭 시 카메라가 해당 노드로 줌-인 (UX 가속).
 */
type Graph3DMethodsRef = ForceGraphMethods<
  NodeObject<Graph3DNode>,
  Graph3DLink
>;

export default function Graph3DRenderer({
  data,
  height,
  width,
}: Graph3DRendererProps) {
  const fgRef = useRef<Graph3DMethodsRef | undefined>(undefined);

  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map<Graph3DNode>((n) => ({
        id: n.id,
        label: n.label,
        type: n.type,
        mentionCount: n.mentionCount,
      })),
      links: data.edges.map<Graph3DLink>((e) => ({
        source: e.source,
        target: e.target,
        predicate: e.predicate,
        weight: e.weight,
      })),
    }),
    [data],
  );

  // 데이터가 바뀌면 카메라를 새 그래프 중심으로 한 번 fit. 마운트 직후엔 첫 frame
  // 후에 호출해야 노드 좌표가 시뮬레이션으로 잡혀 있다 (1000ms 정도 안정화 대기).
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const timer = window.setTimeout(() => {
      fg.zoomToFit(400, 60);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [graphData]);

  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor="#0b0d12"
      nodeRelSize={5}
      nodeVal={(n: Graph3DNode) => Math.sqrt(Math.max(n.mentionCount, 1)) * 2}
      nodeColor={(n: Graph3DNode) =>
        TYPE_COLOR[n.type as EntityType] ?? TYPE_COLOR.other
      }
      nodeOpacity={0.92}
      nodeThreeObject={(n: Graph3DNode) => {
        const sprite = new SpriteText(`${n.label} · ${n.mentionCount}`);
        sprite.material.depthWrite = false;
        sprite.color = "#ffffff";
        sprite.backgroundColor = "rgba(0,0,0,0.55)";
        sprite.padding = 2;
        sprite.borderRadius = 3;
        sprite.textHeight = 4;
        sprite.position.set(0, 8, 0);
        return sprite;
      }}
      // sprite 만 아니라 노드 sphere 도 같이 렌더 (라벨 + 점 동시).
      nodeThreeObjectExtend
      linkColor={() => "rgba(255,255,255,0.18)"}
      linkOpacity={0.5}
      linkWidth={(l: Graph3DLink) => Math.max(0.3, Math.min(l.weight, 4) * 0.4)}
      linkLabel={(l: Graph3DLink) => l.predicate}
      linkDirectionalArrowLength={2.5}
      linkDirectionalArrowRelPos={0.95}
      linkDirectionalArrowColor={() => "rgba(255,255,255,0.4)"}
      enableNodeDrag
      onNodeClick={(n: NodeObject<Graph3DNode>) => {
        const fg = fgRef.current;
        if (!fg) return;
        // 카메라를 노드 정면에서 일정 거리 떨어진 위치로 이동.
        const distance = 60;
        const x = n.x ?? 0;
        const y = n.y ?? 0;
        const z = n.z ?? 0;
        const radius = Math.hypot(x, y, z) || 1;
        const distRatio = 1 + distance / radius;
        fg.cameraPosition(
          { x: x * distRatio, y: y * distRatio, z: z * distRatio },
          { x, y, z },
          1000,
        );
      }}
    />
  );
}
