-- V153: 워크스페이스를 나간 사람의 개인 통합을 한 번 지운다 (data fix)
--
-- 관련 spec:
--   - CLE-INT-MANAGE REQ-INTMGMT-065 · Rationale «나간 멤버의 개인 통합은 나갈 때 지운다 (2026-10-29)»
--   - CLE-INT-DATA 「멤버가 나가거나 제거될 때」
--   - NERV Task CLE-T-PS7JQY
--
-- 배경:
--   멤버가 나가거나 제거돼도 그 사람의 개인 통합 행이 남았다. 개인 통합은 통합 소유자에게만 보여서 아무도 보거나 지울 수
--   없었고 자격 증명 · 이름 · 상점 식별자 자리를 계속 잡았다. 이제 나가기 · 제거가 멤버십을 지우는 트랜잭션 안에서 그 사람의
--   개인 통합을 함께 지운다. 이 파일은 그 전에 남은 행을 지운다.
--
-- 범위:
--   통합 소유자(created_by)가 그 워크스페이스의 멤버가 아닌 개인 통합이다. 술어는 PR 본문의 배포 전 측정 SQL 과 같다.
--   상태와 사용처는 보지 않는다(REQ-INTMGMT-065 와 같다). 조직 통합은 작성자가 나갔어도 지우지 않는다.
--   감사 로그는 남기지 않는다. 지운 건수만 NOTICE 로 남기고 통합 id · 이름은 남기지 않는다.
--
-- 함께 지워지는 행:
--   integration 을 가리키는 FK 는 셋이고 모두 ON DELETE CASCADE 다. integration_usage_log(V008),
--   integration_oauth_state · integration_expiry_dispatch(V009). 노드 config 의 통합 참조는 FK 가 아니라 남는다. 그 노드는
--   일반 삭제 뒤와 같이 삭제된 통합을 가리킨다(CLE-NODE-INT-COMMON 「삭제된 통합 표시」).
--
-- 잠금:
--   지울 통합 행과 CASCADE 자식 행에 행 잠금을 건다. 토큰 갱신 같은 짧은 쓰기와 겹치면 기다리고, 5초 안에 잡지 못하면 이
--   파일만 바뀌는 것 없이 실패한다. 다시 돌리면 이 파일부터 이어진다.
--
-- 멱등성:
--   지운 행은 다시 잡히지 않는다. 배포 중 옛 인스턴스가 처리한 나가기가 남긴 행은 배포 뒤 같은 측정 SQL 로 확인한다.
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  n integer;
BEGIN
  DELETE FROM integration i
  WHERE i.scope = 'personal'
    AND NOT EXISTS (
      SELECT 1 FROM workspace_member m
      WHERE m.workspace_id = i.workspace_id AND m.user_id = i.created_by);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'V153: % personal integration(s) owned by non-members deleted', n;
END $$;

-- DOWN: 되돌리지 않는다. 지운 행의 자격 증명은 다른 곳에 남기지 않았다.
