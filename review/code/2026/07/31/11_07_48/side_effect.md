# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** `warn_if_committed_work_is_missing()` / `_default_branch_ref()` 가 자신의 독스트링이
  약속한 "무실패(fail-silent)" 계약을 어기고, git 서브프로세스 실패 시 처리되지 않은 예외를
  `--prepare` 의 기본(가장 흔한) 경로 전체로 전파할 수 있음.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` —
    `_default_branch_ref()` (1092행), `warn_if_committed_work_is_missing()` (1104행, 특히
    `base = _default_branch_ref()` 1120행), 호출부 `collect_change_infos()` 1182행
    (`warn_if_committed_work_is_missing(files)`).
  - 상세: `warn_if_committed_work_is_missing`의 독스트링은 "Advisory only — never blocks, never
    changes the changeset... Silent on any git failure: a review must not fail because the
    warning could not be computed."라고 명시한다. 그러나 `_default_branch_ref()`는
    `_git(["git", "symbolic-ref", ...])` / `_git(["git", "rev-parse", ...])` 호출
    (`subprocess.run(..., timeout=10)`)을 try/except 없이 그대로 사용한다. 같은 파일의 다른
    모든 git 헬퍼(`get_git_diff_files`, `get_git_range_files`, `get_git_branch_diff_files`,
    `get_git_commit_files` 등)는 예외 없이 전부 `try/except Exception` 으로 감싸져 있고,
    같은 커밋 계열에서 추가된 자매 함수 `consistency_orchestrator._branch_changed_rels`
    (`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249`) 도 동일한
    subprocess 호출을 `try/except Exception` 으로 감싼다 — 이 함수만 그 관례에서 벗어난다.
    `git` 실행 파일 부재(`FileNotFoundError`) 또는 잠금 경합·대형 저장소에서의 지연으로 인한
    `subprocess.TimeoutExpired` 가 발생하면 예외가 `warn_if_committed_work_is_missing` →
    `collect_change_infos` → `main()` 까지 그대로 전파되어, 인자 없는 기본 `--prepare` 호출
    (코드 리뷰 세션 준비의 가장 흔한 진입점) 전체가 트레이스백과 함께 비정상 종료된다 — "리뷰
    준비를 돕는 advisory 헬퍼"가 리뷰 준비 자체를 막는, 정확히 독스트링이 부인하는 부작용이다.
    실제로 재현 확인: `subprocess.run` 을 예외를 던지도록 몽키패치한 뒤
    `warn_if_committed_work_is_missing(['a.ts'])` 를 호출하면 `FileNotFoundError` 가 그대로
    전파됨(테스트로 격리되지 않은 새 코드 경로). 신설된 테스트
    `test_review_changeset_warning.py::test_silent_when_the_base_cannot_be_resolved` 는
    `orch._default_branch_ref` 자체를 `None` 반환으로 몽키패치해 "resolve 실패(non-zero
    return)" 케이스만 확인할 뿐, `_git()` 호출이 예외를 던지는 케이스는 어떤 테스트도 다루지
    않는다.
  - 제안: `_default_branch_ref()` 본문(또는 `warn_if_committed_work_is_missing()` 전체)을
    `try/except Exception` 으로 감싸 실패 시 `None`/조용한 return 으로 폴백 — 같은 파일의 다른
    git 헬퍼 및 `_branch_changed_rels` 와 동일한 패턴. 회귀 방지용으로 `subprocess.run` 이
    예외를 던지는 케이스에 대한 테스트를 `test_review_changeset_warning.py` 에 추가할 것.

- **[INFO]** `evaluate_review()` 시그니처 확장(`cwd: str | None = None, *, in_flight_ok: bool =
  False` 신설)은 호출자 전수 확인 결과 안전함 — 검증 완료, 조치 불요.
  - 위치: `.claude/hooks/_lib/review_guard.py:858-859` (정의), 호출부
    `.claude/hooks/guard_review_before_push.py:846`(위치 인자 `target` 만 전달 →
    `in_flight_ok` 는 기본값 `False` 유지, 이번 fix 의 의도와 일치)와
    `.claude/hooks/guard_review_before_stop.py:344`(`in_flight_ok=True` 명시 전달).
  - 상세: 저장소 전체에서 `evaluate_review(...)` 의 실제 호출자는 이 둘뿐임을 grep 으로 확인.
    `guard_review_before_push.py` 의 `_accepts_cwd()` introspection(POSITIONAL_ONLY /
    POSITIONAL_OR_KEYWORD / VAR_POSITIONAL 판별)도 `cwd` 파라미터가 여전히
    POSITIONAL_OR_KEYWORD 로 남아 있어 영향 없음. 기존 `_code_review_in_flight` 무조건 억제가
    push 가드까지 열던 결함의 의도된 수정이며, `.claude/tests` 전체 스위트(684건) 통과 확인.

- **[INFO]** `consistency_orchestrator.collect_context()` 의 번들 재정렬(`prioritize_bundle_files`)
  적용이 `--spec`/`--plan` 모드에도 조용히 확장됨 — plan 기록상 의도된 설계로 보이나 인지 필요.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:427-430`
    (`_rank_diff_base`/`_rank_plan_text` 모드 무관 선계산), `555-558`
    (`other_spec_files`/`convention_files` 재정렬 — if/elif 모드 분기 밖, 4개 모드 공통 경로).
  - 상세: `_branch_changed_rels()`(신규 git subprocess 호출)와 전체 `plan/in-progress/*.md`
    읽기가 이제 `--spec`/`--plan` 호출에서도 매번 실행된다 — 이전에는 이 두 모드에서
    `collect_context` 가 git 을 전혀 호출하지 않았다. `plan/in-progress/harness-consistency-
    summary-downgrade-rule.md` 는 "적용 지점: --impl-prep/--impl-done 의 scope 번들 +
    related_specs + conventions" 라고 명시해 이 확장이 의도적임을 뒷받침하지만, 신규 테스트
    `test_consistency_bundle_priority.py::CollectContextUsesPriorityTest` 는 `impl_prep`/
    `impl_done` 두 모드만 직접 검증한다. 실행 자체는 `_branch_changed_rels` 가 예외를
    안전하게 흡수(빈 set 반환)하므로 크래시 위험은 없음 — 정보 제공 목적.

## 요약

핵심 변경 3건(리뷰-in-flight 억제를 Stop 전용으로 스코프 축소하는 `evaluate_review(in_flight_ok=
...)` 시그니처 확장, `--prepare` 기본 경로의 커밋 누락 경고, consistency 번들 우선순위 재정렬)은
모두 의도한 목적에 부합하고 시그니처 변경의 호출자 영향은 전수 확인상 안전하며 기존 테스트
684건이 그대로 통과한다. 다만 신설된 `warn_if_committed_work_is_missing()`/`_default_branch_ref()`
는 스스로 명시한 "git 실패 시 침묵" 계약을 실제로는 지키지 못한다 — 같은 파일의 다른 모든 git
헬퍼 및 같은 커밋의 자매 함수(`_branch_changed_rels`)와 달리 subprocess 호출을 예외 처리 없이
노출해, 드물지만 실제 git 실패(바이너리 부재·타임아웃) 시 코드 리뷰 세션 준비 전체가 크래시할
수 있다. 나머지 변경(번들 우선순위 재정렬의 --spec/--plan 확장)은 문서화된 의도와 일치하는
저위험 확장이다.

## 위험도

MEDIUM
