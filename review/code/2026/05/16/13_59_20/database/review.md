### 발견사항

- **[INFO]** `pingConnection` 내부 `withIntegrationLock` 사용 — 트랜잭션 격리 수준 확인 필요
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `pingConnection` 메서드 (diff +636 행)
  - 상세: `withIntegrationLock(integration.id, ...)` 를 감싸 동시 호출을 직렬화하고 있다. 내부에서 `refreshAccessToken` 이 `dataSource.transaction` 을 사용해 토큰을 DB에 저장하는 흐름(테스트 코드 mock 확인)은 트랜잭션 경계가 올바르게 유지된다. 그러나 `ensureFreshToken` 과 401 후 `refreshAccessToken` 이 분리된 두 트랜잭션으로 순차 실행되어, 극단적 경쟁 상황(두 인스턴스가 동시에 `pingConnection` 호출)에서 lock 범위 밖의 일부 경로에서 이중 갱신 가능성은 남아 있다. 운영 환경에서 단일 인스턴스인 경우 무시 가능하나, 수평 확장 시 주의 필요.
  - 제안: `withIntegrationLock` 의 분산 잠금(Redis-backed 등) 여부를 확인한다. 분산 배포 환경에서는 DB 수준의 낙관적 잠금(버전 컬럼) 또는 토큰 저장 트랜잭션 내 `findOne` 재확인 로직이 보강되어야 한다.

- **[INFO]** `registerEntityTester` — 메모리 내 Map 사용, 영속성 없음
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `entityTesters` Map 선언 및 `registerEntityTester` 메서드 (diff +185, +200 행)
  - 상세: `entityTesters`는 인메모리 Map으로, DB 쿼리나 영속 레이어와 무관하다. DB 관점에서 직접적 위험은 없으나, 멀티 인스턴스(수평 확장) 환경에서 `onModuleInit` 등록이 각 인스턴스에서 독립적으로 실행되므로 일관성 문제는 발생하지 않는다. 이는 의도된 설계이다.
  - 제안: 현재 구조는 단일 프로세스 기준으로 안전하다. 추가 조치 불필요.

- **[INFO]** 토큰 갱신 시 `dataSource.transaction` 사용 — 테스트 mock 패턴 확인
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` — 401 retry 테스트 케이스 (diff +319~326 행)
  - 상세: `dataSource.transaction` mock에서 `findOne` + `save` 패턴을 사용한다. 실 구현에서 refresh 시 트랜잭션 내에서 토큰을 읽고 저장하는 구조는 정합성 측면에서 올바르다. 단, `findOne` 없이 `save` 만 호출하거나, 읽기 후 검증 없이 덮어쓰는 경우 동시성 문제가 발생할 수 있다 — 실 구현 코드(`refreshAccessToken`)의 트랜잭션 내 `findOne` 재확인 여부를 별도 검토 권장.
  - 제안: `refreshAccessToken` 구현에서 트랜잭션 내 `findOne`으로 최신 토큰을 재확인한 뒤 저장하는지 확인한다 (Optimistic Locking 또는 버전 필드 비교).

### 요약

이번 변경은 Cafe24 연결 테스트를 위한 API 클라이언트 메서드(`pingConnection`) 추가와 `IntegrationsService`의 entity-aware tester 등록 패턴 도입이 핵심이다. 데이터베이스 직접 쿼리·스키마·마이그레이션·인덱스 변경은 포함되어 있지 않다. 주요 DB 접촉은 토큰 갱신 시 `dataSource.transaction` 내 저장뿐이며, 기존 `refreshAccessToken` 트랜잭션 패턴을 재사용하므로 별도 설계 결함은 없다. 다만 `withIntegrationLock`의 분산 잠금 보장 범위와 refresh 트랜잭션 내 낙관적 잠금 유무는 수평 확장 환경에서 잠재적 이슈로 남아 있으며, 단일 인스턴스 운영 기준으로는 위험도가 낮다.

### 위험도

LOW
