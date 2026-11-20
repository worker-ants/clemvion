import {
  GraphRuleEdge,
  reachSkippingBackgroundEdges,
} from '@workflow/graph-warning-rules';
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
 *   건너뛰고 닿는 노드. 저장 규칙의 병렬 분기 본문과 같은 공유 패키지 함수
 *   `reachSkippingBackgroundEdges` 로 구한다.
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
  const ruleEdges: GraphRuleEdge[] = internalEdges.map((edge) => ({
    source: edge.sourceNodeId,
    sourceHandle: edge.sourcePort,
    target: edge.targetNodeId,
  }));
  const backgroundEntries = internalEdges
    .filter(
      (edge) =>
        edge.sourcePort === BACKGROUND_PORT &&
        isBackgroundNode(edge.sourceNodeId),
    )
    .map((edge) => edge.targetNodeId);
  if (backgroundEntries.length === 0) return new Set();

  // Background 본문 쪽은 본문 안 Background 의 본문까지 모든 연결선을 따른다.
  const fromBackground = reachSkippingBackgroundEdges(
    backgroundEntries,
    ruleEdges,
  );
  // 회차 본문 쪽은 저장 규칙의 병렬 분기 본문과 같은 함수로 구한다(CLE-T-HH61D6).
  const fromBodyEntry = reachSkippingBackgroundEdges(
    bodyEntryNodeIds,
    ruleEdges,
    isBackgroundNode,
  );
  const result = new Set<string>();
  for (const id of fromBackground) {
    if (!fromBodyEntry.has(id)) result.add(id);
  }
  return result;
}
