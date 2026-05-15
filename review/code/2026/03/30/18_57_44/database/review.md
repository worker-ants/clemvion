### 발견사항

**[INFO]** `ALTER TYPE ADD VALUE` — 트랜잭션 제한 및 롤백 불가
- 위치: `V003__add_trigger_category.sql:1-3`
- 상세: `-- flyway:nonTransactional` 마커와 `IF NOT EXISTS`가 이미 적용되어 Critical 이슈는 해소됨. 단, PostgreSQL에서 enum 값은 한번 추가되면 `DROP`이 불가능하여 다운 마이그레이션 시 타입 재생성(CREATE, 데이터 복사, DROP 구 타입)이 필요함. 현재 주석에 이 제약이 명시되어 있지 않음.
- 제안: 운영 주의사항 주석 추가
  ```sql
  -- NOTE: Enum values cannot be removed in PostgreSQL. Rollback requires type recreation.
  ```

**[INFO]** `BEFORE 'logic'` 순서 지정 — enum 비교 연산자 영향
- 위치: `V003__add_trigger_category.sql:3`
- 상세: PostgreSQL enum의 값 순서는 `<`, `>` 비교 연산자에 영향을 줌. `node_category` enum에 순서 기반 비교를 사용하는 ORM 쿼리나 raw SQL이 있다면 `trigger < logic` 관계가 성립하므로 확인 필요.
- 제안: 코드베이스에서 `node_category` enum 순서 비교 사용 여부 확인.

**[INFO]** `users.controller.ts` — PK 조회 성능
- 위치: `users.controller.ts:14`
- 상세: `findById(payload.sub)`는 UUID 기반 PK 단건 조회로 N+1 문제 없음. TypeORM의 PK 컬럼에는 자동으로 인덱스가 생성되므로 인덱스 누락 위험은 없음. 다만 `passwordHash`, `twoFactorSecret` 등 불필요한 컬럼까지 전체 row를 로드함.
- 제안: `UsersService.findById`에 SELECT 프로젝션 적용으로 필요한 6개 필드만 조회 (`select: ['id', 'email', 'name', 'avatarUrl', 'locale', 'theme']`).

**[INFO]** `workflows.service.spec.ts` — 트랜잭션 mock 패턴
- 위치: `workflows.service.spec.ts:50-55`
- 상세: `mockDataSource.transaction`이 콜백을 즉시 실행하는 방식으로 mock되어 있어 실제 DB 트랜잭션 동작(commit/rollback)은 검증하지 않음. 단위 테스트 수준에서는 허용 가능하나, 트랜잭션 롤백 시나리오(partial failure) 검증은 통합 테스트에서만 가능.
- 제안: 현재 수준 유지. 트랜잭션 실패 케이스는 추후 통합 테스트로 보완.

---

### 요약

데이터베이스 관련 핵심 변경은 `V003__add_trigger_category.sql` 하나이며, 이전 리뷰에서 지적된 CRITICAL 이슈(트랜잭션 블록 실행 불가)와 WARNING(멱등성 미보장)이 `-- flyway:nonTransactional` 및 `IF NOT EXISTS` 적용으로 모두 해소된 상태임. 잔존 위험은 PostgreSQL enum의 비가역적 특성에 대한 운영 문서화 미흡과 `users.controller.ts`의 불필요한 전체 컬럼 조회 정도로, 기능적 안전성에는 문제 없음.

### 위험도
**LOW**