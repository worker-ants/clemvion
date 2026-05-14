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
-- CONCURRENTLY: 운영 테이블 쓰기 락 회피. 트랜잭션 밖에서 실행되어야 하므로
-- 동봉된 .conf 의 executeInTransaction=false 가 필수. 마이그레이션이 중간
-- 실패하면 인덱스가 INVALID 상태로 남을 수 있어 — 그 경우 운영자가
-- `REINDEX` 또는 수동 `DROP INDEX` 후 재실행한다.
--
-- spec: spec/1-data-model.md §3, spec/2-navigation/4-integration.md §9.2,
--       spec/4-nodes/4-integration/4-cafe24.md §9.8.
-- COMMENT ON INDEX (transactional) is not allowed in the same Flyway
-- migration as CREATE INDEX CONCURRENTLY (non-transactional). The
-- documentation comment above already records the intent — DB-level
-- COMMENT ON INDEX is omitted to keep the migration single-mode.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_install_token
  ON integration (install_token)
  WHERE install_token IS NOT NULL;
