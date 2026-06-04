-- Integration store-identifier 인덱스 통일 — service_type 하드코딩 partial
-- 인덱스 누적 제거 (사용자 결정 2026-06-04).
--
-- 배경: 외부 상점 식별자(`mall_id` 컬럼, cafe24=mall_id / makeshop=shop_uid
-- 투영)를 갖는 통합마다 service_type 별 partial 인덱스가 늘어났다:
--   - UNIQUE: idx_integration_cafe24_workspace_mall (V046),
--             idx_integration_makeshop_workspace_mall (V071)
--   - lookup: idx_integration_cafe24_mall_id_partial (V051)
-- → Shopify·Naver·마켓플레이스 추가 시마다 인덱스가 늘어 확장 불가.
--
-- 해법: service_type 를 키 컬럼에 포함한 통일 인덱스 2개로 대체한다. 이후
-- 신규 통합 추가 시 **인덱스·마이그레이션 0건** — 본 두 인덱스가 모든
-- 현재·미래 service_type 의 (workspace, service, mall) 유일성과 mall_id
-- 회복 lookup 을 한꺼번에 커버한다.
--
-- 데이터 불변 보장: 통일 UNIQUE `(workspace_id, service_type, mall_id)` 는
-- per-service UNIQUE 들의 합집합과 동일한 제약 (각 service_type 별로 같은
-- (workspace, mall) 가 최대 1행) → 기존 데이터 위반 없이 무중단 전환.
--
-- CONCURRENTLY: 운영 테이블 쓰기 락 회피. DROP/CREATE INDEX CONCURRENTLY 는
-- 트랜잭션 밖에서만 실행 가능 — 동봉 .conf 의 executeInTransaction=false 필수
-- (V046/V051/V071 동일 패턴).

-- 1) per-service 인덱스 제거 (통일 인덱스로 대체됨)
DROP INDEX CONCURRENTLY IF EXISTS idx_integration_cafe24_workspace_mall;    -- V046 UNIQUE
DROP INDEX CONCURRENTLY IF EXISTS idx_integration_makeshop_workspace_mall;  -- V071 UNIQUE
DROP INDEX CONCURRENTLY IF EXISTS idx_integration_cafe24_mall_id_partial;   -- V051 lookup

-- 2) 통일 UNIQUE — `(workspace_id, service_type, mall_id)`.
--    service_type 를 키 컬럼에 포함해 (workspace, service, mall) 단위 유일성을
--    단일 인덱스로 보장. 서로 다른 서비스가 같은 mall_id 값을 가져도 정상.
--    V046 + V071 per-service UNIQUE 들을 동등하게 대체하며 미래 service 도 커버.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_workspace_service_mall
  ON integration (workspace_id, service_type, mall_id) WHERE mall_id IS NOT NULL;

-- 3) 통일 lookup — `(service_type, mall_id)`.
--    cafe24 의 mall_id 회복 검색 (tryRecoverByMallId) 을 모든 service 로 일반화.
--    V051 cafe24 전용 lookup 을 대체. mall_id 단독·service+mall 조합 검색 모두
--    이 인덱스가 처리.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_service_mall
  ON integration (service_type, mall_id) WHERE mall_id IS NOT NULL;
