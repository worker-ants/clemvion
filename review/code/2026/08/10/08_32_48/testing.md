# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** 신규 함수 `worktree_changed_files` 에 격리된 전용 단위 테스트가 없다
  - 위치: `.claude/_shared/git_probe.py:263` (함수 `worktree_changed_files`, 정의부 263~300줄)
  - 상세: 이번 diff 로 추가된 신규 git probe다. 형제 함수 `branch_diff_files` 는
    `.claude/tests/test_branch_diff_shared.py` 에 `SharedProbeContractTest`·`UndecodableGitOutputTest`
    등 전용 스위트가 있어 `on_error` 콜백, surrogateescape 디코딩, narrow-except 경계,
    trailing-space/rename/non-ASCII 케이스까지 `_harness.make_temp_git_repo` 격리 픽스처로
    직접 검증된다. 반면 `worktree_changed_files` 를 직접 호출하는 테스트는 저장소 전체에
    하나도 없다(`grep -rn "worktree_changed_files" .claude/tests/*.py` 결과 0건). 유일한
    커버리지는 소비자 `consistency_orchestrator._edited_rels` 를 거친 간접 경로
    (`.claude/tests/test_consistency_bundle_priority.py::TheDocumentBeingEditedIsNeverOmittedTest`)뿐이고,
    그 경로조차 `_harness.make_temp_git_repo` 를 쓰지 않고 실제 저장소의 추적 파일
    (`spec/5-system/7-llm-client.md`)을 직접 편집·복원하는 방식이다. 그 결과 staged 변경,
    rename(목적지 경로 보고), `git status` 실패 시 `on_error` 콜백 호출 등은 전혀 검증되지
    않는다. `_porcelain_path` 자체는 `test_review_guard_hardening.py` 로 잘 커버돼 있지만,
    "`-uall`+`_porcelain_path` 조합으로 워킹트리 전체를 정확히 나열하는가" 라는
    `worktree_changed_files` 고유의 계약은 아직 아무도 pin 하지 않았다.
  - 제안: `test_branch_diff_shared.py::SharedProbeContractTest`/`UndecodableGitOutputTest` 패턴을
    그대로 따라 `worktree_changed_files` 전용 테스트(격리 temp repo에서 staged/rename/untracked-dir
    케이스, git 실패 시 `on_error` 호출)를 추가한다.

- **[WARNING]** `_n_on_topic` 의 tier-1(브랜치 plan 언급) 분기가 어떤 테스트에서도 켜지지 않는다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:535` (함수 `_n_on_topic`, `collect_context` 내부 클로저)
  - 상세: `--impl-done` 모드에서 diff 청크를 어디에 splice 할지 정하는 `_n_on_topic` 은
    `rel in changed`(tier 0) 뿐 아니라 `not _is_catalog_bulk(rel) and _named_in(rel, _rank_branch_plan_text)`
    (tier 1, 브랜치 plan 이 언급한 파일)도 "on-topic" 으로 카운트한다. 그런데
    `TheDiffOutranksTheFolderDumpTest.test_the_diff_sits_right_after_the_on_topic_files` 는
    `orch._branch_changed_rels` 만 패치해 tier 0 케이스만 확인하고, `branch_plan_text` 를
    채운 채로 tier 0 이 빈 상태(예: `--impl-prep` 처럼 아직 아무것도 안 고친 상태에서 plan만
    있는 경우)를 검증하는 테스트가 없다. 이 OR 절을 통째로 지우는 뮤턴트가 있어도 현재
    스위트는 GREEN 을 유지한다 — `prioritize_bundle_files` 자체의 tier 1 로직은
    `ThisBranchsPlanOutranksEveryOtherPlanTest` 로 잘 pin 돼 있지만, `_n_on_topic` 이 그
    tier 1 을 실제로 반영하는지는 별개로 검증돼야 한다(파일 상단 다른 테스트들이 이미
    "호출부 계약" — 헬퍼가 옳아도 호출부가 안 쓰면 결함은 그대로라는 원칙을 명시적으로
    지켜온 것과 같은 이유).
  - 제안: `_branch_changed_rels` 는 빈 집합으로 두고 `branch_plan_text` 만 특정 파일을
    언급하도록 만든 뒤, `collect_context` 의 `target_doc` 에서 그 파일이 diff 바로 앞
    tier 에 포함되는지 pin 하는 케이스를 `TheDiffOutranksTheFolderDumpTest` 에 추가한다.

- **[WARNING]** `create_session_dir` 의 소진(exhaustion) 폴백 경로가 미검증
  - 위치: `.claude/skills/code-review-agents/lib/session.py:69-82` (함수 `create_session_dir`)
  - 상세: 이번 diff 로 새로 생긴 재시도 루프 전체(`_MAX_SESSION_NAME_ATTEMPTS = 50`)와
    그 안의 `except OSError: break` → 이후 `os.makedirs(session_dir, exist_ok=True)` 폴백은
    어떤 테스트에서도 실행되지 않는다. `test_review_session_dir_collision.py` 는 최대
    3연속 충돌까지만 검증한다(`test_a_third_session_gets_its_own_directory_too`). 이
    함수의 docstring 은 "세션 디렉터리를 잃는 것보다 리뷰를 아예 못 돌리는 게 더 나쁘다"는
    것을 폴백의 존재 이유로 명시하는데, 정작 그 폴백이 실제로 (a) 50회 소진 후 plain stamp
    를 재사용하고 (b) `FileExistsError` 가 아닌 다른 `OSError`(권한 오류 등) 발생 시 즉시
    루프를 빠져나오는지는 어떤 assertion 으로도 확인되지 않는다. 이 두 분기를 삭제/역전하는
    뮤턴트가 있어도 현재 스위트는 GREEN 이다.
  - 제안: (1) `session._MAX_SESSION_NAME_ATTEMPTS` 를 테스트에서 작은 값으로 monkeypatch 하고
    그만큼 디렉터리를 미리 만들어 소진시킨 뒤 plain stamp 로 폴백(`exist_ok=True` 재사용)함을
    확인하는 테스트, (2) `os.makedirs` 를 mock 해 `PermissionError` 등 `OSError` 를 주입했을 때
    즉시 폴백으로 빠지는지(무한 루프하지 않는지) 확인하는 테스트를 추가한다.

- **[INFO]** 워킹트리 검증 테스트가 격리 fixture 대신 실제 추적 파일을 직접 mutate
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:487-519` (클래스 `TheDocumentBeingEditedIsNeverOmittedTest`, staticmethod `_rank_of_an_uncommitted_edit`)
  - 상세: 같은 리뷰 세트의 `BranchChangedRelsAgainstRealGitTest`(`test_consistency_bundle_priority.py`
    내)와 `test_branch_diff_shared.py` 전체는 `_harness.make_temp_git_repo` 로 매번 새 임시
    저장소를 만들어 완전히 격리된 상태에서 검증한다. 반면 이 클래스는 실제 저장소의 추적
    파일 `spec/5-system/7-llm-client.md` 에 직접 append 한 뒤 `shutil.copy` 로 복원하는
    방식을 쓴다. `try/finally` + 전용 `test_the_probe_leaves_no_residue` 테스트로 위험은
    상당히 완화돼 있어 CRITICAL 급은 아니지만, (a) 크래시·강제종료 시 작업트리를 오염시킬
    잔여 위험이 격리 fixture보다 크고, (b) 실제 파일 하나만 조작 가능하므로 staged 변경이나
    rename 같은 다른 워킹트리 상태는 이 경로로 커버할 수 없어 위 `worktree_changed_files`
    커버리지 갭과 맞물린다.
  - 제안: 여력이 되면 `_harness.make_temp_git_repo` 기반으로 전환해 더 다양한 워킹트리
    상태(staged, renamed)를 안전하게 pin. 최소한 현재 방식을 유지한다면 이 갭이 의도적
    trade-off임을 클래스 docstring에 한 줄 남겨두는 편이 다음 리뷰에서 같은 지적이
    반복되는 것을 막는다.

## 요약

이번 diff의 테스트 설계 수준은 전반적으로 높다 — `test_consistency_context_budget.py`/
`test_consistency_bundle_priority.py`는 실측 수치를 근거로 픽스처 크기를 정하고, 알려진
미살해 뮤턴트를 문서화하며, "헬퍼가 옳아도 호출부가 안 쓰면 결함은 그대로"라는 원칙 아래
호출부 계약까지 별도로 pin하는 등 이 저장소의 mutation-testing 관행을 충실히 따른다.
`test_review_session_dir_collision.py`는 `datetime.now()` 고정으로 같은-초 충돌을
결정적으로 재현하고, 프런트엔드의 `plan-link-integrity.test.ts`/`spec-plan-completion.test.ts`는
ratchet(baseline) 패턴으로 신규 회귀 0건 + 이미 고쳐진 항목의 잔존 0건을 동시에 강제해
군더더기 없이 설계돼 있다. 다만 이번 diff로 새로 들어온 코드 경로 세 곳
— `git_probe.worktree_changed_files`의 격리 단위 테스트, `_n_on_topic`의 tier-1(branch-plan)
분기, `create_session_dir`의 50회 소진 폴백 — 은 커버리지가 비어 있거나 실제 저장소를
직접 건드리는 우회 경로로만 간접 검증된다. 셋 다 뮤턴트가 살아남아도 현재 스위트가
GREEN을 유지하는 형태라, 다음 라운드에서 조용히 회귀할 위험을 안고 있다.

## 위험도

LOW
