---
worktree: chat-channel-gaps
started: 2026-06-03
owner: planner
spec_impact:
  - spec/5-system/15-chat-channel.md
  - spec/conventions/chat-channel-adapter.md
---

# chat-channel — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 유지하며 분리한 미구현/불일치 항목 추적.
> 관련 spec: spec/5-system/15-chat-channel.md

## 미구현 항목
- [x] CCH-CV-03 (b) 분기 — `running`/`pending` (waiting_for_input 미도달) 케이스에서 `executionStillRunning` 안내 발송 + update 무시. **구현 완료** (2026-06-12): `HooksService.isActiveExecution` → `getActiveExecutionStatus` (status 반환) 로 확장, forwarding 분기는 `status === waiting_for_input` 일 때만 (a) 수행, `running`/`pending` 이면 `sendExecutionStillRunningNotice` + `{ executionId: 'ignored' }` (R9 실현). spec CCH-CV-03 본문 갱신.
- [x] §5.5 비활성 trigger (chatChannel 경로) 202 silent skip 예외 — **이미 구현됨** (본 plan 작성 후 선행 구현). 현재 `config.chatChannel` 분기가 `!trigger.isActive` 검사보다 먼저 실행되고, `handleChatChannelWebhook` 이 `verify()` 후 `!isActive` 시 `{ executionId: 'ignored' }` (202) 로 단락. spec §5.5 표 + R-CC-12 (d) 가 구현 일치로 이미 기술. plan 기재("현재 410 Gone")가 stale 이었음 — 코드 변경 불요.
- [x] CCH-NF-03 — `rateLimitPerMinute` 분당 enforcement + 초과분 skip + `chat_channel_health=degraded`. **구현 완료** (2026-06-12, spec+구현 동일 PR): 메커니즘 확정(spec CCH-NF-03/R-CC-19: per-chat Redis fixed-window 기본 60, 초과분 버퍼링 없이 skip → 202 ignored + degraded, Redis 미가용 fail-open; "큐 적재→재발사" 는 WH-NF-01·R9 정합상 미채택) + 구현(`ChatChannelRateLimiterService.consume` + `HooksService.handleChatChannelWebhook` parseUpdate 직후 enforcement + `markChatChannelRateLimited`).
- [x] §5.4 rotate-bot-token 성공 응답에 `triggerId` / `chatChannelHealth` / `botIdentity` 3필드 동봉. **구현 완료** (2026-06-12): `rotateBotToken` 반환 타입·값 확장 (botIdentity 는 `configUpdates.botIdentity ?? null`), controller 반환 타입 동기, spec §5.4 예시 갱신.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__15-chat-channel.md 참조.
- `{ ignored: true }` ↔ `{ executionId: 'ignored' }` body shape 불일치, §5.4 error code 불일치(RESOURCE_NOT_FOUND/INVALID_BOT_TOKEN 등), §7 트리 stale 은 spec 본문을 코드 현실로 정정 완료 (별도 구현 불필요).
- **§7 동시 갱신 의무**: 위 미구현 항목(특히 §5.4 rotate-bot-token 성공 응답 3필드 동봉) 구현 시 응답 계약이 바뀌므로, [`conventions/chat-channel-adapter.md §7 변경 관리`](../../spec/conventions/chat-channel-adapter.md) 의 "두 spec 동시 갱신" 규약에 따라 `15-chat-channel.md` 와 `chat-channel-adapter.md` 를 함께 갱신한다.
