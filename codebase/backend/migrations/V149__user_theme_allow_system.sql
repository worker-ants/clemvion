-- V149: user.theme CHECK 에 'system' 을 더한다 (1/2 — 새 제약을 NOT VALID 로 건다)
--
-- NERV CLE-ACCT-DATA · CLE-ACCT-PROFILE, NERV Task CLE-T-E7MF3Q.
--
-- 프로필 API 와 DTO 는 theme 으로 light · dark · system 을 받는데 V001 의 CHECK 는 light · dark 만 받아서 system 을 저장하면
-- 500 으로 실패했다. 이름 있는 새 제약을 이 파일에서 NOT VALID 로 걸고, V150 이 VALIDATE 한 뒤 V001 이 자동 이름으로 만든
-- 제약(user_theme_check)을 지운다(migrations/README.md §1). 새 제약이 옛 제약보다 넓어서 기존 행 위배는 없다.
--
-- 락: "user" 는 로그인 · 프로필 갱신마다 쓰는 테이블이다. ADD ... NOT VALID 가 잡는 ACCESS EXCLUSIVE 는 커밋까지 남으므로
-- 같은 트랜잭션에서 VALIDATE 의 전체 스캔을 돌리면 그 시간 내내 "user" 접근이 막힌다. 그래서 두 파일로 나눈다.
-- 이 파일은 메타데이터만 바꿔서 금방 커밋된다. 오래 열린 트랜잭션이 "user" 를 쥐고 있으면 ALTER 가 줄을 서고 그 뒤의
-- 접근(로그인 포함)이 모두 같이 기다리므로 lock_timeout 을 3초로 둔다(V036 과 같은 방식). 잡지 못하면 이 파일이 롤백되고
-- 실패 행이 남지 않으니 다시 배포하면 된다.
SET lock_timeout = '3s';

ALTER TABLE "user"
  ADD CONSTRAINT chk_user_theme CHECK (theme IN ('light', 'dark', 'system')) NOT VALID;

RESET lock_timeout;

-- DOWN: 새 제약을 지운다. V150 도 되돌렸다면 먼저 그 DOWN 으로 옛 제약을 복구한다.
-- ALTER TABLE "user" DROP CONSTRAINT IF EXISTS chk_user_theme;
