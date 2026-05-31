-- V068: Execution dry-run 플래그 (Replay/Re-run dry-run 완전 구현)
--
-- 관련 spec:
--   - spec/5-system/13-replay-rerun.md §7 (dry-run 모드 정의) / §8.1 (Re-run API)
--
-- 설계:
--   Re-run 모달의 dry-run 토글(RR-PL-01)이 true 면 새 Execution 은 dry-run 모드로
--   생성된다. 외부 부수효과 노드(HTTP/Email/DB-write)는 실제 호출 대신 mock 출력을
--   반환(§7.2). dry_run 은 실행 전 수명 동안 고정 — 엔진이 createContext 시점에
--   `variables.__dryRun` 으로 주입하고, waiting_for_input 후 rehydration 에서도
--   동일 값을 복원해야 하므로 Execution row 컬럼으로 영속화한다.
--     - 일반 실행 / 일반 re-run: dry_run = false (DEFAULT).
--     - dry-run re-run 으로 생성된 실행만 dry_run = true.
--
-- 멱등성: IF NOT EXISTS 로 컬럼 추가 — 재실행 no-op.

ALTER TABLE execution
  ADD COLUMN IF NOT EXISTS dry_run BOOLEAN NOT NULL DEFAULT FALSE;
