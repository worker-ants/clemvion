-- Unified Model Management (PR4, cleanup) — orphaned rerank_config 테이블 제거
-- spec/1-data-model.md §2.16, spec/2-navigation/6-config.md §3 R-3
--
-- V090(model_config_absorb_rerank) 에서 rerank_config 의 모든 행을
-- model_config(kind='rerank') 로 UUID 보존 복사했고, knowledge_base.rerank_config_id
-- FK 도 rerank_config → model_config 로 재타깃했다. 이후 어떤 엔티티/FK/리더도
-- rerank_config 테이블을 참조하지 않는다(PR4 에서 rerank-config 모듈·엔티티 제거 완료).
-- 따라서 본 테이블은 100% orphan 이며 안전하게 제거한다.
--
-- DOWN: 비가역. rerank_config 의 데이터는 V090 에서 이미 model_config 로 이관됐으므로
--       테이블 자체를 복원해도 원본 행은 복구되지 않는다(롤백 불가). 되돌림이 필요하면
--       model_config(kind='rerank') 에서 역추출해야 한다.

DROP TABLE IF EXISTS rerank_config;
