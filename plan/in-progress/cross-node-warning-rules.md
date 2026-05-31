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
- [ ] handler registry / metadata 노출 API 가 `graphWarningRules` 를 frontend 로 직렬화 가능한 형태로 노출 — **후속 PR** (frontend canvas 작업과 함께)

### 3. backend workflow save endpoint 의 validate 확장

> **후속 PR 로 분리**. 본 PR 은 type + util + Parallel rule 등재 + spec convention 만. workflow nodes/edges 저장 endpoint 위치 조사 (WorkflowsService.update 는 metadata 만 다룸 — graph 저장은 별 service / controller) + validate 통합 후속.

- [ ] workflow nodes/edges 저장 endpoint 위치 조사 (WorkflowsService 외 nodes/edges 별 service)
- [ ] 저장 시점 validate 에서 `evaluateGraphWarningRulesForGraph` 호출 + severity `error` 시 400 reject
- [ ] 단위 테스트 — 3층 중첩 Parallel graph 가 저장 reject
- [ ] 통합 테스트 — POST/PUT 워크플로우 API 적절한 400 응답

### 4. frontend canvas 평가 인프라

> **현재 구현 상태 (2026-05-31, `/goal` coverage 감사 ground-truth)**: graph-warning 평가 + "저장 불가" 상태(저장 버튼 disable + tooltip) 는 구현됨 — `workflow-editor.tsx` / `editor-store.ts` / `editor-toolbar.tsx` / `lib/api/workflows.ts`. **잔여 갭 = per-node 색상 배지 미렌더** (coverage-gaps 감사의 A3). 즉 사용자는 저장 버튼 tooltip 으로만 경고를 보고, 어느 노드가 문제인지 노드 위 배지로는 아직 못 본다.

- [x] frontend canvas 가 graph 변경 시점 (노드 추가/삭제/edge 변경/config 변경) 마다 `graphWarningRules` 평가 호출
- [ ] severity 별 UI 표현 (**A3 잔여 갭 — per-node 배지 미구현**):
  - `error`: 워크플로우 "저장 불가" 상태 [x] / 노드에 빨간 배지 [ ]
  - `warning`: 저장은 가능 [x] / 노드에 노란 배지 [ ]
- [ ] backend 와의 SSOT 보장:
  - 함수형 rule 의 정의가 backend 와 frontend 에서 동일 실행되어야 함
  - 옵션: rule 정의를 shared package (`codebase/packages/`) 로 분리, 또는 metadata API 가 rule 함수를 직렬화/eval (보안 우려)
  - **권고**: shared package 로 rule 정의 이동 — backend metadata 가 그 package 의 함수 reference 만 import

### 5. spec / convention 문서

- [x] 신규 [`spec/conventions/cross-node-warning-rules.md`](../../spec/conventions/cross-node-warning-rules.md) 작성 — 컨트랙트, severity 정책 (error/warning), 두 메커니즘 (mini-DSL warningRules vs graphWarningRules) 의 분기, 3중 가드 (save + canvas + runtime), SSOT 보장 옵션 (shared package vs metadata serialization), 평가 유틸, 현재 등재 sample, § Rationale (왜 함수형 채택)

### 6. 통합 시나리오

- [ ] e2e 테스트 — 3층 중첩 Parallel 같은 잘못된 graph 가:
  - frontend 에서 빨간 배지 + 저장 버튼 disabled
  - backend save endpoint 가 reject (UI 우회 케이스)
  - runtime planParallelBody 가 reject (저장 후 마이그레이션 케이스)

## 수용 기준

- `NodeComponentMetadata.graphWarningRules?` 신규 키 정의 + 타입 명확
- backend workflow save endpoint 가 graphWarningRules 평가 → severity 'error' reject
- frontend canvas 가 graph 변경 시점에 평가 + severity 별 배지
- backend/frontend SSOT 보장 (shared package 또는 동등 메커니즘)
- cross-node warningRule convention spec 작성
- 단위/통합/e2e 테스트가 메커니즘 잠금
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
