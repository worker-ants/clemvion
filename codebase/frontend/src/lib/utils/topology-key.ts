/**
 * cross-node graphWarningRules 의 debounce 재평가 트리거를 위한 topology key 계산.
 *
 * WorkflowEditor 는 graph 변경 시점에만 평가를 재실행해야 한다. drag(위치 변경)·
 * 선택 변경은 graph rule 평가와 무관하므로 key 에서 제외하고, rule 이 실제로 읽는
 * 입력(노드 id/type + parallel config 의 `maxConcurrency`/`branchCount`, 엣지 연결)만
 * 포함한다.
 *
 * 주의: 노드 config 전체를 `JSON.stringify` 하지 않는다 — (1) 매 렌더 전체 config
 * 직렬화 비용, (2) 키 순서 비보장으로 인한 불필요한 재평가를 피하기 위해, rule 이
 * 읽는 필드만 **고정 순서**로 직렬화한다. 프로덕션(`workflow-editor.tsx`)과 테스트
 * (`workflow-editor-debounce.test.ts`)가 동일 함수를 import 해 동작 SSOT 를 유지한다.
 */

/** rule 평가에 실제로 사용되는 config 필드 (고정 순서로 직렬화). */
type RuleRelevantConfig = {
  maxConcurrency?: unknown;
  branchCount?: unknown;
};

type TopologyNode = {
  id: string;
  data?: { type?: string; config?: unknown } | undefined;
};

type TopologyEdge = {
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
};

/**
 * rule 이 읽는 config 필드만 고정 순서(`maxConcurrency` → `branchCount`)로 직렬화.
 * config 가 객체가 아니면 빈 슬롯으로 처리한다.
 */
function serializeRuleConfig(config: unknown): string {
  const c =
    config && typeof config === "object"
      ? (config as RuleRelevantConfig)
      : undefined;
  const maxConcurrency = c?.maxConcurrency ?? null;
  const branchCount = c?.branchCount ?? null;
  return `${JSON.stringify(maxConcurrency)}|${JSON.stringify(branchCount)}`;
}

export function computeNodeTopologyKey(nodes: readonly TopologyNode[]): string {
  return nodes
    .map(
      (n) =>
        `${n.id}:${String(n.data?.type ?? "")}:${serializeRuleConfig(
          n.data?.config,
        )}`,
    )
    .join(",");
}

export function computeEdgeTopologyKey(edges: readonly TopologyEdge[]): string {
  return edges
    .map(
      (e) =>
        `${e.source}:${e.sourceHandle ?? ""}→${e.target}:${e.targetHandle ?? ""}`,
    )
    .join(",");
}
