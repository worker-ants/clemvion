-- Unified Model Management (PR2) — KB 임베딩 1급화: embedding_model_config_id 신설
-- spec/1-data-model.md §2.11, spec/2-navigation/6-config.md §B.5, spec/5-system/8-embedding-pipeline.md
-- plan/in-progress/unified-model-management.md PR2
--
-- 임베딩을 chat용 model_config(kind=chat) piggyback 에서 분리해, KB 가 1급
-- model_config(kind=embedding) 를 직접 참조하도록 신규 FK 컬럼을 추가한다.
--
-- 전략: **점진적·하위호환(저위험)**. 데이터 마이그레이션(기존 KB 파생/repoint) 없음.
-- 런타임 resolve 폴백 체인이 무중단을 보장한다:
--   (1) embedding_model_config_id 지정 → kind=embedding config 의 default_model 사용
--   (2) 미지정 → 워크스페이스 default kind=embedding config
--   (3) 둘 다 없음 → 기존 embedding_llm_config_id + embedding_model 문자열(legacy chat) 폴백
-- 구 컬럼(embedding_llm_config_id, embedding_model)은 legacy 폴백용으로 V092까지 존치.
--
-- NOTE: 절대 번호 V091 은 작성 시점(max V090) 기준. 머지 시점 충돌 시
-- scripts/check-migration-versions.py 로 재할당.

ALTER TABLE knowledge_base ADD COLUMN embedding_model_config_id UUID NULL;

ALTER TABLE knowledge_base
  ADD CONSTRAINT fk_kb_embedding_model_config
    FOREIGN KEY (embedding_model_config_id)
    REFERENCES model_config(id) ON DELETE SET NULL;

-- DOWN:
-- ALTER TABLE knowledge_base DROP CONSTRAINT IF EXISTS fk_kb_embedding_model_config;
-- ALTER TABLE knowledge_base DROP COLUMN IF EXISTS embedding_model_config_id;
