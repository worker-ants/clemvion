-- 중첩 sub-workflow(executeInline) blocking 노드 durable resume (D6)
-- spec/5-system/4-execution-engine.md §6.2/§7.5/§Rationale, spec/1-data-model.md §2.13 Execution.
--
-- 중첩 sub-workflow 안의 blocking 노드(form/button/AI 멀티턴)가 `waiting_for_input`
-- 으로 park 할 때, 재개에 필요한 **executeInline 호출 체인**(outermost→waiting inner
-- 직전)을 이 컬럼에 commit 한다. rehydration(§7.5)이 이 스택으로 top-level→sub-workflow
-- 프레임을 재귀적으로 재진입(executeInline 재호출)해 최내층 waiting 노드까지 도달한다.
-- 노드 출력은 같은 executionId 타임라인(execution_node_log)에, thread/variables 는
-- conversation_thread(V084)/user_variables(V085)에 이미 영속되므로, 빠진 조각은
-- 호출 체인 구조뿐이다 — 이 컬럼이 그것을 채워 in-memory 코루틴 의존을 제거한다.
--
-- 형태: { version: number, frames: [{ workflowId, invokerNodeId, recursionDepth }] }.
-- version 은 CALL_STACK_SCHEMA_VERSION(엔진 상수, CHECKPOINT_SCHEMA_VERSION 과 독립).
-- 컬럼은 nullable·default null — top-level park(중첩 깊이 0) / park 한 적 없는 실행 /
-- 배포 이전 row 는 NULL 이며, 그 경우 rehydration 은 top-level 단일 레벨로 재개한다
-- (회귀 없음). conversation_thread(V084)·user_variables(V085) 와 동일 패턴.
ALTER TABLE execution
  ADD COLUMN resume_call_stack JSONB NULL;

COMMENT ON COLUMN execution.resume_call_stack IS
  'Durable snapshot of the executeInline call chain (outermost->innermost waiting node) committed atomically with the waiting_for_input transition when a blocking node parks inside a nested sub-workflow. Read by §7.5 rehydration to recursively re-enter executeInline frames and reach the innermost waiting node. NULL = top-level park / never parked / pre-deploy row.';
