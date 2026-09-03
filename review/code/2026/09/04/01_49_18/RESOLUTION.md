# RESOLUTION — repo-guard walker 통합 + 낡은 spec 캐스트 가드 리뷰 1R

대상 SUMMARY: 위험도 **MEDIUM** · Critical **0** · Warning **4** · INFO 9
reviewer 7명(전원 forced) 결과 확보. **Warning 4건 전부 조치.**

## W1 (testing) — 내가 "원리적으로 불가능" 이라 봉인한 커버리지가 실제로는 열려 있었다

정렬 회귀를 이 환경에서 못 잡는다고 판단하고, 그 판단을 **docstring 에 못 박았다.**
리뷰어가 실측으로 반증했고, 나도 직접 재현해 확인했다.

내 근거는 *"정렬은 서브트리를 연속으로 유지하고 DFS 도 그러므로 둘이 같다"* 였다.
연속성 부분은 맞다. 그런데 **형제 파일과 그 서브트리의 상대 위치가 뒤집힌다**:

| | 순서 |
|---|---|
| DFS | `… nested/b.ts, nested/deep/c.ts, nested-sibling.ts` |
| 정렬 | `… nested-sibling.ts, nested/b.ts, nested/deep/c.ts` |

`-`(0x2D) 가 `/`(0x2F) 보다 앞서기 때문이다. 픽스처에 `nested-sibling.ts` **한 줄**을
넣으니 `sort()` 뮤턴트가 죽는다 — **예측 RED, 실측 2 failed**(초판 예측은 GREEN 이었고
그게 틀렸다).

> **이게 이번 라운드에서 가장 비싼 종류의 오류다.** 틀린 코드는 게이트가 잡지만,
> "원리적으로 불가능" 이라 적힌 문장은 **다음 사람의 조사를 멈춘다.** 그 문장을 믿었으면
> 닫을 수 있는 갭이 영구히 열려 있었을 것이다.

## W2 (testing) — 재사용을 이유로 export 해 놓고 테스트가 없었다

`stripLiterals` 는 "다음 가드도 쓴다" 를 존재 이유로 export 했는데 직접 테스트가 0개였다.
자매 `stripComments` 는 6개를 갖는다 — **이 모듈이 애초에 막으려던 비대칭**이다.

전용 테스트 7건 추가: 따옴표 보존 · 템플릿 다중 줄 · **이스케이프 따옴표에서 조기 종료
안 함** · 리터럴 밖 불변 · 다중 리터럴 · **알려진 한계(`${}` 중첩 백틱)를 테스트로 고정**.
마지막 것은 고칠 버그가 아니라 경계라, 누군가 없애면 docstring 도 함께 고치라는 신호다.

## W3 (maintainability) — 사본 5개를 없애는 diff 안에서 새 사본을 만들었다

`withFiles` 와 기존 `withFixture` 의 골격(`mkdtempSync`→write→`try/finally` rmSync)이
같았다. 지적이 정확하다. `withFiles` 하나로 합치고 `withFixture` 는 그 얇은 래퍼로 뒀다
(단일 파일 호출부 7곳은 그대로 읽힌다).

## W4 (documentation) — 삽입 위치가 남의 JSDoc 을 orphan 으로 만들었다

`stripLiterals` 를 `countCalls` 의 JSDoc 과 선언 **사이**에 끼워 넣어, 그 주석이
`stripLiterals` 위에 붙고 `countCalls` 는 무문서가 됐다. 선언 위로 되돌렸다.

## INFO — 하나만 조치 없이 기록한다

**INFO#1**(reviewer 3명 공통): `WIDENED_DECL` 이 추가 데코레이터를 **1개까지만** 허용한다
(`?` 이지 `*` 가 아니다). 필드에 데코레이터가 2개 이상 스택되면 조용히 누락된다 —
**위음성 방향**이다. 저장소 전수에 그런 조합은 없다(실측). 지금 정규식을 넓히면 검증
없이 표면만 키우는 것이라, **한계를 docstring 에 명시**하는 쪽을 택했다. 그 조합이
실재하는 날 이 주석이 판단 기록이 된다.

나머지 8건은 "확인 결과 정상" 이거나 이미 문서화된 의도적 결정이다(`.d.ts` 필터 축소 ·
`stripComments` export 확대 · blast radius · 래퍼 이름 4종 잔존 등).

## 검증

lint **PASS** · unit backend **9,273**(443 suites) · build **PASS** · e2e **292** ·
ratchet **197/36** · `tsc` 비-spec **0** · 가드 8스위트.
