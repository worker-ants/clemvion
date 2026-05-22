---
worktree: chat-channel-secret-store-pgcrypto
started: 2026-05-22
owner: resolution-applier
---
# Spec Fix Draft — Chat Channel Token V2 승격 Cron (#11)

## 원본 발견사항
SUMMARY#11: `chat_channel_token_v2` v2 → primary 승격 cron 미존재 — v2 ref 저장이 dead code.
위치: `chat-channel.controller.ts:rotateBotToken`

## 현황 분석

현재 구현:
- `rotateBotToken` 이 기존 botToken 을 `chat_channel_token_v2` (= secret store ref `...bot-token.v2`) 로 보관
- 24h grace 후 승격 cron 이 없음 → `chat_channel_token_v2` 가 영구 잔류 (dead code 상태)

`notification_secret_v2` 는 `NotificationSecretRotatorService` (매시간 cron) 가 승격한다.
동일 패턴이 chat channel token 에 없음.

## 제안 변경

`spec/5-system/15-chat-channel.md §CCH-SE-04` 에 다음 추가:

```
#### CCH-SE-04-C: bot token rotation grace 승격

`rotate-bot-token` 완료 후 `chat_channel_token_v2` 에 이전 token ref 가 저장된다.
24h grace 경과 후 아래 동작이 수행되어야 한다:

1. `chat_channel_token_v2` ref 의 secret store row 삭제 (`secrets.delete(v2Ref)`)
2. `trigger.chat_channel_token_v2 = null`, `trigger.chat_channel_rotated_at = null` 저장

구현: `ChatChannelTokenRotatorService` — `NotificationSecretRotatorService` 와 동일 패턴.
```

## 구현 작업 항목 (project-planner → developer 위임)
- `ChatChannelTokenRotatorService` 클래스 신설 (`@Cron(CronExpression.EVERY_HOUR)`)
- `TriggersService.promoteBotTokenV2()` 메서드 추가
- `ChatChannelModule` 에 provider 등록
