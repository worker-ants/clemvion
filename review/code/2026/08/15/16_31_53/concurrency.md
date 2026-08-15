STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# Concurrency Review — `16_31_53`

## 리뷰 대상

이번 diff(`origin/main` 대비)에서 동시성과 실질적으로 관련된 코드는 다음 두 파일뿐이다:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted`(현재 `Read` 로 확인한 파일 기준 3340행부터)의 Execution UPDATE + NodeExecution cascade UPDATE 두 문장을 `this.dataSource.transaction(...)`(3352행)으로 단일 트랜잭션화
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 위 변경에 대응하는 회귀 테스트(`installStalledTx` 헬퍼 + 트랜잭션 manager 공유 검증 테스트) 추가

나머지(`CHANGELOG.md`, `spec/5-system/4-execution-engine.md`, `plan/**`, `review/**`)는 위 코드 변경을 서술하는 문서이며 동시성 관점에서 독립적인 코드 변경을 포함하지 않는다. 이 diff 는 `review/code/2026/08/15/16_04_38/` 라운드에서 이미 전량 리뷰된 것과 동일한 프로덕션 코드 diff이며(git diff 로 직접 대조 확인), 이번 라운드는 그 결과를 문서(plan/spec/CHANGELOG)에 반영한 것이다.

## 발견사항

- **[INFO]** 알려진 이론적 race(수용됨, 신규 아님) — `finalizeStalledExhausted` 의 조건부 UPDATE(`WHERE status='running'`)와 부팅 backstop `recoverStuckExecutions` 의 re-claim UPDATE(`WHERE status='running' ... SET started_at=now()`, status 는 변경하지 않음)가 시간상 겹치면, stalled 소진 마감이 이미 재구동 중인 세그먼트를 `WORKER_HEARTBEAT_TIMEOUT` 로 잘못 마감할 수 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3331-3338`(JSDoc), 로직은 3352-3400 (`dataSource.transaction` 블록)
  - 상세: 이번 diff 는 이 race 의 발생 조건(두 WHERE 절)을 전혀 바꾸지 않았다 — 트랜잭션화는 Execution UPDATE 와 NodeExecution cascade UPDATE **사이**의 원자성만 추가했을 뿐, `finalizeStalledExhausted` 대 `recoverStuckExecutions` **사이**의 race 창은 그대로다. JSDoc 이 이를 명시적으로 문서화하고 "신규 회귀 아님"으로 수용했으며, spec 문서(`spec/5-system/4-execution-engine.md` "잔여 zombie race" 항목)도 동일하게 서술한다. 오히려 트랜잭션화로 인해 Execution row 락이 두 UPDATE 문장이 끝날 때까지(커밋 전까지) 유지되므로, 종전(각 UPDATE 가 개별 autocommit)보다 락 보유 시간이 미세하게 늘었지만 두 UPDATE 사이 간격이 매우 짧아 실질적 영향은 무시할 수준이다.
  - 제안: 조치 불요(기존 결정 유지). 완전한 fencing 은 세그먼트-start/owner-token 영속화(defer)로 이미 트래커에 등재돼 있다.

- **[INFO]** 실 DB 트랜잭션 롤백은 여전히 mock 으로 미검증 (이미 트래커에 신규 등재된 사안)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 의 `installStalledTx` 헬퍼(4879행 부근) 및 이를 쓰는 신규 테스트(`Execution·NodeExecution 두 UPDATE 가 같은 트랜잭션 manager 를 탄다`)
  - 상세: `dataSource.transaction` 을 `jest.fn` 으로 대체해 "두 UPDATE 가 같은 manager 를 통해 실행된다"는 **전제**만 검증하고, 둘째 UPDATE 가 실패했을 때 첫째가 실제로 롤백되는지(진짜 원자성)는 검증하지 못한다. 이 한계는 테스트 주석과 plan 문서(`plan/in-progress/eia-stalled-atomicity.md` 및 `spec-sync-external-interaction-api-gaps.md` 의 `16_19_57` W1 항목) 양쪽에서 정직하게 인지·등재돼 있고, 실 DB e2e 트랙으로 후속 처리가 이미 백로그에 잡혀 있다.
  - 제안: 이번 PR 범위에서 추가 조치 불요 — 이미 정본 트래커에 등재됨(재등재 불필요).

## 점검 관점별 확인

1. **경쟁 조건**: 조건부 UPDATE(`WHERE id=:id AND status=:running`, `WHERE execution_id=:executionId AND status=:running`)가 동시 재진입에 대해 원자적 no-op 가드 역할을 한다 — 이미 FAILED 로 전이된 row 는 두 번째 호출에서 `affected=0` 으로 자연스럽게 걸러진다. 신규 race 없음(위 INFO 항목은 기존에 수용된 별개의 race).
2. **데드락**: 락 순서가 Execution → NodeExecution 으로, 이미 원자적이던 두 자매 함수(`cancelParkedExecution` 1023행, `markWebChatIdleTimeout` 1152행)와 동일하다. 코드베이스 내 역순(다른 순서로 두 테이블을 잠그는) 트랜잭션이 없어 교차 데드락 위험이 늘지 않는다.
3. **동기화**: `this.dataSource.transaction(async (manager) => {...})` 패턴을 올바르게 사용했고, 콜백 내부에서 `manager.createQueryBuilder()` 만 사용(리포지토리 직접 접근 없음) — 트랜잭션 밖 접근이 섞이는 흔한 실수를 테스트가 `mockExecutionRepo.createQueryBuilder`/`mockNodeExecutionRepo.createQueryBuilder` 에 throw 를 심어 하드닝했다(`installStalledTx`).
4. **스레드 안전성**: Node.js 단일 이벤트 루프이므로 스레드 세이프성 자체는 해당 없음. 함수-로컬 `let finalized`/`let stalledDurationMs` 는 클로저 내부 상태로 호출마다 독립적이라(모듈-레벨 공유 상태 아님) 동시 호출 간 오염 없음.
5. **async/await**: `await this.dataSource.transaction(...)` 정상 await. 트랜잭션 콜백 내부 두 `execute()` 도 순차 await. 커밋 이후 `this.finalizeRehydrationCleanup(executionId)`(3407행)는 await 없이 호출되는데, 이 메서드는 `void` 반환의 동기 함수(2804행 정의 확인)라 await 누락이 아니다 — 코드베이스 내 모든 호출부(1076, 1209, 1449, 2447, 2612, 3493, 3602행)가 동일하게 처리한다.
6. **원자성**: 이번 diff 의 핵심 목적 자체가 원자성 확보다. 종전엔 Execution UPDATE 와 NodeExecution cascade UPDATE 가 각각 autocommit 이라 첫 UPDATE 커밋 후 둘째가 실패하면 자식이 영구 RUNNING 으로 잔류할 수 있었는데, 단일 트랜잭션으로 묶어 부분 커밋을 제거했다. `if ((result.affected ?? 0) === 0) return;`(3371행)으로 조기 return 시 트랜잭션이 아무것도 커밋하지 않고(암묵적 커밋이라도 변경 없음), `finalized` 플래그(3401행)로 emit/cleanup 도 건너뛰어 "DB 미반영 상태에 대해 emit" 하는 불일치도 없다.
7. **이벤트 루프**: 블로킹 동기 연산 없음. 두 SQL 문이 트랜잭션 내에서 순차 실행되지만 각각 단건 조건부 UPDATE 라 지연이 크지 않다. 콜백 지옥이나 얽힌 Promise 체인 없이 `await` 체인이 선형적이다.
8. **리소스 풀링**: 명시적 커넥션 관리 없이 TypeORM `DataSource.transaction()` 이 커넥션 획득/해제를 담당한다. 이미 같은 패턴을 쓰는 자매 두 함수와 합쳐 총 3곳이 되었을 뿐 신규 아키텍처가 아니므로 풀 크기 정책에 미치는 영향은 미미하다.

## 요약

이번 diff 의 실질 코드 변경은 `finalizeStalledExhausted` 의 Execution/NodeExecution 두 조건부 UPDATE 를 `dataSource.transaction()` 으로 원자화한 것 하나이며, 이는 부분 커밋으로 자식 NodeExecution 이 영구 RUNNING 으로 잔류하던 기존 결함을 정확히 해소한다. 락 순서·조건부 UPDATE 가드·트랜잭션 밖 접근 차단 모두 이미 원자적이던 두 자매 함수와 동형이라 데드락이나 신규 경쟁 조건을 추가하지 않는다. 이 diff 는 앞선 리뷰 라운드(`16_04_38`)에서 동일한 코드로 이미 리뷰됐고 이번 라운드는 그 결과를 spec/plan/CHANGELOG 문서에 반영한 것으로, 문서 내용도 실제 코드 동작과 정확히 일치한다. 남은 두 관찰 사항 — `recoverStuckExecutions` 와의 이론적 race(기존에 문서화·수용, 이번 diff 로 확대되지 않음), 그리고 mock 이 실제 롤백을 검증하지 못하는 커버리지 갭(이미 트래커에 신규 등재됨) — 모두 새로운 위험이 아니라 이미 인지·기록된 사안이므로 INFO 로 처리한다.

## 위험도
LOW
