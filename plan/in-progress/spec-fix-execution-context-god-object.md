---
worktree: parallel-p2-ai-review-0296c4
started: 2026-05-30
owner: project-planner
---
# Spec Fix Draft — ExecutionContext God Object 방지 설계 원칙

> **상태**: consistency-check `BLOCK: YES` (review/consistency/2026/05/30/20_06_06/SUMMARY.md). C-1/C-2/C-3/W-1~W-7 **모두 해소**.
>
> **C-1 사용자 결정 (2026-05-30)**: **옵션 (a) 결정 G 번복 채택** — `parentParallelConcurrency` 를 `ParallelBranchContext` 로 분리. `spec/4-nodes/1-logic/10-parallel.md §Rationale 결정 G` 갱신 + code 변경 별 PR (parallel-p2-followups.md 후속 표 등재).

## 원본 발견사항
SUMMARY#11 (review/code/2026/05/30/19_19_43/): `ExecutionContext` 에 `parentParallelConcurrency`, `abortSignal` 등 기능별 필드가 반복 추가 — God Object 위험 중기 누적 (`node-handler.interface.ts`). `ParallelBranchContext` 분리 또는 `ExecutionOptions` 추출 방향을 spec/conventions 에 설계 원칙으로 명시 필요.

## 검토 범위 명시 (W-1 / W-4 해소)

본 draft 의 "현재 상태" 코드 블록은 **본 설계 원칙이 직접 영향을 미치는 신규/논의 대상 필드만 발췌**. 실제 `ExecutionContext` 는 다수 필드 (`workflowId`, `executionId`, `nodeExecutionId`, `variables`, `nodeOutputCache`, `rawConfig`, `conversationThread`, `recursionDepth`, `itemContext`, `loopContext`, `expressionContext` 등) 를 가지며 SoT 는 `codebase/backend/src/nodes/core/node-handler.interface.ts` + `spec/5-system/4-execution-engine.md §5.5 / §6.1`. 본 draft 는 그 전체를 재정의하지 않는다.

## 제안 변경

`spec/conventions/execution-context.md` 신규 작성:

### 설계 원칙
1. **Stable core**: `ExecutionContext` 는 모든 노드 공통으로 필요한 최소 필드만 유지.
   - 식별: `workflowId`, `executionId`, `nodeExecutionId`
   - 실행 표준: `variables`, `nodeOutputCache`, `rawConfig`, `recursionDepth`
   - cross-cutting cancellation: `abortSignal?` — **optional, best-effort 컨벤션** (전 노드 필수 아님). 동작 계약 SoT 는 [`spec/conventions/node-cancellation.md`](../../spec/conventions/node-cancellation.md) §2 에 위임. 본 문서는 필드 목록 SoT.
2. **Container-specific fields**: 특정 컨테이너에서만 의미 있는 필드는 별도 인터페이스로 확장:
   ```typescript
   interface ParallelBranchContext extends ExecutionContext {
     parentParallelConcurrency: number;
   }
   ```
   ✅ **C-1 결정 (2026-05-30 옵션 a 채택)**: `parentParallelConcurrency` 는 본 원칙에 따라 `ParallelBranchContext` 로 분리. `spec/4-nodes/1-logic/10-parallel.md §Rationale 결정 G` 의 "ExecutionContext 안 추가" 결정을 번복하고 Rationale 갱신.
3. **No runtime optional sprawl**: **새 cross-cutting 기능 추가 시** `ExecutionContext` 에 optional field 직접 추가 금지. 기존 cross-cutting 필드 (`abortSignal`, `rawConfig`, `recursionDepth` 등) 는 각자 Rationale 보유 — **소급 적용 대상 아님**. container-specific 필드 (예: `parentParallelConcurrency`, 향후 Loop 전용 등) 는 §원칙 2 에 따라 별 인터페이스로 분리.
   - 전체 노드 공통 → `ExecutionContext` 에 추가 + `node-handler.interface.ts` 업데이트 + 본 문서에 Rationale 기록
   - 특정 컨테이너/기능 한정 → `ContainerXBranchContext extends ExecutionContext` 확장

### 현재 상태 — 본 draft 의 분석 범위 발췌 (2026-05-30)

```typescript
// 주요 필드 발췌 — 전체 정의는 codebase/backend/src/nodes/core/node-handler.interface.ts
// 본 draft 의 설계 원칙이 직접 영향을 미치는 필드만 표시.
interface ExecutionContext {
  // ... (식별 / 실행 표준 필드 생략)
  abortSignal?: AbortSignal;              // optional — node-cancellation 컨벤션 (§2 SoT 위임)
  parentParallelConcurrency?: number;     // ← C-1 (a) 채택 후 제거 대상 — ParallelBranchContext 로 이동
}

// 신규 (C-1 (a) 채택 결과)
interface ParallelBranchContext extends ExecutionContext {
  parentParallelConcurrency: number;     // required — Parallel 컨테이너 내부에서만 의미
}
```

### 후속 작업

#### spec 작업 (project-planner 책임)
- [ ] `spec/conventions/execution-context.md` 신규 작성 — frontmatter 의무 항목 포함:
  - `id: execution-context`
  - `status: spec-only`
  - `code: []` (codebase 식별자 직접 참조 없음)
  - `pending_plans: []` (또는 본 draft 로 partial 처리)
- [ ] 본 spec 의 `## Rationale` 섹션 작성 — "왜 ParallelBranchContext 분리인가" / "abortSignal 을 Stable core 에 둔 이유" / "No runtime optional sprawl 의 적용 범위" 의 trade-off 설명. C-1 결정 결과 (옵션 a) 반영.
- [ ] `spec/4-nodes/1-logic/10-parallel.md §Rationale 결정 G` **번복 근거 갱신** — 2026-05-30 ai-review SUMMARY#11 의 God Object 우려 + consistency-check C-1 결과로 ParallelBranchContext 분리 채택. 본 신규 convention 참조.
- [ ] `spec/conventions/node-cancellation.md` 의 상호참조 추가 — `abortSignal` 의 필드 정의는 `execution-context.md`, 동작 계약은 `node-cancellation.md` SoT 분리 명시.
- [ ] spec 목차 (예: `spec/4-nodes/0-overview.md` 또는 conventions 인덱스) 에 신규 convention 링크 추가.

#### code 작업 (developer 책임, 본 spec 확정 후 별 PR)
- [ ] `parentParallelConcurrency` → `ParallelBranchContext` 로 이동 (`parallel-executor.ts` 타입 수정 + branchContext 생성처 + 호출처)
- [ ] 단위테스트 수정 (parallel-p2-integration.spec.ts 의 nested concurrency cap 케이스)
- [ ] e2e/통합 테스트 회귀 검증
- [ ] **owning plan**: `plan/in-progress/parallel-p2-followups.md` 의 후속 표에 본 항목 추가 — 추적 단절 방지 (W-7 해소)

## 위임 이유
spec/conventions 문서 작성은 `project-planner` 책임 영역 (CLAUDE.md §Skill 체계). 본 draft 는 위임 지시서 — project-planner 인수 후 새 worktree 에서 별 PR 로 spec 작성. 코드 변경은 spec 문서 확정 후 `developer` 가 후속 PR 에서 수행 (`parallel-p2-followups.md` 에 owning plan 등재).

## consistency-check 처리 (2026-05-30 20:06)

| Critical | 처리 |
|----------|------|
| C-1 (Rationale Continuity — 결정 G 번복) | **해소 (옵션 a 채택, 2026-05-30 user)** — §원칙 2 ✅ callout + 후속 작업의 결정 G 번복 근거 갱신 항목 |
| C-2 (Convention — plan 파일 미존재 추정) | 비이슈 — 파일 실재 확인 |
| C-3 (Convention — 신규 spec frontmatter 요건) | 해소 — `## 후속 작업` 의 spec 작업 첫 항목 |

| Warning | 처리 |
|---------|------|
| W-1 / W-4 (Cross-Spec — 발췌 범위) | 해소 — `## 검토 범위 명시` 섹션 |
| W-2 (`abortSignal` optional / SoT 위임) | 해소 — §원칙 1 의 abortSignal 항목 |
| W-3 ("No runtime optional sprawl" 소급 범위) | 해소 — §원칙 3 의 "신규 필드 한정" + 기존 필드 예외 |
| W-5 (`owner: resolution-applier`) | 해소 — `owner: project-planner` |
| W-6 (신규 spec Rationale 부재) | 해소 — `## 후속 작업` 의 Rationale 항목 |
| W-7 (owning plan 부재) | 해소 — `## 후속 작업` code 작업의 owning plan 명시 |
