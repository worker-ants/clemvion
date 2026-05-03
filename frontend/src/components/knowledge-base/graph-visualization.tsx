"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  knowledgeBasesApi,
  type GraphVisualizationData,
} from "@/lib/api/knowledge-bases";
import { NativeSelect } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n";
import {
  GRAPH_BG_COLOR,
  TYPE_COLOR,
  VIEWPORT_HEIGHT,
} from "./graph-constants";

// 3D 렌더러는 three.js / WebGL 의존성으로 SSR 환경에서 import 자체가 실패한다.
// `ssr: false` 로 client 마운트 후에만 로드 + 첫 페인트는 가벼운 placeholder.
function Graph3DLoading() {
  const t = useT();
  return (
    <div className="flex h-full items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {t("knowledgeBases.graphVizLoading3d")}
    </div>
  );
}

const Graph3DRenderer = dynamic(() => import("./graph-3d-renderer"), {
  ssr: false,
  loading: () => <Graph3DLoading />,
});

interface GraphVisualizationProps {
  kbId: string;
}

export function GraphVisualization({ kbId }: GraphVisualizationProps) {
  const t = useT();
  const [limit, setLimit] = useState(50);

  const { data, isLoading, isError } = useQuery<GraphVisualizationData>({
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
        className="overflow-hidden rounded-lg border border-[hsl(var(--border))]"
        style={{ height: VIEWPORT_HEIGHT, background: GRAPH_BG_COLOR }}
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-[hsl(var(--muted-foreground))]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--destructive))]">
            {t("knowledgeBases.graphVizLoadFailed")}
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
        {t("knowledgeBases.graphVizControlsHint")}
      </p>
    </div>
  );
}
