# RESOLUTION — `20_27_29` (1라운드, 종결)

- 결과: **Critical 0 · Warning 1 · INFO 8**, reviewer **7/7**(forced 전원 확보), 위험도 **LOW**
- Warning 1건 + INFO 3건 반영. 나머지 INFO 5건은 사유와 함께 미조치.

## W1 (documentation) — `CHANGELOG.md` 미갱신

이 저장소는 동작 변경이 없는 가드·하드닝성 변경도 `## Unreleased` 에 일관되게 기록한다
(직전 항목 "raw UPDATE/DELETE … RETURNING 회귀 가드" 가 정확히 같은 성격이다). 항목을 추가했다
— 9지점 리다이렉트 · **분리를 하지 않은 근거**(파일은 하나, const 는 둘) · AST 가드 · 뮤테이션이
가드 설계를 뒤집은 경위.

## INFO 3 (requirement) — 불필요한 `eslint-disable` → **실은 CI 브레이커였다**

리뷰어는 INFO 로 달았으나 **재분류했다.** 이 저장소 `lint` 는
`eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 0` 이라, "Unused eslint-disable directive"
경고 하나로 **`npm run lint` 가 실패한다**(실측: exit 비정상 → 지시어 제거 후 통과).

**내가 이걸 못 잡은 이유가 이 라운드의 진짜 교훈이다.** 커밋 전에 prettier·tsc·jest 는 돌렸고
`npm run lint` 는 **안 돌렸다.** 이 세션에서 "검증 범위가 내 주장보다 좁았던" 것이 여섯 번째다
(앵커-only 스윕 · 같은-줄 주어 매칭 · 키워드 목록 · `test_consistency*` · backend subset · lint 누락).
매번 다른 도구였고, 공통점은 **CI 가 보는 범위를 내가 재현하지 않았다**는 것이다.

## INFO 2 (testing) — `findUnanchored` 의 positive path 미검증

옳은 지적이라 반영했다. 기존 단언은 *"위반 0건"* 하나뿐이었는데, 그건 **저장소가 지금
클린해서** 통과할 수도 있고 **스캐너가 아무것도 못 봐서** 통과할 수도 있다 — 두 경우의 결과가
같다. `findUnanchored` 에 `relDir` 을 열고, 픽스처를 대상으로 `FIXTURE_*` 넷이 **실제로
검출되는지** + 보고에 파일·줄이 실리는지 단언했다.

## INFO 1 (maintainability) — 가드 spec 의 매직넘버

`declared.size > 30` 과 `reason.length > 20` 에 근거를 달았다. 전자는 실제 개수(36+4=40)에서
파생한 값이고 **한쪽 const 만 읽는 회귀**(36 또는 4)를 걸리게 잡은 것이다. 후자는
`'TODO'` 같은 알리바이를 막는 하한이며 **길이가 사유의 질을 보증하지는 않는다**는 한계를
주석에 명시했다.

## 미조치 (사유)

| INFO | 사유 |
|---|---|
| 4 (기존 테스트가 코드값을 맨 문자열로 단언) | 값이 동일해 오늘은 안전하고, 테스트를 상수 참조로 바꾸면 **테스트가 구현과 같은 상수를 보게 되어** 리네임 회귀를 오히려 못 잡는다. 지금 형태가 독립 검증이다 |
| 5 (JSDoc ↔ 가드 서술 부분 중복) | 리뷰어도 "현재 통합 불요". `ANCHORED_ELSEWHERE` 가 늘면 그때 축약 |
| 6 (`EXECUTION_TIME_LIMIT_EXCEEDED` 등 자매에 소급 미적용) | **의도된 스코프 축소**. 그 코드들은 이미 `ErrorCode` 에 있고 앵커가 있다 — 옮기는 것은 순수 churn 이고 소비처 리다이렉트만 늘린다 |
| 7 (plan 이동이 delete+add 로 보임) | **확인했다**: `git status --porcelain` 이 `R  plan/in-progress/… -> plan/complete/…` 로 rename 을 잡고 있고, 커밋 결과도 `rename …(87%)` 였다. 리뷰어가 본 것은 diff 표시 형태다 |
| 8 (가드 3파일이 최소 요청보다 넓다) | 리뷰어 스스로 "스코프 이탈로 보기 어려움". 형제 패턴(`redis-fail-open-catalog-guard.ts`+spec)을 그대로 따랐다 |

## 검증 — 이번엔 CI 범위 전부

  npm run lint (--max-warnings 0)   통과   ← 이 라운드에 빠졌던 것
  prettier --check                   통과
  tsc --noEmit (변경 파일)            0 에러
  backend jest 전수                  437 suites / 9109 passed, 1 skipped
  가드 spec                          12/12
