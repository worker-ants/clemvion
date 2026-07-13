"use client";

import { useMemo } from "react";
import type { Edge } from "@xyflow/react";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { unwrapNodeOutput } from "../run-results/output-shape";
import {
  summarizeDataForPreview,
  formatBytes,
} from "@/lib/utils/edge-data-preview";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * §5 — 엣지로 흐른 데이터(연결원 노드의 실행 출력)를 조회한다. 엣지의 source 노드 실행
 * 결과를 `findNodeResult` 로 찾아 `unwrapNodeOutput().output`(실제 산출값)만 돌려준다.
 * 미실행/결과 없음이면 undefined. 툴팁과 모달이 공유한다.
 */
function useEdgeFlowData(edgeId: string, edges: Edge[]): unknown {
  const nodeResults = useExecutionStore((s) => s.nodeResults);
  return useMemo(() => {
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return undefined;
    // 연결원 노드의 가장 최근 실행 결과 — nodeResults 는 도착 순서라 뒤에서 첫 매치가 최신
    // (Loop/ForEach 로 여러 번 실행된 노드는 마지막 iteration 출력을 미리보기로 보여준다).
    let result: (typeof nodeResults)[number] | undefined;
    for (let i = nodeResults.length - 1; i >= 0; i--) {
      if (nodeResults[i].nodeId === edge.source) {
        result = nodeResults[i];
        break;
      }
    }
    if (!result) return undefined;
    return unwrapNodeOutput(result.outputData).output;
  }, [edges, edgeId, nodeResults]);
}

/**
 * §4/§5 — 엣지 hover 데이터 미리보기 툴팁(Data Flow Preview). 실행 후 source 노드가 만든
 * 데이터를 축약해 커서 근처에 띄운다. 데이터가 없으면(미실행/빈 값) 아무것도 렌더하지 않는다.
 * 마우스가 툴팁 위로 오면 `onKeepAlive` 로 숨김을 취소해 "전체 데이터 보기" 클릭이 가능하다.
 */
export function EdgeDataPreviewTooltip({
  edgeId,
  x,
  y,
  edges,
  onKeepAlive,
  onDismiss,
  onOpenModal,
}: {
  edgeId: string;
  x: number;
  y: number;
  edges: Edge[];
  onKeepAlive: () => void;
  onDismiss: () => void;
  onOpenModal: (edgeId: string) => void;
}) {
  const data = useEdgeFlowData(edgeId, edges);
  const summary = useMemo(() => summarizeDataForPreview(data), [data]);

  if (data === undefined || summary.isEmpty) return null;

  return (
    <div
      className="fixed z-50 w-80 max-w-[80vw] overflow-hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg"
      style={{ left: x + 12, top: y + 12 }}
      onMouseEnter={onKeepAlive}
      onMouseLeave={onDismiss}
      role="tooltip"
    >
      <div className="border-b border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--foreground))]">
        Data Flow Preview
      </div>
      <pre className="max-h-48 overflow-auto px-3 py-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
        {summary.preview}
      </pre>
      <div className="flex items-center justify-between border-t border-[hsl(var(--border))] px-3 py-1.5">
        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
          Size: {formatBytes(summary.bytes)}
        </span>
        <button
          type="button"
          className="text-[11px] font-medium text-[hsl(var(--primary))] hover:underline"
          onClick={() => onOpenModal(edgeId)}
        >
          전체 데이터 보기
        </button>
      </div>
    </div>
  );
}

/**
 * §5 — "전체 데이터 보기" 모달. 축약 없이 전체 JSON 을 보여준다. hover 툴팁과 독립적으로
 * (canvas 가 소유한 `modalEdgeId` 로) 열려, 툴팁이 사라져도 유지된다.
 */
export function EdgeDataModal({
  edgeId,
  edges,
  onClose,
}: {
  edgeId: string | null;
  edges: Edge[];
  onClose: () => void;
}) {
  const data = useEdgeFlowData(edgeId ?? "", edges);
  return (
    <Dialog open={edgeId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Data Flow Preview</DialogTitle>
        </DialogHeader>
        <pre className="max-h-[60vh] overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 text-xs leading-relaxed">
          {data === undefined
            ? "표시할 데이터가 없어요."
            : JSON.stringify(data, null, 2)}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
