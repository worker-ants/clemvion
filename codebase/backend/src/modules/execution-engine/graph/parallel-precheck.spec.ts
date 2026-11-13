import type { Edge } from '../../edges/entities/edge.entity';
import type { Node } from '../../nodes/entities/node.entity';
import type { ExecutionContext } from '../../../nodes/core/node-handler.interface';
import type { NodeTypeMetadata } from '../../../nodes/core/node-type-metadata';
import type { GraphEdge } from './graph-builder';
import {
  ParallelPrecheck,
  parallelDepthOf,
  type ParallelCheckGraph,
} from './parallel-precheck';

type Kind = NodeTypeMetadata['kind'];

const node = (
  id: string,
  type: string,
  extra: Partial<Pick<Node, 'label' | 'containerId'>> = {},
): Node => ({ id, type, label: id.toUpperCase(), ...extra }) as Node;

const edge = (
  sourceNodeId: string,
  sourcePort: string,
  targetNodeId: string,
): GraphEdge & Edge =>
  ({
    id: `${sourceNodeId}-${sourcePort}-${targetNodeId}`,
    sourceNodeId,
    sourcePort,
    targetNodeId,
    targetPort: 'in',
  }) as GraphEdge & Edge;

/** 타입 이름을 그대로 종류로 쓴다. 표에 없는 타입은 `standard` 다. */
const kindOf = (type: string): Kind =>
  (
    ({
      parallel: 'parallel',
      container: 'container',
      background: 'background',
      form: 'blocking',
    }) as Record<string, Kind>
  )[type] ?? 'standard';

describe('ParallelPrecheck (CLE-T-8PAPKV)', () => {
  let precheck: ParallelPrecheck;
  let kindSpy: jest.Mock<Kind, [string]>;

  beforeEach(() => {
    kindSpy = jest.fn(kindOf);
    precheck = new ParallelPrecheck(kindSpy);
  });

  const graphOf = (nodes: Node[], edges: Edge[] = []): ParallelCheckGraph =>
    precheck.buildParallelCheckGraph(nodes, edges);

  describe('buildParallelCheckGraph', () => {
    // CLE-T-0DGHGF — 컨테이너 회차마다 `runParallel` 이 불려도 사전 검사 그래프는 노드 ·
    // 연결선 배열 참조 기준으로 1회만 만든다. 연결선 배열이 다르면 낡은 연결선을 쓰지 않도록 다시 만든다.
    it('같은 배열이면 그래프를 다시 쓰고 연결선 배열이 다르면 다시 만든다', () => {
      const nodes = [node('n1', 't')];
      const edges: Edge[] = [];
      const first = precheck.buildParallelCheckGraph(nodes, edges);
      expect(precheck.buildParallelCheckGraph(nodes, edges)).toBe(first);

      const otherEdges = [edge('n1', 'out', 'n1')];
      const rebuilt = precheck.buildParallelCheckGraph(nodes, otherEdges);
      expect(rebuilt).not.toBe(first);
      expect(rebuilt.allEdges).toBe(otherEdges);
      // 다른 노드 배열은 캐시와 무관하게 새 그래프다.
      expect(precheck.buildParallelCheckGraph([...nodes], edges)).not.toBe(
        first,
      );
    });

    it('캐시는 인스턴스마다 따로 둔다', () => {
      const nodes = [node('n1', 't')];
      const edges: Edge[] = [];
      const first = precheck.buildParallelCheckGraph(nodes, edges);
      expect(
        new ParallelPrecheck(kindOf).buildParallelCheckGraph(nodes, edges),
      ).not.toBe(first);
    });

    it('컨테이너 본문 노드를 containerId 로 묶는다', () => {
      const graph = graphOf([
        node('c', 'container'),
        node('a', 't', { containerId: 'c' }),
        node('b', 't', { containerId: 'c' }),
        node('x', 't'),
      ]);
      expect(graph.childrenByContainer.get('c')?.map((n) => n.id)).toEqual([
        'a',
        'b',
      ]);
      expect(graph.nodeMap.get('x')?.id).toBe('x');
    });
  });

  describe('planParallelBody', () => {
    // parallel-p2 §2-4 런타임 가드: 깊이 2 병렬 분기 본문 안의 Parallel 을
    // PARALLEL_NESTED_DEPTH_EXCEEDED 로 던진다. 저장 규칙(parallel:nested-depth-exceeded)은
    // parallel.schema.spec.ts 가 따로 본다.
    it('깊이 2 병렬 분기 본문에 Parallel 이 또 있으면 PARALLEL_NESTED_DEPTH_EXCEEDED 를 던진다', () => {
      const inner = node('p2', 'parallel', { label: 'Inner' });
      const innermost = node('p3', 'parallel', { label: 'Innermost' });
      const forwardEdges = [edge('p2', 'branch_0', 'p3')];
      // 이 테스트의 연결선은 실행 그래프의 순방향 연결선이다. 컨테이너가 없으므로 검사
      // 그래프에는 노드만 넣는다.
      const plan = (
        parallelNode: Node,
        allNodes: Node[],
        edges: GraphEdge[],
        depth: number,
      ) =>
        precheck.planParallelBody(
          parallelNode,
          graphOf(allNodes),
          edges,
          [],
          1,
          depth,
        );

      expect(() => plan(inner, [inner, innermost], forwardEdges, 2)).toThrow(
        /PARALLEL_NESTED_DEPTH_EXCEEDED/,
      );

      // 깊이 1(맨 바깥)은 한 단계 중첩을 허용한다. 본문에 안쪽 Parallel(p3)이 들어 있어
      // 위 throw 가 연결선 모양의 우연이 아니라 「본문 안 Parallel + 깊이 초과」 조건임을 확정한다.
      const planDepth1 = plan(inner, [inner, innermost], forwardEdges, 1);
      expect(planDepth1.allBodyNodeIds.has('p3')).toBe(true);

      // CLE-T-GGZSC2 — 깊이 1 계획이 안쪽 Parallel 본문도 미리 검사한다. 세 단계
      // (p1 → p2 → p3)면 바깥 Parallel 을 계획하는 시점에 던진다.
      const outer = node('p1', 'parallel', { label: 'Outer' });
      expect(() =>
        plan(
          outer,
          [outer, inner, innermost],
          [edge('p1', 'branch_0', 'p2'), ...forwardEdges],
          1,
        ),
      ).toThrow(/^PARALLEL_NESTED_DEPTH_EXCEEDED: /);
    });

    it('병렬 분기 본문의 블로킹 노드는 PARALLEL_INVALID_CHILD 로 막는다', () => {
      const par = node('p', 'parallel');
      const form = node('f', 'form');
      expect(() =>
        precheck.planParallelBody(
          par,
          graphOf([par, form]),
          [edge('p', 'branch_0', 'f')],
          [],
          2,
          1,
        ),
      ).toThrow(
        'PARALLEL_INVALID_CHILD: Blocking node "F" inside Parallel node "P" is not supported.',
      );
    });

    it('병렬 분기 본문에 걸친 되돌아가는 연결선은 PARALLEL_BACK_EDGE 로 막는다', () => {
      const par = node('p', 'parallel');
      const a = node('a', 't');
      expect(() =>
        precheck.planParallelBody(
          par,
          graphOf([par, a]),
          [edge('p', 'branch_0', 'a')],
          [edge('a', 'out', 'p')],
          2,
          1,
        ),
      ).toThrow(/^PARALLEL_BACK_EDGE: /);
    });

    it('병렬 분기마다 본문 · 위상 순서 · 입구 · 출구를 계획한다', () => {
      // p.branch_0 → a → b → m, p.branch_1 → c → m (m 은 합류 노드)
      const nodes = ['a', 'b', 'c', 'm'].map((id) => node(id, 't'));
      const par = node('p', 'parallel');
      const plan = precheck.planParallelBody(
        par,
        graphOf([par, ...nodes]),
        [
          edge('p', 'branch_0', 'a'),
          edge('a', 'out', 'b'),
          edge('b', 'out', 'm'),
          edge('p', 'branch_1', 'c'),
          edge('c', 'out', 'm'),
        ],
        [],
        2,
        1,
      );
      expect(plan.joinNodeIds).toEqual(new Set(['m']));
      expect(plan.branches.map((b) => b.branchPort)).toEqual([
        'branch_0',
        'branch_1',
      ]);
      expect(plan.branches[0].sortedNodeIds).toEqual(['a', 'b']);
      expect(plan.branches[0].entryNodeIds).toEqual(new Set(['a']));
      expect(plan.branches[0].exitNodeIds).toEqual(new Set(['b']));
      expect(plan.branches[0].outgoingEdgeMap.get('a')).toHaveLength(1);
      expect(plan.branches[1].bodyNodeIds).toEqual(new Set(['c']));
    });
  });

  // CLE-T-0DGHGF — 본문이 빈 병렬 분기(연결선이 없는 `branch_N`)는 본문 검사를 건너뛴다.
  it('안쪽 Parallel 본문 검사는 본문이 있는 병렬 분기만 본다', () => {
    const internals = precheck as unknown as {
      assertNestedParallelBodyAllowed: (
        parallelNode: Node,
        forwardEdges: GraphEdge[],
        graph: ParallelCheckGraph,
        depth: number,
      ) => void;
      assertParallelBranchChildrenAllowed: (...args: unknown[]) => void;
    };
    const spy = jest
      .spyOn(internals, 'assertParallelBranchChildrenAllowed')
      .mockImplementation(() => undefined);
    internals.assertNestedParallelBodyAllowed(
      node('p2', 'parallel', { label: 'Inner' }),
      [edge('p2', 'branch_0', 'a')],
      graphOf([]),
      1,
    );
    // 병렬 분기는 최대 16개지만 본문이 있는 `branch_0` 하나만 검사한다.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  describe('assertContainerBodyParallelsAllowed', () => {
    it('컨테이너 본문의 Parallel 이 한도를 넘는 깊이에서 돌면 던진다', () => {
      const container = node('c', 'container', { label: 'Loop' });
      const par = node('p', 'parallel', { containerId: 'c' });
      const graph = graphOf([container, par], [
        edge('c', 'body', 'p'),
      ] as Edge[]);
      expect(() =>
        precheck.assertContainerBodyParallelsAllowed(container, graph, 2),
      ).not.toThrow();
      expect(() =>
        precheck.assertContainerBodyParallelsAllowed(container, graph, 3),
      ).toThrow(
        'PARALLEL_NESTED_DEPTH_EXCEEDED: Parallel node "P" in the body of container "Loop" would run at nesting depth 3. Parallel nesting depth > 2 is not supported.',
      );
    });

    it('Background 본문으로만 닿는 Parallel 은 깊이 1 부터 센다 (CLE-T-BTR4ZA)', () => {
      // c.body → bg, bg.background → p (p 는 Background 본문 쪽에만 있다)
      const container = node('c', 'container');
      const bg = node('bg', 'background', { containerId: 'c' });
      const par = node('p', 'parallel', { containerId: 'c' });
      const graph = graphOf([container, bg, par], [
        edge('c', 'body', 'bg'),
        edge('bg', 'background', 'p'),
      ] as Edge[]);
      // 컨테이너 깊이 3 이어도 Background 본문 Parallel 은 깊이 1 이라 통과한다.
      expect(() =>
        precheck.assertContainerBodyParallelsAllowed(container, graph, 3),
      ).not.toThrow();
    });

    it('containerId 가 돌고 도는 그래프에서도 끝난다', () => {
      const a = node('a', 'container', { containerId: 'b' });
      const b = node('b', 'container', { containerId: 'a' });
      expect(() =>
        precheck.assertContainerBodyParallelsAllowed(a, graphOf([a, b]), 1),
      ).not.toThrow();
    });

    it('노드 종류는 생성자로 받은 조회 함수에 묻는다', () => {
      const container = node('c', 'container');
      const child = node('x', 'custom', { containerId: 'c' });
      precheck.assertContainerBodyParallelsAllowed(
        container,
        graphOf([container, child]),
        1,
      );
      expect(kindSpy).toHaveBeenCalledWith('custom');
    });
  });

  describe('parallelDepthOf', () => {
    it('병렬 분기 컨텍스트면 2, 아니면 1 이다', () => {
      expect(parallelDepthOf({} as ExecutionContext)).toBe(1);
      expect(
        parallelDepthOf({
          parentParallelConcurrency: 4,
        } as unknown as ExecutionContext),
      ).toBe(2);
    });
  });
});
