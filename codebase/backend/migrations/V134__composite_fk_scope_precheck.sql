-- V134: 복합 FK(V135~V142) 사전 점검 — 범위가 어긋난 행이 있으면 스키마를 바꾸기 전에 멈춘다
--
-- NERV CLE-PLAT-DATA Rationale 「워크스페이스 범위 참조를 복합 FK 로도 막는다 (2026-10-05)」, NERV Task CLE-T-QTRRE6.
--
-- V141 이 아래 열일곱 참조의 단일 FK 를 `(참조, workspace_id)` · `(참조, workflow_id)` 복합 FK 로 바꾸고 V142 가 기존 행을
-- VALIDATE 한다. 참조한 부모가 다른 워크스페이스(노드 · 연결선은 다른 워크플로우)에 있는 행이 하나라도 있으면 VALIDATE 가
-- 실패한다. 그 전에 V135~V141 이 인덱스와 NOT VALID 제약을 남기지 않도록, 스키마를 바꾸기 전에 참조마다 위반 행 수와
-- 행 id(앞의 10개)를 모아 한 번에 알리고 멈춘다. 선례는 V108(NERV CLE-ACCT-DATA, 개인 워크스페이스 중복 사전 검증)이다.
--
-- **자동으로 고치지 않는다** — 행마다 어느 쪽이 맞는지 데이터만으로 정할 수 없다. 처분은 운영자가 정한다(트리거
-- `workflow_id` 는 지우고 같은 워크스페이스의 워크플로우로 새로 만들고, NULL 을 허용하는 참조는 끊거나 같은 범위의 행으로
-- 바꾸고, 연결선 끝점은 그 워크플로우를 다시 저장하고, 세션 · 테스트 데이터셋은 지운다). 고친 뒤 `repair` → `migrate` 로
-- 다시 돈다. 2026-10-05 운영 DB 에서 열여섯 참조의 점검이 0 행이었다. 워크플로우 테스트 데이터셋은 이 파일이 처음 본다.
--
-- 읽기만 하므로 다시 돌려도 안전하다. 트랜잭션 기본(.conf 없음). e2e `composite-fk-scope.e2e-spec.ts` 가 이 파일을 그대로
-- 돌려 교차 행이 있을 때 멈추는지 확인한다.
DO $$
DECLARE
  -- {자식, 참조 컬럼, 부모, 범위 컬럼}
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
  violations bigint;
  sample text;
  report text := '';
BEGIN
  FOREACH c SLICE 1 IN ARRAY checks LOOP
    EXECUTE format(
      'SELECT count(*), string_agg(id::text, '', '' ORDER BY id) FILTER (WHERE rn <= 10)
         FROM (SELECT child.id, row_number() OVER (ORDER BY child.id) AS rn
                 FROM %1$I child JOIN %3$I parent ON parent.id = child.%2$I
                WHERE parent.%4$I <> child.%4$I) v',
      c[1], c[2], c[3], c[4])
      INTO violations, sample;
    IF violations > 0 THEN
      report := report || format(E'\n  %s.%s -> %s(%s): %s row(s), e.g. %s', c[1], c[2], c[3], c[4], violations, sample);
    END IF;
  END LOOP;

  IF report <> '' THEN
    RAISE EXCEPTION
      'V134: rows reference a parent in another workspace/workflow. The composite FKs (V141, VALIDATE in V142) cannot be added until an operator fixes them row by row (no auto-fix: the right side is not decidable from data).%',
      report;
  END IF;
END $$;

-- DOWN: 없음(스키마를 바꾸지 않는다).
