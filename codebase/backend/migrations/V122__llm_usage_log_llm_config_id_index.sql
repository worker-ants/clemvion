-- V122: llm_usage_log (llm_config_id) partial — FK llm_usage_log_llm_config_id_fkey (ON DELETE SET NULL)
--
-- spec/1-data-model.md §3 인덱스 전략 · ## Rationale «쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)»
-- 실측: plan/complete/spec-draft-fk-remaining-dispositions.md
--
-- 선두 인덱스가 없는(또는 FK 조회가 못 쓰는 부분 인덱스만 있는) FK 31개를 처분한 열 개 중 하나다. 규모: 워크스페이스 W 개마다
-- 워크플로 10(노드 10 · 엣지 9 · 트리거 1) · 폴더 10 · 인증 설정 5 · 모델 설정 3 · KB 5 · LLM 로그 200 · 어시스턴트 세션 10.
-- PostgreSQL 18, V001~V120, 새로 만든 데이터, 워밍 뒤 1회. W=10,000 에서 V121~V129 전 → 후:
--   캔버스 저장이 노드 하나를 뺀다 29.1 → 0.15 ms · 워크플로 삭제 306.8 → 1.8 ms · 워크스페이스 삭제 3,161 → 49.6 ms
--
-- 모델 설정이 지워질 때 찾는다. LLM 로그는 호출마다 1행이고 보존 정리가 없어 사용량으로 한없이 자란다.
-- W=10,000(LLM 로그 200만): 모델 설정 삭제 58.2 / 49.7 ms(chat / embedding) → 1.0 / 0.9 ms (로그 100행 SET NULL 갱신 포함).
-- partial 인 이유: 컬럼이 nullable 이고 FK 트리거의 등치 조회는 IS NOT NULL 을 함의한다(V115~V118 과 같은 이유).
-- 크기 14 MB (테이블 223 MB). 쓰기 비용: 1,368.6 → 1,545.3~1,582.2 ms (행당 +1.8~2.1 µs, LLM 호출 한 번에 1행).
--
-- 비-트랜잭션 (executeInTransaction=false, 동봉 .conf) — CREATE/DROP INDEX CONCURRENTLY 는 transaction
-- block 안에서 실행할 수 없다. CREATE 앞의 DROP 은 앞선 실패의 invalid 잔재 정리다 — IF NOT EXISTS 는 이름만
-- 봐서, 그것 없이는 repair 뒤 재실행이 invalid 인덱스를 건너뛰어 영영 유효해지지 않는다
-- (migrations/README.md §5 «신규 추가에도 0) 을 둡니다», 선례 V111~V120).
DROP INDEX CONCURRENTLY IF EXISTS idx_llm_usage_log_llm_config_id;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_llm_usage_log_llm_config_id
  ON llm_usage_log (llm_config_id)
  WHERE llm_config_id IS NOT NULL;

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): DROP INDEX CONCURRENTLY IF EXISTS idx_llm_usage_log_llm_config_id;
