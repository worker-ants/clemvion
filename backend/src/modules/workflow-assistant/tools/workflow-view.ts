import { ShadowSnapshot } from './shadow-workflow';
import { redactConfig } from './redact';

/**
 * `width` / `height` 를 포함하는 source 에서 **양의 유한 숫자** 만
 * 골라내 spread 용 partial 을 만든다. 0/음수/NaN/undefined 는 모두
 * 누락해 프롬프트 JSON 이 의도한 측정값만 담도록 보장한다.
 *
 * Caller 는 `{...spreadMeasured(n)}` 로 한 줄에 주입할 수 있고, 필드
 * 유무 정책이 한 곳에서 관리된다.
 */
export function spreadMeasured(source: {
  width?: number | null;
  height?: number | null;
}): { width?: number; height?: number } {
  const out: { width?: number; height?: number } = {};
  if (
    typeof source.width === 'number' &&
    Number.isFinite(source.width) &&
    source.width > 0
  ) {
    out.width = source.width;
  }
  if (
    typeof source.height === 'number' &&
    Number.isFinite(source.height) &&
    source.height > 0
  ) {
    out.height = source.height;
  }
  return out;
}

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
    /**
     * 프론트(React Flow) 가 렌더 후 측정한 px 단위 크기. 측정 전 노드는
     * 필드 자체가 누락되어 LLM 은 "고정 250px 폴백" 을 적용한다.
     */
    width?: number;
    height?: number;
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
      // 측정값은 spreadMeasured 로 정제 — 0/음수/NaN 은 모두 누락.
      ...spreadMeasured(n),
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
