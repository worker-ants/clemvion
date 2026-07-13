import { useCallback, useRef } from "react";
import type { Connection, Edge, OnReconnect } from "@xyflow/react";

/**
 * §1.3 — 기존 엣지 끝점(source/target 앵커) 재연결 + detach(빈 영역 드롭 시 삭제)
 * 오케스트레이션. React Flow 가 reconnectable 엣지의 앵커를 자동 렌더하므로 custom-edge 는
 * 손대지 않고 세 콜백만 `<ReactFlow>` 에 배선하면 된다.
 *
 * detach 판정은 React Flow 표준 recipe 다:
 *  - onReconnectStart 에서 성공 플래그를 `false` 로 내린다.
 *  - 유효한 새 핸들에 재연결되면 onReconnect 가 불려 플래그를 `true` 로 올리고 store 갱신.
 *  - onReconnectEnd 에서 플래그가 여전히 `false` 면 빈 곳에 놓은 것이므로 엣지를 삭제한다.
 *
 * 얇은 glue 지만 "빈 곳 드롭 → 삭제 / 유효 드롭 → 유지" 결정이 회귀에 취약해 순수하게 훅으로
 * 분리하고 renderHook 으로 단위 테스트한다.
 */
export function useEdgeReconnect(
  reconnect: (oldEdge: Edge, newConnection: Connection) => void,
  deleteEdge: (edgeId: string) => void,
): {
  onReconnectStart: () => void;
  onReconnect: OnReconnect;
  onReconnectEnd: (event: MouseEvent | TouchEvent, edge: Edge) => void;
} {
  const successful = useRef(true);

  const onReconnectStart = useCallback(() => {
    successful.current = false;
  }, []);

  const onReconnect = useCallback<OnReconnect>(
    (oldEdge, newConnection) => {
      successful.current = true;
      reconnect(oldEdge, newConnection);
    },
    [reconnect],
  );

  const onReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: Edge) => {
      if (!successful.current) deleteEdge(edge.id);
      // 다음 제스처를 위해 기본값(true)으로 되돌린다 — start 없이 end 만 오는 경우
      // (방어적)에도 삭제하지 않도록.
      successful.current = true;
    },
    [deleteEdge],
  );

  return { onReconnectStart, onReconnect, onReconnectEnd };
}
