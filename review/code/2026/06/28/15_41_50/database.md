# 데이터베이스(Database) 리뷰 결과

## 발견사항

### [INFO] PublicWebhookThrottleGuard — partial projection 제거, full entity 로드 전환 (보안 버그 수정)

- 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `findOne` 호출부 (`select: { authConfigId: true }` 제거)
- 상세: 기존 `findOne({ where: { endpointPath, type: 'webhook' }, select: { authConfigId: true } })` partial projection이 TypeORM의 알려진 동작으로 인해 `authConfigId`가 NULL인 컬럼을 비-NULL 값으로 잘못 반환, 모든 공개 webhook이 인증 webhook으로 오판되어 32KB body 제한·IP rate-limit 보호가 전량 우회되던 보안 버그를 수정한다. full entity 로드로 전환한 것은 올바른 대응이며 W14 패턴(Guard가 조회한 trigger를 `req.__publicWebhookTrigger`에 첨부 → HooksService 재사용)이 이미 적용되어 있어 요청당 DB 왕복은 1회로 유지된다.
- 제안: 현행 유지. `endpoint_path` 컬럼에 인덱스(또는 `(endpoint_path, type)` 복합 인덱스)가 마이그레이션에 존재하는지 확인 권장. 인덱스가 있으면 full entity 로드의 추가 비용은 미미하다. partial projection 재도입은 TypeORM null 반환 버그의 재현 조건을 명확히 확인한 후에만 시도해야 한다.

### [INFO] HooksService — preloadedTrigger 폴백 패턴으로 중복 DB 조회 제거

- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `handleWebhook` 메서드 trigger 조회부
- 상세: `preloadedTrigger !== undefined ? preloadedTrigger : await this.triggerRepository.findOne(...)` 패턴은 Guard가 이미 조회한 trigger를 재사용하고, 인자 미전달 시 기존 직접 조회로 폴백한다. `null`(trigger 미존재)과 `undefined`(미전달)를 명시적으로 구분하는 설계가 정확하다. Guard의 쿼리(`{ endpointPath, type: 'webhook' }`, full entity)와 서비스의 폴백 쿼리가 동일한 조건이므로 데이터 불일치 위험이 없다.
- 제안: 현행 유지.

### [INFO] 인덱스 누락 여부 — 변경 범위 외 사전 확인 권장

- 위치: `Trigger` 엔티티 테이블, `public-webhook-throttle.guard.ts` 및 `hooks.service.ts` 의 `findOne({ where: { endpointPath, type: 'webhook' } })` 조회 경로
- 상세: 이번 변경이 인덱스를 추가/제거하지는 않으나, full entity 로드 전환으로 인해 매 webhook 요청에서 `endpointPath` + `type` 조건 조회가 수행된다. `triggers` 테이블에 `endpoint_path` 단독 인덱스 또는 `(endpoint_path, type)` 복합 인덱스가 없다면 webhook 트래픽 증가 시 풀 테이블 스캔 위험이 있다. 변경 diff에는 마이그레이션 파일이 포함되어 있지 않아 인덱스 존재 여부를 직접 확인할 수 없었다.
- 제안: 기존 마이그레이션 파일에서 `triggers` 테이블의 `endpoint_path` 인덱스 유무를 검토할 것. 인덱스가 없다면 별도 마이그레이션으로 추가를 권장한다. 이번 변경 자체의 문제는 아니므로 차단은 아님.

## 요약

이번 변경 세트에서 DB와 직접 관련된 코드는 두 곳이다. `PublicWebhookThrottleGuard`의 TypeORM `findOne` partial projection 제거는 NULL 컬럼을 비-NULL로 잘못 반환하던 ORM 버그를 근본적으로 제거하는 보안 필수 수정이며, 데이터 정확성과 보안 측면 모두에서 올바른 방향이다. `HooksService`의 `preloadedTrigger` 폴백 패턴은 Guard-Service 간 동일 쿼리 중복을 제거해 webhook 요청당 DB 왕복을 1회로 줄인다. 스키마 변경·마이그레이션·트랜잭션·커넥션 관리·N+1·SQL 인젝션 관련 변경은 없다. 나머지 변경(body-parser 미들웨어, GlobalExceptionFilter 413 매핑, main.ts 부트스트랩, 테스트 파일, 문서)은 DB와 무관하다. `endpoint_path` 인덱스 존재 여부는 기존 마이그레이션에서 별도 확인이 권장되나, 이번 변경 자체의 위험 요인은 아니다.

## 위험도

LOW
