# 데이터베이스(Database) 리뷰 결과

## 발견사항

### 마이그레이션 안전성

- **[INFO]** V100 마이그레이션 — nullable 컬럼 3개 추가, 무중단 안전
  - 위치: `codebase/backend/migrations/V100__add_email_change_fields.sql` L50–53
  - 상세: `pending_email`, `email_change_token`, `email_change_expires_at` 모두 `NULL DEFAULT NULL`. PostgreSQL 은 nullable 컬럼 추가 시 테이블 재작성 없이 카탈로그 업데이트만 수행하므로, 대용량 `user` 테이블에서도 Lock 없이(instantaneous) 완료된다. 기존 row 에 값이 없으므로 NOT VALID/VALIDATE 2-step 불필요. 코드 주석에 이 근거가 명시되어 있어 의도가 명확하다.
  - 제안: 현 구현 유지.

- **[INFO]** DOWN 스크립트 주석 포함
  - 위치: L64–67
  - 상세: 롤백 시 `DROP COLUMN IF EXISTS` 3개를 역순으로 기술. 실제 Flyway undo 파일로 분리되지 않았지만, 주석으로 존재하여 비상 복구 시 참고 가능.
  - 제안: 팀 관례가 Flyway Pro(undo) 파일 사용이라면 별도 `U100__` 파일로 분리 고려. 현 주석 방식이 관례와 일치하면 무방.

### 인덱스

- **[WARNING]** `email_change_token` 컬럼에 인덱스 없음
  - 위치: `V100__add_email_change_fields.sql` / `user.entity.ts` L648–653
  - 상세: `verifyEmailChange` 흐름은 `findById(userId)` 후 해시 비교를 애플리케이션 레이어에서 수행한다(`user.emailChangeToken !== this.hashToken(token)`). `userId` PRIMARY KEY 로 row 를 찾으므로 현재 패턴에서는 `email_change_token` 의 별도 인덱스가 불필요하다. 즉, token 으로 직접 DB를 조회하지 않기 때문에 실제 쿼리 성능 문제는 없다.
  - 다만 `resendEmailChange`와 `cancelEmailChange` 역시 `findById` 경로를 사용하므로 일관성 있게 문제없다.
  - 제안: 현 설계(userId 바인딩 → PK 조회)를 유지하는 한 인덱스 추가 불필요. 만약 향후 "만료된 pending 행 일괄 정리" 배치가 추가된다면 `email_change_expires_at` 에 인덱스 추가를 고려.

- **[INFO]** `emailTakenByOther` 쿼리 — `LOWER(u.email)` 인덱스 의존 여부
  - 위치: `users.service.ts` L989–993
  - 상세: `WHERE LOWER(u.email) = LOWER(:email)` 은 함수 표현식이므로 `email` 컬럼의 일반 B-tree 인덱스를 활용하지 못한다. 기존 `email` 컬럼에 인덱스가 있더라도 이 쿼리는 seq scan 이 발생할 수 있다.
  - 제안: `CREATE UNIQUE INDEX ... ON "user" (LOWER(email))` 이 이미 존재하는지 확인. 존재하지 않으면 추가를 권장. 단, 이메일 변경은 저빈도 작업(user 수가 수백만이 아닌 한 seq scan 비용이 낮음)이므로 위험도는 낮다. 기존 `isEmailTaken` 메서드에도 동일 패턴이 있어 팀이 이미 인지하고 있을 가능성이 높다.

### 트랜잭션

- **[WARNING]** `verifyEmailChange` — 이메일 교체·세션 revoke 가 단일 트랜잭션 아님
  - 위치: `auth.service.ts` L198–218
  - 상세: 흐름은 다음 순서다.
    1. `usersService.update(userId, { email: newEmail, ... })` — user row 업데이트 (DB 커밋)
    2. `sessionsService.revokeAllFamilies(userId, ctx)` — 세션 revoke (별도 DB 조작)
    3. `usersService.findById(userId)` — 업데이트된 user 재조회
    4. `generateTokens(updated, ...)` — 새 토큰 발급

    1번 커밋 후 2번 실패 시, `user.email` 은 이미 변경됐지만 기존 세션은 revoke 되지 않는다. 이는 보안 측면에서 "이메일 변경 확정 후 전 세션 무효화" 보장을 깰 수 있다. 비밀번호 변경(`rotateSessionAfterPasswordChange`) 도 동일 구조인지 확인이 필요하다.
  - 제안: `dataSource.transaction()` 으로 user 업데이트와 세션 revoke 를 하나의 트랜잭션으로 묶거나, 최소한 세션 revoke 실패를 non-swallowable 에러로 처리해 클라이언트가 재시도할 수 있게 해야 한다. 실용적 대안: 세션 revoke 를 idempotent 한 별도 API 로 노출하거나, 실패 시 재시도 로직 추가. 현 코드는 메일 전송 실패(best-effort)와 달리 세션 revoke 실패를 명시적으로 swallow 하지 않고 예외를 전파하므로 클라이언트가 에러를 받는다 — 그러나 이미 커밋된 이메일 교체가 롤백되지 않는다는 점이 위험하다.

- **[INFO]** `requestEmailChange` — 재인증과 pending 저장이 별도 트랜잭션
  - 위치: `auth.service.ts` L123–157
  - 상세: `reauthenticate` → `emailTakenByOther` → `usersService.update` 사이에 트랜잭션이 없다. 두 요청이 동시에 들어와 두 요청 모두 `emailTakenByOther` 를 통과 후 같은 `newEmail` 로 update 하면 마지막 write 가 이긴다. 단, `verifyEmailChange` 시점에 재검사(`emailTakenByOther` + UNIQUE 제약 최종 가드)가 있으므로 실제 중복 커밋은 방어된다.
  - 제안: 현 이중 검사 방어로 충분. 트랜잭션 추가는 선택 사항.

### SQL 인젝션

- **[INFO]** 파라미터화 쿼리 사용 확인
  - 위치: `users.service.ts` L989–993
  - 상세: TypeORM `createQueryBuilder` 에서 `:email`, `:id` named parameter 를 사용해 SQL 인젝션이 방지된다.
  - 제안: 이상 없음.

### 스키마 설계

- **[INFO]** `email_change_token` 길이 VARCHAR(255) — SHA-256 hex 64자 대비 과다
  - 위치: `V100__add_email_change_fields.sql` L52, `user.entity.ts` L649
  - 상세: SHA-256 hex 는 64자이나 255로 설정했다. 기존 `email_verify_token`, `password_reset_token` 패턴을 그대로 복제한 것으로 일관성은 유지된다. 과도한 길이는 스토리지 낭비가 적고(nullable + 실제 값이 64자이므로 row 크기 영향 미미), 유연성은 높다.
  - 제안: 현 패턴 유지. 향후 토큰 알고리즘 변경 시에도 길이 여유가 있다.

- **[INFO]** `pending_email` 에 UNIQUE 제약 없음 — 의도적
  - 위치: `V100__add_email_change_fields.sql` L51
  - 상세: 여러 사용자가 동시에 같은 이메일을 `pending_email` 로 요청할 수 있다. 최종 `email` 컬럼의 UNIQUE 제약이 verify 시점에 레이스 최종 가드 역할을 한다. 코드 주석에 "email UNIQUE 제약이 race 의 최종 가드" 라고 명시되어 있어 설계 의도가 명확하다.
  - 제안: 현 설계 유지.

### N+1 쿼리

- **[INFO]** 해당 없음. 이메일 변경 흐름은 단일 user row 조작이며, 반복문 내 쿼리 패턴이 없다.

### 커넥션 관리

- **[INFO]** TypeORM 레포지토리·QueryBuilder 사용 — 커넥션 풀 자동 관리. 명시적 해제 코드 불필요. 이상 없음.

### 대량 데이터

- **[INFO]** 이메일 변경은 단건 user PK 조회이므로 대량 데이터 시나리오와 무관. `emailTakenByOther` 의 LOWER 함수 인덱스 문제는 인덱스 항목에서 이미 언급.

---

## 요약

마이그레이션(V100)은 nullable 컬럼 3개 추가로 무중단 안전하다. 주요 DB 관련 위험은 두 가지다. 첫째, `verifyEmailChange` 에서 `user.email` 업데이트와 `sessionsService.revokeAllFamilies` 가 별도 트랜잭션으로 분리되어 있어, 이메일 교체가 커밋된 후 세션 revoke 가 실패하면 보안 불변식("이메일 변경 시 전 세션 무효화")이 위반될 수 있다(WARNING). 둘째, `emailTakenByOther` 의 `LOWER(u.email)` 표현식 조회가 일반 인덱스를 활용하지 못해 표현식 인덱스가 없으면 seq scan 이 발생한다(WARNING — 저빈도 작업이므로 현실적 영향은 낮음). SQL 인젝션 방어, 스키마 설계, 마이그레이션 안전성은 모두 양호하다.

## 위험도

MEDIUM

---

STATUS=success ISSUES=2
