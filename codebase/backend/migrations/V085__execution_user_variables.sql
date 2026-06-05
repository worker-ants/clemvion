-- user-defined variables durable park resume (spec/5-system/4-execution-engine.md
-- §6.1/§6.2/§7.5, spec/1-data-model.md §2.13 Execution).
--
-- `waiting_for_input` park 진입 시 엔진이 ExecutionContext.variables 중 시스템
-- `__*` 접두를 제외한 사용자 정의분(Variable Declaration / Modification 노드 값)을
-- 이 컬럼에 commit 한다. rehydration(재시작/타 인스턴스 재개)이 여기서 복원하므로,
-- park 이전에 설정한 변수를 park 이후 노드가 표현식(`$var.X`)으로 무손실 참조한다.
-- 시스템 `__*` 변수는 rehydration 이 별도 재주입하므로 본 컬럼에 미포함.
--
-- 컬럼은 nullable·default null — park 한 적 없는 실행 / 배포 이전 row 는 NULL 이며,
-- 그 경우 rehydration 은 사용자 변수 없이 시작한다 (회귀 없음).
-- A1 의 conversation_thread(V084) 와 동일 패턴.
ALTER TABLE execution
  ADD COLUMN user_variables JSONB NULL;

COMMENT ON COLUMN execution.user_variables IS
  'Durable snapshot of user-defined ExecutionContext.variables (system __* excluded), committed atomically with the waiting_for_input transition at each park. Read by §7.5 rehydration to restore user variables so post-park nodes reference pre-park values. NULL = never parked / pre-deploy row.';
