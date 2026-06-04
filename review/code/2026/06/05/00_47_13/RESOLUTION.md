# RESOLUTION — execution-engine worker job 반환 (PR-C) ai-review 후속

리뷰 SUMMARY(BLOCK: NO)의 Warning 2건을 수정. 거짓 양성 2건은 SUMMARY 에 기각 사유 기록.

## 수정
- **W1 — `armFirstSegmentBarrier` 중복 arm 가드**: arm 진입 시 `settleFirstSegment(executionId)` 를 먼저 호출해 동일 키의 기존 배리어 awaiter 를 해제한 뒤 새 배리어로 교체. Map.set 덮어쓰기로 인한 이전 worker 영구 hang/leak 차단. (`execution-engine.service.ts`)
- **W2 — setup 단계 throw 시 FAILED best-effort 마킹**: `runExecutionFromQueue` 의 detached `.catch` 에서 `failFirstSegmentSetup(executionId, error)` 호출. 현재 비-terminal(PENDING/RUNNING) 일 때만 FAILED 마킹 + `EXECUTION_FAILED` emit, null-safe(startedAt 없으면 durationMs 생략), 자체 격리 try/catch(재-throw 방지). 정상 경로(runExecution 자체 catch 가 terminal 마킹)는 terminal 가드로 no-op. (`execution-engine.service.ts`)

## 테스트 (신규 3)
- W2: setup throw → FAILED 마킹됨.
- W2: 이미 terminal → 재마킹 no-op.
- W1: 동일 executionId 재 arm → 이전 배리어 awaiter resolve(hang 없음).

## 검증
- `npm run build` exit 0.
- `npx jest execution-engine.service.spec` — 264 passed (신규 3 포함).

## 후속(미수정, SUMMARY Info)
- detached coroutine 의 ShutdownStateService in-flight 미등록 → user-input 대기는 본래 graceful drain 대상이 아니므로 의도된 동작에 가까움(관찰).
- spec `4-execution-engine.md §4.x` 배리어 구현메모 보강 → project-planner 후속.
- 멱등 이중 settle / bg-key skip / information_extractor multi-turn 커버리지 보강 → 후속.
- continuation payload(form/button) 크기 상한 → 기존 범위, 후속.
