# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] reconcileTerminalRevocations — Promise.allSettled 청크 병렬화 설계 확인
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L1273-1287
- 상세: `RECONCILE_CONCURRENCY=20` 단위의 청크 병렬화를 `Promise.allSettled`로 구현하고 있으며, `revokeAllForExecution`가 per-execution 단위의 독립적 DB/Redis 연산이므로 공유 상태 경쟁 조건은 없다. `revoked` 카운터는 단일 이벤트 루프 콜백 내에서 `forEach`로 순차 누적되어 원자성이 보장된다.
- 제안: 없음 (현재 구현 정상).

### [INFO] DEV_EPHEMERAL_SECRET — 모듈 로드 시점 단 1회 생성, 공유 상태 없음
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L925
- 상세: `randomBytes(32).toString('hex')`는 Node.js의 동기 crypto API로 모듈 로드 시 1회 실행된다. 이후 `this.secret`이라는 `readonly` 필드에 복사되어 변경되지 않으므로 race condition이 없다. 멀티 인스턴스 환경에서 인스턴스별로 다른 값이 생성되는 것은 의도된 동작이며 주석에 명시되어 있다.
- 제안: 없음.

### [INFO] BullMQ concurrency: 1 + upsertJobScheduler — 멀티 인스턴스 중복 실행 방어 확인
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` L1771
- 상세: `@Processor(TERMINAL_REVOKE_RECONCILE_QUEUE, { concurrency: 1 })`로 동일 인스턴스 내 중복 실행을 방지하고, `upsertJobScheduler`의 idempotent 특성과 BullMQ의 Redis 분산 락으로 멀티 인스턴스 전역 1회 실행을 보장한다. `revokeAllForExecution`가 idempotent(blacklist SET + row DELETE 재실행 무해)하므로 설령 동시 실행이 발생해도 안전하다.
- 제안: 없음.

### [INFO] revokeAllForExecution — 직렬 for-of 루프 (의도적)
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L1215-1221
- 상세: per-execution 내 jti 순회는 직렬 `for...of` 루프를 사용한다. execution당 jti 수가 보통 1~2건으로 적어 병렬화 오버헤드 대비 이득이 없으며, 상위 청크 병렬화(`Promise.allSettled`)가 전체 throughput을 보완한다. 의도적 설계로 문제 없음.
- 제안: 없음.

## 요약

변경된 코드의 동시성 관련 핵심 경로는 `reconcileTerminalRevocations`의 `Promise.allSettled` 청크 병렬화와 BullMQ repeatable scheduler의 분산 단일 실행 보장이다. `revoked` 카운터는 settled 결과를 단일 스레드에서 순차 집계하므로 race condition이 없고, `DEV_EPHEMERAL_SECRET`은 모듈 로드 시 1회 생성 후 `readonly` 필드에 저장되어 공유 상태 충돌이 없다. `revokeAllForExecution`와 Redis `SET EX`는 모두 idempotent하게 설계되어 중복 sweep에도 안전하다. async/await 누락, 데드락, 스레드 안전성 이슈는 발견되지 않았다. 그 외 변경(import 경로 분리, Swagger 데코레이터 교체, 큐 상수 types 파일 분리)은 동시성과 무관하다.

## 위험도

NONE
