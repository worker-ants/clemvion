import { useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import { useExecutionStore } from "@/lib/stores/execution-store";
import {
  resolveEdgeExecutionState,
  FLOWING_EDGE_CLASS,
  COMPLETED_EDGE_CLASS,
} from "@/lib/utils/edge-utils";

/**
 * §3.2 — 엣지에 실행 상태 스타일을 입힌다. 각 엣지에 대해 `resolveEdgeExecutionState` 로
 * 상태를 판정한 뒤:
 *  - 데이터 흐름(flowing) → `edge.className = FLOWING_EDGE_CLASS`(globals.css 마칭 점선)
 *  - 실행 완료(completed) → `edge.className = COMPLETED_EDGE_CLASS`(globals.css 1회성 초록 flash)
 *  - 비활성(inactive) → `edge.data.edgeInactive`(custom-edge 가 반투명 점선으로 렌더)
 *
 * 실행 컨텍스트가 전혀 없으면(비활성 노드 0 + 미실행 + 노드상태 0) 원본 edges 참조를 그대로
 * 반환해 React Flow diff 를 0 으로 유지한다(하이라이팅 훅과 동일 패턴). `useEdgeHighlighting`
 * 앞단에서 합성해 실행 상태 위에 hover/선택 하이라이트가 얹히게 한다.
 */
export function useEdgeExecutionState(edges: Edge[], nodes: Node[]): Edge[] {
  const executing = useExecutionStore((s) => s.status === "running");
  const nodeStatuses = useExecutionStore((s) => s.nodeStatuses);

  const disabledNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of nodes) {
      if ((n.data as { isDisabled?: boolean } | undefined)?.isDisabled) {
        set.add(n.id);
      }
    }
    return set;
  }, [nodes]);

  const nodeStatusById = useMemo(() => {
    const map = new Map<string, string>();
    nodeStatuses.forEach((info, id) => map.set(id, info.status));
    return map;
  }, [nodeStatuses]);

  return useMemo(() => {
    // 실행/비활성 상태가 하나도 없으면 원본 참조 유지(불필요한 re-render 방지).
    if (
      disabledNodeIds.size === 0 &&
      !executing &&
      nodeStatusById.size === 0
    ) {
      return edges;
    }
    const ctx = { disabledNodeIds, nodeStatusById, executing };
    return edges.map((edge) => {
      const state = resolveEdgeExecutionState(edge, ctx);
      // flowing·completed 는 상호배타 → 둘 중 하나만 className 으로. 나머지는 undefined 로
      // 두어 useEdgeHighlighting 의 Set 병합이 edge-highlighted 만 얹게 한다.
      const className = state.flowing
        ? FLOWING_EDGE_CLASS
        : state.completed
          ? COMPLETED_EDGE_CLASS
          : undefined;
      return {
        ...edge,
        className,
        data: {
          ...((edge.data as Record<string, unknown> | undefined) ?? {}),
          edgeInactive: state.inactive,
        },
      };
    });
  }, [edges, disabledNodeIds, nodeStatusById, executing]);
}
