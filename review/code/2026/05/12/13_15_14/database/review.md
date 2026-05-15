### 발견사항

- **[WARNING]** `invite()` 메서드의 TOCTOU(Time-of-Check-Time-of-Use) 경쟁 조건
  - 위치: `workspace-invitations.service.ts` — `findOne({ where: { acceptedAt: null } })` → `save(pending)` 흐름
  - 상세: 동일 이메일에 대한 pending 초대 존재 여부를 읽은 뒤 트랜잭션 없이 INSERT/UPDATE를 수행합니다. 동시에 두 요청이 모두 `pending = null`을 읽으면 두 INSERT가 경쟁하고, `idx_workspace_invitation_pending_unique` partial UNIQUE 인덱스 위반으로 하나가 처리되지 않은 DB 레벨 예외(`QueryFailedError`)를 던집니다. 애플리케이션은 이를 잡지 않으므로 500으로 노출될 수 있습니다.
  - 제안: `invite()` 전체(pending 조회 → 저장)를 `dataSource.transaction()`으로 감싸거나, `ON CONFLICT (workspaceId, email) WHERE accepted_at IS NULL DO UPDATE` upsert 구문으로 단일 원자적 연산으로 처리하세요.

- **[WARNING]** `token` 컬럼 인덱스 확인 필요
  - 위치: `workspace-invitations.service.ts` — `getMetaByToken()`, `accept()`, `consumeForRegistration()`
  - 상세: 세 개의 퍼블릭/고빈도 경로 모두 `findOne({ where: { token } })`으로 토큰을 직접 조회합니다. 변경 코드에서 토큰 형식이 `randomBytes(24).toString('hex')` (hex 48자)에서 `randomBytes(48).toString('base64url')` (64자)로 바뀌었는데, 마이그레이션에서 `token` 컬럼에 UNIQUE 또는 최소 B-Tree 인덱스가 보장되는지 확인이 필요합니다. 없으면 초대 수락·메타 조회 경로가 full table scan이 됩니다.
  - 제안: 마이그레이션에서 `CREATE UNIQUE INDEX ... ON workspace_invitation(token)` 확인 또는 추가하세요.

- **[INFO]** `applyAccept()` QueryBuilder에서 `() => 'NOW()'` raw SQL 사용
  - 위치: `workspace-invitations.service.ts` — `applyAccept()` 내 `.set({ acceptedAt: () => 'NOW()' })`
  - 상세: TypeORM은 `set()`의 함수값을 raw SQL로 삽입합니다. `'NOW()'`는 하드코딩된 상수이므로 인젝션 위험은 없고, `WHERE id = :id AND accepted_at IS NULL` 조건도 바인딩 파라미터를 사용합니다. 그러나 이 패턴은 PostgreSQL 외 DB(예: SQLite)에서 `NOW()`가 지원되지 않을 수 있습니다. 현재 PostgreSQL 전용으로 운용 중이라면 무해합니다.
  - 제안: 테스트 환경이 PostgreSQL이 아닌 경우 `CURRENT_TIMESTAMP`로 교체하거나 앱 레벨(`new Date()`)로 통일하세요.

- **[INFO]** `registerWithInvitation()` — 트랜잭션 커밋 후 `generateTokens()` 실패 시 사용자 orphan
  - 위치: `auth.service.ts` — `registerWithInvitation()` 내 트랜잭션 종료 후 `generateTokens()` 호출
  - 상세: 사용자 생성·초대 소비는 한 트랜잭션으로 잘 보호되어 있습니다. 하지만 커밋 이후 `generateTokens()`가 실패하면(예: refresh token INSERT 실패) 사용자 row는 존재하지만 클라이언트는 토큰을 받지 못합니다. 이 경우 사용자는 비밀번호 재설정 흐름으로만 복구할 수 있습니다.
  - 제안: `generateTokens()` 실패 시 사용자에게 명확한 에러 메시지를 반환하고, 필요 시 로그인 재시도 안내를 추가하세요. 구조적 해결이 필요하다면 refresh token 저장까지 동일 트랜잭션에 포함하는 방안을 검토하세요.

- **[INFO]** `resolveTokenWorkspaceContext()` — 최대 3회 순차 DB 쿼리
  - 위치: `auth.service.ts` — `resolveTokenWorkspaceContext()`
  - 상세: 개인 워크스페이스 없음 + 멤버십도 없는 냉시동 사용자의 경우 `findPersonalWorkspace` → `listForUser` → `findOrCreatePersonalWorkspace` 순서로 3회 순차 쿼리가 발생합니다. 초대 흐름 사용자는 2회입니다. 로그인 빈도가 높은 경우 누적 레이턴시가 될 수 있지만 현 규모에서는 허용 범위입니다.
  - 제안: 중·장기적으로 `users` 테이블에 `defaultWorkspaceId` 컬럼을 두어 단일 조회로 단축하는 방안을 고려하세요.

---

### 요약

가장 중요한 데이터베이스 이슈는 `invite()` 메서드의 TOCTOU 경쟁 조건입니다. `partial UNIQUE` 인덱스(`idx_workspace_invitation_pending_unique`)가 데이터 정합성은 보장하지만, 동시 요청 시 애플리케이션이 제약 위반 예외를 처리하지 않아 500 에러로 노출될 수 있습니다. `accept()`·`consumeForRegistration()`의 트랜잭션 설계(`WHERE accepted_at IS NULL` 원자적 UPDATE로 동시 수락 처리)는 올바르게 구현되어 있으며, 초대 토큰 기반 회원가입도 사용자 생성과 초대 소비를 단일 트랜잭션으로 묶어 롤백 안전성을 확보한 점은 양호합니다. `token` 컬럼 인덱스 존재 여부를 마이그레이션에서 반드시 확인해야 합니다.

### 위험도

**MEDIUM**