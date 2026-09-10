---
title: chatChannel PATCH 가 비밀을 쓰지 못하게 한다 — 두 CRITICAL 구현 (D-1·D-2·D-3)
status: in-progress
owner: developer
worktree: .claude/worktrees/impl-chat-channel-patch-token-a17c4e
spec_impact:
  - none
created: 2026-09-10
---

## 무엇을 닫는가

`spec-draft-nullable-notation-followups.md` 의 두 CRITICAL:

1. **chatChannel PATCH 가 R-CC-10 single-path 를 우회한다** — `botToken` 이 PATCH·POST 공용
   DTO 에서 필수라, `chatChannel` 이 실린 PATCH 가 24h grace 백업 · 전용 audit action ·
   `chatChannelRotatedAt` 갱신을 건너뛴 채 secret store 를 덮어쓴다.
2. **`ChatChannelCard` 편집-저장이 항상 400 이다** — 그 카드는 `botToken` 을 안 싣는데
   서버가 필수로 요구한다. 두 항목은 **한 수정으로 닫힌다.**

SoT: [`spec/5-system/15-chat-channel.md` §5.4.1 · §5.4.1.1 · R-CC-21](../../spec/5-system/15-chat-channel.md)
(planner PR #1311, `df1962e25`).

## 착수 전 실측 — 처방의 함정을 먼저 확인했다

| # | 확인 | 결과 |
|---|---|---|
| 1 | `setupChatChannel` 의 bot-token rotate 가 무조건인가 | **그렇다** — `triggers.service.ts:948-952`, 분기 없음 |
| 2 | `SecretResolver.rotate` 에 빈 값 가드가 있는가 | **없다** — `secret-store/secret-resolver.service.ts:129-145` |
| 3 | adapter 가 plaintext 를 필요로 하는가 | **아니다** — `telegram.adapter.ts` 의 `resolveBotToken` 이 `config.botTokenRef` 로 secret store 에서 푼다. **D-1 과 setupChannel 재호출이 양립한다** |
| 4 | 검증 함수가 create/update 공유인가 | **그렇다** — `assertInboundSigningPlaintextByProvider` 를 `create():401` · `update():482` 가 `assertChatChannelInputSafe` 경유로 공유 |
| 5 | 프런트가 무엇을 보내는가 | `{provider, uiMapping, rateLimitPerMinute, languageLocale, languageHints?}` — 두 비밀 필드 모두 미포함 (`chat-channel-card.tsx:346-360`) |

## 설계

- **D-1** — `ChatChannelPatchConfigDto` 신설. `botToken`·`inboundSigningPlaintext` 에
  `@IsEmpty()`. 나머지 필드는 생성용 DTO 와 동일. `UpdateTriggerDto.chatChannel` 만 이 타입으로
  바꾼다 (`CreateTriggerDto` 는 손대지 않는다 — 생성에서는 두 값이 여전히 필수다).
- **D-2** — `setupChatChannel` 에 비밀 쓰기 여부를 **인자로** 받는다. PATCH 경로는 bot token
  rotate 와 provider-issued signing 저장을 **둘 다 건너뛴다.**
- **D-3** — `botTokenRef`/`inboundSigningRef` 는 config 보존이 아니라 `buildSecretRef(trigger.id)`
  재유도로 살아남는다. 이미 그렇게 구현돼 있으므로 **회귀 테스트로 고정**한다.
- **검증 경로 분리** — D-1 을 공유 함수에 넣으면 slack/discord **생성**이 깨진다. PATCH 전용
  분기를 갈라 거기에만 적용한다.

## 발견한 경계 — R-CC-21 산문이 구현보다 넓다 (planner 위임)

Telegram adapter 는 **매 `setupChannel` 마다 새 `issuedInboundSigning` 을 발급해 Telegram 의
`secret_token` 으로 등록**한다(`telegram.adapter.ts:73`, 주석이 *"재사용하지 않는다"* 라고 명시).
그래서 PATCH 에서 그 값을 **저장하지 않으면 인입 웹훅 서명 검증이 전부 깨진다** — Telegram 은
새 토큰을 보내는데 우리는 옛 값과 대조한다.

- **정본 표 둘은 그대로 만족된다**: §5.4.1 은 *bot token* 을, §5.4.1.1 은 제목이
  *"slack / discord 한정"* 이라 telegram 의 server-issued 축을 스코프 밖에 둔다.
- **넓은 것은 R-CC-21 의 산문 한 문장**: *"PATCH 는 어떤 비밀도 받지 않고, 어떤 비밀도 쓰지
  않는다."* 문맥상 주어는 바로 앞 문장의 *"두 필드"*(`botToken`·`inboundSigningPlaintext`)지만,
  다음 사람은 문자 그대로 읽는다.
- **이 턴에서 고치지 않는다** — 그 문장은 planner PR #1311 에서 planner 역할로 썼다(spec-only
  diff · `--spec` 게이트 · planner plan owner). 자기-반증형 소정정의 조건 1 이 성립하지 않으므로
  **planner 턴으로 분리**한다. 후속에 등재한다.

## 체크리스트

- [ ] `/consistency-check --impl-prep spec/5-system`
- [ ] 재현 — 세 provider 각각 현재 400 임을 e2e 로 고정
- [ ] 테스트 선작성 (D-1 · D-2 · D-3)
- [ ] 구현
- [ ] 캐너리 e2e case E 바디 갱신 + R-CC-10 우회 경고 블록 정리
- [ ] `details.field` 실제 페이로드 캡처 (planner 후속 항목에 실측 인계)
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] 타입체크 ratchet 2종 (backend · frontend)
- [ ] `/ai-review` + Critical/Warning 0
- [ ] `/consistency-check --impl-done spec/5-system`
- [ ] R-CC-21 산문 폭 정정을 planner 후속으로 등재
