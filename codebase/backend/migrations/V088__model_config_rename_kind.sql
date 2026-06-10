-- Unified Model Management (PR1) — llm_config → model_config + kind/dimension
-- spec/1-data-model.md §2.16 ModelConfig, spec/2-navigation/6-config.md Part B
-- plan/in-progress/unified-model-management.md (V088~V092)
--
-- llm_config 를 in-place 로 model_config 로 진화시킨다. chat row 의 UUID 가 보존되어
-- 노드 config.llmConfigId(JSONB)·assistant·usage_log·extraction·rerank_llm FK 참조가
-- 무변경으로 유지된다. kind 판별자(chat|embedding|rerank)와 embedding 전용 dimension 을
-- 추가하고, api_key 를 NULLABLE 로 완화한다(자가호스팅 local/tei 는 키 불요 — V090 에서
-- 흡수할 rerank 행 및 embedding local 행과 정합).
--
-- NOTE: V088~V092 의 절대 번호는 작성 시점(max V087) 기준 예시다. 구현 머지 시점에
-- exec-intake-queue-impl PR2b 등 병렬 plan 과 V088 선점이 겹치면
-- scripts/check-migration-versions.py 로 당시 max+1 부터 순차 재할당한다(순서·내용 고정).

ALTER TABLE llm_config RENAME TO model_config;

ALTER TABLE model_config
  ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'chat',
  ADD COLUMN dimension INTEGER;

-- NOT VALID avoids an ACCESS EXCLUSIVE full-table scan on existing rows at deploy time.
-- V089 VALIDATES this constraint in a separate transaction (short lock, rows already clean).
ALTER TABLE model_config
  ADD CONSTRAINT chk_model_config_kind
    CHECK (kind IN ('chat', 'embedding', 'rerank')) NOT VALID;

-- 자가호스팅(local/tei) 및 rerank 흡수를 위해 api_key NULL 허용으로 완화.
ALTER TABLE model_config ALTER COLUMN api_key DROP NOT NULL;

-- DOWN:
-- ALTER TABLE model_config ALTER COLUMN api_key SET NOT NULL;
-- ALTER TABLE model_config DROP CONSTRAINT chk_model_config_kind;
-- ALTER TABLE model_config DROP COLUMN dimension;
-- ALTER TABLE model_config DROP COLUMN kind;
-- ALTER TABLE model_config RENAME TO llm_config;
