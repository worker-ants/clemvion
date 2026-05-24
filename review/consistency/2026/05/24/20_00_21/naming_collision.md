# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/15-chat-channel.md` 관련 구현 변경 (origin/main...HEAD)
검토 일시: 2026-05-24
검토 모드: --impl-done

---

## 발견사항

### [INFO] `CHAT_CHANNEL_PROVIDERS` 값 확장 — 충돌 없음, 기존 소비자 확인 필요

- target 신규 식별자: `CHAT_CHANNEL_PROVIDERS = ['telegram', 'slack', 'discord'] as const`
- 기존 사용처: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` 동일 파일 — origin/main 에서는 `['telegram'] as const` 단일 값
- 상세: 식별자 이름 자체는 충돌하지 않는다. 값이 확장됨에 따라 `@IsIn(CHAT_CHANNEL_PROVIDERS)` 로 파생되는 DTO 유효성 검사 범위가 넓어지고, `assertInboundSigningPlaintextByProvider` 의 분기 의무 주석이 정확히 이 점을 경고하고 있다. 구현 내부에서 미처리 provider 가 생길 위험이 문서화되어 있으므로 충돌이 아닌 INFO 수준.
- 제안: 현재 구현 그대로 유지. 향후 4번째 provider 추가 시 `assertInboundSigningPlaintextByProvider` 주석 의무를 plan에 명시할 것.

---

### [INFO] `inboundSigningPlaintext` — spec 에 이미 정의, 구현이 spec 과 일치

- target 신규 식별자: `ChatChannelConfigDto.inboundSigningPlaintext?: string` (DTO 필드)
- 기존 사용처:
  - `spec/conventions/secret-store.md` line 252 — origin/main 시점부터 `§5.5` 에서 이미 동일 이름으로 정의됨
  - `spec/2-navigation/2-trigger-list.md` line 100, 138, 285 — 동일 이름 사용
- 상세: spec 이 먼저 정의한 식별자를 구현이 그대로 채택했다. 의미 차이 없음, 충돌 없음.
- 제안: 없음.

---

### [INFO] `stripChatChannelPlaintext` — 신규 private 메서드, 기존 사용처 없음

- target 신규 식별자: `TriggersService.stripChatChannelPlaintext(chatChannel): ChatChannelConfigDto` (private)
- 기존 사용처: origin/main 의 `triggers.service.ts` 에 해당 메서드 없음. spec 에도 언급 없음.
- 상세: 순수 내부 구현 헬퍼. 외부 API·spec 식별자 공간과 겹치지 않음. 충돌 없음.
- 제안: 없음.

---

### [INFO] i18n 신규 8개 키 — 기존 사전 키와 충돌 없음

- target 신규 식별자 (ko/en 공통):
  - `triggers.chatChannel.inboundSigningLabelSlack`
  - `triggers.chatChannel.inboundSigningLabelDiscord`
  - `triggers.chatChannel.inboundSigningPlaceholderSlack`
  - `triggers.chatChannel.inboundSigningPlaceholderDiscord`
  - `triggers.chatChannel.inboundSigningFormatHelpSlack`
  - `triggers.chatChannel.inboundSigningFormatHelpDiscord`
  - `triggers.chatChannel.inboundSigningRequiredErrorSlack`
  - `triggers.chatChannel.inboundSigningRequiredErrorDiscord`
- 기존 사용처: origin/main `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` 및 `en/triggers.ts` 에 위 8개 키 없음. `inboundSigning` prefix 를 쓰는 기존 키 자체가 없었음.
- 상세: 충돌 없음. 키 네이밍 패턴도 기존 `botToken*`, `health*`, `rotateBot*` 등의 suffix 분리 패턴과 일관됨.
- 제안: 없음.

---

### [INFO] `addChatChannelToggle` / `addChatChannelHelp` — 키 이름 동일, 값만 변경 (value update)

- target 신규 식별자: 동일 키 이름 — 기존 키를 값 갱신
- 기존 사용처: origin/main 의 ko/en dict 모두 해당 키 존재 (Telegram 전용 문구)
- 상세: 식별자(키 이름) 충돌이 아니라 값 교체. 신규 providers 추가로 문구를 업데이트한 것. 의미 연속성 있음, 혼선 없음.
- 제안: 없음.

---

### [INFO] frontend state 변수 2종 — 컴포넌트 로컬 스코프, 충돌 없음

- target 신규 식별자:
  - `formChatChannelProvider` (`useState<"telegram" | "slack" | "discord">`)
  - `formChatChannelInboundSigningPlaintext` (`useState<string>`)
- 기존 사용처: `codebase/frontend/src/app/(main)/triggers/page.tsx` — origin/main 에 두 변수 모두 없음. 기존 `formChatChannelBotToken`, `formChatChannelEnabled` 등의 동일 prefix 네이밍 패턴과 일치.
- 상세: 파일 로컬 React state. 네이밍 충돌 없음.
- 제안: 없음.

---

### [INFO] `providerTelegram` / `providerSlack` / `providerDiscord` / `botTokenRegistered` / `botTokenMissing` — origin/main 에 이미 존재

- target 신규 식별자: 위 5개 i18n 키가 새로 추가된 것으로 보이나, 실제로는 origin/main 이미 포함
- 기존 사용처: origin/main ko/en dict 에 동일 키·동일 값으로 이미 존재 (`ko/triggers.ts` line 186–191, `en/triggers.ts` line 195–200)
- 상세: 이전 PR(#300 chat-channel slack+discord providers)에서 이미 추가된 키들. 본 PR 이 건드리지 않은 기존 항목. 중복 추가 없음, 충돌 없음.
- 제안: 없음.

---

## 요약

이번 변경이 도입한 신규 식별자(`CHAT_CHANNEL_PROVIDERS` 확장, `inboundSigningPlaintext` DTO 필드, `stripChatChannelPlaintext` private 메서드, i18n 8개 신규 키, frontend state 2종)는 기존 사용처와 의미 충돌을 일으키지 않는다. `inboundSigningPlaintext` 는 spec(secret-store.md §5.5, 2-trigger-list.md)이 먼저 정의한 식별자를 구현이 그대로 채택한 것이고, 나머지 식별자들은 완전히 신규이거나 기존 키의 값만 갱신한 것이다. 주의할 점은 `CHAT_CHANNEL_PROVIDERS` 에 4번째 값이 추가될 경우 `assertInboundSigningPlaintextByProvider` 의 분기 의무가 묵시적으로 위반될 수 있다는 점이나, 이는 코드 자체에 주석으로 문서화되어 있어 현 시점에서는 충돌이 아닌 INFO 수준이다.

---

## 위험도

NONE
