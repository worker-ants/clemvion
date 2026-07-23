# 문서화(Documentation) 리뷰 — router_safety 정책 표 drift 정정 완료 확인 (3커밋 누적)

## 배경

이 changeset 은 `origin/main` 대비 3개 커밋(`5d62e5979` 1차 정정 → `bd7213457` 직전 리뷰 세션(`review/code/2026/07/23/16_30_52`)의 CRITICAL 반영 → `7e7bc8e1e` 동일 결함 클래스 선제 sweep) 의 누적 diff이며, 여기에 직전 리뷰 세션의 산출물(`review/code/2026/07/23/16_30_52/*`) 커밋까지 포함되어 있다. 직전 세션은 "`router_safety.py` docstring 표는 24→44 로 고쳤지만, 스스로 미러라고 선언한 `README.md:68` 은 여전히 24 로 stale, 신규 가드도 그 지점을 검사하지 않는다"는 CRITICAL 을 냈다. 이번 리뷰의 핵심 과제는 그 CRITICAL 이 실제로, 그리고 완전히 해소됐는지 재검증하는 것이다.

## 검증 결과 (실측)

- `.claude/skills/code-review-agents/README.md:68` — 실제 워크트리에서 `Read` 로 직접 확인: `| 소스 파일 (44 확장자) | ...` — 정정 완료.
- `.claude/skills/code-review-agents/lib/router_safety.py:36` — `| Source-code file (44 extensions below) | ...` — 정정 완료.
- `python3 -m unittest discover -s .claude/tests -p 'test_router_safety_policy_doc.py' -v` 직접 실행 — 12개 테스트 전부 `ok`, 직전 CRITICAL 의 원인이었던 `test_readme_table_states_the_real_extension_count`(README 표 카운트를 `len(_SOURCE_CODE_EXTENSIONS)` 와 대조)가 실제로 존재하고 통과함을 확인.
- `grep -rn "24.*확장자\|24 extensions"` 를 `review/code/2026/07/23/16_30_52/`(이력 아티팩트, 의도적으로 과거 값을 그대로 인용) 밖 전체 레포에 대해 재실행 — 살아있는 문서/코드 어디에도 stale "24" 잔존 없음.
- `.claude/tests/README.md:37` 신규 행 문구도 실제 커버리지에 맞게 정정되어 있음을 확인: "the source-extension count **in each document's own table**" 로 바뀌어, 직전 세션이 지적했던 "both docs" 오버클레임(실제로는 README 표 카운트를 검사하지 않으면서 "both docs" 라고 주장)이 제거됨.
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 전체 스위트 — `Ran 446 tests ... OK`. `RESOLUTION.md`(`review/code/2026/07/23/16_30_52/RESOLUTION.md`)가 기록한 "harness suite 446 green" 수치와 정확히 일치 — 리뷰 아티팩트에 남은 수치 서술도 실측과 어긋나지 않음.
- 미사용 `from pathlib import Path` — 실제 파일에서 제거 확인(`grep "^import\|^from"` 결과에 없음). 직전 세션 INFO 1 반영 확인.

**결론: 직전 세션의 CRITICAL·WARNING 1·WARNING 2 는 모두 코드·문서·테스트 3자 일치로 실측 해소되었다.**

## 발견사항

- **[INFO]** 신규 테스트 메서드 docstring 의 "재조준 탐지" 서술이 집합(합집합) 수준 불변식의 한계를 완전히 반영하지 못함
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:240` (`test_docstring_table_names_exactly_the_reviewers_the_rules_force`)
  - 상세: 이 메서드의 docstring(게이트 241~244행)은 "Catches a rule re-targeted to a different reviewer while the table kept the old name" 라고 단정적으로 서술한다. 그러나 실제 구현은 `tabled`(표 전체 행에서 나온 reviewer 이름의 합집합)과 `reachable`(`_RULES`+`_SOURCE_FORCED_REVIEWERS` 전체에서 나온 reviewer 의 합집합)을 **집합 단위로만** 비교한다(게이트 245~258행). 어떤 규칙이 reviewer A→B 로 재조준됐는데 (a) 표가 갱신되지 않고 여전히 A를 표시하고, (b) A 가 다른 행에서 여전히 reachable 로 남아 있으며, (c) B 가 이미 다른 행에서 tabled 로 존재하는 경우 — 합집합이 양쪽 다 변하지 않아 이 테스트는 여전히 green 을 낸다. 같은 파일의 `_policy_rows` docstring(게이트 187~193행)은 "행↔`_RULES` 매칭을 산문으로 하는 건 추측이라 집합/개수 수준 불변식만 건다"고 이미 이 트레이드오프를 정직하게 인정하고 있어 설계 의도 자체는 문제가 아니다. 다만 바로 위 테스트 메서드의 docstring 문구만 "재조준을 잡는다"고 무조건적으로 단언해, 두 docstring 사이에 커버리지 범위에 대한 미묘한 과장/불일치가 있다.
  - 제안: 해당 테스트 docstring 을 "표에 등장하는 reviewer 집합과 실제 규칙이 강제할 수 있는 reviewer 집합이 일치하는지(전형적인 추가/삭제/오탈자성 재조준은 잡지만, 이미 다른 행에 존재하는 reviewer 로의 재조준은 놓칠 수 있음)" 정도로 완화하거나, `_policy_rows` 의 기존 트레이드오프 설명을 참조하도록 링크. 기능 수정은 불필요 — 순수 주석 정확성 사안.

- **[INFO]** 직전 리뷰 세션 산출물(`review/code/2026/07/23/16_30_52/*` 9개 파일: RESOLUTION.md · SUMMARY.md · meta.json · `_retry_state.json` · reviewer 7종 `.md`)이 이번 커밋 범위에 포함
  - 위치: `review/code/2026/07/23/16_30_52/` 디렉토리 전체(신규 파일)
  - 상세: `CLAUDE.md`의 "코드 리뷰 산출물" 저장 규약(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`, gitignore 대상 아님, SUMMARY·RESOLUTION 도 커밋)에 정확히 부합하며, 이 세션이 바로 이번 fix 커밋들의 근거 문서이므로 함께 커밋되는 것이 관례다. 문서화 관점에서 결함 아님 — 참고 기록.
  - 제안: 조치 불요.

## 문서 품질 확인 (모범적인 부분)

- `test_router_safety_policy_doc.py` 모듈 docstring(게이트 1~28행)이 두 차례의 실측 miss 이력(24 vs 44, "both docs" 오버클레임)과 그 발견 세션 경로(`review/code/2026/07/23/15_59_54`, `16_30_52`)를 구체적으로 인용해 사후 추적성이 매우 좋다 — 이번 실측으로 두 인용 모두 저장소 상태와 일치함을 확인.
- `.claude/tests/README.md:37` 문구가 실제 구현 범위(6개 assertion 클래스, "each document's own table" 별도 검사)를 정확히 반영하도록 갱신됨.
- README/CHANGELOG/API 문서/설정 문서/예제 코드 — 이번 변경은 순수 harness 내부 정책 문서 정정 + 회귀 가드 테스트이며 신규 기능·API·환경변수·공개 인터페이스 변경이 없어 해당 항목들은 대체로 적용 대상 아님.

## 요약

직전 세션(`review/code/2026/07/23/16_30_52`)이 CRITICAL 로 지적한 "README.md:68 이 여전히 24 확장자로 stale, 신규 가드도 이를 검사하지 않음" 문제는 이번 changeset 에서 완전히 해소되었다 — `Read`로 실물 확인, `python3 -m unittest`로 12개 신규 테스트 + 전체 446개 스위트 실행 결과 모두 정상 통과함을 직접 재현해 검증했다. `.claude/tests/README.md`의 신규 행 문구도 실제 커버리지에 맞게 정정되어 더 이상 과장된 "both docs" 주장을 하지 않는다. 유일하게 남은 것은 신규 테스트 메서드 하나의 docstring이 자신의 집합 기반 검증 한계(재조준이 기존 reviewer 로 향하는 좁은 엣지 케이스는 놓칠 수 있음)를 완전히 반영하지 못하는 사소한 주석 정확성 사안(INFO)뿐이며, 기능적 리스크는 없다.

## 위험도
LOW
