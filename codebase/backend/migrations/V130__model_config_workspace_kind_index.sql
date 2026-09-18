-- V130: model_config (workspace_id, kind) — 모델 설정 목록 + FK llm_config_workspace_id_fkey (ON DELETE CASCADE)
--
-- spec/1-data-model.md §3 인덱스 전략 · ## Rationale «쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)»
-- 실측: plan/complete/spec-draft-fk-remaining-dispositions.md
--
-- 선두 인덱스가 없는(또는 FK 조회가 못 쓰는 부분 인덱스만 있는) FK 31개를 처분한 열 개 중 하나다. 규모: 워크스페이스 W 개마다
-- 워크플로 10(노드 10 · 엣지 9 · 트리거 1) · 폴더 10 · 인증 설정 5 · 모델 설정 3 · KB 5 · LLM 로그 200 · 어시스턴트 세션 10.
-- PostgreSQL 18, V001~V120, 새로 만든 데이터, 워밍 뒤 1회. W=10,000 에서 V121~V129 전 → 후:
--   캔버스 저장이 노드 하나를 뺀다 29.1 → 0.15 ms · 워크플로 삭제 306.8 → 1.8 ms · 워크스페이스 삭제 3,161 → 49.6 ms
--
-- 기존 (workspace_id, kind) WHERE is_default = true UNIQUE(V089)는 부분 인덱스라, is_default 조건이 없는 목록 조회
-- (GET /api/model-configs — workspace_id = ? AND kind = ? · 모델 선택 상자)와 FK 조회($1 = workspace_id)가 쓰지 못했다.
-- «전수 37» 셈이 부분 인덱스를 «있음» 으로 세어 놓친 셋 중 하나다. W=10,000(모델 설정 3만): 목록 1.55 → 0.022 ms · 워크스페이스
-- 삭제의 FK 조회 0.88 → 0.04 ms. 두 컬럼인 것은 목록 조회가 늘 kind 를 함께 걸기 때문이다 — FK 조회는 선두 workspace_id 로 쓴다.
-- 크기 1.3 MB. 쓰기 비용: 695.3 → 829.1~836.0 ms (행당 +1.3~1.4 µs, 사람이 만든다).
--
-- 비-트랜잭션 (executeInTransaction=false, 동봉 .conf) — CREATE/DROP INDEX CONCURRENTLY 는 transaction
-- block 안에서 실행할 수 없다. CREATE 앞의 DROP 은 앞선 실패의 invalid 잔재 정리다 — IF NOT EXISTS 는 이름만
-- 봐서, 그것 없이는 repair 뒤 재실행이 invalid 인덱스를 건너뛰어 영영 유효해지지 않는다
-- (migrations/README.md §5 «신규 추가에도 0) 을 둡니다», 선례 V111~V120).
DROP INDEX CONCURRENTLY IF EXISTS idx_model_config_workspace_kind;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_config_workspace_kind
  ON model_config (workspace_id, kind);

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): DROP INDEX CONCURRENTLY IF EXISTS idx_model_config_workspace_kind;
