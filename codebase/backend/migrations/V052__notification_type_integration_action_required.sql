-- V052: notification.type CHECK constraint 에 'integration_action_required' 추가
--
-- IntegrationActionRequiredNotifierService 가 INSERT 하는 type 값이
-- V001 의 CHECK 화이트리스트에 빠져 있어 운영 환경에서 check_violation 으로
-- 알림 발사가 실패하던 결함을 해소한다. (Review C-9)
--
-- 운영 안전:
--   1) Pre-flight — 화이트리스트 외 값이 데이터에 남아 있으면 즉시 fail.
--      옛 마이그레이션에서 enum 변경이 누락된 잔존 행이 있으면
--      ADD CONSTRAINT 단계에서 발견되기보다 사전에 명시 차단하는 게 안전.
--   2) DROP CONSTRAINT — V001 의 인라인 CHECK 는 PostgreSQL 이 기본적으로
--      `<table>_<column>_check` 로 명명하므로 idempotent 하게 drop.
--   3) ADD CONSTRAINT ... NOT VALID — 기존 행 검증을 건너뛰어 짧은
--      ACCESS EXCLUSIVE lock 만 사용. 새 INSERT 는 즉시 새 제약을 따른다.
--   4) VALIDATE CONSTRAINT — 별도 짧은 ShareUpdateExclusive lock 으로 기존
--      행을 검증. pre-flight 가 통과했으므로 이 단계는 사실상 instant.
--
-- 본 마이그레이션은 .conf 의 executeInTransaction=false 로 실행되므로,
-- 어느 단계에서 실패해도 부분 적용이 발생할 수 있다. 재시도 시 IF EXISTS /
-- 사전 검사로 idempotent 하게 동작한다.

DO $$
DECLARE
    invalid_count int;
BEGIN
    SELECT COUNT(*) INTO invalid_count
      FROM notification
     WHERE type NOT IN (
        'execution_failed',
        'background_failed',
        'schedule_failed',
        'integration_expired',
        'integration_action_required',
        'marketplace_update',
        'team_invite'
     );
    IF invalid_count > 0 THEN
        RAISE EXCEPTION
            'V052 pre-flight failed: % notification row(s) carry a type value outside the new allow-list. Backfill/cleanup these rows before re-applying.',
            invalid_count;
    END IF;
END $$;

ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;

ALTER TABLE notification
    ADD CONSTRAINT notification_type_check
    CHECK (type IN (
        'execution_failed',
        'background_failed',
        'schedule_failed',
        'integration_expired',
        'integration_action_required',
        'marketplace_update',
        'team_invite'
    )) NOT VALID;

ALTER TABLE notification VALIDATE CONSTRAINT notification_type_check;
