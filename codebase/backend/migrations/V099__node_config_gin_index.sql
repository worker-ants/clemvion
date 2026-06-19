-- V099: node.config 통합 사용처 조회용 인덱스 2종 — 통합 삭제 전 사용처 확인 등.
--
-- 핫 경로: IntegrationsService.getUsages 가 `node` 를 두 조건의 합집합으로 조회한다
--   (PR #633 — 직접참조 ∪ MCP참조).
--   - 직접참조:  n.config ->> 'integrationId' = :integrationId   (텍스트 등치)
--   - MCP참조:   n.config -> 'mcpServers' @> :mcpProbe::jsonb     (containment)
-- 두 조건 모두 인덱스가 없어 seq scan 이었다. 관리 UI 조회 경로라 빈도는 낮지만,
-- 노드 수 증가에 대비해 두 브랜치 각각에 맞는 인덱스를 둔다.
--
-- 인덱스 2종으로 나눈 이유 — GIN(jsonb_path_ops) 는 `@>` containment 전용이고
-- `->>` 텍스트 등치 비교는 GIN 스캔 경로가 없다(Postgres 문서). 따라서:
--   1) idx_node_config_gin (GIN, jsonb_path_ops): MCP 참조의 `@>` containment 가속.
--      jsonb_path_ops 는 containment 에 최적 — 기본 jsonb_ops 보다 인덱스가 작고 빠르다.
--   2) idx_node_config_integration_id (B-tree, expression): 직접참조의
--      `(config ->> 'integrationId') = ...` 등치 가속. GIN 으로는 커버되지 않는
--      브랜치를 별도 expression B-tree 로 보완한다.
-- 플래너는 두 OR 브랜치를 각 인덱스의 BitmapOr 로 결합할 수 있다.
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없으므로 동봉된
-- V099__node_config_gin_index.conf (executeInTransaction=false) 와 함께
-- 비-트랜잭션 모드로 실행한다 (운영 테이블 무중단 — 쓰기 락 회피).
-- 실패 시 INVALID 인덱스가 잔존할 수 있다 → DROP INDEX 후 재시도 (DOWN 참조).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_config_gin
  ON node USING GIN (config jsonb_path_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_config_integration_id
  ON node ((config ->> 'integrationId'));

-- DOWN:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_node_config_integration_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_node_config_gin;
