---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# chat-channel — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 유지하며 분리한 미구현/불일치 항목 추적.
> 관련 spec: spec/5-system/15-chat-channel.md

## 미구현 항목
- [ ] CCH-CV-03 (b) 분기 — `running`/`pending` (waiting_for_input 미도달) 케이스에서 `executionStillRunning` 안내 발송 + update 무시. 현재 `HooksService.isActiveExecution` 이 비-terminal 전부를 single `active` 로 collapse 후 무조건 인터랙션 forwarding (R9 가 우려한 input-sequence 충돌이 코드에 존재).
- [ ] §5.5 비활성 trigger (chatChannel 경로) 202 silent skip 예외 — 현재 `!trigger.isActive` 검사가 chatChannel 분기보다 먼저 실행되어 비활성 chatChannel 트리거도 410 Gone 반환. WH-EP-07 chat-channel 예외 + R-CC-12 (d) 비활성 트리거 인증 수행 미구현.
- [ ] CCH-NF-03 — `rateLimitPerMinute` 분당 enforcement·chat 단위 큐·폭주 시 `chat_channel_health=degraded` 갱신 로직 (현재 config 저장 슬롯만 존재).
- [ ] §5.4 rotate-bot-token 성공 응답에 `triggerId` / `chatChannelHealth` / `botIdentity` 3필드 동봉 (현재 `{ rotatedAt }` 만 반환).

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__15-chat-channel.md 참조.
- `{ ignored: true }` ↔ `{ executionId: 'ignored' }` body shape 불일치, §5.4 error code 불일치(RESOURCE_NOT_FOUND/INVALID_BOT_TOKEN 등), §7 트리 stale 은 spec 본문을 코드 현실로 정정 완료 (별도 구현 불필요).
