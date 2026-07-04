# 동시성(Concurrency) Review — orphan pending backstop

대상: `recoverOrphanPendingExecutions` (execution-engine.service.ts), 통합 지점
`recoverStuckExecutions` early-return 제거, 관련 유닛/e2e 테스트.

## 핵심 레이스 분석

### (1) 동시 consumer pick-up(admission) vs backstop cancel — 이중 처리 없음, 확인됨

- `admitExecutionOrDefer`(a) 경로: `queuedAt` 초과 시 `markQueueWaitTimeout(executionId)` 호출 후 `'cancelled'` 반환. 초과 아니면 (c) 경로로 진행해 `UPDATE execution SET status='running' ... WHERE id=$1 AND status='pending' AND (COUNT 서브쿼리 cap 가드) RETURNING id`.
- `recoverOrphanPendingExecutions` → 동일한 `markQueueWaitTimeout(id)` 재사용: `UPDATE ... SET status='cancelled' WHERE id=:id AND status='pending'`.
- 두 갱신 모두 `WHERE status='pending'` 조건을 공유하는 단일-행 CAS(compare-and-swap) 이다. Postgres 단일 문장 UPDATE 는 원자적이므로, 두 트랜잭션이 동시에 같은 row 를 대상으로 실행되어도 먼저 커밋하는 쪽만 `status` 를 pending 에서 벗어나게 하고, 나중 쪽은 `WHERE status='pending'` 매치 실패로 `affected=0`(no-op, emit 스킵)이 된다.
- 따라서 "admission 이 늦게 도착한 job 을 running 으로 승격시키는 것"과 "backstop 이 같은 row 를 cancelled 로 마감하는 것"이 동시에 발생해도 정확히 한쪽만 승리하고 이중 상태 전이·이중 emit 은 발생하지 않는다. **확인됨 — 안전.**
- 참고: admission (c) 경로는 COUNT 서브쿼리 때문에 조건부 UPDATE 단독으로는 불충분해 `pg_advisory_xact_lock`(workspace 단위)으로 직렬화한다(코드 주석에 명시, PR2b 에서 이미 실 Postgres 재현으로 확정된 결함). 반면 backstop 의 `markQueueWaitTimeout` 은 COUNT 를 참조하지 않는 단순 단일-행 조건부 UPDATE라 advisory lock 없이도 그 자체로 충분히 원자적이다 — admission 의 "조건부 UPDATE 단독 불충분" 교훈이 이 경로에는 적용되지 않는다(다른 종류의 연산).

### (2) 스캔(find) - 조치(UPDATE) 사이 TOCTOU — benign, 확인됨

- `recoverOrphanPendingExecutions` 는 `executionRepository.find({ where: { status: PENDING, queuedAt: LessThan(staleThreshold) }, select: { id: true } })` 로 후보를 non-atomic 하게 조회한 뒤, 각 id 에 대해 순차 `await this.markQueueWaitTimeout(id)` 를 호출한다.
- find 시점과 UPDATE 시점 사이에 다른 프로세스가 해당 row 를 admit(running) 하거나 이미 다른 backstop 인스턴스/타이밍에 cancel 했을 수 있다. 그러나 `markQueueWaitTimeout` 자체가 `WHERE status='pending'` 재검사를 포함하는 조건부 UPDATE이므로, stale 한 후보 목록으로 조치를 시도해도 이미 상태가 바뀐 row 는 자동으로 no-op 이 된다(멱등). emit 도 `affected>0` 조건부라 중복 emit 도 없다.
- 결론: "스캔=claim" 을 원자로 겸하는 `reclaimStuckRunningExecution`(RUNNING 케이스, `UPDATE...RETURNING`) 과 설계 패턴이 다르지만(이는 이미 convention_compliance 리뷰가 INFO 로 지적함), **안전성 자체는 최종 조치의 원자성(conditional UPDATE)만으로 충분히 보장**된다. 스캔 단계의 non-atomicity 는 최적화 손실(불필요한 no-op 시도) 수준일 뿐 정합성 결함이 아니다. **확인됨 — benign.**

### (3) advisory lock 과의 상호배타성 — 설계상 불필요, 충돌 없음

- backstop 은 `exec-cap:${workspaceId}` per-workspace advisory lock 을 전혀 획득하지 않는다. 대신 `exec:recover:lock`(boot-scope, `continuationBus.acquireLock`/`releaseLock`, TTL 60초, SET NX 류 분산 락)만 사용해 **다른 recovery-scan 인스턴스와의 중복 스캔**만 막는다.
- admission 경로의 advisory lock 목적은 "동시 admission 두 건이 같은 COUNT 스냅샷을 보고 cap 을 이중으로 통과하는 것"을 막는 것이며, backstop 의 `markQueueWaitTimeout` 은 COUNT 를 전혀 참조하지 않는 단일 행 CAS 이므로 애초에 advisory lock 이 방지하는 종류의 race 대상이 아니다. 두 메커니즘이 서로 다른 문제를 풀기 때문에 상호배타를 요구할 이유가 없고, 실제로 겹쳐 실행돼도 (1)에서 분석한 CAS 로 충분하다. **확인됨 — 락 부재가 결함이 아님.**

## 발견사항

- **[INFO]** boot lock 보유 중 순차 orphan cancel 루프
  - 위치: `execution-engine.service.ts` `recoverOrphanPendingExecutions` (`for (const { id } of orphans) { await this.markQueueWaitTimeout(id); }`), 호출부 `recoverStuckExecutions`
  - 상세: `recoverOrphanPendingExecutions` 는 `recoverStuckExecutions` 의 `try` 블록 안, `finally { releaseLock }` 이전에 실행된다. 즉 orphan 건수가 많으면 `exec:recover:lock` 을 그만큼 더 오래 보유한 채 순차(await 직렬) 로 cancel 을 처리한다. 다른 인스턴스의 동시 boot 는 이 동안 lock 획득 실패로 스킵되어 자신의 recovery(포함 stale RUNNING re-drive)를 미룬다.
  - 영향: boot-only·best-effort 로 설계된 backstop(문서화된 낮은 확률 엣지)이라 실무 영향은 제한적이며, lock TTL 60초가 방어선 역할을 한다. 다만 orphan row 가 다수(예: 장애로 대량 축적) 쌓인 상태에서 재부팅이 겹치면 다른 인스턴스의 stale-RUNNING 회수가 최대 60초까지 지연될 수 있다.
  - 제안: 필수 수정 아님(설계상 boot-only, ai-review 상 CRITICAL/WARNING 대상 아님). 필요 시 Promise.allSettled 병렬화 또는 배치 크기 제한을 후속 검토로 남길 수 있음.

- **[INFO]** `queuedAt` NULL 레거시 row 자연 제외
  - 위치: `recoverOrphanPendingExecutions` 코드 주석 및 `LessThan(staleThreshold)` 조건
  - 상세: TypeORM `LessThan` 이 SQL `<` 로 변환되므로 `queued_at IS NULL` 인 pre-V104 레거시 row 는 비교에서 자연 제외된다(`NULL < x` 는 SQL 3치 논리상 unknown → 매치 안 함). 코드 주석에 명시돼 있고 동작도 의도와 일치 — 동시성 결함 아님, 참고 확인.

- **[INFO]** 테스트(유닛) 는 `markQueueWaitTimeout` 을 스텁 처리해 실제 원자 UPDATE 경합은 검증하지 않음
  - 위치: `execution-engine.service.spec.ts` `recoverOrphanPendingExecutions` describe 블록 (`mqtSpy = jest.spyOn(...).mockResolvedValue(undefined)`)
  - 상세: 유닛 테스트는 스캔 필터링·호출 횟수만 검증하고 실제 DB 조건부 UPDATE 의 CAS 동작은 검증 범위 밖이다. 이는 e2e(`execution-concurrency-cap.e2e-spec.ts`)의 두 신규 케이스(초과 pending → cancelled, 이내 pending → 유지)로 보완되며, admission 과의 동시 경합(레이스 1) 자체를 재현하는 e2e 는 없다(단, `markQueueWaitTimeout` 은 기존 PR2b 에서 이미 검증된 자산 재사용이라 신규 회귀 위험은 낮음). 결함은 아니며 테스트 커버리지 성격의 참고 사항.

CRITICAL/WARNING 등급 발견 없음. 세 가지 핵심 레이스(1: admission vs backstop cancel 이중 처리, 2: scan-then-act TOCTOU, 3: advisory lock 비중첩) 모두 프롬프트가 제시한 가설대로 안전함이 코드 레벨에서 확인된다.

## 요약

`recoverOrphanPendingExecutions` 는 신규 동시성 메커니즘을 도입하지 않고 기존에 검증된 단일-행 조건부 UPDATE(`markQueueWaitTimeout`, `WHERE id=:id AND status='pending'`)를 재사용한다. 이 CAS 패턴은 admission 경로의 pending→running 전이와 상태 컬럼을 공유하는 상호배타 조건(`status='pending'`)으로 걸려 있어, 동시에 실행되어도 정확히 한쪽만 성공하고 다른 쪽은 no-op 이 된다 — 이중 처리·이중 emit 불가능. 스캔(find) 은 non-atomic 하지만 최종 조치가 이미 원자·멱등이므로 TOCTOU 는 benign 하다. per-workspace advisory lock 과는 겹치는 문제 영역이 아니라(COUNT 기반 cap 판정 대 단일 행 CAS) 상호배타가 필요 없고 실제로도 안전하다. 유일한 참고 사항은 boot recovery lock 보유 중 orphan cancel 이 순차 처리된다는 점(락 보유 시간 소폭 증가)이나, boot-only best-effort 설계 취지상 문제로 보기 어렵다. CRITICAL/WARNING 없음.

## 위험도

LOW

STATUS: SUCCESS
