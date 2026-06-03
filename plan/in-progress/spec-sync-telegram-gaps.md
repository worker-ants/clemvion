---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# telegram — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/7-trigger/providers/telegram.md

## 미구현 항목
- [ ] §5.1 AI Multi Turn: LLM 응답 직전 `sendChatAction(typing)` 1회 발송. 어댑터 `sendMessage` 는 `kind:'typing'` 지원하나 renderer 가 typing ChannelMessage 를 생성하지 않음 (producer 0건).
- [ ] §5.2 (3) button_callback 처리 후 `editMessageReplyMarkup` 으로 키보드 제거(중복 클릭 차단). adapter `ackInteraction` 은 `answerCallbackQuery` 만 호출, editMessage 메서드 부재.
- [ ] §3 / §5.4 `image` body → `sendPhoto` 발송. v1 어댑터는 `image` body 를 caption/fallbackText text 로 fallback (sendPhoto 미호출).
- [ ] §5.4 carousel `auto` v1: 카드별 imageUrl 있으면 `sendPhoto` 분기. 현재는 항상 `sendMessage` 로 imageUrl 을 `🖼 {url}` 텍스트 라인으로만 표시.
- [ ] §7 `/help` 정적 도움말 도달. `HooksService` 에 정적 안내 분기가 있으나 `parseTelegramUpdate` 가 `/help` 를 null 로 반환해 도달 불가(dead). parser 가 `/help` 를 통과시키는 command kind 가 필요.
- [ ] §8 per-chat rate-limit 큐 + delay (30 msg/sec across users, 1 msg/sec per chat). client 는 실패 시 지수 백오프만 있고 chat 단위 throttle 없음.
- [ ] §8 update_id 기반 30초 dedup. parser 가 `idempotencyKey` 를 채우나 이를 소비하는 consumer 0건.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__7-trigger__providers__telegram.md 참조.
- setWebhook secret_token 검증, RESUME_* 세션만료 분기, form 다단계 시퀀스, button/visual fallback(text monospace), execution failed/cancelled 안내는 정합 — 구현 완료 영역.
