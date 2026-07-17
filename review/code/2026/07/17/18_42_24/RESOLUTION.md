# RESOLUTION — review/code/2026/07/17/18_42_24

위험도 LOW · Critical 0 · Warning 1 · forced 7/7 커버리지 확보.

본 라운드는 직전 라운드(`18_02_39`)의 W#1·W#2 정정 커밋(`3e84d2109`)에 스코프를 맞춘 델타 리뷰다.
대상은 `output-shape.ts` 의 JSDoc 재작성 + plan 각주 SHA 정정 — **런타임 코드 0줄 변경**
(7개 reviewer 전원이 `git show`/grep 으로 독립 실측 확인).

## 조치 항목

| SUMMARY # | 판정 | 조치 | 근거 |
|---|---|---|---|
| W#1 OR-체인 6분기 중 3개가 격리 테스트 없음 | **이월** (칩 등록) | 이번 PR 에서 조치 없음 | **리뷰어 지적은 타당하나 이번 커밋이 만든 문제가 아니다.** `output.interactionType` 직접 경로 / `output.conversationConfig` nested 경로 / `hasLegacyMessages && metaInteraction` 단독 케이스 3개가 격리 테스트 없이 방치돼 있고, 특히 3번째는 **분기를 통째로 지워도 테스트가 green** 이다(mutation 무방비). 다만 이는 **사전 존재 갭**이며, 리뷰어 자신이 "이번 커밋(순수 JSDoc 정정, 코드 변경 없음) 자체의 병합을 막을 사유는 아님 — 별건 후속 커밋으로 처리 가능" 이라 명시했다. 후속 칩 `Isolate-test 3 untested isConversationOutput branches` 로 이월(상충 진술 확인 과제 포함). |

> **이 갭이 지금 드러난 것 자체가 W#2 정정의 효과다.** 직전 JSDoc 은 "all four shapes" 라며 4개만 열거했고 정작 이 PR 의 주제인 endReason 분기(`looksLikeConversationEnd`)를 빠뜨리고 있었다. 실제 6분기를 정확히 열거하도록 고치자 "그중 3개는 테스트가 없다" 가 비로소 보였다 — 부정확한 열거는 갭을 숨긴다.

## 미채택 (INFO — 조치 불요 판정)

| # | 사유 |
|---|---|
| INFO#1·#2 JSDoc bullet 1·2 의 잔여 서술 정밀도 | 3개 reviewer 공통 지적이나 **이번 diff 이전부터 있던 서술이고 W#2 정정 범위 밖**. bullet 1 은 `messages` 를 조건처럼 서술하나 코드는 검사하지 않고, bullet 2 는 동등한 `output.interactionType` 경로를 미언급. 다음에 이 함수를 만질 때 다듬는다. 새 disclaimer("분기가 authoritative, 목록은 bound 하지 않는다")가 과신 위험을 이미 완화한다. |
| INFO#3 `hasConvConfig` 도달 가능성 상충 진술 | 실질적 확인 과제라 위 칩 프롬프트에 포함해 이월했다. |
| INFO#4 함수 JSDoc 과 인라인 주석의 중복 서술 | 리뷰어 판정 "조치 불요 — 새 disclaimer 가 위험 상당 부분 완화". 동의. |
| INFO#5 상수 JSDoc 과 bullet 6 의 #959 배경 중복 | 리뷰어 판정대로 **지역성 이점**이 있다 — 상수를 볼 때와 게이트 함수를 볼 때 각각 맥락이 완결된다. 유지. |
| INFO#6 JSDoc 분기 열거를 강제하는 자동 가드 부재 | 타당한 지적이나(이번이 두 번째 부정확이었다는 게 증거) 산문 열거를 코드와 동기화 강제하는 장치는 이 PR 범위 밖이다. 위 칩의 격리 테스트가 추가되면 `it()` 설명이 JSDoc 목록의 실행 가능한 대응물이 되어 부분 완화된다. |
| INFO#7 HEAD 가 리뷰 대상 커밋보다 앞섬 | 정확한 관찰. `4374ff5ce`(plan `complete/` 이동)는 `plan/**` 전용이라 `codebase/**` 게이트 대상이 아니다. |

## 검증

마지막 코드 커밋(`3e84d2109`, 18:29:00) 이후 실행 — 전 단계 통과:

- `.claude/tools/run-test.sh lint` — PASS
- `.claude/tools/run-test.sh unit` — PASS
- `.claude/tools/run-test.sh build` — PASS
- `.claude/tools/run-test.sh e2e` — **PASS** (`status=PASS duration=304s`, backend supertest 256 / 45 suites · **playwright 51 passed (1.6m)**)

## 후속 (칩 등록 완료 — 4건)

| 칩 | 출처 |
|---|---|
| `Guard package-registration lists against drift` | 본 세션 실측 (배선 2곳 실제 누락) |
| `Generify ResumableNodeHandler endReason type` | 17_00_55 W#3 |
| `Harden interaction-type grep guard regex` | 16_07_35 testing INFO |
| `Isolate-test 3 untested isConversationOutput branches` | **본 라운드 W#1** |
