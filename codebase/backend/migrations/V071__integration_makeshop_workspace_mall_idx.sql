-- MakeShop mall_id 부분 UNIQUE 인덱스 — V046 cafe24 인덱스와 동일 패턴의
-- 병렬 인덱스. MakeShop 통합은 `credentials.shop_uid` 를 `mall_id` 컬럼으로
-- 투영하므로 (data-model §2.10), 같은 workspace 안에서 같은 mall_id (=shop_uid)
-- 의 makeshop 통합은 최대 1행만 허용 (중복 연결 시 토큰/설치 충돌 방지).
-- SQL 위반 (PG 23505) 시 service 가 409 로 변환한다.
--
-- 부분 인덱스: service_type='makeshop' AND mall_id IS NOT NULL 만 인덱싱.
-- - 다른 service_type (cafe24 포함) 영향 없음 — cafe24 는 V046 의 독립 인덱스
-- - mall_id NULL 행은 인덱스에서 자동 제외 → 운영 배포 시 기존 데이터 충돌 없음
--
-- CONCURRENTLY: 운영 테이블 쓰기 락 회피. 동봉 .conf 의
-- executeInTransaction=false 필수.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_makeshop_workspace_mall
  ON integration (workspace_id, mall_id)
  WHERE service_type = 'makeshop' AND mall_id IS NOT NULL;
