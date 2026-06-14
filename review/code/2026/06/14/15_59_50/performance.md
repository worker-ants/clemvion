### 발견사항

- **[WARNING]** `reconcileTerminalRevocations` 내 직렬 순차 Redis SET 루프 — N+1 Redis 호출
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `reconcileTerminalRevocations` 내 `for...of` 루프 → `revokeAllForExecution` → 내부 `for...of` → `revokePerExecution` (Redis `SET`)
  - 상세: `reconcileTerminalRevocations` 는 최대 `batchLimit(500)` 개 executionId 에 대해 순차로 `revokeAllForExecution` 을 호출한다. 각 `revokeAllForExecution` 은 다시 해당 execution 의 토큰 목록 전체에 대해 순차 `revokePerExecution` (Redis `SET`)을 호출한다. 결과적으로 최악의 경우 `sum(tokens_per_execution)` 건의 Redis 왕복이 직렬로 발생한다. Redis 는 싱글스레드 서버이므로 파이프라이닝·`MSET` 배치로 처리 가능한 부분을 개별 `SET` 으로 직렬 호출하면 레이턴시가 N배 누적된다. 분 단위 배치이므로 p99 실행시간이 크게 늘 수 있고, BullMQ job timeout 에 걸릴 위험이 있다.
  - 제안: `revokeAllForExecution` 내의 토큰 loop 를 Redis Pipeline(`pipeline()`) 으로 묶어 한 번의 왕복으로 처리한다. `reconcileTerminalRevocations` 의 executionId loop 는 `Promise.allSettled`로 병렬화하거나 chunk 병렬(예: 10개씩) 패턴을 적용한다.

- **[WARNING]** `reconcileTerminalRevocations` — DB 조회 후 실행당 개별 `find` 호출 (N+1 DB 쿼리)
  - 위치: `interaction-token.service.ts` — `reconcileTerminalRevocations` 의 `for...of` → `revokeAllForExecution` → `executionTokenRepository.find({ where: { executionId } })`
  - 상세: 단일 쿼리로 terminal executionId 목록을 가져온 후, 각 executionId 에 대해 별도 `find` 쿼리와 별도 `delete` 쿼리를 실행한다. executionId 가 N개일 경우 DB 쿼리가 1(목록 조회) + N(토큰 조회) + N(DELETE) = 2N+1 건 발생한다. batchLimit=500 일 때 최대 1001건의 DB 쿼리가 직렬로 발생할 수 있다.
  - 제안: 최초 `createQueryBuilder` 쿼리에서 `et.jti`, `et.expAt`, `et.executionId` 를 함께 SELECT 해 executionId 별로 메모리 groupBy 처리한다. DELETE 도 `executionId IN (:...ids)` 단일 배치 쿼리로 처리 가능하다.

- **[INFO]** `batchLimit=500` 기본값 — 적체 시 따라잡기 불가 및 가시성 부재
  - 위치: `interaction-token.service.ts` — `reconcileTerminalRevocations(batchLimit = 500)`
  - 상세: 분 단위로 최대 500개 executionId 를 처리한다. 빠른 속도로 terminal 이 발생하는 고부하 시나리오에서 `swept === batchLimit` 이어도 추가 잔존이 있는지 알 수 없다. 현행 로그는 `swept > 0` 일 때만 기록한다.
  - 제안: `swept === batchLimit` 시 "batch limit reached — possible backlog" 수준의 경고 로그를 추가해 운영 가시성을 확보한다. 필요 시 환경변수로 튜닝 가능하게 노출할 수 있다.

- **[INFO]** `reconcile()` 와 `process()` 의 불필요한 간접 호출 레이어
  - 위치: `terminal-revoke-reconciler.service.ts` — `process(_job)` → `reconcile()` → `tokenService.reconcileTerminalRevocations()`
  - 상세: `process` 가 `reconcile` 을 호출하고 `reconcile` 이 실제 로직을 위임하는 3단계 async/await 체인이 있다. 성능상 무해하나 추가 스택 프레임이 생성된다.
  - 제안: 테스트에서 `reconcile()` 직접 호출 편의를 위한 분리라면 현행 유지 가능. 불필요하다면 `process` 에서 `tokenService.reconcileTerminalRevocations()` 를 직접 호출해 레이어를 줄일 수 있다.

### 요약

이번 변경의 핵심인 `reconcileTerminalRevocations` 는 분 단위 배치 reconciler 의 보조 경로로 설계되어 실시간 성능 임팩트는 제한적이다. 그러나 내부 구조를 보면 최대 500개 executionId 에 대해 DB `find` + Redis `SET` + DB `DELETE` 가 모두 직렬 순차 호출로 구성되어 있어, 적체 시 하나의 BullMQ job 실행에 최대 1001건의 DB 쿼리와 수백 건의 Redis 왕복이 발생한다. `revokeAllForExecution` 내 Redis SET 을 Pipeline 으로 배치 처리하고, `reconcileTerminalRevocations` 의 토큰 조회·삭제를 IN-clause 배치 쿼리로 통합하면 대부분의 N+1 성격 직렬 호출을 해소할 수 있다. 현재 batchLimit=500 분 1회 실행이라는 맥락에서 즉각적인 서비스 중단 위험은 없으나, 고부하 적체 시 job 실행 시간이 수 초 이상으로 늘어날 수 있다.

### 위험도

MEDIUM
