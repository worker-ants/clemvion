import { toWorkflowView } from './workflow-view';
import type { ShadowSnapshot } from './shadow-workflow';

/**
 * toWorkflowView 는 시스템 프롬프트 스냅샷과 `get_current_workflow` 도구 반환
 * 값의 단일 형 정의다. width/height 는 프론트 측정값을 그대로 흘리되 측정 전
 * (undefined) 인 노드가 있으면 필드를 아예 누락해 프롬프트 JSON 이 `null` 로
 * 뚱뚱해지지 않도록 한다.
 */
describe('toWorkflowView', () => {
  it('omits width/height when the shadow node does not carry them', () => {
    const snap: ShadowSnapshot = {
      nodes: [
        {
          id: 'n1',
          type: 'http_request',
          category: 'integration',
          label: 'A',
          positionX: 100,
          positionY: 200,
          config: {},
        },
      ],
      edges: [],
    };
    const view = toWorkflowView(snap);
    expect(view.nodes).toHaveLength(1);
    const node = view.nodes[0];
    expect(node.position).toEqual({ x: 100, y: 200 });
    expect('width' in node).toBe(false);
    expect('height' in node).toBe(false);
  });

  it('includes width/height verbatim when the shadow node provides them', () => {
    const snap: ShadowSnapshot = {
      nodes: [
        {
          id: 'n1',
          type: 'carousel',
          category: 'presentation',
          label: 'Cards',
          positionX: 500,
          positionY: 300,
          width: 320,
          height: 180,
          config: {},
        },
      ],
      edges: [],
    };
    const view = toWorkflowView(snap);
    const node = view.nodes[0];
    expect(node.width).toBe(320);
    expect(node.height).toBe(180);
  });

  it('handles a mix of measured and unmeasured nodes in the same snapshot', () => {
    const snap: ShadowSnapshot = {
      nodes: [
        {
          id: 'measured',
          type: 'http_request',
          category: 'integration',
          label: 'M',
          positionX: 0,
          positionY: 0,
          width: 240,
          height: 80,
          config: {},
        },
        {
          id: 'unmeasured',
          type: 'http_request',
          category: 'integration',
          label: 'U',
          positionX: 400,
          positionY: 0,
          config: {},
        },
      ],
      edges: [],
    };
    const view = toWorkflowView(snap);
    expect(view.nodes[0].width).toBe(240);
    expect(view.nodes[0].height).toBe(80);
    expect('width' in view.nodes[1]).toBe(false);
    expect('height' in view.nodes[1]).toBe(false);
  });
});
