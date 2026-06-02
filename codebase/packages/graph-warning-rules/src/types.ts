/**
 * @workflow/graph-warning-rules — pure graph shapes.
 *
 * 본 패키지는 backend (TypeORM Node/Edge entity) 와 frontend (ReactFlow
 * node/edge) 양쪽이 공유하는 cross-node graphWarningRule 의 SSOT 이므로,
 * 어느 한쪽의 런타임/엔티티 타입에도 의존하지 않는 **최소 순수 shape** 만
 * 정의한다. 각 앱은 자신의 graph 표현을 아래 shape 으로 매핑해 평가 유틸에
 * 넘긴다.
 *
 * SoT: spec/conventions/cross-node-warning-rules.md.
 */

/** 평가에 필요한 최소 노드 view. backend `Node` entity 는 구조적으로 호환된다. */
export interface GraphRuleNode {
  id: string;
  type: string;
  config?: Record<string, unknown>;
  label?: string;
}

/**
 * 평가에 필요한 최소 엣지 view. ReactFlow 의 `source/target/sourceHandle`
 * 명명을 따른다. backend `Edge` entity 는 `sourceNodeId/targetNodeId/sourcePort`
 * 명명이므로 caller (backend) 가 매핑해서 넘긴다.
 */
export interface GraphRuleEdge {
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
}

/** read-only graph view. */
export interface GraphRuleGraph {
  nodes: readonly GraphRuleNode[];
  edges: readonly GraphRuleEdge[];
}

/**
 * graph 구조 전체를 보고 평가하는 cross-node warningRule (parallel-p2 결정 D +
 * E + I, 2026-05-30 — SoT: spec/conventions/cross-node-warning-rules.md).
 *
 * 기존 node-summary 의 mini-DSL 은 단일 노드의 config 만 평가하므로 부모-자식
 * cross 평가 (외부 Parallel 의 maxConcurrency × 내부 Parallel 의
 * maxConcurrency / Parallel 노드의 분기 서브그래프 안에 또 Parallel 이 있는지)
 * 를 표현 불가. 본 메커니즘은 graph 전체를 함수 인자로 받아 평가하는 형태로
 * 그 한계를 해소한다.
 *
 * 평가 시점:
 *  - **workflow save endpoint** — POST/PUT workflow 의 nodes/edges 저장 시점에
 *    모든 노드를 순회하며 평가. `severity: 'error'` triggered 시 400 reject.
 *  - **frontend canvas** — 같은 정의를 공유해 canvas 가 graph 변경 시점마다
 *    평가 + severity 별 배지.
 */
export interface GraphWarningRule {
  /** 안정적 식별자 (예: `parallel:nested-depth-exceeded`). canvas 배지 dedupe / 로그 추적 키. */
  id: string;
  /**
   * `error` — workflow save endpoint reject + canvas 빨간 배지 + 저장 불가.
   * `warning` — 로깅 / response 포함, 저장은 통과, canvas 노란 배지.
   */
  severity: 'error' | 'warning';
  /**
   * 평가 함수. triggered 시 메시지를 담은 객체 반환, 미triggered 시 null.
   * 인자:
   *  - `node` — rule 이 등재된 노드 인스턴스 (graph 안의 자기 자신)
   *  - `graph` — workflow 의 nodes/edges 전체 view (read-only)
   *
   * 반환:
   *  - `message` — 영문 SoT / fallback (로그·비-ko 로케일·매핑 누락 시 그대로 노출)
   *  - `params` — 동적 메시지의 보간 값(노드 라벨·수치 등). frontend 가
   *    `GRAPH_WARNING_KO[ruleId]` 한국어 템플릿에 `{{name}}` 으로 보간한다
   *    (SoT: spec/conventions/i18n-userguide.md Principle 3-C). optional —
   *    정적 메시지 rule 은 생략 가능(하위호환).
   */
  evaluate: (
    node: GraphRuleNode,
    graph: GraphRuleGraph,
  ) => { message: string; params?: Record<string, string | number> } | null;
}

export interface GraphWarningRuleResult {
  ruleId: string;
  severity: 'error' | 'warning';
  nodeId: string;
  /** 영문 SoT / fallback. ko 표시 문자열은 frontend 가 `ruleId` 키로 localize. */
  message: string;
  /** 동적 메시지 보간 값. `GRAPH_WARNING_KO[ruleId]` 템플릿의 `{{name}}` 에 대응. */
  params?: Record<string, string | number>;
}
