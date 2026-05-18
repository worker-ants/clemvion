-- V058: LoginHistory.event CHECK 제약에 webauthn_failed 추가
--
-- 관련 spec:
--   - spec/5-system/1-auth.md §4.3 (LoginHistory 이벤트 목록)
--   - spec/1-data-model.md §2.18.2 LoginHistory
--
-- 변경 내역
--   - chk_login_history_event 제약을 DROP + ADD 패턴으로 갱신
--   - 신규 enum 값은 기존 row 에 위배 없음 → NOT VALID / VALIDATE 분리 불요
--   - V040 도입 제약명 (chk_login_history_event) 그대로 재사용
--
-- 무중단 배포 메모
--   - DROP/ADD CONSTRAINT 는 ACCESS EXCLUSIVE LOCK 을 잡지만 단일 statement 라 즉시 완료.
--   - 운영 트래픽이 매우 큰 환경이라면 NOT VALID 패턴으로 분리하는 V059 도 가능하나
--     login_history 는 INSERT 만 발생하는 append-only 테이블이라 짧은 락은 안전.

ALTER TABLE login_history
    DROP CONSTRAINT chk_login_history_event;

ALTER TABLE login_history
    ADD CONSTRAINT chk_login_history_event CHECK (
        event IN (
            'login_success',
            'login_failed',
            'totp_failed',
            'webauthn_failed',
            'logout',
            'session_revoked',
            'token_reuse_detected'
        )
    );

-- DOWN: (DESTRUCTIVE — 이미 기록된 webauthn_failed row 가 있으면 ADD CONSTRAINT 실패)
-- ALTER TABLE login_history DROP CONSTRAINT chk_login_history_event;
-- DELETE FROM login_history WHERE event = 'webauthn_failed';
-- ALTER TABLE login_history
--     ADD CONSTRAINT chk_login_history_event CHECK (
--         event IN (
--             'login_success', 'login_failed', 'totp_failed',
--             'logout', 'session_revoked', 'token_reuse_detected'
--         )
--     );
