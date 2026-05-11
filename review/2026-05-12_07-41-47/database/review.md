## 발견사항

- **[WARNING]** `CREATE INDEX` (non-CONCURRENT) on existing `refresh_token` table
  - 위치: `V040__auth_session_metadata_and_login_history.sql`, L22-24
  - 상세: PostgreSQL에서 일반 `CREATE INDEX`는 `ShareLock`을 획득해 인덱스 빌드 중 **쓰기를 차단**합니다. 마이그레이션 주석에서 `login_history`에 대해서만 무중단을 언급했지만, 기존 `refresh_token` 테이블의 인덱스도 동일 문제가 있습니다. 운영 중 `refresh_token` 테이블에 트래픽이 있다면 짧더라도 쓰기 블로킹이 발생합니다.
  - 제안: `CREATE INDEX CONCURRENTLY`를 사용하되, Flyway는 기본적으로 트랜잭션 내에서 실행하므로 해당 마이그레이션 파일을 `@(not transactional)` 모드로 분리하거나, 별도 `V040b` 마이그레이션으로 인덱스 생성을 분리하세요.

- **[WARNING]** `pruneOlderThanRetention` — `created_at` 단독 인덱스 부재
  - 위치: `login-history.service.ts`, `pruneOlderThanRetention()`
  - 상세: `DELETE WHERE created_at < cutoff` 쿼리가 실행될 때, 기존 인덱스 `(user_id, created_at DESC)` 와 `(email, created_at DESC)` 는 첫 번째 컬럼이 바인딩되지 않으면 range scan에 비효율적입니다. 테이블이 커지면 Sequential Scan으로 빠질 가능성이 높고, 대량 DELETE는 WAL 부하와 테이블 bloat을 유발합니다.
  - 제안: `login_history(created_at)` 단독 인덱스를 추가하거나, 배치 크기를 제한하는 청크 삭제로 전환하세요:
    ```sql
    -- 인덱스 추가
    CREATE INDEX idx_login_history_created ON login_history (created_at);
    ```

- **[WARNING]** 커서 페이지네이션 — `created_at` 단독 커서 충돌 가능성
  - 위치: `login-history.service.ts`, `findForUser()` / `sessions.controller.ts`, `getLoginHistory()`
  - 상세: `created_at < :cursor` 커서는 동일 밀리초에 여러 이벤트가 기록될 경우(예: 빠른 연속 실패 루프, 배치 import) 페이지 경계에서 행이 누락되거나 중복될 수 있습니다.
  - 제안: 커서를 `(created_at, id)` 복합으로 변경하세요:
    ```typescript
    .andWhere(
      '(lh.created_at < :cursorDate OR (lh.created_at = :cursorDate AND lh.id < :cursorId))',
      { cursorDate, cursorId }
    )
    ```

- **[INFO]** 부분 인덱스가 `expiresAt` 필터를 커버하지 않음
  - 위치: `sessions.service.ts`, `listActiveSessions()` / `V040` 인덱스
  - 상세: `listActiveSessions`는 `{ isRevoked: false, expiresAt: MoreThan(new Date()) }` 로 조회하지만 부분 인덱스 `(user_id, family_id) WHERE is_revoked = FALSE`는 만료된 토큰(revoked=false && expired=true)을 포함합니다. 대부분의 만료 토큰이 revoke 처리된다면 실질 오차는 작지만, `expiresAt`이 인덱스 조건에 없으므로 post-index 필터로 처리됩니다.
  - 제안: 현재 규모에서는 허용 가능하나, 이후 `expiresAt`를 인덱스에 포함하거나 만료 토큰 자동 정리 잡을 추가하면 인덱스 효율이 개선됩니다.

- **[INFO]** `revokeFamily` — 비관적 잠금 없는 체크-업데이트 패턴
  - 위치: `sessions.service.ts`, `revokeFamily()`
  - 상세: `findOne({ where: { userId, familyId } })` → `verifyReauth()` → `update(...)` 사이에 동일 family에 대한 동시 revoke 요청이 들어오면 두 요청 모두 성공합니다. 이중 revoke는 idempotent하므로 데이터 정합성 문제는 없지만, `loginHistory.record`가 두 번 호출될 수 있습니다.
  - 제안: 현재 규모에서는 수용 가능. 엄격함이 필요하면 `SELECT ... FOR UPDATE` 또는 `update`의 반환 `affected` 값을 확인하세요.

---

### 요약

마이그레이션 설계는 전반적으로 안전합니다. PostgreSQL 11+에서 nullable 컬럼 추가는 메타데이터만 변경하므로 무중단이고, `login_history` 신규 테이블 생성도 문제없습니다. 주요 리스크는 두 가지입니다: 기존 `refresh_token` 테이블의 일반 `CREATE INDEX`가 쓰기를 블로킹할 수 있다는 점, 그리고 180일 주기 정리 DELETE가 커질수록 `created_at` 단독 인덱스 없이는 성능 저하가 예상된다는 점입니다. 커서 페이지네이션의 타임스탬프 충돌 가능성은 인증 이벤트의 낮은 쓰기 빈도를 고려할 때 현실적 위험은 낮지만, 방어적으로 복합 커서를 권장합니다.

### 위험도
**MEDIUM**