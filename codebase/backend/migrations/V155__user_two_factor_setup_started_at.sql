-- V155: user.two_factor_setup_started_at 을 더한다 (TOTP 대기 secret 의 10분 만료)
--
-- NERV CLE-ACCT-SIGNIN · CLE-ACCT-DATA, NERV Task CLE-T-FRCRF7.
--
-- TOTP 설정 시작(POST /api/auth/2fa/setup)이 저장한 대기 secret 에 수명이 없었다. 그래서 비밀번호를 한 번 확인하면
-- 같은 secret 의 6자리 코드를 시간 제한 없이 추측할 수 있었다. 설정 시작 시각을 남기고 활성화 검증이 10분이 지난 대기
-- secret 을 버린다(REQ-SIGNIN-084).
--
-- 기존 행은 바꾸지 않는다. 이 컬럼 전에 설정을 시작하고 켜지 않은 대기 secret 은 시각이 NULL 이라 활성화 검증이 만료로 보고
-- 비운다. 그 사용자는 설정을 다시 시작하면 된다.
--
-- 락: NULL 허용이고 기본값이 없는 컬럼 추가라 메타데이터만 바꾸고 행을 다시 쓰지 않는다. 다만 ACCESS EXCLUSIVE 를 잡으므로
-- 오래 열린 트랜잭션이 "user" 를 쥐고 있으면 그 뒤의 접근(로그인 포함)이 함께 기다린다. V149 와 같이 lock_timeout 을 3초로
-- 둔다. 잡지 못하면 이 파일이 롤백되고 실패 행이 남지 않으니 다시 배포하면 된다.
SET lock_timeout = '3s';

ALTER TABLE "user" ADD COLUMN two_factor_setup_started_at TIMESTAMPTZ NULL;

RESET lock_timeout;

-- DOWN: 컬럼을 지운다. 되돌리면 대기 secret 의 만료 판정이 사라진다.
-- ALTER TABLE "user" DROP COLUMN IF EXISTS two_factor_setup_started_at;
