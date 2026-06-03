---
started: 2026-05-31
owner: developer
worktree: continuation-worker-concurrency-env
branch: worktree-continuation-worker-concurrency-env
status: in-progress
---

# continuation resume — optional follow-ups

continuation worker deadlock 해소 작업(완료: PR #399 → #402 → #403)에서 분리된
**optional / 조건부** 후속 항목. 커밋된 약속이 아니라 "필요 시 검토" 수준이며,
관련 완료 plan 3종(fix-continuation-worker-deadlock / fix-resume-worker-full-detach /
fix-cancel-running-stuck)을 삭제하면서 잔여 아이디어를 한 곳에 보존한 것이다.

## 항목

- [x] **continuation worker concurrency env 설정화**. `@Processor` 데코레이터에
  `CONTINUATION_WORKER_CONCURRENCY` (기본 1) 로 동시성 주입. 기본 직렬은 유지하되
  운영에서 setup 직렬화 latency 관측 시 env 만으로 상향 가능.
  - 구현: `resolveContinuationWorkerConcurrency()` (continuation-execution.queue.ts,
    DLQ config 의 정규식 선검증 파서 규약 일치) + processor 데코레이터 주입.
  - 등록: spec §7.4 "Worker 동시성" 행 + §11 config 표 + `.env.example`.
  - 테스트: continuation-execution.queue.spec.ts (양수/미설정/빈값/비숫자·0·음수·
    소수·공학표기 fallback/trim).
- [ ] **멀티 인스턴스 double-drive optimistic lock** (pre-existing). detached resume
  드라이브가 다른 인스턴스에서 중복 구동될 수 있는 (fast-path 와 동일한) 기존 윈도우.
  `NodeExecution.status` 멱등 가드가 결과 중복은 막지만, optimistic lock 강화로
  in-memory 코루틴 누수까지 차단 검토.

## 비고
- 위 둘 다 운영 영향이 관측되기 전에는 착수 불필요 (deadlock 자체는 #399~#403 으로 해소).
- 착수 시 본 plan 을 worktree 로 승격(frontmatter `worktree`/`branch`/`status: in-progress`).
