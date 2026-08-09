# RESOLUTION — 04_22_01

리뷰 결과: RISK=LOW · Critical 0 · WARNING 5 · reviewer 14명 전수

## W1 — 통합해 놓고 주석은 "아직 독립 구현" 이라 뒀다 (reviewer 5명 중복 지적) → **반영**

같은 커밋에서 `collectCompletePlans` 를 `collectCompletePlanMarkdown` 위임으로 바꿔 놓고
`plan-scan.ts` 헤더는 "Gate C 의 것은 **아직 독립 구현으로 남아 있다**" 를 그대로 뒀다.
**이 PR 이 게이트를 세운 결함 클래스의 네 번째 재현**이다(앞선 셋: 코드 주석의 plan 포인터,
`plan-lifecycle.md:83` 상수 소재, `worktree-policy.md` 폐기 기능).

정정: "plan 계열 네 벌이 이 구현 하나로 모였다 / 남은 둘은 `spec-links.ts` 안이라 이 파일
범위 밖" 으로 현재 상태를 정확히 서술.

## W2 — 컷오프 판정이 인라인 복제였다 (requirement) → **반영**

`enforced` 필터가 `isGateCEnforced` 를 안 쓰고 같은 식을 인라인으로 갖고 있었다. 그 predicate
는 단위 테스트에서만 불려 **실제 게이트와 갈릴 수 있는 상태**였다 — 이 PR 이 반복해 경계하는
판정 이중화 그 자체다. 선재이지만(`origin/main` 98행에서 확인) `developer/SKILL.md §ISSUE
FIX 정책` 대로 조치했다. 뮤테이션 N2 RED.

## W3 — Gate C 의 fail-open 구멍 (requirement) → **반영 + 관측 가능하게**

`spec_impact` dangling 검사가 `typeof p === "string" && !exists(...)` 라 **문자열이 아닌
원소를 조용히 통과**시켰다. `spec_impact: [123]` 이 게이트를 그냥 지나간다 — "선언은 있는데
무엇을 건드렸는지 아무도 모르는 상태" 를 막는 게이트라 그 구멍이 곧 게이트의 부재다.

**그리고 여기서 뮤테이션이 내 수정을 한 번 반려했다.** 고친 뒤 되돌리는 뮤턴트를 돌렸더니
**생존**했다 — 실제 강제 경로는 실저장소 데이터만 보는데 거기엔 비-문자열 `spec_impact` 가
없기 때문이다. 고친 것은 맞지만 **증거가 없는 상태**였다. `danglingSpecImpact(root, impact)`
순수 함수로 빼고 합성 fixture(`[123]`·`[null]`·중첩 배열·존재하지 않는 경로)로 겨눴다.
추출 전 GREEN → 추출 후 **RED**.

> **부수 — 거짓 RED 를 한 번 만들 뻔했다.** 첫 측정에서 N1 이 RED 로 나와 "관측된다" 고
> 읽을 뻔했는데, 셸 인용이 `&&` 를 `\&\&` 로 넣어 **구문 오류로 죽은 것**이었다. 이후
> 뮤턴트에 `tsc --noEmit` 을 먼저 태워 **유효한 뮤턴트인지 확인**하고 나서 스위트를 돌리도록
> 하네스를 바꿨다. 유효성 검증 없는 뮤테이션은 통과율을 부풀린다.

## W5 — `parseFrontmatterSafe` 커버리지가 우연에 기대고 있었다 (testing) → **반영**

캐시 우회 계약이 **다른 describe 블록의 바이트 동일 fixture + 선언 순서**로만 관측됐다 —
fixture 문자열이나 블록 순서가 바뀌면 신호 없이 커버리지가 사라진다. 계약을 직접 겨누는
독립 테스트 3건 추가(같은 깨진 문자열 연속 3회 호출 → 전부 null · 유효 문서의 `data`/`block`
· frontmatter 없는 문서는 실패가 아니라 빈 값).

## W4 — Gate C 이중 파싱 (performance) → **등재**

현재 `enforced` 가 비어 있어(grandfather cutoff) 실비용 0이고, cutoff 이후 작업이 쌓이면
그 수만큼 2배가 된다. 선재 구조이고 이번 diff 가 만든 것이 아니다 →
[`docs-guard-walker-dedup.md`](../../../../../../plan/in-progress/docs-guard-walker-dedup.md).

## INFO 13건

조치 불요. #1(`rawScalar` 정규식 키 이스케이프)은 호출부가 리터럴 하나뿐이라 도달 불가,
#5(`startedDate` 의 달력 유효성 미검증)는 테스트로 의도 문서화된 fail-open 이라 판정 변경이
필요하고 그건 이 PR 범위 밖이다.

## 검증

- 문서 가드 19파일 / **2860 tests PASS** · tsc clean
- 뮤테이션 — 기존 14 RED/생존 0 + 이번 라운드 N1/N2/N3 **전부 RED**(N1 은 추출 후)
- e2e **PASS** (266s / 264)
