import type { Edge } from '../../edges/entities/edge.entity';
import type { Node } from '../../nodes/entities/node.entity';
import type { ExecutionContext } from '../../../nodes/core/node-handler.interface';
import type { NodeTypeMetadata } from '../../../nodes/core/node-type-metadata';
import { collectBackgroundOnlyNodeIds } from './background-body-membership';
import { pickContainerInternalEdges } from './container-internal-edges';
import type { GraphEdge } from './graph-builder';
import { collectParallelBranchMembership } from './parallel-branch-membership';
import { topologicalSort } from './topological-sort';

/**
 * 병렬 분기 수 상한. 엔진이 `branchCount` 설정값을 이 범위로 자르고, 안쪽 Parallel 본문
 * 사전 검사는 병렬 분기 수를 아직 모르므로 이 값으로 잡는다.
 */
export const PARALLEL_BRANCH_COUNT_MAX = 16;

/**
 * Parallel 중첩 깊이 한도(REQ-PARALLEL-024). 맨 바깥 Parallel 이 1, 그 병렬 분기 안의
 * Parallel 이 2 다. 한도 안의 Parallel 본문에 또 Parallel 이 있으면 실행 시
 * `PARALLEL_NESTED_DEPTH_EXCEEDED` 로 막는다({@link ParallelPrecheck.planParallelBody}).
 * 저장 시 규칙 `parallel:nested-depth-exceeded`(`@workflow/graph-warning-rules`)는 같은
 * 한도를 "자식 · 손자" 두 단계 탐색으로 표현하므로 이 상수를 읽지 않는다.
 */
export const PARALLEL_MAX_NESTED_DEPTH = 2;

/**
 * Background 본문에 둔 Parallel 의 중첩 깊이. 워커가 본문을 새 컨텍스트에서 실행하므로
 * 큐에 넣은 쪽의 깊이를 이어받지 않는다(REQ-PARALLEL-036). 컨테이너 본문 사전 검사가
 * 컨테이너 안 Background 본문을 셀 때 쓴다(CLE-T-BTR4ZA).
 */
export const BACKGROUND_BODY_PARALLEL_DEPTH = 1;

/**
 * Per-branch subgraph plan for the Parallel logic node.
 *
 * `bodyNodeIds` — nodes exclusive to this branch (reachable from this
 *   `branch_N` target but not from any other `branch_M`). Shared downstream
 *   nodes (typical Merge join points) live in {@link ParallelPlan.joinNodeIds}.
 * `sortedNodeIds` — forward-edge topological order of `bodyNodeIds`.
 * `entryNodeIds` — direct targets of `branch_N` edges; seed the reachability
 *   set for the sequential body traversal.
 * `exitNodeIds` — body nodes that have at least one outgoing edge to a node
 *   outside the body (join nodes or unrelated downstream). After the branch
 *   completes, propagation from these nodes re-activates the main loop's
 *   `reachable` set.
 */
export interface ParallelBranchPlan {
  branchIndex: number;
  branchPort: string;
  bodyNodeIds: Set<string>;
  sortedNodeIds: string[];
  entryNodeIds: Set<string>;
  exitNodeIds: Set<string>;
  internalEdges: GraphEdge[];
  outgoingEdgeMap: Map<string, GraphEdge[]>;
}

export interface ParallelPlan {
  branches: ParallelBranchPlan[];
  joinNodeIds: Set<string>;
  allBodyNodeIds: Set<string>;
}

/**
 * Parallel 사전 검사가 읽는 워크플로우 그래프. 실행 그래프(`buildGraph`)에는 컨테이너
 * 본문 노드가 없으므로 컨테이너 본문은 원본 노드 · 연결선에서 찾는다.
 */
export interface ParallelCheckGraph {
  nodeMap: ReadonlyMap<string, Node>;
  /** 컨테이너 ID → 그 컨테이너 본문 노드(`containerId` 가 그 컨테이너인 노드). */
  childrenByContainer: ReadonlyMap<string, Node[]>;
  allEdges: readonly Edge[];
}

/** 노드 타입 → 엔진 분기 종류(`NodeTypeMetadata.kind`). */
export type NodeKindOf = (nodeType: string) => NodeTypeMetadata['kind'];

/**
 * Parallel 노드 실행 전 사전 검사와 병렬 분기 계획(CLE-T-8PAPKV 에서 엔진 서비스에서 옮겼다).
 *
 * `ExecutionEngineService` 가 Parallel 을 실행하기 전(`runParallel`)과 컨테이너 회차를
 * 시작하기 전(`runContainerInner`)에 부른다. 그래프만 읽고 실행 상태 · 저장소에는 닿지
 * 않는다. 노드 종류는 생성자로 받은 {@link NodeKindOf} 로 묻는다. 엔진은 핸들러
 * 레지스트리의 `getMetadata(type).kind` 를 넘긴다.
 *
 * 엔진 서비스 인스턴스마다 하나를 두고 검사 그래프 캐시
 * ({@link ParallelPrecheck.buildParallelCheckGraph})도 인스턴스에 둔다.
 */
export class ParallelPrecheck {
  /**
   * 노드 배열 참조 → Parallel 사전 검사 그래프. 컨테이너 본문 안 Parallel 이 회차마다
   * `runParallel` 을 불러도 그래프는 한 번만 만든다. 배열이 GC 되면 같이 사라진다.
   *
   * 전제: 키로 쓰는 노드 배열과 연결선 배열은 실행 중 제자리에서 바뀌지 않는다.
   * 두 배열은 실행 · 재개 · 서브 워크플로우 시작 때 `findBy` 로 한 번 읽은 값이고
   * (`nodes` / `edges` / `subNodes` / `subEdges`), `runParallel` 을 부르는 곳들과
   * `planContainerBody` 의 `plan.allNodes` / `plan.allEdges` 는 그 참조를 그대로 넘기며
   * push · splice 같은 제자리 변경을 하지 않는다. 연결선 배열은 적중 때 참조까지 비교해
   * 다른 배열이 오면 다시 만든다.
   */
  private readonly graphCache = new WeakMap<
    readonly Node[],
    { allEdges: readonly Edge[]; graph: ParallelCheckGraph }
  >();

  constructor(private readonly kindOf: NodeKindOf) {}

  /**
   * Compute per-branch subgraph plans for a Parallel node.
   *
   * Strategy: for each `branch_N` port of the Parallel node, BFS forward
   * across `forwardEdges` to collect reachable nodes. A node reached from
   * multiple branches is a join (Merge) and excluded from every branch
   * body; a node reached from exactly one branch is in that branch's body
   * ({@link collectParallelBranchMembership}).
   *
   * Fails fast with `PARALLEL_INVALID_CHILD` / `PARALLEL_BACK_EDGE` /
   * `PARALLEL_NESTED_DEPTH_EXCEEDED` so the user sees a named error at
   * dispatch time instead of a mid-flight surprise.
   *
   * `currentDepth` 는 이 Parallel 의 중첩 깊이다(parallel-p2 결정 #3). 맨 바깥이면 1,
   * 바깥 병렬 분기 안에서 실행되는 안쪽 Parallel 이면 2 다. 병렬 분기 본문 노드 검사는
   * {@link assertParallelBranchChildrenAllowed} 가 맡는다. 한도
   * ({@link PARALLEL_MAX_NESTED_DEPTH}) 안의 안쪽 Parallel 과 병렬 분기 안 컨테이너 본문의
   * Parallel 은 그 본문까지 지금 검사하므로 깊이 위반은 바깥 Parallel 이 병렬 분기를
   * 시작하기 전에 드러난다(CLE-T-GGZSC2 · CLE-T-0DGHGF). 안쪽 Parallel 은
   * 엔진의 `executeParallelBranchBody` · `executeContainerBody` 가 `runParallel` 로 넘길 때
   * 다시 계획된다. `runParallel` 은 context 가 `ParallelBranchContext` 인지로 자기 깊이를
   * 판별한다({@link parallelDepthOf}).
   */
  planParallelBody(
    parallelNode: Node,
    graph: ParallelCheckGraph,
    forwardEdges: GraphEdge[],
    backEdges: GraphEdge[],
    branchCount: number,
    currentDepth: number,
  ): ParallelPlan {
    const {
      forwardAdj,
      branchEntries,
      bodyNodeIdsPerBranch,
      joinNodeIds,
      allBodyNodeIds,
    } = collectParallelBranchMembership(
      parallelNode.id,
      forwardEdges,
      branchCount,
    );

    // Back-edges inside any branch body are rejected to keep semantics
    // consistent with the Container pattern (which also forbids cyclic bodies).
    for (const edge of backEdges) {
      if (
        allBodyNodeIds.has(edge.sourceNodeId) ||
        allBodyNodeIds.has(edge.targetNodeId)
      ) {
        throw new Error(
          `PARALLEL_BACK_EDGE: Parallel node "${parallelNode.label ?? parallelNode.type}" body contains back-edges, which are not supported.`,
        );
      }
    }

    const branches: ParallelBranchPlan[] = [];
    for (let i = 0; i < branchCount; i++) {
      const bodyNodeIds = bodyNodeIdsPerBranch[i];
      const internalEdges = pickContainerInternalEdges(
        bodyNodeIds,
        forwardEdges,
      );
      this.assertParallelBranchChildrenAllowed(
        parallelNode,
        bodyNodeIds,
        internalEdges,
        graph,
        currentDepth,
      );

      const graphNodes = Array.from(bodyNodeIds).map((id) => ({ id }));
      const sortedNodeIds = topologicalSort(graphNodes, internalEdges);

      const outgoingEdgeMap = new Map<string, GraphEdge[]>();
      for (const edge of internalEdges) {
        const list = outgoingEdgeMap.get(edge.sourceNodeId) ?? [];
        list.push(edge);
        outgoingEdgeMap.set(edge.sourceNodeId, list);
      }

      // Exit nodes: body nodes whose outgoing edges leave the body (typically
      // into a join node such as a Merge). Used after dispatch to propagate
      // reachability into the main loop's `reachable` set.
      const exitNodeIds = new Set<string>();
      for (const id of bodyNodeIds) {
        const out = forwardAdj.get(id) ?? [];
        for (const edge of out) {
          if (!bodyNodeIds.has(edge.targetNodeId)) {
            exitNodeIds.add(id);
            break;
          }
        }
        // A body node with no outgoing edges at all is still a terminal leaf;
        // no propagation needed, so we don't add it to exitNodeIds.
      }

      branches.push({
        branchIndex: i,
        branchPort: `branch_${i}`,
        bodyNodeIds,
        sortedNodeIds,
        entryNodeIds: branchEntries[i],
        exitNodeIds,
        internalEdges,
        outgoingEdgeMap,
      });
    }

    return { branches, joinNodeIds, allBodyNodeIds };
  }

  /**
   * 병렬 분기 본문 노드 가운데 실행할 수 없는 노드를 막는다.
   *
   * - Parallel: `currentDepth` 가 {@link PARALLEL_MAX_NESTED_DEPTH} 이상이면
   *   `PARALLEL_NESTED_DEPTH_EXCEEDED` 를 던진다(REQ-PARALLEL-024). 한도 안이면 그 본문을
   *   {@link assertNestedParallelBodyAllowed} 로 지금 검사한다.
   * - 컨테이너: 본문 안 Parallel 은 이 병렬 분기 컨텍스트에서 실행되어 한 단계 깊다.
   *   {@link assertContainerBodyParallelsAllowed} 로 지금 검사한다(CLE-T-0DGHGF).
   * - 블로킹 노드: `PARALLEL_INVALID_CHILD` 를 던진다. 메타데이터만 보므로 buttons ·
   *   ai_conversation 처럼 실행해야 대기 여부가 정해지는 노드는 엔진의
   *   `executeParallelBranchBody` 런타임 가드가 막는다(PR-G, CRIT #3).
   */
  private assertParallelBranchChildrenAllowed(
    parallelNode: Node,
    bodyNodeIds: ReadonlySet<string>,
    internalEdges: GraphEdge[],
    graph: ParallelCheckGraph,
    currentDepth: number,
  ): void {
    for (const id of bodyNodeIds) {
      const node = graph.nodeMap.get(id);
      if (!node) continue;
      const childKind = this.kindOf(node.type);
      if (childKind === 'parallel') {
        if (currentDepth >= PARALLEL_MAX_NESTED_DEPTH) {
          throw new Error(
            `PARALLEL_NESTED_DEPTH_EXCEEDED: Nested Parallel node "${parallelNode.label ?? parallelNode.type}" body contains another Parallel node "${node.label ?? node.type}". Parallel nesting depth > ${PARALLEL_MAX_NESTED_DEPTH} is not supported.`,
          );
        }
        this.assertNestedParallelBodyAllowed(
          node,
          internalEdges,
          graph,
          currentDepth + 1,
        );
      }
      if (childKind === 'container') {
        this.assertContainerBodyParallelsAllowed(node, graph, currentDepth + 1);
      }
      if (childKind === 'blocking') {
        throw new Error(
          `PARALLEL_INVALID_CHILD: Blocking node "${node.label ?? node.type}" inside Parallel node "${parallelNode.label ?? parallelNode.type}" is not supported.`,
        );
      }
    }
  }

  /**
   * 바깥 병렬 분기 본문에 있는 안쪽 Parallel 의 본문을 계획을 만들지 않고 검사만 한다
   * (CLE-T-GGZSC2). 안쪽 Parallel 이 실행될 때 검사하면 깊이 위반이 바깥 병렬 분기 하나의
   * 실패가 되어 바깥 항목 에러 정책(`continue`)에 묻힌다. REQ-PARALLEL-024 는 실행을
   * 실패시키므로 바깥 병렬 분기를 시작하기 전에 던진다.
   *
   * 안쪽 병렬 분기 수는 표현식일 수 있어 아직 모르므로 {@link PARALLEL_BRANCH_COUNT_MAX}
   * 로 잡는다. 그래서 설정한 병렬 분기 수 밖의 `branch_N` 아래 Parallel 도 깊이 위반으로
   * 본다. `forwardEdges` 는 안쪽 Parallel 을 둘러싼 본문(바깥 병렬 분기 본문이나 컨테이너
   * 본문) 안의 연결선이다.
   *
   * 블로킹 노드 검사는 바깥 검사와 겹친다. 안쪽 본문은 바깥 병렬 분기 본문 안의 연결선만
   * 따라가므로 늘 바깥 본문에 들어 있고, 바깥 {@link assertParallelBranchChildrenAllowed}
   * 도 같은 노드를 본다. 노드를 보는 순서에 따라 어느 쪽이 먼저 던지는지만 다르다.
   *
   * 저장 시 규칙 `parallel:nested-depth-exceeded` 와는 판정 범위가 달라 함수를 나누지
   * 않는다. 저장 시 규칙은 `branch_N` 입구에서 모든 연결선(합류 노드, 컨테이너 본문 연결선
   * 포함)을 따라가고 병렬 분기 수는 보지 않는다. 실행 시 검사는 맨 바깥 Parallel 의 병렬
   * 분기 수를 따르고 합류 노드를 뺀다. 컨테이너 본문은 `containerId` 로 찾아 들어간다
   * ({@link assertContainerBodyParallelsAllowed}).
   */
  private assertNestedParallelBodyAllowed(
    parallelNode: Node,
    forwardEdges: GraphEdge[],
    graph: ParallelCheckGraph,
    depth: number,
  ): void {
    const { bodyNodeIdsPerBranch } = collectParallelBranchMembership(
      parallelNode.id,
      forwardEdges,
      PARALLEL_BRANCH_COUNT_MAX,
    );
    for (const bodyNodeIds of bodyNodeIdsPerBranch) {
      // 본문이 빈 병렬 분기(설정한 병렬 분기 수 밖의 `branch_N`)는 검사할 노드가 없다.
      if (bodyNodeIds.size === 0) continue;
      const internalEdges = pickContainerInternalEdges(
        bodyNodeIds,
        forwardEdges,
      );
      this.assertParallelBranchChildrenAllowed(
        parallelNode,
        bodyNodeIds,
        internalEdges,
        graph,
        depth,
      );
    }
  }

  /**
   * 컨테이너 본문에 둔 Parallel 의 깊이와 본문을 회차를 시작하기 전에 검사한다
   * (CLE-T-0DGHGF). 본문 안 Parallel 은 컨테이너가 받은 컨텍스트에서 실행되므로
   * 컨테이너를 둘러싼 깊이를 이어받는다. `parallelDepth` 는 본문 안 Parallel 이 실행될
   * 깊이다. 맨 바깥 컨테이너면 1, 병렬 분기 안 컨테이너면 그 병렬 분기 Parallel 깊이 + 1
   * 이다.
   *
   * 회차 안에서 처음 검사하면 위반이 그 회차 하나의 실패가 되어 컨테이너 `errorPolicy`
   * (`skip` · `continue`)에 묻힌다. 바깥 병렬 분기 안이면 바깥 항목 에러 정책에도 묻힌다.
   * REQ-PARALLEL-022 · 024 는 실행을 실패시키므로 병렬 분기 계획
   * ({@link assertParallelBranchChildrenAllowed})과 컨테이너 시작
   * (엔진의 `runContainerInner`)에서 부른다.
   *
   * 본문 안 컨테이너는 Parallel 깊이를 늘리지 않고 그 본문까지 내려간다. `containerId`
   * 가 돌고 도는 그래프는 `visited` 로 멈춘다(그런 컨테이너는 실행할 때
   * `CONTAINER_CYCLE` 로 실패한다).
   *
   * 본문 안 Background 의 `background` 포트로만 닿는 노드도 같은 `containerId` 를 가진다.
   * 그 노드는 워커가 새 컨텍스트에서 실행하므로 깊이를 1 부터 센다
   * ({@link collectBackgroundOnlyNodeIds}, CLE-T-BTR4ZA). 회차 본문에서도 닿는 노드는
   * 회차 루프에서 실행되므로 컨테이너 깊이로 센다. 본문 Parallel 의 병렬 분기 안에 둔
   * Background 의 본문은 그 병렬 분기 본문으로도 잡혀 바깥 깊이를 이어서 센다
   * ({@link assertNestedParallelBodyAllowed}). 병렬 분기 안 Background 본문을 이렇게
   * 엄격하게 세는 동작은 CLE-NODE-PARALLEL 「미결 사항」에 남아 있다.
   */
  assertContainerBodyParallelsAllowed(
    containerNode: Node,
    graph: ParallelCheckGraph,
    parallelDepth: number,
    visited: Set<string> = new Set(),
  ): void {
    if (visited.has(containerNode.id)) return;
    visited.add(containerNode.id);
    const children = graph.childrenByContainer.get(containerNode.id) ?? [];
    let bodyEdges: GraphEdge[] | undefined;
    let backgroundOnlyIds: ReadonlySet<string> | undefined;
    const bodyEdgesOf = () =>
      (bodyEdges ??= pickContainerInternalEdges(
        new Set(children.map((c) => c.id)),
        graph.allEdges,
      ));
    // Background 본문 노드는 워커가 새 컨텍스트에서 실행하므로 깊이 1 이다.
    const depthOf = (child: Node): number => {
      backgroundOnlyIds ??= collectBackgroundOnlyNodeIds(
        graph.allEdges
          .filter(
            (e) =>
              e.sourceNodeId === containerNode.id && e.sourcePort === 'body',
          )
          .map((e) => e.targetNodeId),
        bodyEdgesOf(),
        (id) => {
          const node = graph.nodeMap.get(id);
          return node !== undefined && this.kindOf(node.type) === 'background';
        },
      );
      return backgroundOnlyIds.has(child.id)
        ? BACKGROUND_BODY_PARALLEL_DEPTH
        : parallelDepth;
    };
    for (const child of children) {
      const childKind = this.kindOf(child.type);
      if (childKind === 'parallel') {
        const childDepth = depthOf(child);
        if (childDepth > PARALLEL_MAX_NESTED_DEPTH) {
          throw new Error(
            `PARALLEL_NESTED_DEPTH_EXCEEDED: Parallel node "${child.label ?? child.type}" in the body of container "${containerNode.label ?? containerNode.type}" would run at nesting depth ${childDepth}. Parallel nesting depth > ${PARALLEL_MAX_NESTED_DEPTH} is not supported.`,
          );
        }
        this.assertNestedParallelBodyAllowed(
          child,
          bodyEdgesOf(),
          graph,
          childDepth,
        );
      }
      if (childKind === 'container') {
        this.assertContainerBodyParallelsAllowed(
          child,
          graph,
          depthOf(child),
          visited,
        );
      }
    }
  }

  /** {@link ParallelCheckGraph} 를 만든다. */
  buildParallelCheckGraph(
    allNodes: readonly Node[],
    allEdges: readonly Edge[],
  ): ParallelCheckGraph {
    // 컨테이너 회차마다 같은 노드 · 연결선 배열로 불리므로 배열 참조 기준으로 1회만 만든다.
    const cached = this.graphCache.get(allNodes);
    if (cached && cached.allEdges === allEdges) return cached.graph;
    const nodeMap = new Map<string, Node>();
    const childrenByContainer = new Map<string, Node[]>();
    for (const node of allNodes) {
      nodeMap.set(node.id, node);
      if (!node.containerId) continue;
      const siblings = childrenByContainer.get(node.containerId) ?? [];
      siblings.push(node);
      childrenByContainer.set(node.containerId, siblings);
    }
    const graph: ParallelCheckGraph = {
      nodeMap,
      childrenByContainer,
      allEdges,
    };
    this.graphCache.set(allNodes, { allEdges, graph });
    return graph;
  }
}

/**
 * `context` 에서 실행되는 Parallel 의 중첩 깊이. 바깥 Parallel 이 병렬 분기 컨텍스트
 * (`ParallelBranchContext`)에 `parentParallelConcurrency` 를 넣으므로 그 필드가 있으면
 * 2, 없으면 1 이다(parallel-p2 결정 #3). `parentParallelConcurrency` 는
 * `ExecutionContext` 공통 필드가 아니라서 `in` 으로 확인한다.
 */
export function parallelDepthOf(context: ExecutionContext): number {
  return 'parentParallelConcurrency' in context ? 2 : 1;
}
