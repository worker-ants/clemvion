-- V059: Trigger 테이블에 External Interaction API 의 notification health / secret rotation 컬럼 4개 추가
--
-- 관련 spec:
--   - spec/5-system/14-external-interaction-api.md §7.1 (Trigger 엔티티 확장)
--   - spec/5-system/12-webhook.md §2.2 (config 필드 구조)
--   - spec/1-data-model.md §2.8 (Trigger)
--
-- 변경 내역
--   1) notification_health       — Outbound notification 발송 건강도 ('unknown'|'healthy'|'degraded')
--   2) notification_last_error   — 최종 실패 시 마지막 에러 메시지 (truncate 가능)
--   3) notification_secret_v2    — Secret rotation 기간 (24h grace) 동안의 신규 secret
--   4) notification_rotated_at   — Secret rotation 시작 시각 (grace 종료 판정용)
--
-- 무중단 배포 메모
--   - 모두 NULL 허용 (또는 DEFAULT 'unknown') ALTER ADD COLUMN — 메타데이터만 변경하므로 비파괴.
--   - CONCURRENTLY 미사용 → 트랜잭션 모드 (.conf 불요).
--   - notification_health 의 CHECK 제약은 [Spec EIA §R6 — degraded 표시만] 의 enum 제약 강제.
--
-- 호환성
--   - notification / interaction 설정 자체는 config JSONB 안에 저장 (별도 컬럼 신설 X). 본 마이그레이션은
--     health 추적 / secret rotation 추적에 필요한 별도 컬럼만 추가한다.
--   - 기존 trigger 행은 notification_health='unknown' 으로 초기화 — outbound notification 이 처음
--     발송될 때 'healthy' 또는 'degraded' 로 갱신된다.

ALTER TABLE trigger
    ADD COLUMN notification_health     VARCHAR(16) NOT NULL DEFAULT 'unknown',
    ADD COLUMN notification_last_error TEXT,
    ADD COLUMN notification_secret_v2  TEXT,
    ADD COLUMN notification_rotated_at TIMESTAMPTZ;

-- enum 강제: spec §R6 / §7.1 의 허용 값 외 입력 차단.
ALTER TABLE trigger
    ADD CONSTRAINT chk_trigger_notification_health
    CHECK (notification_health IN ('unknown', 'healthy', 'degraded'));
