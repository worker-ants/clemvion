# 의존성(Dependency) 리뷰 — round 8, CI 백스톱 (review-gate.yml / harness-checks.yml / check-review-gate.py)

## 스코프 메모

`review/code/2026/08/06/12_52_41/_prompts/dependency.md` 를 그대로 따랐다. 프롬프트가
크기 제한으로 내용을 싣지 못한 파일(`review_guard.py`, `.claude/tests/README.md`,
`test_block_integrity.py`)은 `Read`/`grep` 으로 직접 열어 확인했다. 그 외 10개 파일은
프롬프트에 실린 게이트 숫자를 그대로 인용했다.

라운드 8 자체의 실제 diff 부터 확인했다 — `git diff HEAD --stat` 결과 이번 라운드가 건드린
파일은 `plan/in-progress/harness-review-gate-ci-backstop.md` (+16/-1) **하나뿐**이고, 내용은
`_porcelain_path` 가 git 의 non-ASCII 경로 C-quoting 을 다루지 않는다는 **미측정** 관찰을
plan 항목 #12 로 적어 둔 것이다 — 패키지·워크플로·import 어느 축도 건드리지 않는다. 그래서
이번 리뷰는 (a) 라운드 8 diff 자체(의존성 영향 0)와 (b) 프롬프트가 컨텍스트로 실은 CI
백스톱 기능 전체의 현재 의존성 상태(라운드 7까지 누적된 것) 둘 다를 검사했다.

## 발견사항

- **[INFO]** 라운드 8 의 실제 diff 는 의존성 관점에서 완전히 비어 있다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md` (`git diff HEAD --stat` 로 확인
    — 이 파일 1개, +16/-1).
  - 상세: 이번 라운드가 추가한 내용은 `_porcelain_path` 가 git 의 `core.quotePath` 인용
    경로를 못 다룬다는 **미측정** 관찰(plan 항목 #12)뿐이고, `package.json`/`pnpm-lock.yaml`/
    워크플로 `.yml`/Python `import` 어느 것도 변경되지 않았다. `git diff
    origin/main...HEAD --stat -- '*.json' '*.yaml' '*.yml'` 로 이 기능 브랜치 전체(9개
    선행 라운드 포함)를 대조해도 config 파일 변경은 `.github/workflows/harness-checks.yml` 과
    `.github/workflows/review-gate.yml` 두 개뿐이다(`review/**` 산출물 JSON 제외).
  - 제안: 없음 — 정보성.

- **[INFO]** PyYAML 이 이 기능 전체를 통틀어 유일한 외부 의존이고, 핀·용법 모두 안전하며
  새 의존이 아니라 기존 예외의 재사용이다.
  - 위치: `.github/workflows/harness-checks.yml:88` (`pip install "pyyaml>=6,<7"`),
    `.github/workflows/deps-security-checks.yml:58,92` (동일 핀 — 실제 파일에서
    `grep -n pyyaml .github/workflows/*.yml` 로 확인).
    회귀 테스트: `.claude/tests/test_review_gate_ci.py` 의 `PyYamlPinsAgreeTest`
    (`class PyYamlPinsAgreeTest` 이하, 프롬프트 파일5 근방 790행대 — 세 워크플로 전체를
    정규식으로 스캔해 pin 이 정확히 하나로 수렴하는지 단언).
  - 상세: `grep -rn "yaml\.load\b" .claude scripts` 실행 결과 유일한 호출은
    `.claude/tests/test_workflow_yaml_structure.py:74` 이고, 그 로더는 `class
    _Loader(yaml.SafeLoader)` 서브클래스라 `yaml.load()` 의 임의 코드 실행 취약점 클래스(예:
    CVE-2020-14343 과 같은 계열의 오용)를 피한다. 다른 소비자(`scripts/check-override-floors.py:129`,
    `WorkflowWiringTest`)는 전부 `yaml.safe_load`. PyYAML 은 MIT 라이선스로 이 저장소와
    호환 문제 없음. `deps-security-checks.yml:56-58` 의 주석("scripts/ 중 유일한 non-stdlib
    의존")이 확인해 주듯, `harness-checks.yml` 의 설치 스텝은 **신규 외부 패키지가 아니라
    기존 예외를 새 소비자(`scripts/check-override-floors.py` 를 직접 exec 하는
    `test_override_floors.py`)로 확장**한 것이다. 핀은 정확 버전(`==`)이 아니라 메이저
    범위(`>=6,<7`)이지만, 이 저장소가 같은 패키지에 이미 쓰던 관행을 그대로 재사용한 것이라
    이 PR 이 새로 만든 리스크는 아니다. `requirements*.txt` 류 파일은 저장소에 없다(`find
    . -iname "requirements*.txt"` 0건) — 손-동기 지점이 워크플로 3곳뿐이라는 전제가 실제로
    맞고, 그 전제를 `PyYamlPinsAgreeTest` 가 지킨다(직접 실행 확인:
    `python3 -m unittest .claude.tests.test_review_gate_ci.PyYamlPinsAgreeTest -v` → ok).
  - 제안: 없음. 단일 진실화(`constraints.txt`)는 `PyYamlPinsAgreeTest` 자신의 docstring 이
    이미 "더 낫지만 세 워크플로의 설치 방식을 바꾸는 일이라 범위 밖" 이라 적어 뒀다 —
    동의하고, 이 라운드에서 다시 요구하지 않는다.

- **[INFO]** GitHub Actions 버전(`actions/checkout@v7`, `actions/setup-python@v7`,
  `actions/setup-node@v7`)이 저장소 전체 10개 워크플로와 정확히 일치한다 — 이 기능이 만든
  버전 충돌이나 이례값이 아니다.
  - 위치: `.github/workflows/review-gate.yml:55,59`, `.github/workflows/harness-checks.yml:75,79,100`.
  - 상세: `grep -rn "uses: actions/" .github/workflows/*.yml | sort` 로 저장소의 모든
    워크플로(`deps-security-checks.yml`·`e2e.yml`·`frontend-checks.yml`·`migration-check.yml`
    등 9개 파일)를 대조 — `checkout`/`setup-python`/`setup-node`/`upload-artifact` 전부
    `@v7`(`cache` 만 `@v6`)로 통일돼 있고, `review-gate.yml`·`harness-checks.yml` 도 정확히
    같은 메이저를 쓴다. 부동 메이저 태그(SHA 고정 아님)라는 공급망 트레이드오프는 이미 저장소
    전체의 기존 관행이지 이 PR 이 새로 도입한 것이 아니다.
  - 제안: 없음 — 이번 diff 범위 밖.

- **[INFO, 라운드 7부터 이월 — 이번 라운드가 만들거나 악화시키지 않음]**
  `TheGateItselfDoesNotBranchOnCiEnvTest` 의 `_SCANNED` 목록이 `review_guard.py` 가 실제
  import·호출하는 내부 모듈 그래프를 여전히 다 덮지 못한다. 다만 기능적으로는 같은 파일
  안의 다른 테스트 클래스가 이미 보완하고 있다.
  - 위치: `.claude/tests/test_review_gate_ci.py:603`
    (`_SCANNED = ("review_guard.py", "branch_guard.py", "plan_guard.py")`) 대
    `.claude/hooks/_lib/review_guard.py:149-150`
    (`from _shared import report_paths as _report_paths_lib` /
    `from _shared import block_integrity as _block_integrity`), 실제 호출은 `:472`
    (`_report_paths_lib.missing_reports(...)`), `:774`(`_block_integrity.summary_block_verdict(...)`),
    `:816`(`_block_integrity.contradiction_note(...)`) — `grep -n
    "_report_paths_lib\.\|_block_integrity\.\|from _shared import"
    .claude/hooks/_lib/review_guard.py` 로 직접 확인(파일이 프롬프트에 실리지 않아 `Read` 로 열람).
  - 상세: 이 §8(내부 의존성) 갭은 필자 자신의 라운드 7 리뷰
    (`review/code/2026/08/06/12_09_13/dependency.md`, WARNING #1, MEDIUM)가 이미 지적한
    것과 **동일 지점**이고, 라운드 8 인 지금도 `_SCANNED` 는 그대로다(코드 변화 없음 — 위에서
    확인했듯 라운드 8 diff 는 plan.md 뿐). 그런데 같은 파일에 이후 추가된
    `TheRealGateIgnoresTheEnvironmentTest`(프롬프트 파일4 게이트 643~659행)가 스텁이 아니라
    **실물** `evaluate_review()` 를 최소 환경과 GH Actions 14변수 환경 양쪽에서 두 번 판정시켜
    결과를 대조한다 — 이 검사는 파일 열거에 의존하지 않으므로 `_shared/**` 를 포함해 게이트가
    실제로 위임하는 어떤 모듈이 새 환경 분기를 넣어도(오늘은 `_report_paths_lib`/
    `_block_integrity` 둘 다 `os.environ`/`os.getenv` 를 전혀 안 읽는다 — `grep -n
    "environ\|getenv" .claude/_shared/report_paths.py .claude/_shared/block_integrity.py`
    0건) 잡아낼 수 있다. 즉 **기능적으로는 이미 닫혀 있다.** 남은 것은 순수 문서/신뢰 문제다:
    `TheGateItselfDoesNotBranchOnCiEnvTest` 자신의 클래스 docstring(프롬프트 게이트
    584~597행)은 `_SCANNED` 를 마치 그 자체로 완결된 등재제인 것처럼 서술하고, 자신의
    알려진 한계나 그것을 보완하는 `TheRealGateIgnoresTheEnvironmentTest` 를 전혀
    참조하지 않는다 — 그 한계 서술은 오직 뒤쪽 클래스의 docstring 에만 있다. 새 `_lib`/`_shared`
    모듈을 추가하며 "여기(`_SCANNED`) 에 등재해야 하나?" 를 이 클래스 docstring 만 읽고
    판단하는 유지보수자는 목록이 완전하다고 오신할 수 있다 — 실제로는 4번째 `_shared`
    모듈이 생겨도 `_SCANNED` 는 자동으로 못 따라간다(행위 테스트만 따라간다).
  - 제안: `TheGateItselfDoesNotBranchOnCiEnvTest` 의 `_SCANNED` 정의 옆이나 클래스
    docstring 에 "이 목록은 알려진 채로 불완전하다 — 실제 안전망은
    `TheRealGateIgnoresTheEnvironmentTest` 다" 한 줄을 추가해, 한계 서술이 그 목록 자체와
    함께 다니게 한다. 차단 사유 아님 — 이번 라운드가 만든 결함도 아니고 실질 우회 경로도
    현재는 없다(위 `environ`/`getenv` 0건 실측).

- **[INFO]** `package.json` / `pnpm-lock.yaml` / `.github/dependabot.yml` 변경 없음 — 이
  기능 전체가 `codebase/**` 의 프런트엔드·백엔드 의존성 표면을 전혀 건드리지 않는다.
  - 위치: `git diff origin/main...HEAD --stat -- '*.json' '*.yaml' '*.yml'` (결과에서
    `review/**` 제외) → `.github/workflows/harness-checks.yml`,
    `.github/workflows/review-gate.yml` 두 개뿐.
  - 상세: harness 규약("표준 라이브러리만 쓴다")이 실제로 지켜지고 있다 — `review-gate.yml`
    자체는 설치 스텝이 없고(주석과 일치), `scripts/check-review-gate.py` 의 import 는
    `argparse, os, sys` 뿐(`Read` 로 직접 확인, 프롬프트 파일11과 일치). 번들 크기·빌드
    시간에 대한 영향은 이 라운드에서도, 이 기능 전체로도 0이다.
  - 제안: 없음.

## 요약

라운드 8 의 실제 변경분은 plan 문서 한 줄 추가뿐이라 의존성 관점에서 손댈 것이 없다(신규
패키지·핀 변경·워크플로 설치 스텝 변경 전무). 컨텍스트로 실린 CI 백스톱 기능 전체를
다시 훑어도 결론은 라운드 7 리뷰와 같다 — 유일한 외부 의존(PyYAML)은 기존 예외의 재사용이고
3곳 핀이 정확히 일치하며 안전하게(`safe_load`/`SafeLoader`) 쓰이고, GH Actions 버전은
저장소 전체와 정렬돼 있다. 유일하게 남은 항목은 §8(내부 의존성) 축의 이월 사항 —
`TheGateItselfDoesNotBranchOnCiEnvTest` 의 정적 `_SCANNED` 목록이 `review_guard.py` 가
실제로 위임하는 `_shared/report_paths.py`/`block_integrity.py` 를 여전히 빠뜨린다 — 인데,
같은 파일의 `TheRealGateIgnoresTheEnvironmentTest` 가 실물 게이트를 두 환경에서 판정시켜
행위로 그 구멍을 이미 메워 놓았고 오늘 두 모듈 다 환경을 읽지 않아 살아있는 우회도 아니다.
남은 것은 그 완결성 서술이 두 클래스 중 한쪽에만 있어 목록만 읽는 유지보수자가 오신할 수
있다는 문서 신뢰 문제뿐이라 INFO 로 남긴다.

## 위험도

LOW
