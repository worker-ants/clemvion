-- Cafe24 mall_id 부분 UNIQUE 인덱스 (사용자 결정 4) — V045 컬럼 추가 후 분리.
--
-- 같은 workspace 안에서 같은 mall_id 의 cafe24 통합은 app_type 무관 최대
-- 1행만 허용 (한 mall 에 public·private 동시 보유 시 토큰/webhook 충돌).
-- SQL 위반 (PG 23505) 시 service 가 CAFE24_PRIVATE_APP_ALREADY_CONNECTED
-- (409) 로 변환한다.
--
-- 부분 인덱스: service_type='cafe24' AND mall_id IS NOT NULL 만 인덱싱.
-- - 다른 service_type 영향 없음
-- - 옛 (V045 이전) 행은 mall_id NULL 이라 인덱스에서 자동 제외 → 운영
--   배포 시 기존 데이터 충돌 없음
--
-- CONCURRENTLY: 운영 테이블 쓰기 락 회피. 동봉 .conf 의
-- executeInTransaction=false 필수.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_cafe24_workspace_mall
  ON integration (workspace_id, mall_id)
  WHERE service_type = 'cafe24' AND mall_id IS NOT NULL;
