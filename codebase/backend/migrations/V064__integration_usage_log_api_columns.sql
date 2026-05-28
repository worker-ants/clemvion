-- V064: integration_usage_log 에 API 식별 컬럼 3개 추가
--
-- 관련 spec:
--   - spec/1-data-model.md §2.10.1 (IntegrationUsageLog 엔티티 — 3컬럼 추가)
--   - spec/2-navigation/4-integration.md §4.6 (Recent activity 탭의 API 컬럼)
--   - spec/2-navigation/4-integration.md §9.3 (활동 API 응답 + catalog endpoint)
--   - spec/4-nodes/4-integration/_product-overview.md INT-US-05 (통합별 채우기 정책)
--   - spec/conventions/cafe24-api-metadata.md §7.5 (cafe24 catalog key 형식)
--   - plan/in-progress/integration-activity-api-label.md
--
-- 결정
--   - 3컬럼 모두 nullable / default NULL — 기존 행은 표시 시 `—` 로 fallback
--   - backfill 없음 — 신규 호출부터 채워짐
--   - 인덱스 추가 없음 — 현재 활동 탭은 `(integration_id, at DESC)` 만 사용. endpoint별 필터·통계는 별도 PR
--   - varchar 길이는 spec 정의대로 — label 128, method 8 (`OPTIONS` 최대 7자), path 256
--   - 길이 초과 시 백엔드가 `…` 부착 후 자름 (`clampMessage` 패턴)

ALTER TABLE integration_usage_log
    ADD COLUMN api_label  varchar(128) NULL,
    ADD COLUMN api_method varchar(8)   NULL,
    ADD COLUMN api_path   varchar(256) NULL;
