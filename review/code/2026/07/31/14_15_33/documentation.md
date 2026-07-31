# 문서화(Documentation) Review — harness-review-gate-fixes-1bd6aa

## 조사 방법

`_prompts/documentation.md`에 unified diff 없이 "전체 파일 컨텍스트"만 제공되고, 그마저도 3개
파일(`review_guard.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`)은 크기
제한으로 아예 실리지 않았다. 해당 3개 파일과 두 `plan/in-progress/*.md` 문서는 `Read`로 직접
열람하고 `git diff origin/main...HEAD -- <path>`로 실제 변경분을 확보해 검토했다. 인용하는
줄 번호는 모두 실제 파일을 `Read`/`grep -n`으로 대조 확인한 값이며(assembled prompt의 게이트
숫자와도 교차검증함), 두 plan 문서의 "테스트 N건" 서술은 `python3 -m unittest <module> -v`로
실측 재검증했다.

## 발견사항

- **[WARNING]** `test_consistency_bundle_priority.py` 테스트 개수 서술이 실제보다 5건 적다
  - 위치: `plan/in-progress/harness-consistency-summary-downgrade-rule.md:148`
  - 상세: "테스트 `test_consistency_bundle_priority.py` 13건 + mutation 6종 RED."라고 "구현
    완료(2026-07-31)" 항목에 적혀 있으나, 실측(`python3 -m unittest test_consistency_bundle_priority -v`)
    결과는 `Ran 18 tests`다. `git log --follow`로 추적하면 "13건"은 커밋 `16725d62f`(1R 반영)
    시점엔 정확했지만, 이후 같은 브랜치의 `d19e01880`(3R, 13→16)·`0aa68aec4`(4R, 16→18) 두
    라운드가 새 결함을 잡으려고 이 파일에 테스트를 추가하면서 최초 "구현 완료" 불릿의 수치를
    갱신하지 않았다. 실제 커버리지는 문서보다 **많은** 방향이라 안전한 오차지만, 이 저장소가
    스스로 "BLOCK: NO가 검증 부재를 의미할 수 있다"는 것을 이 PR의 핵심 교훈으로 삼고 있는
    만큼 이런 실측 수치는 사후 감사에서 근거로 그대로 신뢰될 위험이 있다.
  - 제안: "18건"으로 갱신하거나, 라운드마다 갱신하기 번거로우면 "13건(2026-07-25 시점, 이후
    라운드에서 추가됨 — 정확한 수는 파일 참조)"처럼 정적 수치 대신 유동성을 명시.

- **[WARNING]** `test_review_changeset_warning.py` 테스트 개수 서술이 실제보다 1건 적다
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:146`
  - 상세: "테스트 `test_review_changeset_warning.py` 11건 + mutation 4종 RED."라고 적혀 있으나
    실측(`python3 -m unittest test_review_changeset_warning -v`)은 `Ran 12 tests`. 동일한
    패턴 — "11건"은 `16725d62f`(1R) 시점엔 정확했으나 `d19e01880`(3R)이 `test_git_exceptions_are_absorbed_not_propagated`
    관련 테스트를 보강하며 12번째 테스트가 추가된 뒤 문서가 갱신되지 않았다. 바로 위 WARNING
    과 같은 근본 원인(다라운드 리뷰-fix 사이클에서 앞선 라운드의 "완료" 서술이 뒤 라운드의
    변경을 반영하지 못함)이 이 PR 안에서 최소 2번 반복된 것으로, 우연이 아니라 이 작업 방식의
    구조적 갭으로 보인다.
  - 제안: "12건"으로 갱신. 반복되는 패턴이므로, 같은 파일에 새 테스트를 추가하는 이후 라운드는
    관련 plan 항목의 수치도 함께 훑어보는 체크리스트 습관을 권장.

- **[WARNING]** 이 PR이 직접 수정한 "suppresses the gate" 부정확 서술이 테스트 모듈 docstring
  한 곳에 그대로 남아 있음
  - 위치: `.claude/tests/test_review_guard_hardening.py:11` (모듈 최상단 docstring, `Covers` 목록)
  - 상세: `- _code_review_in_flight — started-but-unfinished review suppresses the gate.`
    라는 문구가 있다. 그런데 이 PR의 핵심 수정 자체가 `review_guard.py` 전역에서 정확히 이
    "suppresses the gate"라는 무조건적 표현을 "suppresses the *Stop nudge*"로 정정하는
    것이었다(과거엔 이 표현이 실제로 거짓이었다 — `in_flight_ok` opt-in 없이는 push 게이트까지
    열렸었다). `evaluate_review        — in-flight short-circuit.`(12행)도 Stop/Push 이분법을
    언급하지 않아 마찬가지로 뭉뚱그려져 있다. 정작 같은 파일 안에서 이번에 추가된
    `EvaluateInFlightShortCircuitTest.test_push_path_still_blocks_while_in_flight` /
    `test_stop_path_opts_in_and_is_allowed`가 바로 그 Stop-only 구분을 회귀 고정하는
    테스트인데, 파일 맨 위 목차만 옛 표현을 유지한다. 저장소 전체를 `grep -rn "suppresses the
    gate\b"`로 확인한 결과 이 한 곳만 남아 있었다(즉 프로덕션 코드·다른 문서는 전부 정정됨).
  - 제안: 11행을 "started-but-unfinished review suppresses the *Stop nudge* (opt-in via
    `in_flight_ok`; the push gate never suppresses)."류로, 12행도 "evaluate_review —
    Stop-only in-flight opt-in (`in_flight_ok`); push always evaluates without it." 정도로
    정정.

- **[INFO]** plan 문서의 줄 번호 인용이 실제 호출부가 아니라 설명 주석의 시작 줄을 가리킴 (이전
  리뷰 라운드에서 이미 지적, 아직 미반영)
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:173`
  - 상세: "stop 가드(`guard_review_before_stop.py:340`)"라고 인용하나, 실제
    `evaluate_review(in_flight_ok=True)` 호출은 344행이고 340행은 그 위 설명 주석("`in_flight_ok=True`
    is Stop-only: ...")의 첫 줄이다(같은 문장이 짝으로 인용한 `guard_review_before_push.py:846`은
    실제 호출 인자가 있는 줄을 정확히 가리킴). `review/code/2026/07/31/11_07_48/documentation.md`
    에서 이미 INFO로 지적됐고 `RESOLUTION.md`에서 "INFO 다수 — 무조치(비-행동)"로 명시적으로
    보류된 항목이라 새 결함은 아니지만, 여전히 열려 있어 재기재한다.
  - 제안: 우선순위 낮음 — 필요시 "340-344" 또는 "344"로 정정.

- **[INFO]** `collect_change_infos`의 한 줄 docstring이 새로 추가된 stderr 어드바이저리 부작용을
  언급하지 않음
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1291`
    (`def collect_change_infos(args, config):`)
  - 상세: docstring은 `"""Resolve args into a flat list of change_info dicts. May return
    empty."""` 한 줄뿐이다. 이 diff로 이 함수의 기본(인자 없음) 경로가 `warn_if_committed_work_is_missing(files)`
    를 호출해 stderr에 경고를 낼 수 있게 됐는데(1333행), 이 새 부작용이 이 함수 자신의
    docstring에는 나타나지 않는다. `warn_if_committed_work_is_missing` 자체와 SKILL.md
    §1 옵션 목록에는 이미 잘 문서화돼 있어 실질적 피해는 작다.
  - 제안: 우선순위 낮음(nice-to-have) — "May return empty; the argument-free default path
    also prints a stderr advisory when it misses committed branch work
    (see `warn_if_committed_work_is_missing`)." 한 줄 추가 검토.

- **[INFO]** `_is_catalog_bulk`에 자체 docstring이 없어 같은 diff의 형제 헬퍼들과 일관성이 약함
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:251`
    (`def _is_catalog_bulk(rel):`)
  - 상세: 같은 diff에서 신설된 `_branch_changed_rels`·`prioritize_bundle_files`는 모두 상세한
    docstring을 갖췄지만, 바로 위 `_CATALOG_BULK_RE` 정규식에 대한 풍부한 설명 주석에 이어지는
    이 한 줄짜리 wrapper 함수 자체엔 docstring이 없다. 동작은 자명하고 위 주석이 "왜"를 이미
    설명하므로 실질적 위험은 없다.
  - 제안: 우선순위 낮음 — "True if `rel` falls under an auto-generated `*-api-catalog/<resource>/**` dump (see `_CATALOG_BULK_RE`)." 한 줄 추가 검토.

## 확인한 항목 중 문제 없음 (양호 사례로 기록)

- `review_guard.py`의 `_IN_FLIGHT_TTL_SECONDS` 주석·`_code_review_in_flight`·`evaluate_review`
  docstring 3곳 모두, 과거 "the push guard still hard-gates"라는 무조건적 서술이 `in_flight_ok`
  opt-in 없이는 거짓이었다는 사실과 회귀 테스트(`EvaluateInFlightShortCircuitTest`)를 명시적으로
  연결한 모범적 갱신. `guard_review_before_stop.py`의 `evaluate_review(in_flight_ok=True)`
  호출부 인라인 주석도 왜 Stop 전용 opt-in인지 명확.
- `code_review_orchestrator.py`의 `_omitted_content_note`/`warn_if_committed_work_is_missing`/
  `_default_branch_ref`/`_aggregate_omission_note`: 실측 세션 경로·바이트 수·전후 비교 수치를
  포함한 정확한 docstring. `_default_branch_ref`의 "try/except가 장식이 아니라 하중을 지탱한다"는
  주장은 `_git`의 실제 구현(예외를 삼키지 않는 얇은 wrapper)과 대조 확인해 정확했다.
- `consistency_orchestrator.py`의 `prioritize_bundle_files`/`_branch_changed_rels`/
  `_prioritized`: 8회 재발 사례·정확한 세션 경로·측정치를 인용하며, "Plans are read WITHOUT
  `excluded` ... because ranking wants every in-progress plan" 같은 불변식 서술도 실제 호출
  지점(`excluded`가 그 시점엔 항상 빈 set)과 대조해 정확함을 확인했다.
- `--diff-base` CLI help 텍스트가 "이제 전 모드에서 번들 우선순위 산정에도 쓰인다"로 갱신됐고,
  실제로 `collect_context`가 모드 분기와 무관하게 `other_spec_files`/`convention_files`/
  `plan_files`를 전부 `_prioritized`로 재정렬함을 코드 대조로 확인 — SKILL.md 서술과 일치.
- `.claude/tests/README.md`: 신규 테스트 파일 3개(`test_consistency_bundle_priority.py`,
  `test_review_changeset_warning.py`, `test_prompt_omission_notice.py`)에 대응하는 행이
  정확히 추가돼 `test_tests_readme_catalog.py`의 카탈로그 동기화 요구를 만족.
  `.claude/agents/consistency-summary.md`·`.claude/skills/consistency-checker/SKILL.md`의
  "하향 금지 + planner 인계" 절도 서로 참조 관계가 정확하고 실측 근거(`review/code/2026/07/25/22_58_00`)
  를 함께 인용.
- CHANGELOG.md: 이 변경분은 `.claude/**`/`plan/**` 전용 하네스 작업이라 `codebase/` 대상
  product 변경 이력인 CHANGELOG.md 갱신 대상이 아님(기존 entries 전부 `spec/` SoT를 인용하는
  product 변경 전용임을 확인) — 갱신 누락이 아니라 스코프 밖.
- 두 `plan/in-progress/*.md` 문서는 "2026-07-31 종결/진행" 상단 배너로 처리 상태를 항목별로
  요약하고, 반증된 전제(예: "`--branch`/`--range`가 changeset 산정에 안 쓰인다")를 조용히
  지우지 않고 반증 사실 자체를 기록해 둔 점이 이 저장소의 plan-lifecycle 관례에 정확히 부합.

## 요약

diff 자체의 문서화 밀도와 정확도는 매우 높다 — 새 함수마다 실측 세션 경로·바이트 수·전후
비교치를 인용하는 docstring을 갖췄고, 버그의 근본 원인·수정·회귀 테스트를 서로 연결하는 주석
갱신이 반복적으로 나타나며, SKILL.md·README·테스트 카탈로그도 새 동작에 맞춰 정확히
갱신됐다. 다만 이 PR 특유의 다라운드(1R~4R) 리뷰-반영 작업 방식에서 반복되는 흠이 하나
있다 — 앞선 라운드에서 "구현 완료"로 표시하며 남긴 정확한 테스트 개수 서술이, 이후 라운드가
같은 파일에 테스트를 추가로 잠그면서 갱신되지 않아 두 곳(`test_consistency_bundle_priority.py`
13→18건, `test_review_changeset_warning.py` 11→12건)에서 실측과 어긋난다. 방향은 안전
(과소 산정)하지만 이 저장소가 "검증 부재를 BLOCK: NO로 오인하지 말라"를 스스로의 핵심
교훈으로 세우는 만큼 자기 기록의 정확도도 같은 기준으로 유지할 필요가 있다. 아울러 이 PR이
프로덕션 코드 전역에서 정정한 "suppresses the gate"라는 부정확 표현이 정작 관련 회귀 테스트를
담은 파일 자신의 모듈 docstring에는 하나 남아 있어, 같은 결함 클래스가 문서 쪽에서 재발했다.
셋 다 기능·차단 로직에는 영향이 없는 기록물 수준의 부정확성이다.

## 위험도

LOW
