-- 교차 워크스페이스 id 참조 점검 (읽기 전용). NERV Task CLE-T-XYR067.
-- 근거: CLE-PLAT-DATA 「저장된 교차 행 점검」 · Rationale «저장된 교차 행은 실행 때 한 번 더 막고 운영 점검으로 찾는다».
--
-- 요청 본문의 참조 id 를 저장 전에 검사하기 전(2026-09-27 이전)에 저장됐을 수 있는 교차 행을 찾는다.
-- 이 파일은 아무것도 바꾸지 않는다. 정리 SQL 은 두지 않는다. 행마다 어느 쪽이 맞는지 사람이 보고
-- 정해야 하기 때문이다. 정리 절차는 CLE-PLAT-DATA 「저장된 교차 행 점검」 이 정한다.
--
-- 실행 시점 동작(check_name 별):
--   trigger.workflow_id     실행되지 않는다. 실행 엔진이 실행을 시작하는 워크스페이스로 워크플로우를
--                           대조한다. 웹훅은 404, 채팅 채널은 202 ignored 와 degraded, Cron 은 건너뛰기,
--                           «지금 실행» 은 400 이다.
--   trigger.auth_config_id  웹훅 인증이 인증 설정을 트리거의 워크스페이스 안에서 찾으므로 401 로 거부된다.
--   schedule.trigger_id     Cron 은 스케줄의 워크스페이스로 실행을 시작한다. 트리거의 워크플로우가 그
--                           워크스페이스에 없으면 실행되지 않고 있으면 실행된다.
--   나머지                  실행 시점 방어선이 없다. 이 점검이 그 행을 찾는 수단이다.
--
-- 언제 · 어떻게 돌리나: 읽기 전용이라 배포 전후 아무 때나 돌려도 된다. node · edge 를 통째로 조인하므로
-- 큰 DB 에서는 읽기 복제본에서 돌리거나 statement_timeout 을 건다.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 2026-10-05-cross-workspace-id-ref-audit.sql
--
-- 결과 한 줄이 교차 행 하나다. 열의 뜻:
--   check_name        어느 참조인지
--   row_id            참조를 가진 행
--   row_workspace_id  그 행의 워크스페이스(노드 · 연결선은 그 행의 워크플로우 id)
--   ref_id            가리키는 행
--   ref_workspace_id  가리키는 행의 워크스페이스(노드 · 연결선은 가리키는 노드의 워크플로우 id)
-- 비밀 값이나 설정 본문은 싣지 않는다.

-- 1. 트리거 workflow_id → 워크플로우
SELECT 'trigger.workflow_id' AS check_name,
       t.id AS row_id, t.workspace_id AS row_workspace_id,
       w.id AS ref_id, w.workspace_id AS ref_workspace_id
FROM trigger t
JOIN workflow w ON w.id = t.workflow_id
WHERE w.workspace_id <> t.workspace_id

UNION ALL
-- 2. 트리거 auth_config_id → 인증 설정
SELECT 'trigger.auth_config_id',
       t.id, t.workspace_id, a.id, a.workspace_id
FROM trigger t
JOIN auth_config a ON a.id = t.auth_config_id
WHERE a.workspace_id <> t.workspace_id

UNION ALL
-- 3. 스케줄 trigger_id → 트리거. 스케줄 생성이 트리거를 같은 워크스페이스에 만들므로 정상 경로로는
--    생기지 않는다. 생겼다면 손으로 고친 행이다.
SELECT 'schedule.trigger_id',
       s.id, s.workspace_id, t.id, t.workspace_id
FROM schedule s
JOIN trigger t ON t.id = s.trigger_id
WHERE t.workspace_id <> s.workspace_id

UNION ALL
-- 4. 알림 규칙 workflow_id → 워크플로우
SELECT 'alert_rule.workflow_id',
       r.id, r.workspace_id, w.id, w.workspace_id
FROM alert_rule r
JOIN workflow w ON w.id = r.workflow_id
WHERE w.workspace_id <> r.workspace_id

UNION ALL
-- 5. 워크플로우 folder_id → 폴더
SELECT 'workflow.folder_id',
       w.id, w.workspace_id, f.id, f.workspace_id
FROM workflow w
JOIN folder f ON f.id = w.folder_id
WHERE f.workspace_id <> w.workspace_id

UNION ALL
-- 6. 폴더 parent_id → 상위 폴더. FK 가 CASCADE 라 상위 폴더를 지우면 이쪽 폴더도 지워진다.
SELECT 'folder.parent_id',
       c.id, c.workspace_id, p.id, p.workspace_id
FROM folder c
JOIN folder p ON p.id = c.parent_id
WHERE p.workspace_id <> c.workspace_id

UNION ALL
-- 7. 어시스턴트 세션 workflow_id → 워크플로우
SELECT 'workflow_assistant_session.workflow_id',
       s.id, s.workspace_id, w.id, w.workspace_id
FROM workflow_assistant_session s
JOIN workflow w ON w.id = s.workflow_id
WHERE w.workspace_id <> s.workspace_id

UNION ALL
-- 8. 어시스턴트 세션 llm_config_id → 모델 설정
SELECT 'workflow_assistant_session.llm_config_id',
       s.id, s.workspace_id, m.id, m.workspace_id
FROM workflow_assistant_session s
JOIN model_config m ON m.id = s.llm_config_id
WHERE m.workspace_id <> s.workspace_id

UNION ALL
-- 9. 지식 저장소의 모델 설정 참조 넷
SELECT 'knowledge_base.' || ref.column_name,
       k.id, k.workspace_id, m.id, m.workspace_id
FROM knowledge_base k
CROSS JOIN LATERAL (VALUES
  ('embedding_model_config_id', k.embedding_model_config_id),
  ('extraction_llm_config_id', k.extraction_llm_config_id),
  ('rerank_config_id', k.rerank_config_id),
  ('rerank_llm_config_id', k.rerank_llm_config_id)
) AS ref(column_name, model_config_id)
JOIN model_config m ON m.id = ref.model_config_id
WHERE m.workspace_id <> k.workspace_id

UNION ALL
-- 10. 노드 container_id · tool_owner_id → 다른 워크플로우의 노드
SELECT 'node.' || ref.column_name,
       n.id, n.workflow_id, o.id, o.workflow_id
FROM node n
CROSS JOIN LATERAL (VALUES
  ('container_id', n.container_id),
  ('tool_owner_id', n.tool_owner_id)
) AS ref(column_name, node_id)
JOIN node o ON o.id = ref.node_id
WHERE o.workflow_id <> n.workflow_id

UNION ALL
-- 11. 연결선 끝점 → 다른 워크플로우의 노드
SELECT 'edge.' || ref.column_name,
       e.id, e.workflow_id, o.id, o.workflow_id
FROM edge e
CROSS JOIN LATERAL (VALUES
  ('source_node_id', e.source_node_id),
  ('target_node_id', e.target_node_id)
) AS ref(column_name, node_id)
JOIN node o ON o.id = ref.node_id
WHERE o.workflow_id <> e.workflow_id

ORDER BY check_name, row_id;
