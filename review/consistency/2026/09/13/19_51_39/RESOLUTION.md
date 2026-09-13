# RESOLUTION — `--impl-done spec/conventions/` 라운드 2 (`review/consistency/2026/09/13/19_51_39`)

**BLOCK: NO** · Critical 0 · WARNING 2 · INFO 5 · 위험도 LOW.
5개 checker 전원 전문 제출. `[CRITICAL]` 마커 0건.

## WARNING#2 — bare 시각 인용 (고침)

`guide-identifier-existence.test.ts:203` 이 `` `19_23_22` `` 로 날짜 없이 인용했다.
`review-citations.md §2` 위반이고, **같은 파일의 다른 4곳은 전체 경로로 옳게** 쓰고 있어
내부적으로도 어긋났다.

`#1331` 라운드 2 에서 이 클래스를 전수 정정했는데 **한 건을 재도입**했다. 전체 경로로
고치고 이 브랜치가 만진 파일 6개를 전수 확인 — 잔여 0건.

> **처음 짠 사후 검사가 틀렸다.** *"파일 전체의 bare 인용 0건"* 을 단언했는데
> `CHANGELOG.md` 에 1건이 걸렸다. `git diff origin/main` 으로 확인하니 **선재분**이고
> 내가 추가한 줄에는 0건이었다. 술어를 «파일 전체» 가 아니라 «내 추가분» 으로 좁혀야
> 했다 — 숫자가 아니라 **술어**가 틀린 형태다.

## WARNING#1 — 조치 불요 (등재분)

`CONTAINER_*` 를 코드처럼 서술하는 spec 6파일. 라운드 1 에서 planner 트래커에 등재했고
checker 가 *"이미 등재·위임됨, 신규 조치 불요"* 로 확인했다.

## INFO#1 — CHANGELOG 자기모순 (고침)

`/ai-review` WARNING#1 과 **같은 누락을 두 게이트가 독립으로 봤다.** 라운드 1 에서
JSDoc·테스트·plan 을 정정하면서 CHANGELOG 만 빠뜨려, 같은 항목의 앞뒤 문단이 서로
모순됐다. 정정했다 — 자세한 것은 `/ai-review` 라운드 2 RESOLUTION.

## 나머지 INFO — 조치 불요

| # | 항목 | 사유 |
|---|---|---|
| 2 | `PROJECT.md:300` SoT drift | 선재·등재분 (8라운드 확인) |
| 3 | 허용목록 계보가 spec Rationale 밖 | 등재분 |
| 4 | 가드 family 가 `code:` 미등재 | 등재분 |
| 5 | `MESSAGE_PREFIX` ↔ `WC_MESSAGE_PREFIX` 부분 문자열 | **별개 패키지**(`web-chat-sdk`)라 실질 충돌 아님. 비-export 지역 상수이고 개명하면 이 파일의 다른 정규식 이름과 형식이 어긋난다 |
