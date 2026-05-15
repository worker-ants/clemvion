### 발견사항

- **[INFO]** `ALTER TYPE ... ADD VALUE` — 잠금 없는 enum 확장
  - 위치: `V003__add_trigger_category.sql:2`
  - 상세: PostgreSQL 9.1+에서 `ADD VALUE`는 트랜잭션 내 실행 불가 제약이 있으며, 마이그레이션 도구가 트랜잭션으로 감쌀 경우 오류 발생 가능. 성능 자체는 문제없으나 enum 확장은 pg_enum 카탈로그만 수정하므로 테이블 재작성 없이 즉시 완료됨.
  - 제안: Flyway/Liquibase 사용 시 `disableTransactionHandling` 또는 `runInTransaction: false` 설정 확인 필요.

- **[INFO]** `findById` — 캐싱 부재
  - 위치: `users.controller.ts:12`
  - 상세: `GET /users/me`는 인증된 모든 요청마다 호출되는 고빈도 엔드포인트. 현재 매 요청마다 DB 조회 발생. 사용자 프로필은 변경 빈도가 낮아 캐싱 효과가 높음.
  - 제안: NestJS `CacheInterceptor` 또는 Redis TTL 캐시(`user:{id}`, TTL 60s) 적용. 프로필 수정 API에서 캐시 무효화 처리.

- **[INFO]** 응답에서 필드 수동 선택 — DB 프로젝션 최적화 가능
  - 위치: `users.controller.ts:15-22`
  - 상세: `findById`가 `passwordHash`, `twoFactorSecret` 등 민감 필드를 포함한 전체 row를 로드한 뒤 컨트롤러에서 필드를 필터링. 불필요한 데이터 전송 발생.
  - 제안: `UsersService.findById`에서 SELECT 프로젝션으로 필요한 6개 필드만 조회하거나, 별도 `findProfileById` 메서드 추가.

- **[INFO]** 테스트에서 `new Date()` 반복 생성
  - 위치: `users.controller.spec.ts:20-21`
  - 상세: 테스트 성능 영향은 미미하나, `mockUser` 객체가 각 테스트마다 `beforeEach` 외부에서 모듈 수준으로 생성되어 날짜 값이 테스트 실행 시점에 고정됨. 날짜 기반 검증이 추가될 경우 불안정한 테스트 원인 가능.
  - 제안: `beforeEach` 내부로 이동하거나 고정 날짜(`new Date('2024-01-01')`) 사용.

---

### 요약

변경된 코드의 성능 위험도는 전반적으로 낮습니다. SQL 마이그레이션은 경량 카탈로그 변경이며, 컨트롤러 로직도 단순한 단일 DB 조회입니다. 다만 `GET /users/me`는 인증 후 거의 모든 페이지 렌더링마다 호출되는 엔드포인트이므로, DB에서 전체 사용자 row를 매번 로드하는 구조는 트래픽 증가 시 불필요한 부하로 이어질 수 있습니다. SELECT 프로젝션 최적화와 단기 캐싱 적용을 권장합니다.

### 위험도

**LOW**