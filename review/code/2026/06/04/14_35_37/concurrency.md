# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] `segmentStartMs` in-memory Map — 멀티 인스턴스/프로세스 환경에서의 누락 리스크
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `private readonly segmentStartMs = new Map<string, number>()`
- **상세**: `segmentStartMs`는 프로세스 메모리 내 Map이다. 단일 인스턴스 단일 프로세스 내에서는 문제가 없으나, `ExecutionEngineService`가 NestJS Singleton scope이라 하더라도 **동일 Execution이 서로 다른 프로세스(예: k8s 다중 replica, 프로세스 재시작)에서 세그먼트를 이어 받는 경우**, 새 프로세스의 Map에는 `segmentStartMs` 엔트리가 없어 진행 중 세그먼트 경과분(`inProgress`)이 0으로 계산된다. 이는 `assertActiveTimeWithinLimit`에서 과소평가를 유발할 수 있다.
  - 설계 코멘트(`"세그먼트는 한 인스턴스 안에서 처리되므로 in-memory Map 으로 충분(누적값은 row 에 영속)"`)가 이 리스크를 인지하고 있음은 확인된다. BullMQ Worker가 job을 하나씩 처리하고 동일 job은 동일 worker 프로세스가 완주한다는 전제라면 단일 세그먼트 내 mid-flight 이탈은 드문 케이스(프로세스 크래시)이며, 크래시 시 `activeRunningMs`가 영속 행에 미누적 상태로 남는 것은 수용 가능한 trade-off임을 인지한다.
  - **다만**, 프로세스 정상 재시작(Graceful Shutdown SIGTERM) 후 job retry 시나리오에서, RUNNING 진입 후 SIGTERM → job이 다른 worker로 이관될 때 `segmentStartMs`에 엔트리가 있는 채로 `updateExecutionStatus`를 통한 "RUNNING 이탈" flush가 실행되지 않으면 해당 세그먼트의 active 시간이 `activeRunningMs`에 누적되지 않는다. 이는 타임아웃 판정이 느슨해지는(under-count) 방향이어서 실패 누락이지 잘못된 종결은 아니나, 장시간 실행 Execution이 한도를 영구히 우회할 수 있는 경우가 이론상 존재한다.
- **제안**: Graceful Shutdown 훅에서 `segmentStartMs`에 남아 있는 모든 인-플라이트 세그먼트를 DB row에 flush(partial accumulate)하거나, 혹은 `execution-run` job processor의 finally 블록에서 status가 RUNNING인 채로 worker가 종료될 때 flush를 보장하도록 방어 코드를 추가하는 것을 검토한다. 현재 설계가 "over-count보다 under-count를 허용"하는 방향으로 의도된 것이라면 주석에 명시하면 충분하다.

### [WARNING] `assertActiveTimeWithinLimit` + `updateExecutionStatus` 간 비원자적 read-check-then-act
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertActiveTimeWithinLimit` 및 `updateExecutionStatus`
- **상세**: dispatch loop에서 `assertActiveTimeWithinLimit(savedExecution)` 호출(체크) 이후, 실제 상태 전이가 `updateExecutionStatus` (DB 트랜잭션)를 통해 이루어지기까지 짧은 시간 간격이 존재한다. 동일 Execution에 대해 두 개의 continuation이 동시에 dispatch loop를 타는 것은 정상적이지 않으나(BullMQ가 동일 executionId job을 직렬화한다면), **만약 CONTINUATION_WORKER_CONCURRENCY > 1이고 두 개의 서로 다른 continuation job이 동일 Execution에 속하는 경우**, 두 세그먼트가 동시에 실행될 수 있다. 이 경우:
  1. 두 세그먼트가 각각 `segmentStartMs`에 동일 key (`executionId`)를 set하여 서로를 덮어쓴다.
  2. `updateExecutionStatus` flush 시 하나의 segStart가 소실된다.
  - 실제로 Execution의 continuation이 동시에 두 개 실행되는 설계가 아니라면(하나의 Execution = 순차 실행이 불변식) 이는 이론적 위험이다. 설계 불변식이 보장되는지 확인이 필요하다.
- **제안**: `segmentStartMs.set`/`delete` 쌍이 단일 Execution에 대해 상호 배제됨을 주석 또는 invariant assert로 명시한다. 불변식이 보장된다면 INFO 수준이다.

### [INFO] `Date.now()` 비결정성 — 테스트에서 timing-sensitive 판정
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `segmentStartMs.set(executionId, Date.now() - 300)` 패턴
- **상세**: 테스트가 `Date.now() - 300`으로 과거 시점을 직접 삽입해 경과시간을 시뮬레이션하는 방식은, 느린 CI 환경에서 `Date.now()` 호출 사이의 실제 경과가 추가로 붙어 예상치를 초과할 수 있다. `toBeGreaterThanOrEqual(300)`처럼 하한만 검증하는 방식은 올바르나, 경쟁 조건으로 인해 의도치 않게 한도를 초과하여 `ExecutionTimeLimitError`가 발생할 가능성이 있다(테스트 flakiness).
- **제안**: `jest.useFakeTimers()`로 `Date.now()`를 제어하거나, service 코드에서 `Date.now`를 주입 가능한 인터페이스로 만들어 테스트에서 deterministic 타이밍을 사용한다. 현재 테스트 케이스의 실패 임계값 여유(500ms gap, 1000ms limit)는 충분하여 실제 flakiness 발생 가능성은 낮지만, `segmentStartMs.set('e3', Date.now() - 500)` + `activeRunningMs: 600` + `maxActiveRunningMs: 1000`의 경우 총합이 `1100`으로 한도 초과를 단언하는데, CI 부하 등으로 실행 사이에 추가 시간이 더해질 수 있어 `1000`을 여유 있게 초과하므로 정상이다. 큰 문제는 아님.

### [INFO] `execution.activeRunningMs` 뮤테이션 — DB save 전 in-memory 수정
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `updateExecutionStatus`의 `execution.activeRunningMs = (execution.activeRunningMs ?? 0) + (Date.now() - segStart)`
- **상세**: `updateExecutionStatus`에서 `execution` 객체(Entity 참조)의 `activeRunningMs`를 in-memory에서 직접 누적한 후, 이후 `await this.dataSource.transaction(...)` 내에서 `save`된다. 이 패턴은 기존 `execution.status = newStatus` 수정 패턴과 동일하며 의도된 것이다. 단, `assertActiveTimeWithinLimit`가 이 in-memory 값을 읽기 때문에, 트랜잭션 롤백이 발생할 경우 in-memory의 `activeRunningMs`는 이미 증가했으나 DB row는 이전 값으로 복원되어 불일치가 생긴다. 다음 세그먼트 시작 시 DB에서 reload하지 않으면 over-count가 발생할 수 있다.
- **제안**: 트랜잭션 롤백 후 `execution` 객체를 DB에서 재조회(reload)하거나, 롤백 핸들러에서 `activeRunningMs`를 원복하는 로직을 추가하는 것을 검토한다. 기존 코드가 롤백 시 `execution.status`도 동일 불일치 문제를 가지고 있었다면, 이는 기존 설계 패턴의 일반적 리스크이며 새 코드만의 문제가 아님을 참고한다.

## 요약

변경의 핵심인 `active-running` 누적 타임아웃 메커니즘은 단일 프로세스·단일 Execution 직렬 실행의 불변식 하에서 동시성 관점 설계가 올바르다. `segmentStartMs`는 프로세스 로컬 Map으로, 누적값은 DB에 영속되어 인스턴스 재시작 후에도 이전 누적분이 보존된다. 주요 리스크는 두 가지다: (1) Graceful Shutdown 시 flush 미보장으로 인한 세그먼트 시간 under-count, (2) continuation worker concurrency > 1 환경에서 동일 Execution에 복수 세그먼트가 동시 실행될 경우 `segmentStartMs` key 충돌 — 다만 이는 설계 불변식(Execution 직렬화)이 보장되면 발생하지 않는다. 전체적으로 동시성 결함이 즉각적인 운영 장애를 유발할 가능성은 낮으나, SIGTERM 경로의 flush 미보장은 장시간 실행 Execution이 한도를 우회하는 silent under-enforcement로 이어질 수 있어 WARNING으로 분류한다.

## 위험도
MEDIUM
