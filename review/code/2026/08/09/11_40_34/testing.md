### 발견사항

- **[WARNING]** `scripts/ci-paths-changed.sh` 자체의 판정 로직(fail-safe 4갈래 분기 + pathspec 매칭)을 검증하는 전용 테스트가 없다
  - 위치: `scripts/ci-paths-changed.sh:47-83` (event≠pull_request / SHA 누락 / merge-base 실패 / git diff 실패 4개 fail-safe 분기와 `emit()` 판정부). 대응 테스트 부재는 `.claude/tests/test_required_check_skip_jobs.py` 전체(정적 YAML 구조 검사만 수행).
  - 상세: `test_required_check_skip_jobs.py` 는 워크플로 YAML 이 이 스크립트를 "호출하도록 배선돼 있는지"(경로에 문자열로 등장, 실행 권한 존재)만 검사할 뿐, 스크립트가 실제로 옳은 값을 내는지는 아무 테스트도 없다. 이 저장소는 이미 `test_reap_merged_worktrees.py`, `test_run_test_watchdog.py`, `test_bootstrap_mermaid_install.py` 등에서 셸 스크립트를 실제 임시 git repo + subprocess 로 검증하는 강한 컨벤션을 갖고 있고, `.claude/tests/README.md` 자체가 "`*` 가 `/` 를 넘는지"(`test_dependabot_npm_coverage.py`) 같은 glob 매칭 함정을 반복적으로 지적한다. 이 스크립트는 `git diff --name-only $MERGE_BASE $HEAD_SHA -- "$@"` 로 `'codebase/**/package.json'` 같은 패턴을 **git pathspec** 로 넘기는데, 이전 `on.pull_request.paths:` 는 GitHub Actions 자체의 glob 엔진(다른 매칭 규칙)이었다 — 두 엔진의 `**`/`*` 의미가 정확히 같은지 실측 없이 가정만 하고 있다. under-match(관련 변경을 놓쳐 `relevant=false`)가 나면 required check 는 초록으로 통과하면서 실제 검사는 전혀 안 도는, 이 PR 이 막으려는 것과 정확히 같은 클래스의 "게이트가 조용히 안 도는" 실패가 재발한다. 4개의 fail-safe 분기(비-PR 이벤트, SHA 누락, merge-base 실패, git diff 실패)와 emit() 의 `$GITHUB_OUTPUT` 기록 형식도 전부 미검증이다.
  - 제안: `test_required_check_skip_jobs.py` 옆에 실제 임시 git repo 를 만들어 스크립트를 subprocess 로 구동하는 테스트를 추가한다. 최소한: (1) `codebase/frontend/package.json` 같은 단일 세그먼트 경로가 `'codebase/**/package.json'` 에 매칭돼 `relevant=true` 를 내는지, (2) 무관한 파일만 바뀐 커밋에서 `relevant=false` 인지, (3) 4개 fail-safe 분기가 각각 `relevant=true` 로 떨어지는지, (4) `$#=0` 사용법 오류가 exit 2 인지.

- **[WARNING]** `CONVERTED` 목록(`test_required_check_skip_jobs.py`)과 `_SKIP_JOB_WORKFLOWS`/`_PULL_REQUEST_KEYS` 의 빈 집합 항목(`test_workflow_yaml_structure.py`)이 서로 독립된 레지스트리이며, 이 둘의 일치를 강제하는 테스트가 없다
  - 위치: `.claude/tests/test_required_check_skip_jobs.py:40-43` (`CONVERTED = [...]`) vs `.claude/tests/test_workflow_yaml_structure.py:213` (`_SKIP_JOB_WORKFLOWS = {...}`) 및 `:273-283` (`_PULL_REQUEST_KEYS` 의 빈 집합 항목들)
  - 상세: 주석(`test_workflow_yaml_structure.py:272`, "새 워크플로를 이 형태로 바꿀 때는 그 가드의 `CONVERTED` 목록에도 반드시 추가한다")은 사람이 지켜야 할 의무로만 적혀 있고, 이를 어겼을 때 실패하는 테스트가 없다. 누군가 새 워크플로를 `_PULL_REQUEST_KEYS` 에 빈 집합으로 등재하고 `_SKIP_JOB_WORKFLOWS` 에도 넣었지만 `CONVERTED` 에는 추가를 빠뜨리면, `test_required_check_skip_jobs.py` 의 6개 테스트(paths 필터 부재·`changes` 잡·`needs: changes`·전 스텝 게이팅·no-op 안내·스크립트 자기참조)가 그 워크플로에 대해 조용히 적용되지 않는다 — 바로 이 저장소가 `test_harness_checks_paths_coverage.py`, `test_tests_readme_catalog.py` 등 여러 곳에서 반복적으로 잡아 온 "present-but-silent guard" 클래스와 동일한 구조적 결함이다.
  - 제안: 두 파일 중 한쪽이 다른 쪽을 import 하거나(순환 문제 있으면 공유 상수 모듈로 분리), 최소한 한쪽 테스트에서 `CONVERTED`(또는 `_SKIP_JOB_WORKFLOWS`)와 `{k for k, v in _PULL_REQUEST_KEYS.items() if v == set()}` 가 집합으로 동일한지 `assertEqual` 하는 테스트를 추가한다.

- **[INFO]** `test_changes_job_publishes_relevant` 는 `outputs.relevant` 키의 **존재**만 확인하고 값이 실제로 `${{ steps.detect.outputs.relevant }}` 를 가리키는지는 확인하지 않는다
  - 위치: `.claude/tests/test_required_check_skip_jobs.py:77-85`
  - 상세: `changes` 잡의 `outputs.relevant` 가 예컨대 오타로 `${{ steps.detact.outputs.relevant }}` 처럼 잘못된 step id 를 참조해도 이 테스트는 여전히 통과한다(`relevant` 키가 존재하기만 하면 됨). 그 경우 런타임에 출력값이 항상 빈 문자열이 되어 `!= 'true'` 가 참이 되고 **모든 스텝이 no-op** 이 된다 — 이 테스트 파일의 docstring 이 "특히 위험하다"고 명시한 바로 그 시나리오이며, 지금은 정적으로 막히지 않는다.
  - 제안: `outputs["relevant"]` 값이 `"${{ steps.detect.outputs.relevant }}"` 문자열과 정확히 같은지, 또한 `id: detect` 스텝이 실제로 존재하는지 함께 단언한다.

- **[INFO]** `emit()` 이 `GITHUB_OUTPUT` 미설정 시 `/dev/stdout` 에 두 번(append 줄 + 안내 echo) 쓰는 부분은 CI 실사용 경로에서는 무해하지만, 로컬/테스트 실행 시 stdout 파싱을 혼란스럽게 만들 수 있다
  - 위치: `scripts/ci-paths-changed.sh:42-45` (`emit()`)
  - 상세: 위 첫 번째 항목대로 subprocess 테스트를 추가할 경우, `GITHUB_OUTPUT` 을 임시 파일 경로로 명시적으로 지정해야 `relevant=` 값을 안정적으로 파싱할 수 있다는 점을 테스트 작성 시 유의해야 한다.
  - 제안: 테스트 작성 시 `env={"GITHUB_OUTPUT": tmp_file, "GITHUB_EVENT_NAME": "pull_request", ...}` 로 명시하고 파일 내용을 읽어 단언한다.

### 요약

새로 추가된 `.claude/tests/test_required_check_skip_jobs.py` 는 두 워크플로(`deps-security-checks.yml`, `frontend-checks.yml`)가 skip-job 계약(`paths:` 부재, `changes` 잡·`needs: changes`·전 스텝 `if:` 게이팅·no-op 안내·스크립트 자기참조)을 지키는지 YAML 구조 레벨에서 촘촘히 고정하고, `test_workflow_yaml_structure.py` 의 등재제 가드들과도 정확히 정합적으로 갱신되어 있다 — vacuity 방지 테스트, subTest 를 통한 워크플로별 격리, 명확한 실패 메시지 등 이 저장소의 기존 테스트 컨벤션을 잘 따른다. 다만 가장 위험을 결정하는 실제 판정 로직인 `scripts/ci-paths-changed.sh` 자체(특히 git pathspec 의 `**`/`*` 매칭이 이전 GitHub Actions `paths:` 필터의 glob 의미와 동일한지)가 어떤 테스트로도 실행되지 않으며, `CONVERTED` 레지스트리와 `test_workflow_yaml_structure.py` 쪽 레지스트리 사이의 동기화도 사람이 기억해야만 하는 주석 하나에 의존한다. 두 갭 모두 이 저장소가 스스로 반복해 겪었다고 기록한 "게이트가 present 하지만 silent 하게 빠지는" 실패 클래스와 정확히 같은 모양이라 우선순위가 낮지 않다.

### 위험도
MEDIUM
