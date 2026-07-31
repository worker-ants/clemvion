# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** 신규 `warn_if_committed_work_is_missing` 어드바이저리가 `--staged` 명시 스코프에도
  무조건 발동한다 — SKILL.md 가 `--staged` 를 `--commit`/`--range`/`--branch` 와 동급의 "명시적
  스코프 선택"으로 문서화하는데, 그 셋과 달리 `--staged` 만 이 경고에서 면제되지 않는다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` —
    `collect_change_infos()` 의 `else:` 분기, `warn_if_committed_work_is_missing(files)` 호출부
    (1270행). 정의는 `warn_if_committed_work_is_missing()` (1192행).
  - 상세: `collect_change_infos` 는 `args.commit`/`args.range`/`args.branch`/`args.files` 4가지
    명시 모드에서는 전부 이 경고를 호출하지 않고, 오직 마지막 `else:` (인자 없음 **및**
    `--staged`) 분기에서만 `warn_if_committed_work_is_missing(files)` 를 부른다. 그런데
    `--staged` 는 `--commit`/`--range`/`--branch` 와 마찬가지로 `code-review-agents/SKILL.md:42`
    (`--staged`, `--commit <ref>`, `--range <a>..<b>`, `--branch <base>`, 파일/디렉토리 경로) 및
    `:157`(`/ai-review --staged` 사용 예)에 명시된 **독립적인 명시 스코프 옵션**이다 — "인자
    없음"과는 다른, 사용자가 의도적으로 스테이징된 변경만 리뷰하겠다고 선택한 경우다. 실측
    확인(아래 재현 스크립트): `args.staged=True` 로 `collect_change_infos` 를 호출하면
    `warn_if_committed_work_is_missing` 이 여전히 1회 호출된다. 즉 `/ai-review --staged` 로
    스테이징된 변경만 검토하려는 사용자에게도 "N 개 파일이 변경됐지만 ... 개가 리뷰에서
    빠집니다 — `--branch <base>` 로 다시 돌리세요" 라는, 사용자의 명시적 의도와 배치되는 안내가
    stderr 로 출력된다. 신설된 `DefaultPathIsWiredTest` (`test_review_changeset_warning.py`)
    는 `mode=None`(진짜 무인자) 경로만 검증하고 `staged=True` 케이스는 어떤 테스트도 다루지
    않아 이 틈이 회귀 스위트로 걸러지지 않는다.
    재현:
    ```python
    orch.get_git_diff_files = lambda staged_only=False: []
    calls = []
    orch.warn_if_committed_work_is_missing = lambda f: calls.append(list(f))
    class Args:
        commit=range=branch=files=None
        staged=True
    orch.collect_change_infos(Args(), {"skip_extensions": set()})
    # calls == [[]]  — staged=True 인데도 advisory 가 호출됨
    ```
  - 제안: `else:` 분기 안에서 `warn_if_committed_work_is_missing` 호출을
    `if not args.staged:` 로 감싸 `--staged` 를 다른 3개 명시 스코프와 동일하게 면제하거나,
    반대로 의도적으로 포함시키려는 것이라면 `DefaultPathIsWiredTest` 에
    `test_staged_mode_does_not_warn`(또는 반대로 "경고함을 의도적으로 확인하는" 케이스)을 추가해
    이 분기를 문서화된 계약으로 고정할 것. 순수 advisory(비차단)라 심각도는 낮지만, 반복되면
    "명시 스코프인데도 계속 경고가 뜬다"는 신뢰 저하로 이어진다.

- **[INFO]** `evaluate_review(cwd=None) → evaluate_review(cwd=None, *, in_flight_ok=False)` 시그니처
  확장 — 호출자 전수 확인 결과 안전. 조치 불요, 검증 기록 목적.
  - 위치: 정의 `.claude/hooks/_lib/review_guard.py:862-864`. 호출부
    `.claude/hooks/guard_review_before_push.py:845-846`(`_evaluate_over_targets(evaluate_review,
    ...)` → 내부적으로 `evaluate(target)` 위치 인자만 전달, `in_flight_ok` 는 기본값 `False`
    유지) 및 `.claude/hooks/guard_review_before_stop.py:344`(`evaluate_review(in_flight_ok=True)`
    명시 전달).
  - 상세: 저장소 전체에서 `evaluate_review` 의 실제 호출자는 이 둘뿐(grep 확인, 테스트 제외).
    새 파라미터는 keyword-only(`*` 뒤)라 `guard_review_before_push.py:621`
    `_accepts_cwd()`(POSITIONAL_ONLY/POSITIONAL_OR_KEYWORD/VAR_POSITIONAL 만 검사)의 판별 대상이
    아니다 — `cwd` 는 여전히 POSITIONAL_OR_KEYWORD 로 남아 있어 워크트리별 스코핑 디스패치에
    영향 없음을 직접 재확인했다. 이 필드는 이 PR 의 핵심 의도된 수정
    (in-flight 억제가 무조건 적용돼 push 게이트까지 30분간 열리던 결함)이며, push 쪽은 절대
    opt-in 하지 않고 Stop 쪽만 opt-in 함을 `test_push_never_opts_into_the_in_flight_concession`
    (seam 파일에 `in_flight_ok` 실측 기록, `{"False"}`) 과
    `test_stop_passes_in_flight_opt_in`(`{"True"}`) 양쪽에서 실측 확인. 관련 132건 테스트
    (`test_review_guard_hardening.py` / `test_guard_review_before_push_main.py` /
    `test_stop_guard_failopen.py` / `test_consistency_bundle_priority.py` /
    `test_review_changeset_warning.py` / `test_prompt_omission_notice.py`) 및
    `test_line_anchors.py` 37건 직접 재실행해 전부 통과 확인.
  - 제안: 없음(검증 완료).

- **[INFO]** `--diff-base` 의 스코프가 `--impl-done` 전용에서 **전 모드 공통**(번들 우선순위
  산정)으로 확장된 점 — 직전 라운드(`review/code/2026/07/31/11_58_11/side_effect.md`)가
  WARNING(문서-동작 불일치)으로 지적했고, 이번 HEAD 에서 이미 해소됨을 확인.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:452`
    (`_rank_changed = _branch_changed_rels(diff_base, root)` — 모드 분기 밖, 4개 모드 공통 실행),
    `:581-582`(`other_spec_files`/`convention_files` 재정렬도 모드 분기 밖). 문서 갱신은
    `.claude/skills/consistency-checker/SKILL.md`(`--diff-base` 설명에 "전 모드 공통으로 번들
    우선순위 산정에도 쓰인다" 추가)와 CLI `--help` 텍스트(`consistency_orchestrator.py` 의
    `--diff-base` argparse help — "Used by --impl-done for its code-diff section, and by ALL
    modes to rank the context bundles") 양쪽에서 확인.
  - 상세: 실행 안전성은 원래도 문제 없었다 — `_branch_changed_rels` 는 git 실패 시 빈 set 을
    반환(fail-open)하므로 `origin/main` 이 로컬에 없는 환경에서도 크래시하지 않고 우선순위
    신호만 비운다. 이전 라운드가 지적한 "공개 계약(문서)과 실제 동작의 불일치"는 이번 HEAD 에서
    문서 양쪽이 갱신돼 해소됐다.
  - 제안: 없음(해소 확인).

- **[INFO]** `build_files_section` 의 생략 안내(`_omitted_content_note`) 삽입이 `max_total_size`
  예산 계약을 위반하던 CRITICAL(직전 라운드 발견, `test_prompt_stays_within_the_size_cap` 재현
  실패) 이 이번 HEAD 에서 해소됨을 재확인.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:693-736`
    (생략 안내분을 전체 파일에 대해 선반영(reserve)한 뒤 콘텐츠를 포함시킬 때마다 해당 파일 몫만
    환급(refund)하는 회계 로직).
  - 상세: `test_line_anchors.py::PromptPayloadIntegrationTest::test_prompt_stays_within_the_size_cap`
    (37건 전체) 및 `test_prompt_omission_notice.py::test_notices_are_paid_for_out_of_the_same_budget`
    를 직접 재실행해 통과 확인 — 생략 파일 수에 비례해 예산을 초과하던 회귀가 재현되지 않는다.
  - 제안: 없음(해소 확인).

- **[INFO]** `consistency_orchestrator.collect_context()` 에 신규 무조건 `git diff` subprocess 호출
  (`_branch_changed_rels`, 30 초 timeout) + `plan/in-progress/**` 전체 파일 읽기가 4개 모드
  (`--spec`/`--plan`/`--impl-prep`/`--impl-done`) 공통 경로로 추가됨 — 이전에는 `--spec`/`--plan`
  경로가 git 을 전혀 호출하지 않았다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:452-455`
    (`_rank_changed`/`_rank_plan_text` 최상단 선계산, if/elif 모드 분기 밖).
  - 상세: 함수당 1회로 억제돼 있고(`_prioritized` 헬퍼가 prefix 필터로 파생, 재-spawn 없음),
    `_branch_changed_rels` 자체는 예외를 흡수해 빈 set 반환(크래시 위험 없음). `collect_context`
    호출부(`main()`)도 `try/except Exception` 로 감싸져 있어 이중 안전. 순수 지연시간/IO 증가일
    뿐 기능 고장 위험은 없음 — 설계 의도(SKILL.md 갱신 확인)와 일치.
  - 제안: 없음 — 정보 제공 목적.

## 검증

- 직접 재실행: `test_review_guard_hardening.py`(47) / `test_guard_review_before_push_main.py`(38) /
  `test_stop_guard_failopen.py`(17) / `test_consistency_bundle_priority.py`(13) /
  `test_review_changeset_warning.py`(11) / `test_prompt_omission_notice.py`(6) — 132건 전부
  통과. `test_line_anchors.py` 37건 전부 통과(직전 라운드 CRITICAL 회귀 없음 재확인).
- `evaluate_review`/`review_guard` 호출자 전수 grep — 두 훅 외 실 호출자 없음, 시그니처 확장
  안전 재확인.
- `--staged` 시나리오 실측 재현 스크립트(위 발견사항 참조) — `collect_change_infos(Args(staged=
  True, ...))` 호출 시 `warn_if_committed_work_is_missing` 이 여전히 호출됨을 직접 확인.
- `git status --porcelain` 로 조사 중 신규 미추적 파일이 남지 않았음을 확인(스크래치 조사가
  실제 저장소에 부작용을 남기지 않음).
- 직전 두 라운드(`review/code/2026/07/31/11_07_48`, `review/code/2026/07/31/11_58_11`)의
  side_effect CRITICAL 1건 + WARNING 2건을 현재 HEAD 코드와 대조 — 전부 해소 확인(재발 없음).

## 요약

이 PR 의 핵심 부작용 표면 3가지 — (1) `evaluate_review(in_flight_ok=...)` 로 in-flight 억제를
Stop 전용으로 좁힌 시그니처 확장, (2) 커밋 누락 경고(`warn_if_committed_work_is_missing`), (3)
consistency 번들 우선순위 재정렬(`prioritize_bundle_files`, 전 모드 공통 git 호출 포함) — 은
호출자 영향·fail-open 안전성 모두 실측 검증됐고, 직전 두 라운드에서 발견된 CRITICAL 1건(예산
계약 위반)과 WARNING 2건(`_default_branch_ref` 예외 미흡수, `--diff-base` 문서-동작 불일치)은
이번 HEAD 에서 전부 해소됐음을 코드 대조와 테스트 재실행으로 확인했다. 다만 이번 라운드에서
새로 발견한 것으로, `--staged` 가 SKILL.md 상 `--commit`/`--range`/`--branch` 와 동급의 명시
스코프 옵션임에도 신규 어드바이저리에서만 면제되지 않아 `/ai-review --staged` 사용자에게
의도와 배치되는 stderr 경고가 뜨는 결함이 남아 있다 — 비차단·advisory-only 라 심각도는
낮지만 테스트로 고정되지 않은 실제 동작 갭이다.

## 위험도

LOW
