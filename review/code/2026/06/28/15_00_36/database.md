# 데이터베이스(Database) 리뷰 결과

## 발견사항

### [INFO] PublicWebhookThrottleGuard — partial projection 제거로 full entity 로드 전환

- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (변경 전 `select: { authConfigId: true }` 제거)
- 상세: 과거 `findOne({ where: { endpointPath, type: 'webhook' }, select: { authConfigId: true } })` 호출에서 TypeORM의 partial projection이 `authConfigId` 컬럼을 NULL 대신 비-NULL로 잘못 반환하는 버그를 수정하기 위해 full entity 로드로 변경했다. 이 수정은 보안상 올바른 방향이다. 다만 full entity 로드는 Trigger 테이블의 모든 컬럼을 SELECT하므로, webhook 요청마다 필요 이상의 데이터를 읽는다. W14 최적화(Guard가 조회한 trigger를 `req.__publicWebhookTrigger`에 첨부해 HooksService가 재사용)가 이미 적용되어 있어 동일 요청 내 DB 왕복 중복은 제거된 상태다.
- 제안: 현행 full entity 로드는 기능 정확성과 보안을 위해 필수적이며, W14 캐싱으로 중복 조회도 방지되어 있다. `endpointPath` 컬럼과 `auth_config_id` 컬럼에 복합 인덱스(또는 최소 `endpoint_path` 단독 인덱스)가 있으면 full entity 로드의 성능 부담은 미미하다. 인덱스 존재 여부를 마이그레이션 파일에서 확인하는 것을 권장하나, 이 Guard 자체가 변경한 것은 `select` 절 제거뿐이므로 구조적 위험은 없다.

## 요약

이번 변경 세트의 DB 관련 코드는 `PublicWebhookThrottleGuard`의 TypeORM `findOne` 쿼리에서 `select` partial projection을 제거한 단 한 곳이다. 이 수정은 TypeORM partial projection이 NULL 컬럼을 비-NULL로 잘못 반환하던 버그를 근본적으로 제거하는 올바른 대응이며, 보안(공개 webhook 32KB 제한 우회 방지)과 기능 정확성 모두에서 개선이다. Full entity 로드로 인한 쿼리 비용 증가는 W14의 request-scoped 캐싱으로 완화되어 있다. 나머지 변경(body-parser 미들웨어, GlobalExceptionFilter 413 매핑, main.ts 부트스트랩, 테스트, spec 문서)은 DB와 무관하다.

## 위험도

LOW
