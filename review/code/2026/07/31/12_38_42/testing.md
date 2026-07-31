# Testing Review — harness-review-gate-fixes

## 검증 방법

정적 리뷰에 더해, 핵심 변경 지점에 실제 뮤테이션을 주입해 테스트가 실제로 RED 로 전환되는지
직접 확인했다 (`.claude/hooks/_lib/review_guard.py`, `.claude/hooks/guard_review_before_stop.py`,
`.claude/hooks/guard_review_before_push.py`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`,
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 를 각각 임시로 변형 → 실행 →
원본 cp 로 즉시 복원, 매 회 `git diff --stat` 로 원복 확인). 전체 스위트(`python3 -m unittest discover
-s .claude/tests`)는 뮤테이션 전후 모두 695 tests OK.

검증한 7개 뮤테이션 전부 대응 테스트가 RED 로 전환됨을 확인:
1. `evaluate_review` 기본값 `in_flight_ok=False→True` → `test_review_guard_hardening.
   EvaluateInFlightShortCircuitTest.test_push_path_still_blocks_while_in_flight` FAIL.
2. Stop 훅 호출부에서 `in_flight_ok=True` 제거 → `test_stop_guard_failopen.
   StopGuardFailOpenTest.test_stop_passes_in_flight_opt_in` FAIL.
3. Push 훅 호출부에 `in_flight_ok=True` 주입 → `test_guard_review_before_push_main.
   GuardReviewBeforePushMainTest.test_push_never_opts_into_the_in_flight_concession` FAIL.
4. `consistency_orchestrator.collect_context` 의 `other_spec_files`/`convention_files` prioritize
   호출을 pass-through(`... and other_spec_files`)로 변형 → `test_consistency_bundle_priority.
   CollectContextUsesPriorityTest` 의 관련 2건 FAIL.
5. `code_review_orchestrator.build_files_section` 의 omission-notice 삽입 분기 삭제 →
   `test_prompt_omission_notice.py` 6건 중 4건 FAIL(내용 검증 관련 전부).
6. 예산 상한 초과 회귀(공지문 사전 예약 로직 제거, 과거 실측 결함 그대로 재현) →
   `test_notices_are_paid_for_out_of_the_same_budget` 3개 subTest 전부 FAIL(7111/10110/14111
   vs cap 5000/8000/12000).
7. `collect_change_infos` 기본 경로에서 `warn_if_committed_work_is_missing(files)` 호출 제거 →
   `test_review_changeset_warning.DefaultPathIsWiredTest.test_default_path_calls_the_warning` FAIL.

과거 이 저장소에서 반복됐던 "vacuous test"(호출 횟수만 세고 반환값 폐기를 놓침, 헬퍼 테스트 ≠
호출부 테스트) 문제를 이 PR 은 스스로 인지하고(주석에 명시) call-site effect 를 직접 단언하는
방식으로 이미 방어하고 있으며, 위 실측이 그 방어가 실제로 작동함을 재확인한다.

## 발견사항

- **[WARNING]** `_branch_changed_rels` (branch-changed 판정, tier 0 의 유일한 데이터 소스)가
  실제 git 동작을 단언하는 테스트가 없다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249`
    (함수 `_branch_changed_rels`), 소비 지점은 `collect_context` 의 `_rank_changed = 
    _branch_changed_rels(diff_base, root)` (`consistency_orchestrator.py:452`)
  - 상세: 이 함수가 만드는 "이 브랜치가 변경한 파일" 집합은 8회 재발한 원 버그의 근본 수정에서
    가장 강한 신호(tier 0, "outranks the catalog demotion")로 설계됐다. 그런데
    `CollectContextUsesPriorityTest`(`test_consistency_bundle_priority.py:206` 이하)는
    `orch.prioritize_bundle_files` 자체를 `lambda file_paths, root, **kw: sorted(...)`
    로 완전히 대체해 `changed_rels` 인자를 **받기만 하고 버린다** — 따라서 `collect_context` 를
    통해 `_branch_changed_rels` 가 실제로 실행되긴 하지만(크래시 안 하는지 정도의 스모크),
    그 반환값이 옳은지는 어떤 assertion 도 검사하지 않는다. `PrioritizeBundleFilesTest`/
    `PriorityThenTruncationTest` 쪽은 `changed=[...]` 를 직접 문자열로 주입해 `_branch_changed_rels`
    를 아예 우회한다. 즉 "git diff 실제 명령이 올바른 상대경로 집합을 반환하는가" 라는, 이 fix
    전체가 의존하는 전제 자체는 테스트 스위트 어디에도 고정돼 있지 않다.
    (별도로 임시 git repo 를 만들어 직접 실행해 본 결과 현재 구현 자체는 정상 동작함을 확인했다
    — 살아있는 결함은 아니다. 다만 향후 이 함수의 명령 인자(`--no-renames`, `...` 3-dot, `-- .`
    스코핑 등)에 회귀가 생겨도 스위트가 잡아내지 못한다.)
  - 제안: `test_review_guard_hardening.RebaseAuthorDateTest` 가 이미 쓰는 임시 git repo 패턴을
    재사용해 `_branch_changed_rels(base, root)` 를 직접 호출하고 반환 집합을 단언하는 테스트
    1~2개 추가 (예: 두 커밋 사이 diff, rename 케이스 `--no-renames` 확인).

- **[INFO]** `_default_branch_ref` 의 다단계 해석 로직(정상 경로)이 직접 테스트되지 않는다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1168`
    (`_default_branch_ref`), 소비 지점 `warn_if_committed_work_is_missing`
    (`code_review_orchestrator.py:1192`)
  - 상세: `origin/HEAD` symbolic-ref → `origin/main` → `origin/master` 3단계 우선순위 로직이
    있는데, `test_review_changeset_warning.py` 의 `test_git_exceptions_are_absorbed_not_propagated`
    (해당 파일 122번째 줄 부근)는 `orch._git = boom` 으로 예외만 강제해 "실패 시 None, 예외
    미전파" 만 검증한다. 나머지 모든 `warn()` 헬퍼 기반 테스트는 `orch._default_branch_ref =
    lambda: ARG["base"]` 로 함수 자체를 완전히 대체한다. 즉 이 함수의 실제 우선순위 분기(예:
    `origin/HEAD` 가 없을 때 `origin/main`/`origin/master` 로 정확히 폴백하는지)를 실행하는
    테스트가 하나도 없다.
  - 제안: 임시 git repo에서 `origin` remote 유무·`HEAD` symbolic-ref 유무를 조합해 실제
    우선순위 분기를 확인하는 테스트 1~2개 추가. 우선순위는 낮음 — fail-safe 설계이고 로직
    자체가 단순하다.

- **[INFO]** `_CATALOG_BULK_RE` 의 `(^|/)` 대안 중 `^` 분기가 어떤 fixture 로도 실행되지 않는다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:242`
    (`_CATALOG_BULK_RE = re.compile(r"(^|/)[^/]*-api-catalog/")`)
  - 상세: `test_catalog_bulk_sinks_below_everything`/`test_catalog_demotion_beats_a_plan_mention`/
    `test_branch_change_beats_catalog_demotion` (모두 `test_consistency_bundle_priority.py`)
    의 fixture 경로가 전부 `"spec/conventions/cafe24-api-catalog/..."` 형태라 `/` 분기만
    거친다. 카탈로그 디렉터리가 리포 루트에 바로 오는 경로(`"cafe24-api-catalog/x.md"`, 부모
    세그먼트 없음)로 `^` 분기를 실제로 태우는 fixture 는 없다. 사용자 메모리에 이미 기록된
    교훈("분기 매트릭스 완성 뒤에도 `??`/`||` 는 각 항이 별도 표면")과 같은 클래스의 간극이다.
  - 제안: `test_catalog_bulk_sinks_below_everything` 옆에 루트-앵커 경로 케이스 1개 추가.
    로직이 단순해 실질 위험은 낮음(정보성).

- **[INFO]** `DefaultPathIsWiredTest` 가 "경고 미발생" 을 `branch`/`range` 모드만 검증하고
  `commit`/`files` 모드는 검증하지 않는다
  - 위치: `.claude/tests/test_review_changeset_warning.py:156` (`class DefaultPathIsWiredTest`),
    `:187-193` (`test_default_path_calls_the_warning`/`test_explicit_branch_does_not_warn`/
    `test_explicit_range_does_not_warn`)
  - 상세: `collect_change_infos` (`code_review_orchestrator.py:1232`) 는 `if args.commit /
    elif args.range / elif args.branch / elif args.files / else:` 구조이고
    `warn_if_committed_work_is_missing` 호출은 마지막 `else` 안에만 있다. 구조상
    `--commit`/positional `--files` 모드도 안전(각자 독립된 elif 라 else 에 도달 못 함)하지만,
    이 사실을 직접 확인하는 테스트가 없다 — `_calls()` 헬퍼가 `commit`/`files` 모드를 지원하도록
    돼 있음에도(`kw = dict(commit=None, range=None, branch=None, files=None, staged=False)`)
    실제로는 `None`/`branch`/`range` 세 값만 호출된다.
  - 제안: `test_explicit_commit_does_not_warn`/`test_explicit_files_does_not_warn` 2건 추가로
    같은 속성의 매트릭스를 완성. 우선순위 낮음(현재 구조상 안전 방향이 명백).

- **[INFO]** (이미 추적된 항목 재확인) `consistency-summary.md`/`SKILL.md` 의 "Critical 하향
  금지" 정책은 순수 prompt 지시이고 기계적 backstop 이 없다
  - 위치: `.claude/agents/consistency-summary.md` §요약 지침 3·4 (신설), `.claude/hooks/_lib/
    review_guard.py` 의 `_BLOCK_LINE = re.compile(r"BLOCK:\s*(YES|NO)", re.IGNORECASE)`
    (`review_guard.py:141` 부근 — `re.compile` 자체는 이번 diff 로 변경되지 않음)
  - 상세: 이번 PR 이 추가한 하향 금지 규약은 LLM 프롬프트 텍스트이므로 원천적으로 유닛테스트
    대상이 아니다. `review_guard.py` 의 게이트는 `BLOCK:` 한 줄만 파싱하고 각 checker 리포트의
    `[CRITICAL]` 개수와 최종 `BLOCK:` 값의 정합성은 대조하지 않는다 — 즉 향후 어떤
    consistency-summary 실행이 규약을 어기고 다시 하향하더라도 이를 잡아낼 코드 레벨 가드/테스트가
    없다. 이 갭은 이미 `plan/in-progress/harness-review-gate-ci-backstop.md` "신규 후속 3건
    (defer)" 의 2번 항목으로 정확히 같은 내용이 기록돼 있다 — **새 발견이 아니라 테스트 관점에서의
    재확인**이며, 저자도 "정책 자체는 확정, 이건 그 집행 수단" 이라고 이미 defer 사유를 남겼다.
  - 제안: 추가 조치 불요(이미 계획 문서에 추적 중). 향후 착수 시 orchestrator 가 checker 리포트의
    `[CRITICAL]` 카운트 대 최종 `BLOCK:` 모순을 감지하는 회귀 테스트를 이 PR 의 뮤테이션 스타일로
    작성할 것을 권장.

## 강점 (참고)

- `test_guard_review_before_push_main.py`/`test_stop_guard_failopen.py` 의 stub 함수가 실제
  시그니처(`cwd=None, *, in_flight_ok=False`)를 그대로 미러링해, 호출부가 실수로 kwarg 를
  빠뜨리면 stub 이 `TypeError` 를 던지도록 설계했다(주석에 "Recording the kwarg turns that into
  a RED test instead" 로 명시). 시그니처 드리프트를 침묵 통과가 아니라 명시적 실패로 바꾸는 좋은
  패턴.
- `test_consistency_bundle_priority.CollectContextUsesPriorityTest` 의 스파이가 "호출 여부"가
  아니라 "반환값 사용 여부(효과)"를 sentinel 정렬로 단언하도록 설계돼 있고, 그 이유를 주석에
  정확히 남겼다(pass-through 뮤턴트가 호출-횟수 스파이는 통과시키지만 효과-단언은 못 속인다는
  것을 실측 6번 항목에서 직접 재확인).
- `test_prompt_omission_notice.py::test_notices_are_paid_for_out_of_the_same_budget` 는 과거
  실측된 정확한 초과값(143,620 vs cap 143,605)을 회귀 케이스로 고정했고, 뮤테이션 검증에서
  동일 실패 패턴(다른 배율로)이 재현됨을 확인했다 — 고정된 커밋에 의존하지 않는 결정적 fixture라
  "회귀 테스트" 관점에서 우수하다(그 파일 docstring이 명시하듯, 기존 `test_line_anchors` 회귀
  테스트는 실제 git 히스토리에 의존해 drift 위험이 있었다).
- 프로세스 격리: `test_stop_guard_failopen.SuiteLeavesNoRealStateTest` 가 스위트 실행 후 실제
  저장소에 fail-open state 파일이 남지 않았는지 검증하는 위생 테스트를 두고 있어(이 PR 의 신규
  in-flight 분리 테스트들도 전부 `CLAUDE_PROJECT_DIR` 임시 디렉터리로 격리), 테스트 간 상태 누수
  위험이 낮다. 전체 스위트(695 tests)를 한 프로세스에서 discover 실행해도 그린이었다.
- 회귀 관점: 변경된 `evaluate_review` 시그니처의 실제 호출부는 저장소 전체에서
  `guard_review_before_stop.py:344`(`in_flight_ok=True`)와 `guard_review_before_push.py` 의
  `_evaluate_over_targets` 내부 `evaluate(target)`(kwarg 없음) 두 곳뿐임을 grep 으로 확인했고,
  둘 다 대응 테스트가 있다 — 시그니처 변경에 따른 고아 호출부는 없다.

## 요약

핵심 수정 4건(in-flight 억제의 push/stop 스코프 분리, consistency 번들 우선순위 재배열, 리뷰
프롬프트 생략-안내, 기본 changeset 누락 경고) 모두에 대해 회귀를 정확히 겨냥한 신규/확장 테스트가
동반됐고, 이 리뷰에서 7곳에 실제 뮤테이션을 주입해 전부 의도대로 RED 전환됨을 직접 확인했다 —
이 저장소가 과거 반복 지적한 "vacuous test"(호출 횟수만 세고 효과를 안 봄) 함정을 이번 PR 은
주석으로 그 위험을 명시하며 효과-단언 방식으로 스스로 방어하고 있다. 남은 갭은 전부 지엽적이다:
새로 추가된 두 git 기반 헬퍼(`_branch_changed_rels`, `_default_branch_ref`)의 "정상 동작 경로"
자체를 직접 단언하는 테스트가 없고(실제로는 정상 동작함을 별도 스모크로 확인했으나 회귀 방지력은
없음), 카탈로그 정규식의 앵커 분기·changeset 경고의 commit/files 모드 등 세부 분기 커버리지가
일부 비어 있다. "Critical 하향 금지" 정책의 기계적 backstop 부재는 이미 계획 문서에 추적된
사안으로 새 발견이 아니다.

## 위험도
LOW
