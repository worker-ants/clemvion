-- DB H-1: `IntegrationExpiryScannerService.enqueueCafe24BackgroundRefresh`
-- 의 일일 쿼리 `WHERE service_type='cafe24' AND status='connected' AND
-- last_rotated_at < cutoff` 를 부분 인덱스로 가속한다.
--
-- 옛 상태:
--   - 기존 인덱스: idx_integration_workspace_status (workspace_id, status),
--     idx_integration_workspace_service (workspace_id, service_type),
--     idx_integration_token_expires_at (token_expires_at WHERE NOT NULL).
--   - 세 컬럼 조합 (service_type='cafe24', status='connected', last_rotated_at)
--     을 직접 커버하는 인덱스 없음 → 통합 row 수가 늘면 PostgreSQL 이
--     workspace_id 인덱스의 부분 스캔 또는 seq scan 으로 떨어질 가능성.
--
-- 새 인덱스:
--   - 부분 인덱스 — `service_type='cafe24' AND status='connected'` 인 행
--     만 포함. cafe24 통합은 전체 통합 중 일부이고 connected 상태도 일부
--     라 인덱스 크기가 매우 작다.
--   - 키 컬럼 `last_rotated_at` 로 정렬 → `< cutoff` 범위 스캔 O(log N).
--   - `last_rotated_at IS NULL` 행은 인덱스에 포함되며 NULL 정렬 위치는
--     기본 ASC 에서 가장 끝 (PostgreSQL NULLS LAST 기본).
--
-- spec/2-navigation/4-integration.md §11 의 background refresh 패스 운영
-- 비용 최소화. 인덱스 생성은 CONCURRENTLY 로 zero-downtime.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_cafe24_connected_rotated
  ON integration (last_rotated_at)
  WHERE service_type = 'cafe24' AND status = 'connected';
