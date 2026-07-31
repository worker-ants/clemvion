STATUS=success documentation review complete — 15 files, 0 CRITICAL, 2 WARNING, 3 INFO

===REPORT_MARKDOWN_BELOW===

# 문서화(Documentation) Review — harness-review-gate-fixes-1bd6aa (2R)

## 조사 방법

prompt 의 파일 1(`review_guard.py`)·파일 4(`code_review_orchestrator.py`)·파일 6
(`consistency_orchestrator.py`)·파일 7(`.claude/tests/README.md`)는 크기 제한으로 전체
컨텍스트가 실리지 않아, 이 4개 파일과 두 `plan/in-progress/*.md`, 나머지 10개 파일 전부를
`Read`로 직접 열람했다. `git diff origin/main...HEAD`(이 브랜치의 8개 커밋)로 실제 변경분을
확보하고, 직전 라운드 산출물(`review/code/2026/07/31/11_07_48/{documentation,RESOLUTION}.md`)과
대조해 이미 처리된 항목과 새로 남은 항목을 구분했다. 두 plan 문서가 인용한 테스트 개수는
`python3 -m unittest <module> -v`로 직접 재실행해 실측했다. 인용 줄 번호는 모두 이렇게 직접 연
원본 파일의 실제 줄 번호다(프롬프트 조립 오프셋 아님).

## 발견사항

- **[WARNING]** plan이 인용한 테스트 개수가 이번 PR 자체의 후속 수정으로 다시 어긋났다(2개 파일, 그중 1개는 재발)
  - 위치: `plan/in-progress/harness-consistency-summary-downgrade-rule.md:143`,
    `plan/in-progress/harness-review-gate-ci-backstop.md:108`
  - 상세: 두 줄 모두 "테스트 `<file>.py` N건 + mutation M종 RED" 형식으로 실측치를 못박아
    뒀는데, 지금 실행하면 다르다.
    - `test_consistency_bundle_priority.py` — 문서 "10건", 실측(`python3 -m unittest
      test_consistency_bundle_priority -v` → `Ran 13 tests`) **13건**. 1R 수정 커밋
      (`16725d62f`)이 W1/W3 대응으로 `test_branch_change_beats_catalog_demotion` ·
      `test_related_specs_uses_the_ranked_order` · `test_conventions_uses_the_ranked_order`
      3건을 바로 이 파일에 추가했지만 인용 숫자는 갱신되지 않았다.
    - `test_review_changeset_warning.py` — 문서 "9건", 실측(`Ran 11 tests`) **11건**. 직전
      라운드(`review/code/2026/07/31/11_07_48/documentation.md` INFO)가 이미 "실제 10건"이라고
      지적했는데, 같은 1R 수정 커밋이 CRITICAL 2(`_default_branch_ref` 예외 흡수 누락) 대응으로
      `test_git_exceptions_are_absorbed_not_propagated`를 이 파일에 추가해 실측치가 11건으로
      더 벌어졌다 — 한 번 지적된 뒤에도 반영되지 않았고 격차만 커졌다.
  - 제안: 두 줄을 각각 "13건"/"11건"으로 정정하거나, 앞으로도 같은 파일에 테스트가 추가될 때마다
    어긋나는 걸 피하려면 정확한 개수 대신 완화된 표현("다수의 테스트")으로 낮춰 쓸 것. 이 저장소의
    plan 문서들이 스스로 강조하는 "실측 우선" 관행(같은 파일의 "검증 교훈" 문단들)과 어긋나는
    사례다.

- **[WARNING]** `harness-consistency-summary-downgrade-rule.md` 상단 배너가 "수정 완료"를
  선언하지만, 그 근거로 지목한 절 안에 미해결 체크박스 5개가 남아 있다
  - 위치: `plan/in-progress/harness-consistency-summary-downgrade-rule.md:9-23`(배너, 특히 12행
    "부속 관측(번들 예산 결함, 8회 재발) — 수정 완료 (§관련 관측 참조)") vs `:94`, `:97`, `:99`,
    `:107`, `:111`(§관련 관측의 미체크 항목), `:57`, `:60`, `:62`(§선택지 (a)/(b)/(c) 미체크)
  - 상세: 배너는 "두 사안 모두 처리했다"·"수정 완료"라 선언하고 §관련 관측을 근거로 지목하는데,
    그 절 안의 체크박스 5개(diff 존재 사전확인 · `spec_impact` 우선 포함 · natural sort ·
    생략 관측가능화 · 비-경로 문자열 점검)는 여전히 `- [ ]`다. 특히 99행 "정렬이 사전순이라 …
    natural sort 로 교체"는 실제로 미구현임을 코드로 확인했다 — `consistency_orchestrator.py:309`
    의 `sorted(file_paths, key=lambda p: (tier(p), p))`는 같은 tier 안에서 여전히 사전순이고,
    이번에 추가된 `test_ties_stay_alphabetical`(`test_consistency_bundle_priority.py:162`)이
    "동일 tier 타이는 알파벳순 유지"를 테스트로 명시 고정한다. 즉 branch-changed 도 아니고
    plan에 언급되지도 않은 대상 파일이 같은 tier의 다른 두 자리 번호 파일과 경쟁하면 8회
    재발했던 버그 패턴이 그대로 남는다. 97행("spec_impact` frontmatter 우선 포함")도 135행이
    설명하는 "plan 본문 언급" 방식이라는 다른 메커니즘으로 사실상 대체됐을 뿐인데 상호 참조가
    없어, 문서만 봐서는 아직 열려 있는 항목인지 다른 방식으로 닫힌 항목인지 판단할 수 없다.
    55-63행의 (a)/(b)/(c) 선택지도 배너 산문은 실제 결정("하향 금지 + planner 인계", (c) 계열
    변형)을 설명하지만 체크박스 자체는 그대로 비어 있다.
  - 제안: 배너의 "수정 완료" 범위를 "8회 재발한 특정 증상(대상 파일이 tier 0/1로 승격되는
    경우)"으로 좁혀 쓰거나, 94/97/99/107/111 각 항목을 "이번 PR로 해소" / "다른 메커니즘으로
    대체(→135행 참조)" / "잔여 — 후속 필요" 중 하나로 명시적으로 마감할 것. (a)/(b)/(c)도 실제
    채택된 것이 (c) 변형이라면 그 항목에 체크하거나 취소선 처리해 산문과 체크박스 상태를 맞출 것.

- **[INFO]** `guard_review_before_push.py`의 `evaluate_review` 호출부에 "왜 `in_flight_ok`를
  넘기지 않는지" 인라인 경고가 없다
  - 위치: `.claude/hooks/guard_review_before_push.py:846` (`_run_gates` 안
    `_evaluate_over_targets(evaluate_review, targets, ...)` 호출의 첫 인자)
  - 상세: 이번 PR의 핵심 불변식 — push 게이트는 `in_flight_ok=True`를 절대 넘기면 안 된다 —
    은 `review_guard.py`의 `evaluate_review` docstring·`_IN_FLIGHT_TTL_SECONDS` 주석, 그리고
    `test_push_never_opts_into_the_in_flight_concession`/`test_push_path_still_blocks_while_in_flight`
    테스트로 잘 지켜지고 있다. 다만 이 파일(`guard_review_before_push.py`) 자체에는 그 사실을
    언급하는 줄이 한 줄도 없다 — 짝인 `guard_review_before_stop.py:340-343`은 반대로 4줄 인라인
    주석을 달아 뒀다. 이번 diff가 이 파일을 건드리지 않았으므로 회귀는 아니지만, 실제로 회귀가
    발생할 수 있는 지점(누군가 무심코 `in_flight_ok=True`를 추가)에 가장 가까운 방어선이 비어
    있다.
  - 제안: `evaluate_review,` 위에 "push 는 in-flight 완화를 절대 opt-in 하지 않는다 — Stop
    가드만 한다(see review_guard.evaluate_review)" 한 줄 추가.

- **[INFO]** `code-review-agents/SKILL.md`가 신설된 `warn_if_committed_work_is_missing`
  stderr 어드바이저리를 언급하지 않는다
  - 위치: `.claude/skills/code-review-agents/SKILL.md:41`
    ("- 인자 없음 → git diff (staged + unstaged + untracked)")
  - 상세: 직전 라운드(`review/code/2026/07/31/11_07_48/documentation.md` INFO)가 이미 지적했고
    "low priority nice-to-have"로 분류된 항목으로, 현재도 그대로다. 인자 없이 실행했을 때(가장
    흔한 경로) 이미 커밋된 브랜치 변경분이 changeset에서 빠지면 stderr 경고 + `--branch <base>`
    안내가 뜨는 새 동작이 SKILL.md 사용자 문서에는 한 줄도 반영돼 있지 않다. 동작 자체는
    advisory-only라 기존 서술("인자 없음 → git diff")이 깨지지는 않는다.
  - 제안: 41행 아래에 "커밋된 브랜치 작업이 changeset에서 빠지면 stderr 경고 후 `--branch`
    재실행을 안내한다" 한 줄 추가 검토(우선순위 낮음, 이미 알려진 항목의 재확인).

- **[INFO]** ci-backstop.md의 줄 번호 인용 정밀도 — 실제 호출 줄이 아니라 그 위 설명 주석의
  시작 줄
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:134-135`
    ("stop 가드(`guard_review_before_stop.py:340`)")
  - 상세: 직전 라운드가 이미 INFO로 지적한 항목. 실제 `evaluate_review(in_flight_ok=True)` 호출은
    `guard_review_before_stop.py:344`이고 340행은 그 위 설명 주석의 첫 줄이다(범위 안이라 완전히
    틀린 인용은 아니다). 짝으로 인용한 `guard_review_before_push.py:846`은 정확히 호출 인자 줄을
    가리켜 대비된다. 이번 라운드에서도 그대로 남아 있어 확인 차 재기재한다(우선순위 낮음).
  - 제안: 필요시 "340-344" 또는 "344"로 정정.

## 확인한 항목 중 문제 없음 (양호 사례)

- `review_guard.py`의 `_IN_FLIGHT_TTL_SECONDS` 주석·`_code_review_in_flight`/`evaluate_review`
  docstring 3곳 모두, 예전엔 무조건 참이라고 서술했던 "the push guard still hard-gates"가
  실제로는 `in_flight_ok` opt-in 없이는 거짓이었다는 사실과 회귀 테스트
  (`EvaluateInFlightShortCircuitTest`) 이름까지 명시해 정정 — 버그·원인·수정·회귀테스트를 모두
  연결한 모범적 갱신.
- `guard_review_before_stop.py:340-343`의 4줄 인라인 주석, `consistency_orchestrator.py`의
  `prioritize_bundle_files`/`_branch_changed_rels`/`_default_branch_ref`,
  `code_review_orchestrator.py`의 `_omitted_content_note`/`warn_if_committed_work_is_missing`
  docstring 모두 실측 세션 경로·수치를 인용해 근거를 남긴다.
- `.claude/tests/README.md`가 신규 테스트 파일 3개(`test_consistency_bundle_priority.py` /
  `test_prompt_omission_notice.py` / `test_review_changeset_warning.py`) 모두에 대응 행을
  정확히 추가해 `test_tests_readme_catalog.py`(직접 실행 확인: `Ran 5 tests … OK`)가 강제하는
  카탈로그 동기화를 만족한다.
- CHANGELOG.md는 `codebase/` product 변경 전용 컨벤션(전량이 `spec/*.md` SoT를 인용하는 항목)
  임을 grep으로 확인했고, 이 PR은 `.claude/**` + `plan/**` 전용이라 갱신 대상이 아니다(누락이
  아니라 스코프 밖).
- 두 plan 문서 모두 반증된 전제(예: "`--branch`/`--range`가 changeset 산정에 안 쓰인다")를
  조용히 지우지 않고 반증 사실 자체를 남겨 두는 이 저장소의 관례를 따른다.

## 요약

diff 자체(운영 코드의 docstring·인라인 주석)의 문서화 품질은 이번 라운드에서도 전 라운드 평가를
유지할 만큼 높다 — 버그 재현조건·원인·수정·회귀테스트를 연결하는 갱신이
`review_guard.py`/`consistency_orchestrator.py`/`code_review_orchestrator.py` 전반에 일관되게
나타난다. 다만 두 `plan/in-progress/*.md` 추적 문서에서 정확성 갭 두 가지를 확인했다: (1) 두
파일의 테스트 개수 인용이 같은 1R 수정 라운드에서 발생한 테스트 추가로 실제보다 낮게(10→13,
9→11) 벌어졌고, 그중 하나는 직전 라운드에서 이미 지적됐음에도 격차가 더 커졌다. (2)
`harness-consistency-summary-downgrade-rule.md` 상단의 "수정 완료" 배너가, 스스로 근거로 지목한
절 안의 체크박스 5개(그중 natural-sort 항목은 테스트로 미구현이 확인됨)와 불일치한다. 두 건 모두
코드 동작이나 게이트 판정에는 영향이 없는 plan-tracking 문서 내부의 정합성 문제이며, 그 외
SKILL.md 관련 INFO 2건은 직전 라운드에서 이미 낮은 우선순위로 확인된 항목의 재확인이다.

## 위험도

LOW
