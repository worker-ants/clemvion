# Database 리뷰 결과

## 검토 범위

리뷰 대상 파일 14개 중 직접적인 DB 코드(SQL, ORM 쿼리, 마이그레이션 파일)는 포함되어 있지 않습니다. 그러나 `plan/complete/external-interaction-api.md` 와 `review/consistency/2026/05/21/00_08_35-impl-prep/` 하위 문서들이 DB 스키마 변경 계획(V059 마이그레이션)과 seq_counter 설계를 명시적으로 기술하고 있어, 해당 설계를 DB 관점에서 검토합니다.

## 발견사항

### [WARNING] Trigger 테이블 4컬럼 추가 — nullable 컬럼의 마이그레이션 안전성
- 위치: `plan/complete/external-interaction-api.md §2.1`, `review/consistency/2026/05/21/00_08_35-impl-prep/convention.md`
- 상세: `notification_health VARCHAR(16) NOT NULL DEFAULT 'unknown'`, `notification_last_error TEXT NULL`, `notification_secret_v2 TEXT NULL`, `notification_rotated_at TIMESTAMPTZ NULL` 4개 컬럼을 기존 `trigger` 테이블에 추가하는 V059 마이그레이션이 계획되어 있습니다. `NOT NULL DEFAULT 'unknown'` 컬럼은 대용량 테이블에서 `ALTER TABLE ADD COLUMN` 시 PostgreSQL 12+ 기준 기본값이 있는 NOT NULL 컬럼은 테이블 재작성 없이 처리되므로 무중단 배포에 안전합니다. NULL 허용 컬럼 3개도 테이블 재작성 없이 추가됩니다. 다만, `notification_health` 에 `CHECK (notification_health IN ('unknown','healthy','degraded'))` 제약이 plan §2.1 에는 명시되었으나 spec §7.1 SQL 예시에는 누락된 불일치가 있어, 실제 마이그레이션 작성 시 어느 쪽을 따를지 혼선이 생길 수 있습니다.
- 제안: 마이그레이션 작성 시 CHECK 제약을 반드시 포함하도록 plan §2.1 기준으로 작성. PostgreSQL의 `ADD COLUMN ... CHECK(...)` 는 NOT VALID 없이 추가하면 기존 행 전체를 검증하므로, 행 수가 많다면 `ALTER TABLE ... ADD CONSTRAINT ... NOT VALID; ALTER TABLE ... VALIDATE CONSTRAINT ...;` 2단계 패턴 사용을 권장합니다.

### [WARNING] Execution.seq_counter 컬럼 — 카운터 발급 방식 선택
- 위치: `plan/complete/external-interaction-api.md §P0`, `review/consistency/2026/05/21/00_08_35-impl-prep/cross-spec.md §4`
- 상세: `Execution` 엔티티에 `seq_counter INTEGER NOT NULL DEFAULT 0` 컬럼을 추가하고, 이벤트 발생마다 atomic INCR 를 수행하는 설계입니다. 구현 방식으로 "Redis `INCR exec:seq:<id>`" 또는 "DB row-level lock" 두 가지를 병기하고 있습니다. DB row-level lock 방식(`UPDATE executions SET seq_counter = seq_counter + 1 WHERE id = $1 RETURNING seq_counter`)은 PostgreSQL에서 안전하지만, 이벤트 발생이 빈번한 워크플로우에서는 hot row contention 이 발생할 수 있습니다. Redis INCR 방식은 DB 부하를 줄이지만 Redis 장애 시 seq 소실 위험이 있으며, DB의 `seq_counter` 와 Redis의 값이 diverge 할 수 있습니다. 최종적으로 한 방법만 선택해야 하는데, 현재 plan 이 두 방법을 동시에 나열하여 구현 시 모호성이 있습니다.
- 제안: seq 의 단조 증가 보장이 핵심이므로 Redis INCR 를 primary 로 쓰되, Execution 종료 시 최종 seq 값을 DB에 flush 하는 방식(SSE/Notification 이력 재구성용)이 적절합니다. 또는 Redis 없이 순수 DB UPDATE ... RETURNING 으로 통일하면 단순하나 이벤트당 DB write 1회가 추가됩니다. plan P0 단계에서 방식을 하나로 확정하고 명시할 것을 권장합니다.

### [WARNING] 마이그레이션 V059 슬롯 경합
- 위치: `plan/complete/external-interaction-api.md`, `review/consistency/2026/05/21/00_08_35-impl-prep/SUMMARY.md §C3`
- 상세: `replay-rerun.md` 와 본 PR2 가 동일하게 V059 슬롯을 요구합니다. consistency 검토에서 이미 인지되어 "PR2 가 V059 점유, replay-rerun 이 V060 으로 후행" 으로 권장 방향이 정해져 있습니다. 그러나 실제 마이그레이션 파일이 아직 코드베이스에 없고(plan 문서에만 존재), 두 브랜치가 동시에 진행될 경우 머지 충돌이 발생합니다.
- 제안: V059 마이그레이션 파일을 PR2 구현 첫 커밋에서 즉시 생성하여 슬롯을 물리적으로 점유. replay-rerun 담당자에게 V060 사용을 cross-plan 공지.

### [INFO] 인덱스 — 신규 컬럼에 대한 인덱스 계획 부재
- 위치: `plan/complete/external-interaction-api.md §2.1`
- 상세: `notification_health` 컬럼은 UI에서 "발송 건강도" 배지와 필터링에 사용될 가능성이 있습니다. `WHERE notification_health = 'degraded'` 형태의 쿼리(degraded 트리거 목록 조회, 모니터링)가 예상됩니다. 현재 plan §2.1 DDL 에 인덱스 생성 계획이 없습니다. trigger 테이블의 행 수가 적다면 문제없지만, 대규모 운영 환경에서는 고려가 필요합니다.
- 제안: 초기 릴리스에서는 인덱스 없이 진행 가능하나, `notification_health` 에 대한 partial index(`WHERE notification_health = 'degraded'`) 를 follow-up으로 등록해 두는 것을 권장합니다.

### [INFO] Idempotency 캐시 설계 — Redis 기반 24h 캐시
- 위치: `plan/complete/external-interaction-api.md §2.3 (Idempotency middleware)`
- 상세: `Idempotency-Key` 헤더를 24h Redis 캐시로 처리하는 계획입니다. 이는 DB 관점이 아닌 Redis 관점이지만, `400 VALIDATION_FAILED` 응답만 캐시 제외(EIA §R8)하도록 명시되어 있습니다. 정합성 관점에서 캐시 TTL(24h) 동안 동일 키로 재요청 시 동일 응답을 반환해야 하므로, 성공 응답의 `executionId` 등 DB 상태가 캐시 응답과 일치하는지 확인이 필요합니다. 실행이 이미 종료된 상태에서 캐시된 202 응답을 반환하면 호출자가 오해할 수 있습니다.
- 제안: 캐시 응답 반환 시 `X-Idempotency-Replayed: true` 헤더를 추가하는 것을 검토하여 호출자가 캐시 응답임을 인식할 수 있도록 합니다.

## 요약

이번 변경 세트에 포함된 코드 파일(SDK 클라이언트, i18n 사전, 패키지 설정, 테스트)은 DB 로직을 직접 포함하지 않습니다. 그러나 plan 및 consistency review 문서가 명시한 V059 마이그레이션 설계(Trigger 4컬럼 + Execution.seq_counter)에 DB 관점의 주의사항이 존재합니다. 가장 중요한 것은 `seq_counter` 의 atomic INCR 구현 방식(Redis vs DB)을 plan 단계에서 확정하지 않으면 실제 구현 시 데이터 정합성 문제가 발생할 수 있다는 점과, CHECK 제약 추가 시 기존 행 수에 따라 `NOT VALID` 패턴이 필요할 수 있다는 점입니다. Migration V059 슬롯 경합은 이미 인지된 문제로 물리적 선점이 권장됩니다. 전반적으로 DB 코드 자체보다 설계 문서 수준의 검토이며 실제 마이그레이션 파일과 ORM 코드가 포함된 PR에서 추가 검토가 필요합니다.

## 위험도

LOW

STATUS=success ISSUES=3
