import {
  collectParallelBranchBodyNodeIds,
  parallelNestedDepthExceededRule,
  type GraphRuleEdge,
  type GraphRuleGraph,
  type GraphRuleNode,
} from '@workflow/graph-warning-rules';
import type { Edge } from '../../edges/entities/edge.entity';
import type { Node } from '../../nodes/entities/node.entity';
import type { NodeTypeMetadata } from '../../../nodes/core/node-type-metadata';
import { collectBackgroundOnlyNodeIds } from './background-body-membership';
import { pickContainerInternalEdges } from './container-internal-edges';
import type { GraphEdge } from './graph-builder';
import { collectParallelBranchMembership } from './parallel-branch-membership';
import { ParallelPrecheck } from './parallel-precheck';

/**
 * 병렬 분기 본문에서 Background 의 `background` 연결선 뒤 본문을 빼는 판정이 저장 규칙
 * (`@workflow/graph-warning-rules` 의 `collectParallelBranchBodyNodeIds` ·
 * `parallel:nested-depth-exceeded`)과 실행 사전 검사(`collectBackgroundOnlyNodeIds` ·
 * `ParallelPrecheck`)에서 같은지 같은 그래프로 대조한다(NERV Task CLE-T-1RPHM9).
 *
 * 두 구현은 입력 모양과 돌려주는 집합이 다르다. 그래서 비교 전에 다음처럼 맞춘다.
 *
 * - 연결선: 저장 규칙은 `{ source, sourceHandle, target }`, 실행 검사는
 *   `{ sourceNodeId, sourcePort, targetNodeId }` 다. 픽스처 하나에서 둘 다 만든다.
 * - Background 판정: 저장 규칙은 노드 `type === 'background'`, 실행 검사는 노드 종류
 *   (`executionMetadata.kind === 'background'`)다. 픽스처의 `background` 타입만 종류가
 *   `background` 인 조회 함수를 쓴다.
 * - 집합: 저장 규칙은 병렬 분기 본문 전체를 돌려준다. 실행 검사는 병렬 분기 본문
 *   (`collectParallelBranchMembership`)과 그 가운데 Background 본문으로만 닿는 노드를 따로
 *   준다. 비교는 «병렬 분기 본문 − Background 본문으로만 닿는 노드» 로 한다.
 * - 범위 차이: 합류 노드 · 설정한 병렬 분기 수 밖의 `branch_N` · 컨테이너 본문을 찾는 방법은
 *   두 검사가 일부러 다르다(CLE-NODE-PARALLEL-NEST 「저장 규칙과 실행 검사의 범위」).
 *   집합 픽스처는 합류 노드 없이 설정한 병렬 분기 수 안의 `branch_N` 만 쓴다. 컨테이너
 *   본문은 컨테이너 사전 검사의 입력(`containerId` 로 찾은 본문)끼리 따로 비교한다.
 */

type Kind = NodeTypeMetadata['kind'];

interface FixtureNode {
  id: string;
  type: string;
  containerId?: string;
}

interface Fixture {
  nodes: FixtureNode[];
  /** `[source, port, target]` */
  edges: [string, string, string][];
}

const kindOf = (type: string): Kind =>
  (
    ({
      parallel: 'parallel',
      container: 'container',
      background: 'background',
      form: 'blocking',
    }) as Record<string, Kind>
  )[type] ?? 'standard';

const n = (id: string, type = 't', containerId?: string): FixtureNode => ({
  id,
  type,
  ...(containerId ? { containerId } : {}),
});

const ruleGraphOf = (fixture: Fixture): GraphRuleGraph => ({
  nodes: fixture.nodes.map((node): GraphRuleNode => ({
    id: node.id,
    type: node.type,
    label: node.id.toUpperCase(),
  })),
  edges: fixture.edges.map(([source, sourceHandle, target]): GraphRuleEdge => ({
    source,
    sourceHandle,
    target,
    targetHandle: 'in',
  })),
});

const graphEdgesOf = (fixture: Fixture): (GraphEdge & Edge)[] =>
  fixture.edges.map(
    ([sourceNodeId, sourcePort, targetNodeId]) =>
      ({
        id: `${sourceNodeId}-${sourcePort}-${targetNodeId}`,
        sourceNodeId,
        sourcePort,
        targetNodeId,
        targetPort: 'in',
      }) as GraphEdge & Edge,
  );

const entityNodesOf = (fixture: Fixture): Node[] =>
  fixture.nodes.map(
    (node) =>
      ({
        id: node.id,
        type: node.type,
        label: node.id.toUpperCase(),
        containerId: node.containerId ?? null,
      }) as unknown as Node,
  );

const isBackgroundIn =
  (fixture: Fixture) =>
  (id: string): boolean =>
    kindOf(fixture.nodes.find((node) => node.id === id)?.type ?? '') ===
    'background';

/** 저장 규칙이 보는 병렬 분기 본문. */
const ruleBranchBody = (fixture: Fixture, parallelId: string): string[] => {
  const byId = new Map(fixture.nodes.map((node) => [node.id, node]));
  return [
    ...collectParallelBranchBodyNodeIds(
      parallelId,
      ruleGraphOf(fixture).edges,
      (id) => byId.get(id)?.type === 'background',
    ),
  ].sort();
};

/** 실행 사전 검사가 병렬 분기 본문으로 검사하는 노드(Background 본문으로만 닿는 노드 제외). */
const precheckBranchBody = (
  fixture: Fixture,
  parallelId: string,
  branchCount: number,
): string[] => {
  const forwardEdges = graphEdgesOf(fixture);
  const isBackground = isBackgroundIn(fixture);
  const { branchEntries, bodyNodeIdsPerBranch, joinNodeIds } =
    collectParallelBranchMembership(parallelId, forwardEdges, branchCount);
  // 합류 노드가 있으면 두 검사의 범위가 일부러 다르다. 픽스처가 그 경우를 쓰지 않는지 지킨다.
  expect([...joinNodeIds]).toEqual([]);
  const out = new Set<string>();
  bodyNodeIdsPerBranch.forEach((body, i) => {
    const backgroundOnly = collectBackgroundOnlyNodeIds(
      branchEntries[i],
      pickContainerInternalEdges(body, forwardEdges),
      isBackground,
    );
    for (const id of body) if (!backgroundOnly.has(id)) out.add(id);
  });
  return [...out].sort();
};

describe('Background 본문 제외 판정: 저장 규칙 ↔ 실행 사전 검사 대조 (CLE-T-1RPHM9)', () => {
  describe('병렬 분기 본문 집합', () => {
    const cases: [string, Fixture, number][] = [
      [
        '병렬 분기에 바로 둔 Background 의 본문을 뺀다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('a'),
            n('bg', 'background'),
            n('x'),
            n('y'),
            n('b'),
          ],
          edges: [
            ['p1', 'branch_0', 'a'],
            ['a', 'out', 'bg'],
            ['bg', 'background', 'x'],
            ['x', 'out', 'y'],
            ['bg', 'out', 'b'],
          ],
        },
        1,
      ],
      [
        '병렬 분기 입구가 Background 이고 본문이 Parallel 이어도 뺀다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('bg', 'background'),
            n('p3', 'parallel'),
            n('q'),
          ],
          edges: [
            ['p1', 'branch_0', 'bg'],
            ['bg', 'background', 'p3'],
            ['p3', 'branch_0', 'q'],
          ],
        },
        1,
      ],
      [
        'Background 의 다른 포트 뒤 노드는 본문으로 남긴다',
        {
          nodes: [n('p1', 'parallel'), n('bg', 'background'), n('o'), n('x')],
          edges: [
            ['p1', 'branch_0', 'bg'],
            ['bg', 'out', 'o'],
            ['bg', 'error', 'x'],
          ],
        },
        1,
      ],
      [
        'Background 가 아닌 노드의 background 포트는 따라간다',
        {
          nodes: [n('p1', 'parallel'), n('t1'), n('z')],
          edges: [
            ['p1', 'branch_0', 't1'],
            ['t1', 'background', 'z'],
          ],
        },
        1,
      ],
      [
        'Background 본문에서 병렬 분기 쪽으로 되돌아오는 노드는 다른 경로로도 닿을 때만 남긴다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('bg', 'background'),
            n('x'),
            n('c'),
            n('d'),
          ],
          edges: [
            ['p1', 'branch_0', 'bg'],
            ['bg', 'background', 'x'],
            ['bg', 'out', 'c'],
            ['x', 'out', 'c'],
            ['x', 'out', 'd'],
          ],
        },
        1,
      ],
      [
        'Background 본문 안 Background 의 본문도 뺀다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('bg', 'background'),
            n('bg2', 'background'),
            n('y'),
            n('w'),
          ],
          edges: [
            ['p1', 'branch_0', 'bg'],
            ['bg', 'background', 'bg2'],
            ['bg2', 'background', 'y'],
            ['bg2', 'out', 'w'],
          ],
        },
        1,
      ],
      [
        '병렬 분기마다 따로 판정한다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('bgA', 'background'),
            n('xa'),
            n('a2'),
            n('bgB', 'background'),
            n('xb'),
          ],
          edges: [
            ['p1', 'branch_0', 'bgA'],
            ['bgA', 'background', 'xa'],
            ['bgA', 'out', 'a2'],
            ['p1', 'branch_1', 'bgB'],
            ['bgB', 'background', 'xb'],
          ],
        },
        2,
      ],
      [
        '병렬 분기 안 Parallel 의 본문에 둔 Background 의 본문도 뺀다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('p2', 'parallel'),
            n('bg', 'background'),
            n('p3', 'parallel'),
            n('k'),
          ],
          edges: [
            ['p1', 'branch_0', 'p2'],
            ['p2', 'branch_0', 'bg'],
            ['bg', 'background', 'p3'],
            ['p2', 'done', 'k'],
          ],
        },
        1,
      ],
    ];

    it.each(cases)('%s', (_name, fixture, branchCount) => {
      const rule = ruleBranchBody(fixture, 'p1');
      expect(precheckBranchBody(fixture, 'p1', branchCount)).toEqual(rule);
    });

    it('대조가 공허하지 않다: 픽스처마다 본문이 있고 일부는 Background 본문을 뺀다', () => {
      const excluded = cases.filter(([, fixture]) => {
        const all = new Set(
          collectParallelBranchBodyNodeIds('p1', ruleGraphOf(fixture).edges),
        );
        return all.size > ruleBranchBody(fixture, 'p1').length;
      });
      expect(cases.every(([, f]) => ruleBranchBody(f, 'p1').length > 0)).toBe(
        true,
      );
      expect(excluded.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('컨테이너 본문 안 Background', () => {
    // 저장 규칙은 컨테이너 `body` 연결선을 따라 들어가고 실행 검사는 `containerId` 로 찾은
    // 본문에서 Background 본문으로만 닿는 노드를 가른다. 컨테이너 본문 노드 가운데 저장
    // 규칙이 병렬 분기 본문으로 세는 노드와 실행 검사가 회차 본문으로 세는 노드를 비교한다.
    it.each<[string, Fixture]>([
      [
        '컨테이너 안 Background 본문은 양쪽 모두 뺀다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('c', 'container'),
            n('a', 't', 'c'),
            n('bg', 'background', 'c'),
            n('x', 't', 'c'),
            n('cp', 'parallel', 'c'),
          ],
          edges: [
            ['p1', 'branch_0', 'c'],
            ['c', 'body', 'a'],
            ['a', 'out', 'bg'],
            ['bg', 'background', 'x'],
            ['x', 'out', 'cp'],
          ],
        },
      ],
      [
        '컨테이너 안에서 회차 본문으로도 닿는 노드는 양쪽 모두 남긴다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('c', 'container'),
            n('bg', 'background', 'c'),
            n('x', 't', 'c'),
            n('m', 't', 'c'),
          ],
          edges: [
            ['p1', 'branch_0', 'c'],
            ['c', 'body', 'bg'],
            ['bg', 'background', 'x'],
            ['bg', 'out', 'm'],
            ['x', 'out', 'm'],
          ],
        },
      ],
    ])('%s', (_name, fixture) => {
      const childIds = new Set(
        fixture.nodes
          .filter((node) => node.containerId === 'c')
          .map((x) => x.id),
      );
      const ruleInContainer = ruleBranchBody(fixture, 'p1').filter((id) =>
        childIds.has(id),
      );
      const allEdges = graphEdgesOf(fixture);
      const backgroundOnly = collectBackgroundOnlyNodeIds(
        allEdges
          .filter((e) => e.sourceNodeId === 'c' && e.sourcePort === 'body')
          .map((e) => e.targetNodeId),
        pickContainerInternalEdges(childIds, allEdges),
        isBackgroundIn(fixture),
      );
      const precheckInContainer = [...childIds]
        .filter((id) => !backgroundOnly.has(id))
        .sort();
      expect(precheckInContainer).toEqual(ruleInContainer);
      expect(backgroundOnly.size).toBeGreaterThan(0);
    });
  });

  describe('중첩 깊이 판정', () => {
    /** 저장 규칙: 그래프의 Parallel 가운데 하나라도 깊이 위반이면 true. */
    const ruleExceeded = (fixture: Fixture): boolean => {
      const graph = ruleGraphOf(fixture);
      return graph.nodes.some(
        (node) =>
          parallelNestedDepthExceededRule.evaluate(node, graph) !== null,
      );
    };

    /** 실행 검사: 맨 바깥 Parallel `p1` 의 사전 검사가 깊이 위반으로 던지면 true. */
    const precheckExceeded = (
      fixture: Fixture,
      branchCount: number,
    ): boolean => {
      const precheck = new ParallelPrecheck(kindOf);
      const nodes = entityNodesOf(fixture);
      const allEdges = graphEdgesOf(fixture);
      // 실행 그래프의 순방향 연결선에는 컨테이너 본문 노드가 없다.
      const topLevel = new Set(
        fixture.nodes.filter((node) => !node.containerId).map((x) => x.id),
      );
      const forwardEdges = allEdges.filter(
        (e) => topLevel.has(e.sourceNodeId) && topLevel.has(e.targetNodeId),
      );
      try {
        precheck.planParallelBody(
          nodes.find((node) => node.id === 'p1')!,
          precheck.buildParallelCheckGraph(nodes, allEdges),
          forwardEdges,
          [],
          branchCount,
          1,
        );
        return false;
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.startsWith('PARALLEL_NESTED_DEPTH_EXCEEDED')
        ) {
          return true;
        }
        throw err;
      }
    };

    it.each<[string, Fixture, boolean]>([
      [
        'Parallel → Parallel → Background → Parallel 은 넘지 않는다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('p2', 'parallel'),
            n('bg', 'background'),
            n('p3', 'parallel'),
          ],
          edges: [
            ['p1', 'branch_0', 'p2'],
            ['p2', 'branch_0', 'bg'],
            ['bg', 'background', 'p3'],
          ],
        },
        false,
      ],
      [
        'Background 본문 안에서 Parallel 이 세 겹이면 넘는다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('bg', 'background'),
            n('p3', 'parallel'),
            n('p4', 'parallel'),
            n('p5', 'parallel'),
          ],
          edges: [
            ['p1', 'branch_0', 'bg'],
            ['bg', 'background', 'p3'],
            ['p3', 'branch_0', 'p4'],
            ['p4', 'branch_0', 'p5'],
          ],
        },
        true,
      ],
      [
        'Background 의 다른 포트 뒤 Parallel 은 병렬 분기 본문 깊이로 센다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('p2', 'parallel'),
            n('bg', 'background'),
            n('x'),
            n('p3', 'parallel'),
          ],
          edges: [
            ['p1', 'branch_0', 'p2'],
            ['p2', 'branch_0', 'bg'],
            ['bg', 'out', 'x'],
            ['x', 'out', 'p3'],
          ],
        },
        true,
      ],
      [
        'Background 본문과 다른 경로로 함께 닿는 Parallel 은 병렬 분기 본문 깊이로 센다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('p2', 'parallel'),
            n('bg', 'background'),
            n('x'),
            n('p3', 'parallel'),
          ],
          edges: [
            ['p1', 'branch_0', 'p2'],
            ['p2', 'branch_0', 'bg'],
            ['bg', 'background', 'p3'],
            ['bg', 'out', 'x'],
            ['x', 'out', 'p3'],
          ],
        },
        true,
      ],
      [
        '병렬 분기 안 컨테이너 본문의 Parallel 두 겹은 넘는다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('c', 'container'),
            n('cp', 'parallel', 'c'),
            n('cp2', 'parallel', 'c'),
          ],
          edges: [
            ['p1', 'branch_0', 'c'],
            ['c', 'body', 'cp'],
            ['cp', 'branch_0', 'cp2'],
          ],
        },
        true,
      ],
      [
        '병렬 분기 안 컨테이너에 둔 Background 본문의 Parallel 두 겹은 넘지 않는다',
        {
          nodes: [
            n('p1', 'parallel'),
            n('c', 'container'),
            n('bg', 'background', 'c'),
            n('cp', 'parallel', 'c'),
            n('cp2', 'parallel', 'c'),
          ],
          edges: [
            ['p1', 'branch_0', 'c'],
            ['c', 'body', 'bg'],
            ['bg', 'background', 'cp'],
            ['cp', 'branch_0', 'cp2'],
          ],
        },
        false,
      ],
    ])('%s', (_name, fixture, exceeded) => {
      expect(ruleExceeded(fixture)).toBe(exceeded);
      expect(precheckExceeded(fixture, 1)).toBe(exceeded);
    });
  });
});
