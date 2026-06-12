-- Unified Model Management (PR4b) — KB 임베딩 legacy → 1급 embedding ModelConfig repoint
-- spec/5-system/8-embedding-pipeline.md §5.5, spec/1-data-model.md §2.11
-- plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md §범위 1
--
-- 목적: V094 에서 legacy 컬럼(embedding_llm_config_id, embedding_model)을 DROP 하기 전에,
-- `embedding_model_config_id IS NULL` 인 모든 KB 를 1급 kind=embedding ModelConfig 로 repoint 한다.
-- 저장된 임베딩 벡터는 불변이므로, DROP 후에도 "저장 당시와 동일한 provider+model+dimension" 으로
-- resolve 되어야 검색이 깨지지 않는다. 따라서 **현재 resolveEmbedding 이 실제로 resolve 하는 대상**을
-- 그대로 재현하도록 repoint 우선순위를 resolveEmbedding step 순서와 정확히 일치시킨다:
--   1) ws default kind=embedding 존재 → 그 config 로 직접 pin (step-2; 새 row 없음, model=config.defaultModel).
--      (embedding_llm_config_id 가 set 이어도 ws default embedding 이 있으면 런타임은 step-2 로 가므로 우선.)
--   2) else embedding_llm_config_id NOT NULL → 그 config 의 provider/api_key/base_url 복사 +
--      default_model = KB.embedding_model 로 새 kind=embedding config 생성 후 pin (step-3a).
--   3) else ws default kind=chat 존재 → 그 config creds 복사 + default_model = KB.embedding_model (step-3b).
--   4) else → 매칭 불가. 아래 fail-loud DO 블록이 마이그레이션 전체를 RAISE 로 롤백한다.
--
-- 원칙: 원래 사용하던 모델 문자열·차원을 한 글자도 바꾸지 않고 보존한다 (임베딩 차원 mismatch = 검색 깨짐).
-- api_key 는 암호화된 컬럼을 그대로 복사하므로 재암호화 불필요(동일 ciphertext 보존).
--
-- 비가역성: 본 마이그레이션 자체는 row INSERT/UPDATE 만 하므로 기술적으로는 비파괴이나, 후속 V094 가
-- 비가역 DROP 이므로 V093 은 그 전에 NULL KB 0건을 fail-loud 로 보증하는 게이트 역할을 한다.
-- Flyway 는 Postgres 단일 트랜잭션이라 fail-loud RAISE 시 본 마이그레이션 전체가 롤백되고
-- V094 는 실행되지 않는다(검증 통과 후에만 DROP).
--
-- DOWN: (forward-only) 생성된 kind=embedding config row 와 repoint 된 FK 는 자동 롤백 대상이 아니다.

-- ── 1) step-2: ws default kind=embedding 으로 직접 pin ──────────────────────────────
UPDATE knowledge_base kb
SET embedding_model_config_id = d.id
FROM model_config d
WHERE kb.embedding_model_config_id IS NULL
  AND d.workspace_id = kb.workspace_id
  AND d.kind = 'embedding'
  AND d.is_default = TRUE;

-- ── 2)·3) step-3: 남은 NULL KB 를 legacy creds(embedding_llm_config_id | ws default chat)로 재현 ──
WITH legacy_kb AS (
  SELECT
    kb.id                AS kb_id,
    kb.workspace_id      AS workspace_id,
    kb.embedding_model   AS embedding_model,
    kb.embedding_dimension AS embedding_dimension,
    -- creds 출처 config: embedding_llm_config_id 우선, 없으면 ws default chat.
    COALESCE(
      kb.embedding_llm_config_id,
      (SELECT c.id FROM model_config c
        WHERE c.workspace_id = kb.workspace_id AND c.kind = 'chat' AND c.is_default = TRUE
        LIMIT 1)
    ) AS src_config_id
  FROM knowledge_base kb
  WHERE kb.embedding_model_config_id IS NULL
),
-- src_config_id 가 NULL 인 KB(=creds 출처 전무)는 여기서 탈락 → fail-loud 대상.
legacy_src AS (
  SELECT
    lk.kb_id, lk.workspace_id, lk.embedding_model, lk.embedding_dimension,
    src.provider, src.api_key, src.base_url
  FROM legacy_kb lk
  JOIN model_config src ON src.id = lk.src_config_id
),
-- 동일 (workspace, creds, model, dim) 조합당 embedding config 1개만 생성(dedup).
distinct_src AS (
  SELECT DISTINCT workspace_id, provider, api_key, base_url, embedding_model, embedding_dimension
  FROM legacy_src
),
created AS (
  INSERT INTO model_config (
    id, workspace_id, kind, provider, name, api_key, base_url,
    default_model, default_params, dimension, is_default, created_at, updated_at
  )
  SELECT
    uuid_generate_v4(), workspace_id, 'embedding', provider,
    LEFT('[migrated] ' || embedding_model, 255),
    api_key, base_url, embedding_model, '{}'::jsonb, embedding_dimension,
    FALSE, now(), now()
  FROM distinct_src
  RETURNING id, workspace_id, provider, api_key, base_url, default_model, dimension
)
UPDATE knowledge_base kb
SET embedding_model_config_id = c.id
FROM legacy_src ls
JOIN created c
  ON  c.workspace_id = ls.workspace_id
  AND c.provider     = ls.provider
  AND c.api_key      IS NOT DISTINCT FROM ls.api_key
  AND c.base_url     IS NOT DISTINCT FROM ls.base_url
  AND c.default_model = ls.embedding_model
  AND c.dimension    IS NOT DISTINCT FROM ls.embedding_dimension
WHERE kb.id = ls.kb_id
  AND kb.embedding_model_config_id IS NULL;

-- ── 4) fail-loud 검증: 매칭 못한 KB 가 1건이라도 있으면 전체 롤백 + id 목록 출력 ──────────
DO $$
DECLARE
  orphan_count INTEGER;
  orphan_ids   TEXT;
BEGIN
  SELECT count(*), string_agg(id::text, ', ')
    INTO orphan_count, orphan_ids
    FROM knowledge_base
   WHERE embedding_model_config_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'V093 repoint 실패: % 개 KB 를 repoint 할 수 없습니다(creds 출처 config 부재 — embedding_llm_config_id·ws default chat·ws default embedding 모두 없음). 수동 처리 후 재시도하세요. KB ids: %',
      orphan_count, orphan_ids;
  END IF;
END $$;
