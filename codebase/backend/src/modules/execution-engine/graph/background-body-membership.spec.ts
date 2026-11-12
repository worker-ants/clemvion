import { collectBackgroundOnlyNodeIds } from './background-body-membership';
import { GraphEdge } from './graph-builder';

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

const backgroundNodes =
  (...ids: string[]) =>
  (nodeId: string) =>
    ids.includes(nodeId);

describe('collectBackgroundOnlyNodeIds (CLE-T-BTR4ZA)', () => {
  it('Background 의 background 연결선 뒤 노드만 고르고 회차 본문 노드는 넣지 않는다', () => {
    // body → bg, bg.main → y, bg.background → bpar → x
    const edges = [
      edge('bg', 'main', 'y'),
      edge('bg', 'background', 'bpar'),
      edge('bpar', 'branch_0', 'x'),
    ];

    expect(
      collectBackgroundOnlyNodeIds(['bg'], edges, backgroundNodes('bg')),
    ).toEqual(new Set(['bpar', 'x']));
  });

  it('회차 본문 쪽에서도 닿는 노드는 넣지 않는다', () => {
    // bg.main → m, bg.background → bb → m → after
    const edges = [
      edge('bg', 'main', 'm'),
      edge('bg', 'background', 'bb'),
      edge('bb', 'out', 'm'),
      edge('m', 'out', 'after'),
    ];

    expect(
      collectBackgroundOnlyNodeIds(['bg'], edges, backgroundNodes('bg')),
    ).toEqual(new Set(['bb']));
  });

  it('Background 본문 안 Background 의 본문도 넣는다', () => {
    // bg.background → bg2, bg2.main → a, bg2.background → b
    const edges = [
      edge('bg', 'background', 'bg2'),
      edge('bg2', 'main', 'a'),
      edge('bg2', 'background', 'b'),
    ];

    expect(
      collectBackgroundOnlyNodeIds(['bg'], edges, backgroundNodes('bg', 'bg2')),
    ).toEqual(new Set(['bg2', 'a', 'b']));
  });

  it('회차 본문 안 Background 가 둘이면 두 본문을 모두 넣는다', () => {
    // bg1.main → bg2, bg1.background → p, bg2.background → q
    const edges = [
      edge('bg1', 'main', 'bg2'),
      edge('bg1', 'background', 'p'),
      edge('bg2', 'background', 'q'),
    ];

    expect(
      collectBackgroundOnlyNodeIds(
        ['bg1'],
        edges,
        backgroundNodes('bg1', 'bg2'),
      ),
    ).toEqual(new Set(['p', 'q']));
  });

  it('Background 가 아닌 노드의 background 이름 포트는 Background 본문으로 보지 않는다', () => {
    const edges = [edge('n', 'background', 'm')];

    expect(
      collectBackgroundOnlyNodeIds(['n'], edges, backgroundNodes()),
    ).toEqual(new Set());
  });

  it('어느 쪽에서도 닿지 않는 노드는 넣지 않는다', () => {
    // bg.background → b. orphan 은 연결선이 없다.
    const edges = [edge('bg', 'background', 'b'), edge('orphan', 'out', 'z')];

    expect(
      collectBackgroundOnlyNodeIds(['bg'], edges, backgroundNodes('bg')),
    ).toEqual(new Set(['b']));
  });
});
