# 부작용(Side Effect) Review

## 발견사항

- **[CRITICAL]** `build_files_section`의 신규 "생략 안내"(`_omitted_content_note`) 삽입이 자신이 명시한 `max_total_size` 예산 계약을 실제로 위반한다 — 하네스 테스트로 재현 확인(현재 RED).
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:561`(`_omitted_content_note` 정의), `:587`(`build_files_section` 정의), `:672-694`(예산 소진 루프 — `remaining_budget`/`include_content`/`break`), `:701-705`(문제의 `elif fp["full_content"]: section += _omitted_content_note(...)`).
  - 상세: `build_files_section`의 독스트링은 "Compose the changed-files context, respecting per-file and total budgets" 라고 명시한다. 그런데 예산 소진 루프(672~694행)는 `content_indices`를 오름차순(작은 파일부터)으로 순회하다 처음으로 안 맞는 파일에서 `break`하며, 그 직전 파일 하나만 `available > 200`이면 잘라서 넣고(693행 `remaining_budget = 0`), **그 뒤 파일들은 루프에 아예 들어가지 않는다**. 이후 최종 조립 루프(696~707행)에서 `include_content`에 없는(=예산 배정을 못 받은) 모든 파일은 `elif fp["full_content"]:` 분기로 빠져 `_omitted_content_note(...)`가 **예산 확인 없이 무조건** 덧붙는다 — 이 안내문 자체의 길이(파일마다 한글 기준 약 130~250자)가 `remaining_budget`에서 차감되거나 `max_total_size`와 재대조되는 지점이 코드 어디에도 없다. 즉 "생략 사실을 안내"하려는 correct 한 의도(1R C1 수정)가, 안내문 개수만큼 예산을 초과시키는 새로운 부작용을 만든다.
    실측: 현재 브랜치에서 `.claude/tests/test_line_anchors.py::PromptPayloadIntegrationTest::test_prompt_stays_within_the_size_cap`가 재현 가능하게(2회 연속 동일 수치로) 실패한다 —
    `AssertionError: 143620 not less than or equal to 143605 : _router.md: 143620 chars exceeds the 141557-char cap`.
    이 테스트가 고정 `--commit`으로 고르는 커밋은 `git log`에서 결정적으로 뽑히는 `pick_commit_fixture()`(최근 40개 중 변경 라인 ≥80인 첫 커밋)의 산출물이라 매 실행 동일하며, 이번엔 정확히 1R RESOLUTION 문서 커밋(`0279f4333`, `review/code/2026/07/31/11_07_48/**` 다수 신규 파일 포함)을 고른다 — 그 세션에 예산 초과로 생략되는 파일이 여럿(직접 재현 시 14개) 생기고, 그만큼의 안내문이 무예산으로 누적돼 cap(141,557)+slack(2,048)=143,605를 단 15자 차이로 넘긴다. `build_files_section`은 `build_agent_prompt_body`(reviewer별 `_prompts/<name>.md`, 이 리뷰 자신도 그 산출물이다)와 `build_router_prompt_body`(`_router.md`) **둘 다**의 공용 경로라, 이 초과는 라우터 프롬프트뿐 아니라 임의 reviewer 프롬프트에서도 동일 메커니즘으로 발생할 수 있다. 초과 폭은 "예산 초과로 생략된 파일 수"에 비례해 커지므로, 파일이 많은 대형 PR일수록 계약 위반 폭도 커진다.
    같은 커밋 계열에서 신설된 `test_prompt_omission_notice.py`는 안내문이 "표시되는지"만 단언하고 "안내문 포함 후에도 `len(body) <= max_total_size` 가 유지되는지"는 어디서도 단언하지 않아, 이 회귀가 신규 테스트로도 걸러지지 못했다.
  - 제안: 예산 소진 루프에서 "포함 못 하는 파일"에도 최소 `_omitted_content_note`의 예상 길이만큼은 `remaining_budget`에서 선반영(reserve)하거나, 최종 조립 후 `len(sections 합)` 을 `max_total_size` 와 재검증해 초과분을 노트 자체의 축약(예: 파일명만 나열하는 단일 요약 블록으로 대체)으로 흡수할 것. 회귀 방지로 `test_prompt_omission_notice.py` 또는 `test_line_anchors.py`에 "생략 파일 N개가 있어도 `build_files_section`의 결과 길이가 `max_total_size (+wrapper 여유)`를 넘지 않는다"를 직접 단언하는 케이스를 추가.

- **[WARNING]** `--diff-base`의 문서화된 스코프(“for `--impl-done`” )가 이번 diff로 전 모드(`--spec`/`--plan`/`--impl-prep`)에 조용히 확장되고, 그 모드들에 이전에 없던 git 서브프로세스 호출이 새로 생겼다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:435`(`diff_base = args.diff_base or "origin/main"` — `if/elif` 모드 분기 **밖**, 함수 최상단으로 이동), `:444`(`_rank_changed = _branch_changed_rels(diff_base, root)` — 4개 모드 공통 실행), `:573-574`(`other_spec_files`/`convention_files` 에 `_prioritized()` 적용 — 역시 모드 분기 밖), `:858`(argparse `--diff-base` help 텍스트: `"git ref to diff against for --impl-done (default: origin/main)."`).
  - 상세: 변경 전에는 `diff_base`가 `elif args.impl_done:` 분기 안에서만 계산·사용됐다(그 브랜치의 `git diff` 도 `--impl-done` 전용). 이번 diff는 `diff_base` 계산과, 그 값을 소비하는 `_branch_changed_rels()`(신규 `git diff --name-only {base}...HEAD -- .` 전체 repo 대상 subprocess) 호출을 함수 최상단으로 끌어올려 `--spec`/`--plan`/`--impl-prep` 모드에서도 매번 실행한다. 또한 `other_spec_files`/`convention_files` 재정렬(`_prioritized()`)도 4개 모드 공통 경로에 있어, 이 두 항목에 한해서는 `--diff-base` 값이 `--spec`/`--plan` 세션의 번들 순서에도 실제로 영향을 준다 — 그러나 CLI `--help`와 `SKILL.md` 는 여전히 `--diff-base`를 `--impl-done` 전용으로만 설명한다(이번 diff에서 그 문서들은 갱신되지 않음). 실행 안전성 자체는 문제 없다 — `_branch_changed_rels`는 예외를 흡수해 빈 set을 반환하므로(`test_git_exceptions_are_absorbed_not_propagated`류 패턴과 동일), `origin/main`이 로컬에 없는 저장소에서도 크래시하지 않고 조용히 우선순위 신호만 비운다. 즉 기능 고장 위험은 낮지만, "이 플래그는 `--impl-done`에만 영향을 준다"는 공개 계약이 코드 동작과 어긋난 상태로 남는다.
  - 제안: `--diff-base` help 텍스트와 `SKILL.md §환경변수/모드 설명`에 "`related_specs`/`conventions` 번들 우선순위 산정에도 사용됨(모든 모드 공통)"을 반영하거나, 반대로 스코프를 원래 의도대로 `--impl-done`에 한정하고 다른 모드는 `changed_rels=()`(브랜치 신호 없이 plan-mention 신호만)로 명시적으로 제한할 것.

- **[INFO]** `evaluate_review(cwd=None) → evaluate_review(cwd=None, *, in_flight_ok=False)` 시그니처 확장은 호출자 전수 확인 결과 안전 — 조치 불요, 확인 목적으로만 기록.
  - 위치: `.claude/hooks/_lib/review_guard.py:862`(정의), 호출부 `.claude/hooks/guard_review_before_push.py:846`(`_evaluate_over_targets` 를 통해 `evaluate(target)` 위치 인자만 전달 → `in_flight_ok` 는 기본값 `False` 유지) 및 `.claude/hooks/guard_review_before_stop.py:344`(`in_flight_ok=True` 명시 전달).
  - 상세: 저장소 전체에서 `evaluate_review(...)` 실제 호출자는 이 둘뿐이며(테스트 제외), 새 키워드 전용 파라미터는 `_accepts_cwd()`의 시그니처 판별(POSITIONAL_ONLY/POSITIONAL_OR_KEYWORD/VAR_POSITIONAL)에도 영향을 주지 않는다(`in_flight_ok`는 KEYWORD_ONLY라 그 판별 대상에서 제외됨). 이 필드는 이전 라운드에서 발견된 실제 CRITICAL(“in-flight 억제가 무조건 적용돼 push 게이트까지 30분간 열림”)의 의도된 수정이며, 관련 테스트(`test_push_never_opts_into_the_in_flight_concession`, `test_stop_passes_in_flight_opt_in` 등) 및 하네스 스위트 실행으로 재확인함(아래 검증 참조).
  - 제안: 없음 (검증 완료).

- **[INFO]** `consistency-summary.md`에 신설된 "## planner 인계 (권한 밖 Critical)" 섹션 제목이 문자열 "Critical"을 포함하지만, 게이트 판정 로직에 실질적 영향은 없음 — 문서 순서에 의존하는 다소 취약한 전제만 남음.
  - 위치: `.claude/agents/consistency-summary.md:74`(신규 섹션 제목), `.claude/hooks/_lib/review_guard.py:692-703`(`_summary_block_is_no` — consistency SUMMARY 소비 로직).
  - 상세: `review_guard.py`가 consistency SUMMARY(`review/consistency/**`)를 소비하는 유일한 지점인 `_summary_block_is_no`는 전체 텍스트에 대해 `_BLOCK_LINE.search()`(`BLOCK:\s*(YES|NO)` 최초 1건)만 본다. 신설 섹션의 블록쿼트("`BLOCK: YES` 도 그대로입니다")가 실제 생성 문서에도 그대로 포함되지만, 템플릿상 최상단 실제 상태줄(`**BLOCK: {YES/NO}**`)이 항상 이 섹션보다 앞서 등장하므로 `.search()`의 첫 매치는 항상 올바른 상단 줄이다 — 현재는 오탐 없음. (참고로 `review/code/**` 전용의 `_section_has_rows(lines, "Critical")` 류 섹션-경계 파싱은 이 문서 포맷을 전혀 소비하지 않아 영향권 밖임도 확인함.)
  - 제안: 없음(현재 안전) — 다만 향후 이 두 SUMMARY 포맷을 통합하거나 섹션 순서를 바꿀 계획이 생기면, `BLOCK:` 파싱을 "첫 매치"가 아니라 "최상단 전용 앵커"(예: 문서 시작 후 첫 heading 다음 줄만 검사)로 좁혀 두는 편이 안전하다.

## 검증

- `.claude/tests` 전체 스위트 실행: 693건 중 **692 통과 / 1 실패**(`test_prompt_stays_within_the_size_cap`, 상단 CRITICAL 항목). 실패는 2회 재실행에서 동일 수치로 재현되어 flaky 가 아님을 확인.
- 관련 신규/수정 테스트 파일 단독 실행 결과 모두 통과: `test_consistency_bundle_priority.py`(13), `test_prompt_omission_notice.py`(4), `test_review_changeset_warning.py`(11), `test_guard_review_before_push_main.py`(38), `test_review_guard_hardening.py`(47 — 파일 전체), `test_stop_guard_failopen.py`(17, `SuiteLeavesNoRealStateTest` 포함해 실제 저장소에 fail-open 상태 파일이 남지 않음도 확인), `test_tests_readme_catalog.py`(5).
- `evaluate_review` 호출부 전수 grep 및 `_accepts_cwd()` 판별 로직 직접 확인 — 위 INFO 항목 참고.
- `warn_if_committed_work_is_missing`/`_default_branch_ref`(1R WARNING C2)는 현재 `try/except Exception`으로 감싸져 있고 `test_git_exceptions_are_absorbed_not_propagated`가 `FileNotFoundError`/`TimeoutExpired` 양쪽을 커버함을 확인 — 회귀 없음.
- 조사 과정에서 `--commit <fixture-sha>`를 수동으로 1회 실행해 `review/code/2026/07/31/12_12_55/`가 임시로 생성됐음을 확인하고, 리뷰 산출물이 아니므로 조사 종료 후 즉시 삭제함(레포에 잔존 없음, `git status` 로 재확인).

## 요약

이번 라운드의 핵심 의도(리뷰 in-flight 억제를 Stop 전용으로 스코프 축소하는 `evaluate_review(in_flight_ok=...)` 시그니처 확장, 커밋 누락 경고, consistency 번들 우선순위 재정렬, Critical 하향 금지 + planner 인계 문서화)는 모두 목적에 부합하고 호출자 영향도 전수 확인 결과 안전하다. 그러나 같은 커밋 계열에서 함께 온 "생략 파일 안내" 기능(`_omitted_content_note`)이 `build_files_section`이 스스로 약속한 `max_total_size` 예산 계약을 실제로 위반하는 회귀를 만들었고, 이는 가정이 아니라 현재 트리에서 재현 가능한 테스트 실패(`test_prompt_stays_within_the_size_cap`)로 확인된다 — reviewer/router 프롬프트 조립이라는, 이 저장소의 모든 코드 리뷰 세션이 의존하는 공용 경로의 계약 위반이라 파급 범위가 넓다. 그 외 `--diff-base`의 문서화된 스코프가 조용히 전 모드로 확장된 점은 실행 안전(fail-safe)하지만 공개 계약과 실제 동작이 어긋난 상태로 남아 WARNING 수준으로 별도 기재했다.

## 위험도

CRITICAL
