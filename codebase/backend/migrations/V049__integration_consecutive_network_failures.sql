-- spec/2-navigation/4-integration.md §6 의 `connected → error(network) | 노드
-- 실행 중 커넥션 실패 3회 연속` 상태 전이를 위해 연속 transport 실패
-- 카운터를 Integration 행에 추가한다.
--
-- 의도:
-- * Cafe24ApiClient 의 fetch 실패 시 +1, 성공 시 0 으로 리셋.
-- * 3 도달 시점에 `status='error', status_reason='network'` 전이 + 카운터 리셋.
-- * 사용자가 reauthorize 또는 Rotate credentials 로 status 를 `connected`
--   로 되돌리면 카운터도 함께 초기화.
--
-- 컬럼은 NOT NULL DEFAULT 0 — 기존 행은 0 으로 backfill 되어 다음 호출
-- 시점부터 카운터가 정상 동작한다. spec 의도와 동일.

ALTER TABLE integration
  ADD COLUMN consecutive_network_failures INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN integration.consecutive_network_failures IS
  'Consecutive transport-level failures on this integration. Incremented by the API client on fetch errors, reset to 0 on success. Triggers status=error, status_reason=network at 3 (spec §6).';
