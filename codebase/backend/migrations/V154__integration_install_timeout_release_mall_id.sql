-- V154: 설치 기한이 지나 만료된 설치 대기 행의 상점 식별자를 비운다 (data fix)
--
-- 관련 spec:
--   - CLE-INT-STATUS REQ-INTSTAT-040
--   - CLE-INT-OAUTH REQ-INTOAUTH-068 · Rationale «만료된 설치 대기 행은 상점 자리를 놓는다»
--   - CLE-INT-DATA 「통합(integration)」 의 상점 식별자 유일성
--   - NERV Task CLE-T-PS7JQY
--
-- 배경:
--   설치 대기 행이 24시간 안에 설치되지 않으면 만료 스캐너가 expired(install_timeout) 로 바꾼다. 그 행이 mall_id 를 그대로
--   들고 있어 상점 식별자 UNIQUE(V072 의 (workspace_id, service_type, mall_id))를 잡았다. 같은 상점을 다시 등록하려면 그
--   행을 지워야 했고, 남의 개인 행이면 지울 수 있는 사람이 없었다. 이제 스캐너가 만료할 때 mall_id 를 함께 비운다. 이 파일은
--   이미 만료된 행을 같은 상태로 맞춘다.
--
-- 범위:
--   status='expired' AND status_reason='install_timeout' 이고 mall_id 가 남은 행만 바꾼다. credentials 안의 mall_id ·
--   shop_uid 는 그대로 둔다. 상태 · 사유 · 설치 토큰도 그대로다. 행 자체는 지우지 않는다.
--
-- 잠금:
--   바꿀 행에만 행 잠금을 건다. 5초 안에 잡지 못하면 이 파일만 바뀌는 것 없이 실패하고, 다시 돌리면 이 파일부터 이어진다.
--
-- 멱등성:
--   바꾼 행은 mall_id 가 NULL 이라 다시 돌려도 대상이 없다.
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  n integer;
BEGIN
  UPDATE integration
  SET mall_id = NULL, updated_at = now()
  WHERE status = 'expired'
    AND status_reason = 'install_timeout'
    AND mall_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'V154: % install_timeout integration(s) released mall_id', n;
END $$;

-- DOWN: 되돌리지 않는다. 비운 값은 credentials.mall_id(MakeShop 은 credentials.shop_uid)에 남아 있지만, 되돌리면 그 행이
--   다시 상점 자리를 잡아 같은 상점을 등록하지 못한다.
