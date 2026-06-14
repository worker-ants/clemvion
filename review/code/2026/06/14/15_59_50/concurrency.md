# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] reconcileTerminalRevocations 의 순차 루프 — 대량 배치 시 레이턴시
- 위치: `interaction-token.service.ts` — `reconcileTerminalRevocations()` 내 `for...of` 루프
- 상세: `revokeAllForExecution` 호출이 executionId 마다 순차(await-in-loop) 처리된다. 기본 `batchLimit=500` 에서 다수의 잔존 execution 이 있으면 Redis SET + DB DELETE 가 직렬로 실행돼 분 단위 repeatable 잡의 처리 시간이 늘어날 수 있다. 단, (1) 1분 주기 스케줄 잡이고 (2) BullMQ 워커가 이전 잡 완료 후 다음 잡을 집어가므로 자기 자신과의 중복 실행 문제는 없다. 실무 트래픽에서 배치 500건이 상시 발생하는 상황이 아니라면 현재 직렬 패턴은 단순성(오류 격리) 측면에서 정당하다.
- 제안: 현재 설계(fail-open + per-execution try-catch)가 오류 격리에 유리하므로 급하지 않다. 성능 이슈가 관측되면 `Promise.allSettled` 를 도입하되 동시성 수를 제한(예: p-limit 10)하는 방식을 검토한다.

### [INFO] batchLimit 고정값 — 잡 실행 시간 상한 부재
- 위치: `terminal-revoke-reconciler.service.ts` — `process()` 호출 체인에서 `reconcileTerminalRevocations()` 기본값 500
- 상세: batchLimit 을 외부에서 주입하는 경로가 없다. 극단적으로 잔존 토큰이 많을 경우 단일 잡이 오랫동안 실행될 수 있으나, BullMQ 는 lockDuration 을 자동 갱신하므로 잡 실패로 이어지지는 않는다. 현재 코드는 잡 `timeout` 을 명시하지 않는다.
- 제안: 잡 옵션에 `timeout: 55_000` 등 1분 미만의 타임아웃을 추가하거나, batchLimit 을 ConfigService 에서 주입 가능하도록 변경해 운영 환경에서 튜닝할 수 있게 한다.

### [INFO] BullMQ 워커 동시성 기본값 사용 — 의도 미명시
- 위치: `terminal-revoke-reconciler.service.ts` — `@Processor(TERMINAL_REVOKE_RECONCILE_QUEUE)` 데코레이터
- 상세: `@Processor` 에 `concurrency` 옵션을 명시하지 않아 BullMQ 기본값(1)이 적용된다. reconcile 잡에는 단일 동시성이 올바른 선택이나 명시적으로 선언하면 의도가 코드에서 자명해진다.
- 제안: `@Processor(TERMINAL_REVOKE_RECONCILE_QUEUE, { concurrency: 1 })` 로 명시해 의도를 문서화한다.

## 요약

변경 코드는 BullMQ 기반 분 단위 reconciliation 스케줄러를 도입해 `execution_token` 테이블을 durable outbox 로 활용한다. 멀티 인스턴스 안전성은 BullMQ 의 Redis 중앙 스케줄 + 분산 락 메커니즘에 올바르게 위임되어 있으며, `reconcileTerminalRevocations` 는 per-execution try-catch 로 fail-open 처리해 단일 실패가 전체 sweep 을 중단시키지 않는다. `revokeAllForExecution` 은 Redis SET + DB DELETE 의 idempotent 복합 연산이지만 두 연산 사이의 원자성은 보장되지 않는데 이는 기존 설계의 의도된 타협이며 reconciler 의 재실행으로 보상된다. 발견된 사항은 모두 INFO 수준으로 차단 요소는 없다.

## 위험도

NONE
