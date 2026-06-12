-- Unified Model Management (PR4b) — KB legacy 임베딩 컬럼 DROP (비가역)
-- spec/5-system/8-embedding-pipeline.md §5.5, spec/1-data-model.md §2.11
-- plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md §범위 1
--
-- 선행: V093 (repoint + fail-loud) 이 commit 된 경우에만 본 마이그레이션이 실행된다.
-- V093 의 fail-loud RAISE 가 NULL KB 0건을 보증하므로, 여기서 DROP 해도 모든 KB 는
-- 이미 embedding_model_config_id(1급 kind=embedding) 로 resolve 된다. resolveEmbedding step-3
-- (legacy 폴백) 코드는 동일 PR 에서 제거된다.
--
-- 비가역(IRREVERSIBLE): 컬럼 DROP 은 롤백 불가. embedding_llm_config_id·embedding_model 에
-- 담겼던 legacy 임베딩 식별 정보는 영구 소실된다. repoint(V093)로 1급 config 에 보존된 뒤이므로
-- 운영 데이터 손실은 없으나, V093 미적용 환경에서 본 마이그레이션을 단독 적용하면 안 된다
-- (Flyway 순차 적용이라 V093 → V094 순서가 강제됨).
--
-- 운영 배포 주의 (AccessExclusiveLock):
-- DROP CONSTRAINT + DROP COLUMN 은 각각 AccessExclusiveLock 을 획득해 해당 테이블 전체 읽기/쓰기를
-- 블로킹한다. knowledge_base row 수가 많거나 트래픽이 높은 시간대에는 lock 대기가 길어질 수 있으므로
-- low-traffic 배포 윈도우(예: 야간)에 적용하는 것을 권장한다. lock_timeout 을 짧게 설정해 두면
-- 타임아웃 시 본 마이그레이션이 실패(Flyway transaction rollback)하고 다음 배포 시 재시도 가능하다.
--
-- DOWN: IRREVERSIBLE — 복구 불가. (legacy 컬럼 재생성 시 데이터는 복원되지 않음.)

SET lock_timeout = '3s';
ALTER TABLE knowledge_base DROP CONSTRAINT IF EXISTS fk_kb_embedding_llm_config;
ALTER TABLE knowledge_base DROP COLUMN IF EXISTS embedding_llm_config_id;
ALTER TABLE knowledge_base DROP COLUMN IF EXISTS embedding_model;
