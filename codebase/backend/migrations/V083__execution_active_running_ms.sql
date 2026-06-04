-- V083: Execution active-running 누적 시간 (§8 active-running 타임아웃, PR2a)
--
-- 관련 spec:
--   - spec/5-system/4-execution-engine.md §8 (단일 Execution 최대 실행 시간 —
--     active-running 누적 시간 기준, wall-clock 아님, waiting_for_input 제외)
--
-- 설계:
--   한 Execution 의 "최대 실행 시간"(기본 30분)을 wall-clock 이 아니라 active 세그먼트
--   (execution-run / execution-continuation worker 가 실제로 노드를 전진시킨 구간)의
--   누적 시간으로 측정한다. waiting_for_input park 동안 흐른 시간은 제외 — 사용자
--   입력을 며칠 기다리는 정상 워크플로를 timeout 으로 죽이면 안 되기 때문.
--     - 엔진이 RUNNING 진입/이탈(updateExecutionStatus)마다 세그먼트 active 시간을
--       본 컬럼에 누적하고, 세그먼트 시작 시 누적 ≥ 한도면 EXECUTION_TIME_LIMIT_EXCEEDED
--       로 failed 처리한다.
--   wall-clock 총 소요(start→finish)는 기존 duration_ms 가 별도로 보관한다.
--
-- 타입: INTEGER(int4) — 누적값은 timeout 한도(기본 1.8M ms)+세그먼트 1개로 상한되어
--   int4(최대 ~2.1e9 ms ≈ 24일)에 충분. 기존 duration_ms 와 동일 정수형.
--
-- 멱등성: IF NOT EXISTS 로 컬럼 추가 — 재실행 no-op.
-- DOWN: ALTER TABLE execution DROP COLUMN IF EXISTS active_running_ms;

ALTER TABLE execution
  ADD COLUMN IF NOT EXISTS active_running_ms INTEGER NOT NULL DEFAULT 0;
