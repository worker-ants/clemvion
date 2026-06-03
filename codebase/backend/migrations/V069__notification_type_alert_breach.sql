-- V069: notification.type CHECK constraint 에 alert breach 동적 type 추가
--
-- AlertsEvaluatorService.dispatchBreach() 가 INSERT 하는 type 값은
-- `alert_${rule.type}` 동적 패턴(alert_failure_rate / alert_duration /
-- alert_llm_cost)인데, V052 의 CHECK 화이트리스트에 빠져 있어 알림 규칙
-- 위반 시 check_violation 으로 INSERT 가 실패하던 결함을 해소한다.
-- (spec/data-flow/8-notifications.md §1.1 — alert_<rule.type> 동적 type)
--
-- rule.type enum (failure_rate | duration | llm_cost) 에 대응하는 3개 값을
-- V052 의 7개 화이트리스트에 추가한다.
--
-- 운영 안전 (V052 와 동일 패턴):
--   1) Pre-flight — 새 화이트리스트(10개) 외 값이 데이터에 남아 있으면 즉시 fail.
--   2) DROP CONSTRAINT IF EXISTS — idempotent.
--   3) ADD CONSTRAINT ... NOT VALID — 짧은 ACCESS EXCLUSIVE lock.
--   4) VALIDATE CONSTRAINT — 짧은 ShareUpdateExclusive lock 으로 기존 행 검증.
--
-- .conf 의 executeInTransaction=false 로 실행되므로 부분 적용 가능 —
-- IF EXISTS / 사전 검사로 idempotent 하게 재시도 가능하다.

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
        'team_invite',
        'alert_failure_rate',
        'alert_duration',
        'alert_llm_cost'
     );
    IF invalid_count > 0 THEN
        RAISE EXCEPTION
            'V069 pre-flight failed: % notification row(s) carry a type value outside the new allow-list. Backfill/cleanup these rows before re-applying.',
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
        'team_invite',
        'alert_failure_rate',
        'alert_duration',
        'alert_llm_cost'
    )) NOT VALID;

ALTER TABLE notification VALIDATE CONSTRAINT notification_type_check;
