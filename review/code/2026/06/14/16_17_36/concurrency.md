# 동시성(Concurrency) 리뷰

## 발견사항

### [INFO] Promise.allSettled bounded-concurrency 패턴 — 올바른 구현
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L380-394
- 상세: `for` 루프 내 `RECONCILE_CONCURRENCY=20` 단위 청크를 `Promise.allSettled`로 처리한다. `revoked += r.value.revoked` 누산은 동일 tick 내 `forEach`에서 순차 실행되므로 경쟁 조건 없음. `await Promise.allSettled(...)` 이후 루프 바디 실행은 단일 이벤트 루프 구간이라 공유 상태(`revoked`)에 대한 동시 쓰기가 없음.
- 제안: 현 구현 적절. 추가 조치 불요.

### [INFO] @Processor concurrency:1 — 동일 인스턴스 내 중복 sweep 방지
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` L29
- 상세: `@Processor(TERMINAL_REVOKE_RECONCILE_QUEUE, { concurrency: 1 })`로 동일 인스턴스에서 sweep job이 중복 실행되는 것을 방지한다. 멀티 인스턴스 환경에서는 BullMQ repeatable scheduler의 Redis 단일 entry + worker 락으로 전역 1회 실행이 보장된다. 패턴이 올바르게 적용되었음.
- 제안: 현 구현 적절.

### [INFO] upsertJobScheduler 멱등성 — 멀티 인스턴스 중복 등록 안전
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` L44-58
- 상세: `onModuleInit`에서 `upsertJobScheduler`를 호출한다. BullMQ의 upsert는 Redis에 단일 repeatable entry만 남기므로 replica N개에서 동시에 `onModuleInit`이 실행되어도 중복 job 등록이 없다. Redis 기반 원자적 upsert이므로 경쟁 조건 없음.
- 제안: 현 구현 적절.

### [INFO] revokeAllForExecution 내부 find→delete 비원자성 — 설계 허용 범위
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` (변경 외 기존 코드, reconciler와의 상호작용)
- 상세: `find` → Redis `SET` (per-jti) → `delete` 순서가 트랜잭션으로 묶이지 않는다. live fast-path와 reconciler sweep이 동일 executionId에 대해 동시에 실행될 경우 `find` 결과가 중복될 수 있다. 다만 `revokeAllForExecution`은 idempotent(blacklist SET 재실행 무해, DELETE는 존재하지 않는 row 삭제 시 affected=0으로 무해)라고 주석에 명시되어 있어 중복 실행이 기능 오류를 일으키지 않음. `revoked` 집계가 과다 계상될 수 있으나 이는 로그 수치 문제이지 보안 문제가 아님.
- 제안: 현 설계 범위 내 허용. 집계 정확도가 요구사항이 된다면 Redis SET NX 반환값으로 실제 신규 blacklist 건수 추적을 고려할 수 있으나, 현 spec R15 at-least-once 목표에서는 불필요.

## 요약

변경된 코드의 핵심 동시성 관련 변경은 직렬 `for-await` 루프를 `Promise.allSettled` bounded-concurrency(20) 청크 루프로 전환한 것이다. 구현이 올바르다: `revoked` 누산은 `await` 이후 단일 동기 구간에서 수행되므로 경쟁 조건이 없고, `@Processor({ concurrency: 1 })`과 BullMQ repeatable scheduler의 Redis 락 조합으로 멀티 인스턴스·동일 인스턴스 모두에서 중복 실행이 방지된다. `revokeAllForExecution`의 find→delete 비원자성은 기존 설계 허용 범위이며 idempotency로 안전성이 보장된다. 새로 도입된 동시성 코드에서 경쟁 조건, 데드락, 스레드 안전성 위반은 발견되지 않는다.

## 위험도

LOW
