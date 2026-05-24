---
worktree: spec-slack-discord-chat-channel-bb4d35
started: 2026-05-24
owner: developer
status: completed
---

# ✅ 완료 — Phase 1~3 모두 commit

# Chat Channel bot token rotation 24h grace cron 통합

3 provider (Telegram / Slack / Discord) 의 bot token rotation 후 24h grace 종료 시점에 v2 token 의 `auth.revoke` (provider 가 지원하는 경우) + `secret_store` cleanup + trigger 컬럼 정리.

## 진입 조건 ✅

- [x] Telegram / Slack / Discord adapter 모두 supported (v1)
- [x] `rotateBotToken` API 가 provider-agnostic 으로 동작 (3 provider 모두 setupChannel 재호출 path 통과)

## 산출물 범위

1. `codebase/backend/src/modules/chat-channel/chat-channel-token-rotator.service.ts` 신설 (또는 기존 패턴 확장)
   - NestJS `@Cron(EVERY_HOUR)` — `trigger.chat_channel_rotated_at` 가 24h 경과한 trigger 조회
   - provider 별 분기:
     - Telegram: `auth.revoke` 미지원 — secret_store row 삭제 + 컬럼 정리만
     - Slack: `SlackClient.authRevoke(oldToken)` 호출 + secret_store row 삭제
     - Discord: 미지원 (Discord REST 에 token revoke endpoint 없음) — secret_store row 삭제만
   - `chat_channel_token_v2 = NULL` / `chat_channel_rotated_at = NULL` 갱신

2. `codebase/backend/src/modules/chat-channel/chat-channel-token-rotator.service.spec.ts`
   - 24h 경과 detection
   - provider 별 분기 (mock client)
   - secret_store cleanup 검증

3. `spec/5-system/15-chat-channel.md` CCH-SE-04-C 본문 검토 — 이미 명시되어 있으나 cron 주기 / 책임 모듈명 cross-link 갱신 가능.

## 위험 / 의존성

- NestJS Schedule 모듈 (`@nestjs/schedule`) 가 이미 imported 인지 확인 — 다른 cron job 이 있다면 같이 활용.
- multi-instance 환경에서 cron leader election — 기존 패턴 follow (PostgreSQL advisory lock 등).
- `auth.revoke` 실패는 best-effort (secret_store cleanup 은 진행).

## 참조

- Spec: `spec/5-system/15-chat-channel.md §3.4 CCH-SE-04 / §R-K`
- 선행: Slack `SlackClient.authRevoke` (이미 구현) + Discord client 에 동등 메서드 추가 검토
