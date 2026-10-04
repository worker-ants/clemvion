-- 트리거 시크릿 참조 정리. NERV Task CLE-T-XYR067.
-- 근거: CLE-INT-SECRET 규칙 25 · Rationale R10.
--
-- 먼저 2026-10-04-trigger-secret-ref-audit.sql 로 대상을 확인하고 결과를 보관한다. 이 파일은 한
-- 트랜잭션에서 두 가지를 한다. RETURNING 으로 바꾼 행을 보여 준다.
--
-- 1. 점검 A 의 비밀 행을 지운다. 다른 워크스페이스의 요청이 쓴 값이라 workspace_id 만 되돌려서는
--    믿을 수 없다. 암호문의 AAD 가 ref 라 다른 행으로 옮겨 살릴 수도 없다.
-- 2. 점검 B 의 config 참조를 그 트리거 id 로 만든 참조로 맞춘다. 읽는 쪽이 이미 같은 값을 쓰므로
--    동작은 바뀌지 않고 저장값만 정리된다. `secret://` 로 시작하지 않는 값은 건드리지 않는다.
--
-- 이 SQL 은 애플리케이션 경로가 아닌 일회성 운영 절차다. 규칙 13 의 «workspace_id 를 조건으로 지우는
-- 경로를 두지 않는다» 는 SecretResolver 인터페이스와 애플리케이션 삭제 경로의 규칙이다(R10).
--
-- 정리 뒤 할 일(소유자에게 안내한다):
-- - 1 에서 지운 bot-token · inbound-signing 행의 트리거 소유자는 봇 토큰을 재발급한다
--   (POST /api/triggers/:id/chat-channel/rotate-bot-token). Telegram 은 이때 inbound 서명 자료도
--   새로 받는다. 덮어쓰기 전의 토큰이 다른 워크스페이스로 새었을 수 있으므로 provider 쪽에서도
--   토큰을 새로 발급받아 쓴다.
-- - 1 에서 지운 notification-signing 행의 트리거 소유자는 알림 서명 시크릿을 재발급한다
--   (POST /api/triggers/:id/notification/rotate-secret).
-- - 점검 B 에서 다른 트리거를 가리키던 행이 있으면 가리켜진 트리거의 소유자에게도 알린다.

BEGIN;

DELETE FROM secret_store s
USING trigger t
WHERE t.id::text = split_part(s.ref, '/', 4)
  AND s.ref LIKE 'secret://triggers/%'
  AND s.workspace_id <> t.workspace_id
RETURNING s.ref, t.id AS trigger_id, t.workspace_id AS trigger_workspace_id;

UPDATE trigger t
SET config = jsonb_set(t.config, '{chatChannel,botTokenRef}',
                       to_jsonb('secret://triggers/' || t.id::text || '/bot-token'))
WHERE t.config #>> '{chatChannel,botTokenRef}' LIKE 'secret://%'
  AND t.config #>> '{chatChannel,botTokenRef}' <> 'secret://triggers/' || t.id::text || '/bot-token'
RETURNING t.id AS trigger_id, 'chatChannel.botTokenRef' AS path;

UPDATE trigger t
SET config = jsonb_set(t.config, '{chatChannel,inboundSigningRef}',
                       to_jsonb('secret://triggers/' || t.id::text || '/inbound-signing'))
WHERE t.config #>> '{chatChannel,inboundSigningRef}' LIKE 'secret://%'
  AND t.config #>> '{chatChannel,inboundSigningRef}' <> 'secret://triggers/' || t.id::text || '/inbound-signing'
RETURNING t.id AS trigger_id, 'chatChannel.inboundSigningRef' AS path;

UPDATE trigger t
SET config = jsonb_set(t.config, '{notification,signing,secretRef}',
                       to_jsonb('secret://triggers/' || t.id::text || '/notification-signing'))
WHERE t.config #>> '{notification,signing,secretRef}' LIKE 'secret://%'
  AND t.config #>> '{notification,signing,secretRef}' <> 'secret://triggers/' || t.id::text || '/notification-signing'
RETURNING t.id AS trigger_id, 'notification.signing.secretRef' AS path;

COMMIT;
