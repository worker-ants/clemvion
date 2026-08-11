# RESOLUTION — `10_02_22`

Critical 2 / Warning 7 **전부 처분**. 처분 커밋: `f924815f1`.

## C1 — 부팅 실패를 조용히 삼켰다 → **고침**

`runApplyConfig` 의 catch 가 `dispatch({type:"ERROR", message: errMessage(e)})` 를 한다.
두 가지를 동시에 지킨다 — `errMessage()` 를 **통과**시켜 문구 정책 SoT(`4-security §5`)를
우회하지 않고, 상태를 전이해 `streaming` 고착을 만들지 않는다.

**뮤테이션**: `dispatch` 를 종전의 warn-only 로 되돌리면 **3건 RED**(신규 회귀 + 기존 2건).
그중 신규 회귀는 `ended` **이면서** `error` 가 채워졌는지를 함께 단언한다 — `ended` 단독으로는
정상 종료와 구분되지 않는다.

> **이 검증에서 내가 두 번 틀렸고 둘 다 실측이 뒤집었다.**
> 1. 처음엔 "내 회귀가 vacuous 하다" 고 판단했다 — 뮤턴트에서 통과했기 때문이다. 그런데 그
>    실행에서 **뮤테이션이 파일에 적용되지 않은 상태**였다. `grep` 으로 치환을 확인한 뒤 다시
>    돌리니 RED 였다. 뮤테이션 결과를 읽기 전에 **뮤턴트가 실제로 앉았는지부터** 봐야 한다.
> 2. `ERROR` 가 `phase: "error"` 로 간다고 가정하고 단언했는데, 리듀서는 `phase: "ended"` +
>    `error` 로 매핑한다(위젯엔 `error` phase 가 없다). 가정을 코드로 확인하지 않았다.

## C2 — Gate C 빌드 실패 → **고침**

`spec_impact` 를 리스트로 선언했다(`3-auth-session.md`, `0-overview.md` — 이 작업이 실제로 건드린
spec 두 개). 함께 `worktree:` 도 `(unstarted)` → 실제 값으로 고쳤다.

**가드가 실제로 그것을 잡는지 확인**: 필드를 빼면 `spec-plan-completion.test.ts` 가
`declares spec_impact` 에서 RED, 넣으면 814/814 GREEN. `plan-lifecycle.md` 가 "spec-only PR 은
unit 을 안 돌려 이 회귀가 main 에 샌다" 고 경고하는 자리라 **그 테스트만 따로 돌려 확인**했다.

## W1·W5 — SSE `onError` → **고침(둘 다 한 번에)**

`e.type` 은 **스펙상 항상 `"error"`** 라 내 직전 fix 는 "토큰을 안 찍는다" 는 목적만 달성하고
로그의 존재 이유를 없앴다. `readyState`(0 재연결중 / 1 열림 / 2 포기)로 바꿨다 — URL 도 토큰도
담지 않으면서 "일시적 끊김인가 확정 실패인가" 를 가른다. 인라인 표현식은 `sseErrorDetail`
헬퍼로 뽑아 W5 도 같이 닫았다.

## W2·W6·W7 — `applyConfig` 경로 회귀 부재 → **고침**

세 진입점 중 그곳만 비어 있었다(리뷰어 3인 독립 수렴). 회귀 하나로 **두 축을 함께** 고정한다 —
토큰 미노출(`token=<redacted>` 존재 + 원 토큰 부재)과 `ended`+`error` 전이. W6·W7 은 같은 공백을
다른 각도에서 말한 것이라 함께 닫힌다.

## W3 — 정정의 사본을 빠뜨렸다 → **고침**

cross-origin 위협 모델 정정을 `eia-client.ts` JSDoc 에만 하고 테스트 파일 주석의 사본을 그대로
뒀다. **정정조차 한쪽만 한 것**이라, 그 사실 자체를 주석에 적어 남긴다.

## W4 — CHANGELOG → **고침**

로그 redaction 3곳 · SSE `onError` sanitize · unhandled rejection 닫힘을 항목으로 추가하고,
**위협 모델이 좁다는 사실도 함께** 적었다(cross-origin iframe 이라 호스트 스크립트는 못 읽는다).
넓게 적으면 다음 사람이 과잉 방어를 정당화한다.

## 검증

- 위젯 vitest **436 passed** (23 files, +1).
- Gate C(frontend `spec-plan-completion`) **814 passed**; frontend 전체 **5927 passed**.
- harness/doc guards **1032 passed / 1128 subtests**.
- `tsc --noEmit` **0 errors**.
- 뮤테이션 **누적 15종** — 이번 라운드 1종 추가(RED 3건 유발), 전부 확인.
