# RESOLUTION — `18_23_54`

Critical 2 / Warning 5 **전부 처분**. 처분 커밋: `38b49780e`.

## C1 (testing) — 오라클이 실행 환경에 따라 갈렸다 → **고침**

원인은 리뷰어 진단대로 **마진**이다. `shouldAdvanceTime: true` 는 가상 시계를 실경과시간에
얹는데, 스케줄(6초)과 검증 창(10·20초)이 같은 자릿수라 실행 속도가 단계 경계를 넘나들었다.

`PHASE_SCHEDULE_MS = 90분` · `PHASE_ADVANCE_MS = 91분` 으로 바꿨다. 드리프트는 초 단위이므로
단계 경계를 흔들 수 없고, 각 단계는 정확히 갱신 1회를 담는다.

**"아직 안 열렸다" 를 단언하는 자매 테스트도 같은 취약 형태**라 함께 넓혔다 — 리뷰어는 한
테스트만 지목했지만 그 형태(부재 단언 + 촘촘한 스케줄)가 축이다.

**리뷰어와 같은 조건에서 재검증**(repo 밖 scratch 사본, `node_modules` 만 symlink):

| | 결과 |
|---|---|
| 정상 코드, 콜드 캐시 | **4/4 PASS** (리뷰어가 4/4 FAIL 을 본 그 조건) |
| 뮤턴트(낙관적 클리어 복원), 콜드 캐시 | **3/3 FAIL** |

즉 오라클이 복구됐다 — 이제 RED 는 결함을 뜻한다.

리뷰어의 (b)("CI 에서 10회 돌려 flake 율 확인")는 채택하지 않았다. **원인이 특정됐으므로
빈도를 재는 것은 증상 관리다.** (c)("RESOLUTION 에 신뢰도 caveat")도 불필요해졌다 — caveat 를
다는 대신 그 주장이 참이 되게 고쳤다.

## C2 (documentation) — 계약 JSDoc 자기모순 → **고침**

`seedWaitingFromStatus` JSDoc 에서 stale 문장("그 외 실패는 `"continue"`")을 지웠다. "세 갈래"
라는 숫자도 실제 불릿 수와 안 맞아 "아래와 같이 가른다" 로 바꿨다.

**리뷰어가 짚지 않은 자매도 같이 고쳤다** — `@returns` 절이 "`"continue"` 가 아니면 후속
`openStream`/`scheduleRefresh` 를 **반드시 건너뛴다**" 로 적혀 있는데, `refresh_deferred` 는
`scheduleRefresh` 를 건너뛰지 **않는다**. 같은 형태로 낡아 있었다. 중단 판정의 소유자가
`shouldAbortAfterSeed` 임을 명시하고 세 갈래를 정확히 서술하도록 다시 썼다.

## W1 (security) — 토큰 로그 노출 → **고침**

`redactToken`(`lib/eia-client`)을 추가해 catch 의 `console.warn` 에 적용했다. `token=` 값만
지우고 `lastEventId` 등 인접 파라미터는 보존한다.

**처음 쓴 회귀 단언은 vacuous 였다** — 테스트 mock 이 `TypeError("malformed stream URL")` 를
던져 메시지에 URL 자체가 없었고, 그래서 redaction 이 한 번도 안 돌았는데 단언은 통과했다.
브라우저의 실제 실패처럼 URL 을 담아 던지도록 고친 뒤 **`redactToken` 을 항등으로 바꾸는
뮤턴트가 RED** 임을 확인했다. `eia-client.test.ts` 에도 단위 회귀 2건을 추가했다.

## W2 (testing) — `instanceof` 가드가 장식이었다 → **고침**

`.status` 만 가진 비-`EiaError`(오리 타이핑 객체)로 그 축을 가르는 단위 테스트를 추가했다.
기존 비-종단 케이스가 전부 `.status` 자체가 없어서 가드 삭제가 429/429 를 통과했던 것.

## W3 (maintainability) — 꼬리 블록 중복 → **조건부 defer, plan 등재**

리뷰어 자신이 "지금 막을 CRITICAL 은 아니다, **다섯 번째 갈래가 추가되는 시점**에 부분 추출을
검토하라" 로 조건부 제안했고 동의한다. 두 호출부가 진짜로 동일하지 않고(`clientRef` null 가드,
`isAttemptStale` checkpoint, `live` 폴백이 `saved`), 지난 라운드들이 "오케스트레이션 통합 금지"
로 이미 여러 번 결론 낸 비대칭이 실재한다.

`webchat-auth-session-status-reconcile.md` 에 **트리거 조건과 함께** 등재했다 — "언젠가 검토"
가 아니라 "다섯 번째 갈래 추가 시" 로 적어야 그 작업자가 실제로 마주친다.

## W4·W5 (documentation) — 복제된 사실 두 자리가 굳어 있었다 → **고침**

- plan 상단 색인 표: `아래 §미해결 참조` → `닫힘 — 아래 §해소됨 참조(잔여는 별도 축)`.
  본문 절은 고쳤는데 그 절을 가리키는 색인을 안 고친, 정확히 이번 라운드가 검증을 요청한 그 패턴.
- `plan/complete/web-chat-quality-backlog.md` 각주: "spec 6문서 전부 `implemented` 는 더 이상
  참이 아니다" 가 이 PR 로 **다시 거짓**이 됐다. 재정정 문장을 덧붙이되 원문은 남기고, "같은
  자리를 두 번 뒤집었으므로 다음 독자는 frontmatter 를 직접 볼 것" 을 명시했다.
- 곁들여 INFO 하나(표 도입 문장이 "두 항목" 인데 표는 5행)도 고쳤다 — **개수를 문장에 박으면
  표가 늘 때마다 조용히 거짓이 된다**는 이유를 함께 적었다.

## 검증

- 위젯 vitest **433 passed** (23 files, +4).
- `tsc --noEmit` **0 errors**.
- harness/doc guards **1032 passed / 1128 subtests**.
- 뮤테이션 **누적 12종** — 이번 라운드 2종 추가(`redactToken` 항등 / 콜드 캐시 재확인), 전부 RED.
