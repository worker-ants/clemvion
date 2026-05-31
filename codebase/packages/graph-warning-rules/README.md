# @workflow/graph-warning-rules

graph 구조 전체를 보고 평가하는 cross-node warning/error rule(`graphWarningRules`)의 SSOT.

- 백엔드: workflow save validate + `GET /workflows/:id/graph-warnings` 엔드포인트
- 프론트엔드: 캔버스 graph 변경 시점 사전 평가 + severity 별 배지

같은 규칙을 두 layer 가 공유해야 spec 변경 시 자동으로 정렬된다.

## 빌드

```bash
npm run build
npm test
```

`codebase/backend` / `codebase/frontend` 가 `file:` dep 로 import 하므로 두 앱 실행 전 build 가 선행되어야 한다.

## 순수 shape (boundary)

본 패키지는 TypeORM / ReactFlow / DOM / Node API 에 의존하지 않는 **최소 순수 shape** 만 정의한다. 각 앱은 자신의 graph 표현을 아래로 매핑해서 평가한다.

```ts
interface GraphRuleNode { id: string; type: string; config?: Record<string, unknown>; label?: string }
interface GraphRuleEdge { source: string; sourceHandle?: string | null; target: string; targetHandle?: string | null }
```

백엔드 `Edge` entity 는 `sourceNodeId/targetNodeId/sourcePort/targetPort` 명명이므로 caller 가 `source/target/sourceHandle/targetHandle` 로 매핑해서 넘긴다. 백엔드 `Node` entity 는 구조적으로 `GraphRuleNode` 와 호환된다.

## 주요 export

| Symbol | 설명 |
|--------|------|
| `evaluateGraphWarningRules(node, graph, rules)` | 단일 노드 평가 → `GraphWarningRuleResult[]` |
| `evaluateGraphWarningRulesForGraph(graph, rulesResolver)` | graph 전체 평가 |
| `GRAPH_WARNING_RULES_BY_TYPE` | `Record<nodeType, rules>` — frontend 가 type 만으로 resolver 구성 |
| `parallelGraphWarningRules` | Parallel 노드의 2개 rule (`nested-depth-exceeded` error, `nested-concurrency-cap` warning) |
| `collectParallelBranchBodyNodeIds` | Parallel 분기 body BFS 헬퍼 |
| `PARALLEL_NESTED_CONCURRENCY_CAP` | 32 |

SoT: `spec/conventions/cross-node-warning-rules.md`.
