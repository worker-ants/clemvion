---
title: telegram server-issued 서명은 PATCH 비밀-쓰기 금지의 스코프 밖이다 — carve-out 명시
status: in-progress
owner: project-planner
worktree: .claude/worktrees/spec-telegram-signing-carveout-6b21ff
spec_impact:
  - spec/5-system/15-chat-channel.md
  - spec/data-flow/14-chat-channel.md
created: 2026-09-10
---

## 왜 이 턴이 생겼나

어제 PR #1311(`df1962e25`)이 *"`chatChannel` 이 실린 PATCH 는 비밀을 쓰지 않는다"* 를 결정했다.
오늘 그 결정을 구현하려고 developer 턴을 열었고, 착수 게이트
(`/consistency-check --impl-prep spec/5-system`, `review/consistency/2026/09/10/21_37_56`)가
**BLOCK: YES / Critical 1** 을 냈다.

**그 결정문이 telegram 에서 거짓이고, 문면대로 구현하면 챗봇이 죽는다.**

## 실측 — 세 층에서 같은 사실이 나온다

| 층 | 위치 | 내용 |
|---|---|---|
| adapter 코드 | `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts:73` | `setupChannel` 마다 `randomBytes(24)` 로 **새** `issuedInboundSigning` 발급 → Telegram `setWebhook` 의 `secret_token` 으로 등록. 주석: *"매 setupChannel 마다 새 inbound-signing 자료 발급 — 재사용하지 않는다"* |
| 호출부 코드 | `codebase/backend/src/modules/triggers/triggers.service.ts:987-993` | `result.issuedInboundSigning` 이 있으면 **무조건** `secrets.rotate(inboundSigningRef, …)`. provider-issued 축(`:957-969`)과 **주석으로 명시 구분된 별도 블록** |
| spec 본문 | `spec/4-nodes/7-trigger/providers/telegram.md:219` | *"`setWebhook` 의 `secret_token` 파라미터를 등록 시점에 랜덤 발급 … caller 가 `SecretResolver.store(…)` 보관 후 ref 만 set … HooksController 가 `resolve(inboundSigningRef)` 후 헤더 동일성 검증. 실패 시 `401`"* |

즉 **저장을 건너뛰면 DB 는 옛 값, Telegram 은 새 값으로 서명**한다 →
`X-Telegram-Bot-Api-Secret-Token` 불일치로 **그 트리거의 모든 인입이 401**.
`rateLimitPerMinute` 한 번 바꾼 PATCH 로 챗봇이 영구 응답 불능이 된다.

## 두 갈래 다 문제다 — 그래서 spec 을 고쳐야 한다

| 갈래 | 결과 |
|---|---|
| (a) 문면대로 `:987-993` 까지 skip | 위 401. **동작 파손** |
| (b) `:987-993` 유지 (올바른 구현) | 구현은 맞지만 **spec 세 문장이 거짓으로 남는다** |

구현을 옳게 해도 spec 이 틀린 채 남으므로 developer 턴만으로는 닫히지 않는다.

## 이미 그어져 있던 경계 — 이 carve-out 은 신설이 아니라 명시다

- `15-chat-channel.md §5.4.1.1` 은 **제목 자체가** *"slack / discord 한정"* 이다 — telegram 축은
  처음부터 그 절의 스코프 밖이었다.
- `2-trigger-list.md` `### R-12` 는 *"telegram 은 server-issued 라 본 필드 미사용"* 이라 적어
  PATCH 차단이 slack/discord `inboundSigning` 에만 걸린다고 이미 말한다.
- `15-chat-channel.md §4.1` 데이터 모델도 telegram 을 *"server-issued shared secret"* 으로 분리한다.

넓어진 것은 어제 내가 쓴 **세 자리뿐**이다. 나머지 문서는 경계를 정확히 유지하고 있었다.

## 결정

- **D-A** — PATCH 가 쓰지 않는 비밀은 **두 축 한정**이다: (1) `botToken`(rotate 대상),
  (2) `inboundSigningPlaintext`(slack/discord 사용자 입력). telegram 의 server-issued
  `issuedInboundSigning` 은 `setupChannel()` 재호출의 부수효과로 **계속 갱신·저장된다.**
- **D-B** — 그 carve-out 의 근거는 *"사용자가 보낸 비밀인가"* 다. R-CC-21 이 막으려는 것은
  **PATCH body 로 비밀이 유입되어 rotate 경로를 우회하는 것**이고, telegram 의 값은 body 에서
  오지 않고 adapter 가 provider 와 합의해 발급한다 — 자원 성격이 다르다.
- **D-C** — 이 결정은 R-CC-21 을 **번복하지 않는다.** 두 정본 표(§5.4.1 · §5.4.1.1)가 이미
  가진 스코프를 산문과 data-flow 행에 맞춰 **좁히는** 것이다.

## 변경안

| # | 파일 | 변경 |
|---|---|---|
| **A** | `15-chat-channel.md` §5.4.1 「`chatChannel` 이 실린 PATCH」 행 | *"secret store 에 저장된 bot token 을 바꾸지 않는다"* 뒤에 telegram carve-out 한 문장 추가 |
| **B** | `15-chat-channel.md` `### R-CC-21` | *"PATCH 는 어떤 비밀도 받지 않고, 어떤 비밀도 쓰지 않는다"* 를 **두 축 한정**으로 명시 + carve-out 소절 신설 |
| **C** | `data-flow/14-chat-channel.md` §1.3 「`chatChannel` 이 실린 PATCH」 행 | *"`secret_store` 무변경"* 이 **provider 무관 무조건**이라 거짓 — telegram 을 가른다 |
| **D** | `15-chat-channel.md` §3.1 `CCH-AD-02` | 호출 조건이 *"enable / 신규 생성"* 으로만 적혀 세 번째 갈래(`chatChannel` 실린 일반 PATCH)를 안 덮는다 → forward-link (`cross_spec` W1) |
| **E** | `15-chat-channel.md` §5.4.1 표 2행 (활성화 PATCH) | 미해소 불확실성인데 캐비아트가 없다 — 자매 행과 같은 형식으로 부여 (`plan_coherence` W2) |

## 이 턴에 하지 않는 것 — 후속 등재 대상

- **R-CC-21 발견을 origin 트래커에 등재** (`plan_coherence` W2) — 이 draft 자체가 그 등재의
  실행이므로 트래커에는 *"planner 턴으로 처리 완료"* 로 닫는다.
- **`ChatChannelPatchConfigDto` 명명** (`naming_collision` W) — 저장소에 `Patch` 접두 클래스가
  **0건**(`Create`/`Update` 축)이다. **구현 턴에서 `ChatChannelUpdateConfigDto` 로 간다.**
  spec 사안이 아니므로 여기서 다루지 않는다.
- **`details.field` 실측 캡처** — 기존 등재 항목. 다만 범위를 **5필드 전체**로 넓힌다
  (신규 2 + 기존 `botTokenRef`·`inboundSigningRef`·`inboundSigning`) — `convention_compliance` INFO.

## 체크리스트

- [ ] `/consistency-check --spec` BLOCK: NO
- [ ] 변경안 A~E 적용
- [ ] 트래커 갱신 (R-CC-21 항목 종결 + `details.field` 범위 확대)
- [ ] docs 가드
- [ ] `plan/complete/` 이동
