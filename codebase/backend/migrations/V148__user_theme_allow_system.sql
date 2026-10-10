-- V148: user.theme CHECK 에 'system' 을 더한다
--
-- NERV CLE-ACCT-DATA · CLE-ACCT-PROFILE, NERV Task CLE-T-E7MF3Q.
--
-- 프로필 API 와 DTO 는 theme 으로 light · dark · system 을 받는데 V001 의 CHECK 는 light · dark 만 받아서 system 을 저장하면
-- 500 으로 실패했다. 이름 있는 새 제약을 NOT VALID 로 걸고 VALIDATE 한 뒤 V001 이 자동 이름으로 만든 제약(user_theme_check)을
-- 지운다(migrations/README.md §1). 새 제약이 옛 제약보다 넓어서 기존 행 위배는 없다. 그래도 "user" 는 로그인 · 프로필 갱신마다
-- 쓰는 테이블이라 ACCESS EXCLUSIVE 아래 전체 검증을 하는 한 문장 형태는 쓰지 않는다. DROP 은 카탈로그만 바꾼다.
ALTER TABLE "user"
  ADD CONSTRAINT chk_user_theme CHECK (theme IN ('light', 'dark', 'system')) NOT VALID;

ALTER TABLE "user" VALIDATE CONSTRAINT chk_user_theme;

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_theme_check;

-- DOWN: system 행을 먼저 light 로 되돌린 뒤 옛 제약을 다시 건다.
-- UPDATE "user" SET theme = 'light' WHERE theme = 'system';
-- ALTER TABLE "user" ADD CONSTRAINT user_theme_check CHECK (theme IN ('light', 'dark')) NOT VALID;
-- ALTER TABLE "user" VALIDATE CONSTRAINT user_theme_check;
-- ALTER TABLE "user" DROP CONSTRAINT IF EXISTS chk_user_theme;
