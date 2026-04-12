### 발견사항

---

**[CRITICAL] `IntegrationUsageLog` 인덱스 방향 불일치**
- 위치: `integration-usage-log.entity.ts` vs `V008__integration_usage_log_and_metadata.sql`
- 상세: SQL 마이그레이션에서는 `(integration_id, at DESC)` 내림차순 인덱스를 생성하지만, TypeORM 엔티티의 `@Index` 데코레이터는 방향을 지정하지 않아 기본값인 ASC로 생성됩니다. 활동 로그 조회는 최신 순 정렬(`at DESC`)이 주된 패턴이므로, 엔티티가 마이그레이션 DDL과 실제로 다른 인덱스를 생성합니다. TypeORM `synchronize`나 스키마 검증 도구 사용 시 불일치가 발생합니다.
- 제안: 엔티티에서 인덱스를 제거하고 마이그레이션 DDL만 신뢰하거나, 엔티티 인덱스에도 `{ order: "DESC" }` 옵션을 명시하세요.

---

**[CRITICAL] `integration-expiry-scanner.service.ts` N+1 알림 저장**
- 위치: `integration-expiry-scanner.service.ts` `run()` 메서드 내부 루프
- 상세: `for (const userId of recipients)` 루프 안에서 `notificationRepository.save(notification)`를 개별 호출합니다. 만료 임박 인테그레이션이 10개이고, 각각 organization 스코프에 admin이 10명이라면 100회의 개별 INSERT가 발생합니다. 스캐너는 배치 작업이므로 평상시엔 부담이 적지만, 대규모 워크스페이스에서 토큰 만료가 집중될 경우 성능 문제가 생깁니다.
- 제안: `notificationRepository.save(notifications)` 배열 형태로 일괄 저장하거나, `notificationRepository.insert(notificationEntities)`를 사용하세요.

```typescript
const notifications = recipients.map((userId) =>
  this.notificationRepository.create({ ..., userId })
);
await this.notificationRepository.save(notifications);
created += notifications.length;
```

---

**[WARNING] `integration-oauth.service.ts` `purgeExpired()` 트랜잭션 미사용**
- 위치: `integration-oauth.service.ts` `handleCallback()` → `finally` 블록
- 상세: `handleCallback` 내에서 preview/integration 저장과 state 삭제가 트랜잭션 없이 실행됩니다. `previewRepository.save()` 성공 후 `stateRepository.delete()` 실패 시 동일한 state로 재시도가 가능해져 preview 토큰이 중복 생성될 수 있습니다. 반대로 integration 업데이트 성공 후 state 삭제 실패 시 reauthorize가 재실행될 수 있습니다.
- 제안: DataSource를 주입받아 `queryRunner.startTransaction()` / `commitTransaction()` / `rollbackTransaction()`으로 원자성을 보장하세요.

---

**[WARNING] `V008` 마이그레이션 — `UNIQUE` 제약 추가 시 기존 데이터 검증 없음**
- 위치: `V008__integration_usage_log_and_metadata.sql`
- 상세: `ALTER TABLE integration ADD CONSTRAINT integration_workspace_name_unique UNIQUE (workspace_id, name)` 실행 시, 기존 데이터에 `(workspace_id, name)` 중복이 존재하면 마이그레이션이 **즉시 실패**합니다. 프로덕션 DB에서 이미 같은 이름의 인테그레이션이 있다면 배포가 중단됩니다.
- 제안: 마이그레이션 전 중복 데이터를 정리하는 쿼리를 앞에 추가하거나, 적어도 사전 확인 쿼리를 주석으로 포함하세요:
```sql
-- 사전 확인: SELECT workspace_id, name, COUNT(*) FROM integration GROUP BY 1,2 HAVING COUNT(*) > 1;
```

---

**[WARNING] `V008` 마이그레이션 — `auth_type` CHECK 제약 DROP 후 ADD가 단일 트랜잭션 미보장**
- 위치: `V008__integration_usage_log_and_metadata.sql`
- 상세: Flyway는 PostgreSQL DDL을 트랜잭션으로 감싸지만, `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` 사이에 다른 트랜잭션이 잘못된 `auth_type`을 INSERT할 수 있는 매우 짧은 순간이 존재합니다. 더 중요하게는, 기존 데이터 중 새 CHECK 제약에 위반되는 `auth_type` 값(`api-key`, `oauth` 등 비표준 값)이 있다면 ADD CONSTRAINT가 실패합니다.
- 제안: 마이그레이션 스크립트 상단에 기존 데이터의 `auth_type` 값 목록 확인 쿼리를 주석으로 명시하세요.

---

**[WARNING] `IntegrationExpiryDispatch` — FK 없는 `integrationId`**
- 위치: `integration-expiry-dispatch.entity.ts`
- 상세: SQL DDL(`V009`)에서는 `integration_id` 컬럼에 `REFERENCES integration(id) ON DELETE CASCADE`가 있지만, TypeORM 엔티티에는 `@ManyToOne` 관계 데코레이터가 없고 단순 `@Column`으로만 선언되어 있습니다. `IntegrationOAuthState`, `IntegrationOAuthPreview`도 동일합니다. TypeORM이 엔티티로 스키마를 관리할 경우 FK가 누락됩니다.
- 제안: 엔티티에 `@ManyToOne(() => Integration, { onDelete: 'CASCADE' })` + `@JoinColumn`을 추가하거나, Flyway 마이그레이션만으로 스키마를 관리하고 TypeORM `synchronize: false`를 명시하세요.

---

**[WARNING] `integration_usage_log` — `node_execution_id` FK로 인한 삭제 제약**
- 위치: `V008__integration_usage_log_and_metadata.sql`
- 상세: `node_execution_id UUID NOT NULL REFERENCES node_execution(id) ON DELETE CASCADE`로 선언되어 있습니다. node_execution 레코드 삭제 시 usage_log도 cascade 삭제됩니다. 인테그레이션 감사(audit) 목적으로 usage_log를 보존해야 한다면 이 cascade는 의도치 않은 데이터 손실을 초래합니다.
- 제안: audit log 성격이라면 `ON DELETE SET NULL`이나 FK 제거 후 소프트 참조로 변경을 검토하세요.

---

**[WARNING] `IntegrationExpiryScannerService` — 후보 쿼리에 `tokenExpiresAt IS NULL` 인테그레이션 포함 가능성**
- 위치: `integration-expiry-scanner.service.ts` `run()` 메서드
- 상세: `integrationRepository.find({ where: { status: Not('error'), tokenExpiresAt: LessThanOrEqual(horizon) } })`는 TypeORM에서 `tokenExpiresAt IS NULL` 레코드를 제외하지만, PostgreSQL에서 NULL은 어떤 비교와도 false이므로 올바르게 동작합니다. 그러나 루프 내 `if (!integration.tokenExpiresAt) continue;` 방어 코드가 있어 이중 처리됩니다. 이는 코드 중복이지만 실제 위험은 없습니다.
- 제안: DB 쿼리에서 이미 필터링되므로 `if (!integration.tokenExpiresAt) continue;` 라인은 제거하거나, 의도를 명시하는 주석을 추가하세요.

---

**[INFO] `purgeExpired()` 호출 — `begin()` 마다 DELETE 실행**
- 위치: `integration-oauth.service.ts` `begin()` → `await this.purgeExpired()`
- 상세: OAuth 흐름 시작마다 `integration_oauth_state`와 `integration_oauth_preview` 테이블 전체를 스캔하는 DELETE를 실행합니다. 트래픽이 높은 환경에서 잦은 full-scan DELETE는 테이블 bloat과 락 경합을 일으킬 수 있습니다.
- 제안: `idx_integration_oauth_state_expires`, `idx_integration_oauth_preview_expires` 인덱스가 존재하므로 현재는 인덱스 스캔으로 동작합니다. 다만, 주기적인 배치 정리(예: 별도 cron)로 분리하는 것이 더 안전합니다.

---

**[INFO] `V009` 마이그레이션 — `integration_oauth_state.expires_at` 인덱스만으로 충분한지**
- 위치: `V009__integration_oauth_and_expiry.sql`
- 상세: `findOne({ where: { state: query.state } })` 패턴이 자주 사용되는데, `state VARCHAR(64) NOT NULL UNIQUE` 제약으로 이미 유니크 인덱스가 생성됩니다. 별도 인덱스는 불필요하며 현재 구현이 올바릅니다. (정보성)

---

### 요약

마이그레이션과 엔티티 설계의 전반적인 품질은 양호합니다. SQL DDL은 적절한 인덱스, FK, CHECK 제약을 갖추고 있습니다. 그러나 **세 가지 주요 위험**이 있습니다: (1) `V008`의 UNIQUE 제약 추가가 기존 중복 데이터로 인해 프로덕션 마이그레이션을 중단시킬 수 있고, (2) OAuth 콜백 핸들러에 트랜잭션이 없어 preview 저장 후 state 삭제 실패 시 데이터 불일치가 발생할 수 있으며, (3) 만료 스캐너가 알림을 N+1 패턴으로 저장합니다. 또한 TypeORM 엔티티와 SQL 마이그레이션 간 FK 선언 불일치(`IntegrationExpiryDispatch`, `IntegrationOAuthState`, `IntegrationOAuthPreview`)가 스키마 관리 방식 혼용 시 드리프트를 유발할 수 있으므로, Flyway 전용 스키마 관리 정책을 명확히 해야 합니다.

### 위험도
**HIGH**