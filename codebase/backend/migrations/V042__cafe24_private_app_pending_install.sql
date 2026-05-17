-- Cafe24 Private 앱 연동은 우리 서비스가 OAuth popup 을 시작할 수 없고
-- Cafe24 Developers 의 "테스트 실행"이 우리 App URL 을 호출하는 방식으로
-- 동작한다. 이를 지원하기 위해:
--
-- 1. integration.status 에 'pending_install' 추가
--    - OAuth callback 완료 전까지의 임시 상태 (Cafe24 Private 앱 전용)
--    - 이 상태의 Integration 은 노드·AI Agent 에서 사용 불가
--
-- 2. integration.install_token 컬럼 추가
--    - App URL 호출 시 pending integration 식별에 사용하는 단방향 토큰
--    - HMAC 검증과 결합해 정확한 Integration 을 특정
ALTER TABLE integration
  ADD COLUMN install_token VARCHAR(64) NULL;

COMMENT ON COLUMN integration.install_token IS
  'Cafe24 Private 앱 전용. App URL 핸들러가 pending_install Integration 을 특정하기 위해 사용하는 랜덤 토큰. HMAC 검증 보조용이며, OAuth callback 완료 후 NULL 로 지워진다.';

-- status CHECK constraint 확장: 'pending_install' 추가
-- PostgreSQL 은 CHECK constraint 를 이름으로 DROP → ADD 해야 변경 가능
ALTER TABLE integration
  DROP CONSTRAINT IF EXISTS integration_status_check;

ALTER TABLE integration
  ADD CONSTRAINT integration_status_check
  CHECK (status IN ('connected', 'expired', 'error', 'pending_install'));
