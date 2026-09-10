---
title: chatChannel PATCH 가 비밀을 쓰지 못하게 한다 — 두 CRITICAL 구현 (D-1·D-2·D-3)
status: in-progress
owner: developer
worktree: .claude/worktrees/impl-chat-channel-patch-token-a17c4e
spec_impact:
  - none
started: 2026-09-10
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

- **D-1** — `ChatChannelUpdateConfigDto` 신설 (**`Patch` 접두 아님** — 저장소에 `Patch` 접두
  클래스가 0건이고 관례가 `Create`/`Update` 축이다. `--spec` `22_04_23` `naming_collision`). `botToken`·`inboundSigningPlaintext` 에
  `@IsEmpty()`. 나머지 필드는 생성용 DTO 와 동일. `UpdateTriggerDto.chatChannel` 만 이 타입으로
  바꾼다 (`CreateTriggerDto` 는 손대지 않는다 — 생성에서는 두 값이 여전히 필수다).
- **D-2** — `setupChatChannel` 에 비밀 쓰기 여부를 **인자로** 받는다. PATCH 경로는 bot token
  rotate 와 provider-issued signing 저장을 **둘 다 건너뛴다.**

  > **⚠️ 게이팅 대상은 두 곳뿐이다 — 세 번째 쓰기 지점은 무조건 유지한다.**
  > `setupChatChannel` 안에 secret 쓰기가 **셋** 있다:
  >
  > | 자리 | 무엇 | PATCH 에서 |
  > |---|---|---|
  > | `:948-952` | bot token rotate (무조건) | **게이팅** |
  > | `:957-969` | slack/discord provider-issued signing | **게이팅** |
  > | `:981-993` | telegram server-issued `result.issuedInboundSigning` | **무조건 유지** |
  >
  > 단일 boolean 인자가 우발적으로 세 번째까지 덮으면 **그 트리거의 인입 웹훅이 전부 401** 이
  > 된다 — telegram adapter 가 `setupChannel` 마다 새 `secret_token` 을 Telegram 에 등록하므로
  > 저장을 건너뛰면 DB 는 옛 값이 된다. SoT: [Chat Channel §5.4.1.1](../../spec/5-system/15-chat-channel.md#5411-inboundsigning-patch-정책--회전-주체별-분기)
  > (planner PR #1313, `c0f2a885c`). **인자 이름을 `writeSecrets` 처럼 뭉뚱그리지 말고 무엇을
  > 게이팅하는지 드러나게 짓는다.**
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

## 이 턴에 실측해 planner 로 넘길 것

| 발견 | 실측 | 처분 |
|---|---|---|
| **spec 9곳이 `SecretResolver.store()` 라 적는데 chat-channel 경로는 `rotate()` 만 쓴다** (`--impl-prep` `22_45_26` `cross_spec` W) | `triggers.service.ts` 의 chat-channel 비밀 저장 호출 **전수**가 `secrets.rotate(...)` 다 — `secrets.store(` 는 **0건**. `store()` 는 `secret-resolver.service.ts:112` 에 존재하지만 이 경로가 안 부른다 | **planner 후속** — `15-chat-channel.md:200,201,373,390` 등 9자리 정정. `spec/` 은 developer 소관 아님 |
| **`details.field` 는 flat 이 아니라 중첩 경로다** | 5필드 전부 `chatChannel.<field>` 로 emit — `trigger-dto-validation.spec.ts` 의 `[실측]` 케이스가 정본 | **planner 후속** — §5.4.1·§5.4.1.1 의 placeholder 와 flat 표기(`details.field='botTokenRef'`)를 이 값으로 확정 |
| **`assertChatChannelInputSafe` 의 기존 3분기는 도달 불가에 가깝다** | 전역 파이프가 먼저 거부한다(위 실측이 그 증거 — HTTP 응답에 나가는 것은 파이프의 중첩 경로다). 다만 서비스 직접 호출 경로는 남아 있어 **삭제하지 않았다** | 트래커 기존 항목에 이 실측을 덧붙임 |

## 체크리스트

- [x] `/consistency-check --impl-prep spec/5-system` `22_45_26` — **BLOCK: NO** (Critical 0 / Warning 1)
- [x] 테스트 선작성 (D-1 · D-2 · D-3) — **RED 6/8 확인 후** 구현
- [x] 구현 — DTO(`ChatChannelUpdateConfigDto`) · 검증 경로 분리 · 쓰기 게이팅 ①② (③ 유지)
- [x] 기존 10 케이스를 **생성 경로로 재조준** — PATCH 로는 더 이상 비밀을 실을 수 없다
- [x] 캐너리 e2e case E 바디 갱신 + R-CC-10 우회 경고 블록 → 해소 기록으로 교체
- [x] `details.field` 5필드 실측 — **전부 중첩 경로** (위 표)
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] 타입체크 ratchet 2종 (backend · frontend)
- [ ] `/ai-review` + Critical/Warning 0
- [ ] `/consistency-check --impl-done spec/5-system`
- [x] R-CC-21 산문 폭 정정 — **planner PR #1313 으로 완료** (이 plan 이 발견 → 별 턴에서 처리)
