-- 트리거 시크릿 참조 정리. NERV Task CLE-T-XYR067.
-- 근거: CLE-INT-SECRET 「교차 행 점검과 정리」 · Rationale R10(이 Task 의 NERV 초안. 승인 뒤 미러에 생긴다).
--
-- 먼저 2026-10-04-trigger-secret-ref-audit.sql 로 대상을 확인하고 결과를 보관한다. 이 파일은 한
-- 트랜잭션에서 두 가지를 한다. RETURNING 으로 바꾼 행을 보여 준다. 끝난 뒤 점검 SQL 을 다시 돌려
-- 결과가 비었는지 확인한다. 다시 돌려도 바뀌는 행이 없다.
--
-- 1 의 삭제는 되돌릴 수 없다. 경위를 조사하려고 사본을 남기려면 BEGIN 다음에 아래 문장을 먼저 돌린다.
-- 사본에도 암호문이 들어 있으니 조사가 끝나면 지운다.
--   CREATE TABLE secret_store_xyr067_backup AS
--   SELECT s.* FROM secret_store s JOIN trigger t ON t.id::text = split_part(s.ref, '/', 4)
--   WHERE s.ref LIKE 'secret://triggers/%' AND s.workspace_id <> t.workspace_id;
--
-- 1. 점검 A 의 비밀 행을 지운다. 다른 워크스페이스의 요청이 쓴 값이라 workspace_id 만 되돌려서는
--    믿을 수 없다. 암호문의 AAD 가 ref 라 다른 행으로 옮겨 살릴 수도 없다.
-- 2. 점검 B 의 config 참조를 그 트리거 id 로 만든 참조로 맞춘다. 읽는 쪽이 이미 같은 값을 쓰므로
--    동작은 바뀌지 않고 저장값만 정리된다. `secret://` 로 시작하지 않는 값은 건드리지 않는다. 그런
--    행은 정리 뒤에도 점검 B 에 stored_ref 가 빈 채로 남는다. 평문이 들어 있을 수 있으니 소유자와
--    확인한 뒤 그 키를 손으로 지우거나 위와 같은 참조로 바꾼다.
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
--   (POST /api/triggers/:id/notification/rotate-secret). 승격 대기 중이던 트리거는 다음 매시 배치가
--   새 행을 만들어 승격을 마친다(정리 전에는 그 트리거만 건너뛰었다).
-- - 점검 B 에서 다른 트리거를 가리키던 행이 있으면 가리켜진 트리거의 소유자에게도 알린다.

BEGIN;

-- 행 잠금 대기가 길어지면 앱 쓰기를 붙잡으므로 기다림에 상한을 둔다. 넘으면 이 트랜잭션이 롤백되니 다시 돌린다.
SET LOCAL lock_timeout = '5s';

DELETE FROM secret_store s
USING trigger t
WHERE t.id::text = split_part(s.ref, '/', 4)
  AND s.ref LIKE 'secret://triggers/%'
  AND s.workspace_id <> t.workspace_id
RETURNING s.ref, t.id AS trigger_id, t.workspace_id AS trigger_workspace_id;

-- 앱이 config 를 다시 쓸 때 잡는 트리거 단위 advisory lock(trigger-config-lock.ts 의
-- `trigger-config:<id>`)을 같이 잡는다. 앱이 이 정리 전에 읽은 config 로 정리 결과를 되돌려 쓰지
-- 못하게 한다. 락은 COMMIT 에서 풀린다.
SELECT t.id AS locked_trigger_id,
       pg_advisory_xact_lock(hashtext('trigger-config:' || t.id::text))
FROM trigger t
WHERE (t.config #>> '{chatChannel,botTokenRef}' LIKE 'secret://%'
       AND t.config #>> '{chatChannel,botTokenRef}' <> 'secret://triggers/' || t.id::text || '/bot-token')
   OR (t.config #>> '{chatChannel,inboundSigningRef}' LIKE 'secret://%'
       AND t.config #>> '{chatChannel,inboundSigningRef}' <> 'secret://triggers/' || t.id::text || '/inbound-signing')
   OR (t.config #>> '{notification,signing,secretRef}' LIKE 'secret://%'
       AND t.config #>> '{notification,signing,secretRef}' <> 'secret://triggers/' || t.id::text || '/notification-signing');

UPDATE trigger t
SET config = jsonb_set(t.config, '{chatChannel,botTokenRef}',
                       to_jsonb('secret://triggers/' || t.id::text || '/bot-token')),
    updated_at = now()
WHERE t.config #>> '{chatChannel,botTokenRef}' LIKE 'secret://%'
  AND t.config #>> '{chatChannel,botTokenRef}' <> 'secret://triggers/' || t.id::text || '/bot-token'
RETURNING t.id AS trigger_id, 'chatChannel.botTokenRef' AS path;

UPDATE trigger t
SET config = jsonb_set(t.config, '{chatChannel,inboundSigningRef}',
                       to_jsonb('secret://triggers/' || t.id::text || '/inbound-signing')),
    updated_at = now()
WHERE t.config #>> '{chatChannel,inboundSigningRef}' LIKE 'secret://%'
  AND t.config #>> '{chatChannel,inboundSigningRef}' <> 'secret://triggers/' || t.id::text || '/inbound-signing'
RETURNING t.id AS trigger_id, 'chatChannel.inboundSigningRef' AS path;

UPDATE trigger t
SET config = jsonb_set(t.config, '{notification,signing,secretRef}',
                       to_jsonb('secret://triggers/' || t.id::text || '/notification-signing')),
    updated_at = now()
WHERE t.config #>> '{notification,signing,secretRef}' LIKE 'secret://%'
  AND t.config #>> '{notification,signing,secretRef}' <> 'secret://triggers/' || t.id::text || '/notification-signing'
RETURNING t.id AS trigger_id, 'notification.signing.secretRef' AS path;

COMMIT;
