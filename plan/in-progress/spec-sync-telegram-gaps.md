---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# telegram — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/7-trigger/providers/telegram.md

## 미구현 항목

> **구현 진척 (2026-06-14, impl-telegram-gaps PR)**: 아래 1·2·5 구현 완료(단위 테스트 포함). 3·6 은 인프라
> 의존으로 spec 이 명시적으로 v1 deferred 처리한 항목이라 보류, 4 는 공유 타입 확장 리스크로 별도 분리, 7 은 별도
> Redis dedup 설계 필요로 보류. **spec doc-sync 동반 완료**: ai-review SPEC-DRIFT(W1/W2) 지적에 따라 본 PR 에서
> `telegram.md` §5.1·§5.2(3)·§4·§7 의 "미구현 (Planned)" 한정어를 구현 반영으로 갱신 + `chat-channel-adapter.md`
> button_callback union 에 `messageId?: string` 등재 (코드+spec 자기정합 PR).

- [x] §5.1 AI Multi Turn: LLM 응답 직전 `sendChatAction(typing)` 1회 발송. — **완료**: `telegram-message.renderer.ts` `renderAiMessage` 가 text 발화 전 `{ kind: 'typing' }` ChannelMessage 를 prepend (빈 응답이면 생략). 어댑터 `case 'typing'` 가 `sendChatAction` 발송. 테스트: renderer.spec ai_message → typing+text.
- [x] §5.2 (3) button_callback 처리 후 `editMessageReplyMarkup` 으로 키보드 제거(중복 클릭 차단). — **완료**: `telegram-client.ts` `editMessageReplyMarkup` 메서드 추가, parser 가 `callback_query.message.message_id` 를 `command.messageId` 로 동봉(ChannelCommand 타입에 옵션 필드 추가, 타 provider 무영향), adapter `ackInteraction` 이 ack 후 best-effort 로 빈 inline_keyboard 편집(실패는 삼킴). 테스트: parser messageId 동봉 + adapter 3건.
- [x] §7 `/help` 정적 도움말 도달. — **이미 구현됨(확인)**: `parseTelegramUpdate.readCommand` 가 `/help` 를 `text_message` 로 통과시키고(parser L117-122) `HooksService` 가 `/help` 분기에서 `languageHints.help`/기본 문구 발송. plan 의 "null 반환 dead" 서술은 stale. 테스트(parser.spec `/help`)도 기존재.
- [ ] §3 / §5.4 `image` body → `sendPhoto` 발송. — **보류 (인프라 의존, spec v1 deferred)**: `ChannelMessage.body.image` 는 `bytes: Buffer` 인데 이를 multipart 로 업로드하려면 client.call 에 multipart 지원 + 애초에 PNG bytes 를 만드는 SSR producer 가 필요(v1 미도입). spec §3 이 "v1 = text fallback (multipart/SSR PNG 인프라 미도입)" 로 명시 — 진성 v2 항목.
- [ ] §5.4 carousel `auto` v1: 카드별 imageUrl 있으면 `sendPhoto` 분기. — **별도 분리**: Telegram `sendPhoto` 는 photo=URL 직접 수용이라 구현 가능하나, `ChannelMessage.body.image` 가 `bytes` 만 받으므로 URL variant 추가 = 공유 타입 변경(slack/discord image 경로 cross-impact). 리스크 격리 위해 별도 PR 로 분리.
- [ ] §8 per-chat outbound rate-limit 큐 + delay (30 msg/sec across users, 1 msg/sec per chat). — **보류 (인프라)**: 분산 outbound throttle/큐 설계 필요(inbound CCH-NF-03 rate-limiter 와 별개). spec §8 "Planned".
- [ ] §8 update_id 기반 30초 dedup. — **보류 (별도 설계)**: Redis dedup(예: `cc:dedup:{triggerId}:{update_id}` TTL) 을 `HooksService.handleChatChannelWebhook` 진입점에 추가 필요. inbound rate-limiter Redis 패턴 재사용 가능. Telegram provider-level 보장이 있어 우선순위 낮음 — 별도 PR.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__7-trigger__providers__telegram.md 참조.
- setWebhook secret_token 검증, RESUME_* 세션만료 분기, form 다단계 시퀀스, button/visual fallback(text monospace), execution failed/cancelled 안내는 정합 — 구현 완료 영역.
