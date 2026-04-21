import { ShadowSnapshot } from './shadow-workflow';
import { redactConfig } from './redact';

/**
 * LLM에 노출하는 워크플로우 스냅샷의 단일 정렬된 표현.
 *
 * - 시스템 프롬프트(`## Current workflow snapshot` JSON)와
 * - `get_current_workflow` 도구 반환값
 *
 * 둘이 동일한 shape을 쓰도록 하나의 헬퍼로 통일한다. 특히 엣지 `id` 와
 * 노드 `category` 는 LLM 이 `remove_edge` / 카테고리 기반 질문 등에 바로
 * 쓰기 때문에 양쪽 표현에서 누락되어서는 안 된다.
 *
 * `config` 에는 redactConfig() 정책을 일괄 적용한다.
 */
export interface WorkflowView {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    category: string;
    position: { x: number; y: number };
    containerId: string | null;
    config: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    sourcePort: string;
    target: string;
    targetPort: string;
    type: 'data' | 'error';
  }>;
}

export function toWorkflowView(snapshot: ShadowSnapshot): WorkflowView {
  return {
    nodes: snapshot.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      category: n.category,
      position: { x: n.positionX, y: n.positionY },
      containerId: n.containerId ?? null,
      config: redactConfig(n.config ?? {}),
    })),
    edges: snapshot.edges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      sourcePort: e.sourcePort,
      target: e.targetNodeId,
      targetPort: e.targetPort,
      type: e.type,
    })),
  };
}
