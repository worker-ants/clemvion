# RESOLUTION — `review/code/2026/09/25/13_41_01` (1라운드, `--branch origin/main`)

**Critical 1 · Warning 0 · INFO 5.** forced 1/1(documentation). 리뷰 동안 워크트리 뮤테이션 없음.

## 조치 항목

| SUMMARY # | 지적 | 조치 | commit |
| --- | --- | --- | --- |
| Critical 1 (documentation) | `#1263` 백필의 ratchet baseline «51건 · 14파일» 은 그 PR 리뷰 1라운드가 «52/15» 로 정정한 중간값이다(머지된 `scripts/frontend-typecheck-baseline.json` = 52/15) | CHANGELOG · plan 두 곳을 **머지 시점 52건 · 15파일**로. **같은 형태를 전수로 다시 훑었다** — 인용한 수치마다 그 PR 본문 전체에서 뒤이은 정정이 있는지(`scratchpad/bf_numcheck.py`): `#1275` 의 «135개» 도 그 PR 2라운드가 동명 필드 오탐 20건을 빼 **115** 로 바꿨고 **술어의 정의**(«어느 엔티티에서도 non-null 이 아닌 이름만»)도 바뀌었다 — 둘 다 고쳤다. 나머지(18 · 6/8 · 104 · 여덟 · 아홉 · 다섯 · 536 · 900)는 정정 없이 유지됨을 확인. 기준 ① 의 «main 대비» 를 «판정과 수치는 main 대비 · 머지 시점» 으로 넓혔다 — 한 PR 에서 같은 형태가 두 번 나왔다 | 조치 커밋 |
| INFO 1 · 2 | plan 체크박스 진행 중 · 사전 검토 W 반영 확인 | 마무리 커밋에서 이동 · 체크 |
| INFO 3 · 5 | 판정표 셀의 취소선 이력이 길다 · 행 밀도 편차 | 두지 않는다 — 번복 이력을 셀에 남기는 것이 이 저장소 plan 관례(취소선 + 근거)이고, 판정이 뒤집힌 행이 긴 것은 정보량 차이다 |
| INFO 4 | 헤딩 «자리 넷» 인데 PR 은 셋 | 두지 않는다 — 본문 불릿이 넷이고 `#1262` 가 두 불릿에 붙어 있어 대응이 보인다 |

## 교훈 — 이 PR 이 기준에 적은 것을 이 PR 이 밟았다

`#1364` 판정을 뒤집으며 «PR 본문은 그 PR 안의 변화를, CHANGELOG 는 main 대비 변화를 말한다» 를 기준에 적었는데, 그
직후 **수치**에서 같은 실수를 두 번 했다. 판정에만 적용하고 수치에는 적용하지 않았다. 규칙을 적은 자리(판정)와 밟은
자리(수치)가 달라서 스스로 못 봤고, documentation 리뷰어가 머지된 baseline 파일과 대조해 잡았다.

## TEST 결과

- lint · unit · build — **해당 없음**: `codebase/**` 무변경.
- e2e — **면제**: `codebase/**` 무변경(CLAUDE.md §Skill 체계 «harness 변경은 리뷰 게이트가 물지 않는다»).
- 하네스 pytest — 이 PR 은 `.claude/**` 도 건드리지 않는다(문서 · plan 만).

## 다음

CHANGELOG(리뷰한 내용)를 고쳤으므로 선언한 정지 규칙(Critical 0 · Warning 0 · 그 라운드 수정 0건)이 미충족 — 2라운드를 돈다.
