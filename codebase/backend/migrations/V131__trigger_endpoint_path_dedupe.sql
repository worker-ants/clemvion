-- V131: trigger.endpoint_path 의 워크스페이스 간 중복 정리 — V132 전역 UNIQUE 의 선행 조건
--
-- spec/1-data-model.md §3 인덱스 전략 · ## Rationale «Webhook `endpoint_path` 전역 유일 (2026-09-18)»
-- 재현 · 실측 · 마이그레이션 검증: plan/complete/spec-draft-webhook-endpoint-path-global-unique.md
--
-- 수신 URL /api/hooks/:endpointPath 는 워크스페이스 무관 전역 라우팅 키인데 유일성은 (workspace_id, endpoint_path) 뿐이었다(V002).
-- endpoint_path 는 클라이언트가 만들어 보내고 바꿀 수도 있어, 경로를 알고 있는 다른 워크스페이스가 같은 경로를 등록할 수 있었다 —
-- 그러면 수신 조회(워크스페이스 없이 · 정렬 없이 한 행)가 둘 중 하나를 골라 웹훅이 복사한 쪽으로 갈 수 있었다.
-- 정상 경로로는 워크스페이스 간 중복이 생기지 않는다(복제 · 가져오기는 트리거를 옮기지 않는다) — 중복이 있다면 복사 등록의 흔적이다.
--
-- 정책(2026-09-18 사용자 결정): 경로가 같은 묶음마다 가장 먼저 만든 트리거(created_at, 같으면 id)만 경로를 유지하고
-- 나머지는 gen_random_uuid() 로 새 경로를 받는다 — 복사는 원본보다 나중에만 생길 수 있어서다. created_at 은 트랜잭션 시작
-- 시각(now())이라 서로 다른 트랜잭션이 같은 값을 받을 수 있고, 그때는 id(UUID) 순서가 정한다 — «가장 먼저» 가 아니라 결과를
-- 결정적으로 만드는 규칙이다(복사는 원본을 본 뒤의 다른 요청이라 같은 마이크로초를 받는 일은 드물다). 새 경로도 v4 형식이라
-- trigger 의 endpoint_path CHECK 를 통과한다. NOTICE 에는 트리거 id · 워크스페이스 id · 채팅 채널 여부만 남긴다 —
-- 경로는 공개 웹훅의 비밀 키 역할이라(12-webhook WH-SC-01) 로그에 남기지 않는다.
--
-- 채팅 채널 트리거(config ? 'chatChannel')가 새 경로를 받으면 provider(Telegram · Slack · Discord)에 등록된 URL 은 옛 경로 그대로다 —
-- SQL 은 provider API 를 부를 수 없다. 채팅 채널 상태 컬럼은 쓰지 않는다(degraded 는 «외부 API 호출 실패» 신호로 경로가 닫혀 있다,
-- 15-chat-channel R-CC-19). NOTICE 의 chat_channel=true 목록은 V132 헤더의 운영 절차대로 소유자가 채널 설정을 다시 저장해야 한다.
--
-- 옛 스키마에 중복을 심은 프로브 실측: 묶음 2(셋 · 둘) → 가장 먼저 만든 둘만 유지, 셋 새 경로(v4), 중복 0. 다시 돌리면 0건(멱등).
--
-- 트랜잭션 파일이다(.conf 없음) — DO 블록은 transactional statement 라 V132 의 CONCURRENTLY 와 한 파일에 둘 수 없다
-- (migrations/README.md §5 mixed 판정).
DO $$
DECLARE
  r record;
  n integer := 0;
  n_chat integer := 0;
BEGIN
  FOR r IN
    SELECT d.id, d.workspace_id, d.is_chat
    FROM (
      SELECT id, workspace_id, (config ? 'chatChannel') AS is_chat,
             row_number() OVER (PARTITION BY endpoint_path ORDER BY created_at, id) AS rn
      FROM trigger
      WHERE endpoint_path IS NOT NULL
    ) d
    WHERE d.rn > 1
  LOOP
    UPDATE trigger SET endpoint_path = gen_random_uuid()::text, updated_at = now() WHERE id = r.id;
    RAISE NOTICE 'V131: trigger % (workspace %, chat_channel=%) endpoint_path regenerated', r.id, r.workspace_id, r.is_chat;
    n := n + 1;
    IF r.is_chat THEN
      n_chat := n_chat + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'V131: % trigger(s) regenerated, % chat channel (owner must re-save the channel settings)', n, n_chat;
END $$;

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): 되돌릴 수 없다 — 옛 경로는 로그에 남기지 않았다.
