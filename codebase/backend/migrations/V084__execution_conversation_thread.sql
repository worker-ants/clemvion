-- ConversationThread durable park resume (spec/conventions/conversation-thread.md §4·§8.4,
-- spec/5-system/4-execution-engine.md §6.2/§7.5, spec/1-data-model.md §2.13 Execution).
--
-- `waiting_for_input` park 진입 시 엔진이 ExecutionContext.conversationThread 전체
-- 스냅샷을 이 컬럼에 commit 한다. rehydration(다른 인스턴스/재시작 후 재개)이 여기서
-- thread 를 무손실 복원(runningSummary/summarizedUpToSeq 포함)하므로, park→재시작 시
-- 빈 thread 리셋으로 인한 대화 맥락 소실이 사라진다.
--
-- 컬럼은 nullable·default null — park 한 적 없는 실행/배포 이전 row 는 NULL 이며,
-- 그 경우 rehydration 은 기존대로 빈 thread 로 시작한다 (회귀 없음).
ALTER TABLE execution
  ADD COLUMN conversation_thread JSONB NULL;

COMMENT ON COLUMN execution.conversation_thread IS
  'Durable snapshot of ExecutionContext.conversationThread, committed atomically with the waiting_for_input transition at each park. Read by §7.5 rehydration to losslessly restore the in-flight thread. NULL = never parked / pre-deploy row. Distinct from the per-node execution-history SoT (node_execution.output_data/interaction_data).';
