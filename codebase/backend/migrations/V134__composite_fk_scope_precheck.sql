-- V134: 복합 FK(V135~V147) 사전 점검 — 서버 버전이 낮거나 범위가 어긋난 행이 있으면 스키마를 바꾸기 전에 멈춘다
--
-- NERV CLE-PLAT-DATA Rationale 「워크스페이스 범위 참조를 복합 FK 로도 막는다 (2026-10-05)」, NERV Task CLE-T-QTRRE6.
--
-- V135~V140 이 부모 UNIQUE 인덱스를 만들고 V141~V146 이 아래 열일곱 참조의 단일 FK 를 `(참조, workspace_id)` ·
-- `(참조, workflow_id)` 복합 FK 로 바꾼 뒤 V147 이 기존 행을 VALIDATE 한다. 그 전에 두 가지를 본다.
--
-- 1) 서버 버전: V141~V146 의 `ON DELETE SET NULL (컬럼 목록)` 은 PostgreSQL 15 부터다. 그 아래면 V135~V140 이 인덱스를 먼저
--    만든 뒤에 FK 파일이 실패하므로 여기서 멈춘다.
-- 2) 범위가 어긋난 행: 참조한 부모가 다른 워크스페이스(노드 · 연결선은 다른 워크플로우)에 있는 행이 하나라도 있으면 V147 이
--    실패한다. 그 전에 인덱스와 NOT VALID 제약을 남기지 않도록 참조마다 위반 행 수와 행 id(앞의 sample_limit 개)를 모아 한 번에
--    알리고 멈춘다. 선례는 V108(NERV CLE-ACCT-DATA, 개인 워크스페이스 중복 사전 검증)이다.
--
-- **자동으로 고치지 않는다** — 행마다 어느 쪽이 맞는지 데이터만으로 정할 수 없다. 처분은 운영자가 정한다(트리거
-- `workflow_id` 는 지우고 같은 워크스페이스의 워크플로우로 새로 만들고, NULL 을 허용하는 참조는 끊거나 같은 범위의 행으로
-- 바꾸고, 연결선 끝점은 그 워크플로우를 다시 저장하고, 세션 · 테스트 데이터셋은 지운다. 스케줄 `trigger_id` 는 정상 경로로
-- 생기지 않으므로 경위부터 확인한다). 고친 뒤 `repair` → `migrate` 로 다시 돈다. 2026-10-05 운영 DB 에서 열여섯 참조의
-- 점검이 0 행이었다. 워크플로우 테스트 데이터셋은 이 파일이 처음 본다.
--
-- 읽기만 하므로 다시 돌려도 안전하다. 트랜잭션 기본(.conf 없음). e2e `composite-fk-scope.e2e-spec.ts` 가 이 파일을 그대로
-- 돌려 교차 행이 있을 때 멈추는지 확인한다.
DO $$
DECLARE
  min_server_version CONSTANT int := 150000;
  sample_limit CONSTANT int := 10;
  -- {자식 테이블, 참조 컬럼, 부모 테이블, 범위 컬럼}
  checks CONSTANT text[][] := ARRAY[
    ['trigger', 'workflow_id', 'workflow', 'workspace_id'],
    ['trigger', 'auth_config_id', 'auth_config', 'workspace_id'],
    ['schedule', 'trigger_id', 'trigger', 'workspace_id'],
    ['alert_rule', 'workflow_id', 'workflow', 'workspace_id'],
    ['workflow', 'folder_id', 'folder', 'workspace_id'],
    ['folder', 'parent_id', 'folder', 'workspace_id'],
    ['workflow_assistant_session', 'workflow_id', 'workflow', 'workspace_id'],
    ['workflow_assistant_session', 'llm_config_id', 'model_config', 'workspace_id'],
    ['knowledge_base', 'embedding_model_config_id', 'model_config', 'workspace_id'],
    ['knowledge_base', 'extraction_llm_config_id', 'model_config', 'workspace_id'],
    ['knowledge_base', 'rerank_config_id', 'model_config', 'workspace_id'],
    ['knowledge_base', 'rerank_llm_config_id', 'model_config', 'workspace_id'],
    ['workflow_test_dataset', 'workflow_id', 'workflow', 'workspace_id'],
    ['node', 'container_id', 'node', 'workflow_id'],
    ['node', 'tool_owner_id', 'node', 'workflow_id'],
    ['edge', 'source_node_id', 'node', 'workflow_id'],
    ['edge', 'target_node_id', 'node', 'workflow_id']
  ];
  c text[];
  child_table text;
  ref_column text;
  parent_table text;
  scope_column text;
  violations bigint;
  sample text;
  report text := '';
BEGIN
  IF current_setting('server_version_num')::int < min_server_version THEN
    RAISE EXCEPTION
      'V134: PostgreSQL 15 or later is required (server_version %). The composite FKs (V141-V146) use ON DELETE SET NULL (column list).',
      current_setting('server_version');
  END IF;

  FOREACH c SLICE 1 IN ARRAY checks LOOP
    child_table := c[1];
    ref_column := c[2];
    parent_table := c[3];
    scope_column := c[4];
    EXECUTE format(
      'SELECT count(*), string_agg(id::text, '', '' ORDER BY id) FILTER (WHERE rn <= %5$s)
         FROM (SELECT child.id, row_number() OVER (ORDER BY child.id) AS rn
                 FROM %1$I child JOIN %3$I parent ON parent.id = child.%2$I
                WHERE parent.%4$I <> child.%4$I) v',
      child_table, ref_column, parent_table, scope_column, sample_limit)
      INTO violations, sample;
    IF violations > 0 THEN
      report := report || format(E'\n  %s.%s -> %s(%s): %s row(s), e.g. %s',
        child_table, ref_column, parent_table, scope_column, violations, sample);
    END IF;
  END LOOP;

  IF report <> '' THEN
    RAISE EXCEPTION
      'V134: rows reference a parent in another workspace/workflow. The composite FKs (V141-V146, VALIDATE in V147) cannot be added until an operator fixes them row by row (no auto-fix: the right side is not decidable from data).%',
      report;
  END IF;
END $$;

-- DOWN: 없음(스키마를 바꾸지 않는다).
