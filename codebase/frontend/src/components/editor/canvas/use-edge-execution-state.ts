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
 * `useEdgeHighlighting`(§3.3) **앞단**에서 합성해 실행 상태 위에 hover/선택 하이라이트가 얹히게
 * 한다(className Set 병합). 성능을 위해 형제 훅과 동일한 최적화를 따른다:
 *  - **per-edge bail-out** — 상태가 바뀌지 않은 엣지는 **원본 객체 참조를 그대로 반환**해
 *    `memo(CustomEdge)` 얕은 비교가 유지되게 한다. 실행 중 매 tick `nodeStatuses` 가 새 Map 으로
 *    바뀌어도, 실제로 상태가 변한 소수의 엣지(활성 경로)만 새 객체가 되고 나머지는 재사용된다.
 *  - **안정적 disabled 키** — 비활성 노드 집합을 `nodes` 배열 참조가 아니라 disabled id 들의
 *    정렬 문자열에 의존해 계산한다. 노드 드래그(위치만 변경)로 `nodes` 참조가 바뀌어도 비활성
 *    집합·결과 배열이 재생성되지 않는다.
 */
export function useEdgeExecutionState(edges: Edge[], nodes: Node[]): Edge[] {
  const executing = useExecutionStore((s) => s.status === "running");
  const nodeStatuses = useExecutionStore((s) => s.nodeStatuses);

  // 비활성 노드 id 의 안정적 1차 표현(정렬 join). 드래그로 nodes 참조만 바뀌면 값이 동일해
  // 아래 memo 들이 재계산되지 않는다.
  const disabledKey = useMemo(() => {
    const ids: string[] = [];
    for (const n of nodes) {
      if ((n.data as { isDisabled?: boolean } | undefined)?.isDisabled) {
        ids.push(n.id);
      }
    }
    return ids.sort().join(",");
  }, [nodes]);

  const disabledNodeIds = useMemo(
    () => new Set(disabledKey ? disabledKey.split(",") : []),
    [disabledKey],
  );

  const nodeStatusById = useMemo(() => {
    const map = new Map<string, string>();
    nodeStatuses.forEach((info, id) => map.set(id, info.status));
    return map;
  }, [nodeStatuses]);

  return useMemo(() => {
    // 실행/비활성 상태가 하나도 없으면 원본 참조 유지(불필요한 re-render 방지).
    if (disabledNodeIds.size === 0 && !executing && nodeStatusById.size === 0) {
      return edges;
    }
    const ctx = { disabledNodeIds, nodeStatusById, executing };
    let changed = false;
    const next = edges.map((edge) => {
      const state = resolveEdgeExecutionState(edge, ctx);
      // flowing·completed 는 상호배타 → 둘 중 하나만 className 으로.
      const className = state.flowing
        ? FLOWING_EDGE_CLASS
        : state.completed
          ? COMPLETED_EDGE_CLASS
          : undefined;
      const prevInactive =
        (edge.data as { edgeInactive?: boolean } | undefined)?.edgeInactive ===
        true;
      // per-edge bail-out — 부여할 className·inactive 가 직전과 동일하면 원본 참조 유지.
      if (className === edge.className && state.inactive === prevInactive) {
        return edge;
      }
      changed = true;
      return {
        ...edge,
        className,
        data: {
          ...((edge.data as Record<string, unknown> | undefined) ?? {}),
          edgeInactive: state.inactive,
        },
      };
    });
    // 어떤 엣지도 안 바뀌었으면 원본 배열 참조를 반환(React Flow diff 0).
    return changed ? next : edges;
  }, [edges, disabledNodeIds, nodeStatusById, executing]);
}
