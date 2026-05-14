-- Cafe24 Private 앱의 App URL 식별 키 승격 (변경 2).
--
-- 옛 흐름: App URL 이 `/oauth/install/cafe24` 였고 백엔드가 `pending_install`
--          행 100건을 in-memory 로 스캔하면서 mall_id 일치 candidate 의
--          client_secret 으로 HMAC trial. O(N) + 중복 mall_id 시 비결정적
--          매칭의 두 가지 운영 위험.
-- 새 흐름: App URL 이 `/oauth/install/cafe24/:installToken` 으로 변경.
--          install_token 으로 단일 row 조회 + 1회 HMAC 검증.
--
-- install_token 은 32바이트 (256-bit) random hex 라 충돌 확률이 천문학적으로
-- 낮으나 식별 키로 사용하므로 UNIQUE 제약을 둔다. callback 성공 / TTL 만료
-- 시 NULL 로 비워지므로 partial UNIQUE 인덱스 (WHERE install_token IS NOT
-- NULL) 형태로 — NULL 행이 다수 존재해도 인덱스 크기에 영향 없음.
--
-- spec: spec/1-data-model.md §3, spec/2-navigation/4-integration.md §9.2,
--       spec/4-nodes/4-integration/4-cafe24.md §9.8.
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_install_token
  ON integration (install_token)
  WHERE install_token IS NOT NULL;

COMMENT ON INDEX idx_integration_install_token IS
  'Cafe24 Private install flow: single-row lookup by install_token path segment. Partial (WHERE NOT NULL) so non-cafe24 rows do not bloat the index.';
