import { useCallback } from "react";
import type {
  Connection,
  Edge,
  FinalConnectionState,
  HandleType,
  OnReconnect,
} from "@xyflow/react";

/**
 * §1.3 — 기존 엣지 끝점(source/target 앵커) 재연결 + detach(빈 영역 드롭 시 삭제)
 * 오케스트레이션. React Flow 가 reconnectable 엣지의 앵커를 자동 렌더하므로 custom-edge 는
 * 손대지 않고 두 콜백만 `<ReactFlow>` 에 배선하면 된다.
 *
 * detach 판정은 **드롭 위치**로 한다 — `onReconnectEnd` 의 `connectionState.toNode` 가 `null`
 * 이면 아무 노드에도 놓이지 않은 것(=빈 캔버스 pane)이라 엣지를 삭제한다. 유효 핸들 드롭은
 * `onReconnect` 가 재연결로 처리하고, **무효 핸들 위 드롭**(예: 자기연결이라 `isValidConnection`
 * 이 false 를 반환해 `onReconnect` 가 아예 호출되지 않는 경우)은 원상 유지(no-op)여야 한다.
 *
 * ⚠️ "onReconnect 가 불렸는가(success 플래그)" 로 detach 를 판정하면, `onReconnect` 미호출이
 * "빈 영역 드롭" 과 "무효 핸들 드롭" 을 구분하지 못해 자기연결 드롭이 엣지 삭제로 오귀결된다.
 * 그래서 success 플래그가 아니라 실제 드롭 대상(`toNode`)으로 판정한다.
 */
export function useEdgeReconnect(
  reconnect: (oldEdge: Edge, newConnection: Connection) => void,
  removeEdge: (edgeId: string) => void,
): {
  onReconnect: OnReconnect;
  onReconnectEnd: (
    event: MouseEvent | TouchEvent,
    edge: Edge,
    handleType: HandleType,
    connectionState: FinalConnectionState,
  ) => void;
} {
  const onReconnect = useCallback<OnReconnect>(
    (oldEdge, newConnection) => {
      reconnect(oldEdge, newConnection);
    },
    [reconnect],
  );

  const onReconnectEnd = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      edge: Edge,
      _handleType: HandleType,
      connectionState: FinalConnectionState,
    ) => {
      // 빈 캔버스(pane)에 놓았을 때만 detach 삭제. 노드/핸들 위 드롭은 유지.
      if (!connectionState.toNode) removeEdge(edge.id);
    },
    [removeEdge],
  );

  return { onReconnect, onReconnectEnd };
}
