---
id: cross-node-warning-rules
status: partial
code:
  - codebase/backend/src/nodes/core/graph-warning-rule.ts
  - codebase/backend/src/nodes/core/node-component.interface.ts
pending_plans:
  - plan/in-progress/cross-node-warning-rules.md
---

# Cross-Node WarningRule 컨벤션

> 관련 문서: [노드 Output 규약](./node-output.md) · [parallel-p2.md 결정 D/E/I](../../plan/in-progress/parallel-p2.md) · [`graph-warning-rule.ts`](../../codebase/backend/src/nodes/core/graph-warning-rule.ts)

## 1. 목적

`NodeComponentMetadata.warningRules` 의 mini-DSL (참조: [`@workflow/node-summary`](../../codebase/packages/node-summary/)) 은 **단일 노드의 config** 만 평가한다 — `branchCount < 2 || branchCount > 16` 같은 식. 부모-자식 cross 평가 (외부 Parallel 의 `maxConcurrency` × 내부 Parallel 의 `maxConcurrency` / 외부 Parallel 의 분기 body 안에 또 Parallel 이 있는지) 는 표현 불가.

본 컨벤션은 graph 전체를 함수 인자로 받아 평가하는 cross-node warningRule 메커니즘을 정의한다. parallel-p2 의 결정 D (concurrency clamp 의 frontend canvas 사전 경고) + E (중첩 깊이 검증의 3중 가드 = workflow save reject + canvas 사전 경고 + runtime reject) + I (인프라 별 plan 분리) 의 SoT.

## 2. 두 메커니즘의 분기

| 항목 | `warningRules` (mini-DSL) | `graphWarningRules` (cross-node) |
|---|---|---|
| 입력 | `config` (단일 노드) | `(node, { nodes, edges })` (graph 전체) |
| 표현 | mini-DSL 문자열 (`branchCount < 2`) | JS 함수 (`evaluate: (node, graph) => result \| null`) |
| 평가 위치 | frontend canvas + backend `handler.validate` (SSOT, `@workflow/node-summary`) | workflow save endpoint + frontend canvas + runtime (의무) — 본 컨벤션 |
| severity | `blocking` / `advisory` | `error` / `warning` |
| 사용처 | 단일 노드 config 위반 (가장 흔한 케이스 — 모든 노드의 기본 경로) | 부모-자식 / 형제 노드 관계 위반 (graph-level 규칙) |

**작성자 가이드**: 단일 노드 config 만으로 평가 가능하면 `warningRules` 우선 — 표현이 간결하고 frontend/backend SSOT 가 보장됨. 부모 / 자식 / graph 전역 정보가 필요하면 `graphWarningRules` 채택.

## 3. 타입 정의

```ts
// codebase/backend/src/nodes/core/graph-warning-rule.ts
export interface GraphWarningRule {
  id: string;
  severity: 'error' | 'warning';
  evaluate: (
    node: Node,
    graph: { nodes: readonly Node[]; edges: readonly Edge[] },
  ) => { message: string } | null;
}

export interface GraphWarningRuleResult {
  ruleId: string;
  severity: 'error' | 'warning';
  nodeId: string;
  message: string;
}
```

`NodeComponentMetadata.graphWarningRules?: readonly GraphWarningRule[]` 신규 필드.

## 4. severity 정책

| severity | workflow save endpoint | frontend canvas | 사용 예 |
|---|---|---|---|
| `error` | 저장 reject (400 Bad Request, response 에 rule.message 포함) | 빨간 배지 + 저장 버튼 disabled | 깊이 위반, cycle, 명백한 invariant 깨짐 |
| `warning` | 저장 통과 (로깅 / response 에 포함) | 노란 배지 + 저장은 가능 | 운영 환경 risk 가 있지만 runtime safety net 이 있는 케이스 (예: concurrency cap silent clamp) |

## 5. 평가 시점 — 3중 가드 (parallel-p2 결정 E)

같은 invariant 가 세 시점에 가드되어야 한다 (특히 severity `error` rule):

1. **workflow save endpoint** — POST/PUT workflow nodes/edges 갱신 시 전수 평가. severity `error` triggered 시 reject. **본 PR 의 후속**.
2. **frontend canvas** — graph 변경 시점마다 평가, 배지 표시 + 저장 버튼 제어. **본 PR 의 후속** (SSOT 보장 메커니즘 결정 필요).
3. **runtime** — 노드 핸들러 / 엔진의 graph 검증 단계에서 자기 노드 중심 평가. 본 컨벤션과 별개로, runtime 의 hand-coded 검증 (예: `PARALLEL_NESTED_DEPTH_EXCEEDED` throw) 과 메시지 의미 일관성을 보장.

> 본 컨벤션은 인프라 (type + 평가 유틸 + Parallel 등재 sample) 만 정의. 1~2 의 호출처 통합은 [`plan/in-progress/cross-node-warning-rules.md`](../../plan/in-progress/cross-node-warning-rules.md) 의 후속 PR 에서 처리.

## 6. SSOT 보장 (backend ↔ frontend)

GraphWarningRule 의 `evaluate` 가 JS 함수라 frontend / backend 가 같은 함수 정의를 실행해야 평가 결과가 일치한다. 현 PR 은 **backend-only** — frontend 평가 호출은 후속 PR. 후속 PR 에서 다음 옵션 중 결정:

- (옵션 A) **shared package** (`codebase/packages/node-graph-rules/`) — rule 정의를 별 package 로 분리, backend metadata 와 frontend canvas 모두 import. 추천 — drift 없음.
- (옵션 B) **metadata API serialization** — backend 가 rule 함수를 직렬화해 frontend 로 전송, eval 로 실행. 보안 우려 (eval). 비추천.

본 PR 은 옵션 A 가정으로 type 정의를 위치 (`nodes/core/`) — 후속 PR 에서 그대로 packages 로 이동하면 됨.

## 7. 평가 유틸

```ts
// 단일 노드 평가 (자기 metadata 의 rules 모두 평가)
evaluateGraphWarningRules(node, graph, rules) → GraphWarningRuleResult[]

// graph 전체 평가 (resolver 가 node.type → rules 매핑 제공)
evaluateGraphWarningRulesForGraph(graph, resolver) → GraphWarningRuleResult[]
```

순수 함수 — 동일 graph snapshot 에 결정적 결과. caller 가 debounce / memoization 책임 (성능 — N 노드 × M rule 평가).

## 8. 현재 등재된 rule (sample)

| 노드 | rule id | severity | 의미 |
|---|---|---|---|
| Parallel | `parallel:nested-depth-exceeded` | error | 외부 Parallel 의 분기 body 에 내부 Parallel + 그 분기 body 에 또 Parallel → depth 3 reject (parallel-p2 결정 #3) |
| Parallel | `parallel:nested-concurrency-cap` | warning | 외부 effectiveConcurrency × 내부 effectiveConcurrency > 32 시 warning (runtime silent clamp 가 안전망 — parallel-p2 결정 #3 + D) |

## 9. 향후 확장 (본 컨벤션 범위 밖)

- Loop / ForEach 의 중첩 깊이 정책 (도입 시)
- Map / Filter 의 부모 컨테이너 contextual 검증
- workflow-level graph 검증 (cyclic, unreachable — 현 runtime 검증과 합칠지 분리할지)

## Rationale

본 메커니즘은 parallel-p2 의 결정 D + E 가 cross-node 평가를 요구함에 따라 신설. mini-DSL 확장 (옵션 1) 대신 함수형 rule (옵션 2) 을 채택한 근거:

- **표현력** — 부모 노드 접근자만 추가하는 mini-DSL 확장은 cycle / 형제 / depth 등 graph 위상에 의존하는 invariant 를 표현하기 어렵다. 함수형은 graph 전체를 자유롭게 walk 가능.
- **확장성** — Loop / ForEach 등 향후 추가될 cross-node 정책이 mini-DSL 의 표현력을 다시 확장해야 하는 부담을 회피.
- **SSOT 보장 비용** — 옵션 1 도 frontend / backend 양쪽에 같은 평가 엔진 구현 필요 (현재 `@workflow/node-summary` 가 이를 담당). 옵션 2 는 함수 정의 자체를 shared package 로 분리하면 평가 엔진 중복 불요.

mini-DSL 의 단일 노드 평가는 사용 빈도 압도적으로 높고 표현 간결 — 그대로 유지. graphWarningRules 는 cross-node case 에만 한정.
