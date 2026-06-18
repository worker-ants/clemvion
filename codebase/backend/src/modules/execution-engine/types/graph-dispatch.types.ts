import type { Node } from '../../nodes/entities/node.entity';
import type { Edge } from '../../edges/entities/edge.entity';
import type { Execution } from '../../executions/entities/execution.entity';
import type { ExecutionContext } from '../../../nodes/core/node-handler.interface';
import type { GraphEdge } from '../graph/graph-builder';

/**
 * `loadAndBuildGraph` / `runNodeDispatchLoop` 의 그래프·dispatch 헬퍼 인터페이스.
 *
 * C-1 후속 — `engine-driver.interface.ts`(leaf 계약)가 god-class
 * `execution-engine.service.ts` 에서 본 타입들을 `import type` 하던 타입 레벨
 * 순환(`execution-engine.service.ts` → `engine-driver.interface.ts` 역방향
 * import)을 끊기 위해, 두 소비자(engine-driver.interface.ts ·
 * execution-engine.service.ts) 중 어느 쪽도 소유하지 않는 중립 leaf 타입
 * 모듈로 분리했다.
 */

/**
 * Graph rebuild 결과를 한 번에 운반하는 구조체. `loadAndBuildGraph` 가 반환하며
 * `runExecution` / `resumeFromCheckpoint` / `resumeGraphAfterRetry` 가 traversal
 * 단계에서 사용한다. `runNodeDispatchLoop` 의 입력 `graphState` 이기도 하다.
 *
 * **`GraphTraversalSummary` (knowledge-base RAG) 와 의미 분리** — 본 타입은
 * execution-engine 의 워크플로 graph 재구축 결과만 담는다.
 */
export interface ExecutionGraphState {
  /** Workflow 에 속한 모든 노드 (container child / tool area 포함 — runContainer / runParallel 에 그대로 전달). */
  nodes: Node[];
  /** Workflow 에 속한 모든 edge (graph-builder filter 적용 전). */
  edges: Edge[];
  /** 최상위 노드만 필터된 graph edges (buildGraph 결과). */
  graphEdges: GraphEdge[];
  /** identifyBackEdges 가 forward 로 분류한 edges (topologicalSort 입력). */
  forwardEdges: GraphEdge[];
  /** identifyBackEdges 가 back 으로 분류한 edges (cyclic workflow). */
  backEdges: GraphEdge[];
  /** Topological 정렬된 노드 id 순서. */
  sortedNodeIds: string[];
  /** `sortedNodeIds` 의 id → index 역방향 O(1) lookup. */
  sortedIndexMap: Map<string, number>;
  /** sourceNodeId → list of back-edge + target sorted index. */
  backEdgeMap: Map<string, Array<{ edge: GraphEdge; targetIndex: number }>>;
  /** sourceNodeId → forward outgoing edges. */
  outgoingEdgeMap: Map<string, GraphEdge[]>;
  /** targetNodeId → forward incoming edges. */
  incomingEdgeMap: Map<string, GraphEdge[]>;
  /** id → Node 객체 lookup. */
  nodeMap: Map<string, Node>;
  /** `MAX_NODE_ITERATIONS` config (기본 100, 0 = unlimited). */
  maxNodeIterations: number;
}

/**
 * `runNodeDispatchLoop` 의 파라미터. 호출자 (`resumeFromCheckpoint` /
 * `resumeGraphAfterRetry`) 가 시작 단계 (graph rebuild + reachability seed +
 * 시작 노드 전파) 와 종결 단계 (Execution.COMPLETED 마감 + outputData seed) 를
 * 모두 책임지고, 본 helper 는 그 사이의 pointer 기반 node dispatch loop 만
 * 책임진다.
 *
 * **`GraphTraversalService` 와의 책임 분리**: `GraphTraversalService` 는 pure
 * graph reachability / propagation (외부 service 호출 없음). 본 helper 는
 * dispatch (executeNode / runContainer / runParallel / scheduleBackgroundBody)
 * + blocking wait (form / button / AI multi-turn) 까지 포함하므로 도메인 책임
 * 이 다르다.
 */
export interface NodeDispatchLoopParams {
  executionId: string;
  savedExecution: Execution;
  context: ExecutionContext;
  graphState: ExecutionGraphState;
  /** Loop 가 mutate — 호출자가 helper 호출 전에 seed (예: completedNode / waitingNode 추가). */
  executedNodes: Set<string>;
  /** Loop 가 mutate — 호출자가 helper 호출 전에 seed (트리거 + no-incoming + executedNodes + 시작 노드). */
  reachable: Set<string>;
  /** Loop 가 mutate (+1 per visit) — 호출자가 helper 호출 전에 초기 entry (시작 노드 = 0) 만 set, 본 helper 의 첫 +1 이 1 이 되도록. */
  nodeExecutionCount: Map<string, number>;
  /** Loop 시작 pointer — 호출자가 시작 노드의 `sortedIndexMap.get(...) + 1` 로 설정 (시작 노드는 helper 호출 전 propagateReachability 가 이미 다음을 reachable 에 추가). */
  pointer: number;
  /** Input 객체 — gatherNodeInput 의 default fallback. resume / retry 경로엔 `{}`. */
  input: Record<string, unknown>;
  /** executeNode 의 meta — startedAt + mode. */
  dispatchMeta: { startedAt?: string; mode: 'manual' };
}
