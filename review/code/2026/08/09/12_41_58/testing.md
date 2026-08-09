### 발견사항

- **[WARNING]** 실제 배포되는 `codebase/**/package.json` pathspec(중간 `**`)이 어떤 테스트로도 검증되지 않고, git pathspec `**` 의 "0개 디렉터리" 케이스가 실측으로 확인한 실제 미스매치 지점이다.
  - 위치: `.claude/tests/test_ci_paths_changed.py:109-117` (`test_nested_path_matches_the_glob`) — `'codebase/frontend/**'` (끝쪽 `**`) 만 사용. `.github/workflows/deps-security-checks.yml` 의 `changes.detect` 스텝이 실제로 넘기는 인자 `'codebase/**/package.json'` (중간 `**`) 은 어떤 테스트에도 등장하지 않는다.
  - 상세: 직접 실측했다 — 임시 git repo 에서 `git diff --name-only base head -- 'codebase/**/package.json'` 은 `codebase/channel-web-chat/package.json`(중간 디렉터리 1개)은 매칭하지만 `codebase/package.json`(중간 디렉터리 0개, `**` 가 빈 것에 대응하는 경우)은 **매칭하지 않는다**. 이 파일의 docstring/주석이 여러 곳에서 "git pathspec 과 GitHub `paths:` 의 의미가 갈리면" 이라는 정확히 이 위험을 우려하고 있고(`test_nested_path_matches_the_glob` 의 docstring), 그 우려를 검증하는 테스트가 있긴 하지만 **실제 프로덕션 pathspec 문자열이 아니라 구조가 다른 대체 문자열**로 검증했다. 지금은 `codebase/` 바로 아래에 `package.json` 이 없어 잠복 상태이지만, 향후 그런 파일이 추가되면 `relevant=false` 로 조용히 판정돼 이 PR 이 막으려는 것과 정확히 같은 클래스("초록인데 검사가 안 도는") 실패가 재발한다. `frontend-checks.yml` 의 `'codebase/frontend/**'`/`'codebase/packages/**'` 는 끝쪽 `**` 라 테스트된 형태와 구조가 같아 이 위험이 없다.
  - 제안: `test_ci_paths_changed.py` 에 `'codebase/**/package.json'` 문자열 그대로를 쓰는 케이스를 추가하고, 중간 디렉터리 0개(`codebase/package.json`)·1개(`codebase/x/package.json`)·2개(`codebase/x/y/package.json`) 세 깊이를 각각 단언한다. 0개가 실패하면(현재 그렇다) `changes` 스텝의 pathspec 을 `'codebase/package.json' 'codebase/*/package.json' 'codebase/**/package.json'` 처럼 명시 보강하거나 스크립트에 `--glob-magic` 등 다른 매칭 방식을 검토해야 한다.

- **[INFO]** `test_converted_workflows_pass_the_script_its_own_path` 가 워크플로 YAML 전체 텍스트에 대한 순수 substring 검사라 `run:` 블록이 아닌 곳(예: 주석)에 같은 문자열이 있어도 통과한다.
  - 위치: `.claude/tests/test_required_check_skip_jobs.py:201-214`
  - 상세: `self.assertIn("'scripts/ci-paths-changed.sh'", text, ...)` 는 파일 전체 텍스트를 대상으로 하므로, `changes.detect` 스텝의 실제 `run:` 인자 목록이 아니라 어딘가의 주석에만 그 문자열이 있어도 그린이 된다. 지금은 실제로 `run:` 블록 안에 있어 문제없지만(직접 확인함), 이 저장소가 다른 파일들(`test_harness_checks_paths_coverage.py` 등)에서는 "텍스트 기반 매칭의 한계"를 명시적으로 문서화하는 관례를 갖고 있는데 비해 이 테스트는 그 한계를 docstring 에 적지 않았다.
  - 제안: `yaml.safe_load` 로 `jobs["changes"]["steps"]` 중 `id: detect` 스텝의 `run:` 문자열만 대상으로 검사하도록 좁히거나(선호), 최소한 텍스트 기반 검사의 한계를 docstring 에 명시한다.

- **[INFO]** `test_each_job_announces_the_no_op_path` 가 no-op 안내 스텝을 substring `"== 'false'"` 포함 여부로만 식별해, `_SKIP_JOB_NOOP` 상수와의 정확 일치를 요구하지 않는다.
  - 위치: `.claude/tests/test_required_check_skip_jobs.py:173-192`
  - 상세: `any("== 'false'" in str(s.get("if", "")) for s in job.get("steps", []))` 는 `needs.changes.outputs.relevant == 'false'` 가 아닌 다른 임의 조건(예: `foo == 'false' || bar`)에도 반응한다. `test_step_conditions_are_registered`(다른 파일)가 결국 게이팅 문자열 자체는 정확 일치로 걸러내므로 실질 위험은 낮지만, 이 테스트 자신만 놓고 보면 "no-op 안내가 정확히 이 계약의 그 문자열인지"는 보장하지 않는다.
  - 제안: `s.get("if") == _SKIP_JOB_NOOP` (또는 동등한 정확 비교)로 좁히거나, 왜 substring 으로 충분한지 docstring 에 근거를 남긴다.

### 요약
새 테스트 스위트(`test_ci_paths_changed.py` 16건, `test_required_check_skip_jobs.py` 9건, `test_workflow_yaml_structure.py` 보강분)는 직접 실행해 확인한 결과 전부 GREEN 이며, 실제 조건 문자열에 오탈자 뮤테이션(공백 삽입)을 주입해 `test_step_conditions_are_registered` 가 정확히 RED 로 떨어지는 것도 재현·복구까지 확인했다. mock 없이 실제 임시 git 저장소 + subprocess 로 판정 스크립트를 구동하고, fail-safe 4분기·push 이벤트·`**`/`/` 교차·`$GITHUB_OUTPUT` 기록까지 실행 레벨로 고정한 것은 지난 라운드(11_40_34) 의 W1(미검증 fail-safe)·W5(레지스트리 비바인딩)·W6(step id 오타 미검출)을 정확히 겨냥해 닫았고, `test_the_two_registries_agree` 로 세 레지스트리를 `assertEqual` 바인딩한 것도 실측으로 확인했다(현재 값 완전 일치). 다만 실제 프로덕션에서 쓰이는 pathspec `'codebase/**/package.json'`(중간 `**`) 자체는 어떤 테스트로도 재현되지 않았고, 직접 실측한 결과 이 정확한 형태에서 "중간 디렉터리 0개" 케이스가 git pathspec 상 매칭되지 않는 것을 확인했다 — 지금은 그런 파일이 없어 잠복 상태이지만, 이 PR/테스트 스위트가 반복해서 막으려는 것과 정확히 같은 클래스의 리스크이므로 WARNING 으로 남긴다. 그 외 두 건은 텍스트/substring 기반 검사의 정밀도에 관한 낮은 우선순위 INFO다. 격리(임시 디렉터리 `setUp`/`tearDown`, 명시적 env dict), 가독성(각 테스트가 "왜"를 docstring 으로 설명), 회귀 안전성(기존 스위트 전부 GREEN, 신규 항목이 기존 등록부와 정합) 모두 이 저장소의 기존 컨벤션을 잘 따른다.

### 위험도
LOW
