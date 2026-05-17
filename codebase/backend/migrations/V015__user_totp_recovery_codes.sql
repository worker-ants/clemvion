-- V015: TOTP recovery codes column for user 2FA
-- See: plan/stages/06-2fa.md

ALTER TABLE "user"
    ADD COLUMN IF NOT EXISTS totp_recovery_codes TEXT[];

COMMENT ON COLUMN "user".totp_recovery_codes IS
    '2FA 복구 코드(SHA-256 해시 배열). 사용 시 해당 항목 제거.';
