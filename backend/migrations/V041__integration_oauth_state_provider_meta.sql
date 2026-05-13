-- Cafe24 OAuth 흐름은 begin 시점부터 callback 까지 provider 한정 메타를
-- 보관해 token 교환 URL (`https://{mall_id}.cafe24api.com/api/v2/oauth/token`)
-- 을 구성한다. spec/2-navigation/4-integration.md §3.2 "사전 입력 →
-- preview_token" 의 임시 저장소 의도를 OAuth state row 의 nullable JSONB
-- 컬럼으로 구현 (TTL 10분, state 컨슘 시 함께 삭제). 컬럼 값은 애플리케이션
-- 레벨에서 AES-256-GCM (encryptedJsonTransformer) 으로 암호화돼 저장되며,
-- 민감 필드(예: private 앱 시크릿)는 DB 덤프·복제 스트림·slow query log 에
-- 평문으로 노출되지 않는다.
--
-- 컬럼은 nullable 이며 default null — google/github 등 기존 흐름은 영향 없음.
ALTER TABLE integration_oauth_state
  ADD COLUMN provider_meta JSONB NULL;

COMMENT ON COLUMN integration_oauth_state.provider_meta IS
  'Provider-specific OAuth begin metadata (AES-256-GCM encrypted at rest, see encryptedJsonTransformer). Shape is provider-defined; cleared with the state row on callback consumption or TTL expiry.';
