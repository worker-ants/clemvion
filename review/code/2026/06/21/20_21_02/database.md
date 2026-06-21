# 데이터베이스(Database) 리뷰 결과

## 발견사항

### 마이그레이션 안전성

- **[INFO]** V100 마이그레이션 — nullable 컬럼 3개 추가, 무중단 안전
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/codebase/backend/migrations/V100__add_email_change_fields.sql`
  - 상세: `pending_email`, `email_change_token`, `email_change_expires_at` 모두 `NULL DEFAULT NULL`. PostgreSQL 은 nullable 컬럼 추가 시 테이블 재작성 없이 카탈로그 업데이트만 수행하므로 대용량 `user` 테이블에서도 AccessShareLock 수준으로 완료된다. 기존 row 에 값이 없으므로 CHECK 제약 NOT VALID/VALIDATE 2-step 도 불필요. 코드 주석에 근거가 명시되어 있어 의도가 명확하다.
  - 제안: 현 구현 유지.

- **[INFO]** DOWN 스크립트 주석으로만 존재
  - 위치: `V100__add_email_change_fields.sql` 하단 주석
  - 상세: 롤백 SQL 이 주석으로 존재한다. Flyway Community 를 사용 중이라면 undo 파일을 별도로 관리하지 않는 것이 일반적이므로 이 방식은 수용 가능하다.
  - 제안: 현 관례 유지.

---

### 인덱스

- **[INFO]** `email_change_token` 컬럼에 별도 인덱스 불필요
  - 위치: `V100__add_email_change_fields.sql`, `user.entity.ts`
  - 상세: `verifyEmailChange`, `resendEmailChange`, `cancelEmailChange` 모두 `findById(userId)` — PK 조회 후 애플리케이션 레이어에서 토큰 해시 비교를 수행한다. 토큰 값으로 DB 를 직접 조회하는 경로가 없으므로 `email_change_token` 에 인덱스는 불필요하다.
  - 제안: 현 설계 유지. 향후 "만료 토큰 일괄 정리" 배치 도입 시 `email_change_expires_at` 인덱스 추가 고려.

- **[WARNING]** `emailTakenByOther` — `LOWER(u.email)` 표현식 인덱스 부재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/codebase/backend/src/modules/users/users.service.ts` L108–113
  - 상세: `WHERE LOWER(u.email) = LOWER(:email)` 은 함수 표현식이므로 `V001__initial_schema.sql` 의 `email VARCHAR(255) NOT NULL UNIQUE` 일반 B-tree 인덱스를 활용하지 못한다. `V002__indexes.sql` 포함 이후 마이그레이션 파일 어디에도 `CREATE INDEX ... ON "user" (LOWER(email))` 형태의 표현식 인덱스가 존재하지 않는다. 이메일 변경은 저빈도 작업이나, 사용자 수가 수십만 이상일 경우 시퀀셜 스캔 비용이 누적될 수 있다. 동일 패턴(`LOWER`) 이 기존 `isEmailTaken`(가입 흐름)에도 사용되고 있다면 그 쪽도 동일 문제를 공유한다.
  - 제안: 신규 마이그레이션(예: `V101__add_user_email_lower_index.sql`)으로 `CREATE UNIQUE INDEX idx_user_email_lower ON "user" (LOWER(email));` 추가 권장. 단, 이미 `email UNIQUE` 제약이 있어 중복 UNIQUE 인덱스 충돌 여부를 확인 후 `CREATE INDEX`(비유니크) 로 추가하거나 제약과 통합해야 한다. 현실적 위험은 LOW이나 개선 가치가 있다.

---

### 트랜잭션

- **[WARNING]** `verifyEmailChange` — 이메일 교체와 세션 revoke 가 별도 트랜잭션
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyEmailChange`
  - 상세: 흐름이 (1) `usersService.update(email: newEmail, ...)` 커밋 → (2) `sessionsService.revokeAllFamilies(userId, ctx)` 순으로 진행된다. 1번 커밋 후 2번 실패 시, `user.email` 은 이미 교체됐지만 기존 세션이 revoke 되지 않는다. "이메일 변경 확정 후 전 세션 무효화" 보안 불변식이 일시적으로 위반된다. 이번 resolution(W5)에서 `revokeAllFamilies` 실패가 예외를 전파하도록 수정되어 클라이언트가 500을 받으므로 관측 가능하다. 그러나 이미 커밋된 이메일 교체가 롤백되지 않는다는 점은 여전히 잔존하는 구조적 제약이다. 코드 주석에 이 한계와 허용 근거(spec §2.3 / Rationale 2.3.C)가 명시되어 있다.
  - 제안: TypeORM `dataSource.transaction()` 으로 `update(email)` 와 `revokeAllFamilies` 를 하나의 트랜잭션으로 묶는 것이 이상적이나, 세션 revoke 가 별도 테이블에 audit 이벤트를 삽입하는 구조라면 동일 트랜잭션 내 포함이 가능하다. 현행 best-effort + 관측 가능 패턴은 spec 에서 명시적으로 수용된 상태이므로 WARNING 등급으로 기록하되 즉각 차단 요소는 아니다.

- **[INFO]** `requestEmailChange` — 중복 검사와 pending 저장 사이의 비원자성
  - 위치: `auth.service.ts` — `requestEmailChange`
  - 상세: `emailTakenByOther` 통과 후 `usersService.update(pendingEmail, ...)` 사이에 트랜잭션이 없다. 두 요청이 동시에 동일 신규 이메일로 들어오면 둘 다 pending 에 저장될 수 있다. 그러나 `verifyEmailChange` 시점의 재검사 및 `email UNIQUE` 제약이 최종 가드이므로 데이터 무결성은 보장된다. TOCTOU 주석이 코드에 명시되어 있다.
  - 제안: 현 이중 검사 방어로 충분. 추가 조치 선택 사항.

---

### SQL 인젝션

- **[INFO]** 파라미터화 쿼리 사용 확인
  - 위치: `users.service.ts` L110–111
  - 상세: TypeORM `createQueryBuilder` 에서 `:email`, `:id` named parameter 를 사용하여 SQL 인젝션을 방지한다. 이상 없음.

---

### 스키마 설계

- **[INFO]** `email_change_token` VARCHAR(255) — SHA-256 hex 64자 대비 여유
  - 상세: SHA-256 hex 출력은 64자이나 255로 설정했다. 기존 `email_verify_token`, `password_reset_token` 패턴과 일관성을 유지하며 유연성이 높다.
  - 제안: 현 패턴 유지.

- **[INFO]** `pending_email` 에 UNIQUE 제약 없음 — 의도적
  - 상세: 여러 사용자가 동시에 동일 이메일을 `pending_email` 로 요청할 수 있다. 최종 `email` 컬럼의 UNIQUE 제약이 verify 시점 최종 가드다. 코드 주석에 설계 의도가 명시되어 있다.
  - 제안: 현 설계 유지.

- **[INFO]** COMMENT ON COLUMN 적용 완료
  - 상세: 3개 신규 컬럼 모두 `COMMENT ON COLUMN` 이 부여되어 schema-level 문서화가 완결적이다.

---

### N+1 쿼리

- **[INFO]** 해당 없음. 이메일 변경 흐름은 단일 user row 조작이며 반복문 내 쿼리 패턴이 없다.

---

### 커넥션 관리

- **[INFO]** TypeORM 레포지토리 및 QueryBuilder 사용 — 커넥션 풀 자동 관리. 명시적 해제 코드 불필요. 이상 없음.

---

### 대량 데이터

- **[INFO]** 이메일 변경은 단건 user PK 조회 중심이므로 대량 데이터 시나리오와 무관. `emailTakenByOther` 의 LOWER 표현식 인덱스 문제는 인덱스 항목에서 별도 기술.

---

## 요약

마이그레이션(V100)은 nullable 컬럼 3개 추가로 무중단 안전하며 COMMENT ON COLUMN 까지 포함해 schema-level 문서화가 완결적이다. resolution 적용(W5~W10) 후 `verifyEmailChange` 에서 `revokeAllFamilies` 실패가 예외를 전파하도록 개선되어 관측 가능성이 확보됐고, 메일 발송 실패 시 `clearPendingEmailChange` 롤백 로직도 추가되었다. 잔존하는 DB 관점 위험은 두 가지다. 첫째, `verifyEmailChange` 에서 이메일 교체와 세션 revoke 가 단일 트랜잭션으로 묶이지 않아 교체 커밋 후 revoke 실패 시 "전 세션 무효화" 불변식이 일시 위반될 수 있다(WARNING — spec 에서 best-effort 로 수용). 둘째, `emailTakenByOther` 의 `LOWER(u.email)` 표현식이 기존 일반 B-tree 인덱스를 활용하지 못하여 대규모 테이블에서 seq scan 이 발생할 수 있다(WARNING — 저빈도 작업이지만 표현식 인덱스 추가가 권장됨). SQL 인젝션 방어·스키마 설계·마이그레이션 안전성·커넥션 관리는 모두 양호하다.

## 위험도

MEDIUM

STATUS=success ISSUES=2
