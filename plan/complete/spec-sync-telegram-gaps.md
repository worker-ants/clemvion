---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
spec_impact:
  - spec/4-nodes/7-trigger/providers/telegram.md
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
- **[v2 로드맵 이관]** §3 / §5.4 `image` body → `sendPhoto` 발송. spec §3(telegram.md:50)이 `미구현 (Planned)` + "v1 = text fallback" 명시, 어댑터 `case 'image'` 가 caption/fallbackText text 발송 = spec↔code 정합. **추적**: `chat-channel-visual-ssr-png.md` Phase 2(PNG producer→`body.kind='image'`).
- **[v2 로드맵 이관]** §5.4 carousel `auto`: 카드별 imageUrl → `sendPhoto` 분기. spec §5.4(telegram.md:160)가 "현재 = text 와 동일(imageUrl 도 텍스트 표시), sendPhoto 미호출 — 미구현 (Planned)" 명시, `renderCarouselFallback` 가 전 카드 text 발송 = 정합(drift 아님). **추적**: `chat-channel-visual-ssr-png.md` Phase 4(Carousel PNG). 공유타입(`body.image` bytes-only) 변경 리스크 격리.
- **[v2 로드맵 이관]** §8 per-chat outbound rate-limit 큐 + delay (30 msg/sec across users, 1 msg/sec per chat). spec §8(telegram.md:225) `미구현 (Planned)` 명시, client 는 지수 백오프만 = 정합. **추적 SoT** = spec §8 Planned 마커(inbound CCH-NF-03 rate-limiter 와 별개 인프라).
- **[v2 로드맵 이관]** §8 update_id 기반 30초 dedup. spec §8(telegram.md:226) `미구현 (Planned)` 명시, parser 가 `idempotencyKey` 를 채우나 소비 consumer 0건 = 정합. **추적 SoT** = spec §8 Planned 마커(Redis dedup 설계, provider-level 보장 있어 우선순위 낮음).

## 종결 (2026-07-05)
- 5인 검증 재확인: 세 `[x]`(typing prepend·editMessageReplyMarkup·/help) 코드-정합. 네 잔여(image·carousel·rate-limit·dedup)는 spec §3/§5.4/§8 이 전부 `미구현 (Planned)` + 코드 일치 = **live drift 0**. 특히 §5.4 carousel imageUrl 은 spec 이 v1=text 로 약속하므로 drift 아님(별도 line-by-line 확인).
- spec `telegram.md` `status: partial → implemented` 승격 + `pending_plans` 제거(같은 commit). image/carousel 추적은 `chat-channel-visual-ssr-png.md`, rate-limit/dedup 은 spec §8 Planned 마커가 SoT.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__7-trigger__providers__telegram.md 참조.
- setWebhook secret_token 검증, RESUME_* 세션만료 분기, form 다단계 시퀀스, button/visual fallback(text monospace), execution failed/cancelled 안내는 정합 — 구현 완료 영역.
