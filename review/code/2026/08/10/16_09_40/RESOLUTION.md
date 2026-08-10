# RESOLUTION — `16_09_40` 라운드

forced 7명 전원. **Critical 1 · WARNING 8 전부 반영.**

## 1. 내가 만든 CRITICAL — 4명이 독립 수렴했다

**지적**: §R4 의 401 refresh 가 성공하면 `sessionRef.current` 를 갱신하는데, 호출부는
**seed 호출 전에 캡처한 지역 변수**를 `openStream` 에 넘긴다. 서버가 이미 거부한 토큰으로
SSE 를 여는 것이고, **이 PR 이 고치려던 증상을 성공 경로에서 재현**한다.

**판정: 유효.** 뿌리는 `SeedOutcome` 이 "무엇이 바뀌었나" 를 실어 나르지 않는다는 것 —
최신 세션은 **ref 에서 읽는 것이 유일한 정답**이다. 두 호출부를 그렇게 고쳤다.

**내 뮤테이션 3종이 전부 RED 였는데도 이 결함은 안 잡혔다.** 뮤테이션이 겨냥한 축
(분기가 존재하는가)과 결함의 축(어느 **값**을 넘기는가)이 달랐다. 분기를 다 덮어도 그
분기가 넘기는 값은 별개 축이다.

## 2. 테스트가 그 결함을 통과시켰다 (false confidence)

`installControllableEventSource` 가 **생성자 URL 을 통째로 버렸다.** "SSE 가 열렸다" 는
단언은 가능해도 "**옳은 토큰으로** 열렸다" 는 물을 수 없었다. URL 포획 + 토큰 단언 추가,
뮤테이션 RED 확인.

## 3. 세대 재검사 사각지대 (testing)

refresh 후 `isStale(gen)` 2곳을 어떤 테스트도 안 겨냥했다 — 기존 테스트가 전부 즉시 resolve
라 그 창을 못 만든다. refresh 응답을 붙잡아 두고 그 창에서 대화를 종료시킨 뒤 놓아주는
회귀를 추가했다. 뮤테이션 RED.

> 첫 판 단언이 `not.toContain` 이었는데 storage 가 `null` 이라 쓸 수 없었다. **null 이 오히려
> 더 강한 결과**(완전 정리)이므로 부재를 직접 단언하도록 고쳤다 — 통과시키려 약하게 바꾼 것이
> 아니라 실제 성질에 맞춘 것이다.

## 4. 머지 순서 의존을 커밋 메시지에만 남겼다 (scope)

**판정: 유효.** PR 설명 승계 보장이 없고, **`3-auth-session.md` 자체에 단서가 없어** 그
파일을 여는 사람·에이전트는 알 방법이 없다. 게다가 `spec-impl-evidence.md §3` 승격 가드는
`pending_plans` 가 `complete/` 로 **이동하는 커밋 안**에서만 발동하므로 이 상황을 자동으로
못 잡는다.

plan 신설(`webchat-auth-session-status-reconcile.md`) + spec 본문 포인터.

## 5. 자매 갱신 경로 (maintainability)

토큰 반영+영속화 4줄이 두 곳에 복제. **오케스트레이션은 합치지 않았다** — 실패 동작이
정반대(로그만 vs 세션 종료 확정)라 옵션으로 합치면 결합도만 는다. `applyRefreshedToken` 으로
그 4줄만 뽑고 세대 검사는 호출부 책임으로 남겼다. 뮤테이션 RED 2건.

## 6~8. 문서 3건 (documentation)

- 테스트 JSDoc 이 frontmatter 를 **미머지 PR 상태**로 서술 → 실제 사실로 정정.
  **이 세션에서 여덟 번 반복한 형태다.**
- `seedWaitingFromStatus` 계약에 세 갈래 + "호출부는 refresh 후 ref 를 읽어야 한다" 명시.
- CHANGELOG 항목 신설(관례 형태 준수).

## 남긴 갭

`start()` 경로 회귀는 SSE 가 안 열려 실패했다. 뮤테이션 실측으로 **절반만 덮는다**는 사실을
확인했고, 통과할 때까지 구부리는 대신 도달 가능성 확인을 선행 과제로 등재했다.

## 검증

- 위젯 **414 passed** · `tsc` **0 errors** · 문서 가드 **2876 passed**
- 뮤테이션 6종 RED
