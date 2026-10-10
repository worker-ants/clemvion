-- V150: user.theme CHECK 에 'system' 을 더한다 (2/2 — 검증하고 옛 제약을 지운다)
--
-- NERV CLE-ACCT-DATA · CLE-ACCT-PROFILE, NERV Task CLE-T-E7MF3Q.
--
-- V149 가 건 chk_user_theme 을 VALIDATE 하고 V001 의 user_theme_check 를 지운다(migrations/README.md §1).
-- VALIDATE 는 SHARE UPDATE EXCLUSIVE 만 잡고 전체 스캔을 하므로 그동안 읽기 · 쓰기는 막히지 않는다. DROP 이 ACCESS EXCLUSIVE 를
-- 잡는 시점은 스캔이 끝난 뒤이고 곧바로 커밋된다. lock_timeout 을 3초로 둔 이유는 V149 와 같다. 잠금을 못 잡으면 이 파일이
-- 롤백되고 실패 행이 남지 않으니 다시 배포하면 된다. 새 제약이 옛 제약보다 넓어서 VALIDATE 가 실패하는 행은 없다.
SET lock_timeout = '3s';

ALTER TABLE "user" VALIDATE CONSTRAINT chk_user_theme;

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_theme_check;

RESET lock_timeout;

-- DOWN: system 행을 먼저 light 로 되돌린 뒤 옛 제약을 다시 건다. 그 다음 V149 의 DOWN 으로 새 제약을 지운다.
-- UPDATE "user" SET theme = 'light' WHERE theme = 'system';
-- ALTER TABLE "user" ADD CONSTRAINT user_theme_check CHECK (theme IN ('light', 'dark')) NOT VALID;
-- ALTER TABLE "user" VALIDATE CONSTRAINT user_theme_check;
