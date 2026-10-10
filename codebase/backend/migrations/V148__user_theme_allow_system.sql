-- V148: user.theme CHECK 에 'system' 을 더한다
--
-- NERV CLE-ACCT-DATA · CLE-ACCT-PROFILE, NERV Task CLE-T-E7MF3Q.
--
-- 프로필 API 와 DTO 는 theme 으로 light · dark · system 을 받는데 V001 의 CHECK 는 light · dark 만 받아서 system 을 저장하면
-- 500 으로 실패했다. 이름 있는 새 제약을 NOT VALID 로 걸고 VALIDATE 한 뒤 V001 이 자동 이름으로 만든 제약(user_theme_check)을
-- 지운다(migrations/README.md §1). 새 제약이 옛 제약보다 넓어서 기존 행 위배는 없다.
--
-- 락: "user" 는 로그인 · 프로필 갱신마다 쓰는 테이블이라 ADD 가 잡은 ACCESS EXCLUSIVE 가 전체 검증 동안 남으면 안 된다.
-- 그래서 같은 이름의 .conf 에서 executeInTransaction=false 로 실행한다(V052 · V070 과 같은 방식). 문장마다 따로 커밋하므로
-- ADD ... NOT VALID 의 ACCESS EXCLUSIVE 는 그 문장이 끝나면 풀리고 VALIDATE 는 SHARE UPDATE EXCLUSIVE 만 잡는다.
-- 한 트랜잭션으로 돌리면 ACCESS EXCLUSIVE 가 커밋까지 남아 VALIDATE 의 전체 스캔 내내 "user" 접근이 막히므로
-- .conf 를 지우지 않는다. 오래 열린 트랜잭션이 "user" 를 쥐고 있으면 ALTER 가 줄을 서고 그 뒤의 접근(로그인 포함)이 모두 같이
-- 기다리므로 lock_timeout 을 3초로 둔다(V036 과 같은 방식).
--
-- 재실행: 비트랜잭션이라 중간에 실패하면 일부만 적용되고 flyway_schema_history 에 실패 행이 남는다(repair 후 다시 배포,
-- README.md). 맨 앞의 DROP CONSTRAINT IF EXISTS 가 이미 붙은 새 제약을 치우므로 같은 파일을 다시 돌려도 ADD 가 "이미 있다"
-- 로 실패하지 않는다. 그 사이에도 옛 제약(user_theme_check)이 남아 있어 CHECK 가 비지 않는다.
SET lock_timeout = '3s';

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS chk_user_theme;

ALTER TABLE "user"
  ADD CONSTRAINT chk_user_theme CHECK (theme IN ('light', 'dark', 'system')) NOT VALID;

ALTER TABLE "user" VALIDATE CONSTRAINT chk_user_theme;

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_theme_check;

RESET lock_timeout;

-- DOWN: system 행을 먼저 light 로 되돌린 뒤 옛 제약을 다시 건다.
-- UPDATE "user" SET theme = 'light' WHERE theme = 'system';
-- ALTER TABLE "user" ADD CONSTRAINT user_theme_check CHECK (theme IN ('light', 'dark')) NOT VALID;
-- ALTER TABLE "user" VALIDATE CONSTRAINT user_theme_check;
-- ALTER TABLE "user" DROP CONSTRAINT IF EXISTS chk_user_theme;
