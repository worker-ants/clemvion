-- V060: External Interaction API 의 iext_* (per_execution JWT) jti 추적 테이블
--
-- 관련 spec:
--   - spec/5-system/14-external-interaction-api.md §3.3 EIA-AU-04 (terminal 시 즉시 blacklist 의무)
--   - plan/complete/external-interaction-api.md "완료 후 잔여" — JTI tracking
--
-- 배경
--   PR2 (#230) 의 v1 은 execution 종료 후에도 iext 의 ttl (default 1h) 까지 토큰이 valid 한
--   상태로 남는 잔여 위험. 본 마이그레이션이 그 해소의 첫 단계.
--
-- 모델
--   jti 가 PK. 한 execution 이 여러 jti 를 발급할 수 있음 (refresh 흐름) — execution_id 인덱스.
--   exp_at 컬럼은 blacklist 등록 시 ttl 산정에 사용 (Redis SET EX 의 초 단위).
--
-- 무중단 배포
--   신규 테이블만 추가. 기존 row 없음. 트랜잭션 모드.

CREATE TABLE execution_token (
    jti           TEXT PRIMARY KEY,
    execution_id  UUID NOT NULL REFERENCES execution(id) ON DELETE CASCADE,
    issued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exp_at        TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_execution_token_execution_id ON execution_token(execution_id);
