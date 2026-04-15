## 발견사항

- **[CRITICAL]** `resolveUser` 내 TOCTOU(Time-of-Check-Time-of-Use) 경쟁 조건
  - 위치: `auth-oauth.service.ts` — `resolveUser` 메서드
  - 상세: `findByOauth` → `findByEmail` → `create` 순서의 check-then-act 패턴이 트랜잭션 경계 밖에서 수행됩니다. 동일한 신규 이메일에 대해 두 개의 OAuth 콜백이 거의 동시에 도달하면 (예: 사용자가 버튼을 빠르게 중복 클릭하거나 브라우저가 중복 요청을 보낸 경우) 두 요청 모두 `findByOauth` → null, `findByEmail` → null을 통과한 뒤 각각 `dataSource.transaction` 블록에 진입하여 중복 User 레코드를 생성할 수 있습니다. `dataSource.transaction` 은 `create + createPersonalWorkspace` 간 원자성만 보장할 뿐, 사전 조회와 생성 간의 경쟁을 막지 못합니다.
  - 제안: PostgreSQL의 `INSERT ... ON CONFLICT DO NOTHING / DO UPDATE` 패턴 또는 users 테이블의 `(oauth_provider, oauth_provider_id)` 복합 유니크 제약 + 제약 위반 예외 핸들링으로 해결합니다. 또는 전체 resolveUser 로직을 `SERIALIZABLE` 격리 수준 트랜잭션 내에서 수행하거나, Redis 기반 분산 락으로 같은 providerId에 대한 동시 진입을 직렬화하는 방법도 있습니다.

---

- **[WARNING]** `byEmail` 경로에서의 update도 동일 TOCTOU 노출
  - 위치: `auth-oauth.service.ts` — `resolveUser` 내 `byEmail` 분기
  - 상세: 서로 다른 provider(예: Google, GitHub)가 동일 이메일을 반환하면서 두 OAuth 콜백이 동시에 진행될 경우, 둘 다 `findByEmail`로 동일 사용자를 찾고 각각 `update`를 호출합니다. Read Committed 격리 수준에서는 마지막 write가 이기는 last-write-wins 경쟁이 발생하여 `oauthProvider` / `oauthProviderId`가 예기치 않게 덮어쓰일 수 있습니다.
  - 제안: `UPDATE users SET oauth_provider = $1, oauth_provider_id = $2 WHERE id = $3 AND oauth_provider IS NULL` 처럼 조건부 업데이트를 사용하거나, optimistic locking(`@VersionColumn`)을 적용해 충돌을 감지하고 재시도합니다.

---

- **[INFO]** `void this.purgeExpired()` — fire-and-forget 정리 작업
  - 위치: `auth-oauth.service.ts` — `beginAuth` 메서드
  - 상세: 모든 `beginAuth` 호출마다 별도의 정리 쿼리를 비동기 실행합니다. 동시 요청이 많을 경우 불필요한 DB 부하가 발생할 수 있으나 안전성 문제는 없습니다.
  - 제안: 백그라운드 스케줄러(cron) 또는 마지막 실행 시각을 인메모리에 캐시하여 일정 간격 이상일 때만 정리 쿼리를 실행하도록 제한합니다.

---

- **[INFO]** atomic DELETE-RETURNING 패턴 — 올바르게 구현됨
  - 위치: `auth-oauth.service.ts` — `handleCallback` 메서드
  - 상세: `DELETE FROM auth_oauth_state WHERE state = $1 RETURNING *` 는 PostgreSQL 수준에서 원자적으로 상태를 소비합니다. 동일 state로 두 개의 콜백이 동시에 도달해도 정확히 하나만 성공하므로 CSRF replay 방어가 올바르게 작동합니다.

---

## 요약

이번 변경의 핵심 동시성 설계(OAuth state의 atomic DELETE-RETURNING)는 올바르게 구현되어 있어 state replay 공격을 안전하게 차단합니다. 그러나 `resolveUser` 메서드의 사용자 조회–생성 경로가 트랜잭션 경계 밖에서 수행되어 신규 사용자의 중복 생성이라는 심각한 TOCTOU 경쟁 조건을 내포하고 있습니다. 실제 서비스 트래픽이나 악의적인 중복 요청 환경에서 같은 이메일/provider ID를 가진 중복 User 및 Workspace 레코드가 생성될 수 있으며, 이는 데이터 정합성 문제로 이어집니다. DB 수준 유니크 제약과 충돌 처리 로직을 추가하는 것이 가장 간단하고 효과적인 해결책입니다.

## 위험도

**HIGH**