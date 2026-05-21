-- V061: Trigger 의 outbound notification 발송 건강도(degraded) 트리거 빠른 조회용 partial index
--
-- 관련 spec:
--   - spec/5-system/14-external-interaction-api.md §3.1 EIA-NX-07 / §7.1
--   - plan/complete/external-interaction-api.md §"완료 후 잔여" — notification_health partial index
--
-- 배경
--   degraded 상태 trigger 를 대시보드·운영 알림에서 빠르게 조회 (총 row 의 일부일 것으로 예상).
--   전체 trigger 테이블 scan 회피.
--
-- 무중단 배포
--   partial index — 등록 시 짧은 lock. trigger 테이블이 작아 CONCURRENTLY 불요 (대규모 trigger
--   환경이면 .conf 신설 + CREATE INDEX CONCURRENTLY 로 전환 검토).

CREATE INDEX idx_trigger_notification_degraded
    ON trigger(notification_health)
    WHERE notification_health = 'degraded';
