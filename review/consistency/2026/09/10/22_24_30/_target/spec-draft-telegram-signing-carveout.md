---
title: telegram server-issued 서명은 PATCH 비밀-쓰기 금지의 스코프 밖이다 — carve-out 명시
status: in-progress
owner: project-planner
worktree: .claude/worktrees/spec-telegram-signing-carveout-6b21ff
started: 2026-09-10
spec_impact:
  - spec/5-system/15-chat-channel.md
  - spec/2-navigation/2-trigger-list.md
  - spec/data-flow/14-chat-channel.md
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

두 갈래 다 문제다: **(a)** 문면대로 `:987-993` 까지 skip 하면 위 401 — **동작 파손**.
**(b)** `:987-993` 을 유지하면(올바른 구현) **spec 문장들이 거짓으로 남는다.**
구현을 옳게 해도 spec 이 틀린 채 남으므로 developer 턴만으로는 닫히지 않는다.

## 이미 그어져 있던 경계 — 이 carve-out 은 신설이 아니라 명시다

- `2-trigger-list.md` `### R-12` 는 *"telegram 은 server-issued 라 본 필드 미사용"* 이라 적어
  PATCH 차단이 slack/discord `inboundSigning` 에만 걸린다고 이미 말한다.
- `15-chat-channel.md §4.1` 데이터 모델도 telegram 을 *"server-issued shared secret"* 으로 분리한다.
- `conventions/secret-store.md §5.5` · `conventions/chat-channel-adapter.md §2.3/§2.4` 도 두 축을
  같은 어휘로 이미 가른다 — 3R `convention_compliance` 가 **직접 열어 대조**하고
  *"이번 carve-out 이 컨벤션 문서를 고칠 필요가 없다는 판단이 실측과 맞는다"* 로 확인했다.

넓어진 것은 **어제 내가 쓴 자리들뿐**이다.

## 결정

- **D-A** — PATCH 가 쓰지 않는 비밀은 **두 축 한정**이다: (1) `botToken`(rotate 대상),
  (2) `inboundSigningPlaintext`(slack/discord 사용자 입력). telegram 의 server-issued
  `issuedInboundSigning` 은 `setupChannel()` 재호출의 부수효과로 **계속 갱신·저장된다.**
- **D-B** — **§5.4.1:380 의 「값이 바뀌는가」 원칙을 버리는 것이 아니라 주어를 정확히 하는
  것이다.** 그 원칙은 *"사용자가 rotate 경로를 우회해 **자기 비밀을 갈아끼우는가**"* 를 묻는다.
  §5.4.1 이 든 피해 셋 중 **어느 것도 telegram 축에서는 발생하지 않는다**:

  | §5.4.1 의 피해 | telegram server-issued 축 |
  |---|---|
  | (a) 외부 provider 등록과 mismatch | **정반대다.** `setWebhook` 이 새 값을 등록하므로 **저장을 건너뛸 때** mismatch 가 난다 |
  | (b) 24h grace 일관성 | grace 계약이 **없다** — 회전 주체가 우리가 아니라 Telegram 등록 행위다 |
  | (c) audit mixing | 전용 audit action 이 **없다** — 우회할 대상 자체가 없다 |

- **D-B'** — `:380` 이 말하는 **「직교 축」 반론도 성립하지 않는다.** 그 문장은 *"대조축(외부
  provider 등록 여부)과 이 축(필드명 vs 값)은 직교한다"* 고 적는데, 이 반론을 그대로 밀면
  telegram signing 도 *"PATCH 로 안 바뀌는 편"* 이어야 한다. **그런데 telegram signing 은
  「외부 provider 등록 여부」 축에서 botToken 과 같은 편이 아니다** — botToken 은 우리가 등록한
  값을 provider 가 **보관**하고, telegram signing 은 provider 가 **매 등록마다 교체를 요구**한다.
  직교 축이 하나 더 필요하다: **「회전 주체가 누구인가」.** 그 축에서 telegram 만 *"우리가 아님"*
  이다.
- **D-C** — 이 결정은 R-CC-21 을 **번복하지 않는다.** 두 정본 표가 이미 가진 스코프를 산문과
  미러 문서에 맞춰 **좁히는** 것이다.

### 기존 `#### 기각한 대안` 소절에 **행을 덧붙인다** (신설 아님 — 헤딩 중복 금지)

`15-chat-channel.md:767` 에 동명 소절이 이미 있다. 새 H4 를 만들면 GitHub 앵커가
`#기각한-대안-1` 로 분기한다(`convention_compliance` 2R W3). **기존 소절에 이어 붙인다.**

| 대안 | 기각 사유 |
|---|---|
| **telegram 도 `rotate-inbound-signing` 전용 API 로 분리** | 회전 주체가 우리가 아니라 **Telegram 등록 행위**다. `setWebhook` 을 부르는 순간 새 `secret_token` 이 등록되므로 별도 엔드포인트를 만들어도 `setupChannel` 재호출 경로가 그대로 남는다 — **원인이 아니라 증상에 API 를 붙이는 것** |
| **adapter 가 기존 서명을 재사용하게 바꿔 "값 불변" 을 참으로 만든다** | §5.4.1.1 의 **slack/discord 전용** v2 유예 패턴을 telegram 에 **유추 적용**하는 것이라 사전 집행이 된다(3R INFO 로 문구 보강). 게다가 `telegram.adapter.ts:73` 주석 · `providers/telegram.md:219` · `chat-channel-adapter.md §2.3` 세 정본을 동시에 뒤집는다 |
| **`chatChannel` 이 실린 PATCH 에서 `setupChannel` 을 아예 안 부른다** | §5.4.1 표가 *"`setupChannel()` 재호출로 provider 등록만 갱신"* 을 명시하고 `CCH-AD-02` 멱등성이 그 전제다. **endpointPath 변경 PATCH 의 webhook 재등록 경로를 끊는다** |

## 변경안 — **자리 단위**로 열거한다

> **그루핑을 버렸다.** 1R·2R·3R 이 각각 다른 자리를 잡았고, 세 번 다 원인은 내가 자리를
> **묶어서** 셌기 때문이다(`:734/761` 로 뭉뚱그린 탓에 같은 절의 `:750` 을 놓쳤다).
> 아래는 **한 줄 = 한 자리**다.

### `spec/5-system/15-chat-channel.md`

| # | 자리 | 현재 주어 | 조치 |
|---|---|---|---|
| **A1** | `:54` `CCH-AD-02` | 호출 조건이 *"Trigger enable / 신규 생성"* 뿐 | 세 번째 갈래(`chatChannel` 실린 일반 PATCH)를 포괄하도록 §5.4.1 forward-link |
| **A2** | `:372` §5.4.1 표 2행 (활성화 PATCH) | 미확정인데 캐비아트 없음 | **중립** forward-link 캐비아트 — 자매 트래커의 미해소 질문을 **선점하지 않는다**(3R INFO) |
| **A3** | `:376` §5.4.1 chatChannel PATCH 행 | **bot token** — 세 provider 모두 참 | 문장은 유지. signing 축은 §5.4.1.1 로 가라는 한 줄만 추가 |
| **A4** | `:380` 「값이 바뀌는가」 + 「직교 축」 문장 | bot token 축 | **§5.4.1.1 앵커를 인용 중** → A5 로 앵커가 바뀌므로 **동반 갱신**. D-B' 의 「회전 주체」 축도 한 줄 |
| **A5** | `:384` §5.4.1.1 **제목** | *"(slack / discord 한정 — v1 차단)"* | 세 provider 를 덮도록 갱신. **앵커 인용 2곳(`:380`·`:747`) 동반 갱신** |
| **A6** | `:389` §5.4.1.1 표 2행 (활성화 PATCH) | A2 의 동형 행 | A2 와 같은 캐비아트 |
| **A7** | `:392` §5.4.1.1 회전 행 | *"`chatChannel` 이 실린 PATCH 는 저장된 signing 값을 바꾸지 않는다(요청 전후 동일)"* — **blanket** | **slack/discord 한정으로 좁힘** |
| **A8** | §5.4.1.1 표에 **telegram 행 신설** | (없음) | *"`setupChannel()` 재호출마다 재발급·재저장 — v1/v2 결정 대상 아님"* |
| **A9** | `:614` `R-CC-10` 전방 포인터 | *"저장된 비밀을 **아예** 쓰지 않는다"* — **blanket** (2R CRITICAL) | *"**bot token 값**을 쓰지 않는다"* 로 좁히고 telegram 예외 포인터 |
| **A10** | `:734` `R-CC-21` **제목** | *"PATCH 는 비밀을 쓰지 않는다"* — blanket | **제목은 유지**(앵커를 여러 곳이 인용). 본문 **첫 문단에** 두 축 한정 caveat 를 눈에 띄게 |
| **A11** | `:750` 「우회의 형태」 결론 | *"어떤 비밀**도** 받지 않고, 어떤 비밀**도** 쓰지 않는다"* — **blanket** (3R CRITICAL) | **두 축 한정으로 좁힘** |
| **A12** | `:761` 「처방의 함정」 D-2 | *"경로가 비밀을 쓰지 않는다"* — blanket | **두 축 한정으로 좁힘** |
| **A13** | `:767` `#### 기각한 대안` | 2행 | 위 3행을 **같은 소절에 덧붙임**(새 H4 금지) |
| **A14** | `:776-778` 「재검토 신호」 | **2분법** — *"signing 축만 그 결정으로 대체된다"* | **3분법**: bot token / slack·discord signing(v2 대상) / **telegram signing(대상 아님)**. 안 고치면 v2 결정이 telegram 을 휩쓴다 |

### 다른 파일

| # | 자리 | 조치 |
|---|---|---|
| **B1** | `spec/2-navigation/2-trigger-list.md:176` | *"bot token·inbound signing 값은 요청 전후로 동일하고"* — **1R CRITICAL**. 차단 서술은 두고 **"값 불변" 서술만** 좁힘 |
| **B2** | `spec/data-flow/14-chat-channel.md:151` | *"`secret_store` 무변경"* 이 provider 무관 무조건 — telegram 을 가름 |
| **C1** | `plan/in-progress/spec-draft-nullable-notation-followups.md:1957-1978` | D-1/D-2/D-3 요약 **바로 아래**에, 그 파일이 이미 쓰는 **인라인 정정 각주 형식**으로 telegram 예외를 박는다. **완료 판정은 "체크박스 종결" 이 아니라 "본문에 각주가 실재하는가"** (3R INFO) |
| **C2** | 같은 트래커 | 후속 2건 등재: ① `chat-channel-adapter.md §1.1` 의 *"멱등 = yes"* 각주(값 불변 아님) ② `swagger.md §1` 에 *"부분 갱신 DTO 는 `Update`"* 승격 여부 |

## 재발 기록 — 같은 병을 네 번 앓았다

| 라운드 | 내가 센 것 | 실제 | 놓친 자리 | 내 방법의 결함 |
|---|---|---|---|---|
| impl-prep `21_37_56` | *"넓은 건 R-CC-21 **산문**뿐"* | 정본 표 행도 | `data-flow:151` | 층(산문/표)으로 갈랐다 |
| `--spec` 1R `21_53_42` | 미러 **3파일** | **4파일** | `2-trigger-list:176` | 대조 단위가 "파일" |
| `--spec` 2R `22_04_23` | 4파일 | 파일이 단위가 아니다 | `15-chat-channel:614` | 파일 **내부**를 안 셌다 |
| `--spec` 3R `22_14_27` | 문구 전수 grep | **grep 도 못 잡는다** | `15-chat-channel:750` | *"비밀**을**"* 로 grep 해 *"비밀**도**"* 를 놓쳤다 |

**네 번 다 내가 편집한 문서를 내가 검토할 때 좁아졌다.** 3R 이 결정적이다 — 나는 2R 대응에서
*"키워드 확장은 원리적으로 틀렸다"* 고 적고 문구 grep 으로 갈아탔는데, **문구 grep 도 결국
키워드다.** 조사 하나(`을`/`도`)가 달라 여섯 번째 자리를 놓쳤다.

**4R 대응은 열거 대상을 바꿨다** — 패턴 매칭을 버리고 **영향 절 전문을 줄 단위로 출력해 각
문장의 주어를 하나씩 판정**했다(R-CC-21 `:734-778` 전체 · §5.4.1 `:367-382` 전체 ·
§5.4.1.1 `:384-407` 전체). 그 결과가 위 **A1~A14** 이고, 개수가 5 → **14** 로 늘었다.

## 이 턴에 하지 않는 것

- **`ChatChannelPatchConfigDto` 명명** — 구현 턴에서 `ChatChannelUpdateConfigDto` 로. 3R
  `convention_compliance` 가 *"`swagger.md` 에 `Patch` 금지 규칙은 **없다** — 규약 위반이 아니라
  아직 없는 규약의 신설을 올바르게 별 트래커로 넘긴 것"* 으로 확인.
- **`details.field` 실측 캡처** — 범위를 **5필드 전체**로 넓혀 트래커에 반영.

## 체크리스트

- [ ] `--spec` 1R `21_53_42` — **BLOCK: YES** (미러 3/4)
- [ ] `--spec` 2R `22_04_23` — **BLOCK: YES** (파일 내부 자리 누락)
- [ ] `--spec` 3R `22_14_27` — **BLOCK: YES** (`:750` + frontmatter `started`)
- [ ] `--spec` 4R — BLOCK: NO
- [ ] 변경안 A1~A14 · B1~B2 · C1~C2 적용
- [ ] `impl-chat-channel-patch-token.md` 의 frontmatter 도 `created:` → `started:` (같은 결함)
- [ ] docs 가드
- [ ] `plan/complete/` 이동
