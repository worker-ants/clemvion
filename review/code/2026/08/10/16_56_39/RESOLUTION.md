# RESOLUTION — `16_56_39` 라운드

forced 7명. **Critical 2 · WARNING 8 전부 반영.**

## 1. 내가 CRITICAL 을 고치며 CRITICAL 을 만들었다 (3명 독립)

직전 라운드에서 `"continue"` → `"stale"` 로 고쳤는데, 호출부는 `"continue"` 가 아니면
`openStream` **과 `scheduleRefresh` 를 함께** 건너뛴다. 후자는 세션의 **유일한** 갱신 예약
지점이다(`grep` 실측: 호출부 2곳이 전부). 예약이 없으면 물려받을 사이클이 없어 스피너에
영구 고착 — 이 PR 이 없애려던 증상이다.

**내 주석이 거짓이었다**: "다음 복구는 주기 갱신이 맡는다" 고 썼는데 **맡을 사이클을 내가
없앴다.** 근거를 쓸 때 그 근거가 성립하는지 확인하지 않았다.

두 부작용이 **반대 방향**이라 기존 갈래로 뭉갤 수 없어 전용 `"refresh_deferred"` 를 뒀다 —
스트림은 건너뛰고 갱신은 예약한다. `applyConfig` 는 `outcome` 이 블록 스코프라 플래그로
올렸고, **tsc 가 그 실수를 잡아 줬다**(`Cannot find name 'outcome'`).

## 2. 커밋된 산출물이 거짓을 주장했다 (scope)

`16_42_07` SUMMARY/RESOLUTION 이 `"stale"` 수정을 "반영(뮤테이션 RED 2건)" 으로 기록해
커밋됐는데 `git show` 상 그 커밋에 없었다. 산출물을 사실로 정정하고 원 서술은 이력 보존.

## 3. 테스트가 고착을 못 잡았다 (testing CRITICAL)

대기 조건은 옳았으나(헛대기 8건 전수 검사 통과) **`phase !== "ended"` 가 정상 streaming 과
고착 streaming 을 구분하지 못한다.** 그 둘을 가르는 것은 "복구 수단이 예약됐는가" 이므로,
만료 시점을 넘겨 **refresh 가 다시 나가는지**로 측정하도록 바꿨다.

fixture 의 `expiresAt` 을 lead+6초로 당겼다 — 90분이면 타이머가 안 와 단언이 decorative
해진다(이 파일이 같은 이유로 세워 둔 선례). **뮤테이션 RED**: `"refresh_deferred"` →
`"stale"` 재도입 시 잡힌다. 이전 판이었다면 초록이었다.

## 4. 같은 수정을 세 번 했다 — 검증은 커밋 전까지 잠정이다

`refresh_deferred` 배선이 두 번 유실됐다(검증 통과 뒤 커밋 전). 원인은 공유 워크트리에서
리뷰어의 뮤테이션 하네스가 `cp` 원복을 하기 때문이다 — 그 창 안의 내 편집이 덮인다.
§2 의 CRITICAL 과 **같은 뿌리**다.

이후로는 검증 직후 즉시 커밋하고 `git show --stat` 으로 착지를 확인했다.

## 검증

- 위젯 **417 passed** · `tsc` **0 errors** · 문서 가드 **2876 passed**
- 뮤테이션 누적 13종
