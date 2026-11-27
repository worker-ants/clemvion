/**
 * 엔진 통합 스펙이 그래프를 만들 때 쓰는 노드 · 연결선 픽스처.
 *
 * 노드는 `workflowId` 워크플로우에 속하고 켜져 있으며 컨테이너 · 도구 소유자가 없다.
 * `test_node` 타입은 트리거 범주, 나머지는 로직 범주다. 라벨은 기본값이 노드 ID 다.
 * 연결선은 데이터 연결선이고 대상 포트는 `in` 이다. 기본 ID 는
 * `<source>.<sourcePort>-><target>` 이다. 다른 값이 필요하면 마지막 인자로 덮어쓴다.
 */
import { Node, NodeCategory } from '../../nodes/entities/node.entity';
import { Edge, EdgeType } from '../../edges/entities/edge.entity';
import { workflowId } from './engine-service-harness';

export function graphNode(
  id: string,
  type: string,
  config: Record<string, unknown> = {},
  overrides: Partial<Node> = {},
): Partial<Node> {
  return {
    id,
    workflowId,
    type,
    category: type === 'test_node' ? NodeCategory.TRIGGER : NodeCategory.LOGIC,
    label: id,
    config,
    isDisabled: false,
    containerId: undefined,
    toolOwnerId: undefined,
    ...overrides,
  };
}

export function graphEdge(
  source: string,
  sourcePort: string,
  target: string,
  overrides: Partial<Edge> = {},
): Partial<Edge> {
  return {
    id: `${source}.${sourcePort}->${target}`,
    workflowId,
    sourceNodeId: source,
    sourcePort,
    targetNodeId: target,
    targetPort: 'in',
    type: EdgeType.DATA,
    ...overrides,
  };
}
