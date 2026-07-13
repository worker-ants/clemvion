"use client";

import { useMemo } from "react";
import type { Edge } from "@xyflow/react";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { useT } from "@/lib/i18n";
import { unwrapNodeOutput } from "../run-results/output-shape";
import { JsonContent } from "../run-results/renderers/presentation-renderers";
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
 * §5 — 엣지로 흐른 데이터(연결원 노드의 실행 출력)를 조회한다. 엣지의 source 노드 **최근**
 * 실행 결과를 store 공유 selector `findLatestResultByNodeId`(O(1))로 찾아
 * `unwrapNodeOutput().output`(실제 산출값)만 돌려준다. 미실행/결과 없음이면 undefined.
 * 툴팁과 모달이 공유한다.
 */
function useEdgeFlowData(edgeId: string, edges: Edge[]): unknown {
  const edge = useMemo(
    () => (edgeId ? edges.find((e) => e.id === edgeId) : undefined),
    [edges, edgeId],
  );
  const sourceId = edge?.source;
  const result = useExecutionStore((s) =>
    sourceId ? s.findLatestResultByNodeId(sourceId) : undefined,
  );
  return useMemo(
    () => (result ? unwrapNodeOutput(result.outputData).output : undefined),
    [result],
  );
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
  const t = useT();
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
        {t("editor.edgeDataPreviewTitle")}
      </div>
      <pre className="max-h-48 overflow-auto px-3 py-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
        {summary.preview}
      </pre>
      <div className="flex items-center justify-between border-t border-[hsl(var(--border))] px-3 py-1.5">
        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
          {t("editor.edgeDataSize")}: {summary.bytesApprox ? "~" : ""}
          {formatBytes(summary.bytes)}
        </span>
        <button
          type="button"
          className="text-[11px] font-medium text-[hsl(var(--primary))] hover:underline"
          onClick={() => onOpenModal(edgeId)}
        >
          {t("editor.edgeViewFullData")}
        </button>
      </div>
    </div>
  );
}

/**
 * §5 — "전체 데이터 보기" 모달. 축약 없이 전체 데이터를 `JsonContent`(run-results 공용 뷰어)로
 * 보여준다. hover 툴팁과 독립적으로(canvas 가 소유한 `modalEdgeId` 로) 열려, 툴팁이 사라져도
 * 유지된다.
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
  const t = useT();
  const data = useEdgeFlowData(edgeId ?? "", edges);
  return (
    <Dialog open={edgeId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("editor.edgeDataPreviewTitle")}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          {data == null ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {t("editor.edgeNoData")}
            </p>
          ) : (
            <JsonContent data={data} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
