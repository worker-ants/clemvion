-- V069: node_execution.status 에 'cancelled' 추가
--
-- 관련 spec:
--   - spec/1-data-model.md §2.14 (NodeExecution.status enum)
--   - spec/5-system/4-execution-engine.md §1.2 (NodeExecution 상태)
--   - spec/conventions/node-cancellation.md §5.1 (AbortError → cancelled 분류)
--
-- 결정 — 단일 statement 허용 (README §1 예외 조건 충족):
--   - 'cancelled' 은 신규 enum 값이라 기존 row 위배가 schema 적으로 0건 (NOT VALID 2-step 의 이득 없음).
--   - V065 (auth_config type 확장) 과 동일 패턴.
--
-- 호환성: 기존 pending/running/completed/failed/skipped/waiting_for_input row 무영향.
-- 외부 abortSignal 로 노드 외부 I/O 가 중단된 경우(핸들러가 throw 한 AbortError)
-- 엔진이 failed 가 아닌 cancelled 로 분류한다 (node-cancellation §5.1).

ALTER TABLE node_execution DROP CONSTRAINT node_execution_status_check;
ALTER TABLE node_execution ADD CONSTRAINT node_execution_status_check
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'skipped', 'waiting_for_input'));
