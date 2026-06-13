# RESOLUTION — telegram-gaps ai-review (2026-06-14/00_29_22)

RISK=LOW, Critical 0, Warning 4. 수동 조치 (코드 fix + 동반 spec doc-sync).

## WARNING 처리

| # | 상태 | 조치 |
|---|------|------|
| W1 (SPEC-DRIFT §5.1 typing) | ✅ FIXED | `spec/4-nodes/7-trigger/providers/telegram.md §5.1` 의 "미구현 (Planned)" 제거 → renderAiMessage typing prepend 구현 반영으로 갱신. plan 체크박스 [x]. |
| W2 (SPEC-DRIFT §5.2(3) editMessageReplyMarkup) | ✅ FIXED | telegram.md §5.2(3) 갱신(미구현→구현, best-effort 동작 기술), §4 명령 매핑 표 `callback_query` 행에 `messageId?` 동봉 명시, `spec/conventions/chat-channel-adapter.md` button_callback union 에 `messageId?: string` + 설명 추가. (§7 /help 행도 이미 구현 상태로 동반 갱신.) |
| W3 (TESTING typing sendMessage 직접 테스트) | ✅ FIXED | `telegram.adapter.spec.ts` 에 typing body → sendChatAction 호출·externalMsgId='typing'·sendMessage 미호출 검증 케이스 추가. |
| W4 (DOCUMENTATION JSDoc) | ✅ FIXED | `renderTelegramMessages` JSDoc `ai_message → text` → `ai_message → typing + text (chunked if >4096, §5.1)`. |

## INFO 처리

| # | 상태 | 조치 |
|---|------|------|
| 3 (messageId 음수/0 통과) | ✅ FIXED | adapter `Number.isInteger(numericId) && numericId > 0` 으로 강화 + 주석. |
| 5 (messageId string/number) | ✅ 주석 | string 유지(provider-agnostic 외부 id 컨벤션) — 타입 JSDoc 에 의도 명시됨. |
| 6 (typing conversationKey 주석) | ✅ FIXED | renderAiMessage typing 생성부에 "dispatcher 가 보정" 주석 추가. |
| 9 (빈 ai_message typing 생략 테스트) | ✅ FIXED | renderer.spec 에 빈 본문 → 0건 케이스 추가. 구현도 raw message trim 가드로 강화(빈 text sendMessage 거부 잠재버그 동시 해소). |
| 10 (비-숫자 messageId 보호 테스트) | ✅ FIXED | adapter.spec 에 'abc'/'0'/'-5'/'NaN' → editMessageReplyMarkup 미호출 케이스 추가. |
| 1,2 (보안: URL scheme·backtick sanitize) | ⏭ 범위 밖 | `buildInlineKeyboard`/`renderChartFallback` 등 **기존 코드**의 hardening — 본 PR(typing/editMessageReplyMarkup) 범위 밖. 별도 보안 hardening 항목으로 분리 권장. |
| 4 (escapeMarkdownV2 중복) | ⏭ 범위 밖 | 기존 중복, 본 변경 무관. |
| 7,8,11,12,13,14,15 | 수용 | 타입 구체화·테스트 번호·externalMsgId 리터럴·carousel chunked(기존)·ok=false 로깅(best-effort try/catch 로 커버)·타 mock(확인 결과 telegram.adapter.spec 외 수동 mock 없음) — 블로킹 아님. |

## 검증

- telegram provider 단위 테스트 **94건 통과** (typing/editMessageReplyMarkup/messageId edge cases 포함).
- chat-channel + hooks 529건 통과(직전 검증). backend build·lint 통과.

## 결론
Critical 0. Warning 4 전부 해소(W1/W2 spec doc-sync 동반, W3/W4 코드). 가치 INFO 5건 반영. 보안 INFO 2건은 기존 코드 hardening 으로 별도.
