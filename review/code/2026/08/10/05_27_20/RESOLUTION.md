# RESOLUTION — 05_27_20

리뷰 결과: RISK=LOW · Critical 0 · WARNING 2 (+ SPEC-DRIFT 1)

## W1 — `spec/` 접두 검사가 `..` 로 뚫렸다 (testing·requirement·side_effect 3중 지적) → **반영**

**직전 라운드에 내가 넣은 가드가 같은 클래스로 다시 뚫렸다.** 실측:

| `spec_impact` 원소 | `startsWith("spec/")` | `path.join` 정규화 | 종전 |
|---|---|---|---|
| `spec/../CLAUDE.md` | true | `CLAUDE.md` | **통과** |
| `spec/conventions/../../PROJECT.md` | true | `PROJECT.md` | **통과** |

문자열 접두 검사는 **경로에 대한 술어로 충분하지 않다** — 정규화 뒤에 물어야 한다.
`path.resolve` 후 `spec/` 하위인지 재검증하고, 회귀 fixture 3건(빠져나가는 두 형태 +
되돌아오는 형태)을 고정했다. 뮤테이션 T1 RED.

> **이 PR 에서 다섯 번째 "조이되 끝까지 조이지 않음" 이다.** 앞선 넷: 캐시 우회 4곳 중
> 1곳만 · `isIsoDate` 하드닝을 자매 함수에 미적용 · SoT 정정 시 자매 문서 누락 ·
> 존재 검사를 "파일" 까지만(→ "spec 파일" 아님). 매번 방어를 추가하면서 **그 방어가
> 막으려는 것의 정의를 한 칸 좁게** 잡았다. 이번에는 "spec 접두 문자열" 과 "spec 하위
> 경로" 사이에서 밀렸다.

## W2 — `rawScalar` 가 `key` 를 정규식에 그대로 삽입 (maintainability) → **반영**

호출부가 리터럴 하나뿐이라 즉시 위험은 없으나 export 된 범용 유틸이라 메타문자가 오면
**조용히** 다른 키에 매치된다. 이스케이프 + 관측 테스트 2건(`a.b` 가 `axb` 에 매치되지
않는지). 뮤테이션 T2 — 테스트 추가 **전** GREEN → **후** RED.

## SPEC-DRIFT — `plan-lifecycle.md` 의 Gate C 판정 서술이 낡았다 → **반영**

문서가 `ok = (string && 비어있지 않음) || (배열 && length>0)` 이라 적고 있었는데, 그건
문서 오류가 아니라 **당시 실제 동작**이었다 — `spec_impact: maybe` 도 `[123]` 도
`["CLAUDE.md"]` 도 통과했다. 게이트를 계약에 맞춰 조이면서 서술도 함께 정정했다
(`none` 어휘 한정 · 배열 원소는 `spec/` 하위 실존 파일).

## INFO 9건

조치 불요. #2·#3(scope 확장이 의도적인지)은 reviewer 자신이 워크트리명·짝 파일·후속 plan
문서로 확인하고 "의도된 동일 PR 작업" 으로 판정했다.

## 종결

이 라운드로 티켓을 닫는다. Critical 은 15라운드 내내 0이었고, 이번 WARNING 둘은 모두
**내 직전 수정이 남긴 것**이라 그 자리에서 닫는 것이 맞았다. 남은 INFO·구조 항목은
[`docs-guard-walker-dedup.md`](../../../../../../plan/in-progress/docs-guard-walker-dedup.md)
에 등재돼 있다.

## 검증

- 문서 가드 19파일 / **2874 tests PASS** · tsc clean
- 뮤테이션 T1·T2 RED
- e2e **PASS** (304s / 264)
