import { GraphEdge } from './graph-builder';

/** Background 노드가 본문으로 이어지는 출력 포트. */
const BACKGROUND_PORT = 'background';

/**
 * 컨테이너 본문 노드 가운데 Background 본문으로만 닿는 노드를 고른다. 그래프만 읽는
 * 순수 함수다(CLE-T-BTR4ZA).
 *
 * 에디터의 연결선 체인 규칙 때문에 컨테이너 안 Background 의 `background` 포트 뒤 노드도
 * 그 컨테이너의 `containerId` 를 가진다. 회차 루프는 그 노드를 실행하지 않고, 워커가 큐에서
 * 꺼낸 작업으로 새 컨텍스트에서 실행한다.
 *
 * - Background 본문 쪽: Background 노드의 `background` 연결선 대상에서 시작해
 *   `internalEdges` 를 포트와 상관없이 따라 닿는 노드. 본문 안 Background 의 본문도 들어간다.
 * - 회차 본문 쪽: `bodyEntryNodeIds` 에서 시작해 Background 노드의 `background` 연결선만
 *   건너뛰고 닿는 노드.
 *
 * Background 본문 쪽에만 있는 노드를 돌려준다. 양쪽에서 닿는 노드는 회차 루프에서도
 * 실행되므로 넣지 않는다. 어느 쪽에서도 닿지 않는 노드도 넣지 않는다.
 *
 * @param bodyEntryNodeIds 컨테이너 `body` 연결선이 가리키는 본문 진입 노드
 * @param internalEdges    양 끝이 모두 그 컨테이너 본문 노드인 연결선
 * @param isBackgroundNode 노드가 Background 인지(`executionMetadata.kind === 'background'`)
 */
export function collectBackgroundOnlyNodeIds(
  bodyEntryNodeIds: Iterable<string>,
  internalEdges: readonly GraphEdge[],
  isBackgroundNode: (nodeId: string) => boolean,
): Set<string> {
  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of internalEdges) {
    const list = outgoing.get(edge.sourceNodeId) ?? [];
    list.push(edge);
    outgoing.set(edge.sourceNodeId, list);
  }
  const isBackgroundEdge = (edge: GraphEdge) =>
    edge.sourcePort === BACKGROUND_PORT && isBackgroundNode(edge.sourceNodeId);

  const reach = (
    starts: Iterable<string>,
    follow: (edge: GraphEdge) => boolean,
  ): Set<string> => {
    const seen = new Set<string>();
    const queue = [...starts];
    let head = 0;
    while (head < queue.length) {
      const nodeId = queue[head++];
      if (seen.has(nodeId)) continue;
      seen.add(nodeId);
      for (const edge of outgoing.get(nodeId) ?? []) {
        if (follow(edge) && !seen.has(edge.targetNodeId)) {
          queue.push(edge.targetNodeId);
        }
      }
    }
    return seen;
  };

  const backgroundEntries = internalEdges
    .filter(isBackgroundEdge)
    .map((edge) => edge.targetNodeId);
  if (backgroundEntries.length === 0) return new Set();

  const fromBackground = reach(backgroundEntries, () => true);
  const fromBodyEntry = reach(
    bodyEntryNodeIds,
    (edge) => !isBackgroundEdge(edge),
  );
  const result = new Set<string>();
  for (const id of fromBackground) {
    if (!fromBodyEntry.has(id)) result.add(id);
  }
  return result;
}
