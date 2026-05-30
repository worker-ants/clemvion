---
worktree: parallel-p2-ai-review-0296c4
started: 2026-05-30
owner: resolution-applier
---
# Spec Fix Draft — ExecutionContext God Object 방지 설계 원칙

## 원본 발견사항
SUMMARY#11: `ExecutionContext` 에 `parentParallelConcurrency`, `abortSignal` 등 기능별 필드가 반복 추가 — God Object 위험 중기 누적 (`node-handler.interface.ts`). `ParallelBranchContext` 분리 또는 `ExecutionOptions` 추출 방향을 spec/conventions 에 설계 원칙으로 명시 필요.

## 제안 변경

`spec/conventions/execution-context.md` 신규 작성 (또는 기존 `node-cancellation.md` 에 §추가):

### 설계 원칙
1. **Stable core**: `ExecutionContext` 는 모든 노드 공통으로 필요한 최소 필드만 유지:
   - `workflowId`, `executionId`, `nodeExecutionId`
   - `abortSignal` (node-cancellation 컨벤션 이미 명시)
2. **Container-specific fields**: `parentParallelConcurrency` 처럼 특정 컨테이너에서만 의미 있는 필드는 별도 인터페이스로 확장:
   ```typescript
   interface ParallelBranchContext extends ExecutionContext {
     parentParallelConcurrency: number;
   }
   ```
3. **No runtime optional sprawl**: 새 cross-cutting 기능 추가 시 `ExecutionContext` 에 optional field 직접 추가 금지. 대신:
   - 전체 노드 적용 → `ExecutionContext` 에 추가 + `node-handler.interface.ts` 업데이트 + 이 문서에 Rationale 기록
   - 특정 컨테이너/기능 한정 → 별도 인터페이스 확장

### 현재 상태 (2026-05-30)
```typescript
interface ExecutionContext {
  workflowId: string;
  executionId: string;
  nodeExecutionId: string;
  abortSignal?: AbortSignal;              // node-cancellation 컨벤션
  parentParallelConcurrency?: number;    // ParallelExecutor 전용 → 분리 대상
}
```

### 후속 작업
- [ ] `parentParallelConcurrency` → `ParallelBranchContext` 로 이동 (parallel-executor.ts 타입 수정)
- [ ] `spec/conventions/execution-context.md` 신규 작성
- [ ] `spec/conventions/node-cancellation.md` 과 상호참조 추가

## 위임 이유
spec/conventions 문서 작성은 `project-planner` 책임 영역 (CLAUDE.md §Skill 체계).
코드 변경은 spec 문서 확정 후 `developer` 가 후속 PR 에서 수행.
