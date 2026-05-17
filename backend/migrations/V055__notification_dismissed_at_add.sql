-- V055: notification 테이블에 dismissed_at 컬럼 추가 (soft delete)
--
-- spec/data-flow/8-notifications.md §2.1, §4 (Dismiss 흐름)
-- spec/1-data-model.md §2.19 (Notification 엔티티 필드)
--
-- 컬럼:
--   dismissed_at TIMESTAMPTZ NULL — 사용자가 닫은 시각.
--     NULL = visible (목록·미읽음 카운트 대상),
--     채워짐 = dismissed (목록·미읽음 카운트에서 제외).
--
-- partial index 전환은 별도 V056 (CONCURRENTLY, 비-트랜잭션) 에서 처리한다.
-- 기본 트랜잭션 OK — ALTER TABLE ADD COLUMN NULL 은 빠른 메타데이터-only 작업.

ALTER TABLE notification
    ADD COLUMN dismissed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN notification.dismissed_at IS
    'soft delete — NULL=visible, 채워짐=사용자가 닫은 시각. 목록·미읽음 카운트에서 제외 (spec/data-flow/8-notifications.md §4).';
