# 신규 식별자 충돌 검토 — trigger-create-multi-provider-ui

검토 모드: --impl-prep  
검토 대상: spec/5-system/15-chat-channel.md (+ plan/in-progress/trigger-create-multi-provider-ui.md 의 신규 식별자 목록)  
검토일: 2026-05-24

---

## 발견사항

### [INFO] `CHAT_CHANNEL_PROVIDERS` 확장 — 동일 식별자, 의미 확장 (무충돌)

- target 신규 식별자: `CHAT_CHANNEL_PROVIDERS = ['telegram', 'slack', 'discord'] as const`
- 기존 사용처: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:27` — `['telegram'] as const` 로 이미 선언·내보내기 중. `@IsIn`, `@ApiProperty enum`, `ChatChannelProvider` 타입 세 곳이 참조.
- 상세: 기존 식별자 자체는 동일하고 값만 확장된다. 의미 충돌 없음. 단, `ChatChannelProvider` 타입이 `'telegram' | 'slack' | 'discord'` 로 넓어지면 이 타입을 사용하는 모든 switch/if 분기가 컴파일·런타임에 slack/discord 케이스를 명시적으로 처리하거나 예외를 던져야 한다. 현 DTO 의 `@IsEmpty` 기반 `inboundSigning` / `inboundSigningRef` 가드는 telegram 전제로 설계되어 있어 (line 134-155: `@IsEmpty` — 외부 입력 금지) Commit 1 에서 provider 조건부 분기로 교체 필요. 이 교체 자체는 식별자 충돌이 아니라 동반 코드 변경이므로 INFO 수준.
- 제안: 변경 없음. plan Commit 1 의 `inboundSigning` 가드 교체 작업이 이 INFO 를 해소한다.

---

### [INFO] i18n 키 신설 4종 — 기존 chatChannel 네임스페이스 내, 중복 없음

- target 신규 식별자:
  - `triggers.chatChannel.inboundSigningLabel`
  - `triggers.chatChannel.inboundSigningPlaceholder`
  - `triggers.chatChannel.inboundSigningFormatHelp`
  - `triggers.chatChannel.inboundSigningRequiredError`
- 기존 사용처: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` 및 `en/triggers.ts` 의 `chatChannel` 객체. 현재 `inboundSigning*` 계열 키는 존재하지 않음 (grep 결과 0건). `botToken*` 계열은 이미 `botTokenInputLabel` / `botTokenInputPlaceholder` / `botTokenFormatHelp` 패턴으로 존재.
- 상세: 기존 `botToken*` 패턴과 네이밍 규칙이 동일하여 일관성 있음. 충돌 없음. 단, plan Commit 3 은 `inboundSigningLabel` 을 "provider별 분기 string" 으로 구성하려 하는데 (slack/discord 가 각각 다른 라벨), 단일 키 하나에 두 provider 의 다른 라벨을 담으려면 보간(interpolation) 또는 두 키로 분리하는 방식이 필요하다. 현재 i18n 구조에서 `inboundSigningLabel` 이 단일 평문 문자열이면 슬랙과 디스코드가 같은 라벨을 공유하게 된다. plan 본문 ("slack: 'Signing Secret' / discord: 'Application Public Key'") 과 런타임 렌더를 어떻게 분기할지는 구현 디테일이며 식별자 충돌은 아니다.
- 제안: 두 provider 의 라벨이 다르므로 `inboundSigningLabelSlack` / `inboundSigningLabelDiscord` 로 분리하거나, 혹은 `inboundSigningLabel` 을 interpolation `{{provider}}` 키로 두고 단일 키를 공유하는 방식 중 하나를 Commit 3 착수 전 결정할 것. 동일 고려가 `inboundSigningPlaceholder` 와 `inboundSigningFormatHelp` 에도 적용된다 (slack hex 32 / discord hex 64 가 내용이 다름). 식별자 충돌이 아니라 키 설계 명확화 사안.

---

### [INFO] frontend state 신설 2종 — 기존 state와 충돌 없음

- target 신규 식별자:
  - `formChatChannelProvider` (useState)
  - `formChatChannelInboundSigning` (useState)
- 기존 사용처: `codebase/frontend/src/app/(main)/triggers/page.tsx:111-112` — `formChatChannelEnabled` / `formChatChannelBotToken` 이미 존재.
- 상세: 기존 state 패턴 (`formChatChannel` prefix) 과 완전히 정합하며 중복 없음. `formChatChannelProvider` 는 기존 코드에서 provider 가 항상 "telegram" 하드코딩되어 있던 부분을 동적화한다 (page.tsx:204 의 `botToken: formChatChannelBotToken.trim()` 주변 payload 구성 로직). `formChatChannelInboundSigning` 은 현 코드에 전혀 없는 신규 state. 두 식별자 모두 기존 사용처와 의미 충돌 없음.
- 제안: 변경 없음.

---

### [INFO] backend 에러 코드 재사용 — 신규 코드 도입 없음 확인

- target 신규 식별자: (신규 없음) `BOT_TOKEN_INVALID` / `VALIDATION_ERROR` 재사용
- 기존 사용처:
  - `VALIDATION_ERROR`: `codebase/backend/src/modules/triggers/triggers.service.ts:169,212,220,227` 등 다수. auth, folders, edges 모듈에서도 사용.
  - `BOT_TOKEN_INVALID`: `spec/5-system/15-chat-channel.md:272` 에 에러 표로만 명시. 실제 backend src 에서는 미발견 (grep 결과 0건).
  - `CHAT_CHANNEL_NOT_CONFIGURED` / `CHAT_CHANNEL_PROVIDER_UNKNOWN` / `CHAT_CHANNEL_SETUP_FAILED`: 이미 backend src 에 구현됨.
- 상세: `BOT_TOKEN_INVALID` 는 spec 에 에러 코드로 정의되어 있으나 현 codebase backend src 에서 실제로 throw 하는 코드가 없다. plan 의 "기존 코드 재사용" 가정은 spec 레벨 참조이며 구현 레벨 에서는 신설이 필요할 수 있다. spec `discord.md:68` 도 `BOT_TOKEN_INVALID` 를 에러로 언급하나 backend throw 코드가 없으므로 Commit 1 구현 시 해당 에러를 throw 하는 코드를 작성해야 한다. 의미 충돌 없음 — 동일 에러 코드가 다른 의미로 사용되고 있지 않다.
- 제안: Commit 1 에서 `BOT_TOKEN_INVALID` throw 코드 신설 여부를 명시적으로 점검할 것.

---

### [INFO] `providerLabel` 명칭 — i18n 키와 JS 함수 잠재적 혼동

- target 신규 식별자: plan Commit 3 의 "`providerLabel` (드롭다운 라벨)" i18n 키 — `dict/{ko,en}/triggers.ts` 에 신설
- 기존 사용처: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx:1141` — `function providerLabel(p?: string): string` 라는 JS 함수가 이미 존재. 이 함수는 기존 `triggers.chatChannel.provider` 등 i18n 키를 내부적으로 호출.
- 상세: plan 의 신규 i18n 키 `providerLabel` 과 drawer 안의 로컬 함수 `providerLabel` 은 서로 다른 영역 (i18n 키 vs JS 함수 이름) 에 존재하여 실제 식별자 충돌은 아니다. 그러나 두 이름이 동일하여 코드 리뷰나 검색 시 혼동을 줄 수 있다.
- 제안: 신규 i18n 키를 `providerLabel` 로 신설하지 않고, plan 본문도 "기존 `provider` 재사용 가능" 이라고 이미 언급하고 있음. `dict/ko/triggers.ts:185` 에 `provider: "Provider"` 가 이미 존재하므로 신규 `providerLabel` 키 신설 없이 기존 `triggers.chatChannel.provider` 를 드롭다운 라벨로 재사용하면 식별자 증가 없이 해결됨. plan 본문의 "(또는 기존 `provider` 재사용)" 주석 방향을 채택 권고.

---

## 요약

target(`spec/5-system/15-chat-channel.md`) 이 도입하는 식별자와 plan(`trigger-create-multi-provider-ui.md`) 이 신설하려는 식별자 모두 기존 코드베이스·spec 과 의미 충돌이 없다. `CHAT_CHANNEL_PROVIDERS` 는 동일 이름으로 값만 확장되는 것이므로 충돌이 아니라 확장이다. i18n 키 4종과 frontend state 2종은 모두 신규 슬롯이며 기존 키/state 와 겹치지 않는다. 에러 코드는 기존 코드와 의미가 동일하게 재사용된다. 주의할 점은 세 가지다: (1) `inboundSigning*` i18n 키가 slack/discord 간 내용이 달라 단일 키 vs 분리 키 결정이 필요하고, (2) `BOT_TOKEN_INVALID` 는 spec 에만 존재하며 backend throw 코드 신설 필요 여부를 Commit 1 에서 명시적으로 다뤄야 하며, (3) `providerLabel` i18n 키 신설 시 drawer 내 동명 JS 함수와 이름이 겹쳐 혼동 여지가 있으므로 기존 `provider` 키 재사용이 권장된다. 전체적으로 Critical 또는 Warning 수준의 식별자 충돌은 발견되지 않았다.

## 위험도

LOW
