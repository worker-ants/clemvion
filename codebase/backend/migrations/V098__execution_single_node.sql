-- V098: execution 행에 단일 노드 실행(§1.3) 메타데이터 컬럼 추가.
-- (spec/3-workflow-editor/3-execution.md §1.3 단일 노드 테스트, §9 API,
--  spec/5-system/13-replay-rerun.md §15 C3 재조정, spec/1-data-model.md §2.13 Execution.)
--
-- 단일 노드 실행은 `POST /api/workflows/:id/nodes/:nodeId/execute` 로 진입해
-- 대상 노드 1개만 실행하고 downstream 으로 진행하지 않는다(§1.2 Run-from-Selected
-- 와 구분). 입력은 직전 실행(previous_execution_id)의 상류(predecessor) 노드
-- 출력을 nodeOutputCache 에 pre-seed 해 자동 주입하며, 미지정 시 수동 입력으로 대체한다.
--
-- 큐 worker(runExecutionFromQueue)가 execution 행을 재조회해 runExecution 에
-- 전달하므로(dry_run / re_run_of / source_ip 선례와 동일 패턴), 두 값을 job payload
-- 가 아닌 execution 컬럼으로 영속한다.
--
--   single_node_id       UUID — 단일 노드 실행 대상 노드 id. NULL = 일반/부분 실행.
--                         `_node_id` 접미사가 Node FK 도메인을 표기하고, `single_`
--                         한정자는 §1.2 부분실행의 fromNodeId(컬럼 아님, input_data 경유)
--                         와 구분한다. dry_run/re_run_of 와 동일한 mode-encoding 컬럼.
--   previous_execution_id UUID — 입력 seed 출처가 되는 직전 실행 id. NULL = seed 없음
--                         (수동 입력만). re_run_of(re-run 파생 부모)와 의미가 다르다
--                         — 입력 주입 참조일 뿐 chain 관계가 아니다.
--
-- 두 컬럼 모두 nullable·default null — 회귀 없음(기존 row·일반 실행은 NULL 유지).
-- re_run_of/chain_id 선례를 따라 명시적 FK 제약은 두지 않는다(디버그 메타데이터;
-- 노드/실행 삭제 시 dangling 가능하나 조회 시 무시).
-- 조회 패턴 없음(디버그 전용) → 인덱스 미추가.
ALTER TABLE execution
  ADD COLUMN single_node_id UUID NULL,
  ADD COLUMN previous_execution_id UUID NULL;

COMMENT ON COLUMN execution.single_node_id IS
  'Single-node execution (§1.3) target node id. NULL = full/partial run. Set via POST /api/workflows/:id/nodes/:nodeId/execute; engine runs only this node (no downstream).';

COMMENT ON COLUMN execution.previous_execution_id IS
  'Source execution whose predecessor NodeExecution.output_data is pre-seeded as the single-node run input (§1.3). NULL = manual input only. Not a chain relation (distinct from re_run_of).';

-- DOWN:
-- ALTER TABLE execution DROP COLUMN IF EXISTS previous_execution_id;
-- ALTER TABLE execution DROP COLUMN IF EXISTS single_node_id;
