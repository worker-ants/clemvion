# RESOLUTION — 05_15_26 (종결)

리뷰 결과: RISK=MEDIUM · Critical 0 · WARNING 3

## W1 — `spec_impact` 가 spec 밖 파일을 통과시켰다 (testing) → **반영**

**내가 이번 라운드에 만든 구멍이다.** 직전 라운드에서 존재 검사를 "존재하는 것" → "존재하는
**파일**" 로 조였는데 **"spec 파일" 까지는 가지 않았다.** 실측:

| `spec_impact` 원소 | 종전 |
|---|---|
| `CLAUDE.md` | **통과** |
| `codebase/frontend/package.json` | **통과** |
| `PROJECT.md` | **통과** |

이 게이트의 존재 이유가 "**어느 spec 을** 건드렸는지 기록하게 한다" 인데 그걸 그대로
비껴간다. `p.startsWith("spec/")` 제약 + "실재하지만 spec 밖" 회귀 fixture 3건 추가.
뮤테이션 S1 RED.

실데이터 안전 확인: 스위트 GREEN — 완료 plan 233건의 `spec_impact` 리스트가 제약을 그대로
통과한다(정규식으로 세는 대신 게이트 자신이 답을 냈다).

## W2 — `rawScalar` 가 블록 스칼라 안의 같은 이름 줄을 먼저 잡았다 (testing) → **반영**

`^[ \t]*${key}:` 라 **들여쓴 줄도 매치**했다. 앞선 필드의 multi-line 값(`|`/`>`) 안에
`started:` 로 시작하는 줄이 있으면 진짜 필드보다 **먼저** 잡히고, 그 값이
`isIsoDate`/`isGateCEnforced` 로 흘러가 Gate C 판정을 오염시킨다.

frontmatter 최상위 키는 항상 0열이므로 `^${key}:` 로 좁혔다 — 잃는 것이 없다. 그리고
**export 된 함수 중 유일하게 직접 테스트가 없었다**는 지적도 맞아 전용 `describe` 추가
(따옴표 제거 · 부재 시 null · 블록 스칼라 함정). 뮤테이션 S2 RED.

## W3 — Gate C 판정 로직이 `*.test.ts` 안에 산다 (maintainability) → **등재**

`isGateCEnforced`·`hasMalformedStarted`·`hasValidSpecImpact`·`danglingSpecImpact`·
`makeSpecExists` 가 `spec-plan-completion.test.ts` 에 있어, 다른 스크립트가 재사용하려면
테스트 파일을 import 해야 한다.

**등재로 처리한 근거** — 이 PR 은 그 파일의 판정을 *고쳤을* 뿐 **위치를 만들지 않았다**
(선재 배치, `origin/main` 에서도 같은 자리). 파일 전체 이동은 Gate C 의 소비처·`code:`
등재·미러 문서를 함께 건드리는 별 작업이다. 다만 이 PR 이 "판정은 `plan-scan.ts` 로"
원칙을 세웠으므로 **그 원칙의 미적용 지점**으로 남는 것이 맞아
[`docs-guard-walker-dedup.md`](../../../../../../plan/in-progress/docs-guard-walker-dedup.md)
에 근거와 함께 적었다.

## INFO 12건

조치 불요. #1(`findUnparseablePlans` 가 `parsedPlans` 를 재사용하지 않고 다시 walk)은
의도적이다 — 판정을 `plan-scan.ts` 순수 함수로 두어야 합성 fixture 로 겨눌 수 있고(R3 RED),
`parsedPlans` 를 쓰면 그 관측이 사라진다. I/O 2배는 plan 수백 건 규모에서 무시 가능하다.

## 종결 판정

이 라운드로 티켓을 닫는다. 이번 WARNING 셋 중 둘은 **직전 라운드의 내 수정이 만든/남긴
구멍**이었고 둘 다 뮤테이션으로 관측을 확인했다. 나머지 하나는 선재 배치라 등재가 맞다.
더 도는 것은 `spec-plan-completion.test.ts` 의 인접 결함을 계속 흡수하는 일이 되는데,
그 파일은 이 PR 의 원래 대상이 아니었다.

## 검증

- 문서 가드 19파일 / **2873 tests PASS** · tsc clean
- 뮤테이션 S1·S2 RED
- e2e **PASS** (300s / 264)
