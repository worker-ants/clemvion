-- V148: Merge 노드 config.timeout 의 옛 기본값 300 을 0 으로 바꾼다 (data fix)
--
-- 관련 spec:
--   - CLE-NODE-MERGE (설정 · REQ-MERGE-016 dormant 경고)
--   - NERV Task CLE-T-AGDM92 (결정) · CLE-T-HSHW71 (구현)
--
-- 배경:
--   Merge 의 timeout · partialOnTimeout 은 동작하지 않는 필드(dormant)다. CLE-NODE-MERGE Rationale
--   «비동기 fan-in barrier 활성화를 재검토 과제로 미룬다 (2026-07-17)» 가 barrier 를 무기한 미뤘다.
--   값이 0 보다 크면 경고 규칙 merge:timeout-dormant 가 blocking 으로 평가되어 handler.validate 가
--   실패하고 엔진이 INVALID_NODE_CONFIG 로 노드를 멈춘다. 그런데 스키마 기본값이 300 이라 새 노드와
--   가져온 노드가 그대로 저장됐다. 기본값은 코드에서 0 으로 바꾸고, 저장된 300 은 여기서 0 으로 바꾼다.
--
-- 범위:
--   type='merge' 이고 timeout 이 정확히 300 인 node 행만 바꾼다. 사용자가 직접 넣은 다른 값은
--   그대로 두어 캔버스 경고로 보이게 한다. workflow_version.snapshot 은 바꾸지 않는다(옛 버전을
--   복원하면 캔버스 경고로 드러난다). 옛 내보내기 JSON 에 timeout 300 이 적혀 있으면 가져온 뒤에도
--   300 이 남아 캔버스 경고로 드러난다. 다른 config 키는 jsonb_set 이 그대로 둔다. 바뀐 행은
--   trg_node_updated_at 트리거로 updated_at 이 갱신된다.
--
-- 멱등성:
--   바꾼 행은 timeout 이 0 이라 다시 돌려도 대상이 없다. config @> 조건은 idx_node_config_gin 을 쓸 수 있다.

UPDATE node
SET config = jsonb_set(config, '{timeout}', '0'::jsonb)
WHERE type = 'merge'
  AND config @> '{"timeout": 300}'::jsonb;

-- DOWN: 되돌리지 않는다. 바꾼 뒤에는 원래 300 이던 행과 원래 0 이던 행을 구분할 수 없다.
--   바꾼 값은 실행 결과에 영향이 없다(dormant 필드).
