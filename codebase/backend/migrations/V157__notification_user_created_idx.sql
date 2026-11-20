-- V157: 일일 요약 메일(CLE-T-BAXAN4)의 수신자별 24시간 조회용 인덱스
--
-- 쿼리 형태 (NotificationDigestService.findDigestRows):
--   SELECT ... FROM notification
--    WHERE user_id = ANY($1) AND type = ANY($2)
--      AND created_at >= $3 AND created_at < $4
--
-- 기존 인덱스는 이 조회에 쓸 수 없다.
--   - idx_notification_user_read_created_active (user_id, is_read, created_at) 는 WHERE dismissed_at IS NULL
--     부분 인덱스라, 닫힌 알림도 모으는 이 조회의 술어를 포함하지 못한다.
--   - idx_notification_workspace_created 와 idx_notification_workspace_type_resource 는 workspace_id 가 앞이다.
-- 그래서 user_id 로 좁힌 뒤 created_at 범위를 읽는 인덱스를 둔다.
-- CONCURRENTLY 사용을 위해 트랜잭션 밖에서 실행 (.conf executeInTransaction=false).
-- DOWN: DROP INDEX CONCURRENTLY IF EXISTS idx_notification_user_created;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_user_created
    ON notification (user_id, created_at DESC);
