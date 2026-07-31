# Documentation Review — harness-review-gate-fixes-1bd6aa (3R 라운드 누적 diff)

## 발견사항

- **[CRITICAL]** 미문서화·미참조 stale 복제 파일 `_probe_main.py` (1304줄) 가 커밋에 그대로 남았다
  - 위치: `.claude/skills/code-review-agents/scripts/_probe_main.py:1-17` (모듈 docstring), 파일 전체(1304줄)
  - 상세: `git show d19e0188 --stat`/`-p` 로 확인하면 이 파일은 `code_review_orchestrator.py` 에서 **`copy from/copy to`** 로 생성됐다("3R 리뷰 반영" 커밋). 그런데 그 시점 이후 실제 orchestrator 에 추가된 핵심 수정(`_omitted_content_note`, `_aggregate_omission_note`, `warn_if_committed_work_is_missing`, `_default_branch_ref` 등, 총 diff 228줄)은 이 복제본에 전혀 반영되지 않았다 — 즉 **커밋 중간 시점의 stale 스냅샷**이 그대로 실렸다. 모듈 docstring(1-17줄)은 원본과 **완전히 동일**해서 "Code Review Agents Orchestrator — prepare-only mode" 라고 주장하지만, 실제로는 아무 데서도 실행되지 않는 죽은 사본이다.
    - 참조 여부를 전수 확인했다: 코드(`grep -rn "_probe_main"`)·테스트(`.claude/tests/*.py` glob 은 `.claude/tests/` 디렉터리만 훑음)·`.claude/tests/README.md`·`code-review-agents/README.md`·`SKILL.md` 어디에도 이 파일명이 등장하지 않는다. `.gitignore` 에도 `_*.py` 류 스크래치 제외 패턴이 없다.
    - 이 저장소의 네이밍 관례상 언더스코어 prefix(`_lib`, `_shared`, `_harness.py`)는 "내부 지원 모듈"이라는 뜻으로 쓰이므로, 이름만 보면 정식 내부 모듈로 오인하기 쉽다 — 그런데 실제로는 파일 자체가 그 사실을 전혀 밝히지 않는다.
    - 사용자 메모리에 기록된 실패 패턴("가드 mutation 원복은 cp+절대경로 — 커밋 먼저 → mutation")과 정확히 들어맞는 모양이다: mutation/롤백 검증을 위해 `cp` 로 스냅샷을 떠 둔 뒤 지우지 않고 커밋에 딸려 들어간 것으로 보인다.
  - 제안: 의도치 않은 커밋이면 삭제. 만약 의도적으로 보존할 자료(예: "3R 이전 상태" 회귀 비교용 fixture)라면 (a) 모듈 최상단에 목적·생성 경위·"이 파일은 실행되지 않으며 실제 orchestrator 를 고칠 때 함께 고치지 않는다" 를 명시하는 docstring 을 새로 쓰고, (b) `.claude/skills/code-review-agents/README.md` 또는 SKILL.md 에 존재 이유를 한 줄이라도 남길 것.

- **[WARNING]** plan 문서의 요약 헤더 개수와 실제 나열 항목 수가 어긋난다 (이번 diff 로 신규 작성)
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:27` (헤더) vs `:29-63` (번호 목록) 및 `:65-71` (번호 없는 추가 항목)
  - 상세: `git diff origin/main...HEAD` 로 확인하면 이 블록 전체가 이번 라운드에 **새로 작성**됐다. 헤더는 `**신규 후속 3건 (defer)**` 이라고 쓰지만 바로 아래 번호 목록은 **1번부터 7번까지 7개** 항목이고, 그 뒤에 "origin 기본 브랜치 해석" 관련 8번째 항목이 번호 없이 하나 더 붙는다. "3건" 은 초안 작성 중 항목이 늘어나면서 갱신되지 않은 것으로 보인다. 이 프로젝트의 다른 plan 파일(`harness-consistency-summary-downgrade-rule.md:125` `### 같은 PR 안에서 3회 재현`)에도 헤더 "3회" 대비 표는 4행(회차 1~4)인 동일 클래스의 사전 존재 결함이 있다(단, 그쪽은 이번 diff 가 건드리지 않은 기존 텍스트).
  - 제안: `harness-review-gate-ci-backstop.md:27` 의 "3건" 을 "7건"(+ 별도 8번째 항목 언급)으로 정정. 이런 카운트 라벨은 리뷰·감사 시 "몇 개가 defer 됐는지" 판단의 근거로 재사용되므로 정확도가 중요하다.

- **[WARNING]** 신규 정규식 `_CATALOG_BULK_RE` 의 주석이 인용하는 근거 문서보다 실제 매칭 범위가 넓다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:236-242` (`_CATALOG_BULK_RE` 정의 + 주석), 사용처 `:311`
  - 상세: 주석은 "Auto-generated per-resource reference dumps (e.g. `spec/conventions/cafe24-api-catalog/<resource>/**`)... `spec-impl-evidence.md` 자신이 이들을 정식 spec 이 아니라고 말한다" 며 근거로 `spec/conventions/spec-impl-evidence.md` R-7 을 인용한다. 그런데 R-7 본문(`spec-impl-evidence.md:234-236`)은 **중첩 경로**(`<name>-api-catalog/<resource>/**`, 세그먼트가 한 단계 더 있는 파일)만 "정식 spec 아님"으로 제외하고, **최상위 `<resource>.md` 인덱스**(`id`+`status` 보유, 이 저장소에 18개 + `_overview.md`)는 명시적으로 "정식 spec 이라 검증 유지"라고 반대로 규정한다.
    실제 정규식 `r"(^|/)[^/]*-api-catalog/"` 을 실행해 확인하면(`re.search`) `cafe24-api-catalog/product/fields.md`(중첩, 제외 대상 맞음)뿐 아니라 `cafe24-api-catalog/product.md`(최상위 인덱스, R-7 이 "정식 spec"이라 부르는 바로 그 파일)·`cafe24-api-catalog/_overview.md` 도 함께 매칭돼 tier 3(최후순위)로 강등된다. 저장소 실측: 최상위 파일 19개(`_overview.md` 포함) vs 중첩 파일 222개 — 주석이 설명하는 의도보다 실제 강등 범위가 19개 만큼 더 넓다.
    `test_consistency_bundle_priority.py` 의 관련 테스트(`test_catalog_bulk_sinks_below_everything`, `test_catalog_demotion_beats_a_plan_mention`, `test_branch_change_beats_catalog_demotion`)는 전부 중첩 `<resource>/fields.md` 형태만 fixture 로 쓰고, 최상위 인덱스 파일이 강등되지 않아야 한다는 방향은 어디에도 단언되지 않는다.
  - 제안: (a) 의도가 "카탈로그 트리 전체를 낮은 우선순위로" 라면 주석을 그렇게 정정하고 R-7 인용을 "최상위 인덱스도 포함해 낮춘다"는 취지로 다시 쓸 것, 또는 (b) R-7 의 구분을 그대로 따르고 싶다면 정규식을 `<resource>/` 뒤에 실제로 파일이 더 있는 경우로 좁히고(예: `r"(^|/)[^/]*-api-catalog/[^/]+/"`), 최상위 인덱스가 tier 3 로 떨어지지 않는지 확인하는 테스트를 추가할 것.

- **[WARNING]** 4개 파일에 반복된 "fresh-interpreter subprocess" 테스트 관례가 `README.md` 의 컨벤션 목록에 없다
  - 위치: `.claude/tests/README.md:62-84` (`## Conventions for new tests` 섹션 — 이 섹션 자체는 이번 diff 대상 아님, 신규 테스트가 이 섹션이 다루지 않는 패턴을 반복 사용)
  - 상세: 이번 PR 이 추가한 `test_consistency_bundle_priority.py`·`test_prompt_omission_notice.py`·`test_review_changeset_warning.py` 는 각각 자체 `_PREAMBLE`/`run_in_orchestrator` 헬퍼(~35줄)를 손으로 복제해 orchestrator 를 서브프로세스로 로드한다(기존 `test_consistency_context_budget.py` 의 패턴을 그대로 베낌 — "Fresh-interpreter convention as in `test_consistency_context_budget`" 라고 각 파일이 스스로 밝힘). 이로써 이 패턴을 쓰는 파일이 1개→4개로 늘었는데, `README.md` 의 "Conventions for new tests" 섹션은 정확히 이런 반복을 막기 위해 존재하는 위치이면서도 이 패턴을 전혀 언급하지 않는다(현재는 git-real-repo 예외와 `_harness.load_module_by_path` 두 가지만 문서화돼 있고, 후자는 이 `_lib` 충돌 클래스에는 적용 불가 — in-process 로더라 `_lib` 자체의 충돌은 못 피한다). `plan/in-progress/harness-review-gate-ci-backstop.md:59-63` (defer 항목 7)가 "보일러플레이트를 `_harness.py` 로 추출" 이라는 **코드 중복 제거**는 후속으로 등재했지만, "컨벤션 문서에 patttern 을 기록"하는 **문서화 절반**은 어디에도 등재돼 있지 않다.
  - 제안: `_harness.py` 추출 작업(이미 defer 로 등재됨)과 별개로, 최소한 `README.md` "Conventions for new tests" 에 세 번째 항목으로 "orchestrator 모듈을 서브프로세스 fresh-interpreter 로 로드하는 경우와 그 이유(`_lib` 네임스페이스가 프로세스 전역이라 in-process 로더로는 못 피함)"를 한 항목 추가할 것 — 다음 신규 테스트 작성자가 다섯 번째 사본을 만드는 것을 막는다.

- **[INFO]** 신규 real-git 테스트가 프로젝트 자체 문서화된 격리 관례를 따르지 않는다
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:215-236` (`BranchChangedRelsAgainstRealGitTest._repo`)
  - 상세: `README.md:64-71` 은 "실제 git 동작을 검증할 때는 임시 저장소 + `GIT_CONFIG_GLOBAL=/dev/null` 격리" 를 명시적 컨벤션으로 규정하고, 같은 PR 의 `test_review_guard_hardening.py` (`RebaseAuthorDateTest._git`)도 정확히 그 방식으로 구현돼 있다("Isolate from the host's global/system git config (signing, hooks, …)" 주석 포함). 그런데 신규 `BranchChangedRelsAgainstRealGitTest._repo()` 는 `tempfile.mkdtemp()` + `git init` + `git config user.email/user.name` 까지는 같은 패턴이지만 `env=` 오버라이드가 없어 호스트의 전역/시스템 git 설정(예: `commit.gpgsign=true`)을 그대로 물려받는다 — 서명·훅이 걸린 머신에서 비재현 실패를 낼 잠재 소지가 있다(이 PR 이 같은 라운드에서 `test_guard_review_before_push_main.py` 에 `cwd=self.tmp` 를 추가해 고친 것과 같은 클래스의 환경 누수).
  - 제안: 문서화 관점에서는 낮은 우선순위(기능 결함은 아님)지만, 다음에 이 파일을 만지는 사람이 README 컨벤션을 안 놓치도록 `_git()` 헬퍼에도 `GIT_CONFIG_GLOBAL=os.devnull`/`GIT_CONFIG_SYSTEM=os.devnull` 을 추가하는 편이 일관적이다.

## 잘된 점 (참고)

- `review_guard.py`/`guard_review_before_stop.py` 의 `_IN_FLIGHT_TTL_SECONDS` 주석과 `_code_review_in_flight`/`evaluate_review` docstring 은 "the push guard still hard-gates" 가 **무조건 억제 동안은 거짓이었다**는 사실을 스스로 인정하고 opt-in 근거를 붙여 정정했다 — 실측 라인(`guard_review_before_push.py:846`, `guard_review_before_stop.py:340`)도 현재 코드와 정확히 일치한다.
- `code_review_orchestrator.py`/`consistency_orchestrator.py` 에 추가된 `_omitted_content_note`/`_aggregate_omission_note`/`warn_if_committed_work_is_missing`/`prioritize_bundle_files`/`_branch_changed_rels` 는 모두 "무엇이 왜 필요한지 + 실측 수치 + 실패했을 때의 증상"을 갖춘 충실한 docstring 을 갖는다.
- `.claude/tests/README.md` 는 이번에 추가된 테스트 3개(`test_consistency_bundle_priority.py`/`test_review_changeset_warning.py`/`test_prompt_omission_notice.py`) 전부에 대해 새 표 행을 정확히 추가했다(누락 없음, `test_tests_readme_catalog.py` 가드와도 정합).
- `consistency-checker/SKILL.md` 의 `--diff-base` 설명이 "전 모드 공통으로 번들 우선순위 산정에도 쓰인다" 로 갱신됐고, 실제 코드(`collect_context` 최상단에서 모드 분기 전에 `diff_base`/`_rank_changed` 를 1회 계산)와 일치한다. `.claude/agents/consistency-summary.md` 의 새 "§요약 지침 3/4"·"§planner 인계" 표는 `consistency-checker/SKILL.md §4 BLOCK 처리` 의 상호 참조("§요약 지침 3")와 섹션 번호가 정확히 맞는다.

## 요약

이번 라운드는 harness 문서 정확성 자체를 개선하는 방향(과거 거짓이었던 불변식 주석의 정정, README/SKILL.md 의 `--diff-base`·changeset 경고 갱신, 신규 테스트 3건의 README 카탈로그 등재)으로 잘 진행됐지만, 정작 이 PR 자신이 새로 만든 산출물 안에서 두 가지 유형의 문서 결함을 냈다: (1) 실행되지 않고 어디서도 참조되지 않는 1300줄짜리 stale 복제 스크립트(`_probe_main.py`)가 아무 설명 없이 커밋에 남아 향후 독자를 오도할 위험이 크고, (2) 새로 작성한 plan 문서의 요약 헤더 숫자("3건")가 바로 아래 나열된 항목 수(7~8개)와 어긋나며, (3) 새 카탈로그 강등 정규식의 주석이 인용하는 근거 문서(R-7)보다 실제 매칭 범위가 넓어 "정식 spec"으로 규정된 19개 최상위 인덱스 파일까지 함께 강등시킨다. 나머지(신규 테스트 관례 미문서화, git 격리 누락)는 경미한 후속 성격이다.

## 위험도
HIGH — `_probe_main.py` 는 기능적 회귀는 아니지만 향후 유지보수자가 이 파일을 실제 orchestrator 로 오인해 잘못된 곳을 수정하거나 혼란을 겪을 실질적 위험이 있고, plan 헤더 카운트 오류와 정규식 범위 불일치는 이 프로젝트가 스스로 "게이트 판정 근거"로 규정한 문서(§요약 지침, R-7)의 신뢰도에 직접 영향을 준다.
