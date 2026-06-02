---
id: cross-node-warning-rules
status: implemented
code:
  - codebase/packages/graph-warning-rules/**
  - codebase/backend/src/nodes/core/graph-warning-rule.ts
  - codebase/backend/src/nodes/core/node-component.interface.ts
  - codebase/backend/src/nodes/logic/parallel/parallel.schema.ts
  - codebase/backend/src/modules/workflows/workflows.service.ts
  - codebase/frontend/src/components/editor/workflow-editor.tsx
  - codebase/frontend/src/lib/stores/editor-store.ts
  - codebase/frontend/src/components/editor/canvas/custom-node.tsx
  - codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx
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

타입·평가 유틸·Parallel rule 의 단일 진실은 shared package `@workflow/graph-warning-rules` (`codebase/packages/graph-warning-rules/`). backend·frontend 모두 이 패키지를 import 한다 (§6). 패키지는 TypeORM/앱 비의존 **pure shape** 로 정의한다:

```ts
// @workflow/graph-warning-rules
export interface GraphRuleNode {
  id: string;
  type: string;
  config?: Record<string, unknown>;
  label?: string;
}
export interface GraphRuleEdge {
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
}

export interface GraphWarningRule {
  id: string;
  severity: 'error' | 'warning';
  evaluate: (
    node: GraphRuleNode,
    graph: { nodes: readonly GraphRuleNode[]; edges: readonly GraphRuleEdge[] },
  ) => { message: string; params?: Record<string, string | number> } | null;
}

export interface GraphWarningRuleResult {
  ruleId: string;
  severity: 'error' | 'warning';
  nodeId: string;
  /** 영문 SoT / fallback. ko 로케일 표시 문자열은 frontend 가 ruleId 로 localize. */
  message: string;
  /** 동적 메시지의 보간 값 (노드 라벨·수치 등). frontend 가 `GRAPH_WARNING_KO[ruleId]` 템플릿에 `{{name}}` 보간. */
  params?: Record<string, string | number>;
}
```

- **메시지 localization**: `message` 는 **영문 SoT/fallback** 이며, 동적 값(노드 라벨·수치)을 보간하는 rule 은 그 값을 `params` 로 분리해 노출한다. ko 로케일 canvas 배지·저장 거부 안내 등 사용자 표시 문자열은 frontend `translateGraphWarning(result, locale)` 가 `ruleId` 키로 한국어 템플릿을 골라 `params` 를 `{{name}}` 보간해 만든다. 매핑 SoT·의무·자동 가드는 [`i18n-userguide.md` Principle 3-C](./i18n-userguide.md). 신규 graphWarningRule 추가 시 동적 값 `params` 노출 + `GRAPH_WARNING_KO` 매핑이 동일 PR 의무.

- `NodeComponentMetadata.graphWarningRules?: readonly GraphWarningRule[]` 신규 필드 — Parallel 노드는 패키지의 `parallelGraphWarningRules` 를 참조.
- backend 는 thin adapter (`graph-warning-rule.ts`) 가 TypeORM `Node`/`Edge` entity 를 `GraphRuleNode`/`GraphRuleEdge` 로 매핑(`toRuleNode`/`toRuleEdge`) 후 패키지 유틸에 위임.
- frontend 는 canvas/store 의 node·edge 를 동일 pure shape 로 매핑(`mapToRuleGraph`)해 패키지 유틸을 **로컬 실행**.
- frontend 가 rule 을 type 으로 해석하도록 패키지가 `GRAPH_WARNING_RULES_BY_TYPE: Readonly<Record<string, readonly GraphWarningRule[]>>` 맵을 export.

## 4. severity 정책

| severity | workflow save endpoint | frontend canvas | 사용 예 |
|---|---|---|---|
| `error` | 저장 reject (400 Bad Request, response 에 rule.message 포함) | 빨간 배지 + 저장 버튼 disabled | 깊이 위반, cycle, 명백한 invariant 깨짐 |
| `warning` | 저장 통과 (로깅 / response 에 포함) | 노란 배지 + 저장은 가능 | 운영 환경 risk 가 있지만 runtime safety net 이 있는 케이스 (예: concurrency cap silent clamp) |

## 5. 평가 시점 — 3중 가드 (parallel-p2 결정 E)

같은 invariant 가 세 시점에 가드되어야 한다 (특히 severity `error` rule):

1. **workflow save endpoint** — `WorkflowsService.saveCanvas` 가 syncNodes/syncEdges 와 동일 트랜잭션에서 `evaluateGraphWarnings` 호출. severity `error` 시 `BadRequestException(GRAPH_VALIDATION_FAILED)` → rollback. ✅ 구현됨.
2. **frontend canvas** — graph 변경 시점마다 `evaluateGraphWarningsLocal` 로 로컬 평가, per-node 배지 + 저장 버튼 제어. ✅ 구현됨.
3. **runtime** — 노드 핸들러 / 엔진의 graph 검증 단계에서 자기 노드 중심 평가. 본 컨벤션과 별개로, runtime 의 hand-coded 검증 (예: `PARALLEL_NESTED_DEPTH_EXCEEDED` throw) 과 메시지 의미 일관성을 보장.

## 6. SSOT 보장 (backend ↔ frontend) — shared package 채택 (옵션 A)

GraphWarningRule 의 `evaluate` 가 JS 함수라 frontend / backend 가 같은 함수 정의를 실행해야 평가 결과가 일치한다. **shared package `@workflow/graph-warning-rules`** (`codebase/packages/graph-warning-rules/`) 를 단일 진실로 채택했다:

- rule 정의(types · evaluate 유틸 · Parallel rule · `GRAPH_WARNING_RULES_BY_TYPE` 맵)가 패키지에 거주. backend·frontend 모두 `file:` 의존으로 import → **drift 0**.
- 패키지는 TypeORM/백엔드 비의존 **pure shape** (`GraphRuleNode {id,type,config,label}` / `GraphRuleEdge {source,sourceHandle,target,targetHandle}`) 로 정의. backend 는 Edge entity→shape thin adapter, frontend 는 store/canvas node·edge→shape 매핑으로 동일 함수 실행.
- (옵션 B) metadata API 가 rule 함수를 직렬화해 frontend 에서 eval 하는 안은 보안 우려로 비채택.

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

**왜 `evaluate` 반환에 `params` 를 추가했나** (2026-06-02) — rule 메시지가 `Parallel "${node.label}" ... > cap=${product}` 처럼 노드 라벨·수치를 런타임 보간한 **동적 문자열** 이라, 영문 문자열 전체를 키로 쓰는 기존 `WARNING_KO` 정적 매핑으로는 ko 번역이 불가능했다 (보간 결과가 매번 달라 키가 성립 안 됨). 영문 SoT 원칙([i18n-userguide Principle 3](./i18n-userguide.md))을 유지하면서 번역하려면 **표시 문자열과 보간 값을 분리**하는 것이 유일한 정합 경로다 — `message` 는 영문 SoT/fallback 으로 두고, 보간 값을 `params` 로 노출해 frontend 가 `ruleId` 별 로케일 템플릿에 끼워넣는다. backend `Accept-Language` 서버 localization 은 응답에 한국어를 박아 영문 SoT 원칙을 깨고 이중 사전 SoT 를 만들므로 기각. `params` 는 optional 이라 기존 정적 메시지 rule 과 하위호환되며, 정책·매핑 의무·자동 가드의 SoT 는 i18n-userguide Principle 3-C 에 위임한다.
