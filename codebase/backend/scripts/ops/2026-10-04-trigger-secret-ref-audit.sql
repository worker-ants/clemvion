-- 트리거 시크릿 참조 점검 (읽기 전용). NERV Task CLE-T-XYR067.
-- 근거: CLE-INT-SECRET 「교차 행 점검과 정리」 · Rationale R10.
--
-- 요청 본문의 원시 config 로 다른 트리거의 시크릿 참조를 심을 수 있던 동안(CLE-T-M9QKKX 이전)에
-- 생겼을 수 있는 행을 찾는다. 이 파일은 아무것도 바꾸지 않는다. 정리는
-- 2026-10-04-trigger-secret-ref-cleanup.sql 이 한다.
--
-- 순서: 이 변경(rotate 의 워크스페이스 불일치 거부)을 배포하기 전에 돌린다. 결과가 있으면 정리
-- 파일을 돌린 뒤 배포한다. 배포 뒤에 남은 행은 소유자의 봇 토큰 재발급이 500 으로 막힌다.
--
-- 출력에는 비밀 값과 평문을 싣지 않는다. 참조 자리에 평문이 들어 있을 수 있어 `secret://` 로
-- 시작하지 않는 저장값은 NULL 로 바꿔 보인다.

-- A. 비밀 행의 워크스페이스가 그 트리거의 워크스페이스와 다르다.
--    다른 워크스페이스의 요청이 rotate 로 덮어쓴 행이다. 내용도 그 요청이 쓴 값이다.
SELECT s.ref,
       t.id           AS trigger_id,
       t.workspace_id AS trigger_workspace_id,
       s.workspace_id AS secret_workspace_id,
       s.updated_at
FROM secret_store s
JOIN trigger t ON t.id::text = split_part(s.ref, '/', 4)
WHERE s.ref LIKE 'secret://triggers/%'
  AND s.workspace_id <> t.workspace_id
ORDER BY t.id, s.ref;

-- B. 트리거 config 의 참조가 그 트리거 id 로 만든 참조와 다르다.
--    읽는 쪽은 이제 이 값을 쓰지 않고 트리거 id 로 다시 만든다. 다른 트리거를 가리키면
--    그 트리거의 비밀이 노출됐을 수 있으니 양쪽 소유자에게 알린다.
SELECT t.id           AS trigger_id,
       t.workspace_id AS trigger_workspace_id,
       slot.path,
       CASE WHEN slot.stored LIKE 'secret://%' THEN slot.stored END AS stored_ref
FROM trigger t
CROSS JOIN LATERAL (VALUES
  ('chatChannel.botTokenRef', t.config #>> '{chatChannel,botTokenRef}', 'bot-token'),
  ('chatChannel.inboundSigningRef', t.config #>> '{chatChannel,inboundSigningRef}', 'inbound-signing'),
  ('notification.signing.secretRef', t.config #>> '{notification,signing,secretRef}', 'notification-signing')
) AS slot(path, stored, name)
WHERE slot.stored IS NOT NULL
  AND slot.stored <> 'secret://triggers/' || t.id::text || '/' || slot.name
ORDER BY t.id, slot.path;
