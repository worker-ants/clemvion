-- V148: Merge 노드 config.timeout 의 옛 기본값 300 을 0 으로 바꾼다 (data fix)
--
-- 관련 spec:
--   - CLE-NODE-MERGE (설정 · REQ-MERGE-016 dormant 경고)
--   - NERV Task CLE-T-AGDM92 (결정) · CLE-T-HSHW71 (구현)
--
-- 배경:
--   Merge 의 timeout · partialOnTimeout 은 영구 dormant 다(ADR R-wontdo-async-fanin). 값이 0 보다
--   크면 경고 규칙 merge:timeout-dormant 가 blocking 으로 평가되어 handler.validate 가 실패하고
--   엔진이 INVALID_NODE_CONFIG 로 노드를 멈춘다. 그런데 스키마 기본값이 300 이라 새 노드와
--   가져온 노드가 그대로 저장됐다. 기본값은 코드에서 0 으로 바꾸고, 저장된 300 은 여기서 0 으로 바꾼다.
--
-- 범위:
--   type='merge' 이고 timeout 이 정확히 300 인 node 행만 바꾼다. 사용자가 직접 넣은 다른 값은
--   그대로 두어 캔버스 경고로 보이게 한다. workflow_version.snapshot 은 바꾸지 않는다(옛 버전을
--   복원하면 캔버스 경고로 드러난다). 다른 config 키는 jsonb_set 이 그대로 둔다.
--
-- 멱등성:
--   바꾼 행은 timeout 이 0 이라 다시 돌려도 대상이 없다. config @> 조건은 idx_node_config_gin 을 쓸 수 있다.

UPDATE node
SET config = jsonb_set(config, '{timeout}', '0'::jsonb)
WHERE type = 'merge'
  AND config @> '{"timeout": 300}'::jsonb;

-- DOWN: 되돌리지 않는다. 바꾼 뒤에는 원래 300 이던 행과 원래 0 이던 행을 구분할 수 없다.
--   바꾼 값은 실행 결과에 영향이 없다(dormant 필드).
