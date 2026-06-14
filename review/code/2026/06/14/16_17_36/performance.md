### 발견사항

- **[INFO]** `RECONCILE_CONCURRENCY=20` 상수가 근거 없이 고정됨
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `RECONCILE_CONCURRENCY` 상수 선언 및 chunked `Promise.allSettled` 루프
  - 상세: 동시성 20은 Redis 연결 풀·DB 커넥션 풀 크기와 무관하게 하드코딩되어 있다. 운영 환경에서 Redis default pool(10~20)과 충돌하거나, 반대로 너무 낮아 병목이 될 수 있다. 현재 sweep 은 백그라운드 BullMQ job 이므로 즉각적 위험은 없으나, 설정 가능한 값으로 분리하는 것이 장기적으로 낫다.
  - 제안: 환경변수 또는 모듈 옵션(`RECONCILE_CONCURRENCY`)으로 주입 가능하게 하거나, 최소한 JSDoc에 Redis/DB 커넥션 풀 크기와의 관계를 명시한다.

- **[INFO]** `rows.slice(i, i + RECONCILE_CONCURRENCY)` 청크 루프가 chunk 당 `Promise.allSettled`를 순차 await함
  - 위치: `interaction-token.service.ts` — `for (let i = 0; i < rows.length; i += RECONCILE_CONCURRENCY)` 블록
  - 상세: 현재 구현은 한 청크 전체가 완료될 때까지 다음 청크를 시작하지 않는다(엄격한 슬라이딩 윈도 없이 배치 단위 대기). concurrency=20, 배치 상한 1000일 경우 최대 50 라운드 직렬 대기가 발생한다. `p-limit` 류의 진짜 세마포어 방식 대비 평균 tail-latency가 높다. 단, 이 sweep은 백그라운드 repeatable job이고 실시간 SLA가 없으므로 즉각적 위험도는 낮다.
  - 제안: 현재 규모(보통 sweep row 0~소수)에서는 허용 범위. 향후 대규모 backlog 처리가 필요해지면 세마포어 기반 concurrency 제어(`p-limit` 등)로 교체를 고려한다.

- **[INFO]** `revokeAllForExecution` 내부 per-jti Redis `SET` 이 개별 왕복임
  - 위치: `interaction-token.service.ts` — `revokeAllForExecution` (변경 외 기존 코드, sweep에서 호출)
  - 상세: execution당 잔존 jti가 여러 건이면 Redis `SET`이 N회 개별 호출된다. Redis pipeline/multi-exec로 묶으면 RTT를 1회로 줄일 수 있다. 단, 코멘트에서도 "per-jti SET 은 보통 1~2건"으로 명시되어 있어 현재 규모에서는 무시 가능하다.
  - 제안: jti가 다수인 execution이 대규모로 발생하는 시나리오를 대비해 Redis pipeline 묶음을 고려하되, 현재는 INFO 수준.

- **[INFO]** sweep 쿼리의 `DISTINCT executionId + LIMIT` 이 covering index를 타는지 명시적 검증 필요
  - 위치: `interaction-token.service.ts` — `createQueryBuilder('et').innerJoin('et.execution','e').where(...).select('et.executionId','executionId').distinct(true).limit(safeLimit).getRawMany()`
  - 상세: RESOLUTION.md(W4)에서 `idx_execution_token_execution_id`(V060)가 존재한다고 확인되었으나, `execution.status IN (...)` 필터는 `execution` 테이블에 걸린다. INNER JOIN 후 status 필터링은 `execution_token` 인덱스 범위 스캔 + `execution` PK lookup 조합이며, terminal execution 비율이 낮을 경우 효율적이다. 그러나 terminal execution 비율이 높아지거나 `execution_token` 누적이 매우 클 경우 쿼리 플랜이 바뀔 수 있다.
  - 제안: 현재 규모에서는 기존 인덱스로 충분하나, `execution.status`에 대한 복합 인덱스(`execution_token.executionId, execution.status` 방향)가 없다면 장기 모니터링 필요.

- **[INFO]** `batchLimit` clamp(`Math.floor`)가 소수점 입력을 묵시적 처리함
  - 위치: `interaction-token.service.ts` — `Math.min(Math.max(1, Math.floor(batchLimit)), RECONCILE_BATCH_MAX)`
  - 상세: `Math.floor`는 음수(예: `-0.5 → -1`)에 대해 `Math.max(1, ...)` 로 안전하게 처리된다. 성능 문제는 없고, 로직도 올바르다. 완전성 확인 목적의 INFO.
  - 제안: 문제 없음. 현행 유지.

### 요약

이번 변경의 핵심 성능 개선은 직렬 N+1 Redis/DB 왕복을 `Promise.allSettled` 기반 bounded-concurrency(20) 병렬화로 전환한 것으로, 백그라운드 sweep 특성과 "보통 sweep row 0~소수" 운영 패턴을 고려하면 실용적으로 적절한 수준이다. `batchLimit` clamp(≤1000), `TERMINAL_STATUSES` 상수 추출, `@Processor({concurrency:1})` 명시 등 방어적 최적화도 양호하다. 잠재적 개선 여지는 (1) concurrency 값의 환경 설정 가능화, (2) 진짜 세마포어 기반 concurrency 제어, (3) per-jti Redis pipeline화 세 가지이며 모두 현재 규모에서 INFO 수준이다. CRITICAL·WARNING 수준의 성능 결함은 없다.

### 위험도
LOW
