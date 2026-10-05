-- V143: 폴더를 가리키는 워크플로우 folder_id · 폴더 parent_id 의 단일 FK 를 복합 FK 로 바꾼다(NOT VALID)
--
-- NERV CLE-PLAT-DATA Rationale 「워크스페이스 범위 참조를 복합 FK 로도 막는다 (2026-10-05)」, NERV Task CLE-T-QTRRE6.
--
-- 목적 · 삭제 동작 · 이름 · 잠금은 V141 머리의 «공통» 을 따른다. 기존 행 검증은 V147 이다.
--
-- 옛 이름 → 새 이름, 삭제 동작:
--   workflow_folder_id_fkey → fk_workflow_folder_id  SET NULL (folder_id)
--   folder_parent_id_fkey   → fk_folder_parent_id    CASCADE
SET LOCAL lock_timeout = '3s';

-- 1) 부모 UNIQUE — V137 이 만든 인덱스를 같은 이름의 제약으로 붙인다
ALTER TABLE folder ADD CONSTRAINT uq_folder_id_workspace_id UNIQUE USING INDEX uq_folder_id_workspace_id;

-- 2) 자식 FK
ALTER TABLE workflow
  DROP CONSTRAINT workflow_folder_id_fkey,
  ADD CONSTRAINT fk_workflow_folder_id FOREIGN KEY (folder_id, workspace_id)
    REFERENCES folder (id, workspace_id) ON DELETE SET NULL (folder_id) NOT VALID;

ALTER TABLE folder
  DROP CONSTRAINT folder_parent_id_fkey,
  ADD CONSTRAINT fk_folder_parent_id FOREIGN KEY (parent_id, workspace_id)
    REFERENCES folder (id, workspace_id) ON DELETE CASCADE NOT VALID;

-- DOWN: 옛 FK 를 NOT VALID 로 되살리고 커밋한 뒤 따로 VALIDATE 한다. 제약을 지우면 인덱스도 지워지므로 V137 DOWN 은 할 일이 없다.
--   SET LOCAL lock_timeout = '3s';
--   ALTER TABLE folder DROP CONSTRAINT fk_folder_parent_id,
--     ADD CONSTRAINT folder_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES folder (id) ON DELETE CASCADE NOT VALID;
--   ALTER TABLE workflow DROP CONSTRAINT fk_workflow_folder_id,
--     ADD CONSTRAINT workflow_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES folder (id) ON DELETE SET NULL NOT VALID;
--   ALTER TABLE folder DROP CONSTRAINT uq_folder_id_workspace_id;
--   -- 커밋한 뒤
--   ALTER TABLE folder VALIDATE CONSTRAINT folder_parent_id_fkey;
--   ALTER TABLE workflow VALIDATE CONSTRAINT workflow_folder_id_fkey;
