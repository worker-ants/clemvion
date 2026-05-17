-- V054: AuthConfig.config 평문 → AES-256-GCM 암호화 전환 (마이그레이션 마커)
--
-- 배경:
--   spec 은 `JSONB (encrypted)` 를 명시했으나 V001 시점 엔티티에 transformer 가
--   적용되지 않아 Webhook Bearer Token / API Key 등 인증 자격증명이 평문 저장됐다.
--   엔티티에 encryptedJsonTransformer 를 적용해 이후 모든 write 는 암호화된다.
--
-- 무결성:
--   credentials-transformer.ts 는 read 시 'enc:' prefix 없는 평문 문자열·plain
--   JSONB 객체를 모두 정상 파싱하므로 (legacy fallback 경로), 기존 평문 행이
--   존재해도 read 는 깨지지 않는다. 다음 write 시 자동으로 암호화된다.
--
-- 강제 마이그레이션 (운영 권장):
--   transformer 가 lazy 인 한 일부 행은 다음 write 가 발생할 때까지 평문으로
--   남아있다. 운영 환경에서는 codebase/backend/scripts/encrypt-auth-config.ts 를 1회
--   실행해 모든 행을 즉시 재암호화한다 (.env 의 INTEGRATION_ENCRYPTION_KEY 필요):
--
--     npm --prefix backend run -- ts-node scripts/encrypt-auth-config.ts
--
--   스크립트는 idempotent — 이미 'enc:' 프리픽스가 붙은 행은 skip.
--
-- 본 마이그레이션은 마커일 뿐, 실제 변환은 application code 가 담당한다.

DO $$
DECLARE
    plaintext_count int;
BEGIN
    -- 평문 JSONB 가 남아있는지 진단용 카운트 (참고 로그). FAIL 하지 않는다.
    -- 'enc:v1:' 으로 시작하는 JSON 문자열은 암호화 envelope, 그 외 객체/배열/
    -- 비-envelope 문자열은 평문으로 간주.
    SELECT COUNT(*) INTO plaintext_count
      FROM auth_config
     WHERE jsonb_typeof(config) = 'object'
        OR (jsonb_typeof(config) = 'string'
            AND NOT (config #>> '{}') LIKE 'enc:v1:%');
    IF plaintext_count > 0 THEN
        RAISE NOTICE
            'V054: % auth_config row(s) still hold plaintext config. Lazy migration on next write OR run codebase/backend/scripts/encrypt-auth-config.ts to eager-migrate.',
            plaintext_count;
    END IF;
END $$;
