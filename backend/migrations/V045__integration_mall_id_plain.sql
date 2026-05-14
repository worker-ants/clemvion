-- Cafe24 `mall_id` 를 plain 컬럼으로 승격 (사용자 결정 4).
--
-- 옛 흐름: mall_id 가 암호화 JSONB `credentials.mall_id` 안에 있어 SQL
--          WHERE 절로 필터 불가. 중복 방지 가드가 같은 workspace 의
--          모든 cafe24 행을 SELECT 후 ORM 경계의 자동 복호화로 in-memory
--          비교를 했고, 이는 (a) O(N) decrypt 비용 + (b) TOCTOU race
--          window (SELECT 와 INSERT 사이) 두 가지 운영 위험을 남겼다.
-- 새 흐름: plain 컬럼으로 분리. `(workspace_id, mall_id)` 부분 UNIQUE
--          인덱스가 DB 레벨에서 중복을 거부 → race 가 SQL constraint
--          violation 으로 변환되어 코드는 단일 INSERT 만 시도하면 된다.
--
-- 컬럼은 nullable — 옛 cafe24 행 (마이그레이션 이전 생성) 은 NULL 로
-- 남고, 코드가 ORM save 시 credentials 에서 추출해 plain 컬럼에 함께
-- 기록한다. 부분 UNIQUE 인덱스는 NULL 행을 비교 대상에서 제외하므로
-- 옛 행이 다수 있어도 새 행과 충돌하지 않는다.
--
-- CONCURRENTLY: 운영 테이블 쓰기 락 회피. 동봉 .conf 의
-- executeInTransaction=false 필수.
ALTER TABLE integration
  ADD COLUMN mall_id VARCHAR(50) NULL;

COMMENT ON COLUMN integration.mall_id IS
  'Cafe24 Private/Public 앱의 mall_id (cafe24api.com hostname prefix). credentials JSONB 의 mall_id 와 동일 값을 plain 컬럼으로 복제 — 중복 방지 SQL 인덱스 + O(1) 조회에 사용. 옛 행은 NULL, ORM save 시 backfill.';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_cafe24_workspace_mall
  ON integration (workspace_id, mall_id)
  WHERE service_type = 'cafe24' AND mall_id IS NOT NULL;
