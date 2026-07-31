# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** `build_files_section` 의 세 번째(정상) 분기에만 "생략 고지"를 붙였고, 구조가 거의 동일한 두 번째 분기는 그대로 방치돼 같은 결함 클래스가 남아 있다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:644` (`if base_size >= max_total_size:` 분기, 특히 654행 `sections = [fp["header"] + fp["diff"] for fp in file_parts]`) vs 같은 함수의 701행 `elif fp["full_content"]:` (이번에 추가된 고지 분기)
  - 상세: 이 PR 의 목적 자체가 "예산 밖으로 밀린 파일이 아무 표시 없이 통째로 누락되는" 결함을 고치는 것이다(`_omitted_content_note`, 커밋 메시지, `test_prompt_omission_notice.py`). 그런데 `build_files_section` 은 예산 초과를 처리하는 코드 경로가 사실상 두 갈래다 — (a) `header+diff` 만으로도 이미 예산을 넘는 경우(644행, diff 를 깎아 넣고 `full_content` 는 아예 참조하지 않은 채 반환), (b) `header+diff` 는 들어가지만 `full_content` 예산이 모자란 경우(672행 이후, 이번에 `_omitted_content_note` 로 고쳐진 곳). (a) 분기는 `git show origin/main:...` 로 대조해도 이번 diff 에서 손대지 않은 코드이며, `full_content` 가 있어도 654행에서 조용히 버려진다 — 정확히 이 PR 이 없애려는 "31바이트 섹션, 표시 없음" 증상이 다른 진입 지점을 통해 그대로 재현될 수 있다. 새로 추가된 테스트(`test_prompt_omission_notice.py`)의 fixture(`SMALL/BIG/BIGGER`, `_MAX=2000`)는 (b) 분기만 거치므로 이 갭을 검출하지 못한다.
  - 제안: (a) 분기의 최종 `sections` 조립에도 `fp["full_content"]` 가 있는 파일에 대해 동일한 `_omitted_content_note` (혹은 그 축약형)를 붙이거나, 최소한 "diff 조차 예산 초과라 문서 전체가 생략됨"을 알리는 별도 고지를 추가할 것. 세 곳에 흩어진 "header+diff(+content)" 조립 로직(632, 654, 696행)을 단일 헬퍼로 합치면 이런 부분 수정 누락이 구조적으로 재발하지 않는다.

- **[WARNING]** 신설된 `_branch_changed_rels()` 가 기존 `get_git_branch_diff_files()` 와 사실상 동일한 git 연산을 다른 스크립트에 다시 구현하면서, 이 저장소가 이미 쓰고 있는 "Mirrors X — change both" 상호 참조 관례를 붙이지 않았다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249` (`def _branch_changed_rels(diff_base, root, subpath=None):`, 254행 `["git", "diff", "--no-renames", "--name-only", f"{diff_base}...HEAD", "--"]`) vs `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:933` (`def get_git_branch_diff_files(branch):`, 935행 `["git", "diff", "--no-renames", "--name-only", f"{branch}..."]`)
  - 상세: 두 함수는 플래그(`--no-renames --name-only`)와 dot 문법(3-dot)까지 동일한, 사실상 같은 연산(반환 타입만 list vs set)이다. 이 저장소는 정확히 이런 상황을 위한 관례를 이미 갖고 있다 — 예: `consistency_orchestrator.py:109` "Mirrors `code_review_orchestrator._reconcile_state_with_disk`. Change both.", `code_review_orchestrator.py:578` `_omitted_content_note` 의 "Mirrors the same fix already made on the consistency side (`consistency_orchestrator.OMITTED_FILES_HEADING`)". 이번에 추가된 `_branch_changed_rels`/`_omitted_content_note` 중 후자는 이 관례를 지켰지만 전자는 빠뜨렸다. plan 문서(`harness-review-gate-ci-backstop.md`) 스스로도 "origin 기본 브랜치 해석"이 4곳에 중복 구현돼 drift 위험이 있다고 이미 지적한 바로 그 클래스의 문제이며, 이번 커밋이 그 목록에 다섯 번째 사례를 추가한 셈이다.
  - 제안: 두 함수 중 한쪽 docstring 에 "Mirrors `<다른 파일>.<함수>` — change both" 형태의 상호 참조를 추가. 여력이 되면 두 스킬이 함께 참조 가능한 위치(예: 이미 존재하는 `.claude/_shared/`)로 추출하는 편이 근본적이지만, 최소한 drift 방지용 주석은 이번 diff 범위 안에서 비용이 낮다.

- **[INFO]** `_branch_changed_rels` 의 `subpath` 매개변수가 어디서도 호출되지 않는 죽은 매개변수다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249` (`def _branch_changed_rels(diff_base, root, subpath=None):`), 유일한 호출부는 444행 `_rank_changed = _branch_changed_rels(diff_base, root)` — `subpath` 인자를 넘기는 곳이 전체 저장소(`.claude/`)에 없다.
  - 상세: 스코프 좁히기는 실제로는 `_prioritized()` 내부에서 파이썬 prefix 필터(453~454행)로 처리되고 있어, git 호출 자체를 좁히는 이 매개변수는 설계 흔적만 남았다. 테스트도 이 매개변수를 커버하지 않는다.
  - 제안: 실제로 쓸 계획이 없다면 매개변수를 제거해 함수 시그니처를 실제 호출 형태와 맞출 것.

- **[INFO]** 신규 필터-표시용 매직 넘버 `10` 이 이름 없는 리터럴로 두 번 등장한다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1179` (`for f in missing[:10]:`), `:1182` (`len(missing) - 10`)
  - 상세: 동작 자체는 `test_review_changeset_warning.py::test_long_lists_are_capped_but_counted` 로 잘 고정돼 있어 버그는 아니지만, 같은 파일의 다른 상수들(`_IN_FLIGHT_TTL_SECONDS`, `DEFAULT_MAX_PROMPT_SIZE` 등, `review_guard.py` 기준)처럼 이름 붙은 모듈 상수가 아니라 두 곳에 반복된 리터럴이다.
  - 제안: `_WARN_LIST_CAP = 10` 같은 이름으로 뽑아 두 자리에서 공유하면 향후 임계값을 바꿀 때 한 곳만 고치면 된다.

- **[INFO]** `collect_context` 내부 함수-지역 변수에 언더스코어 프리픽스(`_rank_changed`, `_rank_plan_text`)를 붙였는데, 이 코드베이스에서 언더스코어 프리픽스는 지금까지 모듈 레벨 바인딩(예: import 실패 시 `_origin_default_branch = None`, `_REVIEW_IMPORT_ERROR`)이나 프라이빗 함수/상수에만 쓰였고 함수 지역 변수에는 쓰인 전례가 없다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:444-445` (`_rank_changed = ...`, `_rank_plan_text = ...`), 함수 `collect_context` (420행) 내부
  - 상세: 사소한 스타일 편차이며 동작에는 영향이 없다. 다만 같은 파일 안에서도 바로 아래 중첩 함수 `_prioritized`/`_require_target`(449, 459행)은 기존 관례(중첩 함수 이름에 언더스코어)를 따르는 반면, 이번에 추가된 지역 변수 두 개만 새로운 패턴을 도입했다.
  - 제안: `rank_changed`/`rank_plan_text` 처럼 프리픽스 없는 이름으로 통일하거나, 새 컨벤션으로 의도한 것이라면 유지해도 무방— 팀 판단 사항.

- **[INFO]** 신규 테스트 3개(`test_consistency_bundle_priority.py`, `test_prompt_omission_notice.py`, `test_review_changeset_warning.py`)가 각각 `_PREAMBLE`/`run_in_orchestrator` 서브프로세스-격리 보일러플레이트(~35~40줄)를 독립적으로 복사해, 기존 `test_consistency_context_budget.py` 까지 포함하면 동일 코드가 4개 파일에 존재한다.
  - 위치: 예) `.claude/tests/test_consistency_bundle_priority.py:34-65`(`_PREAMBLE`, `run_in_orchestrator`), `.claude/tests/test_prompt_omission_notice.py:41-78`, `.claude/tests/test_review_changeset_warning.py:44-69`
  - 상세: 각 파일 docstring 이 "Fresh-interpreter convention as in `test_consistency_context_budget`: importing the orchestrator in-process collides on the name `_lib`" 라고 반복 명시하듯, 이 중복은 의도된 것이고 `_harness.load_module_by_path` 의 인-프로세스 로딩으로는 해결되지 않는 별도 문제(모듈 로드 자체가 아니라 `discover` 로 여러 테스트가 한 프로세스에 모일 때 `sys.path` 오염)를 우회하기 위한 장치다. 다만 그 우회 메커니즘(서브프로세스 실행 + `<<<json>>>` 마커 파싱) 자체는 4개 파일에서 글자 그대로 동일하다.
  - 제안: `_harness.py` 에 `run_in_fresh_interpreter(module_path, snippet, arg=None)` 형태의 공용 헬퍼를 하나 두면 격리 특성은 그대로 유지하면서 ~100줄 이상의 반복을 제거할 수 있다. 급하지 않음 — 기존에도 있던 패턴을 이번 PR 이 답습한 것뿐이라 이번 diff 만의 신규 부채는 아니다.

## 요약

전반적으로 이번 변경은 유지보수성 관점에서 상당히 우수하다. 각 함수·상수·분기마다 "왜 이렇게 짰는지", "무엇을 재발시키지 않으려는지"를 설명하는 docstring/주석이 촘촘하고, 회귀를 막기 위한 테스트(특히 vacuous 스파이를 걷어내고 효과를 단언하도록 다시 짠 `test_consistency_bundle_priority.py`)의 근거가 분명하며, `evaluate_review(in_flight_ok=...)` opt-in 전환처럼 기존 호출부·테스트 스텁을 빠짐없이 동반 수정하는 등 일관성 관리가 꼼꼼하다. 다만 `code_review_orchestrator.build_files_section` 은 "예산 초과 시 파일 생략"을 처리하는 코드 경로가 사실상 두 갈래로 중복돼 있는데 이번 PR 의 "생략 고지" 수정이 그중 하나에만 적용됐고(WARNING 1건), 신설된 `_branch_changed_rels` 는 다른 orchestrator 스크립트의 기존 함수와 근본적으로 같은 git 질의를 다시 구현하면서도 이 저장소가 이미 확립해 둔 "Mirrors X — change both" 상호 참조 관례를 빠뜨렸다(WARNING 1건). 나머지는 죽은 매개변수·매직 넘버·지역 변수 네이밍 편차·테스트 보일러플레이트 중복 등 사소한 INFO 수준이다.

## 위험도
LOW
