# RESOLUTION — `23_30_12` (2라운드, fix 후 fresh review)

- 결과: **RISK=LOW · Critical 0 · Warning 0 · INFO 8**, reviewer 7/7
  (`forced_missing=[]`, `unfinished=[]`)
- 처리: **수동** — Critical+Warning 이 0이라 `resolution-applier` 호출 조건 미충족.
  **코드 수정 0건.**

## 왜 2라운드가 돌았나

1라운드(`23_01_15`)의 WARNING 을 `resolution-applier` 가 고치며 `codebase/**` 가 바뀌었고,
`review_guard` 는 clean 파일에 대해 **커밋 시각**을 세션 시각과 비교하므로 1라운드가 stale 이
됐다. 코드를 고쳤으니 다시 보는 게 맞다.

> **게이트가 층을 순서대로 드러냈다.** `--impl-done` 만 stale 이라고 나와 그걸 해소했더니
> 그제야 코드 리뷰 freshness 가 나왔다. 게이트가 흔들린 게 아니라 (review → consistency →
> plan) 순으로 한 층씩 보여 주는 설계다. **첫 통과를 "다 끝났다" 로 읽으면 안 된다.**

## 수렴 판정 — developer SKILL §수렴 예외

- **(a) 발견의 성격이 이동했다.** 1라운드는 **동작 커버리지** WARNING(별칭 분기가 스위트에서
  양성 실행되지 않음), 2라운드는 **WARNING 0**. 코드가 다투는 지점이 사라졌다.
- **(b) 1라운드 WARNING 이 실제로 닫혔음을 리뷰어가 독립 확인했다** — `testing` 이 합성 소스
  테이블을 재실행하고 뮤테이션까지 돌려 "예측=실측 일치" 로 기록했다. main 도 별도로 같은
  두 뮤턴트를 재주입해 확인했다(`23_01_15/RESOLUTION.md` §main 의 독립 재검증).
- **(c) 남은 INFO 8건은 전부 비블로킹**이고, 대부분 이미 처분된 항목의 재확인이거나
  (INFO 1 planner 인계 완료 / INFO 6·7 직전 라운드 won't-do) 범위 밖(INFO 3·4·5)이다.
- **(d) 유일한 새 실질 항목(INFO 2)을 `review/` 에 두지 않았다** — plan 본문에 한 줄 fix 와
  함께 옮겼다. `review/**` 는 SoT 가 아니다.

## INFO 8건 처분

| # | 처분 | 사유 |
| --- | --- | --- |
| 1 `<도메인>EventType` 규칙 미문서화 | **이미 인계됨** | 같은 diff(`0ecc6fa2a`)가 planner 턴 인계 문단에 등재. requirement·documentation 중복 지적 |
| 2 facade 재수출이 spec 에서 미소비 | **plan 이관 (이번 PR 미수정)** | 아래 별도 절 |
| 3 26파일 중 22개가 워크플로 산출물 | 조치 불요 | `CLAUDE.md` §정보 저장 위치 부합, developer 의 `review/**`·`plan/**` 권한 범위 |
| 4 `notification-config.dto.ts` JSDoc 을 선택 항목인데 적용 | 조치 불요 | 개명의 반대쪽 대칭을 완결하는 4줄 문서 전용. 리뷰어도 "리스크·범위 확장 없음" |
| 5 개명의 외부 소비자 0곳 재확인 | 조치 불요 | 확인 기록 |
| 6 JSDoc 17줄 | won't-do | 직전 라운드에서 이미 처분 |
| 7 plan 502줄 누적 | won't-do | 같은 diff 안에서 이미 처분("근거는 문서에 남긴다" 채택 컨벤션) |
| 8 무관 스위트 2건 flaky 관측 | **기록만** | 아래 별도 절 |

## INFO 2 — plan 으로 이관한 이유 (숨기지 않고 적는다)

`websocket.service.ts` 가 `InAppNotificationEventType` 을 facade 로 재수출하는데,
`websocket.service.spec.ts` 는 그걸 **소비하지 않는다**. 그 spec 이 다른 세 값
(`ExecutionEventType`·`NodeEventType`·`BackgroundRunEventType`)에 대해서는 "의도된 커버리지"
라고 **명시**하고 있어 이 값만 비대칭이다 — 재수출 줄이 오탈자로 깨져도 RED 가 없다.

**이건 이 세션이 계속 만난 그 형태다**("주장은 있는데 그걸 지키는 것이 없다"). 그래서
넘기는 게 편치 않지만, 판단은 이렇다:

- **사전 갭이다.** 개명 전에도 옛 이름으로 같은 상태였다 — 이 PR 이 만든 결함이 아니다.
- **비용이 라운드 하나다.** `codebase/**` 를 건드리면 3라운드가 강제되는데, 2라운드가
  이미 **Warning 0** 으로 수렴했다. 수렴 뒤 한 줄을 위해 라운드를 다시 여는 것은
  이 저장소가 기록한 "fix→리뷰 stale 루프" 를 자초하는 쪽이다.
- **트리거가 아니라 즉시 실행 가능한 형태로 적었다** — plan 에 import 경로와 단언 한 줄을
  그대로 남겼으므로, 다음에 그 파일을 여는 사람이 재발견할 필요가 없다.

## INFO 8 — flaky 관측 (재현 안 됨)

리뷰어가 `npx jest src/modules/websocket/` 재실행 중 **1회** 무관 스위트 2건 FAIL 을 봤고
즉시 GREEN 복귀했다고 기록했다. main 의 재검증 실행(2회)과 TEST WORKFLOW 의 unit 단계
(435 suites / 9,058)에서는 **재현되지 않았다**. 이 diff 는 enum 개명 + 테스트 헬퍼라 무관
스위트를 흔들 경로가 없다 — **재현 실패는 부재의 증거가 아니므로** 단정하지 않고 관측만
남긴다. 같은 스위트가 다시 흔들리면 그때 이 기록이 두 번째 관측이 된다.

## 테스트

`codebase/**` 는 `09fa029f9`(lint/unit/build/e2e 전 단계 통과) 이후 불변이다. 이 라운드의
조치는 `plan/**`·`review/**` 뿐이라 TEST WORKFLOW 를 재수행하지 않는다 — 그래서 이 라운드는
stale 이 되지 않고 3라운드를 부르지 않는다.
