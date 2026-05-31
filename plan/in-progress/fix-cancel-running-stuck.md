---
worktree: .claude/worktrees/fix-cancel-running-stuck-228f17
branch: claude/fix-cancel-running-stuck-228f17
status: in-progress
---

# markExecutionCancelled RUNNING-stuck (PR #402 follow-up)

## 배경
PR #402 (full-detach) review 에서 식별된 pre-existing 결함.

## 원인
`markExecutionCancelled` 의 `WHERE status = WAITING_FOR_INPUT`. 호출처 3곳 중
`driveResumeDetached` 의 RehydrationError 분기(ai_agent `_resumeCheckpoint` 재구성
실패 = schema drift/손상)는 `updateExecutionStatus(RUNNING)` **이후** 도달 →
이 시점 Execution.status=RUNNING → WHERE 가 affected=0 →
- Execution 이 `RUNNING` 으로 영구 고착 (terminal 미마킹)
- `affected>0` emit 가드로 EXECUTION_CANCELLED emit 억제 → 채널(텔레그램)에
  graceful "세션 만료 — 새 대화" 안내가 무음.

나머지 호출처(rehydrateAndResume outer catch = detached launch 이전 pre-check)는
WAITING_FOR_INPUT 이라 정상.

## 수정
`markExecutionCancelled` Execution UPDATE 의 status 조건을
`status IN (WAITING_FOR_INPUT, RUNNING)` 로 확장. 두 상태 모두 "재개 실패" 의
합법적 cancel 대상. terminal(CANCELLED/COMPLETED/FAILED)이면 affected=0 으로
idempotent 유지(중복 emit 회피). `markNodeExecutionFailed` 는 변경 불요 — RUNNING
전이가 node status 를 건드리지 않아 waiting node 는 WAITING_FOR_INPUT 유지.

## 테스트
기존 "detached ai_agent: buildRetryReentryState 실패" 테스트에 status guard
검증 추가 — cancel UPDATE 의 `andWhere` statuses 가 RUNNING + WAITING_FOR_INPUT
둘 다 포함하는지. (수정 전이면 `{status:...}` 단일이라 statuses 배열 부재 → 실패.)

## 체크리스트
- [x] WHERE 확장 + 회귀 테스트
- [x] lint(0err)/unit(241)/build
- [ ] e2e
- [ ] /ai-review + RESOLUTION.md
