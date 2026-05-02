-- V024: KB 단위 재임베딩 상태 추적
-- 기존 in-memory `inFlightReEmbeds` Set 으로 처리하던 KB reEmbedAll 잠금을
-- DB 컬럼으로 옮겨 다중 인스턴스 / 프로세스 재시작 환경에서도 안전하게 한다.
--
-- 상태 전이:
--   idle → in_progress : KB reEmbedAll 진입 시
--                        UPDATE ... WHERE id = $1 AND reembed_status = 'idle' RETURNING id
--                        (race-free atomic compare-and-swap; 결과 0행이면 409 반환)
--   in_progress → idle  : 큐의 마지막 child job 완료 / 실패 시 EmbeddingProcessor 가 reset
--                         (해당 KB 의 in_progress · pending 문서가 0건일 때만)

ALTER TABLE knowledge_base
  ADD COLUMN reembed_status TEXT NOT NULL DEFAULT 'idle';

ALTER TABLE knowledge_base
  ADD CONSTRAINT chk_kb_reembed_status
  CHECK (reembed_status IN ('idle', 'in_progress'));
