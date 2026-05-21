-- V062: Trigger 테이블에 Chat Channel 어댑터의 health / secret rotation 컬럼 5개 추가
--
-- 관련 spec:
--   - spec/5-system/15-chat-channel.md §4.2 (Trigger 테이블 신규 컬럼)
--   - spec/1-data-model.md §2.8 (Trigger)
--   - spec/conventions/chat-channel-adapter.md
--   - spec/4-nodes/7-trigger/providers/telegram.md
--
-- 변경 내역
--   1) chat_channel_health     — 외부 채널 (Telegram 등) 송수신 건강도 ('unknown'|'healthy'|'degraded')
--   2) chat_channel_last_error — 최종 실패 시 마지막 에러 메시지 (truncate 권장)
--   3) chat_channel_setup_at   — setupChannel() 가 마지막으로 성공한 시각 (외부 채널의 webhook 등록 시점)
--   4) chat_channel_token_v2   — Bot token rotation 24h grace 기간 동안의 신규 bot token reference
--                                (notification_secret_v2 와 동일 명명 패턴, 의미 비대칭은 spec §R-K 참조)
--   5) chat_channel_rotated_at — Bot token rotation 시작 시각 (grace 종료 판정용)
--
-- 무중단 배포 메모
--   - 모두 NULL 허용 또는 DEFAULT 'unknown' ALTER ADD COLUMN — 메타데이터만 변경, 비파괴.
--   - CONCURRENTLY 미사용 → 트랜잭션 모드 (.conf 불요).
--   - chat_channel_health 의 CHECK 제약은 spec CCH-SE-01 의 enum 강제.
--
-- 호환성
--   - Active bot token 자체는 본 마이그레이션 범위 외 — `config.chatChannel.botToken` (JSONB) 에 v1 stub
--     으로 보관 (notification.signing.secret 와 동일 stub 정책). spec §4.1 의 `botTokenRef` 도 미래 형태.
--     암호화 컬럼 분리는 follow-up plan.
--   - 기존 trigger 행은 chat_channel_health='unknown' 으로 초기화 — `chatChannel` 설정 자체가 있어야만
--     실제 헬스 변경 발생.

ALTER TABLE trigger
    ADD COLUMN chat_channel_health     VARCHAR(16) NOT NULL DEFAULT 'unknown',
    ADD COLUMN chat_channel_last_error TEXT,
    ADD COLUMN chat_channel_setup_at   TIMESTAMPTZ,
    ADD COLUMN chat_channel_token_v2   TEXT,
    ADD COLUMN chat_channel_rotated_at TIMESTAMPTZ;

-- enum 강제: spec CCH-SE-01 / §4.2 의 허용 값 외 입력 차단 (notification_health 와 동일 패턴).
ALTER TABLE trigger
    ADD CONSTRAINT chk_trigger_chat_channel_health
    CHECK (chat_channel_health IN ('unknown', 'healthy', 'degraded'));
