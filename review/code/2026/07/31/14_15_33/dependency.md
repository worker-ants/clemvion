# 의존성(Dependency) 리뷰 보고서

## 스코프 확인

`git diff origin/main...HEAD --stat` 로 실제 변경분을 직접 대조했다 (프롬프트에서 크기 제한으로
컨텍스트가 비었던 파일 2/5/7/8/10 은 `Read`/`git diff` 로 직접 열람):

```
.claude/agents/consistency-summary.md                                    |  23 +-
.claude/hooks/_lib/review_guard.py                                       |  54 ++-
.claude/hooks/guard_review_before_stop.py                                |   6 +-
.claude/skills/code-review-agents/SKILL.md                                |   7 +-
.claude/skills/code-review-agents/scripts/code_review_orchestrator.py    | 228 +++++++++-
.claude/skills/consistency-checker/SKILL.md                               |  15 +-
.claude/skills/consistency-checker/scripts/consistency_orchestrator.py   | 139 +++++++-
.claude/tests/README.md                                                  |   3 +
.claude/tests/test_consistency_bundle_priority.py                        | 364 +++++++++ (신규)
.claude/tests/test_guard_review_before_push_main.py                      |  42 +-
.claude/tests/test_prompt_omission_notice.py                             | 250 ++++++ (신규)
.claude/tests/test_review_changeset_warning.py                           | 207 +++++ (신규)
.claude/tests/test_review_guard_hardening.py                             |  22 +-
.claude/tests/test_stop_guard_failopen.py                                |  28 +-
plan/in-progress/harness-consistency-summary-downgrade-rule.md            |  47 +-
plan/in-progress/harness-review-gate-ci-backstop.md                       | 104 +-
```

전부 `.claude/**`(하네스 자체 Python 훅/스킬/오케스트레이터·테스트·에이전트 정의)와
`plan/**`(문서)이다. `codebase/**`, `package.json`, `pnpm-lock.yaml`, `requirements.txt`,
`pyproject.toml`, 그 외 어떤 lockfile 도 `git diff --name-only` 상 이 변경에 포함되지 않는다
(직접 확인).

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 전 diff stdlib-only 확인
  - 위치: 전체 diff (16개 파일)
  - 상세: 이번 라운드에 신설/확장된 모든 Python 코드의 `import`/`subprocess.run` 호출을
    전수 대조했다. 신규·확장 함수(`_omitted_content_note:561`/`_default_branch_ref:1190`/
    `warn_if_committed_work_is_missing:1214`/`_aggregate_omission_note:1254` —
    `code_review_orchestrator.py`, `_is_catalog_bulk:251`/`_branch_changed_rels:255`/
    `prioritize_bundle_files:281` — `consistency_orchestrator.py`)는 전부 각 파일에
    이미 있던 `os`/`re`/`subprocess`/`sys` stdlib 와 기존 헬퍼(`_git`,
    `get_git_branch_diff_files`, `debug_log`, `line_anchors.truncate_to_line_boundary`)만
    사용한다. 신규 테스트 파일 3개(`test_consistency_bundle_priority.py`,
    `test_prompt_omission_notice.py`, `test_review_changeset_warning.py`, 합계 800줄 이상)도
    `json`/`subprocess`/`sys`/`textwrap`/`unittest` + 내부 `_harness` 모듈만 import 한다.
    `subprocess.run` 호출 대상은 전부 `git` 아니면 `sys.executable`(fresh-interpreter 테스트
    패턴이 자기 자신을 재실행하는 것)이고 신규 외부 CLI 도구는 없다. `.claude/tests/README.md:14-17`
    이 명시하는 "하네스 Python 은 표준 라이브러리만 사용, `pytest`/`requirements.txt` 도입 금지"
    관례가 이번 확장분에도 유지된다.
  - 제안: 없음 — 현 상태 유지 권장.

- **[INFO]** 버전 고정(pinning)/라이선스/알려진 취약점 — 해당 없음
  - 위치: 전체 diff
  - 상세: 신규 패키지 매니페스트·lockfile 변경이 전혀 없으므로 버전 pinning, 라이선스 호환성,
    CVE 벡터 어느 것도 이번 변경으로 발생하지 않는다.
  - 제안: 없음.

- **[INFO]** 내부 API 확장 — `evaluate_review()` 키워드 전용 인자 추가 (하위 호환)
  - 위치: `.claude/hooks/_lib/review_guard.py:862` 함수 `evaluate_review`
    (`in_flight_ok: bool = False` 신설) / 호출부 `.claude/hooks/guard_review_before_stop.py`
    함수 `_run` (`evaluate_review(in_flight_ok=True)`로 변경)
  - 상세: push 가드(`guard_review_before_push.py`)와 stop 가드가 공유하는 내부 함수의 시그니처를
    넓히는 변경이다. 기본값이 `False`라 push 가드 호출부는 무변경으로 이전 동작을 유지하고,
    `EvaluateInFlightShortCircuitTest`(양방향: `test_push_path_still_blocks_while_in_flight` /
    `test_stop_path_opts_in_and_is_allowed`) + `test_stop_passes_in_flight_opt_in` /
    `test_push_never_opts_into_the_in_flight_concession`(seam 자체가 kwarg 를 실제로 전달하는지)로
    회귀가 봉쇄돼 있다. 순수 내부 모듈 간 계약 조정이며 외부 패키지 인터페이스와 무관하다.
  - 제안: 없음 — 참고용 기록.

- **[INFO]** 내부 의존성 중복 — "origin 기본 브랜치 해석" 로직이 3~4곳에 독립 구현 (이미 추적됨)
  - 위치: `.claude/hooks/_lib/branch_guard.py` 함수 `_origin_default_branch` /
    `.claude/hooks/_lib/review_guard.py:201` 함수 `_default_branch` (위를 위임 호출, import
    실패 시 fallback) / `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1190`
    함수 `_default_branch_ref` (이번 diff 신설) /
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:449`
    `args.diff_base or "origin/main"` 리터럴
  - 상세: 이번 diff 가 신설한 `_default_branch_ref()`는 "기본 브랜치 판정"의 세 번째(사실상 네
    번째) 독립 구현이다. 반환 계약도 서로 다르다 — `_origin_default_branch`/`_default_branch`는
    bare 브랜치명(`"main"`)을, `_default_branch_ref`는 `"origin/main"` prefix 포함 ref 를,
    `consistency_orchestrator`는 `--diff-base` 미지정 시 동적 판정 없이 리터럴 문자열
    `"origin/main"`을 그대로 쓴다. 저장소 기본 브랜치 정책이 바뀌면(예: `main`→`trunk`) 4곳을
    모두 손으로 맞춰야 하는 drift 위험이 이미 존재한다. 다만 이 관측은 새로운 것이 아니라
    `plan/in-progress/harness-review-gate-ci-backstop.md`(§신규 후속 defer, "origin 기본 브랜치
    해석" 항목)가 정확히 같은 4곳을 이미 지목하고, 통합이 보류된 구조적 이유(`_lib` 네임스페이스
    충돌 해소가 선행돼야 함)까지 명시해 뒀다. 이번 diff 는 그 목록의 구현 개수를 하나 늘렸을
    뿐 새로 만든 문제는 아니다.
  - 제안: plan 에 이미 추적 중이므로 이번 PR 에서 추가 조치는 불요. 다음에 이 영역을 만지는
    사람을 위해 `_default_branch_ref` 근처에 "다른 3곳: branch_guard/review_guard/
    consistency_orchestrator — 통합 보류 사유는 plan 참조" 같은 짧은 상호참조 주석을 남기면
    향후 drift 를 줄일 수 있다.

- **[INFO]** 내부 의존성 중복 — git 브랜치-diff 헬퍼가 두 orchestrator 에 중복 (이미 추적됨)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 함수
    `get_git_branch_diff_files` (기존) / `.claude/skills/consistency-checker/scripts/
    consistency_orchestrator.py:255` 함수 `_branch_changed_rels` (이번 diff 신설)
  - 상세: 두 함수 모두 "이 브랜치가 diff-base 대비 변경한 파일 목록"을 구하는 같은 git 연산
    (`git diff --no-renames --name-only <base>...HEAD`)을 각자 구현한다. `_branch_changed_rels`
    자신의 docstring 이 "Mirrors `code_review_orchestrator.get_git_branch_diff_files` (same
    flags, same three-dot rationale, different failure default) — change both"라고 명시해
    중복을 스스로 인지하고 있다. `harness-review-gate-ci-backstop.md`(§신규 후속 6번)에 동일
    항목이 이미 등재돼 있고, 통합은 위 기본 브랜치 항목과 같은 이유(`_lib` 네임스페이스 충돌)로
    보류돼 있다.
  - 제안: 이미 추적 중, 이번 PR 조치 불요.

- **[INFO]** 테스트 보일러플레이트 중복 — fresh-interpreter 패턴이 4개 테스트 파일에 반복
  (이번 diff 로 3곳 신설, 이미 추적됨)
  - 위치: `.claude/tests/test_consistency_bundle_priority.py` / `.claude/tests/
    test_prompt_omission_notice.py` / `.claude/tests/test_review_changeset_warning.py`
    (셋 다 이번 diff 신설, 각자 `_PREAMBLE`+`run_in_orchestrator` ~35줄 보유) / 기존
    `test_consistency_context_budget.py`
  - 상세: `_lib` 네임스페이스 충돌을 피하려고 오케스트레이터를 `importlib.util.
    spec_from_file_location` 으로 별도 서브프로세스에 로드하는 보일러플레이트가 이번 diff 로
    3개 파일에 새로 추가돼(기존 1개 포함 총 4개) 그대로 복제됐다.
    `harness-review-gate-ci-backstop.md`(§신규 후속 7번)가 정확히 "fresh-interpreter 테스트
    보일러플레이트가 4개 파일에 복제"로 이미 지목했고 `_harness.py` 로의 추출을 제안해 뒀다 —
    이번 diff 는 그 예측대로 중복 인스턴스를 늘렸을 뿐 새 결함은 아니다.
  - 제안: 추적된 후속 작업대로 공유 헬퍼 추출 시점에 한 번에 정리 권장. 이번 PR 단독으로
    막을 사유는 아니다 — 각 신규 테스트가 독립적으로 정확하고, 세 번째 사례가 생겼다고 바로
    리팩터링을 요구하면 이번 PR 의 스코프(리뷰 게이트 결함 수정)를 벗어난 요구가 된다.

- **[INFO]** 서브프로세스(git) 호출 증가 — 신규 외부 도구 아님, 성능 영향 무시 가능
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:255`
    `_branch_changed_rels` / `.claude/skills/code-review-agents/scripts/
    code_review_orchestrator.py:1190` `_default_branch_ref`
  - 상세: 두 오케스트레이터 모두 이미 같은 파일에서 git 을 여러 차례 셸아웃하고 있었고
    (`_collect_code_diff`, `_git` 헬퍼 등), 이번 diff 로 호출당 1~2회 늘었을 뿐이다. git 자체가
    이 하네스 전반의 hard dependency 이므로 "새 의존성"은 아니다. 오히려
    `consistency_orchestrator.collect_context`는 `_rank_changed`를 **함수당 1회만** 계산해
    각 번들(scope/related_specs/conventions/plan_in_progress)에서 재사용하도록 설계됐다
    (코드 주석: "one git call serves all three bundles instead of one per bundle") — 번들마다
    git 을 다시 부르던 방식보다 오히려 호출 수를 줄이는 방향. timeout(`30.0`/`5.0`)과 실패 시
    조용히 빈 집합/`None` 리턴하는 fail-soft 경로도 기존 패턴과 동일하게 갖춰져 있다.
  - 제안: 없음 — 성능 영향이 우려되면 performance reviewer 소관.

## 요약

이번 diff(16개 파일)는 `.claude/hooks/**`·`.claude/agents/**`·`.claude/skills/*/scripts/**`·
`.claude/tests/**`·`plan/in-progress/**`에 국한된 하네스 자체 리뷰/일관성 게이트 로직 수정이며,
`codebase/**`나 패키지 매니페스트/lockfile 은 전혀 건드리지 않는다. 신설된 3개 테스트 파일을
포함해 확장·신설된 모든 Python 코드의 import·서브프로세스 호출을 전수 대조한 결과 새 외부 패키지
도입은 없고, `.claude/tests/README.md`가 명시하는 "하네스 Python 은 표준 라이브러리만" 관례가
그대로 유지됐다. 유일하게 주목할 지점은 내부 의존성(점검 관점 8번) 축인데, (1) `evaluate_review()`
키워드 인자 확장은 하위 호환·양방향 seam 테스트로 안전하게 봉쇄돼 있고, (2)~(4) "기본 브랜치
판정"·"브랜치 diff 파일 목록"·"fresh-interpreter 테스트 보일러플레이트"의 중복은 전부 이번 diff
가 만든 새 문제가 아니라 `plan/in-progress/harness-review-gate-ci-backstop.md`가 정확한 위치까지
지목하며 이미 추적·의도적으로 defer 한 기술 부채이고, 통합이 보류된 구조적 이유(`_lib`
네임스페이스 충돌 선행 해소 필요)도 문서화돼 있다. 라이선스·버전 고정·알려진 취약점·번들
크기/빌드 시간 영향은 모두 해당 없음(N/A) — 순수 개발자 워크플로용 로컬 스크립트라 프로덕션
런타임 번들에 포함되지 않는다. 의존성 관점에서 이번 PR 을 막을 조치는 없다.

## 위험도

NONE
