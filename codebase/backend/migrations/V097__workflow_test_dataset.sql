-- V097: workflow_test_dataset — 워크플로우 Mock Input 저장 데이터셋 (§2.2 저장/이름 지정).
--
-- spec SoT: spec/3-workflow-editor/3-execution.md §2.2, spec/1-data-model.md §2.x.
--
-- 워크플로우 에디터의 "Run with Input" Mock Input 을 이름 붙여 저장·재사용한다.
-- 권한 모델 (spec §2.2 Rationale):
--   - owner_id: 소유 유저. 생성 시 항상 요청 유저, 수정/삭제 권한의 단일 기준.
--   - visibility: 'private'(기본, 소유자만) / 'workspace'(워크스페이스 read-only 공유).
--     공유본을 타 유저가 수정하려면 clone(자기 소유 private 사본 생성) 한다.
--   - workspace_id: 워크스페이스 격리·공유 목록 쿼리용 (workflow 의 workspace 비정규화).
-- 모든 FK 는 ON DELETE CASCADE — 워크플로우/유저/워크스페이스 삭제 시 데이터셋 정리.
--
-- UNIQUE (workflow_id, owner_id, name): 한 유저가 같은 워크플로우에 같은 이름 중복 저장 금지.
-- 인덱스:
--   (owner_id, workflow_id): 유저의 해당 워크플로우 데이터셋 조회.
--   (workspace_id, visibility): 워크스페이스 공유본 목록 필터.

CREATE TABLE workflow_test_dataset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  visibility VARCHAR(20) NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'workspace')),
  name VARCHAR(255) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workflow_test_dataset_owner_name
    UNIQUE (workflow_id, owner_id, name)
);

CREATE INDEX idx_workflow_test_dataset_owner_workflow
  ON workflow_test_dataset (owner_id, workflow_id);

CREATE INDEX idx_workflow_test_dataset_workspace_visibility
  ON workflow_test_dataset (workspace_id, visibility);

COMMENT ON TABLE workflow_test_dataset IS
  'Saved Mock Input datasets for workflow manual execution (spec/3-workflow-editor/3-execution.md §2.2). owner-private by default, optional workspace read-only sharing; non-owners clone to edit.';

-- DOWN:
-- DROP TABLE IF EXISTS workflow_test_dataset;
