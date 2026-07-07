import {
  GraphRuleGraph,
  GraphWarningRuleResult,
} from '../types';

/**
 * `graph:unescapable-cycle` — 분기 노드 없는 순환(=탈출 불가 무한 루프) 경고.
 *
 * 실행 엔진은 **분기 노드(Switch/If-Else 등)의 포트 라우팅**으로만 순환을 탈출할 수 있다
 * (spec/5-system/4-execution-engine.md §2.1: "_selectedPort 를 출력하지 않는 일반 노드
 * (pass-through)에 back-edge 를 연결하면 탈출 불가능한 무한 루프"). 따라서 back-edge 의
 * source 가 라우팅 노드가 **아니면** 그 순환은 정적으로 탈출 불가로 판정하고 경고한다.
 *
 * 이는 **차단이 아니라 경고**다 (severity 'warning') — 엔진은 분기 노드 back-edge 순환을
 * 정식 지원(재시도·폴링)하므로 캔버스는 사이클 생성을 막지 않고, 위험한 순환만 배지로
 * 드러낸다 (spec/3-workflow-editor/2-edge.md §2.2/§2.3, warn-not-block 결정 2026-07-07).
 *
 * @remarks 라우팅 판정은 런타임 `_selectedPort` 의 **정적 근사**다 — 아래 타입 집합은
 * 조건/케이스 기반으로 출력 포트를 선택하는(=`output.port` 를 설정하는) 노드들로,
 * spec/5-system/4-execution-engine.md §5.3 의 "조건 분기 노드" 정의와 **동일해야 한다**
 * (`if-else`, `switch`, `text-classifier`, `http-request`, `ai-agent`). 이 SoT 에 있는
 * 타입을 빠뜨리면 실제로는 탈출 가능한 순환에 false-positive 경고(over-warn)가 발생한다
 * (예: http_request 의 success/error 포트 back-edge). 새 조건 분기 노드 타입이 §5.3 에
 * 추가되면 본 집합도 함께 갱신한다. advisory 경고라 근사의 부정확성은 치명적이지 않다.
 */
export const UNESCAPABLE_CYCLE_RULE_ID = 'graph:unescapable-cycle';

/**
 * 런타임에 `_selectedPort` 로 출력 포트를 선택할 수 있는(=순환 탈출 가능) 노드 타입.
 * SoT: spec/5-system/4-execution-engine.md §5.3 조건 분기 노드
 * (`if-else`·`switch`·`text-classifier`·`http-request`·`ai-agent`).
 */
const BRANCH_NODE_TYPES: ReadonlySet<string> = new Set([
  'switch',
  'if_else',
  'text_classifier',
  'http_request',
  'ai_agent',
]);

/**
 * 컨테이너 반복 구조 엣지는 그래프 사이클이 아니다 (Loop/ForEach/Map 의 body 진입·emit
 * 수집). spec §6.2 / execution-engine §2.2 — 글로벌 DAG 검사에서 제외. backend
 * `shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS=['emit']` 와 동형: `sourceHandle==='body'`
 * (컨테이너→자식) 또는 `targetHandle==='emit'`(자식→컨테이너) 엣지를 순환 탐지에서 뺀다.
 */
function isContainerStructuralEdge(
  sourceHandle?: string | null,
  targetHandle?: string | null,
): boolean {
  return sourceHandle === 'body' || targetHandle === 'emit';
}

/**
 * 그래프의 탈출 불가 순환을 탐지해 경고 결과를 반환한다. per-node-type rule 과 달리
 * 그래프 전체를 한 번 순회하는 graph-level 평가라 별도 함수로 노출한다 (backend save +
 * frontend canvas 가 per-type 평가 결과와 합쳐 사용).
 */
export function evaluateGraphCycleWarnings(
  graph: GraphRuleGraph,
): GraphWarningRuleResult[] {
  const nodeType = new Map<string, string>();
  for (const n of graph.nodes) nodeType.set(n.id, n.type);

  // 컨테이너 구조 엣지를 제외한 adjacency (순환 탐지용). 각 엣지의 source 를 보존한다.
  const adjacency = new Map<string, { target: string; source: string }[]>();
  for (const id of nodeType.keys()) adjacency.set(id, []);
  for (const e of graph.edges) {
    if (isContainerStructuralEdge(e.sourceHandle, e.targetHandle)) continue;
    if (!nodeType.has(e.source) || !nodeType.has(e.target)) continue;
    adjacency.get(e.source)!.push({ target: e.target, source: e.source });
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodeType.keys()) color.set(id, WHITE);

  // DFS 로 back-edge(descendant→ancestor)를 찾는다. back-edge 의 source 가 분기 노드가
  // 아니면 그 순환은 탈출 불가 — source 노드에 경고를 붙인다.
  const flagged = new Map<string, GraphWarningRuleResult>();

  for (const start of nodeType.keys()) {
    if (color.get(start) !== WHITE) continue;
    const stack: Array<{ nodeId: string; idx: number }> = [
      { nodeId: start, idx: 0 },
    ];
    color.set(start, GRAY);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const out = adjacency.get(top.nodeId) ?? [];
      if (top.idx >= out.length) {
        color.set(top.nodeId, BLACK);
        stack.pop();
        continue;
      }
      const edge = out[top.idx];
      top.idx++;
      const tc = color.get(edge.target);
      if (tc === GRAY) {
        // back-edge — 순환. source 가 분기 노드가 아니면 탈출 불가 경고.
        const srcType = nodeType.get(edge.source) ?? '';
        if (!BRANCH_NODE_TYPES.has(srcType) && !flagged.has(edge.source)) {
          flagged.set(edge.source, {
            ruleId: UNESCAPABLE_CYCLE_RULE_ID,
            severity: 'warning',
            nodeId: edge.source,
            message:
              'This node feeds a cycle with no branch node to exit it — the loop may run forever. Route the back-edge from a branch node (Switch/If-Else) instead.',
          });
        }
      } else if (tc === WHITE) {
        color.set(edge.target, GRAY);
        stack.push({ nodeId: edge.target, idx: 0 });
      }
    }
  }

  return [...flagged.values()];
}
