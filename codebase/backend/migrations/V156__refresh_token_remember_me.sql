-- V156: refresh_token.remember_me 를 더한다 (리프레시 토큰 회전이 로그인 유지 여부를 이어받는다)
--
-- NERV CLE-ACCT-SESSION 「로그인 유지」(REQ-SESSION-047) · CLE-ACCT-DATA, NERV Task CLE-T-BYCGF1.
--
-- 갱신(POST /api/auth/refresh)이 토큰을 회전할 때 로그인 유지 여부를 늘 false 로 넘겨, 30일로 로그인한 세션도
-- 첫 회전 뒤에는 7일 만료가 됐다. 로그인 유지 여부를 토큰 행에 남기고 회전한 새 토큰이 이어받게 한다.
--
-- 기존 행 백필: 배포 시점에 살아 있는 행 가운데 30일로 발급된 행만 true 로 채운다. 발급 수명이 7일인 행은
-- expires_at - created_at 이 7일이고 30일인 행은 30일이라 8일을 경계로 가른다. 이미 한 번 회전한 행은 7일로
-- 발급돼 로그인 유지 여부를 알 수 없으므로 false 로 남는다. 그 사용자는 다음 로그인부터 30일을 받는다.
--
-- 락: 상수 기본값이 있는 NOT NULL 컬럼 추가는 PostgreSQL 11 이상에서 메타데이터만 바꾼다. 다만 ACCESS EXCLUSIVE
-- 를 잡으므로 V155 와 같이 lock_timeout 을 3초로 둔다. 잡지 못하면 이 파일이 롤백되니 다시 배포하면 된다.
-- 백필 UPDATE 는 살아 있는 30일 행만 다시 쓴다(사용자 수 × 기기 수 규모).
SET lock_timeout = '3s';

ALTER TABLE refresh_token ADD COLUMN remember_me BOOLEAN NOT NULL DEFAULT false;

RESET lock_timeout;

UPDATE refresh_token
   SET remember_me = true
 WHERE is_revoked = false
   AND expires_at > now()
   AND expires_at - created_at > interval '8 days';
