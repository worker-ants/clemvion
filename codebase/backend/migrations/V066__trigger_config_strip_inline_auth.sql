-- V066: trigger.config 에서 폐지된 inline webhook 인증 키 제거 (cleanup)
--
-- 관련 spec:
--   - spec/5-system/12-webhook.md §2.2 (config 에 인증 키 미보유) + Rationale "inline auth path 폐지"
--   - spec/2-navigation/2-trigger-list.md R-14 (authConfigId v1 격상)
--
-- 배경:
--   webhook 인증이 trigger.auth_config_id → AuthConfig 단일 경로로 전환되면서, 과거 inline 키
--   (authType / secret / bearerToken / hmacHeader / hmacAlgorithm) 는 코드에서 read 되지 않는다.
--   특히 secret / bearerToken 은 평문 자격증명이라 trigger.config JSONB 에 잔존 시 백업·로그·
--   재현 경로로 유출될 수 있으므로 본 cleanup 으로 제거한다.
--
-- 멱등성:
--   config ?| array[...] 로 대상 키가 하나라도 있는 webhook 트리거만 갱신 — 재실행해도 no-op.
--   notification / interaction / chatChannel 등 다른 서브 키는 보존 (- 연산자는 명시 키만 제거).

UPDATE trigger
SET config = config - 'authType' - 'secret' - 'bearerToken' - 'hmacHeader' - 'hmacAlgorithm'
WHERE type = 'webhook'
  AND config ?| array['authType', 'secret', 'bearerToken', 'hmacHeader', 'hmacAlgorithm'];
