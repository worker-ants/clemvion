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
| (b) `:987-993` 유지 (올바른 구현) | 구현은 맞지만 **spec 네 자리가 거짓으로 남는다** |

구현을 옳게 해도 spec 이 틀린 채 남으므로 developer 턴만으로는 닫히지 않는다.

## 이미 그어져 있던 경계 — 이 carve-out 은 신설이 아니라 명시다

- `15-chat-channel.md §5.4.1.1` 은 **제목 자체가** *"slack / discord 한정"* 이다 — telegram 축은
  처음부터 그 절의 스코프 밖이었다.
- `2-trigger-list.md` `### R-12` 는 *"telegram 은 server-issued 라 본 필드 미사용"* 이라 적어
  PATCH 차단이 slack/discord `inboundSigning` 에만 걸린다고 이미 말한다.
- `15-chat-channel.md §4.1` 데이터 모델도 telegram 을 *"server-issued shared secret"* 으로 분리한다.

넓어진 것은 **어제 내가 쓴 네 자리뿐**이다. 나머지 문서는 경계를 정확히 유지하고 있었다.

## 결정

- **D-A** — PATCH 가 쓰지 않는 비밀은 **두 축 한정**이다: (1) `botToken`(rotate 대상),
  (2) `inboundSigningPlaintext`(slack/discord 사용자 입력). telegram 의 server-issued
  `issuedInboundSigning` 은 `setupChannel()` 재호출의 부수효과로 **계속 갱신·저장된다.**
- **D-B** — carve-out 의 판별 기준은 *"사용자가 PATCH body 로 보낸 비밀인가"* 다. R-CC-21 이
  막으려는 것은 **body 로 비밀이 유입되어 rotate 경로를 우회하는 것**이고, telegram 의 값은
  body 에서 오지 않고 adapter 가 provider 와 합의해 발급한다 — 자원 성격이 다르다.
- **D-C** — 이 결정은 R-CC-21 을 **번복하지 않는다.** 두 정본 표가 이미 가진 스코프를 산문과
  미러 문서에 맞춰 **좁히는** 것이다.

### 기각한 대안

| 대안 | 기각 사유 |
|---|---|
| **telegram 도 `rotate-inbound-signing` 전용 API 로 분리** | 회전 주체가 **우리가 아니라 Telegram 등록 행위**다. `setWebhook` 을 부르는 순간 새 `secret_token` 이 등록되므로, 별도 엔드포인트를 만들어도 `setupChannel` 재호출 경로가 그대로 남는다. **원인이 아니라 증상에 API 를 붙이는 것** |
| **adapter 가 기존 서명을 재사용하도록 바꿔 "값 불변" 을 참으로 만든다** | 가능은 하나 **§5.4.1.1 이 유예한 v2 결정을 telegram 축에서 미리 집행**하는 것이고, `telegram.adapter.ts:73` 주석·`providers/telegram.md:219`·`conventions/chat-channel-adapter.md §2.3` 세 곳의 정본 서술을 동시에 뒤집는다. 이 턴의 범위(거짓 문장 정정)를 넘는다 |
| **`chatChannel` 이 실린 PATCH 에서 `setupChannel` 을 아예 안 부른다** | §5.4.1 표가 *"`setupChannel()` 재호출로 provider 등록만 갱신"* 을 명시하고 `CCH-AD-02` 멱등성이 그 전제다. **endpointPath 변경 PATCH 의 webhook 재등록 경로를 끊는다** |

## 변경안

| # | 파일 | 변경 |
|---|---|---|
| **A** | `15-chat-channel.md` §5.4.1.1 | **carve-out 의 정본 자리.** 제목 *"(slack / discord 한정 — v1 차단)"* 이 스코프를 이미 긋고 있으나 telegram 축이 **어떻게 되는지는 안 적혀 있다** → telegram 행을 추가해 *"`setupChannel()` 재호출마다 재발급·재저장된다"* 를 명시 |
| **B** | `15-chat-channel.md` `### R-CC-21` | *"어떤 비밀도 받지 않고, 어떤 비밀도 쓰지 않는다"* 를 **두 축 한정**으로 좁히고, **「telegram 은 왜 예외인가」 소절 + 「기각한 대안」** 신설 |
| **C** | `data-flow/14-chat-channel.md` §1.3 | *"`secret_store` 무변경"* 이 **provider 무관 무조건**이라 거짓 — telegram 을 가른다 |
| **D** | `15-chat-channel.md` §3.1 `CCH-AD-02` | 호출 조건이 *"enable / 신규 생성"* 으로만 적혀 세 번째 갈래(`chatChannel` 실린 일반 PATCH)를 안 덮는다 → forward-link |
| **E** | `15-chat-channel.md` §5.4.1 표 2행 (활성화 PATCH) | 미해소 불확실성인데 캐비아트가 없다 — 자매 행과 같은 형식으로 부여 |
| **F** | `2-navigation/2-trigger-list.md:176` | **1R CRITICAL.** 같은 blanket 문장(*"bot token·inbound signing 값은 요청 전후로 동일하고"*)이 여기에도 있다. 차단 서술은 그대로 두고 **"값 불변" 서술만** 좁힌다 |
| **G** | `plan/in-progress/spec-draft-nullable-notation-followups.md` | **1R WARNING.** 그 트래커의 D-2 처방 요약문이 developer 가 실제로 집어 들 지시문이다 — **체크박스가 아니라 본문을 직접** 고쳐 telegram 축을 박아 넣는다 |

> **A 의 자리를 옮겼다 (1R WARNING).** 초안은 §5.4.1(bot-token 표)에 carve-out 을 끼우려 했다.
> `cross_spec` 이 지적하기를, §5.4.1 의 *"bot token 이 바뀌지 않는다"* 는 **telegram 포함 세 provider
> 모두에 여전히 참**이고 — telegram 에서 바뀌는 것은 inboundSigning 뿐이다 — 그 자원의 정본은
> §5.4.1.1 이다. bot-token 표에 signing 서술을 끼우면 **단일 진실이 두 곳으로 쪼개진다.**

## 1R 에서 잡힌 것 — 내가 같은 병을 세 번째로 앓았다

`review/consistency/2026/09/10/21_53_42` — **BLOCK: YES / Critical 2 · Warning 2 · INFO 7**
(`cross_spec` HIGH · `rationale_continuity` CRITICAL · `plan_coherence` MEDIUM ·
`convention_compliance` NONE · `naming_collision` NONE).

**두 checker 가 독립적으로 같은 것을 지목했다: 나는 미러 네 자리 중 세 곳만 셌다.**
어제 커밋(`df1962e25`)이 *"변경 (A~H)"* 로 **세 파일을 한 단위로** 이식했는데 —
`15-chat-channel.md`(A/B/C/E/F/H) · `2-trigger-list.md`(**D**) · `data-flow`(**G**) —
오늘 나는 그중 `2-trigger-list.md` 를 빼고 변경안을 짰다. `spec_impact` 도 두 파일뿐이었다.

이 세션 체인에서 **세 번째 재발**이다: (1) impl-prep 착수 전 실측에서 *"넓은 것은 산문뿐"* 이라
결론(실제로는 data-flow 표 행도) → (2) 이 draft 1R 에서 미러 3/4 → 둘 다 **내가 편집한 문서를
내가 검토할 때** 한 칸 좁아졌다. 대응은 키워드 확장이 아니라 **전수 열거**다 —
어제 커밋의 파일 목록을 SoT 로 삼아 대조했다.

## 이 턴에 하지 않는 것

- **`ChatChannelPatchConfigDto` 명명** — 저장소에 `Patch` 접두 클래스가 **0건**(`Create`/`Update`
  축)이다. **구현 턴에서 `ChatChannelUpdateConfigDto` 로 간다.** spec 사안이 아니다
  (`naming_collision` INFO 도 "spec/conventions 규약 대상 아님" 으로 확인).
- **`details.field` 실측 캡처** — 기존 등재 항목. 범위를 **5필드 전체**로 넓혀 트래커에 반영한다
  (신규 2 + 기존 `botTokenRef`·`inboundSigningRef`·`inboundSigning`).

## 체크리스트

- [ ] `/consistency-check --spec` 1R `21_53_42` — **BLOCK: YES**(미러 3/4). 전면 개정
- [ ] `/consistency-check --spec` 2R — BLOCK: NO
- [ ] 변경안 A~G 적용
- [ ] docs 가드
- [ ] `plan/complete/` 이동
