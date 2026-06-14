# Requirement Review — impl-telegram-gaps

리뷰 대상 파일 8종 (telegram-client, renderer, parser, adapter 및 관련 spec 파일).

---

## 발견사항

### [SPEC-DRIFT] [WARNING] §5.1 AI Multi Turn — typing indicator 구현 완료, spec 미반영

- **위치**: `spec/4-nodes/7-trigger/providers/telegram.md §5.1` (line 101)
- **상세**: spec 본문은 typing indicator 를 "**미구현 (Planned)**" 으로 명기하고 있으나, 이번 PR 에서 `telegram-message.renderer.ts` 의 `renderAiMessage` 가 `execution.ai_message` 처리 시 `typing` ChannelMessage 를 선행 발송하도록 변경되어 이미 구현 완료 상태가 됐다. 코드는 올바르고 plan 파일(`plan/in-progress/spec-sync-telegram-gaps.md §미구현 항목 첫 줄`)의 추적 항목을 해소하는 의도적 구현이다.
- **제안**: 코드 유지 + spec 반영. `spec/4-nodes/7-trigger/providers/telegram.md §5.1` 의 "미구현 (Planned)" 설명 제거 및 "구현 완료" 로 갱신 필요. `plan/in-progress/spec-sync-telegram-gaps.md` 의 해당 체크박스도 체크.

---

### [SPEC-DRIFT] [WARNING] §5.2(3) editMessageReplyMarkup + messageId 구현 완료, spec 미반영

- **위치**: `spec/4-nodes/7-trigger/providers/telegram.md §5.2` (line 116), `spec/conventions/chat-channel-adapter.md §2.1 ChannelUpdate.command` (line 178)
- **상세**: 두 가지 SPEC-DRIFT 가 동시 발생:
  1. `telegram.md §5.2` line 116 이 `editMessageReplyMarkup` 을 "**미구현 (Planned, 옵션)**" 으로 명기하나 이번 PR 에서 완전히 구현됐다.
  2. `chat-channel-adapter.md §2.1` 의 `button_callback` 타입 정의 (`{ kind: "button_callback"; callbackData: string; callbackQueryId: string }`) 에 `messageId?: string` 필드가 없다. 코드(`types.ts`, `telegram-update.parser.ts`)는 옵셔널 `messageId` 를 추가했는데 이는 합리적 확장이며 되돌릴 이유가 없다.
  3. `telegram.md §4` 명령 매핑 표의 `callback_query` 행(`{ kind: "button_callback", callbackData }`)도 `callbackQueryId` 와 `messageId` 를 미기재.
- **제안**: 코드 유지 + spec 반영.
  - `spec/4-nodes/7-trigger/providers/telegram.md §5.2` item 3 의 "미구현" 설명 → 구현 완료로 갱신.
  - `spec/conventions/chat-channel-adapter.md §2.1` `button_callback` union arm 에 `messageId?: string` 필드 및 JSDoc 추가.
  - `spec/4-nodes/7-trigger/providers/telegram.md §4` 명령 매핑 표 `callback_query` 행 업데이트.
  - `plan/in-progress/spec-sync-telegram-gaps.md` §5.2(3) 체크박스 체크.

---

### [INFO] `renderCarouselFallback` — 카드 body 에 `chunked` 플래그 누락

- **위치**: `/codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts` (line ~1669)
- **상세**: `renderCarouselFallback` 내 카드 메시지는 `body: { kind: 'text', text: bodyText }` 로 생성되는데 `chunked` 프로퍼티를 포함하지 않는다. 반면 `renderText` 가 반환하는 메시지는 항상 `chunked` 를 설정한다. `ChannelMessage.body` 의 `text` body 타입이 `chunked?: boolean` (옵셔널) 이므로 런타임 오류는 없지만 컨벤션 일관성이 부족하다. spec 에서 명시적으로 요구하는 사항은 아니므로 INFO.
- **제안**: 해당 카드 메시지도 `renderText` 를 통하거나 `chunked: false` 를 명시하면 일관성이 향상된다.

---

### [INFO] `editMessageReplyMarkup` — `ok:false` 응답 시 무시 여부 명확화 부재

- **위치**: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` (line ~3006)
- **상세**: `ackInteraction` 의 `editMessageReplyMarkup` 호출은 `catch` 블록으로 예외를 삼키지만, API 가 `ok:false` (HTTP 200 이지만 Telegram 에러 응답) 를 반환하는 경우는 예외가 아닌 일반 반환이므로 catch 에 걸리지 않는다. `TelegramClient.call` 이 HTTP 5xx 는 재시도 후 `{ ok:false }` 를 반환하는 패턴이므로, `editMessageReplyMarkup` 의 경우 `ok:false` 반환도 무시하는 것이 best-effort 설계 의도와 일치한다. 하지만 의도가 코드에 명시되지 않았다. spec 의무가 아니므로 INFO.
- **제안**: `await this.client.editMessageReplyMarkup(...)` 결과를 변수에 받아 `if (!result.ok) this.logger.warn(...)` 을 추가하거나, 현재 무시 패턴이 의도임을 주석으로 명시.

---

### [INFO] `renderAiMessage` — `typing` 의 `conversationKey` 가 빈 문자열

- **위치**: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts` (line ~888)
- **상세**: `{ conversationKey: '', body: { kind: 'typing' } }` 로 typing 메시지를 생성한다. `conversationKey` 를 빈 문자열로 두는 것은 "dispatcher 가 보정" 주석과 일치하는 기존 패턴 (다른 메시지도 동일)이므로 문제없다. spec 에서 이 패턴을 명시적으로 금지하지 않는다. 단순 INFO.

---

### [INFO] `splitByLimit` — escape sequence 경계 처리의 엣지 케이스

- **위치**: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts` (line ~1365)
- **상세**: `if (text.charAt(cut - 1) === '\\') cut -= 1;` 로 backslash 직후 분리를 회피하나, `\\` 두 글자 backslash escape (literal backslash) 도 동일 로직으로 `cut` 을 이동시켜 실제로는 escape sequence 중간이 아닌 위치임에도 커서를 뒤로 이동하는 경우가 발생할 수 있다. 실제 MarkdownV2 에서 `\\` 를 literal backslash 로 사용하는 사례는 드물고 spec 에서도 이 수준의 세부 분할 로직을 명세하지 않으므로 INFO.

---

## 요구사항 충족 평가

이번 PR 은 `plan/in-progress/spec-sync-telegram-gaps.md` 의 두 미구현 항목(§5.1 typing indicator 선행 발송, §5.2(3) editMessageReplyMarkup 으로 키보드 제거)을 완전히 구현한다. 코드 변경은 의도한 기능 요구사항을 충족하며, 기능 완전성·엣지 케이스(빈 응답 시 typing 생략, messageId 부재 시 editMessageReplyMarkup 미호출, editMessageReplyMarkup 실패 best-effort 삼킴)·에러 시나리오(catch 블록, best-effort) 처리가 적절하다. 발견된 SPEC-DRIFT 2건은 코드 버그가 아니라 spec 이 구현을 따라오지 못한 상태이며 spec 갱신이 필요하다. CRITICAL 또는 코드 수정이 필요한 WARNING 은 없다.

## 위험도

LOW
