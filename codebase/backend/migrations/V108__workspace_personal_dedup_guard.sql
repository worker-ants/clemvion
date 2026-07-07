-- V108: personal 워크스페이스 owner-당-유일성 사전 검증 가드
--       (V109 부분 유니크 인덱스 `uq_workspace_personal_owner` 의 선행 조건).
--
-- 결정3 = B (spec-sync-data-flow-12-workspace-gaps, 2026-07-07): personal 워크스페이스
-- 유일성(owner 당 1개)을 DB 부분 유니크 인덱스로 defense-in-depth 강제한다. 그 인덱스는
-- 기존 데이터에 owner 당 중복 personal 이 있으면 빌드에 실패하므로(V109 CONCURRENTLY 는
-- 실패 시 INVALID 인덱스를 남긴다), 그 전에 본 가드가 선제적으로 중복을 검출한다.
--
-- **왜 자동 dedup(삭제/병합)이 아니라 fail-loud 가드인가**: workspace(id) 를 참조하는
-- ON DELETE CASCADE FK 가 20여 개 테이블(workflow·trigger·schedule·execution·audit_log·
-- knowledge_base 등)에 걸쳐 있다. 중복 personal 워크스페이스를 자동 삭제하면 그 하위
-- 데이터가 cascade 로 함께 소실되고, 반대로 모든 자식 row 를 keeper 로 re-point 하는 것은
-- 테이블 열거 누락·membership 중복 등 새로운 위험을 만든다. 중복 personal 워크스페이스는
-- 애초에 `findOrCreatePersonalWorkspace` choke point 가 방지하는 app invariant 위반이므로,
-- 만약 실재한다면 자동 파괴가 아니라 operator 가 내용을 확인해 수동 병합/삭제하는 것이
-- 안전하다. 본 가드는 그 상황에서 배포를 안전하게 멈춘다(happy path = 무중복 = no-op).
--
-- 트랜잭션 기본(executeInTransaction 미지정) — 검증만 수행, 스키마 변경 없음. 재실행 안전.
DO $$
DECLARE
  dup_owners INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_owners
  FROM (
    SELECT owner_id
    FROM workspace
    WHERE type = 'personal'
    GROUP BY owner_id
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_owners > 0 THEN
    RAISE EXCEPTION
      'V108: % owner(s) have duplicate personal workspaces. The V109 partial-unique index (uq_workspace_personal_owner) cannot be built until an operator merges/removes them (auto-dedup is unsafe due to ~20 ON DELETE CASCADE child tables). Inspect with: SELECT owner_id, array_agg(id ORDER BY created_at) FROM workspace WHERE type = ''personal'' GROUP BY owner_id HAVING COUNT(*) > 1;',
      dup_owners;
  END IF;
END $$;
