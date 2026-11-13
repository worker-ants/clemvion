import { GraphEdge } from './graph-builder';

/**
 * {@link collectParallelBranchMembership} 결과. 배열은 모두 병렬 분기 번호 순서다.
 */
export interface ParallelBranchMembership {
  /** 노드 ID → 그 노드에서 나가는 순방향 연결선. */
  forwardAdj: Map<string, GraphEdge[]>;
  /** 병렬 분기마다 `branch_N` 연결선이 바로 가리키는 노드(입구 노드). */
  branchEntries: Set<string>[];
  /**
   * 병렬 분기마다 그 병렬 분기만 닿는 노드. 입구에서 너비 우선으로 찾은 순서를
   * 유지한다. 합류 노드는 들어가지 않는다.
   */
  bodyNodeIdsPerBranch: Set<string>[];
  /** 둘 이상의 병렬 분기가 닿는 노드(보통 Merge). 어느 본문에도 넣지 않는다. */
  joinNodeIds: Set<string>;
  /** 모든 병렬 분기 본문 노드의 합집합. */
  allBodyNodeIds: Set<string>;
}

/**
 * Parallel 노드의 병렬 분기마다 본문 노드를 고른다. 그래프만 읽는 순수 함수다.
 *
 * `branch_0` ~ `branch_{branchCount-1}` 연결선의 대상에서 시작해 `forwardEdges` 를
 * 너비 우선으로 따라간다. 한 병렬 분기만 닿는 노드는 그 병렬 분기 본문이고, 둘 이상이
 * 닿는 노드는 합류 노드다. 번호가 `branchCount` 이상인 `branch_N` 연결선은 따라가지
 * 않는다. 되돌아가는 연결선은 `forwardEdges` 에 없다고 가정하므로 탐색이 돌지 않는다.
 *
 * 실행 계획(`ParallelPrecheck.planParallelBody`)과 안쪽 Parallel 본문 사전 검사가
 * 함께 쓴다. 사전 검사는 안쪽 병렬 분기 수를 아직 모르므로 최대값을 넘긴다.
 */
export function collectParallelBranchMembership(
  parallelNodeId: string,
  forwardEdges: readonly GraphEdge[],
  branchCount: number,
): ParallelBranchMembership {
  const forwardAdj = new Map<string, GraphEdge[]>();
  for (const edge of forwardEdges) {
    const list = forwardAdj.get(edge.sourceNodeId) ?? [];
    list.push(edge);
    forwardAdj.set(edge.sourceNodeId, list);
  }

  const branchEntries: Set<string>[] = Array.from(
    { length: branchCount },
    () => new Set<string>(),
  );
  for (const edge of forwardAdj.get(parallelNodeId) ?? []) {
    const match = /^branch_(\d+)$/.exec(edge.sourcePort);
    if (!match) continue;
    const idx = Number(match[1]);
    if (idx >= 0 && idx < branchCount) {
      branchEntries[idx].add(edge.targetNodeId);
    }
  }

  // perf #6 — `queue.shift()`(O(N) 앞당김) 대신 인덱스 포인터로 FIFO 를 돈다.
  const reachPerBranch: Set<string>[] = branchEntries.map((entries) => {
    const reach = new Set<string>();
    const queue = [...entries];
    let head = 0;
    while (head < queue.length) {
      const nodeId = queue[head++];
      if (reach.has(nodeId)) continue;
      reach.add(nodeId);
      for (const edge of forwardAdj.get(nodeId) ?? []) {
        if (!reach.has(edge.targetNodeId)) queue.push(edge.targetNodeId);
      }
    }
    return reach;
  });

  const ownerCount = new Map<string, number>();
  for (const reach of reachPerBranch) {
    for (const id of reach) ownerCount.set(id, (ownerCount.get(id) ?? 0) + 1);
  }
  const joinNodeIds = new Set<string>();
  const allBodyNodeIds = new Set<string>();
  for (const [id, count] of ownerCount) {
    if (count > 1) joinNodeIds.add(id);
    else allBodyNodeIds.add(id);
  }

  const bodyNodeIdsPerBranch = reachPerBranch.map(
    (reach) => new Set([...reach].filter((id) => allBodyNodeIds.has(id))),
  );

  return {
    forwardAdj,
    branchEntries,
    bodyNodeIdsPerBranch,
    joinNodeIds,
    allBodyNodeIds,
  };
}
