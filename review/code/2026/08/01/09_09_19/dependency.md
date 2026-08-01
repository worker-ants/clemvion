# Dependency Review — review/code/2026/08/01/09_09_19

## 검증 방법 (요약)

- `git diff --stat origin/main...HEAD -- . ':!review'` 로 이번 브랜치의 실제 코드 diff(18개 파일, +1890/-300)를 확정하고, `requirements.txt`/`pyproject.toml`/`package.json`/lockfile 류 매니페스트 변경 여부를 grep 으로 조회.
- 프롬프트 예산으로 잘린 6개 파일(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`, `tests/README.md`, `test_block_integrity.py`)은 전부 `Read`/`grep -n`으로 직접 열어 import 문·핵심 diff 를 확인한 뒤 판단(추측 금지 지시 준수).
- 18개 파일 전수에 대해 `^import|^from` 패턴을 grep, stdlib 대 외부 패키지 여부를 전수 확인.
- `_shared/retry_state.py` 위임 리팩터가 "일부만 고치고 두 번째 사본을 방치"하는 패턴(7R/8R 사례)을 재발시켰는지, `git diff`로 전/후 함수 바디를 직접 대조.
- 의존성 관련 서술형 주장(“이 트리 최초의 `removesuffix` 사용”, “Report location/validity … one rule, three consumers” 등)은 코드에 실제로 반영돼 있는지 `git show origin/main:<path>` 대조 + 전체 트리 grep 으로 재검증.

## 발견사항

- **[WARNING]** 내부 의존성 설명 주석이 리팩터로 인해 실제 import 와 어긋남(orphaned comment)
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:42-45`
  - 상세: `origin/main` 에서는 42-43행 주석("Report location/validity is shared with the push/stop gate and the code-review orchestrator — see `.claude/_shared/report_paths.py`. One rule, three consumers.")이 바로 아래 44행의 `from _shared import report_paths as _report_paths_lib` 를 정확히 설명했다. 이번 diff 는 그 44행을 `from _shared import block_integrity as _block_integrity` / `from _shared import retry_state as _retry_state_lib` 두 줄로 교체했지만(`report_paths` 직접 import 는 이 파일에서 완전히 제거됨 — `grep _report_paths_lib`로 잔여 참조 0건 확인), 주석은 그대로 남아 지금은 존재하지 않는 import(`report_paths`)를 설명하고 그 아래 실제로 있는 두 import(`block_integrity`/`retry_state`)에 대해서는 아무 설명도 없다. "one rule, three consumers" 서술도 더는 이 파일에 해당하지 않는다 — `report_paths` 의 현재 직접 소비자는 `review_guard.py`·`code_review_orchestrator.py` 2곳뿐이고(grep 확인), 이 파일은 이제 `_shared/retry_state.py` 를 통한 간접 소비자다. 같은 리팩터를 겪은 `code_review_orchestrator.py:43-48`는 대조적으로 `report_paths` import 를 그대로 유지한 채 `retry_state` 를 추가만 했으므로 주석-코드 불일치가 발생하지 않았다 — 이번 파일에서만 국소적으로 발생한 diff-도입 결함이다. 런타임 영향은 없으나(주석이므로), 이번 세션의 핵심 교훈("고치는 김에 남긴 근거 텍스트가 실제로는 더 이상 참이 아닐 수 있다")과 정확히 같은 종류의 문제이며, 다음에 이 파일을 만지는 사람이 `report_paths.py` 변경 영향 범위를 잘못 판단하게 만들 수 있다.
  - 제안: 42-43행 주석을 현재 import 에 맞게 갱신 — 예: "`block_integrity`(하향 backstop)와 `retry_state`(상태 bookkeeping)를 공유 사용. `report_paths` 는 더 이상 직접 참조하지 않고 `retry_state.reconcile_state_with_disk` 를 통해 간접 사용." 정도로 정정.

- **[INFO]** 신규 외부 의존성 없음 — 확인 완료
  - 위치: 세션 대상 18개 파일 전체(`.claude/_shared/*`, `.claude/hooks/**`, `.claude/skills/**`, `.claude/tests/**`, `plan/in-progress/harness-review-gate-ci-backstop.md`)
  - 상세: `git diff --name-only origin/main...HEAD -- . ':!review'` 결과에 requirements.txt/pyproject.toml/package.json/pnpm-lock.yaml/Pipfile/poetry.lock/go.mod 등 매니페스트 파일이 전혀 없음. 18개 파일의 모든 import 문을 grep 전수 조사한 결과 stdlib(`os, re, sys, json, datetime, hashlib, subprocess, traceback, tempfile, unittest, pathlib, shutil, textwrap, argparse`)와 프로젝트 내부 모듈(`_shared.{report_paths,block_integrity,retry_state}`, hooks `_lib.{review_guard,plan_guard,failopen_state}`, skills `_lib.project_config`, `lib.{session,role_instructions,router_safety,line_anchors}`, `tests._harness`)만 사용. 제3자 패키지 신규 도입 없음.
  - 제안: 없음(조치 불요).

- **[INFO]** harness 의 "zero third-party dependency" 명시 규약 준수
  - 위치: `.claude/tests/README.md:14-17`
  - 상세: "No install step. The suite uses only the standard library … matching the harness convention that its Python carries zero third-party dependencies — hooks must run on a bare `python3`. Do not introduce `pytest`/`requirements.txt` here without revisiting that convention." 이번 diff 는 신규 테스트 파일 2개(`test_block_integrity.py` 802줄 신규, `test_retry_state_shared.py` 220줄 신규)를 추가했지만 두 파일 모두 `unittest`/`unittest.mock`/stdlib 만 사용(grep 확인) — 규약 위반 없음.
  - 제안: 없음(조치 불요).

- **[INFO]** `_shared/retry_state.py`·`_shared/block_integrity.py` 신설에 따른 내부 결합 확대 — 위임 완전성 검증
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:186-209`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:88-110`
  - 상세: `retry_state.py` 는 이제 3개 orchestrator(code-review, consistency, merge-coordinator)의 상태 bookkeeping을 공유하는 새 내부 의존 지점이 됐다. `git diff`로 `code_review_orchestrator.py`/`consistency_orchestrator.py` 양쪽의 `_load_state`/`_save_state`/`_reconcile_state_with_disk`/`_apply_status_update` 를 대조한 결과 전부 1줄 위임(`return _retry_state_lib.xxx(...)`)으로 교체됐고 예전 인라인 로직이 어느 한쪽에도 잔존하지 않음을 확인했다(이번 세션 컨텍스트가 경고한 "한 곳만 고치고 두 번째 사본을 방치"하는 패턴이 이 리팩터에서는 재발하지 않음 — 실측 확인).
  - 제안: 없음(조치 불요).

- **[INFO]** `merge_coordinator_orchestrator.py` 의 `retry_state.py` 부분 채택 — 이미 추적됨, 코드·plan 서술 일치 확인
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:88-100` / `plan/in-progress/harness-review-gate-ci-backstop.md` 관측 9번
  - 상세: 이 파일은 `load_state`/`save_state`/`apply_status_update` 만 위임받고 `reconcile_state_with_disk` 자기치유 호출이 없다(같은 모듈을 쓰는 다른 두 orchestrator 대비 결합 깊이가 얕음). 코드 자체 주석("this file has no `_reconcile_state_with_disk` at all … registered as a follow-up rather than smuggled into this branch")과 plan 문서 항목 9("`merge_coordinator_orchestrator.py` 에 `reconcile_state_with_disk` 자기치유가 없다")를 대조 — 서로 일치하며 은폐 없이 명시적으로 위험을 인지하고 범위를 좁힌 것으로 확인됨. 세 orchestrator 가 같은 shared 모듈에 서로 다른 깊이로 결합돼 있는 비대칭 상태 자체는 사실이나, 신규로 숨겨진 갭이 아니라 이미 로그된 후속 항목이다.
  - 제안: 없음(추적 중 — 재등재 불요, 별도 PR 범위).

- **[INFO]** checker 이름 목록 단일화 진행 + 잔여 2차 레지스트리
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:53` (`ALL_CHECKERS = list(_block_integrity.ALL_CHECKERS)`) / `.claude/skills/code-review-agents/lib/role_instructions.py:215`(`CHECKER_INSTRUCTIONS`, 이번 diff 범위 밖)
  - 상세: `consistency_orchestrator.ALL_CHECKERS` 가 이제 `_shared/block_integrity.ALL_CHECKERS`(정본)에서 파생돼, 하드코딩된 두 번째 사본을 제거했다 — downgrade-backstop 이 참조하는 checker 리포트 집합의 drift 위험을 줄이는 정당한 개선. 다만 checker 이름을 등록하는 곳이 하나 더 있다(`role_instructions.CHECKER_INSTRUCTIONS`, prompt 빌드용) — 이번 PR 범위 밖이라 손대지 않았고, `CHECKER_INSTRUCTIONS.get(checker_name)` 이 `None` 이어도 generic fallback 프롬프트로 대체하는 것을 확인해(`build_checker_prompt_body`) 당장 위험은 낮다.
  - 제안: 조치 불요. 신규 checker 추가 시 두 레지스트리를 모두 갱신해야 한다는 점만 인지.

- **[INFO]** Python 호환성 관련 서술 실측 검증
  - 위치: `.claude/_shared/block_integrity.py:183-186`(`contradiction_note` 주석)
  - 상세: "Not `removesuffix`: it needs Python 3.9 and would be this tree's first use, silently raising the harness's minimum" 주장을 `.claude/` 전체 grep 으로 검증 — 이 주석 자신을 제외하면 `removesuffix`/`removeprefix` 사용처가 실제로 0건, 주장이 정확함을 확인. 18개 대상 파일 전체에서 Python 3.10+ 전용 런타임 문법(`match`/`case`, `isinstance(x, A | B)`) 신규 도입도 없음을 확인. CI(`harness-checks.yml`)는 `python-version: '3.x'`(floating, 명시적 하한 없음)로 최신 3.x 만 검증하므로 이 하한 회피 판단은 로컬 `python3`(오래된 배포판 등)을 겨냥한 것으로 보이며, 근거가 실측과 일치한다.
  - 제안: 없음(조치 불요).

## 요약

이번 세션의 18개 대상 파일은 전부 `.claude/` 하네스(내부 자동화 스크립트·훅·에이전트 정의·테스트·plan 문서)이며, `git diff --name-only`로 확인한 결과 requirements.txt/package.json/lockfile 등 의존성 매니페스트 변경은 전무하고, 파일별 import 전수 조사에서도 stdlib 와 프로젝트 내부 모듈(`_shared`, `_lib`, `lib`) 외의 제3자 패키지는 발견되지 않았다 — `.claude/tests/README.md` 가 명시한 "harness Python 은 제3자 의존성 0개" 규약을 이번 변경도 그대로 지킨다. 핵심 변경은 두 orchestrator(및 부분적으로 세 번째)가 각자 들고 있던 상태 bookkeeping 5종을 `.claude/_shared/retry_state.py` 로, BLOCK 판정 로직을 `.claude/_shared/block_integrity.py` 로 옮기는 내부 의존성 재배선(DRY)이며, `git diff` 대조로 위임이 양쪽 모두 완전함을(구 로직 잔존 없음) 확인했고 3개 orchestrator 간 결합 깊이 비대칭(merge-coordinator 부분 채택)도 코드 주석과 plan 문서가 서로 정합하게 이미 추적 중임을 확인했다. 유일한 실질 발견은 `consistency_orchestrator.py` 42-45행의 orphaned 주석 — import 교체 과정에서 "report_paths / one rule, three consumers" 설명이 실제로는 더 이상 존재하지 않는 import 를 가리키게 방치된 것으로, 런타임 영향은 없지만 내부 의존 관계를 잘못 서술하는 문서적 회귀라 WARNING 으로 등재한다. 라이선스·취약점·버전 고정·번들 크기 항목은 신규 외부 의존성이 없어 해당 사항 없음(N/A)이다.

## 위험도
LOW
