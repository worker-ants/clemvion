### 발견사항

- **[WARNING]** `.claude/tests/README.md` 의 `test_workflow_yaml_structure.py` 카탈로그 행이 이번 diff 로 그 파일 자체가 받은 변경(`_SKIP_JOB_RUN`/`_SKIP_JOB_NOOP` 규칙 기반 예외, `_PULL_REQUEST_KEYS` 의 bare `pull_request:`(빈 집합) 허용)을 반영하지 않고 그대로다.
  - 위치: `.claude/tests/README.md:44`
  - 상세: 이번 diff 는 `test_required_check_skip_jobs.py` 행(44행 뒤, 새 48행)만 추가했고, 44행의 기존 행은 손대지 않았다. 그런데 같은 diff 의 파일 3(`test_workflow_yaml_structure.py`, 게이트 197-213, 264-283)은 그 파일에 (a) `_SKIP_JOB_RUN`/`_SKIP_JOB_NOOP` 두 표준 조건 문자열을 규칙으로 받는 새 예외 경로, (b) `deps-security-checks.yml`/`frontend-checks.yml` 의 `_PULL_REQUEST_KEYS` 값을 `{"paths"}` → `set()` 로 바꾸는 의미 변경을 추가했다. 44행의 서술("job AND step `if:` conditions are registries…")은 이 새 예외 클래스(규칙 기반 skip)를 언급하지 않고, `_PULL_REQUEST_KEYS` 가 이제 빈 집합을 의도적으로 허용한다는 사실도 언급하지 않는다. `test_tests_readme_catalog.py` 는 "행이 존재하는지"만 검사하고 내용의 최신성은 검사하지 않으므로, 이 staleness 는 어떤 가드에도 걸리지 않는다.
  - 제안: 44행에 한두 문장을 추가해 "regularly-registered exceptions" 옆에 "skip-job 패턴(§`_SKIP_JOB_RUN`/`_SKIP_JOB_NOOP`, `test_required_check_skip_jobs.py` 참조)은 정확한 두 문자열만 예외로 받는다"와 "bare `pull_request:`(빈 키 집합)는 required-check 워크플로에 한해 의도된 등재"를 명시한다. (48행이 이미 44행 쪽을 가리키는 상호참조를 달고 있으므로, 44행도 대칭으로 48행을 가리키게 하면 카탈로그의 관례와 일치한다.)

- **[INFO]** 워크플로 이름을 나열하는 3개의 손으로-동기화하는 리스트(`test_required_check_skip_jobs.py` 의 `CONVERTED`, `test_workflow_yaml_structure.py` 의 `_SKIP_JOB_WORKFLOWS`, 같은 파일의 `_PULL_REQUEST_KEYS` 빈-집합 엔트리 2개)가 서로를 검증하는 코드 없이 우연히 일치한다.
  - 위치: `.claude/tests/test_required_check_skip_jobs.py:40-43`(`CONVERTED`), `.claude/tests/test_workflow_yaml_structure.py:211-213`(`_SKIP_JOB_WORKFLOWS`), `.claude/tests/test_workflow_yaml_structure.py:274,276`(`_PULL_REQUEST_KEYS` 의 `set()` 엔트리)
  - 상세: 세 곳 모두 지금은 `{"deps-security-checks.yml", "frontend-checks.yml"}` 로 값이 같지만, 코드로 서로 묶여 있지 않다 — 하나만 갱신하고 다른 둘을 잊어도 어느 테스트도 그 drift 를 감지하지 못한다. 이 저장소는 정확히 이 클래스의 결함("hand-synced pair with nothing binding them")을 `test_e2e_exemption_paths_sync.py`·`test_router_safety_policy_doc.py`·`test_report_paths_shared.py`(`AgreementTest`) 등 여러 곳에서 전용 바인딩 테스트로 반복해 막아 왔고, 이번 변경이 참조하는 `plan/in-progress/ci-required-check-skip-jobs.md` 도 "전환할 때마다 두 목록을 함께 갱신하는 것이 계약이다"라고만 적어 사람이 지켜야 하는 약속으로 남겨 두었다. 지금 2개 워크플로만 전환된 상태라 즉시 위험하지는 않지만, plan 의 "후속 — 나머지 8개 워크플로" 섹션이 예고하는 대로 확장되면 이 3-way 수기 동기화가 이 저장소가 반복적으로 겪은 drift 클래스를 재현할 표면이다.
  - 제안: 세 목록 중 하나(예: `CONVERTED`)를 SoT 로 두고 나머지 둘이 그 값을 import 하거나, 최소한 세 집합이 동일함을 assert 하는 짧은 바인딩 테스트를 추가한다. 당장 안 한다면 이 저장소의 다른 가드들처럼 "Known limit, stated not hidden" 형태로 이 파일들 주석에 미결 상태임을 명시하는 것도 대안이다.

- **[INFO]** `scripts/ci-paths-changed.sh` 의 `## 사용` 섹션이 실제 판정에 필요한 환경변수(`GITHUB_EVENT_NAME`, `PR_BASE_SHA`, `PR_HEAD_SHA`)를 이름으로 문서화하지 않는다.
  - 위치: `scripts/ci-paths-changed.sh:20-24`
  - 상세: `## 사용` 은 `scripts/ci-paths-changed.sh 'codebase/frontend/**' 'pnpm-lock.yaml'` 형태의 위치 인자만 보여주고 `$GITHUB_OUTPUT` 만 언급한다. 그러나 스크립트의 핵심 분기(48, 54-55행)는 `GITHUB_EVENT_NAME`/`PR_BASE_SHA`/`PR_HEAD_SHA` 환경변수에 의해 결정되며, 이 값들이 없으면(예: 로컬에서 직접 실행) 조용히 fail-safe 경로(`emit true`)로 빠진다 — 코드 자체는 그 이유를 stderr 로 출력하지만("!! event=... — ..."), 사용법 섹션만 보고 로컬에서 실제 diff 판정을 재현하려는 사람은 어떤 변수를 설정해야 하는지 알 수 없다.
  - 제안: `## 사용` 에 "실제 판정을 로컬에서 재현하려면 `GITHUB_EVENT_NAME=pull_request PR_BASE_SHA=<sha> PR_HEAD_SHA=<sha> scripts/ci-paths-changed.sh ...`" 같은 한 줄 예시를 추가한다.

- **[INFO]** `push` 트리거가 이제 경로 필터 없이 항상 전체 잡(pnpm audit, override-floors, frontend build 등)을 실행하게 되는 동작 변화가 변환된 두 워크플로 자신의 헤더 주석에는 명시되지 않는다.
  - 위치: `.github/workflows/deps-security-checks.yml:21-30`, `.github/workflows/frontend-checks.yml:15-20`
  - 상세: 변경 전에는 `push`(main) 트리거에도 별도의(더 좁은) `paths:` 목록이 있어 무관한 main 커밋에서는 워크플로가 아예 스킵됐다. 변경 후에는 `push` 트리거에 `paths:` 가 없고, `ci-paths-changed.sh` 는 `GITHUB_EVENT_NAME != "pull_request"` 인 모든 이벤트(스케줄·`push` 포함)를 무조건 fail-safe `true` 로 처리하므로(스크립트 47-52행), 이제 main 에 대한 모든 push 가 항상 전체 잡을 완주한다. 이는 fail-safe 철학상 의도된 결과로 보이지만("불확실하면 검사를 돌린다"), 그 함의(=`push` 는 사실상 필터링이 사라졌다)가 두 워크플로 자신의 상단 주석에는 나타나지 않고 `scripts/ci-paths-changed.sh` 를 열어야만 알 수 있다.
  - 제안: 두 워크플로 상단 주석(또는 스크립트 자체 주석)에 "`push`/`schedule` 은 diff 비교 기준이 없어 필터링되지 않고 항상 전체 잡이 돈다"를 한 줄 명시하면, 이후 "main 에서 CI 비용이 왜 늘었나"를 조사하는 사람이 스크립트 내부를 추적하지 않아도 된다.

### 요약

핵심 계약(잡은 항상 success, 스텝만 게이팅, `needs: changes` 필수)은 신규 모듈 독스트링(`test_required_check_skip_jobs.py`)·워크플로 인라인 주석·`scripts/ci-paths-changed.sh` 헤더 주석·`.claude/tests/README.md` 신규 행·`plan/in-progress/ci-required-check-skip-jobs.md` 다섯 곳에서 서로 일관되게, 그리고 이례적으로 자세히 서술되어 있다(regression 시나리오·fail-safe 방향·잡 대신 스텝을 게이팅한 이유가 모두 명시적). 발견된 문제는 전부 비차단성 후속 정리: (1) 같은 diff 로 실질 변경을 받은 `test_workflow_yaml_structure.py` 의 README 카탈로그 행이 그 변경(스킵-잡 예외, bare `pull_request:` 허용)을 반영하지 않아 카탈로그가 부분적으로 stale, (2) 워크플로 이름을 나열하는 3개 목록이 코드로 묶이지 않은 채 우연히 일치(이 저장소가 반복해 겪은 drift 클래스), (3) 로컬 재현을 위한 스크립트 사용법에 필요한 환경변수 이름이 빠짐, (4) `push` 트리거의 필터링 소멸이라는 함의가 스크립트를 열어야만 드러남.

### 위험도

LOW
