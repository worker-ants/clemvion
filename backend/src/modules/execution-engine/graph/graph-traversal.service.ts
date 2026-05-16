import { Injectable } from '@nestjs/common';
import { Node, NodeCategory } from '../../nodes/entities/node.entity';

import { GraphEdge } from './graph-builder';

/**
 * 실행 엔진의 그래프 순회·reachability 보조 연산을 모은 서비스.
 *
 * 옛 코드는 `ExecutionEngineService` 가 `buildEdgeIndexes` /
 * `seedInitialReachability` / `propagateReachability` / `isPortFiltered` 를
 * 모두 자기 private 메서드로 들고 있었다. 모두 외부 의존성 없는 pure 그래프
 * 연산이라 별도 책임으로 분리한다 (C-6 strangle step 2).
 *
 * 의도적으로 stateless — 호출자가 데이터를 전부 인자로 전달하고, 결과는 반환값
 * 으로만 받는다. 따라서 unit test 가 NestJS 모듈 컴파일 없이도 가능.
 */
@Injectable()
export class GraphTraversalService {
  /**
   * `executeInline` / `runExecution` 양쪽이 공통으로 필요한 edge lookup 맵 3종.
   *
   * - **backEdgeMap**: sourceNodeId → list of `{ edge, targetIndex }` (back-edge 도착 인덱스 포함)
   * - **outgoingEdgeMap**: sourceNodeId → forward outgoing edges
   * - **incomingEdgeMap**: targetNodeId → forward incoming edges
   *
   * back-edge 의 target 이 sortedIndexMap 에 없으면 방어적으로 skip — 옛 동작 동일.
   */
  buildEdgeIndexes(
    graphEdges: GraphEdge[],
    backEdges: GraphEdge[],
    sortedIndexMap: Map<string, number>,
  ): {
    backEdgeMap: Map<string, Array<{ edge: GraphEdge; targetIndex: number }>>;
    outgoingEdgeMap: Map<string, GraphEdge[]>;
    incomingEdgeMap: Map<string, GraphEdge[]>;
  } {
    const backEdgeMap = new Map<
      string,
      Array<{ edge: GraphEdge; targetIndex: number }>
    >();
    for (const edge of backEdges) {
      const targetIndex = sortedIndexMap.get(edge.targetNodeId);
      if (targetIndex === undefined) continue;
      const list = backEdgeMap.get(edge.sourceNodeId) ?? [];
      list.push({ edge, targetIndex });
      backEdgeMap.set(edge.sourceNodeId, list);
    }

    const outgoingEdgeMap = new Map<string, GraphEdge[]>();
    const incomingEdgeMap = new Map<string, GraphEdge[]>();
    for (const edge of graphEdges) {
      const outList = outgoingEdgeMap.get(edge.sourceNodeId) ?? [];
      outList.push(edge);
      outgoingEdgeMap.set(edge.sourceNodeId, outList);
      const inList = incomingEdgeMap.get(edge.targetNodeId) ?? [];
      inList.push(edge);
      incomingEdgeMap.set(edge.targetNodeId, inList);
    }

    return { backEdgeMap, outgoingEdgeMap, incomingEdgeMap };
  }

  /**
   * 그래프 순회의 reachability 초기 시드 셋업. 두 entry 정책 지원:
   *
   *   - `explicitEntryIds` (Background subgraph): 호출자가 명시한 진입점만 seed.
   *     다른 노드는 단방향 edge propagation 으로 도달.
   *   - **trigger-first / no-incoming fallback**: TRIGGER category 노드를 seed.
   *     없으면 indegree=0 노드를 seed (sub-workflow / 일반 실행).
   *
   * 옛 ExecutionEngineService.seedInitialReachability 와 동작 100% 동일.
   */
  seedInitialReachability(
    sortedNodeIds: string[],
    nodeMap: Map<string, Node>,
    forwardEdges: GraphEdge[],
    explicitEntryIds?: string[],
  ): Set<string> {
    const reachable = new Set<string>();
    if (explicitEntryIds && explicitEntryIds.length > 0) {
      for (const id of explicitEntryIds) {
        if (nodeMap.has(id)) reachable.add(id);
      }
      return reachable;
    }
    for (const id of sortedNodeIds) {
      const node = nodeMap.get(id);
      if (node?.category === NodeCategory.TRIGGER) reachable.add(id);
    }
    if (reachable.size === 0) {
      const nodesWithIncoming = new Set(
        forwardEdges.map((e) => e.targetNodeId),
      );
      for (const id of sortedNodeIds) {
        if (!nodesWithIncoming.has(id)) reachable.add(id);
      }
    }
    return reachable;
  }

  /**
   * Output 객체의 `_selectedPort` 메타데이터를 기준으로 edge 의 sourcePort 가
   * 라우팅에서 제외됐는지 판정. `_selectedPort` 가 없으면 모든 포트가 활성.
   * 배열이면 비어있을 때 모든 포트 활성, 그 외엔 included 여부로 판단.
   */
  isPortFiltered(sourceOutput: unknown, edgeSourcePort: string): boolean {
    if (
      sourceOutput &&
      typeof sourceOutput === 'object' &&
      '_selectedPort' in (sourceOutput as Record<string, unknown>)
    ) {
      const selectedPort = (sourceOutput as Record<string, unknown>)
        ._selectedPort;
      if (Array.isArray(selectedPort)) {
        return (
          selectedPort.length > 0 && !selectedPort.includes(edgeSourcePort)
        );
      }
      return edgeSourcePort !== selectedPort;
    }
    return false;
  }

  /**
   * 노드 실행 후 outgoing edges 를 따라 reachability 를 downstream 으로 전파.
   * `_selectedPort` 가 있으면 그에 해당하는 edge 만 활성화. disabled 노드의
   * 호출자 책임으로 본 메서드를 호출하지 않는다.
   */
  propagateReachability(
    nodeId: string,
    outgoingEdgeMap: Map<string, GraphEdge[]>,
    nodeOutputCache: Record<string, unknown>,
    reachable: Set<string>,
  ): void {
    const sourceOutput = nodeOutputCache[nodeId];
    const outgoingEdges = outgoingEdgeMap.get(nodeId) ?? [];
    for (const edge of outgoingEdges) {
      if (this.isPortFiltered(sourceOutput, edge.sourcePort)) {
        continue;
      }
      reachable.add(edge.targetNodeId);
    }
  }
}
