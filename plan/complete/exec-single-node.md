---
worktree: exec-single-node
started: 2026-06-15
owner: developer
spec_impact:
  - spec/3-workflow-editor/3-execution.md
  - spec/5-system/13-replay-rerun.md
  - spec/1-data-model.md
---

# execution §1.3 단일 노드 실행 (single-node execution)

> 출처: gap-closure 잔여 슬라이스 ① (project_gap_closure_residual_decisions). spec §1.3 을 "계획·미구현" → v1 승격.
> 관련 plan: plan/in-progress/spec-sync-execution-gaps.md §1.3 (완료 시 [x]).

## 결정 (확정 — 사용자)
- 입력 = **직전 실행(previousExecutionId)의 상류(predecessor) NodeExecution.output_data 를 nodeOutputCache 에 pre-seed** → gatherNodeInput 자동 사용. previousExecutionId 미전달 시 수동 입력(body.input)으로 대체(override).
- **단일 노드만 실행, downstream 미진행** (§1.3 "해당 노드만"). §1.2 Run-from-Selected(downstream 진행)와 구분.
- 전용 엔드포인트 신설 + spec 본문 v1 승격. 결과는 기존 `GET /api/executions/:id` 로 조회.

## impl-prep 검토 반영 (review/consistency/2026/06/15/13_59_42 — Critical 0 blocking; convention CRITICAL 2건은 아래 설계 교정으로 해소)
- **엔드포인트 경로 교정**: `execute-node`(동사+명사) 는 api-convention §2.2 위반 → **`POST /api/workflows/:id/nodes/:nodeId/execute`** (node sub-resource 의 단일 동사 action — `/execute`·`/stop` 선례). body `{ previousExecutionId? }` (nodeId 는 path).
- **컬럼명 유지**: `single_node_id` — `_node_id` 접미사가 Node FK 도메인 표기, `single_` 한정자는 §1.2 `fromNodeId`(컬럼 아님, inputData)와 구분 + Execution 테이블 mode-encoding 컬럼(`dry_run`·`re_run_of`) 선례. 마이그레이션 주석에 근거 기재.
- **추가 spec 동기화**: 4-execution-engine §11 (Graceful Shutdown gate 에 신규 엔드포인트 추가 + 엔드포인트에 shutdown gate 구현) + §6.1 (ExecuteOptions 타입 블록 갱신).
- **§15 C3 문구**: "구현됨" 단순 표기 대신 — 표현식 컨텍스트는 predecessor 출력 pre-seed(mock 아님)로 충족, 단일 노드 테스트(§1.3)는 Re-run C3 와 별개 진입점임을 명시.
- **dry_run 상호작용**: 단일 노드 실행은 `dry_run=false` 고정(직교 진입점, v1 조합 미지원) — data-model §2.13 1행 명시.
- **인덱스**: `single_node_id` 조회 패턴 없음(디버그 전용) → 인덱스 미추가, data-model 에 근거 1행.

## 구현 체크리스트

### Backend
- [x] Execution entity: `single_node_id uuid null` + `previous_execution_id uuid null` 컬럼 (dryRun/sourceIp 선례 — 큐 재조회로 runExecution 에 전달).
- [x] 마이그레이션 V098 (nullable, 회귀 없음).
- [x] `ExecuteOptions` executedBy variant 에 `singleNodeId?` / `previousExecutionId?` 추가.
- [x] `execute()`: 두 필드 영속.
- [x] `runExecution()` single-node 분기:
  - seed reachable = `[singleNodeId]` (seedInitialReachability explicitEntryIds).
  - predecessor 출력 pre-seed: 신규 repo 헬퍼로 previousExecutionId 의 predecessor NodeExecution.output_data 조회 → `contextService.setNodeOutput` (structuredOutputCache 동기화 — 표현식 resolve) + `executedNodes.add`.
  - 대상 노드 실행 직후 `break` (propagate/back-edge/container body/parallel branch 미진행).
  - 완료 outputData = `nodeOutputCache[singleNodeId]` (topological-last 아님).
- [x] 신규 private 헬퍼 `getLatestPredecessorOutputs(executionId, nodeIds)` (nodeExecutionRepository, status=completed, In()).
- [x] Controller: `POST /api/workflows/:id/nodes/:nodeId/execute` body `{ previousExecutionId? }`. node 가 workflow 소속인지 + previousExecutionId 가 workflow 소속인지 검증(아니면 400/404). `@Roles('editor')` + `@ApiForbiddenResponse`. 503 shutdown gate. 202 + `ApiAcceptedWrappedResponse(ExecuteAcceptedDto)`.
- [x] DTO (`ExecuteNodeDto` body) + swagger (`@ApiParam format:uuid` ×2).

### Frontend
- [x] workflow-canvas.tsx 노드 우클릭 메뉴 "이 노드 실행".
- [x] node-settings-panel InfoTab 단일 노드 결과 표시.
- [x] API client + i18n ko/en.

### Spec 동기화
- [x] 3-execution.md §1.3 v1 승격(미구현 마커 제거 + 메커니즘 기술) + §9 API 행 + Rationale.
- [x] replay-rerun §15 C3 재조정 (predecessor 출력 pre-seed = 표현식 컨텍스트, §1.3 별개 진입점 명시).
- [x] 1-data-model §2.13 Execution 컬럼 2종 (+ dry_run 직교·인덱스 미추가 근거).
- [x] 4-execution-engine §11 Graceful Shutdown gate 신규 엔드포인트 추가 + §6.1 ExecuteOptions 타입 블록.

### 게이트
- [x] consistency-check --impl-prep (Critical 0)
- [x] TEST WORKFLOW — lint✅ unit✅(backend 6983·frontend 206·web-chat 16) build✅ e2e✅(202)
- [x] /ai-review (15_05_56) Critical 0 / Warning 18
- [x] resolution(15_05_56 RESOLUTION) + fresh review(15_29_28 Critical 0, Warning 2 비-defect accept 수렴)
- [x] consistency-check --impl-done (15_36_35 BLOCK NO)
- [x] spec-sync-execution-gaps.md §1.3 [x]
- [x] push + PR (#614 merged)
