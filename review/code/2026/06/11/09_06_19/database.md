# 데이터베이스(Database) 코드 리뷰

## 발견사항

### [INFO] 트랜잭션 내 resolveTokenWorkspaceContext 순차 쿼리 — hold time 연장
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `generateTokens()` 내 `resolveTokenWorkspaceContext` 호출 (트랜잭션 콜백 안)
- 상세: `dataSource.transaction()` 콜백 안에서 `generateTokens()`가 호출되며, 그 안의 `resolveTokenWorkspaceContext`는 최대 3회 순차 SELECT를 수행한다. 이 쿼리들은 순수 read이며 트랜잭션 원자성과 무관하다. 트랜잭션 hold time이 불필요하게 연장되고 커넥션을 점유한다. 이미 이전 리뷰 세션(08_45_18 INFO 1)에서 식별·수용된 사항이며, RESOLUTION.md에 후속 항목으로 등록됨.
- 제안: `resolveTokenWorkspaceContext` 및 JWT sign 계산을 트랜잭션 콜백 밖으로 선계산 이동. 단, 현재 refresh 빈도·트랜잭션 길이 규모에서 즉각 차단 사안 아님 — 후속 리팩토링 시점에 처리 적절.

### [INFO] 조건부 UPDATE의 인덱스 활용
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` lines ~217-224
- 상세: `manager.getRepository(RefreshToken).update({ id: stored.id, isRevoked: false, expiresAt: MoreThan(new Date()) }, {...})` — `id`(PK) 조건으로 단 1행 대상 UPDATE이므로 실질적으로 인덱스 풀 스캔 없이 PK lookup 후 `isRevoked`, `expiresAt` 조건을 필터로 적용한다. 성능 문제 없음. `isRevoked`와 `expiresAt`에 복합 인덱스를 추가하더라도 PK 단건 조회 후 필터이므로 추가 이득 없음.
- 제안: 현행 유지. 인덱스 추가 불필요.

## 요약

이번 변경(`auth.service.ts`)의 핵심 DB 조작은 refresh 토큰 회전의 revoke(UPDATE) + INSERT를 `dataSource.transaction()`으로 원자화하고, UPDATE 조건에 `isRevoked: false, expiresAt: MoreThan(new Date())`를 추가하여 TOCTOU 이중 회전을 방어한 것이다. TypeORM의 표준 트랜잭션 패턴과 파라미터화 쿼리를 올바르게 사용하며, 스키마 변경이 없어 마이그레이션 이슈도 없다. PK 단건 조건부 UPDATE이므로 인덱스 누락이나 대용량 테이블 풀 스캔 위험도 없다. 커넥션은 콜백 패턴으로 자동 반환된다. 유일한 데이터베이스 관점 개선 여지는 `resolveTokenWorkspaceContext`(read-only 순차 쿼리)가 트랜잭션 콜백 안에서 실행되어 hold time을 소폭 연장하는 점이나, 이는 이미 이전 리뷰에서 INFO로 식별·후속 등록된 사항이다.

## 위험도

LOW
