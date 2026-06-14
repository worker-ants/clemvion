-- V096: execution 행에 webhook 호출 메타데이터(소스 IP·응답 코드) 컬럼 추가.
-- (spec/2-navigation/6-config.md §A.3 호출 이력, spec/1-data-model.md §2.13 Execution,
--  WH-MG-05 "응답 코드 확인 필수" 이행.)
--
-- 인증 설정 사용 내역(GET /api/auth-configs/:id/usage)의 호출 이력 테이블이
-- "소스 IP"·"응답 코드" 컬럼을 노출하려면 webhook 발화 시점의 두 값을 영속해야 한다.
-- 기존엔 hooks.service 가 extractClientIp 로 소스 IP 를 추출하되 인증 검증에만 쓰고
-- 버렸고(미저장), HTTP 응답 코드는 어디에도 기록되지 않았다.
--
-- 저장 위치 = execution 행 (별도 call-log 엔티티 미도입). 인증 사용 집계는
-- `Execution.trigger_id → Trigger.auth_config_id` 조인으로 이미 totalCalls/recentCalls
-- 를 산출하므로, 같은 행에 컬럼을 추가하는 것이 조인 1회로 끝나 가장 단순하다
-- (Integration 의 전용 IntegrationUsageLog 와 달리 AuthConfig 는 Execution 을 SoT 로 재사용).
--
--   source_ip    VARCHAR(45) — IPv4/IPv6 표기 최대 길이(45자, IPv4-mapped IPv6 포함).
--                 webhook/chat-channel 트리거 발화 시 extractClientIp 결과. 비-HTTP
--                 트리거(schedule 등)·배포 이전 row 는 NULL.
--   response_code VARCHAR(10) — webhook 호출이 받은 실제 HTTP 응답 코드 문자열
--                 (성공 경로 = '202' Accepted). 비-HTTP 트리거·배포 이전 row 는 NULL →
--                 getUsage 가 status enum 으로 폴백 표시.
--
-- 두 컬럼 모두 nullable·default null — 회귀 없음(기존 row·schedule 실행은 NULL 유지).
ALTER TABLE execution
  ADD COLUMN source_ip VARCHAR(45) NULL,
  ADD COLUMN response_code VARCHAR(10) NULL;

COMMENT ON COLUMN execution.source_ip IS
  'Client IP (extractClientIp) captured at webhook/chat-channel trigger firing. NULL for non-HTTP triggers (schedule) and pre-deploy rows. Surfaced by GET /api/auth-configs/:id/usage recentCalls (spec/2-navigation/6-config.md §A.3).';

COMMENT ON COLUMN execution.response_code IS
  'Actual HTTP response code returned to the webhook caller (success path = ''202''). NULL for non-HTTP triggers / pre-deploy rows; getUsage falls back to status enum (WH-MG-05).';

-- §A.3 getUsage 쿼리 성능 — trigger_id IN (...) + started_at 범위 스캔 지원 (W-5).
-- trigger_id IS NOT NULL 조건: schedule/manual(trigger_id=NULL) 행을 제외해 인덱스 크기 최소화.
CREATE INDEX IF NOT EXISTS idx_execution_trigger_started
  ON execution (trigger_id, started_at DESC)
  WHERE trigger_id IS NOT NULL;

-- DOWN:
-- DROP INDEX IF EXISTS idx_execution_trigger_started;
-- ALTER TABLE execution DROP COLUMN IF EXISTS response_code;
-- ALTER TABLE execution DROP COLUMN IF EXISTS source_ip;
