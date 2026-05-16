-- V052: notification.type CHECK constraint 에 'integration_action_required' 추가
--
-- IntegrationActionRequiredNotifierService 가 INSERT 하는 type 값이
-- V001 의 CHECK 화이트리스트에 빠져 있어 운영 환경에서 check_violation 으로
-- 알림 발사가 실패하던 결함을 해소한다. (Review C-9)

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
    ));
