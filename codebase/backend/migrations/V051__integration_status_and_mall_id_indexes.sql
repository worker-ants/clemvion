-- V051: Cafe24 follow-up B-4-1 / B-4-4 — 보조 인덱스 추가
--
-- 1) `idx_integration_pending_install_partial`
--    `expirePendingInstalls` (24h TTL sweep) 와 `pending_install` 카드/배지가
--    `WHERE status='pending_install'` 으로 자주 스캔된다. integration 테이블이
--    크면 seq scan 비용이 누적되므로, 항상 작은 집합인 pending_install 만
--    가리키는 partial index 가 cheapest.
--
-- 2) `idx_integration_cafe24_mall_id_partial`
--    `tryRecoverByMallId` 가 mall_id 단독으로 검색한다. 옛 V046 partial UNIQUE
--    `idx_integration_cafe24_workspace_mall` 의 선두 컬럼이 workspace_id 라
--    mall_id 단독 검색에서 활용 안 될 수 있다. 회복 흐름은 빈도가 낮지만
--    HMAC mismatch 시 latency 가 사용자에게 직접 노출되므로 partial index 로
--    O(1) 조회 보장.
--
-- 두 인덱스 모두 CONCURRENTLY — 잠금 회피.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_pending_install_partial
  ON integration (created_at)
  WHERE status = 'pending_install';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_cafe24_mall_id_partial
  ON integration (mall_id)
  WHERE service_type = 'cafe24' AND mall_id IS NOT NULL;
