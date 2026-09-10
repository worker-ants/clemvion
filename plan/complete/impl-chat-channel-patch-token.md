---
title: chatChannel PATCH 가 비밀을 쓰지 못하게 한다 — 두 CRITICAL 구현 (D-1·D-2·D-3)
status: applied
owner: developer
worktree: .claude/worktrees/impl-chat-channel-patch-token-a17c4e
spec_impact: none
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
  > | `// [쓰기 ①]` | bot token rotate (무조건) | **게이팅** |
  > | `// [쓰기 ②]` | slack/discord provider-issued signing | **게이팅** |
  > | `// [쓰기 ③]` | telegram server-issued `result.issuedInboundSigning` | **무조건 유지** |
  >
  > (줄 번호 대신 **코드가 스스로 다는 앵커 주석**으로 인용한다 — 같은 PR 의 편집이 줄을
  > 밀어 작성 시점엔 옳고 커밋 시점엔 틀리는 것을 막는다.)
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
- [x] TEST WORKFLOW — lint PASS · unit PASS(backend 9,536 / frontend 6,379) · build PASS ·
      **e2e PASS 305** (`trigger-workflow-ref.e2e-spec.ts` PASS 확인 — 캐너리 case E 가 실제로 돌았다)
- [x] 타입체크 ratchet 2종 — backend 197건/36파일 · frontend 52건/15파일, 둘 다 baseline 일치
      (정본 `scripts/check-*-typecheck-ratchet.py` 를 재현 말고 그대로 실행)
- [x] `/ai-review` `review/code/2026/09/10/23_21_57` — **CRITICAL 1 / WARNING 6** →
      전부 조치. `RESOLUTION.md` 참조. 뮤테이션으로 캐너리 유효성 확인(보존 항 제거 → RED 3)
- [ ] 수렴 예외로 남긴 INFO 5건 (`update()` 길이 · 캐스팅 중복 · 메시지 중복 · fixture 중복 ·
      degraded 경계 테스트) — reviewer 자신이 *"이 PR 신규 아님/비긴급"* 분류, 전부 동작 결함
      아님. SKILL §수렴 예외 (a)(b)(c) 적용
- [x] `/consistency-check --impl-done spec/5-system` — 4회 전부 **BLOCK: NO**
      (`23_54_09` · `00_21_57` · `00_45_19` · `01_10_44`). 잔여 WARNING 은 전부 `spec/**` 라
      developer 권한 밖이고 중앙 트래커에 등재됨 — checker 도 *"신규 등재 불요"* 로 확인
- [x] R-CC-21 산문 폭 정정 — **planner PR #1313 으로 완료** (이 plan 이 발견 → 별 턴에서 처리)
- [x] `CHANGELOG.md` — 루트 CHANGELOG 갱신. 선례 실측(코드 커밋 `08fbf133d`·`bfa124920`·
      `f5d97aa39` 3건 다 갱신 / 내 spec-only PR `df1962e25`·`c0f2a885c` 는 안 함 — 일관됨)
- [x] `plan/complete/` 이동

## 리뷰 라운드 요약 — 발견의 성격이 단조 이동했다

| 라운드 | 세션 | Critical | 성격 |
|---|---|---|---|
| 1R | `review/code/2026/09/10/23_21_57` | **1** | **동작** — `inboundSigningRef` 소실로 인입 서명 fail-open |
| 2R | `review/code/2026/09/10/23_55_23` | 0 | **측정 범위 · 사용자 문서** |
| 3R | `review/code/2026/09/11/00_21_55` | 0 | **문서**(slack/discord 가이드) |
| 4R | `review/code/2026/09/11/00_45_18` (타겟 4명) | 0 | **주석 배치**(orphan JSDoc · JSDoc 유출) |
| 5R | `review/code/2026/09/11/01_10_43` (타겟 2명) | 0 | **CHANGELOG** |

수렴 판정은 개수가 아니라 이 성격 이동으로 했다. 각 라운드의 처분은 그 세션의 `RESOLUTION.md`.

> **타겟 라운드는 push 게이트를 닫지 못한다 (2026-09-11 실측).** 4R·5R 을 reviewer 4명·2명으로
> 좁혀 돌렸는데, `review_guard._summary_is_resolved()` 는 **forced 7명 커버리지**를 요구하므로
> 그 세션들은 "resolved" 로 집계되지 않는다 — 게이트에 직접 물으니
> *"15 codebase/ file(s) changed AFTER the most recent resolved review"* 였고, 그 기준 세션은
> 마지막 **전수** 라운드(`23_55_23`)였다. 타겟 라운드는 **정보로는 유용하고 실제로 결함도
> 잡았지만**(4R 이 orphan JSDoc·JSDoc 유출을, 5R 이 CHANGELOG 를 잡았다) 종결에는 쓸 수 없다.
> 그래서 코드를 고정한 뒤 **전수 라운드를 한 번 더** 돌려 닫았다.
>
> 교훈: 타겟 재실행은 *"이 축만 다시 보고 싶다"* 에 쓰고, **종결은 반드시 전수**로 한다.

## 이 턴에 다섯 번 같은 병을 앓았다 — 전부 "축은 대칭인데 한쪽만"

| # | 어디 | 무엇을 놓쳤나 |
|---|---|---|
| 1 | D-3 캐너리 | `botTokenRef` 만 걸고 **자매 `inboundSigningRef`** 를 안 봤다 → **CRITICAL** |
| 2 | 그 CRITICAL 의 첫 fix | 옛 ref 를 **이미 병합된** `saved` 에서 읽었다 (테스트 3건이 잡았다) |
| 3 | `details.field` 실측 | **비어있지 않은 값** 갈래만 재고 전체로 일반화해 트래커에 확정 인계 |
| 4 | 사용자 가이드 | telegram·triggers 만 고치고 **slack/discord** 를 빼먹었다 |
| 5 | 같은 실측 반영 | Swagger·가이드 4곳은 고치고 **같은 파일 JSDoc 하나**를 놓쳤다 |

부수로 **orphan JSDoc 이 네 번째**(메모리에 세 번 기록된 클래스), 개수 오기 1건(`9곳`↔`7곳`).
