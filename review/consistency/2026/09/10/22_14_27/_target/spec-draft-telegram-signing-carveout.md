---
title: telegram server-issued 서명은 PATCH 비밀-쓰기 금지의 스코프 밖이다 — carve-out 명시
status: in-progress
owner: project-planner
worktree: .claude/worktrees/spec-telegram-signing-carveout-6b21ff
spec_impact:
  - spec/5-system/15-chat-channel.md
  - spec/2-navigation/2-trigger-list.md
  - spec/data-flow/14-chat-channel.md
created: 2026-09-10
---

## 왜 이 턴이 생겼나

어제 PR #1311(`df1962e25`)이 *"`chatChannel` 이 실린 PATCH 는 비밀을 쓰지 않는다"* 를 결정했다.
오늘 그 결정을 구현하려고 developer 턴을 열었고, 착수 게이트
(`/consistency-check --impl-prep spec/5-system`,
`review/consistency/2026/09/10/21_37_56`)가 **BLOCK: YES / Critical 1** 을 냈다.

**그 결정문이 telegram 에서 거짓이고, 문면대로 구현하면 챗봇이 죽는다.**

## 실측 — 세 층에서 같은 사실이 나온다

| 층 | 위치 | 내용 |
|---|---|---|
| adapter 코드 | `chat-channel/providers/telegram/telegram.adapter.ts:73` | `setupChannel` 마다 `randomBytes(24)` 로 **새** `issuedInboundSigning` 발급 → Telegram `setWebhook` 의 `secret_token` 으로 등록. 주석: *"매 setupChannel 마다 새 inbound-signing 자료 발급 — 재사용하지 않는다"* |
| 호출부 코드 | `triggers.service.ts:987-993` | `result.issuedInboundSigning` 이 있으면 **무조건** `secrets.rotate(inboundSigningRef, …)`. provider-issued 축(`:957-969`)과 **주석으로 명시 구분된 별도 블록** |
| spec 본문 | `spec/4-nodes/7-trigger/providers/telegram.md:219` | *"`secret_token` 파라미터를 등록 시점에 랜덤 발급 … caller 가 `SecretResolver.store(…)` 보관 후 ref 만 set … HooksController 가 `resolve(inboundSigningRef)` 후 헤더 동일성 검증. 실패 시 `401`"* |

즉 **저장을 건너뛰면 DB 는 옛 값, Telegram 은 새 값으로 서명**한다 →
`X-Telegram-Bot-Api-Secret-Token` 불일치로 **그 트리거의 모든 인입이 401**.
`rateLimitPerMinute` 한 번 바꾼 PATCH 로 챗봇이 영구 응답 불능이 된다.

## 두 갈래 다 문제다 — 그래서 spec 을 고쳐야 한다

| 갈래 | 결과 |
|---|---|
| (a) 문면대로 `:987-993` 까지 skip | 위 401. **동작 파손** |
| (b) `:987-993` 유지 (올바른 구현) | 구현은 맞지만 **spec 다섯 자리가 거짓으로 남는다** |

구현을 옳게 해도 spec 이 틀린 채 남으므로 developer 턴만으로는 닫히지 않는다.

## 이미 그어져 있던 경계 — 이 carve-out 은 신설이 아니라 명시다

- `2-trigger-list.md` `### R-12` 는 *"telegram 은 server-issued 라 본 필드 미사용"* 이라 적어
  PATCH 차단이 slack/discord `inboundSigning` 에만 걸린다고 이미 말한다.
- `15-chat-channel.md §4.1` 데이터 모델도 telegram 을 *"server-issued shared secret"* 으로 분리한다.
- `conventions/secret-store.md §5.5` · `conventions/chat-channel-adapter.md §2.3/§2.4` 도 두 축을
  같은 어휘로 이미 가르고 있다 (`convention_compliance` INFO — *"draft 의 결정을 강하게 뒷받침"*).

넓어진 것은 **어제 내가 쓴 다섯 자리뿐**이다. 나머지 문서는 경계를 정확히 유지하고 있었다.

## 결정

- **D-A** — PATCH 가 쓰지 않는 비밀은 **두 축 한정**이다: (1) `botToken`(rotate 대상),
  (2) `inboundSigningPlaintext`(slack/discord 사용자 입력). telegram 의 server-issued
  `issuedInboundSigning` 은 `setupChannel()` 재호출의 부수효과로 **계속 갱신·저장된다.**
- **D-B** — **§5.4.1 이 세운 「값이 바뀌는가」 원칙을 버리는 것이 아니라 주어를 정확히 하는
  것이다.** 그 원칙은 *"사용자가 rotate 경로를 우회해 **자기 비밀을 갈아끼우는가**"* 를 묻는다.
  telegram 의 값은 PATCH body 에서 오지 않고 adapter 가 Telegram 과 **합의해 발급**하며, 그
  갱신은 provider 등록과 **한 동작**이라 우회할 grace·audit·`rotatedAt` 계약 자체가 없다.
  §5.4.1 이 든 피해 셋 — (a) 외부 등록과 mismatch (b) 24h grace 일관성 (c) audit mixing —
  **어느 것도 telegram 축에서는 발생하지 않는다.** (a) 는 오히려 **반대**다: 저장을 건너뛰면
  그때 mismatch 가 난다.
- **D-C** — 이 결정은 R-CC-21 을 **번복하지 않는다.** 두 정본 표가 이미 가진 스코프를 산문과
  미러 문서에 맞춰 **좁히는** 것이다.

### 기존 「기각한 대안」에 덧붙일 것 (신설 아님 — R-CC-21 에 이미 그 소절이 있다)

| 대안 | 기각 사유 |
|---|---|
| **telegram 도 `rotate-inbound-signing` 전용 API 로 분리** | 회전 주체가 우리가 아니라 **Telegram 등록 행위**다. `setWebhook` 을 부르는 순간 새 `secret_token` 이 등록되므로 별도 엔드포인트를 만들어도 `setupChannel` 재호출 경로가 그대로 남는다 — **원인이 아니라 증상에 API 를 붙이는 것** |
| **adapter 가 기존 서명을 재사용하게 바꿔 "값 불변" 을 참으로 만든다** | 가능은 하나 `telegram.adapter.ts:73` 주석 · `providers/telegram.md:219` · `conventions/chat-channel-adapter.md §2.3` 세 정본을 동시에 뒤집는다. **거짓 문장 정정이라는 이 턴의 범위를 넘는다** |
| **`chatChannel` 이 실린 PATCH 에서 `setupChannel` 을 아예 안 부른다** | §5.4.1 표가 *"`setupChannel()` 재호출로 provider 등록만 갱신"* 을 명시하고 `CCH-AD-02` 멱등성이 그 전제다. **endpointPath 변경 PATCH 의 webhook 재등록 경로를 끊는다** |

## 변경안

| # | 파일·자리 | 변경 |
|---|---|---|
| **A** | `15-chat-channel.md` §5.4.1.1 — **제목 + `:392` 회전 행** | carve-out 의 **정본 자리**. ① 제목 *"(slack / discord 한정 — v1 차단)"* → 세 provider 를 다 덮도록 갱신(그래야 telegram 행을 넣어도 제목과 안 싸운다, `convention_compliance` W1) ② `:392` 의 *"`chatChannel` 이 실린 PATCH 는 저장된 signing 값을 바꾸지 않는다"* 를 **slack/discord 한정으로** 좁힘 ③ telegram 행 신설 — *"`setupChannel()` 재호출마다 재발급·재저장"* ④ **앵커가 바뀌므로 인용 2곳(`:380`·`:747`)을 동시 갱신** |
| **B** | `15-chat-channel.md` `### R-CC-21` (`:734` 제목 · `:761` 본문) | 제목은 **그대로 둔다**(앵커를 네 곳이 인용). 본문 상단에 **두 축 한정 caveat 를 눈에 띄게** 배치하고, `:761` 의 *"경로가 비밀을 쓰지 않는다"* 를 좁힘. **기존 `#### 기각한 대안` 소절에 위 3건을 덧붙인다**(신설 아님, `convention_compliance` W2) |
| **C** | `data-flow/14-chat-channel.md:151` | *"`secret_store` 무변경"* 이 **provider 무관 무조건**이라 거짓 — telegram 을 가른다 |
| **D** | `15-chat-channel.md:54` `CCH-AD-02` | 호출 조건이 *"enable / 신규 생성"* 뿐이라 세 번째 갈래(`chatChannel` 실린 일반 PATCH)를 안 덮는다 → forward-link |
| **E** | `15-chat-channel.md` §5.4.1 표 2행 (활성화 PATCH) | 미해소 불확실성인데 캐비아트가 없다 — 자매 행과 같은 형식으로 부여 |
| **F** | `2-navigation/2-trigger-list.md:176` | **1R CRITICAL.** 같은 blanket 문장이 여기에도 있다. 차단 서술은 두고 **"값 불변" 서술만** 좁힌다 |
| **G** | `plan/in-progress/spec-draft-nullable-notation-followups.md:1957-1978` | **1R WARNING.** D-1/D-2/D-3 요약 **바로 아래**에, 그 파일의 두 번째 CRITICAL 항목이 이미 쓰는 **인라인 정정 각주 형식 그대로** telegram 예외를 박는다. 체크박스만 닫지 않는다 |
| **H** | `15-chat-channel.md:614` `R-CC-10` 안의 전방 포인터 | **2R CRITICAL.** *"`chatChannel` 이 실린 PATCH 는 저장된 비밀을 **아예 쓰지 않는다**"* — 어제 커밋의 변경 **F** 자리다. 좁히지 않으면 몇 줄 아래 새 §5.4.1.1 telegram 행과 **같은 파일 안에서** 모순한다 |

## 재발 기록 — 같은 병을 네 번 앓았고, 세 번째에야 방법을 바꿨다

| 라운드 | 내가 센 것 | 실제 | 놓친 자리 |
|---|---|---|---|
| impl-prep `21_37_56` | *"넓은 건 R-CC-21 **산문**뿐"* | 정본 data-flow 표 행도 | `data-flow:151` |
| `--spec` 1R `21_53_42` | 미러 **3파일** | **4파일** | `2-trigger-list:176` |
| `--spec` 2R `22_04_23` | 미러 4파일 | **파일이 단위가 아니었다** | `15-chat-channel:614` (같은 파일 안 두 번째 자리) |

**세 번 다 내가 편집한 문서를 내가 검토할 때 좁아졌다.** 2R 지적이 정확하다 — 나는 1R 대응에서
어제 커밋의 `A/B/C/E/F/H` 여섯 글자를 **인용해 놓고도** 내 변경안과 1:1 대조하지 않았고, 대조
단위를 "파일" 로 잡아 파일 **내부**의 두 번째 blanket 자리를 못 봤다.

**그래서 3R 대응은 열거 단위를 바꾸는 대신 방법을 바꿨다** — 주장 문구 자체를 `spec/` 전체에서
전수 grep 했다(`아예 쓰지 않는다|비밀을 쓰지 않는다|비밀을 바꾸지 않는다|요청 전후 동일|
secret_store 무변경|…`). 그 결과가 위 변경안의 **다섯 자리**(`:176`·`:392`·`:614`·`:734/761`·
`:151`)이고, 나머지 히트는 전부 무관 문맥임을 주어와 함께 확인했다.

## 이 턴에 하지 않는 것

- **`ChatChannelPatchConfigDto` 명명** — 저장소에 `Patch` 접두 클래스가 **0건**(`Create`/`Update`
  축). **구현 턴에서 `ChatChannelUpdateConfigDto` 로 간다.** spec 사안이 아니다.
- **`details.field` 실측 캡처** — 기존 등재 항목. 범위를 **5필드 전체**로 넓혀 트래커에 반영한다
  (신규 2 + 기존 `botTokenRef`·`inboundSigningRef`·`inboundSigning`).
- **`swagger.md §1` 에 *"부분 갱신 DTO 는 `Update`, `Patch` 접두 금지"* 승격** (`naming_collision`
  INFO 제안) — 규약 신설은 별 결정 사안. 트래커에 등재만 한다.

## 체크리스트

- [ ] `--spec` 1R `21_53_42` — **BLOCK: YES** (미러 3/4). 개정
- [ ] `--spec` 2R `22_04_23` — **BLOCK: YES** (파일 내부 자리 누락). 전수 grep 으로 방법 전환
- [ ] `--spec` 3R — BLOCK: NO
- [ ] 변경안 A~H 적용
- [ ] docs 가드
- [ ] `plan/complete/` 이동
