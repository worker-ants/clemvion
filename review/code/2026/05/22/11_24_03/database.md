# Database 리뷰 결과

## 발견사항

### [INFO] 신규 테이블 `secret_store` — 스키마 설계 전반적으로 양호
- 위치: `codebase/backend/migrations/V063__secret_store.sql`, `codebase/backend/src/modules/secret-store/entities/secret-store.entity.ts`
- 상세: `ref TEXT PRIMARY KEY`, `workspace_id UUID NOT NULL`, `encrypted BYTEA NOT NULL` 구조는 단순하고 명확하다. PK가 TEXT(ref URI)이므로 별도 surrogate key가 없어 JOIN 빈도가 낮은 이 테이블에는 적합하다. `created_at` / `updated_at` 컬럼이 있어 rotation 추적에 유용하다.
- 제안: 해당 없음. 설계 적절.

### [INFO] FK 없는 application-level cascade — 의도적 선택
- 위치: `V063__secret_store.sql` 주석, `spec/1-data-model.md §2.21.1`
- 상세: `workspace_id`에 DB 수준 FK를 걸지 않고 application-level cascade (`TriggersService.delete()`) 로 처리. plan에서 "향후 다른 scope(workspace 외부 system-wide secret) 확장 여지"를 근거로 명시적 결정한 사항이다. 단, application code에서 삭제 경로가 누락되면 고아 row가 무기한 잔류한다.
- 제안: 중기적으로 `workspace_id`에 `REFERENCES workspace(id) ON DELETE CASCADE` FK를 추가하거나, workspace 삭제 hook에서 `deleteByPrefix` 를 반드시 호출하는 통합 테스트를 추가해 고아 row 방지를 보장할 것. 현재 `triggers.service.ts`의 `remove()`에는 `deleteByPrefix` 호출이 추가되었으나 workspace 자체 삭제 경로에 대한 처리는 본 diff에서 확인되지 않는다.

### [WARNING] 마이그레이션 안전성 — `ref CHECK constraint` 가 기존 행에도 즉시 적용
- 위치: `V063__secret_store.sql` lines `chk_secret_store_ref_format` CHECK
- 상세: 신규 테이블(`CREATE TABLE`)이므로 기존 데이터에 대한 lock 문제는 없다. 단, `ADD CONSTRAINT ... CHECK` 구문이 `CREATE TABLE` 이후 별도 `ALTER TABLE`로 분리되어 있어 PostgreSQL이 암묵적으로 `NOT VALID` 없이 실행된다. 신규 테이블이라 기존 row가 없으므로 문제는 없지만, 일관성 차원에서 constraint를 `CREATE TABLE` 내부에 인라인으로 정의하거나 `NOT VALID` + `VALIDATE CONSTRAINT` 패턴을 유지하는 것이 향후 유사 migration의 패턴 일관성을 높인다.
- 제안: 신규 테이블이므로 당장 위험은 없다. 향후 기존 테이블에 CHECK constraint를 추가할 때는 반드시 `ADD CONSTRAINT ... CHECK (...) NOT VALID` → `VALIDATE CONSTRAINT` 분리 패턴을 사용해 table lock을 방지할 것.

### [INFO] `idx_secret_store_workspace_id` 인덱스 — 적절
- 위치: `V063__secret_store.sql`
- 상세: `workspace_id` 기준 cleanup/조회(`deleteByPrefix`가 LIKE 또는 WHERE workspace_id = ? 로 동작할 경우)에 활용되는 인덱스가 마이그레이션에 포함되어 있다. PK인 `ref`에는 이미 B-tree 인덱스가 자동 생성된다.
- 제안: `deleteByPrefix`가 `WHERE ref LIKE 'secret://triggers/{id}/%'` 형태의 prefix scan을 수행한다면 `ref` PK 인덱스로 커버된다. 추가 인덱스 불필요.

### [WARNING] `promoteRotatedNotificationSecrets` — 반복문 내 개별 쿼리 (잠재적 N+1)
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `promoteRotatedNotificationSecrets()` 메서드
- 상세: grace 만료 trigger 후보를 `getMany()`로 한 번에 가져온 후, 각 trigger에 대해 `secrets.resolve(refV2)` → `secrets.rotate(primaryRef, ...)` → `triggerRepository.save(trigger)` → `secrets.delete(refV2)` 를 순차적으로 호출한다. `SecretResolverService`의 각 메서드는 내부적으로 DB 쿼리를 발생시키므로, N개의 후보에 대해 최소 4N건의 추가 DB 쿼리가 발생한다. 이 메서드가 cron으로 주기적으로 실행되고 후보가 소수(수십 건 이하)라면 실운영 영향은 크지 않다.
- 제안: 단기적으로 현재 구조 유지 가능. 향후 후보 수가 증가할 경우 batch upsert(`triggerRepository.save([...all])`) 와 bulk secret operation 분리를 검토. 현재 규모에서는 MEDIUM 이하 위험도.

### [INFO] 트랜잭션 — secret store 저장과 trigger config 갱신이 별도 트랜잭션
- 위치: `triggers.service.ts` — `setupChatChannel()`, `rotateNotificationSecret()`, `promoteRotatedNotificationSecrets()`
- 상세: `secrets.rotate(ref, workspaceId, plaintext)` (secret_store 테이블 INSERT/UPDATE)와 `triggerRepository.update(...)` (trigger 테이블 UPDATE)가 동일 DB 트랜잭션으로 묶이지 않는다. `secrets.rotate()` 성공 후 `triggerRepository.update()` 실패 시, secret_store에는 새 암호화 값이 저장되었으나 trigger.config에는 구 ref 또는 신 ref가 없는 상태가 될 수 있다. 반대 방향(trigger 갱신 성공, secret 저장 실패)도 가능하다.
- 제안: `setupChatChannel`의 critical path에서는 TypeORM `DataSource.transaction()` 또는 `EntityManager` 트랜잭션으로 두 쓰기를 묶는 것이 이상적이다. 단, `SecretResolverService`가 자체 `Repository`를 주입받아 사용하므로 트랜잭션 전파를 위해 `EntityManager`를 파라미터로 넘기는 패턴이 필요하다. 이는 인터페이스 변경을 수반하므로 후속 plan에서 다루는 것이 현실적이다. 현재 backfill 불요(미배포) 환경에서는 위험도 MEDIUM으로 판단하며, 운영 배포 전에 트랜잭션 원자성 보장이 필요하다.

### [INFO] SQL 인젝션 — 파라미터화된 쿼리 사용, 안전
- 위치: `SecretResolverService`, TypeORM Repository 사용 전반
- 상세: 모든 DB 쿼리가 TypeORM Repository API(`findOne`, `save`, `delete`, `createQueryBuilder` + parameter binding)를 통해 실행된다. raw SQL 문자열 concatenation이 없어 SQL 인젝션 위험 없음.
- 제안: 해당 없음.

### [INFO] `deleteByPrefix` 구현 확인 불가 — diff에 미포함
- 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (파일 38, diff 내용 미제공)
- 상세: `triggers.service.ts`의 `remove()` 에서 `secrets.deleteByPrefix('secret://triggers/{id}/')` 를 호출하는데, 해당 구현이 prefix LIKE 쿼리인지 별도 인덱스를 사용하는지 diff에서 확인되지 않는다. PK(ref TEXT) 기준 B-tree에서 prefix scan은 `WHERE ref LIKE 'secret://triggers/uuid/%'`로 동작하며 index scan 가능(PostgreSQL text collation 기본 설정 기준).
- 제안: `deleteByPrefix`가 `WHERE ref LIKE $1` (파라미터: `prefix%`) 형태로 구현되었는지 확인할 것. collation에 따라 prefix LIKE가 인덱스를 타지 않을 수 있으므로 `EXPLAIN ANALYZE` 검증 권장.

## 요약

이번 변경의 핵심은 `secret_store` 신규 테이블 도입과 기존 plaintext 컬럼들(`botToken`, `secretToken`, `notification.signing.secret`)을 암호화 ref 경로로 전환하는 것이다. 스키마 설계 자체(PK = ref URI TEXT, BYTEA 암호화 컬럼, workspace_id 인덱스, CHECK constraint)는 단순하고 적절하다. 주요 데이터베이스 위험은 두 가지다: (1) `secret_store` 저장과 `trigger` config 갱신이 별도 트랜잭션으로 분리되어 partial write 시나리오에서 정합성 깨질 가능성, (2) FK 미사용으로 인한 application-level cascade 의존 — workspace 삭제 경로에서 `deleteByPrefix` 미호출 시 고아 row 잔류. `promoteRotatedNotificationSecrets`의 N+1 쿼리 패턴은 cron 빈도·후보 규모 고려 시 당장 위험하지 않으나 모니터링이 필요하다. 미배포(production 데이터 없음) 상태이므로 backfill 생략 결정은 타당하다.

## 위험도

MEDIUM
