-- V146: 노드를 가리키는 노드 구조 참조 둘과 연결선 끝점 둘의 단일 FK 를 같은 워크플로우 복합 FK 로 바꾼다(NOT VALID)
--
-- NERV CLE-PLAT-DATA Rationale 「워크스페이스 범위 참조를 복합 FK 로도 막는다 (2026-10-05)」, NERV Task CLE-T-QTRRE6.
--
-- 목적 · 삭제 동작 · 이름 · 잠금은 V141 머리의 «공통» 을 따른다. 범위 컬럼은 `workflow_id` 다. 기존 행 검증은 V147 이다.
--
-- 옛 이름 → 새 이름, 삭제 동작:
--   node_container_id_fkey   → fk_node_container_id    SET NULL (container_id)
--   node_tool_owner_id_fkey  → fk_node_tool_owner_id   SET NULL (tool_owner_id)
--   edge_source_node_id_fkey → fk_edge_source_node_id  CASCADE
--   edge_target_node_id_fkey → fk_edge_target_node_id  CASCADE
SET LOCAL lock_timeout = '3s';

-- 1) 부모 UNIQUE — V140 이 만든 인덱스를 같은 이름의 제약으로 붙인다
ALTER TABLE node ADD CONSTRAINT uq_node_id_workflow_id UNIQUE USING INDEX uq_node_id_workflow_id;

-- 2) 자식 FK — 자식 테이블마다 한 문장으로 옛 FK 를 지우고 복합 FK 를 더한다
ALTER TABLE node
  DROP CONSTRAINT node_container_id_fkey,
  DROP CONSTRAINT node_tool_owner_id_fkey,
  ADD CONSTRAINT fk_node_container_id FOREIGN KEY (container_id, workflow_id)
    REFERENCES node (id, workflow_id) ON DELETE SET NULL (container_id) NOT VALID,
  ADD CONSTRAINT fk_node_tool_owner_id FOREIGN KEY (tool_owner_id, workflow_id)
    REFERENCES node (id, workflow_id) ON DELETE SET NULL (tool_owner_id) NOT VALID;

ALTER TABLE edge
  DROP CONSTRAINT edge_source_node_id_fkey,
  DROP CONSTRAINT edge_target_node_id_fkey,
  ADD CONSTRAINT fk_edge_source_node_id FOREIGN KEY (source_node_id, workflow_id)
    REFERENCES node (id, workflow_id) ON DELETE CASCADE NOT VALID,
  ADD CONSTRAINT fk_edge_target_node_id FOREIGN KEY (target_node_id, workflow_id)
    REFERENCES node (id, workflow_id) ON DELETE CASCADE NOT VALID;

-- DOWN: 옛 FK 를 NOT VALID 로 되살리고 커밋한 뒤 따로 VALIDATE 한다. 제약을 지우면 인덱스도 지워지므로 V140 DOWN 은 할 일이 없다.
--   SET LOCAL lock_timeout = '3s';
--   ALTER TABLE edge DROP CONSTRAINT fk_edge_source_node_id, DROP CONSTRAINT fk_edge_target_node_id,
--     ADD CONSTRAINT edge_source_node_id_fkey FOREIGN KEY (source_node_id) REFERENCES node (id) ON DELETE CASCADE NOT VALID,
--     ADD CONSTRAINT edge_target_node_id_fkey FOREIGN KEY (target_node_id) REFERENCES node (id) ON DELETE CASCADE NOT VALID;
--   ALTER TABLE node DROP CONSTRAINT fk_node_container_id, DROP CONSTRAINT fk_node_tool_owner_id,
--     ADD CONSTRAINT node_container_id_fkey FOREIGN KEY (container_id) REFERENCES node (id) ON DELETE SET NULL NOT VALID,
--     ADD CONSTRAINT node_tool_owner_id_fkey FOREIGN KEY (tool_owner_id) REFERENCES node (id) ON DELETE SET NULL NOT VALID;
--   ALTER TABLE node DROP CONSTRAINT uq_node_id_workflow_id;
--   -- 커밋한 뒤
--   ALTER TABLE edge VALIDATE CONSTRAINT edge_source_node_id_fkey;
--   ALTER TABLE edge VALIDATE CONSTRAINT edge_target_node_id_fkey;
--   ALTER TABLE node VALIDATE CONSTRAINT node_container_id_fkey;
--   ALTER TABLE node VALIDATE CONSTRAINT node_tool_owner_id_fkey;
