# Parallel P2 — 후속 작업 (parallel-p2.md 잔여)

> 작성일: 2026-05-30
> 분리 출처: `plan/complete/parallel-p2.md` — 본 plan 의 잔여 후속 항목을 별 plan 으로 분리 (parallel-p2 본체는 in-progress → complete 이동)

## 배경

`parallel-p2.md` 의 7개 PR (#363 / #364 / #366 / #367 / #368 / #369 / #370 + finalize PR) 로 핵심 동작은 모두 완료됨. 본 plan 은 그 위에 점진적으로 강화해야 할 항목을 모은다 — backend 외 영역 (frontend canvas, 추가 노드 signal 전파, 통합 테스트, ai-review) 이 주.

## 작업 단위

### 1. signal-aware 노드 확장 (node-cancellation-infrastructure.md §4~§6)

PR #369 가 HTTP 노드 1개의 fetch signal cascade 만 구현 — cancel-others-on-fail 의 효과가 노드별로 점진 강화되어야 함. 다음 노드의 `context.abortSignal` 전파:

- [x] Database 노드 — `execute()` 진입 직전 `context.abortSignal?.aborted` 사전 체크 + AbortError throw. driver 별 도중 cancel (pg/mysql2/mongo) 은 별 PR (driver wrapping 큰 작업)
- [x] AI Agent — `executeSingleTurn` 2곳 chat 호출 signal 전파 (PR #377). multi-turn 은 `ResumableMessageOptions` 인터페이스 확장 별 PR
- [x] Text Classifier + Information Extractor single-turn — `chat()` 호출에 `{ signal: context.abortSignal }` (PR #375)
- [ ] Information Extractor multi-turn (`runTurnWithCollectionRetries`) — params chain 에 signal 추가 별 PR
- [x] Send Email (SMTP) — `execute()` 진입 직전 사전 체크 (본 PR)
- [N/A] chat-channel 노드 — 노드 자체가 없음 (Trigger 메커니즘으로 통합)
- [x] 각 노드별 사전 체크 / 단위 테스트 (DB/Email 본 PR, HTTP/LLM 이전 PR 들)
- [ ] `NodeExecution.status='cancelled'` 추가 (엔티티 + migration) — 별 plan 권고

### 2. cross-node-warning-rules frontend canvas 통합

PR #368 가 backend 인프라 + `GET /workflows/:id/graph-warnings` endpoint 까지 — frontend 가 호출 + 배지 표시 + 저장 버튼 제어가 후속.

- [x] frontend canvas 가 graph 변경 시점 debounced (500ms) 으로 `workflowsApi.graphWarnings` 호출 — `workflow-editor.tsx` 의 `useEffect` 가 `workflowId/nodes/edges` 변경 감지
- [x] `editor-store` 의 `graphWarnings: { results, hasError, hasWarning }` state + `fetchGraphWarnings` action
- [x] severity 별 UI — 저장 버튼이 `graphWarnings.hasError` 시 disable + title 에 첫 error message (toolbar). 노드별 배지 (각 node 컴포넌트의 색 변경) 는 별 PR
- [x] SSOT — endpoint 호출만으로 처리 채택 (옵션 B). rule 정의는 backend 만, frontend 는 결과 표시 — shared package 추가 필요 없음
- [ ] e2e 테스트 — 3층 중첩 Parallel 워크플로우의 canvas → save → runtime 3중 reject 흐름 검증 — 별 PR

### 3. workflow save endpoint 자동 reject hook

현재 `GET /workflows/:id/graph-warnings` 는 frontend 가 명시적으로 호출 — 우회 시 reject 안 됨. Node/Edge save 시점에 자동 평가 + severity `error` reject 가 진정한 3중 가드의 backend 단.

- [x] `WorkflowsService.saveCanvas` (이미 transaction 안에서 nodes/edges sync 후 일괄 처리) 안에 `evaluateGraphWarnings(savedNodes, savedEdges)` 추가 — severity `error` 시 `BadRequestException { code: 'GRAPH_VALIDATION_FAILED', message, details: { errors } }` → transaction rollback
- [x] 일관성 보장 — `dataSource.transaction` 안에서 syncNodes → syncEdges → evaluate → throw 시 rollback. 별 endpoint 추가 없이 `POST /workflows/:id/save` 가 단일 진입점
- [x] 단위 테스트 — error rule 발화 시 GRAPH_VALIDATION_FAILED reject + warning rule 만 발화 시 저장 통과 (2건 신규)
- [ ] 통합 테스트 (e2e) — 실제 HTTP API 통해 3층 중첩 Parallel 워크플로우 저장 시도 시 400 reject 확인 — **후속** (parallel-p2-followups §4 와 함께)

### 4. parallel-p2 §5 통합 테스트

- [x] 별 spec 파일 신설 `codebase/backend/src/modules/execution-engine/__test__/parallel-p2-integration.spec.ts` — 기존 execution-engine.service.spec 의 무거운 mock 셋업 회피
- [x] cancel-others-on-fail × HTTP fetch signal cascade: 첫 분기 실패 시 다른 분기에 전달된 signal 이 abort → fetch 가 즉시 중단
- [x] cancel-others-on-fail vs errorPolicy=stop 비교 — stop 은 자기 그룹 controller 미생성으로 branchContext.abortSignal === undefined
- [x] nested concurrency cap silent clamp — parent=16 × intended=8 → actual=2 (32/16=2)
- [x] nested concurrency cap pass — parent=8 × intended=4 = 32 → no clamp
- [ ] e2e 통합 테스트 (실제 HTTP server + browser) — 별 PR (§3 의 backend save reject e2e 와 함께)

### 5. ai-review

- [ ] parallel-p2 + followups 의 누적 변경 (#363~#377 + 본 PR) 에 대한 `ai-review` skill 호출 — Concurrency / Performance / Security 중심. Critical / Warning 해소 + RESOLUTION.md. **본 PR 머지 후 별 turn 에서 실행 권고** (skill 호출이 다수 sub-agent + 리뷰 결과 review/ 산출)

## 수용 기준

- 최소 HTTP 외 1개 노드 (DB 또는 AI) 의 signal 전파
- frontend canvas 가 endpoint 응답으로 배지 표시
- 통합 테스트로 cancel-others-on-fail + 3층 중첩 reject 잠금
- ai-review Critical/Warning 0

### 6. GRAPH_VALIDATION_FAILED 사용자 문서 갱신 (ai-review SUMMARY#20)

- [ ] `backend-labels.ts` `ERROR_KO` 매핑 테이블이 신설되면 `GRAPH_VALIDATION_FAILED` 한국어 매핑 추가 (현재 영문 노출)
- [ ] user-guide MDX (`05-run-and-debug/` 또는 노드별 캔버스 안내 페이지) 에 graph validation 에러 응답 안내 추가
- [ ] `GET /workflows/:id/graph-warnings` 엔드포인트를 API 참조 가이드(user-guide 존재 시)에 반영

### 7. ExecutionContext God Object 해소 — ParallelBranchContext 분리 (ai-review SUMMARY#11 / C-1 결정)

> **선행**: `spec/conventions/execution-context.md` 신규 작성 (project-planner). 본 항목은 그 spec 확정 후 developer 가 별 PR 로 실행. 출처: `plan/in-progress/spec-fix-execution-context-god-object.md` (C-1 옵션 a 채택, 2026-05-30).
>
> ✅ **핵심 구현 완료 (2026-05-31, commit `ec0f56e1`)** — spec(`1a411542`) 확정 후 같은 worktree 에서 구현. 첫 developer 에이전트가 tsc 신규 에러 0 + jest 575 통과로 검증. ai-review (review/code/2026/05/31/20_55_42/) **Critical 0 / Warning 2** (아래 잔여).

- [x] `parentParallelConcurrency` 를 `ExecutionContext` 에서 제거하고 `ParallelBranchContext extends ExecutionContext` 로 이동 (`node-handler.interface.ts` / `parallel-executor.ts`)
- [x] branchContext 생성처 + 하위 노드 호출처 타입 좁히기 — `execute()` 4번째 인자 `parentParallelConcurrency?` 로 운반, `runBranch`/branchContext 타입을 `ParallelBranchContext` 로 좁힘. engine 호출부는 `'parentParallelConcurrency' in context` narrowing 으로 추출 전달
- [x] 단위 테스트 `parallel-p2-integration.spec.ts` + `parallel-executor.spec.ts` 의 nested concurrency cap silent clamp / pass 케이스 시그니처 수정 — jest parallel suites 21/21, execution-engine 554/554 pass
- [ ] e2e 통합 테스트 회귀 확인 — 실 HTTP server + browser e2e 는 §4 "e2e 통합 테스트" 와 함께 별 PR (본 변경은 런타임 동작 불변·타입 리팩토링이라 단위/통합 그린으로 회귀 잠금)
- [x] `spec/4-nodes/1-logic/10-parallel.md §Rationale 결정 G` 갱신 — spec commit `1a411542`, 코드 commit `ec0f56e1`

#### ai-review 잔여 Warning (2건, LOW — 별 PR 권고)

> 2026-05-31 ai-review 5-reviewer fan-out (architecture/concurrency/side-effect/scope/maintainability) 결과 Critical 0. 아래 2건은 **동일 근원 LOW-risk** 로, 본 작업 worktree 의 환경 제약(worktree 에 node_modules 부재 → tsc/jest 미실행, sub-agent 의 worktree write 차단, tool 출력 채널 불안정)으로 **검증된 적용이 이번 턴 불가** → 별 PR 로 분리. 둘 다 즉각 버그 아님 (프로덕션 호출처 1곳이 이미 올바르게 전달).

- [ ] **W-1 (side-effect/concurrency/maintainability)**: `ParallelExecutor.execute()` 4번째 인자 `parentParallelConcurrency?: number` 를 `number | undefined` (required) 로 강제 → 미래 호출처 누락 시 nested concurrency silent clamp 누락을 컴파일 타임 차단. 단위 테스트 `.execute()` 3-인자 호출 ~30곳에 명시 `undefined` 추가 필요 (tsc 로 누락 검출). **검증(tsc+jest) 의무.**
- [ ] **W-2 (side-effect/architecture)**: `execution-engine.service.ts` `branchParentContext: ExecutionContext` 의 명시 타입 제거(추론 위임) → `ParallelBranchContext` ghost field 은닉 해소. (참고: architecture/maintainability 가 INFO 로 `isParallelBranchContext` type guard 추출도 제안했으나 narrowing 사이트 1곳이라 보류 권고.)

## 의존성·리스크

- DB driver / SDK 의 signal 지원 부재 가능성 — best-effort 컨벤션 (spec/conventions/node-cancellation.md) 으로 명시. driver 별 cancel 메커니즘 조사 필요
- frontend canvas 평가의 성능 — 모든 graph 변경마다 endpoint 호출. debounce + 캐싱 필요할 수 있음
- 멀티턴 AI Agent 의 conversation state 보존과 abort 정합 — 진행 중 turn 만 abort, state 손상 없음 보장 필요
