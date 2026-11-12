import { buildGraph } from './graph-builder';
import { Node } from '../../nodes/entities/node.entity';
import { Edge } from '../../edges/entities/edge.entity';

const node = (
  id: string,
  containerId: string | null | undefined,
  toolOwnerId: string | null = null,
): Node => ({ id, containerId, toolOwnerId }) as unknown as Node;

const edge = (source: string, target: string): Edge =>
  ({
    sourceNodeId: source,
    sourcePort: 'out',
    targetNodeId: target,
    targetPort: 'in',
  }) as unknown as Edge;

describe('buildGraph', () => {
  // 맨 바깥(null · undefined), 컨테이너 fe 의 본문, 그 안 컨테이너 inner 의 본문,
  // fe 단계 도구 영역 노드를 섞는다.
  const nodes = [
    node('top', null),
    node('fe', undefined),
    node('a', 'fe'),
    node('b', 'fe'),
    node('innerChild', 'inner'),
    node('tool', 'fe', 'a'),
  ];
  const edges = [
    edge('top', 'fe'),
    edge('fe', 'a'),
    edge('a', 'b'),
    edge('b', 'innerChild'),
    edge('a', 'tool'),
  ];

  it('범위를 주지 않으면 맨 바깥 노드와 그 사이 연결선만 남긴다', () => {
    const { graphNodes, graphEdges } = buildGraph(nodes, edges);

    expect(graphNodes.map((n) => n.id)).toEqual(['top', 'fe']);
    expect(
      graphEdges.map((e) => `${e.sourceNodeId}>${e.targetNodeId}`),
    ).toEqual(['top>fe']);
  });

  it('컨테이너 ID 를 범위로 주면 그 컨테이너의 본문 노드만 남기고 도구 영역 · 다른 단계 노드는 뺀다 (CLE-T-MR6ZH3)', () => {
    const { graphNodes, graphEdges } = buildGraph(nodes, edges, 'fe');

    expect(graphNodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(
      graphEdges.map((e) => `${e.sourceNodeId}>${e.targetNodeId}`),
    ).toEqual(['a>b']);
  });
});
