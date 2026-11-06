import { GraphEdge } from './graph-builder';
import { collectParallelBranchMembership } from './parallel-branch-membership';

const edge = (
  sourceNodeId: string,
  sourcePort: string,
  targetNodeId: string,
): GraphEdge => ({
  sourceNodeId,
  sourcePort,
  targetNodeId,
  targetPort: 'in',
});

describe('collectParallelBranchMembership', () => {
  it('한 병렬 분기만 닿는 노드는 그 본문이고 둘 이상이 닿는 노드는 합류 노드다', () => {
    // par.branch_0 → a → merge, par.branch_1 → b → merge → after
    const edges = [
      edge('par', 'branch_0', 'a'),
      edge('par', 'branch_1', 'b'),
      edge('a', 'out', 'merge'),
      edge('b', 'out', 'merge'),
      edge('merge', 'out', 'after'),
    ];

    const m = collectParallelBranchMembership('par', edges, 2);

    expect(m.branchEntries).toEqual([new Set(['a']), new Set(['b'])]);
    expect(m.bodyNodeIdsPerBranch).toEqual([new Set(['a']), new Set(['b'])]);
    expect(m.joinNodeIds).toEqual(new Set(['merge', 'after']));
    expect(m.allBodyNodeIds).toEqual(new Set(['a', 'b']));
  });

  it('branchCount 이상 번호의 branch_N 연결선은 따라가지 않는다', () => {
    const edges = [
      edge('par', 'branch_0', 'a'),
      edge('par', 'branch_1', 'b'),
      edge('par', 'branch_3', 'c'),
    ];

    const narrow = collectParallelBranchMembership('par', edges, 2);
    const wide = collectParallelBranchMembership('par', edges, 16);

    expect(narrow.allBodyNodeIds).toEqual(new Set(['a', 'b']));
    expect(wide.bodyNodeIdsPerBranch).toHaveLength(16);
    expect(wide.bodyNodeIdsPerBranch[3]).toEqual(new Set(['c']));
  });

  it('done 등 branch_N 이 아닌 포트는 입구로 보지 않는다', () => {
    const edges = [
      edge('par', 'branch_0', 'a'),
      edge('par', 'done', 'sink'),
      edge('par', 'branch_x', 'z'),
    ];

    const m = collectParallelBranchMembership('par', edges, 2);

    expect(m.allBodyNodeIds).toEqual(new Set(['a']));
    expect(m.bodyNodeIdsPerBranch[1]).toEqual(new Set());
  });

  it('본문 노드는 입구에서 너비 우선으로 찾은 순서를 지킨다', () => {
    // branch_0 → a → (b, c), b → d
    const edges = [
      edge('par', 'branch_0', 'a'),
      edge('a', 'out', 'b'),
      edge('a', 'out', 'c'),
      edge('b', 'out', 'd'),
    ];

    const m = collectParallelBranchMembership('par', edges, 2);

    expect([...m.bodyNodeIdsPerBranch[0]]).toEqual(['a', 'b', 'c', 'd']);
    expect(m.forwardAdj.get('a')?.map((e) => e.targetNodeId)).toEqual([
      'b',
      'c',
    ]);
  });
});
