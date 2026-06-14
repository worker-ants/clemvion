# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] 모듈 수준 상수 도입 — 전역 스코프 확장 없음
- 위치: `interaction-token.service.ts` 상단 (`RECONCILE_BATCH_LIMIT`, `RECONCILE_BATCH_MAX`, `RECONCILE_CONCURRENCY`, `TERMINAL_STATUSES`)
- 상세: 네 개의 `const` 가 모듈 최상위에 추가되었다. TypeScript 모듈 스코프이므로 실제 전역 변수가 아니며 외부 노출(export)되지 않는다. `TERMINAL_STATUSES` 는 `readonly ExecutionStatus[]` 로 불변이라 공유 상태 오염 위험이 없다.
- 제안: 현행 유지 적절. `as const satisfies readonly ExecutionStatus[]` 를 쓰면 리터럴 타입 보존이 강화되지만 필수는 아님.

### [INFO] `reconcileTerminalRevocations` 시그니처 변경 — 기본값만 변경, 하위 호환 유지
- 위치: `interaction-token.service.ts` 라인 ~138
- 상세: `batchLimit = 500` → `batchLimit = RECONCILE_BATCH_LIMIT` (값은 동일하게 500). 호출자(`TerminalRevokeReconcilerService.reconcile()`)는 인자 없이 호출하고 있어 실질적 동작 변화 없음. 단위 테스트에서 `999_999` 를 전달하는 케이스가 새로 추가됐고 clamp 로 1000으로 제한되므로 의도치 않은 DB/Redis 과부하 부작용이 방어된다.
- 제안: 문제 없음.

### [WARNING] `reconcile()` 로그 제거 — 운영 가시성 부작용
- 위치: `terminal-revoke-reconciler.service.ts` 라인 ~62
- 상세: 기존 `reconcile()` 은 `swept > 0` 일 때 `this.logger.log(...)` 로 결과를 출력했다. 변경 후 해당 로그 블록이 삭제되었고 로깅 책임이 `InteractionTokenService` 로 이전되었다. RESOLUTION.md 는 "중복 로그 회피" 를 이유로 설명하나, `InteractionTokenService.reconcileTerminalRevocations` 의 내부 로그가 실제로 동일 정보를 남기는지 diff 에서 확인되지 않는다. 만약 token service 쪽 로그가 누락되어 있다면 sweep 결과가 조용히 사라지는 운영 부작용이 발생한다.
- 제안: `InteractionTokenService.reconcileTerminalRevocations` 의 `if (rows.length > 0) { this.logger.log(...) }` 블록이 여전히 존재하는지 확인 필요. diff 범위 밖이라 현재 리뷰에서 보이지 않으므로, 해당 로그가 삭제되지 않았음을 코드 검색으로 확인할 것.

### [INFO] `@Processor` 데코레이터에 `{ concurrency: 1 }` 추가 — BullMQ 워커 스레드 수 제한
- 위치: `terminal-revoke-reconciler.service.ts` 라인 ~265
- 상세: 기존에는 BullMQ 기본 concurrency(4)로 동작했다. 이제 동일 인스턴스 내에서 최대 1개의 job 만 동시 처리된다. sweep 자체는 멱등하나, 인스턴스 재시작 또는 큐 설정 변경 시 기존 default concurrency(4)를 기대하는 코드나 문서가 있으면 동작 변화가 된다. 다만 본 PR 범위 내에서는 의도된 변경이며 부정적 부작용은 없다.
- 제안: 문제 없음. 멀티 인스턴스 환경에서 BullMQ의 repeatable job Redis 단일 항목이 전역 1회를 보장하므로 concurrency: 1 은 추가 안전장치로 적절하다.

### [INFO] `Promise.allSettled` 병렬화 — 동시 DB/Redis 접속 수 증가
- 위치: `interaction-token.service.ts` 라인 ~178–191
- 상세: 직렬 루프 → 청크(최대 20) 단위 `Promise.allSettled` 로 변경. 한 청크에서 최대 20개의 `revokeAllForExecution` 가 동시 실행된다. 각 호출은 DB find + delete + Redis SET 을 포함하므로 피크 시 DB connection pool 및 Redis 연결에 최대 20배 동시 압력이 생긴다. 백그라운드 sweep 성격(BullMQ worker)이므로 실 트래픽과 경합 가능성은 낮으나, connection pool 이 작게 설정된 환경에서는 pool exhaustion 부작용이 발생할 수 있다.
- 제안: 현 `RECONCILE_CONCURRENCY=20` 값이 DB connection pool 최소 여유보다 작은지 배포 환경에서 확인 권장. 필요 시 값을 낮추거나 pool size 를 조정.

### [INFO] `removeOnComplete`/`removeOnFail` 매직넘버 → 상수 추출 — 동작 변화 없음
- 위치: `terminal-revoke-reconciler.service.ts` 라인 ~253-254
- 상세: 값 `24 * 60 * 60` 및 `7 * 24 * 60 * 60` 가 상수로 추출되었다. 계산 결과가 동일하므로 BullMQ 동작 변화 없음.
- 제안: 문제 없음.

### [INFO] `review/` 산출물 파일 신규 생성 — 의도된 파일시스템 부작용
- 위치: `review/code/2026/06/14/15_59_50/RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`
- 상세: 코드 리뷰 워크플로의 정상 산출물. 의도된 파일 생성이며 애플리케이션 런타임과 무관하다.
- 제안: 문제 없음.

## 요약

이번 변경은 `InteractionTokenService.reconcileTerminalRevocations` 에 `batchLimit` clamp 보호와 bounded-concurrency 병렬화를 추가하고, `TerminalRevokeReconcilerService` 에 `concurrency: 1` 과 상수 추출을 적용한 것이다. 공개 시그니처 변경은 기본값 동치(500)라 하위 호환이 유지되며, 전역/공유 상태 오염, 예상치 못한 파일시스템 작업, 외부 네트워크 호출 도입은 없다. 주목할 부분은 두 가지다: 첫째, `reconcile()` 의 swept 로그 삭제로 인해 sweep 결과 가시성이 `InteractionTokenService` 내부 로그에 전적으로 의존하게 되었으므로 해당 로그 블록이 실제로 존재하는지 확인이 필요하다. 둘째, 청크 병렬화로 인한 DB connection pool 동시 압력 증가는 운영 환경 pool 설정 검토가 권장된다.

## 위험도

LOW
