-- V107: notification 테이블에 background_run_id 컬럼 추가 (Background 본문 실패 attribution 전용)
--
-- spec/data-flow/8-notifications.md §2.1 (Schema 매핑), §1.1 (background_failed 행)
-- spec/1-data-model.md §2.19 (Notification 엔티티 필드)
-- spec/2-navigation/_layout.md §3.1 (알림 팝오버 딥링크 계약)
--
-- 배경 (선존 결함 해소):
--   `background_failed` 알림은 그동안 resource_type='background_run' / resource_id=backgroundRunId
--   (옛 NodeExecution 은 'execution'/executionId) 로 적재됐다. 그러나 팝오버 딥링크(href.ts)는
--   background_failed 를 /workflows/<resource_id> 로 라우팅하며 _layout.md §3.1 은 resource_id=workflow id
--   를 요구한다 → 클릭 시 404 (execution_failed/schedule_failed 는 이미 resource_id=workflow.id 로 정합).
--   동시에 background-runs 모니터링 API 는 같은 resource_id(=backgroundRunId)를 per-run attribution 에
--   소비하므로 단순 교체 불가.
--
-- 해소: 딥링크 요구(workflow id)와 attribution 요구(backgroundRunId)를 별도 컬럼으로 분리.
--   - resource_type='workflow' / resource_id=workflow.id  → 딥링크 (§3.1 계약, 3개 실패 type 일관)
--   - background_run_id UUID (본 컬럼)                    → attribution 전용 (background-runs 모니터링 API)
--
-- 안전성: 신규 nullable 컬럼이라 기존 row 는 전부 NULL. partial index 는 대상 row 0건이라
--   즉시(메타데이터 lock) 생성되므로 CONCURRENTLY 불요 — 기본 트랜잭션에서 ADD COLUMN + CREATE INDEX 동봉 OK.
--   (dismissed_at 의 V056 CONCURRENTLY 전환은 이미 채워진 컬럼의 index 재구성이라 별개 상황.)
--
-- 주의: 컬럼명이 V047 의 node_execution JSONB path 인덱스명(idx_node_execution_background_run_id)과
--   표기가 유사하나, V047 은 다른 테이블(node_execution)의 meta.backgroundRunId 부분 인덱스로 본 컬럼과 무관하다.
--
-- DOWN: DROP INDEX IF EXISTS idx_notification_background_run_id; ALTER TABLE notification DROP COLUMN IF EXISTS background_run_id;

ALTER TABLE notification
    ADD COLUMN background_run_id UUID NULL;

COMMENT ON COLUMN notification.background_run_id IS
    'Background 본문 실패(background_failed) 알림의 per-run attribution 키. background-runs 모니터링 API 전용. 딥링크는 resource_type/resource_id(=workflow)가 담당 (spec/data-flow/8-notifications.md §2.1).';

CREATE INDEX idx_notification_background_run_id
    ON notification (background_run_id)
    WHERE background_run_id IS NOT NULL;
