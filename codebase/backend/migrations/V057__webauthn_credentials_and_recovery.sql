-- V057: WebAuthn 2FA — credential 엔티티 + 사용자 webauthn 복구 코드 컬럼
--
-- 관련 spec:
--   - spec/5-system/1-auth.md §1.4 (2FA 두 방식·우선순위·복구 코드 분리)
--   - spec/1-data-model.md §2.21 WebAuthnCredential
--   - spec/data-flow/2-auth.md §1.2 (WebAuthn 우선 분기)
--
-- 변경 내역
--   1) webauthn_credential 신규 테이블 — 사용자당 다중 등록 허용 (Passkey·보안 키)
--   2) user.webauthn_recovery_codes 컬럼 추가 — TOTP 의 totp_recovery_codes 와 별도 풀
--
-- 무중단 배포 메모
--   - 신규 테이블 + NULL 기본값 ALTER ADD COLUMN 모두 메타데이터만 변경하므로 비파괴.
--   - CONCURRENTLY 미사용 → 트랜잭션 모드 (.conf 불요).

-- ============================================================
-- webauthn_credential — Passkey · 보안 키 등 인증기 등록 정보
-- ============================================================
CREATE TABLE webauthn_credential (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    credential_id   TEXT NOT NULL,
    public_key      BYTEA NOT NULL,
    counter         BIGINT NOT NULL DEFAULT 0,
    transports      TEXT[] NOT NULL DEFAULT '{}',
    aaguid          UUID,
    device_name     VARCHAR(100),
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_webauthn_credential_credential_id UNIQUE (credential_id)
);

COMMENT ON TABLE webauthn_credential IS
    'WebAuthn (Passkey · 보안 키) 인증기. 사용자당 N개 등록 허용. counter 역행 시 row 즉시 삭제 — spec/5-system/1-auth.md Rationale 1.4.E.';
COMMENT ON COLUMN webauthn_credential.credential_id IS
    'WebAuthn 표준 credential ID (base64url 인코딩, 가변 길이)';
COMMENT ON COLUMN webauthn_credential.public_key IS
    'CBOR-COSE 직렬화 공개 키';
COMMENT ON COLUMN webauthn_credential.counter IS
    'replay 방어용 sign counter. 매 인증 후 갱신, 역행 시 fatal';
COMMENT ON COLUMN webauthn_credential.transports IS
    'WebAuthn transport hints (usb / nfc / ble / internal / hybrid)';

CREATE INDEX idx_webauthn_credential_user
    ON webauthn_credential (user_id);

-- credential_id 는 위 UNIQUE 제약으로 자동 인덱스 생성됨 (uq_webauthn_credential_credential_id)
-- WebAuthn 인증 시 credential_id 로 row lookup 하는 경로의 O(1) 접근 보장

-- ============================================================
-- user.webauthn_recovery_codes — WebAuthn 전용 별도 복구 코드 풀
-- ============================================================
ALTER TABLE "user"
    ADD COLUMN webauthn_recovery_codes TEXT[];

COMMENT ON COLUMN "user".webauthn_recovery_codes IS
    'WebAuthn 첫 credential 등록 시점에 발급한 복구 코드 10개의 SHA-256 해시 배열. 사용 시 해당 항목 제거. 모든 credential 삭제 시 애플리케이션 레이어(WebAuthnService.deleteCredential) 가 NULL 화 — DB 트리거 아님. spec/5-system/1-auth.md Rationale 1.4.B (TOTP 풀과 별도 분리).';

-- DOWN: (DESTRUCTIVE — 데이터 손실 동반)
-- ALTER TABLE "user" DROP COLUMN IF EXISTS webauthn_recovery_codes;
-- DROP TABLE IF EXISTS webauthn_credential;
