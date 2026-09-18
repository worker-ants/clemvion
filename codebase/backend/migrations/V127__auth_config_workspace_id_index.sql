-- V127: auth_config (workspace_id) — 인증 설정 목록 + FK auth_config_workspace_id_fkey (ON DELETE CASCADE)
--
-- spec/1-data-model.md §3 인덱스 전략 · ## Rationale «쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)»
-- 실측: plan/complete/spec-draft-fk-remaining-dispositions.md
--
-- 선두 인덱스가 없는(또는 FK 조회가 못 쓰는 부분 인덱스만 있는) FK 31개를 처분한 열 개 중 하나다. 규모: 워크스페이스 W 개마다
-- 워크플로 10(노드 10 · 엣지 9 · 트리거 1) · 폴더 10 · 인증 설정 5 · 모델 설정 3 · KB 5 · LLM 로그 200 · 어시스턴트 세션 10.
-- PostgreSQL 18, V001~V120, 새로 만든 데이터, 워밍 뒤 1회. W=10,000 에서 V121~V129 전 → 후:
--   캔버스 저장이 노드 하나를 뺀다 29.1 → 0.15 ms · 워크플로 삭제 306.8 → 1.8 ms · 워크스페이스 삭제 3,161 → 49.6 ms
--
-- auth_config 에는 PK 밖에 없었다 — 워크스페이스별 목록(GET /api/auth-configs · 트리거 편집의 선택 상자)이 요청마다 테이블을 훑었다.
-- W=10,000(인증 설정 5만): 목록 0.99 → 0.038 ms. 워크스페이스 삭제의 FK 조회(1.2 ms)도 이것을 쓴다.
-- 크기 0.66 MB. 쓰기 비용: 684.4 → 769.7~778.7 ms (행당 +0.9 µs, 사람이 만든다).
--
-- 비-트랜잭션 (executeInTransaction=false, 동봉 .conf) — CREATE/DROP INDEX CONCURRENTLY 는 transaction
-- block 안에서 실행할 수 없다. CREATE 앞의 DROP 은 앞선 실패의 invalid 잔재 정리다 — IF NOT EXISTS 는 이름만
-- 봐서, 그것 없이는 repair 뒤 재실행이 invalid 인덱스를 건너뛰어 영영 유효해지지 않는다
-- (migrations/README.md §5 «신규 추가에도 0) 을 둡니다», 선례 V111~V120).
DROP INDEX CONCURRENTLY IF EXISTS idx_auth_config_workspace_id;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_config_workspace_id
  ON auth_config (workspace_id);

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): DROP INDEX CONCURRENTLY IF EXISTS idx_auth_config_workspace_id;
