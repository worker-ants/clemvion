# RESOLUTION — 라운드 1 (`review/code/2026/09/12/20_01_18`)

**판정**: Critical 0 · WARNING 4. Critical 0.

**해소 커밋**: `291a6d764`

| # | 지적 | 처분 |
|---|---|---|
| 1 | SPEC-DRIFT — *"`swagger.md §5-4` 가 두 축을 요구한다"* 는 서술이 과장 | **참이었다** (그 문서에 `ParseUUIDPipe` 0건). 가드·spec 주석 2곳의 출처를 갈랐고, §5-4 확장은 조건 1 미충족이라 planner 항목으로 분리 등재 |
| 2 | vacuity 카운터가 판정 순회를 재구현 | `scanUuidParams` 가 `{violations, scanned}` 를 한 루프에서 반환하도록 통합, `countIdShapedParams` 제거 |
| 3 | 면제가 런타임 축까지 끄는 방향의 캐너리 없음 | `excludedPipeless` fixture + 단언 추가 — 뮤턴트 M7 이 RED 로 그 방향을 고정 |
| 4 | 500→400 은 관측 가능한 변경인데 CHANGELOG 누락 | 선례(`raw 23505 가 500 이었다`) 형식으로 항목 추가 |

INFO 2건(텍스트 부분일치 한계 · fixture 의 스캔 루트 서술 부정확)도 같은 커밋에 반영.

---

검증: 각 라운드마다 `.claude/tools/run-test-all.sh lint unit build e2e` ALL PASS
(backend 460 suites · 9,642 tests, e2e 305 tests).
