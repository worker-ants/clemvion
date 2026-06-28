# 데이터베이스(Database) 리뷰

## 발견사항

### [INFO] NOT IN 파라미터 바인딩 — 인덱스 selectivity 주의
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `expiring`/`attention` 분기
- 상세: `i.service_type NOT IN (:...autoRefreshServiceTypes)` 조건이 추가됐다. TypeORM spread 바인딩(`:...`)을 올바르게 사용해 SQL 인젝션은 없다. 다만 `service_type` 컬럼에 인덱스가 없거나 카디널리티가 낮을 경우, `NOT IN` + 복합 조건(status, token_expires_at 범위)이 결합돼 쿼리 플랜이 seq-scan으로 떨어질 수 있다. 현재 파라미터 목록은 registry 에서 동적 파생되며, 미래에 auto-refresh 서비스 타입이 늘어도 IN 목록 크기는 소규모(현재 3개)이므로 즉각적인 성능 문제는 없다.
- 제안: `service_type` 컬럼에 단독 또는 `(workspace_id, status, service_type)` 복합 인덱스가 없다면 추가를 검토하라. 특히 테이블 규모가 커질 경우 expiring/attention 쿼리 실행 계획을 EXPLAIN ANALYZE로 확인할 것.

### [INFO] attention 분기 인라인 vs. 헬퍼 — 동일 로직 이중화
- 위치: `integrations.service.ts` — `attention` 분기 (`autoRefreshExclusion` 문자열 보간)
- 상세: `expiring` 분기는 `excludeAutoRefresh(qb)` 헬퍼를 사용하지만 `attention` 분기는 OR 합집합의 connected 서브절 내에 동일 SQL fragment를 인라인 문자열로 보간한다. 동일 파라미터 이름(`autoRefreshServiceTypes`)·값을 사용하므로 SQL 인젝션 위험은 없고, 논리적 정합성도 보인다. 그러나 서비스 타입이 변경될 때 두 경로를 모두 수동으로 업데이트해야 한다는 유지보수 부담이 남는다. 이전 리뷰(W3)와 동일 지적.
- 제안: `attention` 분기의 인라인 `autoRefreshExclusion` 을 헬퍼 또는 상수로 추출하면 단일 진실 원칙이 강화된다. 현재 기능 정합성 자체에는 문제없음.

## 요약

이번 변경의 DB 영향 범위는 `integrations.service.ts`의 `expiring`/`attention` 쿼리 분기에 `i.service_type NOT IN (:...autoRefreshServiceTypes)` 조건 추가로 한정된다. 파라미터 바인딩을 올바르게 사용해 SQL 인젝션 위험은 없고, 스키마 변경·마이그레이션·트랜잭션·커넥션 관리 관련 변경도 없다. `NOT IN` 조건이 복합 조건과 결합될 때 인덱스 활용 여부를 확인할 필요가 있으나, 현재 파라미터 수(3개)와 일반적인 테이블 규모에서 즉각적인 성능 문제는 발생하지 않을 것으로 판단된다. `attention` 분기의 인라인 SQL fragment 이중화는 유지보수 관점 주의 사항으로 기능 차단 사유는 아니다.

## 위험도

LOW
