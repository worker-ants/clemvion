# Dependency Review — round 11 (harness-review-ci-backstop)

## 조사 방법

git_probe/branch_guard/plan_guard/review_guard 전체를 `Read` 로 직접 읽었고(프롬프트가 review_guard.py 를
잘라냈으므로), `git diff origin/main...HEAD --stat`(전체 195파일, 브랜치 전체 14커밋)와
`git diff HEAD~1..HEAD`(이번 라운드 실제 변경분)를 대조해 "이번 라운드가 실제로 바꾼 것"과 "이미
검토된 것"을 구분했다. 의존성 매니페스트(`package.json`/`requirements*.txt`/`pyproject.toml`/
`pnpm-lock.yaml`/`Gemfile*`/`go.mod`) 변경을 브랜치 전체에 대해 검색 — 0건.

작업 트리는 건드리지 않았다. 뮤테이션 검증은 `mktemp` 대신 스크래치 디렉터리(절대경로, `dep_review_mutant*`)에
필요한 파일만 복사해 수행하고 즉시 삭제했다. 두 가지를 실측했다(둘 다 GREEN→RED 확인, 즉 vacuous 아님):

```
cd <scratch>; python3 -m unittest discover -s .claude/tests -p 'test_plan_guard.py'
```
1. `plan_guard.py`·`branch_guard.py` 양쪽에 이름·본문이 동일한 새 함수(`_extra_probe`)를 주입
   → `GitProbesAreNotReDuplicatedTest.test_no_identical_function_survives_in_two_guards` RED.
2. `branch_guard.py`에서 위임(`_current_branch = _git_probe._current_branch`) 직후 **다른 본문**으로
   `_current_branch` 를 지역 재정의 → `test_the_shared_probes_are_the_same_objects_everywhere` RED.

```
cd <scratch>; python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -k PyYamlPinsAgreeTest
```
3. `deps-security-checks.yml` 사본 하나의 `pyyaml>=6,<7` 을 `pyyaml>=5,<6` 로 변경
   → `PyYamlPinsAgreeTest.test_every_workflow_pins_the_same_version` RED (`2 != 1`).

## 발견사항

- **[INFO]** 이번 라운드(및 브랜치 전체 14커밋)는 새 외부 패키지를 도입하지 않았다.
  - 위치: 브랜치 범위 전체 (`git diff origin/main...HEAD --stat`)
  - 상세: `package.json`/`requirements*.txt`/`pyproject.toml`/`pnpm-lock.yaml`/`Gemfile*`/`go.mod` 매칭 diff 가 0건. 새로 등장한 `import` 문은 전부 stdlib 또는 저장소 내부 모듈(`_lib`/`_shared`/`_harness`)이었다(`git_probe.py`, `branch_guard.py`, `plan_guard.py`, `review_guard.py`, `test_plan_guard.py`, `test_review_gate_ci.py`, `test_review_guard_hardening.py`, `test_stop_guard_failopen.py`, `test_workflow_yaml_structure.py`, `scripts/check-review-gate.py` 전수 grep). 유일한 non-stdlib 참조는 기존 `import yaml` 재사용.
  - 제안: 없음 — 현재 상태가 바람직하다.

- **[INFO]** 유일한 non-stdlib 의존(PyYAML)은 새로 추가된 것이 아니라 기존 pin 을 재사용하며, 세 워크플로 간 pin 불일치를 잡는 전용 회귀 테스트가 있고 뮤테이션으로 vacuous 하지 않음을 확인했다.
  - 위치: `.github/workflows/harness-checks.yml:92-93`(`pip install "pyyaml>=6,<7"`), `.github/workflows/deps-security-checks.yml:57-58,91-92`(동일 pin, 2곳), `.claude/tests/test_review_gate_ci.py:807-825`(`PyYamlPinsAgreeTest.test_every_workflow_pins_the_same_version`)
  - 상세: `test_review_gate_ci.py`(`import yaml`, line 450)와 `test_workflow_yaml_structure.py`(`import yaml`, line 35)는 신규로 YAML 을 파싱하지만, 그 설치 스텝은 `harness-checks.yml`(2026-08-01, 이 브랜치 이전)에 이미 있었다 — `git log --oneline -- .claude/tests/test_workflow_yaml_structure.py`/`.github/workflows/harness-checks.yml` 로 확인. 세 곳의 pin 문자열이 모두 `pyyaml>=6,<7` 로 동일함을 `grep -rn pyyaml .github/workflows/*.yml` 로 확인했고, 위 뮤테이션 실험으로 `PyYamlPinsAgreeTest` 가 실제로 drift 를 잡는다는 것을 실증했다. 이 규약(harness Python 은 stdlib 전용, 예외는 PyYAML 하나)은 `.claude/tests/README.md:19-30` 에 명시돼 있다.
  - 제안: 없음 — 버전 고정·일관성·회귀 테스트 모두 갖춰져 있다.

- **[INFO]** `.github/workflows/review-gate.yml` 의 GitHub Actions 핀(`actions/checkout@v7`, `actions/setup-python@v7`, `python-version: '3.x'`)은 저장소의 다른 9개 워크플로 전부와 동일하다 — 이 파일이 새로 도입한 버전 드리프트는 없다.
  - 위치: `.github/workflows/review-gate.yml:55,59,61`
  - 상세: `grep -n "uses:" .github/workflows/*.yml` 로 `actions/checkout@v7`/`actions/setup-python@v7`/`actions/setup-node@v7` 가 harness-checks.yml, deps-security-checks.yml, e2e.yml, frontend-checks.yml, migration-check.yml, migration-recheck-on-main.yml, packages-checks.yml, spec-link-checks.yml, web-chat-checks.yml 전부에서 동일 major 를 쓰고 있음을 확인했고, `python-version: '3.x'` 도 모든 setup-python 사용처에서 동일했다.
  - 제안: 없음. (이 메이저 버전들이 실제로 존재/유효한지는 실 Actions 러너에서만 검증 가능하다는 것은 이미 "Known limits" 로 기록된 항목 — 여기서 다시 CRITICAL 로 올리지 않는다.)

- **[INFO, 긍정적]** `_shared/git_probe.py` → `hooks/_lib` 역방향 의존이 이번 라운드에서 제거됐다 — `_shared` 는 이제 stdlib(`os`, `subprocess`)만 import 한다.
  - 위치: `.claude/_shared/git_probe.py:34-35` (import 문 전체), `.claude/_shared/git_probe.py:46-85`(`_origin_default_branch` 정본 구현)
  - 상세: 직전 라운드(9R)에서 `_shared/git_probe._origin_default_branch` 가 `importlib.util.spec_from_file_location` 으로 `hooks/_lib/branch_guard.py` 를 파일 경로로 되감아 로드하는 래퍼였다(`git diff HEAD~1..HEAD` 에서 삭제된 블록으로 확인) — "공유" 모듈이 특정 소비자 모듈에 의존하는 잘못된 방향의 내부 의존이었고, `sys.modules` 오염(9R W2)·무효 seam(10R W1)의 근원이었다. 이번 라운드는 `_origin_default_branch` 의 정본 구현 자체를 `git_probe.py` 로 옮기고 `branch_guard.py` 는 `_origin_default_branch = _git_probe._origin_default_branch` 위임으로 바꿨다. `grep -rn "hooks/_lib\|_HOOKS_LIB\|spec_from_file_location" .claude/_shared/*.py` 로 잔여 참조가 없음을 확인했다.
  - 제안: 없음 — 의존 방향이 이제 `hooks/_lib → _shared` 단방향으로 올바르다.

- **[INFO, 긍정적]** 세 훅 모듈(`review_guard.py`/`plan_guard.py`/`branch_guard.py`) 간 git 프로브 중복 탐지가 손으로 쓴 목록(열거)에서 세 모듈의 AST 비교(도출)로 바뀌었고, 두 방향(동일 함수 재복제 / 위임 뒤 지역 재정의) 모두 뮤테이션으로 RED 를 확인했다.
  - 위치: `.claude/tests/test_plan_guard.py:329-399`(`GitProbesAreNotReDuplicatedTest`), `.claude/hooks/_lib/branch_guard.py:57-58`(`_current_branch`/`_origin_default_branch` 위임), `.claude/hooks/_lib/plan_guard.py:115`(`_current_branch` 위임)
  - 상세: "조사 방법" 절의 뮤테이션 1·2 참조. 9R 은 5개 프로브만 `_shared` 로 옮기며 손으로 쓴 목록(`_run_git, _repo_root, _merge_base, _default_branch, _porcelain_path`)에 의존했고, `_current_branch` 가 빠져 `plan_guard`/`branch_guard` 에 AST 동일한 사본으로 남았던 것이 직전 라운드의 CRITICAL 이었다. 이번 라운드는 그 원인(열거)을 제거했다 — 새 함수가 두 훅에 이름·본문 동일하게 복제되면 이제 목록에 없어도 걸린다.
  - 제안: 없음 — 정확히 이 세션이 겨냥한 결함 클래스(내부 모듈 간 손-동기 의존)에 대한 올바른 구조적 수정이다.

- **[WARNING]** `RESOLUTION_MARKER_SUBDIR` 경로 리터럴이 여전히 4곳에 손으로 중복돼 있고, 이번 라운드가 고른 완화책은 (git 프로브에 적용한) "위임으로 통합"이 아니라 "테스트로 drift 만 감지"다 — 같은 실패 클래스가 이 세션에서 두 가지 다른 정도로 처리된 셈이다.
  - 위치: `.claude/hooks/_lib/review_guard.py:811`(정본 상수 `RESOLUTION_MARKER_SUBDIR`), `.claude/hooks/mark_resolution_in_flight.py:53`, `.claude/hooks/clear_resolution_in_flight.py:30`(둘 다 `os.path.join(project_dir, ".claude", "state", "resolution_in_flight")` 리터럴), `.claude/tests/test_review_guard_hardening.py:779-810`(`ResolutionMarkerPathIsConsistentTest.test_all_four_spellings_agree`, 이번 라운드 신규)
  - 상세: `mark_resolution_in_flight.py`/`clear_resolution_in_flight.py` 는 정본 상수를 import 하지 않고 문자열을 다시 적는다. 신규 테스트는 두 훅 스크립트의 소스를 정규식(`os\.path\.join\(\s*project_dir\s*,\s*(.+?)\)`)으로 읽어 정본과 비교하는데, 이는 소스를 실제로 읽으므로 `mock` 기반 테스트보다는 강하고(파싱 실패 시 `assertTrue(joins, ...)` 가 즉시 실패해 fail-closed), git 프로브 세 벌이 mock 뒤에 숨어 3라운드 갈렸던 것과 같은 사고는 아니다. 다만 이 저장소가 스스로 기록한 교훈("손으로 동기화하는 쌍은 갈린다" — git 프로브에서 세 번, `report_paths`/`retry_state`/doc-sync 매트릭스에서 각 한 번)의 정의 그대로인 구조가 하나 더 남아 있다는 사실은 변하지 않는다. 이 두 훅이 무거운 `review_guard.py`(report/spec-glob 파싱 등 1,000줄+)를 통째로 import 하지 않으려는 것은 PreToolUse(Agent)마다 도는 hot-path 훅의 크기를 가볍게 유지하려는 합리적 트레이드오프로 읽히지만(테스트 docstring 도 "소비자가 훅 스크립트라 위임 구조를 만들기보다" 라고 그 근거를 명시한다), 상수 하나만 별도로 꺼내 쓰는 것(`from _lib.review_guard import RESOLUTION_MARKER_SUBDIR`처럼 상수만 import — review_guard 전체 로드 비용과 무관)까지 배제하는 근거는 아니다.
  - 제안: 가능하면 `RESOLUTION_MARKER_SUBDIR` 를 두 훅이 직접 import 해 리터럴을 완전히 없애는 편이 git 프로브와 같은 수준의 안전성을 준다. 그럴 수 없는 제약(순환 import, 훅 로딩 비용 등)이 있다면 현재의 테스트-핀 방식이 합리적인 차선이므로 CRITICAL 로 올리지 않지만, 5번째 손-복제 지점이 생기지 않도록 "새 소비자가 생기면 이 테스트도 갱신" 이라는 규약을 `RESOLUTION_MARKER_SUBDIR` 옆 주석에 남겨두는 것을 권한다(현재는 테스트 쪽에만 그 취지가 적혀 있다).

- **[INFO]** `_shared/report_paths.py`/`_shared/block_integrity.py` 를 포함해 `review_guard.py` 가 소비하는 내부 모듈 의존은 전부 단방향(`hooks/_lib → _shared`)이고 순환 참조가 없다.
  - 위치: `.claude/hooks/_lib/review_guard.py:142-144`
  - 상세: `from _shared import report_paths / block_integrity / git_probe` 세 줄 외에 `_shared/*.py` 어디에도 `hooks`/`skills` 로의 역참조가 없음을 grep 으로 확인했다. `plan_guard.py`/`branch_guard.py` 도 서로를 import 하지 않아(각각 `_shared.git_probe` 만 참조) 세 훅 사이의 순환 의존 위험이 없다.
  - 제안: 없음.

## 요약

이번 라운드(10R→11R 사이 실제 diff: `_shared/git_probe.py`, `branch_guard.py`, `plan_guard.py`, 관련 테스트, `harness-checks.yml` permissions)는 새 외부 패키지를 전혀 추가하지 않았고, 유일한 non-stdlib 의존(PyYAML)은 기존 pin 을 그대로 재사용하며 그 pin 일관성 자체가 뮤테이션으로 검증된 회귀 테스트(`PyYamlPinsAgreeTest`)로 지켜지고 있다. 이 라운드의 실질적 "의존성" 작업은 패키지가 아니라 **내부 모듈 의존 그래프**였다 — `_shared/git_probe.py` 가 `hooks/_lib` 로 역참조하던 것을 제거해 방향을 바로잡았고, 세 훅 사이의 git-프로브 중복 탐지를 손으로 쓴 목록에서 AST 도출로 바꿔 직전 라운드의 CRITICAL(여섯 번째 프로브 누락)이 낳은 근본 원인을 없앴다. 두 수정 모두 뮤테이션으로 non-vacuous 함을 직접 확인했다. 유일한 잔여 항목은 `RESOLUTION_MARKER_SUBDIR` 경로가 여전히 4곳에 손으로 복제돼 있고 완화가 "위임" 대신 "테스트 핀"이라는 것인데, 근거가 문서화돼 있고 fail-closed 방식이라 CRITICAL 은 아니며 WARNING 으로 남긴다. GitHub Actions 버전 핀(`@v7`)은 이 파일이 새로 만든 드리프트가 아니라 저장소 전체 관행과 일치한다.

## 위험도
LOW
