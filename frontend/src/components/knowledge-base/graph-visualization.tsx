"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  knowledgeBasesApi,
  type EntityType,
  type GraphVisualizationData,
} from "@/lib/api/knowledge-bases";
import { NativeSelect } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n";

// Entity 타입별 legend 색상. 3D 노드 material 과 동일 (graph-3d-renderer.tsx 의 TYPE_COLOR).
const TYPE_COLOR: Record<EntityType, string> = {
  person: "#3b82f6",
  organization: "#a855f7",
  concept: "#f97316",
  location: "#22c55e",
  event: "#ef4444",
  other: "#6b7280",
};

// 3D 렌더러는 three.js / WebGL 의존성으로 SSR 환경에서 import 자체가 실패한다.
// `ssr: false` 로 client 마운트 후에만 로드 + 첫 페인트는 가벼운 placeholder.
const Graph3DRenderer = dynamic(() => import("./graph-3d-renderer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading 3D graph…
    </div>
  ),
});

interface GraphVisualizationProps {
  kbId: string;
}

const VIEWPORT_HEIGHT = 600;

export function GraphVisualization({ kbId }: GraphVisualizationProps) {
  const t = useT();
  const [limit, setLimit] = useState(50);

  const { data, isLoading } = useQuery<GraphVisualizationData>({
    queryKey: ["kb-graph-viz", kbId, limit],
    queryFn: () => knowledgeBasesApi.getGraphVisualization(kbId, limit),
  });

  // ForceGraph 는 width/height 를 px 로 받으므로 컨테이너 width 를 ResizeObserver
  // 로 측정해 전달. SSR 단계에서는 ref 가 없으므로 0 → dynamic import 가 client
  // 마운트 후에 다시 렌더링 → 정확한 width 측정.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[hsl(var(--muted-foreground))]">
          {t("knowledgeBases.graphVizLimit")}
        </span>
        <NativeSelect
          value={limit}
          onChange={(e) => setLimit(parseInt(e.target.value, 10))}
          className="h-7 w-auto px-2 text-xs"
        >
          {[20, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </NativeSelect>
        {data?.truncated && (
          <span className="text-[hsl(var(--warning,38_92%_50%))]">
            {t("knowledgeBases.graphVizTruncated", { limit })}
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

      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[#0b0d12]"
        style={{ height: VIEWPORT_HEIGHT }}
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-[hsl(var(--muted-foreground))]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !data || data.nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
            {t("knowledgeBases.graphVizEmpty")}
          </div>
        ) : width > 0 ? (
          <Graph3DRenderer
            data={data}
            width={width}
            height={VIEWPORT_HEIGHT}
          />
        ) : null}
      </div>

      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        드래그로 회전 · 휠로 줌 · 노드 클릭 시 카메라 이동
      </p>
    </div>
  );
}
