# 데이터베이스(Database) 리뷰 결과

## 발견사항

### [INFO] partial SELECT 제거 — TypeORM null 반환 버그 교정
- **위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (변경 전 `select: { authConfigId: true }` 제거)
- **상세**: TypeORM `findOne({ select: { authConfigId: true } })` partial projection 이 `authConfigId` 컬럼을 `null` 대신 비-`null` 값으로 잘못 반환하는 버그가 있었다. 이는 공개 webhook(`auth_config_id IS NULL`)을 인증 webhook 으로 오판하게 만든 보안 회귀였다. full entity 로드(`select` 제거)로 교정한 것은 올바르다.
- **제안**: 현재 조치(full load)는 정확성 면에서 안전하다. 향후 partial projection 을 재도입할 경우 TypeORM 버전의 null 처리 동작을 실측 검증 후 적용할 것.

### [INFO] 중복 DB 왕복 제거 (W14) — preloadedTrigger 전달
- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` (`preloadedTrigger?: Trigger | null` 파라미터 추가), `codebase/backend/src/modules/hooks/hooks.controller.ts` (`req.__publicWebhookTrigger` 전달)
- **상세**: Guard 가 이미 조회한 `Trigger` 엔티티를 Controller 를 통해 Service 로 전달해 webhook 요청당 DB 왕복을 2회→1회로 줄인다. 폴백(`preloadedTrigger === undefined` 시 직접 조회)으로 하위 호환성도 유지한다. Guard 의 full entity 조회와 Service 의 조회 조건(`{ endpointPath, type: 'webhook' }`)이 동일하므로 데이터 정합성 문제 없음.
- **제안**: 현재 구현은 적절하다. Guard 가 첨부하는 엔티티가 Service 가 기대하는 전체 필드를 포함하는지 타입 레벨에서 보장되어 있어 추가 위험 없음.

### [INFO] DB 쿼리는 파라미터화된 ORM 경로만 사용
- **위치**: `hooks.service.ts`, `public-webhook-throttle.guard.ts`
- **상세**: 모든 DB 접근은 TypeORM Repository `findOne({ where: { endpointPath, type: 'webhook' } })` 형태로 파라미터화 바인딩을 사용한다. Raw SQL 문자열 접합은 없으므로 SQL 인젝션 위험 없음.
- **제안**: 현 수준 유지.

## 요약

이번 변경의 DB 관련 코드는 크게 두 가지다. (1) `PublicWebhookThrottleGuard` 의 partial `SELECT` 제거 — TypeORM null 반환 버그로 인해 공개 webhook 보호가 전량 우회되던 보안 결함을 full entity 로드로 교정한 것으로, 스키마·쿼리 측면 모두 올바르다. (2) Guard 조회 결과를 Service 에 전달해 중복 DB 왕복을 제거한 W14 최적화 — 데이터 정합성과 타입 안전성이 유지된 채로 성능이 개선된다. 마이그레이션·인덱스·트랜잭션·커넥션 풀·대량 데이터 처리에는 변경이 없으며 나머지 파일(body-parser, exception filter, e2e 테스트)은 DB 코드와 무관하다.

## 위험도

LOW
