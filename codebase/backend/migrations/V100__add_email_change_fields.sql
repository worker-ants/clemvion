-- V100: 이메일 변경 프로세스용 pending 컬럼 3개 추가 (user 테이블).
-- (spec/5-system/1-auth.md §1.1.B 이메일 변경 흐름, spec/1-data-model.md §2.1 User.)
--
-- 로그인 사용자가 이메일을 바꾸는 별도 프로세스:
--   request → 신규 이메일로 확인 메일(SHA-256 토큰, 1h) → verify(링크 클릭) → email 교체.
-- 기존 email_verify_token / password_reset_token 3필드 패턴을 그대로 복제한다 —
-- raw 토큰은 메일 링크로만 전달, DB 에는 SHA-256 해시만 저장(at-rest, §1.1).
--
--   pending_email           VARCHAR(255) — 확인 대기 중인 신규 이메일. 확인 완료(email 로 승격)/취소 시 NULL.
--   email_change_token      VARCHAR(255) — 변경 확인 토큰의 SHA-256 해시(64 hex). 확인/취소/만료 시 NULL.
--   email_change_expires_at TIMESTAMPTZ  — 변경 확인 토큰 만료 시각(발급 + 1h).
--
-- 세 컬럼 모두 nullable·default null — 회귀 없음(기존 row 영향 없음). 신규 컬럼이라
-- 기존 row 검증이 불필요해 단일 ALTER 로 안전(NOT VALID/VALIDATE 2-step 불요).
ALTER TABLE "user"
  ADD COLUMN pending_email VARCHAR(255) NULL,
  ADD COLUMN email_change_token VARCHAR(255) NULL,
  ADD COLUMN email_change_expires_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN "user".pending_email IS
  'New email awaiting confirmation during an email change (spec/5-system/1-auth.md §1.1.B). NULL when no change is pending.';

COMMENT ON COLUMN "user".email_change_token IS
  'SHA-256 hash of the email-change confirmation token (raw token emailed only; mirrors email_verify_token). NULL when no change is pending / after use / expiry.';

COMMENT ON COLUMN "user".email_change_expires_at IS
  'Expiry of the email-change confirmation token (issued_at + 1h, spec/5-system/1-auth.md §1.1.B Rationale 1.1.B-3).';

-- DOWN:
-- ALTER TABLE "user" DROP COLUMN IF EXISTS email_change_expires_at;
-- ALTER TABLE "user" DROP COLUMN IF EXISTS email_change_token;
-- ALTER TABLE "user" DROP COLUMN IF EXISTS pending_email;
