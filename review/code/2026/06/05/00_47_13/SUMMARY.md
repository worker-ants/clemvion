# 코드 리뷰 SUMMARY — execution-engine worker job 반환 (PR-C)

- **BLOCK: NO** (확정 Critical 0)
- 대상: `execution-engine.service.ts`(+105) / `execution-engine.service.spec.ts`(+166) — user-interaction 대기 시 worker job 반환(detached coroutine + `firstSegmentBarriers`).
- 검토: router 오작동(전 reviewer skip)으로 8개 reviewer(concurrency·side_effect·architecture·testing·security·maintainability·requirement·scope) 직접 fan-out.
- 종합 위험도: **MEDIUM** — 핵심 메커니즘(arm→detach→settle)은 단일 이벤트 루프에서 정확하고 spec §4.x 와 정합. 실질 결함은 방어적 보강 2건.

## 거짓 양성 (기각)
- **[side_effect Critical] settleFirstSegment→releaseRouting microtask 순서 race**: 오탐. `.catch` 콜백은 동기 실행 — `barrier.resolve()` 가 스케줄한 `await settled` continuation 은 콜백(이후 `releaseExecutionRouting` 포함) 완료 후에야 실행된다. 순서 보장됨.
- **[testing Medium] 배리어 구현이 프로덕션 파일에 없음(grep 0건)→테스트 전부 fail**: 오탐. 나머지 7 reviewer 가 `armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier` 를 line 인용하며 검토했고, 실제 `npx jest` 618 pass(신규 4 포함)·e2e 168 pass 로 구현 존재·정상 동작 반증.

## Warning (수정 대상)
- **W1. `armFirstSegmentBarrier` 중복 arm 시 Map.set 덮어쓰기 → 이전 배리어 영구 hang/leak** (concurrency + security 교차). 동일 executionId 로 재진입(BullMQ at-least-once 등) 시 이전 `settled` awaiter 가 고아 resolver 로 영원히 pending. `status!==PENDING` 가드로 현실 발생은 드물지만 계약상 결함. → **수정**: arm 전에 기존 배리어를 settle(awaiter 해제) 후 교체.
- **W2. detached `runExecution().catch()` 가 setup 단계 throw 시 execution 을 FAILED 로 안 마킹** (concurrency + architecture 교차). runExecution 자체 try 진입 전 throw 면 execution 이 PENDING/RUNNING 으로 잔류(routing release·배리어 settle 만 수행). `recoverStuckExecutions`(30분 RUNNING→FAILED) 백스톱·attempts:1(무재시도) 로 영향 제한적이나, 즉시 terminal 마킹이 옳다. → **수정**: catch 에서 best-effort FAILED 마킹(현재 비-terminal 일 때만, null-safe, 격리 try/catch).

## Info (관찰 / 후속)
- detached 코루틴이 `ShutdownStateService` in-flight 미등록 → graceful drain 이 park 된 coroutine 미대기. 단 user-input 대기는 본래 shutdown 이 기다릴 대상이 아니며 재시작 시 rehydration 재개 → **의도된 동작에 가까움**(후속 관찰).
- spec `4-execution-engine.md §4.x` 가 배리어 구현 메커니즘 미기술(정책만) — 코드가 정답, spec 구현메모 보강은 project-planner 후속.
- `settled` 변수명 → `barrierSettled` 가독성(반영).
- 테스트 보강 여지: 멱등 이중 settle / bg-key skip / information_extractor multi-turn park 커버리지(후속).
- `form_submitted`/`button_click` continuation payload 크기 상한 미적용(기존 범위, 후속).

## 검토 결론
핵심 버그(park 중 worker 슬롯 점유로 새 execution 미실행)는 정확히 해소됐고 회귀 테스트 4종이 가드. W1·W2 방어 보강 후 머지 적합.
