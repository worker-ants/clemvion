-- V151: integration.reinstall_requested_at — Cafe24 Private 재설치 요청 표시
--
-- NERV CLE-INT-DATA · CLE-INT-OAUTH, NERV Task CLE-T-NNENG8.
--
-- Cafe24 Private 은 우리 서버가 OAuth 를 시작하지 못한다. 쇼핑몰 관리자가 Cafe24 에서 「테스트 실행」을 누르면 App URL 이
-- 호출되고, App URL 은 설치 대기(`pending_install`) 행만 OAuth authorize 로 보낸다. 그래서 이미 연결된 행에서 권한을 추가하거나
-- 재인증하려면 삭제 후 재등록밖에 없었다. 권한 추가 · 재인증이 이 컬럼에 시각을 남기면 App URL 은 설치 대기가 아닌 행도 OAuth 로
-- 보내고, 콜백이 성공하면 이 컬럼을 비운다.
--
-- 왜 별도 컬럼인가: `status='pending_install'` 을 다시 쓰면 설치 대기 TTL 스캐너가 24시간 뒤 행을 `expired / install_timeout` 으로
-- 바꾸고 `install_token` 을 지운다. 그 사이 기존 토큰으로 돌던 실행도 막힌다. `status_reason` 에 새 값을 넣는 방안은 connected 의
-- 사유가 NULL 이라는 규칙과 부딪친다. 그래서 상태와 사유를 건드리지 않는 nullable 컬럼을 둔다.
--
-- nullable · DEFAULT 없음: 기존 행은 NULL(표시 없음)로 남는다. 테이블 rewrite 없이 메타데이터만 바뀐다.
SET LOCAL lock_timeout = '3s';

ALTER TABLE integration
  ADD COLUMN reinstall_requested_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN integration.reinstall_requested_at IS
  'Cafe24 Private 재설치 요청 시각. 권한 추가 · 재인증이 남기고 App URL 이 이 값을 보면 설치 대기가 아닌 행도 OAuth 로 보낸다. 콜백 성공 시 NULL.';

-- DOWN:
-- ALTER TABLE integration DROP COLUMN IF EXISTS reinstall_requested_at;
