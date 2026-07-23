# 테스트(Testing) 리뷰 — router_safety 정책표 24→44 정정 + 미러 drift 가드 (+후속 CRITICAL 수정 2건)

이 changeset 은 3개 커밋(`5d62e5979` 원본 → `bd7213457` CRITICAL fix → `7e7bc8e1e` 로스터 sweep)의 누적 diff다.
직전 리뷰 세션(`review/code/2026/07/23/16_30_52`)에서 testing 리뷰어가 지적한 CRITICAL("신규 가드가
README 의 stale `24 확장자` 를 못 잡음")은 `RESOLUTION.md` 대로 실제로 반영되어 있음을
`git log`/`git diff origin/main`/전체 하니스 스위트 실행으로 직접 재검증했다(446 green, 회귀 없음).
그 위에서 독립적으로 새 mutation 을 가해 남은 갭을 찾았다.

## 발견사항

- **[WARNING]** `test_router_safety_policy_doc.py` 의 신규 가드가 **README 정책표의 "Forced reviewers" 컬럼 내용**은 어떤 행에서도 실제 규칙과 대조하지 않는다 — 방금 고친 것과 같은 클래스의 drift 가 이 컬럼에서는 여전히 무방비
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:170-179`(`test_table_row_names_the_real_forced_reviewers` — `self.doc` 만 검사), `.claude/tests/test_router_safety_policy_doc.py:260-267`(`test_readme_table_has_the_same_rows_as_the_docstring` — `self.readme` 는 **행 개수만** 비교)
  - 상세: `_reviewers_named_in()`(README 셀 텍스트에서 실제 로스터와 교집합해 reviewer 이름 추출)은 이 파일 전체에서 `self.doc`(docstring, 영문 표) 에만 적용되고 `self.readme`(README, 한글 표) 에는 단 한 번도 적용되지 않는다. `test_readme_table_has_the_same_rows_as_the_docstring` 는 "README calls itself a mirror; a rule added to one table only would otherwise sit unnoticed" 라고 docstring 에 적어두지만 실제로는 **행 개수(len)** 만 비교하고 각 행의 "Forced reviewers" 셀 텍스트는 비교하지 않는다. 즉 README 표의 어느 행이든 (a) reviewer 이름이 통째로 다른 것으로 바뀌거나 (b) 목록에서 하나가 조용히 빠져도, 행 개수·확장자 개수·확장자 목록이 그대로인 한 12개 테스트 전부 green 이다.
    실측(임시 파일로 검증 후 원상복구, 저장소에 diff 없음 확인 완료): README 68행의 `**security, requirement, scope, side_effect, maintainability, testing**` 에서 `testing` 하나만 지운 뮤턴트를 적용하고 `python3 -m unittest discover -s .claude/tests -p 'test_router_safety_policy_doc.py' -v` 를 재실행한 결과 **12개 테스트 전원 `ok`** — 이 PR 이 막으려던 것과 정확히 같은 성격의 미검출 drift(정책적으로 더 심각: 이 컬럼은 "reviewer 가 실제로 강제 실행되는지" 를 사람이 읽고 신뢰하는 필드다)가 여전히 가능함을 직접 확인했다.
    RESOLUTION.md 가 보고한 mutation 세트("표 행에서 reviewer 누락")는 `_RULES`/`_SOURCE_FORCED_REVIEWERS` 와 대조되는 **docstring(`self.doc`) 쪽** 행 변형만 겨냥한 것으로 보이며(코드상 그 경로만 존재), README 쪽 reviewer-이름 변형은 애초에 mutation 후보에 없었다.
  - 제안: `test_table_row_names_the_real_forced_reviewers` 와 대칭인 README 버전(README 의 source-code 행 셀을 `_reviewers_named_in` 으로 뽑아 `_SOURCE_FORCED_REVIEWERS` 와 비교)을 추가하거나, `test_docstring_table_names_exactly_the_reviewers_the_rules_force` 를 `self.readme` 에도 동일하게 적용해 두 문서 모두에서 "표가 광고하는 reviewer 집합 == 실제 규칙이 강제하는 집합" 을 검사할 것. 최소한 `test_readme_table_has_the_same_rows_as_the_docstring` 의 docstring 문구("a rule added to one table only would otherwise sit unnoticed")를 "행 개수만 비교함" 으로 낮춰 테스트가 실제로 보장하는 범위와 이름/설명을 일치시킬 것(현재는 이름이 실제 커버리지보다 넓은 것을 약속 — 이번 changeset 이 고친 CRITICAL 의 근본 원인이었던 "주장 > 구현" 패턴의 재발).

## 검증한 항목 (문제 없음 — 직접 재현)

- `python3 -m unittest discover -s .claude/tests -p 'test_router_safety_policy_doc.py' -v` → 12/12 green, `python3 .claude/tests/test_router_safety_policy_doc.py` 로 discover 없이 단독 실행도 동일하게 통과 (테스트 용이성 양호 — 하드코딩된 discover-only 의존 없음).
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` (하니스 전체) → **446 green**, RESOLUTION.md 의 "446 green" 주장과 일치, 이번 changeset 으로 인한 회귀 없음.
- 직전 리뷰의 CRITICAL(README `24 확장자` stale)은 `git diff origin/main -- .claude/skills/code-review-agents/README.md` 로 실제 "44 확장자" 반영 확인, `test_readme_table_states_the_real_extension_count`/`test_no_stale_extension_count_survives_anywhere` 신설도 소스에서 직접 확인.
- `test_every_documented_reviewer_count_matches_all_agents` 의 `assertGreaterEqual(seen, 6, ...)` — 실제 `grep` 으로 4개 파일에서 "디폴트 N개"/"default N" 패턴이 정확히 6곳 매칭됨을 확인(SKILL.md ×2, README.md ×1, router_safety.py ×2, review-router.md ×1) — sweep 이 실제로 6곳을 보고 있음을 검증(플로어 조건이므로 향후 매칭 수가 6 초과로 늘어도 통과하지만, 6 미만으로 줄면 실패 — 의도한 "무력화 감지" 로 동작).
- Mock 미사용, 실제 subprocess + 실제 파일 읽기 — `_lib` 이름 충돌을 우회하는 정당한 설계(같은 스위트의 `test_router_decision_trust.py` 와 동일 패턴). 테스트 격리도 양호(class-level `setUpClass` 캐시는 read-only 라 순서 의존성 없음, 파일시스템 변경 없음).
- 미사용 `from pathlib import Path` import — 직전 리뷰 INFO 로 지적된 것이 이번 changeset 에서 실제로 제거되어 있음을 소스에서 확인(회귀 아님).
- 정책표 9(현재 실측 10)개 행 중 일부만 `_RULES` 와 개별 대조된다는 직전 WARNING 은 `test_docstring_table_has_a_row_per_rule`(행수==`len(_RULES)+2`) + `test_docstring_table_names_exactly_the_reviewers_the_rules_force`(집합 수준 대조)로 완화되어 있음 — 행별 정밀 대응은 여전히 없지만 이는 RESOLUTION 에서 "산문 매칭은 추측" 이라는 근거로 의도적으로 좁힌 것이고 문서화되어 있어 새 지적 대상 아님.

## 요약

직전 세션(16_30_52)에서 testing 리뷰어가 낸 CRITICAL(신규 가드가 README 의 stale 확장자 개수를 못 잡음)은 RESOLUTION 대로 정확히 반영되어 있고, 전체 하니스 스위트 446건도 회귀 없이 green 임을 독립적으로 재현했다. 다만 같은 changeset 을 처음부터 다시 살펴보며 라이브 mutation 을 가한 결과, **"Forced reviewers" 컬럼(어떤 reviewer 가 강제되는지) 자체는 README 쪽에서 전혀 검증되지 않는다**는 새로운 갭을 발견했다 — README 표 어느 행의 reviewer 이름을 틀리게 바꿔도(행 개수·확장자 개수는 그대로 두고) 12개 테스트가 전부 통과함을 직접 실행으로 증명했다. 이는 이번 PR 이 막으려 한 결함(주장한 커버리지 > 실제 커버리지)의 동일 패턴이 다른 필드에 잔존하는 것이며, README 는 로직이 아니라 "사람이 신뢰하는 정책 문서" 이므로 reviewer 이름이 틀리게 표기되면 운영자가 라우팅 안전망을 오신뢰할 수 있는 실질적 리스크가 있다. 나머지(테스트 존재·격리·가독성·mock 미사용·회귀 안전성)는 모두 양호하다.

## 위험도
WARNING
