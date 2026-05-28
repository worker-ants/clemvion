-- V064: auth_config.type 에 'hmac' 추가
--
-- 관련 spec:
--   - spec/1-data-model.md §2.17 / §2.17.1 (AuthConfig.type enum + config JSONB 스키마)
--   - spec/5-system/12-webhook.md §3.2 WH-SC-02 / §4.2 (HMAC 서명 검증을 AuthConfig 로 흡수)
--
-- 결정 — 단일 statement 허용 (README §1 예외 조건 충족):
--   - 'hmac' 은 신규 enum 값이라 기존 row 위배가 schema 적으로 0건 (NOT VALID 2-step 의 이득 없음).
--   - auth_config 는 워크스페이스당 소수 행의 작은 테이블 — ACCESS EXCLUSIVE 락 영향 무시 가능.
--   - V058 (login_history chk enum 확장) 과 동일 패턴. 근거: spec/5-system/12-webhook.md Rationale
--     "inline auth path 폐지" + spec/1-data-model.md §2.17.3.
--
-- 호환성: 기존 api_key / bearer_token / basic_auth row 무영향. config JSONB 무변경.

ALTER TABLE auth_config DROP CONSTRAINT auth_config_type_check;
ALTER TABLE auth_config ADD CONSTRAINT auth_config_type_check
    CHECK (type IN ('api_key', 'bearer_token', 'basic_auth', 'hmac'));
