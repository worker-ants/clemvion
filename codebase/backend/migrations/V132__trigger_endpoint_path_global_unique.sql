-- V132: trigger (endpoint_path) 전역 UNIQUE — V002 의 (workspace_id, endpoint_path) UNIQUE 를 교체
--
-- spec/1-data-model.md §3 인덱스 전략 · ## Rationale «Webhook `endpoint_path` 전역 유일 (2026-09-18)»
-- spec/5-system/12-webhook.md WH-SC-01 · spec/5-system/2-api-convention.md §12.2
-- 재현 · 실측 · 마이그레이션 검증: plan/complete/spec-draft-webhook-endpoint-path-global-unique.md
--
-- 수신 URL 이 워크스페이스 무관 전역 라우팅 키라 유일성도 전역이어야 한다 — 워크스페이스 단위 UNIQUE 는 경로를 알고 있는 다른
-- 워크스페이스의 복사 등록을 막지 못해 수신 웹훅을 가로챌 수 있었다(옛 스키마에서 재현). 이 인덱스는 수신 조회
-- (hooks.service · public-webhook-throttle.guard · embed-config.service — WHERE endpoint_path = ?)도 한 번에 찾는다:
-- 웹훅 트리거 5만에서 0.200 ms(옛 인덱스 전체 스캔, Index Searches: 1) → 0.025 ms. 인덱스를 교체하므로 수는 그대로다.
-- 충돌은 triggers.service.ts 가 인덱스 이름으로 좁혀 409 RESOURCE_CONFLICT + details.code TRIGGER_ENDPOINT_PATH_CONFLICT 로 바꾼다.
--
-- 운영 절차 ① — 경쟁: V131 뒤 이 파일 전에 다른 워크스페이스의 경로 복사가 끼어들면 CREATE UNIQUE 가 중복 키로 실패하고 새 인덱스가
--   invalid 로 남는다(옛 인덱스는 valid 그대로 — 보호가 줄지 않는다). Flyway 는 성공한 V131 을 다시 돌리지 않으므로 V131 의 DO 블록을
--   수동으로 다시 실행한 뒤 repair → migrate 한다(README §6 말미). 이 파일의 0) DROP 이 invalid 잔재를 치운다(실측).
-- 운영 절차 ② — 채팅 채널: V131 NOTICE 에 chat_channel=true 가 있으면 그 트리거의 소유 워크스페이스에 채팅 채널 설정을 다시 저장하게
--   한다 — setupChannel 이 새 경로로 provider 에 재등록한다(15-chat-channel R-CC-21 · CCH-AD-02).
--
-- 비-트랜잭션 (executeInTransaction=false, 동봉 .conf) — CREATE/DROP INDEX CONCURRENTLY 는 transaction block 안에서 실행할 수 없다.
-- README §5 «교체» 형태(선례 V110): 0) 새 이름 DROP(invalid 잔재 정리) → CREATE → 옛 이름 DROP.
DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_endpoint_path;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_trigger_endpoint_path
  ON trigger (endpoint_path)
  WHERE endpoint_path IS NOT NULL;
DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_workspace_endpoint;

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): 워크스페이스 간 중복이 새로 생겼으면 실패한다 —
--   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_trigger_workspace_endpoint ON trigger (workspace_id, endpoint_path) WHERE endpoint_path IS NOT NULL;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_endpoint_path;
