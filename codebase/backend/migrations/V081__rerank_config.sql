-- ============================================================
-- RerankConfig (Spec data-model §2.16.1)
-- ============================================================
-- cross-encoder 리랭커 provider 설정. chat/embedding 과 API shape 가 달라
-- llm_config 와 분리한 sibling 리소스. DDL 은 llm_config (V001 §17) 를 미러링하되
-- 두 가지가 다르다:
--   1) api_key 는 NULLABLE — tei/local 셀프호스팅은 키 불요 (외부 provider 만 필수).
--   2) default_params 컬럼 없음 — 리랭커는 호출 파라미터 프리셋이 없다.
CREATE TABLE rerank_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(500),
    base_url VARCHAR(500),
    default_model VARCHAR(100) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- workspace 당 is_default=true 레코드는 최대 1개 (partial unique index).
-- is_default=false 는 여러 개 허용. (entity @Index 와 동일)
CREATE UNIQUE INDEX rerank_config_workspace_default_unique
    ON rerank_config (workspace_id)
    WHERE is_default = TRUE;

-- updated_at 자동 갱신 트리거 (V001 의 공용 함수 재사용).
CREATE TRIGGER trg_rerank_config_updated_at
    BEFORE UPDATE ON rerank_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
