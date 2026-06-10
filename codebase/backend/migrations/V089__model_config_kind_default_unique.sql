-- Unified Model Management (PR1) — is_default 유니크를 (workspace_id, kind) 범위로 재정의
-- spec/1-data-model.md §2.16 (is_default per (workspace, kind)), spec/data-flow/7-llm-usage.md
--
-- 기존 llm_config 는 workspace 당 default 1개였다. ModelConfig 는 kind 별로 default 1개여야
-- 하므로 partial unique 를 (workspace_id, kind) 로 확장한다. trigger·index 이름도 정리한다.

-- 안전: 동일 (workspace_id) 에 is_default=true 가 여러 개면(이론상 기존 제약으로 없음, 멱등 방어)
-- created_at 최신 1개만 남기고 나머지 false. 현 단계는 모두 kind='chat' 이라 (workspace_id) 기준.
UPDATE model_config m
SET is_default = false
WHERE m.is_default = true
  AND m.id <> (
    SELECT m2.id FROM model_config m2
    WHERE m2.workspace_id = m.workspace_id AND m2.kind = m.kind AND m2.is_default = true
    ORDER BY m2.created_at DESC, m2.id DESC
    LIMIT 1
  );

DROP INDEX IF EXISTS llm_config_workspace_default_unique;

CREATE UNIQUE INDEX model_config_workspace_kind_default_unique
  ON model_config (workspace_id, kind)
  WHERE is_default = true;

-- Validate the NOT VALID constraint added in V088 — rows are already clean after
-- the UPDATE above, so this takes only a brief ShareUpdateExclusiveLock instead of
-- the full-table ACCESS EXCLUSIVE acquired by adding a validated constraint.
ALTER TABLE model_config VALIDATE CONSTRAINT chk_model_config_kind;

-- 트리거 이름 정리(동작 동일 — V001 공용 함수 재사용).
ALTER TRIGGER trg_llm_config_updated_at ON model_config
  RENAME TO trg_model_config_updated_at;

-- DOWN:
-- ALTER TRIGGER trg_model_config_updated_at ON model_config RENAME TO trg_llm_config_updated_at;
-- DROP INDEX IF EXISTS model_config_workspace_kind_default_unique;
-- CREATE UNIQUE INDEX llm_config_workspace_default_unique
--   ON model_config (workspace_id) WHERE is_default = true;
