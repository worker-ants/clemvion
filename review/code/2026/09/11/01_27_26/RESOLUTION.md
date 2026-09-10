# RESOLUTION — `review/code/2026/09/11/01_27_26` (6라운드, 전수)

**CRITICAL 0 / WARNING 4 / INFO 9.** reviewer **14명 전원**, forced 화이트리스트 7명 전원
결과 확보(`forced_missing` 0 · `unfinished` 0). 다수 reviewer 가 이 PR 의 두 사전 CRITICAL
(R-CC-10 우회 · `inboundSigningRef` fail-open)이 실제로 해소됐음을 코드·테스트 실행으로
교차 확인했다.

> **왜 전수였나**: 4R·5R 을 타겟(4명·2명)으로 돌렸더니 `review_guard._summary_is_resolved()`
> 의 **forced 7명 커버리지**를 만족하지 못해 push 게이트가 *"15 codebase/ file(s) changed
> AFTER the most recent resolved review"* 로 막았다. 타겟 라운드는 정보로는 유용했지만
> (orphan JSDoc · JSDoc 유출 · CHANGELOG 를 잡았다) **종결에는 쓸 수 없다.**

## 조치 항목

| # | 등급 | 사안 | 처분 |
|---|---|---|---|
| 1 | WARNING | `TriggersService` God Object 경향(1855줄) | **후속 등재** — 사전 존재, 이미 트래커에 있음 |
| 2 | WARNING | **내부 3필드의 `null`/`''` 테스트가 없다 — 그런데 내가 그 항목을 "테스트로 고정됐다"고 종결했다** | **수정 + 트래커 재정정** (아래) |
| 3 | WARNING | `store()` JSDoc 이 **`codebase/**` 3곳**에 남아 있다 — 내 열거가 `spec/` 만 봤다 | **수정** — 3곳 정정 + 트래커 대상 목록 갱신 |
| 4 | WARNING | 동시 PATCH lost update | **후속 등재** — 사전 존재, 이미 트래커에 있음 |
| INFO 1–9 | INFO | SPEC-DRIFT 2건(planner 위임 완료) · `botToken` MinLength · mdx 갈래 서술 · boolean-trap · LSP · 의존성 · 양방향 참조 · 비원자적 커밋 | 조치 불요 / 기존 등재 |

## #2 — 내가 한 시간 전에 쓴 종결 근거가 거짓이었다

`assertChatChannelInputSafe` 의 내부 3필드(`botTokenRef`·`inboundSigningRef`·`inboundSigning`)
dead-code 항목을 닫으면서 *"두 필드 × 두 값 4조합이 그 갈래를 고정한다"* 고 적었다.
**그 4조합은 신규 2필드만 덮고 이 항목의 대상인 내부 3필드는 하나도 걸지 않는다.**

reviewer 가 뮤테이션으로 먼저 실증했고, **나도 재현했다**: 세 가드를
`typeof x !== 'undefined'` → falsy 체크로 완화하니 **207개가 그대로 GREEN**.

**처분**: 3필드 × 2값 **6조합**을 추가해 `it.each` 를 10조합으로 만들었다. 같은 뮤턴트를
재주입하니 **RED 6건** — 새 조합이 정확히 그 갭을 문다. 트래커의 종결 각주도 재정정했다
(*"첫 판본이 거짓이었다"* 를 명시하고 뮤테이션 실측 두 방향을 함께 적었다).

**형태**: 신규 2필드만 채우고 **자매 3필드**를 안 봤다 — 이 세션이 반복한 *"축은 대칭인데
한쪽만"* 의 여섯 번째다. 그리고 이번엔 그 위에 **거짓 종결 주장**까지 얹었다.

## #3 — 열거의 스코프가 좁았다

`store()` vs `rotate()` drift 를 등재하며 `spec/` 만 grep 했다. `codebase/**` 에도 세 곳
있었다: `slack.adapter.ts:65` · `triggers.service.ts:755` · `chat-channel-config.dto.ts:252`.
**셋 다 이 PR 에서 고쳤다**(developer 권한 안) — 각 자리에 *"`setupChannel` 은 세 갈래에서
재호출되는 멱등 함수라 중복 시 throw 하는 `store` 로는 두 번째부터 깨진다"* 는 근거를 함께
남겼다. 트래커에는 *"남은 것은 `spec/` 9곳뿐"* 으로 갱신했다.

## 수렴 예외 — #1·#4

developer SKILL §ISSUE FIX 정책 (a)(b)(c):

- **(a)** 둘 다 **사전 존재 설계**이고 이 diff 가 만든 것이 아니다. #4 는 CCH-SE-01 의
  best-effort 2단계 커밋이고, #1 은 여러 라운드 전부터 추적 중이다. reviewer 도 각각
  *"이번 PR 착수 불요"* · *"이번 PR 을 막을 사유는 아님"* 으로 명시했다.
- **(b)** #4 의 처방(advisory lock / `FOR UPDATE`)은 `update()` · `setupChatChannel()` ·
  `rotateChatChannelBotToken()` **세 지점을 함께** 바꿔야 하고, #1 은 협력자 추출이라
  둘 다 이 PR(두 CRITICAL 닫기)의 범위를 크게 넘는다.
- **(c)** 등재 사유는 비용이 아니라 **수렴**이다 — 발견의 성격이 동작 → 측정범위 → 문서 →
  주석 → **테스트 커버리지·주석 스코프**로 이동했고, 남은 둘은 이 PR 이 건드리지 않은
  구조 부채다.

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** |
| unit | **PASS** — triggers 모듈 `it.each` 10조합 포함 |
| build | **PASS** |
| e2e | **통과** — 305 |

타입체크 ratchet 2종 — backend 197건/36파일 · frontend 52건/15파일, baseline 일치.

**뮤테이션 검증**: 내부 3필드 가드 완화 → 신규 조합 **RED 6** (`cp` 원복 후 GREEN).

## 보류·후속 항목

#1·#4 와 INFO 3(`botToken` `@MinLength(1)`), INFO 4(mdx 의 flat 갈래 미서술)는
`plan/complete/impl-chat-channel-patch-token.md` 가 가리키는 중앙 트래커
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재돼 있다.
