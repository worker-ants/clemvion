# RESOLUTION — 17_39_51 (라운드 5)

**CRITICAL 0 · WARNING 1 — 조치했다.**

## 조치

| # | 분류 | 조치 |
|---|---|---|
| W1 | 테스트 (회귀 방지) | `rotateBotToken` 응답에 **provider 별 부가 identity 필드**(Slack `teamId` · Discord `publicKey`)가 그대로 실리는지 `it.each` 2건으로 고정 |

## 세 번 지적받고 나서야 고쳤다 — **내 유예 근거가 틀렸다**

같은 자리가 `17_02_19` INFO 9 → `17_23_34` INFO 8 → 이번 WARNING 으로 올라왔다. 내 유예 근거는
*"전체 스프레드 반환이라 당장 위험이 낮다"* 였는데, 그건 **지금 형태에 대한 진술**이지 계약이
아니다. 누가 `botIdentity` 를 명시 필드 나열로 바꾸면 두 필드가 조용히 사라지고 — 그게 정확히
이 PR 이 고친 결함(**선언이 실제 반환보다 좁다**)의 재발이다.

**뮤테이션으로 증명했다**: 반환부를 명시 필드 나열(`{botId, username}`)로 바꾸면 **2건 RED**.
`toEqual` 을 쓴 것이 요점이다 — `objectContaining` 이었으면 필드 누락을 못 본다.

> 이 저장소의 규율이 그대로 맞았다: ***"4라운드 재지적이면 항목이 아니라 내 근거를 의심하라."***
> 유예를 네 번째로 방어하는 것보다 열 줄을 쓰는 쪽이 쌌다.

## 이월 (INFO — 전부 등재됨)

`15-chat-channel.md` glob 확장(planner) · `response-contract` 배선(전역 갭) ·
`throwInvalidField` 넓은 타이핑(4라운드 이월) · 신규 가드의 비재귀 순회·`SRC_ROOT` 소유권 ·
`it.each` 골격 중복 · **유저 가이드 MDX 4곳의 `TRIGGER_NOT_FOUND` → `RESOURCE_NOT_FOUND`**
(2026-05-23 `#282` 유입, 이 PR 무관 — 트래커 신규 등재).

## 다음 라운드가 마지막이다 — 규칙을 좁혔다

라운드 3·4·5 는 전부 **이월 INFO 의 승격**이었다. 조치할 때마다 `codebase/**` 가 바뀌고 원
정지 규칙은 그때마다 라운드를 추가하므로 **유예가 남아 있는 한 끝나지 않는다**. 보정한 규칙은
`plan/in-progress/chat-channel-rules-cleanup.md` §정지 규칙 **보정** 에 있고, **라운드 6 결과를
보기 전에** 적었다: *"CRITICAL 0 이고 WARNING 이 새 결함 클래스가 아니면 수렴"*.

## TEST

- `triggers.service.spec.ts` 128 passed (신규 2건 포함)
- 재현 뮤테이션 **RED** (원복 assert)
