-- V053: NotificationsService.hasRecentByResource 의 idempotency 쿼리용 복합 인덱스
--
-- 쿼리 형태:
--   SELECT COUNT(*) FROM notification
--    WHERE workspace_id = $1 AND type = $2 AND resource_id = $3 AND title = $4
--      AND created_at >= $5
--
-- 현재는 workspace_id 인덱스만 있어 type/resource_id 카디널리티가 낮은 환경에서
-- seq scan 으로 회귀할 수 있다. 알림 발사 hot path 이므로 복합 인덱스를 둔다.
-- CONCURRENTLY 사용을 위해 트랜잭션 밖에서 실행 (.conf executeInTransaction=false).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_workspace_type_resource
    ON notification (workspace_id, type, resource_id, created_at DESC);
