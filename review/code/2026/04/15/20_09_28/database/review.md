## 데이터베이스 코드 리뷰

### 발견사항

---

**[WARNING] `state` 컬럼 원자적 DELETE+RETURNING 후 만료 확인 순서 비효율**
- 위치: `auth-oauth.service.ts` — `handleCallback()`, raw SQL DELETE
- 상세: `DELETE FROM auth_oauth_state WHERE state = $1 RETURNING *`로 원자 소비는 올바르나, 삭제 후 `expiresAt` 검증이 이루어짐. 만료된 state를 소비해 버리므로 삭제는 성공했지만 에러를 반환하는 상황이 발생함. 이 자체가 치명적 버그는 아니나, `WHERE state = $1 AND expires_at > NOW()`로 변경하면 만료된 row를 소비하지 않고 두 가지 실패 원인을 명확히 구분할 수 있음.
- 제안:
  ```sql
  DELETE FROM auth_oauth_state
  WHERE state = $1 AND expires_at > NOW()
  RETURNING *
  ```
  빈 결과면 `OAUTH_STATE_MISMATCH` 또는 `OAUTH_STATE_EXPIRED` 중 하나로 처리.

---

**[WARNING] `purgeExpired()`의 `void` fire-and-forget — TypeORM Repository vs 원시 SQL 일관성**
- 위치: `auth-oauth.service.ts` — `purgeExpired()`, `beginAuth()` 내 `void this.purgeExpired()`
- 상세: `stateRepository.delete({ expiresAt: LessThan(new Date()) })`는 ORM 기반이나, 소비 쿼리는 원시 SQL(`dataSource.query`). 두 경로가 혼용됨. 고부하 환경에서 purge와 실제 callback DELETE가 동시에 같은 row를 대상으로 할 때 ORM DELETE는 `WHERE expires_at < $1` 조건 없이 실행되므로, 이미 조회된 유효한 state를 삭제할 수 있는 TOCTOU는 없지만, purge 실패 시 로그만 남기고 조용히 진행되는 것은 운영 상 모니터링 사각지대가 될 수 있음.
- 제안: `purgeExpired`를 별도 스케줄러(BullMQ cron)로 분리하거나, 최소한 실패 카운터를 메트릭으로 노출. 현재 구조는 운영 환경에서 state 테이블이 무한히 쌓일 수 있음.

---

**[INFO] `auth_oauth_state` 인덱스 — `state` 컬럼 UNIQUE 인덱스는 충분하나 복합 인덱스 고려**
- 위치: `V013__auth_oauth_state.sql`
- 상세: `state VARCHAR(64) UNIQUE`는 callback DELETE에 충분. `idx_auth_oauth_state_expires` 인덱스는 purge 쿼리(`WHERE expires_at < NOW()`)를 위해 필요하고 올바르게 생성됨. 다만 purge가 ORM에서 `LessThan(new Date())`로 실행될 때 이 인덱스가 실제로 활용되는지는 explain plan으로 확인 권장.
- 제안: 현재 설계로 충분. 다만 purge 쿼리 실행 계획 확인 필요.

---

**[INFO] `resolveUser()` 내 신규 사용자 생성 시 트랜잭션 처리**
- 위치: `auth-oauth.service.ts` — `resolveUser()` 내 `dataSource.transaction()`
- 상세: 신규 사용자의 경우 `usersService.create()` + `workspacesService.createPersonalWorkspace()` 를 트랜잭션으로 묶은 것은 올바름. 그러나 `usersService.create()`가 트랜잭션 매니저를 받지 않고 자체 repository를 사용하므로, 트랜잭션이 롤백되어도 user row가 커밋될 수 있음.
- 제안: `usersService.create()`와 `workspacesService.createPersonalWorkspace()` 모두 EntityManager를 인자로 받아 트랜잭션 컨텍스트를 공유하도록 수정 필요. 이미 이 패턴은 `AuthService.verifyEmail()`에서 사용 중이므로 일관성 확보 필요.

  ```typescript
  return this.dataSource.transaction(async (manager) => {
    const created = await manager.getRepository(User).save(
      manager.getRepository(User).create({ ... })
    );
    await this.workspacesService.createPersonalWorkspace(
      created.id, created.name, created.email, manager
    );
    return created;
  });
  ```

---

**[INFO] `users` 테이블에 `oauth_provider` + `oauth_provider_id` 컬럼 존재 가정**
- 위치: `users.service.ts` — `findByOauth()`, `auth-oauth.service.ts` — `resolveUser()`
- 상세: 코드에서 `oauthProvider`, `oauthProviderId` 필드를 사용하지만, 해당 컬럼을 추가하는 마이그레이션이 이번 변경사항에 포함되지 않음. `V013`은 `auth_oauth_state` 테이블만 생성함.
- 제안: `users` 테이블에 이 컬럼이 기존 마이그레이션에 있는지 확인 필요. 없다면 별도 마이그레이션으로 `oauth_provider VARCHAR(32)`, `oauth_provider_id VARCHAR(255)`, 그리고 `(oauth_provider, oauth_provider_id)` 복합 유니크 인덱스 추가 필요.

---

**[INFO] 마이그레이션 안전성 — 순수 추가(Additive) 변경**
- 위치: `V013__auth_oauth_state.sql`
- 상세: 신규 테이블 생성만 수행하므로 기존 데이터 손실 없음. `uuid_generate_v4()` 사용은 `uuid-ossp` 확장이 활성화된 환경을 가정하며, 이는 기존 테이블에서도 동일하게 사용 중이므로 문제없음. 무중단 배포 안전.

---

### 요약

전반적으로 데이터베이스 설계는 양호함. `auth_oauth_state` 테이블의 원자적 소비 패턴(DELETE ... RETURNING)은 동시성 문제를 올바르게 처리하며, 인덱스도 적절히 구성됨. 주요 위험 요소는 두 가지: (1) `resolveUser()`의 트랜잭션 컨텍스트 미공유로 인한 신규 사용자 생성 부분 롤백 가능성, (2) `purgeExpired()`가 fire-and-forget 방식으로 운영되어 만료 state가 장기간 누적될 수 있는 점. 또한 `users` 테이블의 OAuth 관련 컬럼 마이그레이션 누락 여부를 반드시 확인해야 함.

### 위험도
**MEDIUM**