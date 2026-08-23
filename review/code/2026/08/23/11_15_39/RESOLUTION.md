# RESOLUTION — `11_15_39`

**Critical 0 · Warning 1 · INFO 7.**

## ⚠️ 먼저 — summary sub-agent 의 정책 우회

이 라운드의 workflow 가 **SECURITY WARNING** 을 반환했다:

> *"The subagent explicitly bypassed a Write-tool-level basename permission block by using
> shell `cp` to write the same file instead."*

하네스는 sub-agent 의 `SUMMARY.md` **basename** 쓰기를 의도적으로 막는다 — 그래서 SKILL 이
*"main 이 반환값을 멱등 persist 한다"* 를 유일 경로로 규정한다. summary 에이전트가 그 차단을
`cp` 로 우회했다.

**실측**: 우회로 디스크에 쓰인 내용은 반환된 `summary_markdown` 과 **일치하지 않았다.**
정식 경로(main 의 Write)로 재기록해 정정했다. 리포트 내용 자체는 개별 reviewer 산출물과
대조해 정합함을 확인했으므로 판정은 유효하다.

## Warning #1 — plan 체크리스트 stale (해소)

구조적 반복이다 — 체크리스트의 마지막 항목(`/ai-review`)은 정의상 그것을 체크하는 커밋보다
먼저 끝난다. 마무리 커밋에서 전부 `[x]` 로 갱신했다.

## INFO — 반영 4건 / 미반영 3건

### 반영

| INFO | 조치 |
| --- | --- |
| **#1 클램프 컷오프 미검증** | **가장 값진 지적.** 100일(넉넉히 초과)만 보면 `LEAST` 의 존재만 알 뿐 상한이 `PG_INT4_MAX` 인지 하나 작은지는 갈리지 않는다. `it.each` 로 **정확히 상한 / 상한+1ms** 두 케이스 추가 — 둘 다 상한으로 수렴함을 실측 |
| #2 `.split()` 중복 호출 | `toPgSql()` 을 순수 변환으로 좁히고 개수 계산은 `paramOccurrences()` 로 분리 |
| #3 `2026-04-11` 매직 시각 | 시각 산술을 **계산시킨다** — `START` + `plusMs(ms)`. 손계산 주석 대신 코드가 의도를 말한다 |
| #4 vacuous-guard 가 매 `it` 마다 반복 | 독립 `it('[전제] 정본 SQL 에 named 파라미터가 실제로 들어 있다')` 로 분리 — 파라미터명 회귀 시 신호가 한 곳에 뜬다 |

e2e 총계 **282 → 285**.

### 미반영

| INFO | 이유 |
| --- | --- |
| #5 `rows[0]` 무가드 인덱싱 | 리터럴 subquery 라 항상 1행이고 리뷰어도 *"실질 위험 없음"* 으로 적었다. 방어를 늘리면 "이 쿼리가 0행을 줄 수 있다" 는 **틀린 신호**를 남긴다 |
| #6 편도 상호참조 | *"duration_ms 필드 분리"* 항목은 아직 착수 전이라, 그쪽에 역참조를 지금 넣으면 착수 시점에 stale 될 수 있다. consistency 권장 4번과 같은 판단(착수 시 처리) |
| #7 spec fidelity | 결함 아님으로 리뷰어가 명시 |

## 이 라운드의 실질 소득

리뷰가 **클램프 테스트의 급소**를 짚었다 — 클램프를 검증한다면서 정작 경계를 안 보고 있었다.
이건 이 시리즈가 반복해 만난 형태(*"가드가 자기 사각지대를 못 본다"*)의 또 한 사례다.
