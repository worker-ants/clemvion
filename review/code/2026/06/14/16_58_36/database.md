# 데이터베이스(Database) 리뷰 결과

## 발견사항

### [INFO] 상수 이름 변경 — TERMINAL_STATUSES -> RECONCILE_TERMINAL_STATUSES (SQL IN 절)
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L45, L371-L376
- 상세: `TERMINAL_STATUSES` 상수를 `RECONCILE_TERMINAL_STATUSES` 로 rename 한 것이 이번 DB 관련 변경의 전부다. TypeORM QueryBuilder 의 명명 파라미터 바인딩(`:...terminal`) 방식은 그대로이며 SQL 인젝션 위험 없음. 파라미터 이름(`terminal`)도 변경되지 않았으므로 실행 쿼리에 차이가 없다.
- 제안: 없음.

### [INFO] 스키마 변경 없음 — 마이그레이션 잠금 위험 없음
- 위치: 전체 diff
- 상세: 이번 변경에 DDL(컬럼 추가/삭제, 인덱스 생성/삭제, 테이블 구조 변경)이 전혀 없다. `system-status.constants.ts` 의 `TERMINAL_REVOKE_RECONCILE_QUEUE` 등록은 Redis/BullMQ 큐 설정이며 DB 스키마와 무관하다. 무중단 배포 안전성에 영향 없음.
- 제안: 없음.

### [INFO] 인덱스 — 기존 커버리지 유지
- 위치: `interaction-token.service.ts` QueryBuilder sweep 쿼리 (`.where('e.status IN (:...terminal)', ...)`)
- 상세: 상수 이름만 변경되었을 뿐 쿼리 구조, 조인 조건, 필터 컬럼이 변경되지 않았다. 이전 리뷰(16_17_36)에서 `idx_execution_token_execution_id`(V060) 커버리지가 확인됨. 신규 인덱스 누락 위험 없음.
- 제안: 없음.

## 요약

이번 변경에서 DB 관련 코드 변경은 `TERMINAL_STATUSES` 상수의 이름을 `RECONCILE_TERMINAL_STATUSES` 로 rename 하고 `.where()` 포맷을 정렬한 것뿐이다. 실행 쿼리, 파라미터 바인딩 방식, 인덱스 사용, 스키마 구조에 실질적 변화가 없다. N+1 완화, batchLimit clamp, 트랜잭션 설계, 커넥션 관리, SQL 인젝션 방어 등 이전 리뷰(16_17_36)에서 검토한 DB 관련 사항은 그대로 유지된다. `system-status.constants.ts` 와 `system-status.e2e-spec.ts` 의 큐 등록 변경은 DB 관점 검토 대상이 아니다. DB 관점 발견사항 없음.

## 위험도

NONE
