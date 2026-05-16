# Cafe24 Database Review (2026-05-16)

---

## Critical (데이터 손상 / 안전하지 않은 마이그레이션)

없음. 마이그레이션 안전성과 트랜잭션 원자성은 전반적으로 양호하다.

---

## High (성능 / 인덱스 누락)

### [HIGH] 백그라운드 갱신 쿼리 — 복합 인덱스 부재

- **위치**: `integration-expiry-scanner.service.ts` `enqueueCafe24BackgroundRefresh()` (L181-188)
- **상세**: `find({ where: { serviceType: 'cafe24', status: 'connected', lastRotatedAt: LessThan(cutoff) } })` 쿼리는 세 컬럼 조건을 AND로 결합한다. 현재 존재하는 인덱스는 `idx_integration_workspace_status (workspace_id, status)`, `idx_integration_workspace_service (workspace_id, service_type)`, `idx_integration_token_expires_at (token_expires_at WHERE NOT NULL)` 이며, `(service_type, status, last_rotated_at)` 조합을 직접 지원하는 인덱스가 없다. 통합 row 수가 증가하면 PostgreSQL이 `idx_integration_workspace_status`의 부분 스캔 또는 seq scan으로 떨어져 일일 배치 잡이 느려질 수 있다. 이 잡은 24시간마다 한 번이지만 대규모 환경에서 scan 비용이 불필요하게 높다.
- **제안**: 부분 인덱스 추가 (V049):
  ```sql
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_cafe24_connected_rotated
    ON integration (last_rotated_at)
    WHERE service_type = 'cafe24' AND status = 'connected';
  ```
  이 partial index는 cafe24+connected 행만 인덱싱해 크기가 작고, `last_rotated_at < cutoff` 범위 스캔에 직접 사용된다.

### [HIGH] `createPrivatePendingIntegration` — workspaceId+serviceType 조회 후 in-memory 필터

- **위치**: `integration-oauth.service.ts` `createPrivatePendingIntegration()` (L1010-1025)
- **상세**: `find({ where: { workspaceId, serviceType: 'cafe24' } })`로 workspace 내 **모든** cafe24 row를 가져온 뒤 `mall_id` 비교를 in-memory로 수행한다. V045/V046으로 `mall_id` plain 컬럼과 partial unique index가 생겼으므로, DB 레벨에서 `{ workspaceId, serviceType: 'cafe24', mallId: meta.mall_id }` 조건으로 단일 row 조회가 가능하다. 현재 코드는 코드 주석에서 직접 "pre-V045 행의 NULL fallback" 때문에 in-memory 비교가 필요하다고 설명하고 있는데, 실제로는 connected 행에 대한 23505 race 방어를 SQL unique index가 담당하고 있어 in-memory full-fetch의 필요성이 줄었다. workspace당 cafe24 통합이 많아지면 불필요한 I/O가 발생한다.
- **제안**: `mall_id IS NOT NULL` 인 행은 `find({ where: { workspaceId, serviceType: 'cafe24', mallId: meta.mall_id } })`로 직접 조회하고, pre-V045 NULL fallback은 `mall_id IS NULL` 인 행에 대해서만 별도 처리(또는 backfill 완료 후 단계적 제거)하는 방향으로 리팩토링을 검토한다.

---

## Medium

### [WARNING] `expirePendingInstalls` bulk UPDATE — status 컬럼 인덱스 활용 확인 필요

- **위치**: `integration-expiry-scanner.service.ts` `expirePendingInstalls()` (L254-266)
- **상세**: `WHERE status = 'pending_install' AND COALESCE(install_token_issued_at, created_at) < :cutoff`. `status` 필터는 `idx_integration_workspace_status (workspace_id, status)` 인덱스로 커버되지 않는다(workspace_id가 없기 때문). 테이블 전체를 대상으로 하는 `status = 'pending_install'` 필터는 PostgreSQL이 seq scan 또는 idx_integration_workspace_status의 index only scan을 선택할 수 있다. `COALESCE(install_token_issued_at, created_at)` 표현식은 인덱스가 없어 추가 필터 비용이 발생한다. `pending_install` 행이 소수인 일반 운영 환경에서는 문제없으나, 대규모 배포 시 `(status) WHERE status = 'pending_install'`이나 `install_token_issued_at`에 부분 인덱스를 고려할 수 있다.
- **제안**: 즉각적인 대응은 불필요하나, 이슈 추적 차원에서 `(status, COALESCE(install_token_issued_at, created_at))` 함수 인덱스 또는 `install_token_issued_at` 단독 partial index(`WHERE status = 'pending_install'`)를 후속 마이그레이션으로 추가하는 것을 검토한다.

### [WARNING] `run()` 내 `userRepository.find({ where: { id: In(recipients) } })` — 루프 내 개별 쿼리

- **위치**: `integration-expiry-scanner.service.ts` `run()` (L320-328)
- **상세**: `candidates` 배열을 순회하며 각 통합에 대해 `resolveRecipients` → `userRepository.find(In(recipients))` 를 개별 호출한다. 만료 대상 통합이 N개면 최대 N번의 DB 쿼리가 발생한다(organization scope일 경우 `findAdminUserIds`도 추가). 일일 배치 실행이므로 실시간 영향은 없지만, 대규모 환경에서는 스캔이 느려질 수 있다.
- **제안**: `candidates` 에서 `workspaceId` 집합을 먼저 구하고 관련 user를 일괄 로드한 뒤 메모리에서 매핑하는 방식으로 최적화한다(N+1 → 1+1 또는 2 쿼리). 다만 배치 잡이므로 즉각적인 위험도는 낮다.

### [WARNING] `refreshAccessToken` 트랜잭션 내 `findOne` — SELECT FOR UPDATE 부재

- **위치**: `cafe24-api.client.ts` `refreshAccessToken()` (L470-497)
- **상세**: `dataSource.transaction(async (manager) => { ... findOne ... save })` 패턴에서 `findOne`에 `lock: { mode: 'pessimistic_write' }` 옵션이 없다. BullMQ `jobId = integrationId` dedup이 클러스터 수준의 직렬화를 담당하므로 정상 경로에서는 두 워커가 동시에 같은 row에 들어오지 않는다. 그러나 BullMQ Redis 연결 중단 또는 worker 재시작으로 dedup이 일시적으로 무효화되면 두 트랜잭션이 동시에 `findOne`을 통과해 last-write-wins로 한 쪽 refresh_token이 덮여쓸 수 있다. 코드 주석에서 BullMQ dedup 의존을 명시하고 있어 설계 의도는 이해되지만, DB 레벨 row lock 부재는 방어층이 하나임을 의미한다.
- **제안**: `findOne` 호출에 `{ lock: { mode: 'pessimistic_write' } }` 추가를 검토한다. PostgreSQL의 `SELECT ... FOR UPDATE`는 동일 row에 대한 두 번째 트랜잭션을 첫 번째가 커밋될 때까지 대기시키므로, BullMQ dedup이 실패하는 엣지 케이스에서도 double-refresh를 방지한다.

### [WARNING] `handleInstall` 에서 `tryRecoverByMallId` — mallId 인덱스 사용 확인

- **위치**: `integration-oauth.service.ts` `tryRecoverByMallId()` (L1318-1321)
- **상세**: `find({ where: { mallId: query.mall_id, serviceType: 'cafe24' } })`. `mall_id` plain 컬럼에 대한 단독 인덱스가 없다. V046 partial unique index `idx_integration_cafe24_workspace_mall (workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL`은 선두 컬럼이 `workspace_id`여서 `workspace_id` 없이 `mall_id`만으로 조회하는 이 쿼리에서 index skip scan이 불가능한 PostgreSQL 버전에서는 활용되지 않을 수 있다. 이 경로는 실패 복구 경로이므로 빈도가 낮아 실제 운영 영향은 제한적이지만, mall_id가 인덱스로 직접 커버되지 않는다.
- **제안**: `(mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 또는 `(service_type, mall_id)` 인덱스 추가를 고려한다. 혹은 tryRecoverByMallId가 내부 복구 경로임을 감안해 낮은 우선순위로 추적한다.

### [WARNING] `create()` — Cafe24 OAuth 첫 연동 시 `lastRotatedAt` 미설정

- **위치**: `integrations.service.ts` `create()` (L281-291)
- **상세**: OAuth 'new' 모드 완료 후 `consumePreviewToken` → `create()`로 실제 Integration row가 생성된다. 이 경로에서 `lastRotatedAt`이 명시적으로 설정되지 않아 `NULL`로 저장된다. 백그라운드 갱신 스캐너는 `lastRotatedAt < cutoff`를 조건으로 사용하므로, `lastRotatedAt IS NULL`인 행은 이 조건에 **포함되지 않는다** (SQL에서 `NULL < value`는 NULL, 즉 false). 처음 연결한 Cafe24 통합은 첫 proactive refresh가 일어나기 전까지 백그라운드 갱신 스캐너에 의해 10일 후 자동 갱신되지 않아, refresh_token이 14일 후 만료될 위험이 있다.
- **제안**: `create()` 에서 `lastRotatedAt: new Date()`를 설정한다. 또는 백그라운드 갱신 스캐너의 쿼리 조건을 `lastRotatedAt IS NULL OR lastRotatedAt < cutoff`로 확장해 NULL 행도 갱신 대상에 포함한다.

---

## Info

### [INFO] `markAuthFailed` — 트랜잭션 없이 `integrationRepository.update()` 직접 호출

- **위치**: `cafe24-api.client.ts` `markAuthFailed()` (L522-540)
- **상세**: `dataSource.transaction` 바깥에서 `integrationRepository.update(id, { status, statusReason, lastError })` 를 직접 호출한다. 이는 의도적인 설계로, auth 실패를 최대한 빨리 기록하기 위해 별도 트랜잭션 없이 단일 UPDATE를 실행한다. 동시성 문제는 없으나, 해당 UPDATE와 caller의 후속 예외 처리 사이에 inconsistency가 발생할 가능성(예: markAuthFailed 성공 후 caller가 추가 상태를 재설정)은 이론적으로 존재한다. 현재 코드에서는 해당 흐름이 없어 실제 위험은 없다.
- **제안**: 현재 구현 유지. 단, 향후 markAuthFailed 이후 추가 상태 변경을 도입할 경우 트랜잭션 여부를 재검토한다.

### [INFO] `normalizeRawStateRow` / `normalizeRawPreviewRow` — raw DELETE 경로 일관성

- **위치**: `integration-oauth.service.ts` (L214-286)
- **상세**: `handleCallback`의 state 소비와 `consumePreviewToken`의 preview 소비 양쪽 모두 `normalizeRaw*Row`를 통해 decryptJson을 명시 호출한다. 다른 raw query 경로는 없어 누락 없이 일관되게 적용되고 있다.
- **제안**: 현재 구현 유지. 향후 raw SQL DELETE…RETURNING 경로를 추가할 경우 동일 패턴 적용을 컨벤션으로 문서화한다.

### [INFO] `purgeExpired` — fire-and-forget void 패턴

- **위치**: `integration-oauth.service.ts` `begin()` (L393)
- **상세**: `void this.purgeExpired()`로 만료 레코드 정리를 비동기 실행한다. 실패 시 경고 로그만 남기고 요청 흐름에는 영향이 없는 의도적 설계다. expires_at 인덱스 (`idx_integration_oauth_state_expires`, `idx_integration_oauth_preview_expires`)가 있어 성능 우려는 없다.
- **제안**: 현재 구현 유지.

### [INFO] `IntegrationExpiryDispatch` UNIQUE 제약 — insert-dedup 패턴

- **위치**: `integration-expiry-scanner.service.ts` `claimThreshold()` (L375-391)
- **상세**: `insert` 후 PG 23505 catch로 idempotent claim을 구현한다. `@Unique('integration_expiry_dispatch_key', ['integrationId', 'threshold', 'tokenExpiresAt'])` 제약이 DB 레벨에서 중복을 방지한다. 정확한 패턴이나, `INSERT ON CONFLICT DO NOTHING RETURNING`으로 변경하면 예외 비용을 줄일 수 있다(정상 케이스에서 예외를 발생시키지 않음).
- **제안**: 현재 구현 유지 또는 `INSERT ... ON CONFLICT DO NOTHING` 방식으로 교체 검토.

---

## 종합 의견

Cafe24 통합의 데이터베이스 레이어는 전반적으로 잘 설계되어 있다. V043~V046 마이그레이션은 모두 `CREATE INDEX CONCURRENTLY`를 적절히 활용해 무중단 배포를 보장하며, `.conf` 파일로 Flyway 비트랜잭션 모드를 명시한 점도 바람직하다. DELETE…RETURNING 패턴의 일관된 적용, 23505 catch를 통한 UPSERT 패턴, BullMQ jobId dedup에 의한 클러스터 수준 직렬화 등 동시성 제어 설계도 견고하다. 주요 개선 사항은 두 가지다: (1) 백그라운드 갱신 스캐너 쿼리 `(service_type='cafe24', status='connected', last_rotated_at)` 에 partial index가 없어 테이블이 커지면 full scan으로 떨어질 수 있고, (2) OAuth 'new' 모드로 처음 생성되는 Cafe24 통합 row의 `last_rotated_at`이 NULL로 남아 백그라운드 갱신 스캐너의 `LessThan(cutoff)` 조건에서 제외되어 최초 proactive refresh 전까지 14일 만료 리스크에 노출된다.

---

## 위험도

MEDIUM
