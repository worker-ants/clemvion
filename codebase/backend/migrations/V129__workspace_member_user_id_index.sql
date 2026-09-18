-- V129: workspace_member (user_id) — 사용자별 워크스페이스 목록 + FK workspace_member_user_id_fkey (ON DELETE CASCADE)
--
-- spec/1-data-model.md §3 인덱스 전략 · ## Rationale «쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)»
-- 실측: plan/complete/spec-draft-fk-remaining-dispositions.md
--
-- 선두 인덱스가 없는(또는 FK 조회가 못 쓰는 부분 인덱스만 있는) FK 31개를 처분한 열 개 중 하나다. 규모: 워크스페이스 W 개마다
-- 워크플로 10(노드 10 · 엣지 9 · 트리거 1) · 폴더 10 · 인증 설정 5 · 모델 설정 3 · KB 5 · LLM 로그 200 · 어시스턴트 세션 10.
-- PostgreSQL 18, V001~V120, 새로 만든 데이터, 워밍 뒤 1회. W=10,000 에서 V121~V129 전 → 후:
--   캔버스 저장이 노드 하나를 뺀다 29.1 → 0.15 ms · 워크플로 삭제 306.8 → 1.8 ms · 워크스페이스 삭제 3,161 → 49.6 ms
--
-- UNIQUE (workspace_id, user_id) 는 선두가 달라 «이 사용자의 워크스페이스»(GET /api/workspaces · 개인 워크스페이스가 없는 사용자의
-- 토큰 발급 · JWT fallback)가 테이블을 훑었다. W=10,000(멤버 1만): 0.22 → 0.012 ms — 앱 로드마다 부른다.
-- 사용자를 지우는 앱 경로는 없어 FK 비용은 이유가 아니다(조회 경로가 이유다).
-- 크기 0.32 MB. 쓰기 비용: 1,199.5 → 1,334.3~1,348.4 ms (행당 +1.4~1.5 µs, 가입 · 초대 수락 때).
--
-- 비-트랜잭션 (executeInTransaction=false, 동봉 .conf) — CREATE/DROP INDEX CONCURRENTLY 는 transaction
-- block 안에서 실행할 수 없다. CREATE 앞의 DROP 은 앞선 실패의 invalid 잔재 정리다 — IF NOT EXISTS 는 이름만
-- 봐서, 그것 없이는 repair 뒤 재실행이 invalid 인덱스를 건너뛰어 영영 유효해지지 않는다
-- (migrations/README.md §5 «신규 추가에도 0) 을 둡니다», 선례 V111~V120).
DROP INDEX CONCURRENTLY IF EXISTS idx_workspace_member_user_id;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_member_user_id
  ON workspace_member (user_id);

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): DROP INDEX CONCURRENTLY IF EXISTS idx_workspace_member_user_id;
