# Code Review 통합 보고서 — telegram-gaps (1·2·5)

## 전체 위험도
**LOW** — SPEC-DRIFT 2건과 테스트 커버리지 공백 1건(WARNING)이 있으나, Critical 등급 보안·기능 결함은 없음.

## Critical 발견사항
해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | §5.1 typing indicator 구현 완료되었으나 spec 은 "미구현 (Planned)" 으로 명기 | `telegram.md §5.1` (L101) | spec §5.1 갱신 + plan 체크박스 |
| 2 | SPEC-DRIFT | §5.2(3) editMessageReplyMarkup 구현 완료, spec 미반영 3곳: telegram.md §5.2 "미구현", chat-channel-adapter.md button_callback union 의 messageId 미기재, telegram.md §4 명령 매핑 표 | `telegram.md §5.2`(L116); `chat-channel-adapter.md §2.1` | spec 3곳 갱신 |
| 3 | TESTING | `adapter.sendMessage` 의 `typing` 분기 직접 테스트 부재 | `telegram.adapter.spec.ts` | typing body sendMessage → sendChatAction 호출·externalMsgId 검증 |
| 4 | DOCUMENTATION | `renderTelegramMessages` JSDoc 의 ai_message 매핑이 typing+text 미반영 | `telegram-message.renderer.ts` JSDoc | `ai_message → typing + text` 로 수정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 조치 |
|---|----------|----------|------|
| 1 | SECURITY | `buildInlineKeyboard` link 버튼 url scheme 미검증 (기존 코드) | 본 PR 범위 밖(별도) |
| 2 | SECURITY | chart/table code block backtick 미sanitize (기존 코드) | 본 PR 범위 밖 |
| 3 | SECURITY | messageId 정수 검증에 음수·0 통과 | FIX (numericId > 0) |
| 4 | MAINTAINABILITY | escapeMarkdownV2 정규식 adapter 중복 (기존) | 본 PR 범위 밖 |
| 5 | MAINTAINABILITY | messageId string→Number 재변환 | 주석으로 의도 명시 (string = provider-agnostic 외부 id) |
| 6 | MAINTAINABILITY | typing 메시지 conversationKey '' 주석 누락 | FIX (주석 추가) |
| 7 | MAINTAINABILITY | editMessageReplyMarkup reply_markup unknown[][] | INFO 수용 |
| 8 | MAINTAINABILITY | 테스트 update_id 1051 패턴 불일치 | 무시(고유성 목적) |
| 9 | TESTING | 빈 ai_message typing 생략 경로 테스트 부재 | FIX (테스트 추가) |
| 10 | TESTING | 비-숫자 messageId → editMessageReplyMarkup 미호출 테스트 부재 | FIX (테스트 추가) |
| 11 | TESTING | answerCallbackQuery ok=false 후속 동작 테스트 | INFO 수용 |
| 12 | API_CONTRACT | typing externalMsgId 리터럴 'typing' | 중기 개선 |
| 13 | REQUIREMENT | renderCarouselFallback chunked 미설정 (기존 carousel 코드) | 본 PR 범위 밖 |
| 14 | REQUIREMENT | editMessageReplyMarkup ok=false 무시 의도 미명시 | 주석/로그 (best-effort try/catch 로 커버됨) |
| 15 | SIDE_EFFECT | 타 TelegramClient 수동 mock 누락 가능 | 확인 완료(telegram.adapter.spec 외 없음) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 |
|----------|--------|------|
| security | LOW | URL scheme·backtick(기존 코드 INFO), messageId>0(INFO) — Critical 없음 |
| requirement | LOW | SPEC-DRIFT 2건(WARNING) |
| scope | NONE | 7개 파일 모두 §5.1·§5.2(3) 범위 내 |
| side_effect | LOW | 순수 확장(옵션 필드·메서드 추가), 하위호환 유지 |
| maintainability | LOW | escapeMarkdownV2 중복(기존)·messageId 변환 — 블로킹 없음 |
| testing | LOW | typing sendMessage 직접 테스트 누락(WARNING) |
| documentation | LOW | JSDoc 매핑 미갱신(WARNING) |
| api_contract | LOW | reply_markup 타입·externalMsgId 리터럴(INFO) |

## 라우터 결정
router 선별 실행 — 8명(security·requirement·scope·side_effect·maintainability·testing·documentation·api_contract). 제외 6명(performance·architecture·dependency·database·concurrency·user_guide_sync — 해당 없음).
