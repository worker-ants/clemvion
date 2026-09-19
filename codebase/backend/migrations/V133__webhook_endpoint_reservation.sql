-- V133: 웹훅 경로 영구 예약 — 지우거나 바꾼 경로를 다른 워크스페이스가 다시 등록하지 못하게
--
-- spec/1-data-model.md §2.8.1 WebhookEndpointReservation · §3 인덱스 전략 · ## Rationale «지운 · 바꾼 웹훅 경로의 영구 예약 (2026-09-19)»
-- spec/5-system/12-webhook.md «endpointPath 가변성» · spec/5-system/3-error-handling.md TRIGGER_ENDPOINT_PATH_CONFLICT
-- 설계 · 프로토타입 실측: plan/complete/spec-draft-webhook-endpoint-reservation.md
--
-- V132 의 (endpoint_path) 전역 UNIQUE 는 동시에 존재하는 중복만 막는다. 주인이 트리거를 지우거나 경로를 바꾸면 옛 경로가 비어,
-- 그 경로를 아는 누구든(외부 서비스 · 뷰어 · 전 멤버 · 웹챗 스니펫이 박힌 사이트의 방문자) 자기 워크스페이스에 다시 등록해 옛 URL 로
-- 오는 요청을 받을 수 있었다. 경로를 **처음 쓸 때** 트리거의 워크스페이스 소유로 예약하고, 예약은 지우지 않는다.
--
-- 강제는 DB 트리거다(V132 와 같은 원칙 — 앱 레벨 검사는 동시 요청을 막지 못한다). 새 경로를 동시에 잡는 두 요청은 PK 가 한쪽만
-- 통과시키고, 다른 쪽은 주인이 다르다는 것을 본다. 주인이 다르면 unique_violation(23505)을 제약 이름
-- webhook_endpoint_reservation_owner 로 낸다 — triggers.service.ts 가 idx_trigger_endpoint_path 위반과 함께
-- 409 RESOURCE_CONFLICT + details.code TRIGGER_ENDPOINT_PATH_CONFLICT 로 바꾼다(둘을 구분하지 않는다 — 경로가 한때 쓰였다는 사실을
-- 알리지 않는다). 살아 있는 트리거와 겹칠 때도 먼저 걸리는 것은 이 트리거다(BEFORE — 인덱스 검사보다 앞선다).
--
-- 순서가 뜻을 가진다: CREATE TRIGGER 가 trigger 테이블에 SHARE ROW EXCLUSIVE 를 잡아(커밋까지) 동시 INSERT/UPDATE 를 막은 뒤에
-- 백필한다. 백필과 트리거 사이로 새 경로가 빠져나갈 틈이 없다. 백필은 V132 로 이미 전역 유일인 경로라 충돌하지 않는다.
-- 이미 지워진 경로는 기록이 없어 예약하지 못한다 — 보호는 이 마이그레이션부터다.

CREATE TABLE webhook_endpoint_reservation (
    endpoint_path VARCHAR(255) PRIMARY KEY,
    -- 워크스페이스가 지워져도 예약은 남는다(주인 없음 → 누구도 못 쓴다).
    workspace_id UUID REFERENCES workspace(id) ON DELETE SET NULL,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK ON DELETE SET NULL(워크스페이스 삭제)이 테이블을 훑지 않게. 주인 없는 예약은 다시 찾을 일이 없어 부분 인덱스.
CREATE INDEX idx_webhook_endpoint_reservation_workspace_id
    ON webhook_endpoint_reservation (workspace_id)
    WHERE workspace_id IS NOT NULL;

CREATE OR REPLACE FUNCTION reserve_webhook_endpoint_path()
RETURNS TRIGGER AS $$
DECLARE
    reserved_by UUID;
BEGIN
    INSERT INTO webhook_endpoint_reservation (endpoint_path, workspace_id)
    VALUES (NEW.endpoint_path, NEW.workspace_id)
    ON CONFLICT (endpoint_path) DO NOTHING;

    -- 예약은 지우지 않으므로 방금 넣었거나 이미 있던 행이 반드시 있다. 주인 없는 예약(NULL)도 «다르다».
    SELECT workspace_id INTO reserved_by
      FROM webhook_endpoint_reservation
     WHERE endpoint_path = NEW.endpoint_path;

    IF reserved_by IS DISTINCT FROM NEW.workspace_id THEN
        RAISE EXCEPTION 'endpoint_path is reserved by another workspace'
            USING ERRCODE = 'unique_violation',
                  CONSTRAINT = 'webhook_endpoint_reservation_owner';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- workspace_id 도 감시한다 — 정상 경로엔 트리거를 다른 워크스페이스로 옮기는 쓰기가 없지만, 옮기면 예약 주인과 달라진다.
CREATE TRIGGER trg_trigger_reserve_endpoint_path
    BEFORE INSERT OR UPDATE OF endpoint_path, workspace_id ON trigger
    FOR EACH ROW
    WHEN (NEW.endpoint_path IS NOT NULL)
    EXECUTE FUNCTION reserve_webhook_endpoint_path();

INSERT INTO webhook_endpoint_reservation (endpoint_path, workspace_id)
SELECT endpoint_path, workspace_id
  FROM trigger
 WHERE endpoint_path IS NOT NULL;

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): 예약이 사라지면 지운 · 바꾼 경로를 다시 복사할 수 있게 된다 —
--   DROP TRIGGER IF EXISTS trg_trigger_reserve_endpoint_path ON trigger;
--   DROP FUNCTION IF EXISTS reserve_webhook_endpoint_path();
--   DROP TABLE IF EXISTS webhook_endpoint_reservation;
