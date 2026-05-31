---
worktree: null
branch: null
status: backlog
---

# continuation resume — optional follow-ups

continuation worker deadlock 해소 작업(완료: PR #399 → #402 → #403)에서 분리된
**optional / 조건부** 후속 항목. 커밋된 약속이 아니라 "필요 시 검토" 수준이며,
관련 완료 plan 3종(fix-continuation-worker-deadlock / fix-resume-worker-full-detach /
fix-cancel-running-stuck)을 삭제하면서 잔여 아이디어를 한 곳에 보존한 것이다.

## 항목

- [ ] **continuation worker concurrency 상향** (현재 1). full detach(#402) 로
  `process()` 가 빨라져 필수 아님. 대량 동시 resume 의 setup
  (`rehydrateContext` / `loadAndBuildGraph`) 직렬화 latency 가 운영에서 관측되면 검토.
- [ ] **멀티 인스턴스 double-drive optimistic lock** (pre-existing). detached resume
  드라이브가 다른 인스턴스에서 중복 구동될 수 있는 (fast-path 와 동일한) 기존 윈도우.
  `NodeExecution.status` 멱등 가드가 결과 중복은 막지만, optimistic lock 강화로
  in-memory 코루틴 누수까지 차단 검토.

## 비고
- 위 둘 다 운영 영향이 관측되기 전에는 착수 불필요 (deadlock 자체는 #399~#403 으로 해소).
- 착수 시 본 plan 을 worktree 로 승격(frontmatter `worktree`/`branch`/`status: in-progress`).
