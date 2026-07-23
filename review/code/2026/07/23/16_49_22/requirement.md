# Requirement Review — router_safety 정책표 24→44 정정 + 미러 drift 가드

## 검증 요약 (사실관계)

- 대상 커밋: `5d62e5979`(원 정정) → `bd7213457`(CRITICAL 재정정: README.md:68) → `7e7bc8e1e`(로스터 개수 sweep 확장).
- 현재 워킹트리 실측: `.claude/skills/code-review-agents/README.md:68` = `44 확장자`, `.claude/skills/code-review-agents/lib/router_safety.py`(docstring 표) = `44 extensions` — 둘 다 실제 `_SOURCE_CODE_EXTENSIONS`(44개, 직접 로드해 확인) 와 일치.
- `.claude/tests/test_router_safety_policy_doc.py` 12 테스트 전부 green. harness 전체 스위트 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → **446 green**, RESOLUTION.md 의 "446 green" 주장과 일치.
- 이전 리뷰 사이클(`review/code/2026/07/23/16_30_52`)의 CRITICAL 1(README stale count) 은 **실제로 반영·해소됨**을 코드로 직접 확인.

## 발견사항

- **[WARNING]** 신규 회귀 가드가 "행(row) 단위" forced-reviewer drift 를 자신의 docstring 이 주장하는 만큼 잡지 못한다 — 아직 남아있는 WARNING 1(이전 라운드) 의 일부 미해결.
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:240` (`test_docstring_table_names_exactly_the_reviewers_the_rules_force`), `.claude/tests/test_router_safety_policy_doc.py:260` (`test_readme_table_has_the_same_rows_as_the_docstring`)
  - 상세: 실측(뮤테이션)으로 확인함 — `router_safety.py` docstring 표의 "Package manifest / lockfile" 행에서 `dependency + documentation` → `dependency` 로 한 단어를 지워도(즉 그 행이 실제로 강제하는 reviewer 가 바뀌어도) 12개 테스트 전부 green 으로 유지된다. 원인: `test_docstring_table_names_exactly_the_reviewers_the_rules_force` 가 **모든 행의 reviewer 이름을 하나의 집합(union)으로 합쳐서** 실제 `_RULES ∪ _SOURCE_FORCED_REVIEWERS` 전체 집합과만 비교한다 — 지운 `documentation` 이 다른 행("Doc file" 행)에도 존재하므로 union 자체는 변하지 않아 탐지되지 않는다. 같은 방식으로 README.md 의 해당 행에서 동일하게 `dependency + documentation` → `dependency` 로 지워도(뮤테이션 재현·복원 완료) 역시 12개 테스트 전부 green 이다 — README 쪽은 애초에 행별 forced-reviewer **내용**을 docstring 이나 실제 상수와 대조하는 테스트가 전혀 없고, `test_readme_table_has_the_same_rows_as_the_docstring` 는 오직 **행 개수**(9==9)만 비교한다.
    테스트 docstring 은 "Catches a rule re-targeted to a different reviewer while the table kept the old name — the 7 rows the first version of this guard left entirely unchecked" (라인 242-244) 라고 주장하지만, 위 실측대로 **재조준된 reviewer 이름이 표의 다른 행에 이미 존재하는 경우**(실무에서 가장 흔한 경우 — reviewer 종류가 14개뿐이라 겹칠 확률이 높음) 는 탐지되지 않는다. RESOLUTION.md 의 mutation 목록에 있는 "규칙 재조준" 뮤턴트도 아마 겹치지 않는 이름으로 시험됐을 것으로 추정된다(고립된 이름으로는 실제로 잡힘을 확인했음 — 겹치는 이름일 때만 실패).
    이는 정확히 이번 PR 전체가 막으려던 결함 클래스(문서 표 행이 실제 정책과 조용히 어긋남)이고, 직전 리뷰 라운드의 WARNING 1("정책 표 9행 중 2행만 검증")이 "반영" 으로 종결 처리됐으나 실제로는 (a) docstring 쪽 검증이 주장만큼 강하지 않고 (b) README 쪽은 행 내용이 전혀 검증되지 않는 이중 gap 이 남아있다.
  - 제안: (1) `_policy_rows(self.doc)` 와 `_policy_rows(self.readme)` 를 **행 인덱스로 짝지어**(이미 행 개수가 강제로 같음) 각 행의 `_reviewers_named_in(forced)` 을 서로 비교하는 테스트를 추가해 README 쪽 행 내용 검증을 신설한다. (2) docstring 쪽도 union 비교 대신 `_RULES`/`_SOURCE_FORCED_REVIEWERS` 를 표의 트리거 문자열로 순서 매칭(또는 최소한 행별 reviewer 집합을 개별 대조)하도록 강화해 "재조준" 주장을 실제로 충족시킨다. 두 변경 모두 현재 테스트 인프라(`_policy_rows`, `_reviewers_named_in`) 로 충분히 구현 가능.

- **[INFO]** 관련 spec 문서 없음 — 이번 변경 영역(`.claude/skills/code-review-agents/**`, `.claude/tests/**`)은 harness 자체 도구이며 `spec/` 하위 문서로 정의되는 제품 스펙 대상이 아니다(`grep -rl "router_safety\|code-review-agents" spec/` 결과 0건). spec fidelity 관점은 해당 없음 — 거버넌스는 `README.md`/모듈 docstring 자체가 SSOT.

- **[INFO]** `review/code/2026/07/23/16_30_52/_retry_state.json` 이 `routing_status: "pending"`, `agents_pending`(14개 전원), `agents_success: []` 로 커밋됐으나, 같은 세션의 `SUMMARY.md`/`RESOLUTION.md` 는 `routing_status=done`, 7명 실행 완료를 서술한다. 이번 diff 가 만든 코드 결함은 아니고(오케스트레이터 동작 자체는 이번 PR 범위 밖), 세션이 한 turn 안에서 완료돼 `_retry_state.json` 이 최종 상태로 재작성되지 않은 것으로 보인다 — 리뷰 산출물 기록의 정합성 관점에서만 참고.

## 요약

핵심 목표(직전 CRITICAL — `README.md:68` 의 "24 확장자" stale)는 실측 확인 결과 정확히 해소됐고, 관련 harness 테스트 스위트 446개 전부 green 이다. 다만 이번 PR 이 신설한 회귀 가드 자체를 대상으로 표적 뮤테이션 테스트를 수행한 결과, "표 행이 실제로 강제하는 reviewer 가 바뀌었는데 그 이름이 표의 다른 행에도 존재하는 경우"(docstring 쪽) 와 "README 행의 forced-reviewer 내용 자체"(README 쪽, 애초 미검증) 두 경로 모두에서 green 을 유지하는 실질적 탐지 공백이 확인됐다 — 이는 이 PR 계열이 전체적으로 막으려는 정확히 같은 결함 클래스이며, 직전 라운드 WARNING 1 이 "반영" 으로 종결 처리됐으나 완전히 닫히지 않았다. 코드 자체(정책 표 값)는 현재 정확하므로 기능적 피해는 없지만, 가드의 신뢰도 주장(docstring 문구)과 실제 탐지력 사이 괴리가 있어 WARNING 으로 보고한다.

## 위험도
MEDIUM
