-- V067: Execution re-run / chain 추적 컬럼 (Replay/Re-run — decision F2)
--
-- 관련 spec:
--   - spec/5-system/13-replay-rerun.md §8 (API) / §9.1 (데이터 모델)
--
-- 설계 (안전 변형):
--   spec §9.1 은 chain_id 를 NOT NULL (원본 = 자기참조 chain_id=id) 로 기술하나,
--   Execution row 는 sub-workflow / background / retry 등 복수 경로에서 INSERT 되어
--   모든 경로에 chain_id 강제 세팅을 요구하면 회귀 위험이 크다. 따라서 v1 구현은
--   chain_id / re_run_of 를 **NULLABLE** 로 둔다:
--     - 일반 실행(원본·sub-workflow·background): re_run_of = NULL, chain_id = NULL.
--     - re-run 으로 생성된 실행만 re_run_of = <직계 부모>, chain_id = <chain root id>.
--   chain root id = 원본 실행의 id (chain 의 최상위, re_run_of=NULL). GET /chain 은
--   `id = rootId OR chain_id = rootId` 로 chain 전체를 조회한다.
--   불변식(cross-chain re-run 불가, 깊이 32 제한)은 애플리케이션 레벨에서 enforce.
--
-- 멱등성: IF NOT EXISTS 로 컬럼·인덱스 추가 — 재실행 no-op.

ALTER TABLE execution
  ADD COLUMN IF NOT EXISTS re_run_of UUID NULL REFERENCES execution(id) ON DELETE SET NULL;

ALTER TABLE execution
  ADD COLUMN IF NOT EXISTS chain_id UUID NULL;

-- 직계 부모 조회 (chain badge)
CREATE INDEX IF NOT EXISTS idx_execution_re_run_of ON execution (re_run_of);

-- chain 전체 조회 (/chain 엔드포인트)
CREATE INDEX IF NOT EXISTS idx_execution_chain_id_started_at ON execution (chain_id, started_at);
