-- V056: notification 의 user_read_created 인덱스를 partial (WHERE dismissed_at IS NULL) 로 전환
--
-- spec/1-data-model.md §3 인덱스 전략 (Notification (user_id, is_read, created_at DESC) WHERE dismissed_at IS NULL)
-- spec/data-flow/8-notifications.md Rationale "Hard delete 가 아닌 soft delete"
--
-- 목록·미읽음 카운트 쿼리는 항상 `dismissed_at IS NULL` 을 적용하므로 partial 인덱스로 충분하다.
-- dismissed row 가 인덱스에서 빠지므로 visible 알림이 dismissed 보다 적을수록 인덱스 크기가 작다.
--
-- (workspace_id, created_at DESC) 인덱스는 partial 로 변환하지 않는다 — 향후 admin/감사 쿼리가
-- dismissed 포함 전체 row 를 볼 여지를 둔다.
--
-- 비-트랜잭션 (executeInTransaction=false, V056__notification_active_partial_index.conf) — CREATE/DROP
-- INDEX CONCURRENTLY 가 transaction block 안에서 실행 불가하기 때문.
-- 순서:
--   1) CREATE 새 partial 인덱스 CONCURRENTLY (다른 이름)
--   2) DROP 옛 비-partial 인덱스 CONCURRENTLY
-- IF NOT EXISTS / IF EXISTS 를 둬 재실행 안전성 (CONCURRENTLY 실패 후 부분 상태 복구 시) 확보.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_user_read_created_active
    ON notification (user_id, is_read, created_at DESC)
    WHERE dismissed_at IS NULL;

DROP INDEX CONCURRENTLY IF EXISTS idx_notification_user_read_created;
