# 동시성(Concurrency) Review — orphan pending backstop (fresh re-review)

- 세션: `review/code/2026/07/04/22_28_18`
- 대상: orphan pending backstop PR — 이번 diff 는 이전 클린 패스(`review/code/2026/07/04/22_12_26`) 조치(주석/문서 전용) 이후 로직 변경 없는 fresh re-review.
- diff base 확인: payload 파일 목록이 `git diff origin/main...HEAD --stat` 결과와 일치(코드 3파일 + plan/spec/review 문서). mis-scope 아님.

## 발견사항

발견 없음 (no findings).

검증한 3가지 레이스 가설 — 모두 안전:

1. **admission(`admitExecutionOrDefer`) vs backstop(`recoverOrphanPendingExecutions`) 동시 접근**
   - 위치: `execution-engine.service.ts` `markQueueWaitTimeout` (라인 2560-2603), `recoverOrphanPendingExecutions` (라인 2896-2935)
   - 상세: orphan 스캔은 `find()`로 후보를 조회한 뒤 각 id 에 개별 `markQueueWaitTimeout` 를 호출한다. SELECT 와 UPDATE 사이 TOCTOU 창이 존재하지만, 최종 반영은 `UPDATE ... WHERE id=:id AND status='pending'` 조건부 CAS 이므로 그 사이 admission 이 같은 row 를 RUNNING 으로 전이시켰다면 `affected=0`으로 자연 no-op 된다. 재-cancel/재-emit 부작용 없음.
   - 결론: 안전. 추가 조치 불필요.

2. **분산 lock TTL 만료로 두 인스턴스의 `recoverStuckExecutions` 겹침**
   - 위치: `recoverStuckExecutions` (라인 2812-2851), `RECOVERY_LOCK_TTL_SECONDS = 60`
   - 상세: `recoverOrphanPendingExecutions` 호출은 항상 lock 획득 인스턴스 컨텍스트 안에서만 실행된다. lock 만료로 두 인스턴스가 겹치더라도 각 row 에 대한 최종 UPDATE 는 위와 동일한 조건부 CAS(`WHERE status='pending'`)라 이중 cancel 이 관측 가능한 부작용(중복 emit, 상태 오염)을 일으키지 않는다. RUNNING re-claim 쪽(`reclaimStuckRunningExecution`)도 동일 패턴(`RETURNING id`, affected 행만 소유)으로 기존 검증된 선례와 대칭.
   - 결론: 안전.

3. **early-return 제거로 RUNNING 재점유 유무와 무관하게 orphan 스캔이 항상 실행**
   - 위치: `recoverStuckExecutions` 본문, `if (reclaimedIds.length > 0) { ... }` 뒤 `await this.recoverOrphanPendingExecutions();`
   - 상세: RUNNING 스캔(`status='running'`)과 PENDING 스캔(`status='pending'`)은 상호 배타적 상태 부분집합을 대상으로 하며 순차 실행(`await`)이라 두 스캔 사이 경쟁이 없다. `finally` 블록의 lock 해제는 두 스캔 완료 후 단 한 번만 수행되어 기존 lock 수명주기와 일치.
   - 결론: 안전.

부가 확인:
- `for (const { id } of orphans) { await this.markQueueWaitTimeout(id); }` 는 순차 루프이며 `markQueueWaitTimeout` 내부가 자체 try/catch 로 에러를 흡수하므로 개별 실패가 루프 전체를 중단시키지 않음 — 부분 진행 시에도 각 row 는 독립적으로 멱등 처리됨. (동시성 관점 문제 없음; 순차 처리로 인한 지연은 별도 관점(performance)의 영역.)
- unit/e2e 테스트는 mock 또는 단발 DB seed + 단일 트리거 호출 패턴이라 테스트 자체의 레이스는 없음.

## 요약

이번 diff 는 이전 클린 패스에서 지적된 database/documentation WARNING 에 대한 주석·문서 조치만 포함하며, 핵심 동시성 로직(admission CAS, `markQueueWaitTimeout` 조건부 UPDATE 멱등성, 분산 boot-lock 범위, RUNNING/PENDING 배타적 스캔)은 변경되지 않았다. TOCTOU 창이 존재하는 지점(SELECT 후 개별 UPDATE)은 모두 최종 조건부 CAS 로 귀결되어 실질적 레이스 위험이 없음을 재확인했다. 신규 발견 없음.

## 위험도

NONE

STATUS: SUCCESS
