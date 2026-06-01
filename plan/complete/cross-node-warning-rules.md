# Cross-Node WarningRule 인프라 + Workflow Save Validate 확장

> 작성일: 2026-05-30
> 분리 출처: [`parallel-p2.md`](./parallel-p2.md) 결정 I (cross-node warningRule 인프라를 별 plan 으로 분리)
> 후속 plan: `parallel-p2.md` §6 (Parallel `nested-depth-exceeded` / `nested-concurrency-cap` rule 등재)

## 배경

`parallel-p2.md` 의 결정 D (concurrency clamp 의 frontend canvas 사전 경고) + E (중첩 깊이 검증의 3중 가드 = 저장 시점 reject + canvas 사전 경고 + runtime reject) 는 부모-자식 노드 cross 평가 인프라를 요구한다.

현재 [`NodeComponentMetadata.warningRules`](../../codebase/backend/src/nodes/core/node-component.interface.ts) 의 mini-DSL 은 **단일 노드의 config 만 평가** — `branchCount < 2 || branchCount > 16` 같은 단일 노드 식만 표현 가능. 부모-자식 cross 평가 (외부 Parallel 의 maxConcurrency × 내부 Parallel 의 maxConcurrency > 32 / Parallel 노드의 분기 서브그래프 안에 또 Parallel 이 있는지) 는 미지원.

본 인프라는 Parallel 외에도 다음 향후 노드 검증에 재사용된다:
- Loop / ForEach 의 중첩 깊이 정책 (향후 도입 시)
- Map / Filter 의 부모 컨테이너 contextual 검증
- 그 외 노드 시스템의 graph-level 검증

## 관련 문서

- [`codebase/backend/src/nodes/core/node-component.interface.ts`](../../codebase/backend/src/nodes/core/node-component.interface.ts) — `NodeComponentMetadata` / `warningRules` mini-DSL
- frontend canvas warningRule 평가 진입점 (위치 확인 필요 — `codebase/frontend/src/components/editor/canvas/` 또는 `nodes/` 하위)
- [`codebase/backend/src/modules/workflows/`](../../codebase/backend/src/modules/workflows/) — workflow save endpoint (`WorkflowsService.create/update`) 의 validate 진입점
- [`spec/conventions/`](../../spec/conventions/) — convention 문서 위치

## 작업 단위

### 1. 메커니즘 설계 — graphWarningRules 신규 키

> 본 plan 작성 시 가정: 별도 `graphWarningRules` 신규 키 (graph 전체를 보고 평가하는 함수형 rule). 기존 mini-DSL 의 단일 노드 평가는 그대로 유지하고, cross-node 평가는 함수로 분리. **메커니즘 자체는 본 plan 첫 PR 에서 PoC 후 확정.**

- [x] 옵션 비교 — **옵션 2 채택** (`graphWarningRules: GraphWarningRule[]` 신규 키, 함수형 rule). 근거: 표현력 + 향후 다른 cross-node 정책 (Loop / ForEach 중첩 등) 의 확장성 + mini-DSL 평가 엔진 확장 비용 회피. spec convention §Rationale 에 기록.
- [x] 타입 정의 — `codebase/backend/src/nodes/core/graph-warning-rule.ts` 신설:
  - `GraphWarningRule { id, severity: 'error' \| 'warning', evaluate: (node, graph) => { message } \| null }`
  - `GraphWarningRuleResult { ruleId, severity, nodeId, message }`
  - `evaluateGraphWarningRules(node, graph, rules)` / `evaluateGraphWarningRulesForGraph(graph, resolver)` 유틸
- [x] `NodeComponentMetadata` 에 `graphWarningRules?: readonly GraphWarningRule[]` 추가 + JSDoc

### 2. backend metadata 확장

- [x] `NodeComponentMetadata` 인터페이스 확장 (§1 과 동시 작업)
- [x] Parallel rule 등재 (`parallel.schema.ts`) — `parallel:nested-depth-exceeded` (error) + `parallel:nested-concurrency-cap` (warning)
- [x] rule 직렬화 문제 해소 — frontend 직렬화 대신 **shared package `@workflow/graph-warning-rules`** 로 rule 정의를 이동(아래 §4 SSOT). frontend 가 같은 함수를 로컬 실행하므로 metadata 직렬화 불요.

### 3. backend workflow save endpoint 의 validate 확장 — ✅ 완료

- [x] 저장 endpoint = `WorkflowsService.saveCanvas` (`PATCH /workflows/:id/canvas`). graph 저장(syncNodes/syncEdges) 과 동일 트랜잭션.
- [x] 저장 시점 validate — `saveCanvas` 가 `evaluateGraphWarnings(savedNodes, savedEdges)` 호출, severity `error` 시 `BadRequestException(GRAPH_VALIDATION_FAILED)` → 트랜잭션 rollback (저장 차단). frontend 우회·옛 워크플로 마이그레이션 안전망.
- [x] 단위/통합 테스트 — workflows.service.spec 가 3층 중첩 Parallel reject 커버.

### 4. frontend canvas 평가 인프라

> **완료 (2026-05-31, cross-node PR)**: 평가를 **로컬화** + per-node 배지 구현. 더 이상 `GET /graph-warnings` 엔드포인트 round-trip 에 의존하지 않는다 (canvas 는 shared package 로 로컬 즉시 평가; 백엔드 save-validate 는 §3 으로 별도 enforce — 3중 가드).

- [x] frontend canvas 가 graph 변경 시점 마다 `evaluateGraphWarningsLocal` 로 **로컬 평가** (config 변경 포함, 500ms debounce). `@workflow/graph-warning-rules` 의 `evaluateGraphWarningRulesForGraph` + `GRAPH_WARNING_RULES_BY_TYPE` 사용.
- [x] severity 별 UI 표현 — `custom-node.tsx` 가 `graphWarnings.results` 를 nodeId 로 필터해 **per-node 배지** 렌더 (error=빨강 배지+ring, warning=노랑, error 우선) + Tooltip 메시지. 저장버튼 disable(error)은 기존대로.
- [x] backend↔frontend SSOT — **shared package 채택** (사용자 결정). `codebase/packages/graph-warning-rules` (`@workflow/graph-warning-rules`) 에 types/evaluate/Parallel rule 이동. backend 는 thin adapter(Edge entity→pure shape 매핑)로, frontend 는 store node/edge→pure shape 매핑으로 **동일 함수** 실행 → drift 0.

### 5. spec / convention 문서

- [x] 신규 [`spec/conventions/cross-node-warning-rules.md`](../../spec/conventions/cross-node-warning-rules.md) 작성 — 컨트랙트, severity 정책 (error/warning), 두 메커니즘 (mini-DSL warningRules vs graphWarningRules) 의 분기, 3중 가드 (save + canvas + runtime), SSOT 보장 옵션 (shared package vs metadata serialization), 평가 유틸, 현재 등재 sample, § Rationale (왜 함수형 채택)

### 6. 통합 시나리오 — ✅ 인프라 잠금 완료 (전 계층 e2e 는 후속 plan 소유)

3중 가드는 각 계층 테스트로 이미 잠겨 있다:
- [x] frontend 빨간 배지 + 저장 버튼 disabled — `custom-node-graph-warning.test.tsx` (배지) + `editor-toolbar-rbac.test.tsx` (`graphWarnings.hasError=true` 시 Save disable)
- [x] backend save endpoint reject (UI 우회 케이스) — `workflows.service.spec.ts` (`GRAPH_VALIDATION_FAILED`) + 실 HTTP e2e `test/graph-warning-save.e2e-spec.ts` 케이스 A (3층 중첩 Parallel → 400) / B (2층 → 200) / C (단일 → 200)
- [x] runtime planParallelBody reject (저장 후 마이그레이션 케이스) — depth rule 자체는 shared package `graph-warning-rules/__tests__/parallel.spec.ts` + backend core `graph-warning-rule.spec.ts` (3층 중첩 → `parallel:nested-depth-exceeded`) 로 잠김. 실행 엔진은 `planParallelBody` 가 `currentDepth >= 2` 에서 `PARALLEL_NESTED_DEPTH_EXCEEDED` throw (구현 완료).

> **종결 결정 (2026-06-02, 사용자 승인)**: 본 plan 의 cross-node warningRule **인프라**(타입·shared package·save-validate·canvas 평가·convention)는 100% 완료. 남은 단 한 조각인 **3중 가드를 한 흐름으로 묶는 browser+HTTP 통합 e2e** (canvas 배지 → save 400 → runtime reject 를 실 server + browser 로 한 시나리오에 검증)는 본 plan 의 인프라 scope 밖이며, 이미 [`parallel-p2-followups.md`](./parallel-p2-followups.md) §2~4 ("e2e — 3층 중첩 Parallel 워크플로우의 canvas 배지 → save 400 reject → runtime reject 3중 가드 흐름") 가 소유·추적 중이다. 중복 추적을 피하기 위해 본 plan 에서는 닫고 그 plan 으로 위임.

## 수용 기준

- `NodeComponentMetadata.graphWarningRules?` 신규 키 정의 + 타입 명확
- backend workflow save endpoint 가 graphWarningRules 평가 → severity 'error' reject
- frontend canvas 가 graph 변경 시점에 평가 + severity 별 배지
- backend/frontend SSOT 보장 (shared package 또는 동등 메커니즘)
- cross-node warningRule convention spec 작성
- 단위/통합/e2e 테스트가 메커니즘 잠금 — 각 가드 계층별 테스트 완료 (§6). 3중 가드를 한 흐름으로 묶는 browser+HTTP 통합 e2e 는 `parallel-p2-followups.md` §2~4 소유
- 본 plan 완료 후 [`parallel-p2.md`](./parallel-p2.md) §6 가 진행 가능 상태

## 의존성·리스크

- **의존**: 없음. 인프라 작업
- **리스크**:
  - backend/frontend SSOT 보장 — rule 정의가 두 코드베이스에 중복되면 drift. shared package 가 정답
  - frontend canvas 평가의 성능 — 모든 graph 변경마다 N 노드 × M rule 평가. 워크플로우가 커지면 비용 ↑ — debounce / memoization 필요할 수 있음
  - 신규 메커니즘 (graphWarningRules) vs 기존 mini-DSL 의 사용처 혼동 — handler 작성자 가이드 필수

## 향후 활용 (본 plan scope 밖)

- Loop / ForEach 의 중첩 깊이 정책 (향후 도입 시)
- Map / Filter 의 부모 컨테이너 contextual 검증
- 그 외 노드 시스템의 graph-level 검증 (cyclic / unreachable 등 — 현재 graph 검증과 합칠지 분리할지)
