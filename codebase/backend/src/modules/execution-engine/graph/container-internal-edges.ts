import type { GraphEdge } from './graph-builder';

/**
 * 컨테이너 본문 안 연결선(양 끝이 모두 `childIds` 에 있는 연결선)을 고른다.
 * 컨테이너 실행 계획(`ExecutionEngineService.planContainerBody`)과 Parallel 사전 검사
 * (`ParallelPrecheck`)가 함께 쓴다.
 */
export function pickContainerInternalEdges(
  childIds: ReadonlySet<string>,
  allEdges: readonly GraphEdge[],
): GraphEdge[] {
  return allEdges
    .filter((e) => childIds.has(e.sourceNodeId) && childIds.has(e.targetNodeId))
    .map((e) => ({
      sourceNodeId: e.sourceNodeId,
      sourcePort: e.sourcePort,
      targetNodeId: e.targetNodeId,
      targetPort: e.targetPort,
    }));
}
