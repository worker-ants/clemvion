"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import ForceGraph3D, {
  type ForceGraphMethods,
  type NodeObject,
} from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import DOMPurify from "dompurify";
import type {
  EntityType,
  GraphVisualizationData,
} from "@/lib/api/knowledge-bases";
import {
  CAMERA_FOCUS_DISTANCE,
  CAMERA_TRANSITION_MS,
  GRAPH_BG_COLOR,
  LABEL_BASE_OFFSET,
  NODE_BASE_SIZE,
  TYPE_COLOR,
  ZOOM_TO_FIT_DURATION_MS,
  ZOOM_TO_FIT_PADDING,
} from "./graph-constants";

interface Graph3DNode {
  id: string;
  label: string;
  type: EntityType | string;
  mentionCount: number;
}

interface Graph3DLink {
  // edge.id 는 향후 엣지 하이라이트용 — 현재 미사용이지만 contract 보존.
  id?: string;
  source: string;
  target: string;
  predicate: string;
  weight: number;
}

interface Graph3DRendererProps {
  data: GraphVisualizationData;
  height: number;
  width: number;
}

type Graph3DMethodsRef = ForceGraphMethods<
  NodeObject<Graph3DNode>,
  Graph3DLink
>;

const NODE_OPACITY = 0.92;
const LINK_OPACITY = 0.5;
const LINK_BASE_WIDTH = 0.4;
const ARROW_LENGTH = 2.5;
const ARROW_REL_POS = 0.95;
const SPRITE_TEXT_HEIGHT = 4;
const SPRITE_BG = "rgba(0,0,0,0.55)";
const SPRITE_FG = "#ffffff";
const LINK_COLOR = "rgba(255,255,255,0.18)";
const ARROW_COLOR = "rgba(255,255,255,0.4)";

/** mentionCount 기반 노드 시각 크기 (force-graph nodeVal 공식과 sprite 위치 동기화용). */
function nodeVisualRadius(mentionCount: number): number {
  return Math.sqrt(Math.max(mentionCount, 1)) * 2;
}

/** 3D force-directed knowledge graph renderer — 부모에서 next/dynamic + ssr:false 로 lazy load. */
export default function Graph3DRenderer({
  data,
  height,
  width,
}: Graph3DRendererProps) {
  const fgRef = useRef<Graph3DMethodsRef | undefined>(undefined);
  // 한 마운트 동안 생성된 SpriteText 의 텍스처 / material — unmount 시 dispose.
  const spritesRef = useRef<SpriteText[]>([]);

  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map<Graph3DNode>((n) => ({
        id: n.id,
        label: DOMPurify.sanitize(n.label),
        type: n.type,
        mentionCount: n.mentionCount,
      })),
      links: data.edges.map<Graph3DLink>((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        predicate: DOMPurify.sanitize(e.predicate),
        weight: e.weight,
      })),
    }),
    [data],
  );

  // 새 데이터 로드 시 이전 sprite 들의 GPU 리소스 해제. 새 sprite 들은 onEngineStop
  // 직전에 force-graph 가 새로 만들어 nodeThreeObject 로 들어온다.
  useEffect(() => {
    const sprites = spritesRef.current;
    return () => {
      for (const sprite of sprites) {
        sprite.material?.map?.dispose();
        sprite.material?.dispose();
      }
      spritesRef.current = [];
    };
  }, [graphData]);

  const nodeColor = useCallback(
    (n: Graph3DNode) =>
      TYPE_COLOR[n.type as EntityType] ?? TYPE_COLOR.other,
    [],
  );
  const nodeVal = useCallback(
    (n: Graph3DNode) => nodeVisualRadius(n.mentionCount),
    [],
  );
  const nodeThreeObject = useCallback((n: Graph3DNode) => {
    const sprite = new SpriteText(`${n.label} · ${n.mentionCount}`);
    sprite.material.depthWrite = false;
    sprite.color = SPRITE_FG;
    sprite.backgroundColor = SPRITE_BG;
    sprite.padding = 2;
    sprite.borderRadius = 3;
    sprite.textHeight = SPRITE_TEXT_HEIGHT;
    // 라벨이 노드 sphere 내부에 파묻히지 않도록 노드 반지름 + 베이스 오프셋.
    sprite.position.set(
      0,
      nodeVisualRadius(n.mentionCount) + LABEL_BASE_OFFSET,
      0,
    );
    spritesRef.current.push(sprite);
    return sprite;
  }, []);

  const linkColor = useCallback(() => LINK_COLOR, []);
  const linkWidth = useCallback(
    (l: Graph3DLink) =>
      Math.max(0.3, Math.min(l.weight, 4) * LINK_BASE_WIDTH),
    [],
  );
  const linkLabel = useCallback((l: Graph3DLink) => l.predicate, []);
  const arrowColor = useCallback(() => ARROW_COLOR, []);

  // 시뮬레이션 수렴 직후 한 번만 카메라 fit — 1200ms 하드코딩 타이머 대체.
  const handleEngineStop = useCallback(() => {
    fgRef.current?.zoomToFit(
      ZOOM_TO_FIT_DURATION_MS,
      ZOOM_TO_FIT_PADDING,
    );
  }, []);

  const handleNodeClick = useCallback((n: NodeObject<Graph3DNode>) => {
    const fg = fgRef.current;
    if (!fg) return;
    const x = n.x ?? 0;
    const y = n.y ?? 0;
    const z = n.z ?? 0;
    const radius = Math.hypot(x, y, z) || 1;
    const distRatio = 1 + CAMERA_FOCUS_DISTANCE / radius;
    fg.cameraPosition(
      { x: x * distRatio, y: y * distRatio, z: z * distRatio },
      { x, y, z },
      CAMERA_TRANSITION_MS,
    );
  }, []);

  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor={GRAPH_BG_COLOR}
      nodeRelSize={NODE_BASE_SIZE}
      nodeVal={nodeVal}
      nodeColor={nodeColor}
      nodeOpacity={NODE_OPACITY}
      nodeThreeObject={nodeThreeObject}
      nodeThreeObjectExtend
      linkColor={linkColor}
      linkOpacity={LINK_OPACITY}
      linkWidth={linkWidth}
      linkLabel={linkLabel}
      linkDirectionalArrowLength={ARROW_LENGTH}
      linkDirectionalArrowRelPos={ARROW_REL_POS}
      linkDirectionalArrowColor={arrowColor}
      enableNodeDrag
      onNodeClick={handleNodeClick}
      onEngineStop={handleEngineStop}
    />
  );
}
