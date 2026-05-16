### 발견사항

- **[WARNING]** `findAllCafe24RowsForMall` — 레거시 fallback 이 매번 2개의 독립 쿼리를 발행
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` — `findAllCafe24RowsForMall` 메서드 (diff +459~+472)
  - 상세: primary 경로(`mallId = ?`) 와 legacy 경로(`mallId IS NULL`) 를 항상 순차 실행한다. `precheckCafe24Mall`, `findConnectedCafe24MallIntegration` 두 경로가 모두 이 헬퍼를 호출하고, public-flow begin 시에는 `findConnectedCafe24MallIntegration` → `findAllCafe24RowsForMall` 가 2회 쿼리를 발행한다. legacy fallback 은 "backfill 완료 후 제거 예정" 으로 명시되어 있으나, 해당 시점까지는 모든 precheck/begin 호출이 DB 쿼리를 2배 소모한다. debounce(350ms) 가 적용된 precheck endpoint 는 throttle(60 req/min)까지 걸려 있어 현재 부하 수준에서는 문제가 없지만, 향후 backfill 완료 시점을 관리하지 않으면 기술 부채로 고착될 수 있다.
  - 제안: (1) backfill 완료 예정 날짜·마이그레이션 번호를 주석에 명시해 제거 시점을 추적 가능하게 한다. (2) 가능하다면 단일 쿼리 `WHERE (mallId = :mallId) OR (mallId IS NULL AND credentials->>'mall_id' = :mallId)` 로 통합해 왕복 횟수를 줄인다 (단, JSONB 인덱스 없이는 성능이 오히려 나빠질 수 있으므로 실행 계획 확인 필요).

- **[WARNING]** legacy fallback 쿼리 대상 컬럼(`credentials JSONB`)에 인덱스 부재 가능성
  - 위치: `integration-oauth.service.ts` — `findAllCafe24RowsForMall` 레거시 경로 (diff +467~+470)
  - 상세: `mallId IS NULL` 인 cafe24 행 전체를 가져온 뒤 애플리케이션 레이어에서 `row.credentials?.mall_id === mallId` 로 필터링한다. `credentials` 는 암호화된 JSONB 컬럼이라 DB 레벨 조건 적용이 어렵다는 점은 이해하지만, `mallId IS NULL AND serviceType='cafe24'` 행이 많을 경우 전체 스캔 → 네트워크 전송 → 메모리 필터링 패턴이 된다. V045 이전 row 의 실제 수량에 따라 성능이 선형적으로 악화된다.
  - 제안: backfill 스크립트(또는 별도 마이그레이션)로 `mallId IS NULL` 인 기존 행들에 plain `mall_id` 컬럼을 채운 뒤 legacy 분기를 빠르게 제거하는 일정을 수립한다. backfill 전까지는 `(serviceType='cafe24' AND mallId IS NULL)` 행 수를 모니터링한다.

- **[INFO]** `findAllCafe24RowsForMall` 의 결과를 `findConnectedCafe24MallIntegration` 이 재사용하지 않고 재호출
  - 위치: `integration-oauth.service.ts` — `findConnectedCafe24MallIntegration` (+479~+485) 및 호출 지점 (+376~+386)
  - 상세: `precheckCafe24Mall` 은 `findAllCafe24RowsForMall` 을 직접 호출하고, `findConnectedCafe24MallIntegration` 도 `findAllCafe24RowsForMall` 을 내부 호출한다. 동일 요청 내에서 두 함수가 조합될 경우 DB 쿼리가 중복 발행된다. 현재 public-flow begin 에서는 두 함수가 별도 진입점이어서 중복은 없지만, 향후 로직 변경 시 의도치 않은 쿼리 중복이 생길 수 있다.
  - 제안: 필요 시 `findAllCafe24RowsForMall` 결과를 상위에서 한 번 가져온 뒤 `connected` 여부를 인라인으로 판단하는 방식으로 단순화를 검토한다.

- **[INFO]** `throwIfUniqueViolation` 확장 — 레이스 컨디션 backstop으로서의 트랜잭션 경계 명확성
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `throwIfUniqueViolation` (+729~+748)
  - 상세: V045 partial UNIQUE constraint `idx_integration_cafe24_workspace_mall` 위반을 409로 변환하는 로직이 추가되었다. 이는 DB-level race 의 최후 방어선으로 올바른 접근이다. 다만 `create` 메서드 전체가 트랜잭션으로 묶여 있는지 확인이 필요하다. UNIQUE 위반 이후 partial rollback 이 발생하지 않으면 다른 중간 부작용(예: 이벤트 발행, 외부 API 호출)이 이미 실행된 뒤 409를 받는 경우가 생길 수 있다.
  - 제안: `create` 메서드가 TypeORM 트랜잭션(`@Transaction()` 또는 `queryRunner`) 안에서 실행되고 있는지 확인하고, 아니라면 atomic 처리를 보장하도록 트랜잭션을 추가한다.

- **[INFO]** e2e 테스트에서 direct DB INSERT 로 cafe24 row 를 삽입 (`credentials = '{}'::jsonb`)
  - 위치: `backend/test/integration-cafe24-precheck.e2e-spec.ts` — `insertCafe24Row` 함수 (+835~+843)
  - 상세: 테스트 편의를 위해 `credentials` 를 빈 JSONB `'{}'` 로 삽입한다. 실제 운영 행은 암호화된 값이 들어 있으므로 precheck endpoint 가 `credentials` 를 읽지 않는다는 전제가 깨지는 순간(예: 향후 기능 추가) 테스트가 현실을 반영하지 못하게 된다. DB 스키마에 NOT NULL 제약이나 CHECK 제약이 있다면 빈 객체로 인해 insert 자체가 실패할 수도 있다.
  - 제안: 테스트 helper 에 "이 insert 는 precheck 전용이며 credentials 를 읽지 않는 경우에만 유효하다"는 주석을 추가해 의존 전제를 명시한다. 또는 암호화 트랜스포머를 우회할 수 있는 테스트 전용 팩토리를 활용한다.

### 요약

이번 변경은 Cafe24 mall_id 중복 사전 감지를 위한 precheck endpoint 와 begin-time pre-check 가드를 추가한 것으로, 데이터베이스 관점에서 전반적으로 안전한 구현이다. V045 partial UNIQUE constraint (`idx_integration_cafe24_workspace_mall`) 를 DB-level backstop으로 활용하고, `throwIfUniqueViolation` 을 확장해 레이스 컨디션을 올바르게 처리한 점은 긍정적이다. 주요 우려 사항은 legacy fallback 경로(V045 이전 `mallId IS NULL` 행)가 두 번의 쿼리를 발행하며 애플리케이션 레이어에서 JSONB 필터링을 수행한다는 점이다. 해당 legacy 행이 충분히 적은 동안에는 문제가 없지만, backfill 완료 일정을 명시적으로 관리하지 않으면 기술 부채가 고착될 위험이 있다. 스키마 변경이나 마이그레이션 자체는 이 PR에 포함되지 않아 마이그레이션 안전성 관점에서는 별도 평가 대상이 없다.

### 위험도

LOW
