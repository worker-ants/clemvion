-- Cafe24 Private install TTL 기준 분리 (사용자 결정 3).
--
-- 옛 흐름: TTL 스캐너가 `created_at < now - 24h` 로 만료를 판단했다.
--          이는 변경 3 (중복 pending_install 방지 — 같은 mall_id 의 기존
--          pending 행을 재사용) 과 결합 시, 사용자가 폼을 다시 제출해
--          새 install_token 이 발급되더라도 `created_at` 은 그대로라
--          새 토큰이 발급되자마자 24h 카운트가 거의 끝나 있을 수 있다.
-- 새 흐름: `install_token_issued_at` 컬럼을 별도로 두고 TTL 기준을
--          이 컬럼으로 옮긴다. 신규 토큰 발급 / 재사용 시 갱신된다.
--
-- 컬럼은 nullable — 옛 행 (마이그레이션 이전 발급) 은 NULL 로 남고,
-- 스캐너는 NULL fallback 으로 `created_at` 을 사용해 graceful transition.
ALTER TABLE integration
  ADD COLUMN install_token_issued_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN integration.install_token_issued_at IS
  'Cafe24 Private 앱 install_token 발급 시각. TTL 만료 기준 (now - 24h). 재사용/새 발급 시 갱신. 옛 행은 NULL — 스캐너가 created_at 으로 fallback.';
