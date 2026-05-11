-- V040: 활성 세션 관리·로그인 이력 기능
--
-- 변경 내역
--   1) refresh_token 에 디바이스 메타데이터 컬럼 5종 추가 (모두 NULLABLE, 기본값 없음)
--      → 기존 row 는 NULL 로 두고 UI 에서 "알 수 없음" 으로 표시.
--        최대 30일 (rememberMe) 안에 자연 회전되어 메워진다.
--   2) login_history 신규 테이블 — 워크스페이스 컨텍스트 밖의 인증 이벤트 (성공/실패/세션 강제 종료/refresh reuse) 기록
--   3) 활성 세션 그룹 조회용 부분 인덱스 추가
--
-- 무중단 배포 메모
--   - PostgreSQL 11+ 에서 NULL 기본값 ALTER ... ADD COLUMN 은 메타데이터만 변경하므로 비파괴.
--   - login_history 는 신규 테이블이므로 트랜잭션 내 생성 가능 (CONCURRENTLY 불필요).

ALTER TABLE refresh_token
    ADD COLUMN device_label TEXT,
    ADD COLUMN user_agent TEXT,
    ADD COLUMN ip_address VARCHAR(45),
    ADD COLUMN last_used_at TIMESTAMPTZ,
    ADD COLUMN last_used_ip VARCHAR(45);

CREATE INDEX idx_refresh_token_user_active
    ON refresh_token (user_id, family_id)
    WHERE is_revoked = FALSE;

-- ============================================================
-- Login history table (사용자 단위 인증 이벤트)
-- ============================================================
CREATE TABLE login_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES "user"(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    event           VARCHAR(32)  NOT NULL,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    device_label    TEXT,
    family_id       UUID,
    failure_reason  VARCHAR(64),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_login_history_event CHECK (
        event IN (
            'login_success',
            'login_failed',
            'totp_failed',
            'logout',
            'session_revoked',
            'token_reuse_detected'
        )
    )
);

CREATE INDEX idx_login_history_user_created
    ON login_history (user_id, created_at DESC);
CREATE INDEX idx_login_history_email_created
    ON login_history (email, created_at DESC);
