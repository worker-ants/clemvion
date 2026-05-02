"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  knowledgeBasesApi,
  type EntityType,
  type GraphVisualizationData,
} from "@/lib/api/knowledge-bases";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";

// Entity 타입별 색상. CSS 변수가 아닌 단색을 쓰는 이유는 react-flow 노드 스타일이
// inline style 로 들어가기 때문.
const TYPE_COLOR: Record<EntityType, string> = {
  person: "#3b82f6",
  organization: "#a855f7",
  concept: "#f97316",
  location: "#22c55e",
  event: "#ef4444",
  other: "#6b7280",
};

interface GraphVisualizationProps {
  kbId: string;
}

// 단순 원형 배치 — 노드 수가 변해도 안정적이고 추가 라이브러리 불필요.
// 사용자는 react-flow 의 기본 드래그/줌으로 조정 가능.
function arrangeOnCircle(
  nodes: GraphVisualizationData["nodes"],
  radius = 320,
): Node[] {
  const n = Math.max(nodes.length, 1);
  return nodes.map((node, i) => {
    const angle = (i / n) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const color = TYPE_COLOR[node.type as EntityType] ?? TYPE_COLOR.other;
    // 글자 폭에 따라 노드 너비를 약간 키운다 (단순 휴리스틱).
    const width = Math.max(120, Math.min(node.label.length * 8 + 40, 240));
    return {
      id: node.id,
      position: { x, y },
      data: { label: `${node.label} · ${node.mentionCount}` },
      style: {
        background: color,
        color: "white",
        border: "1px solid rgba(0,0,0,0.2)",
        borderRadius: 8,
        padding: 6,
        fontSize: 12,
        fontWeight: 500,
        width,
      },
    };
  });
}

function toEdges(edges: GraphVisualizationData["edges"]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.predicate,
    labelStyle: { fontSize: 10, fill: "var(--muted-foreground)" },
    labelBgStyle: { fill: "var(--background)" },
    style: { stroke: "rgba(120,120,120,0.6)", strokeWidth: Math.min(e.weight, 4) },
  }));
}

export function GraphVisualization({ kbId }: GraphVisualizationProps) {
  const t = useT();
  const [limit, setLimit] = useState(50);

  const { data, isLoading } = useQuery<GraphVisualizationData>({
    queryKey: ["kb-graph-viz", kbId, limit],
    queryFn: () => knowledgeBasesApi.getGraphVisualization(kbId, limit),
  });

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    return { nodes: arrangeOnCircle(data.nodes), edges: toEdges(data.edges) };
  }, [data]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[hsl(var(--muted-foreground))]">
          {t("knowledgeBases.graphVizLimit")}
        </span>
        <select
          value={limit}
          onChange={(e) => setLimit(parseInt(e.target.value, 10))}
          className="h-7 rounded border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
        >
          {[20, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {data?.truncated && (
          <span className="text-[hsl(var(--warning,38_92%_50%))]">
            {t("knowledgeBases.graphVizTruncated")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {Object.entries(TYPE_COLOR).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: color }}
              />
              <span className="text-[10px] uppercase">{type}</span>
            </span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[600px] items-center justify-center rounded-lg border border-[hsl(var(--border))]">
          <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex h-[600px] items-center justify-center rounded-lg border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))]">
          {t("knowledgeBases.graphVizEmpty")}
        </div>
      ) : (
        <div className="h-[600px] rounded-lg border border-[hsl(var(--border))]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesConnectable={false}
            edgesReconnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} />
            <Controls />
            <MiniMap
              nodeColor={(n) => (n.style?.background as string) ?? "#888"}
              maskColor="rgba(0,0,0,0.1)"
            />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
