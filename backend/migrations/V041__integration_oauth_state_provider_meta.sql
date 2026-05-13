-- Cafe24 OAuth 흐름은 begin 시점부터 callback 까지 mall_id / app_type /
-- (private 앱 한정) client_id·client_secret 같은 provider 한정 메타를 보관
-- 해야 token 교환 URL (`https://{mall_id}.cafe24api.com/api/v2/oauth/token`)
-- 을 구성할 수 있다. spec/2-navigation/4-integration.md §3.2 "사전 입력 →
-- preview_token" 의 임시 저장소 의도를 OAuth state row 의 nullable JSONB
-- 컬럼으로 구현 (TTL 10분, state 컨슘 시 함께 삭제).
--
-- 컬럼은 nullable 이며 default null — google/github 등 기존 흐름은 영향 없음.
ALTER TABLE integration_oauth_state
  ADD COLUMN provider_meta JSONB NULL;

COMMENT ON COLUMN integration_oauth_state.provider_meta IS
  'Provider-specific begin-time metadata. Cafe24: { mall_id, app_type, client_id?, client_secret? } (private app credentials only persist for the state TTL).';
