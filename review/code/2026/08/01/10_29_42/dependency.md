# 의존성(Dependency) 리뷰

대상: 리뷰 게이트의 훅-독립 CI 백스톱 (`review-gate.yml` + `check-review-gate.py`) 도입 diff, 6개 파일.

## 검증 방법 (요약)

리뷰 전에 다음을 실제로 실행/대조해 확인했다 (검사만으로 끝내지 않음):

- `git show HEAD -- <file>` 로 6개 파일 각각의 실제 diff 범위를 확인 (예: `harness-checks.yml` 은 이번 커밋에서 3줄만 추가됐고, PyYAML 설치 스텝은 선행 커밋의 것).
- `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v` 로 13개 테스트 전체 실행 — 전부 PASS.
- `scripts/check-review-gate.py` 에 `import re` + 미사용 정규식 함수를 주입하는 뮤테이션을 넣고 재실행 → `OneJudgeTest` 가 실제로 RED 됨을 확인, `git checkout --` 로 원복 후 다시 GREEN 확인.
- `_load_gate()` 의 `sys.path` 삽입 목록에서 `.claude/hooks`(부모 디렉터리) 항목을 제거하는 반대 방향 뮤테이션을 넣고 재실행 → 13개 테스트 전부 그대로 PASS, 원복 후 재확인.
- 저장소 전체 워크플로(`*.yml`) 에서 `actions/checkout@`, `actions/setup-python@`, `python-version`, `pip install`, `fetch-depth: 0`, `concurrency` 패턴을 grep 하여 이번 diff 의 값과 전수 대조.
- `review_guard.py`, `branch_guard.py`, `_shared/report_paths.py`, `_shared/block_integrity.py` 의 import 문을 직접 읽어 실제 의존 그래프를 추적.
- `check-override-floors.py` / `test_workflow_yaml_structure.py` / `check-pnpm-security-config.py` 의 PyYAML 사용처를 grep 하여 `yaml.load()` 기본 로더(고전적 RCE CVE 패턴) 사용 여부 확인.
- `.gitignore` 를 직접 읽어 "리뷰 산출물은 gitignored 아니다" 라는 설계 전제를 재확인하고, `origin/main` 의 `review/code` · `review/` 트리 파일 수를 실측(9,113 / 14,779 — 문서의 8,851 / 14,517 보다 크며, 이는 추가 커밋으로 인한 자연 증가로 해석 일관적).

## 발견사항

- **[WARNING]** `review-gate.yml` 의 `paths:` 트리거가 `evaluate_review()` 의 실제 로드-베어링 형제 모듈(`branch_guard.py`)을 누락
  - 위치: `.github/workflows/review-gate.yml:26-31` (특히 28행 `- '.claude/hooks/_lib/review_guard.py'`)
  - 상세: `review_guard.py` 는 127행에서 `from branch_guard import _origin_default_branch` 를 임포트하고, 227~231행 `_default_branch()` 를 통해 이를 `evaluate_review()` 본체(965행 `default = _default_branch(cwd)`)에서 직접 사용한다 — merge-base 산정("이 브랜치가 무엇을 바꿨는가")의 시작점이라 판정의 핵심 경로다(grep -n 으로 호출 지점 직접 확인). 그런데 `review-gate.yml` 의 `paths:` 는 `review_guard.py` 파일 하나만 콕 집어 등재했고, 같은 `_lib` 디렉터리의 형제 파일인 `branch_guard.py`(또는 `.claude/hooks/_lib/**` 처럼 더 넓은 패턴)는 없다. 이는 정확히 이 PR 이 `harness-checks.yml` 주석에서 "여섯 번 겪고 세운 규칙"이라 부르는 실패 클래스(판정 로직이 바뀌었는데 그 파일이 대상 워크플로의 trigger path 밖이라 CI 가 재검증하지 않음)와 같은 모양이다. `test_harness_checks_paths_coverage.py` 에 대응하는 "`review-gate.yml` 자신의 paths 커버리지" 메타가드는 존재하지 않는다(grep 확인: 해당 테스트 파일에 "review-gate"/"review_gate" 문자열 0건). 다만 실무 영향은 제한적이다 — `harness-checks.yml` 의 `.claude/hooks/**` 가 이미 `branch_guard.py` 변경 시 트리거되고, `test_branch_guard.py` 가 그 동작을 직접 커버하며, 이 백스톱은 현재 관측 모드(`--enforce` 없음)라 즉시 활성 차단 결함은 아니다.
  - 제안: `review-gate.yml` paths 에 `'.claude/hooks/_lib/branch_guard.py'` 를 개별 등재하거나(현재 방식과 일관), `'.claude/hooks/_lib/**'` 로 넓혀 `review_guard` 의 향후 형제-모듈 의존성 추가에도 자동으로 대응하게 할 것.

- **[INFO]** 새 외부 패키지 의존성 없음, PyYAML 은 이번 diff 범위 밖이며 안전 패턴 확인, 라이선스/취약점 문제 없음
  - 위치: `scripts/check-review-gate.py:51-53` (import argparse/os/sys), `.github/workflows/review-gate.yml` 전체(설치 스텝 없음), 배경: `.github/workflows/harness-checks.yml:80-85`
  - 상세: 이번 diff 의 실제 코드 파일(`check-review-gate.py`, `test_review_gate_ci.py`)은 표준 라이브러리(`argparse`/`os`/`sys`/`shutil`/`subprocess`/`tempfile`/`unittest`)와 프로젝트 내부 모듈(`review_guard`, `_harness`)만 쓴다. `review-gate.yml` 은 `harness-checks.yml` 과 달리 `pip install` 스텝이 없다 — `check-review-gate.py` 는 YAML 을 파싱하지 않으므로 PyYAML 이 필요 없고 실제로 그렇게 짜여 있다(불필요한 의존성을 새로 끌어오지 않음). `harness-checks.yml` 의 `pip install "pyyaml>=6,<7"` 스텝은 `git show HEAD -- .github/workflows/harness-checks.yml` 로 확인한 결과 **이번 커밋의 변경분이 아니다** — 이번 커밋이 그 파일에 추가한 건 `scripts/check-review-gate.py` 경로 항목 3줄뿐이고, PyYAML 스텝은 선행 커밋(`06c2651c9`)에서 이미 존재했다. 배경으로 참조된 PyYAML(MIT 라이선스) 사용처(`scripts/check-override-floors.py:129`, `.claude/tests/test_workflow_yaml_structure.py:35,61-74,112`, `scripts/check-pnpm-security-config.py:92`) 를 모두 확인한 결과 `yaml.safe_load` 또는 `yaml.SafeLoader` 를 상속한 커스텀 로더만 쓰고, 인자 없는 `yaml.load()`(PyYAML 의 전형적 임의 코드실행 CVE 계열, 예 CVE-2017-18342/CVE-2020-14343) 패턴은 어디에도 없다. 저장소 라이선스는 AGPL-3.0(`LICENSE` 확인 — GNU AGPLv3)이며 MIT 인 PyYAML·`actions/checkout`·`actions/setup-python` 은 호환 문제 없다. 3개 워크플로/2개 스크립트에 걸쳐 `pyyaml>=6,<7` 핀이 문자 그대로 동일해 버전 파편화도 없다.
  - 제안: 없음.

- **[INFO]** GitHub Actions 버전·관례가 저장소 전역과 완전히 일치 — 신규 드리프트 없음
  - 위치: `.github/workflows/review-gate.yml:33-35`(concurrency), `:48,50,52,54`(checkout/fetch-depth/setup-python/python-version)
  - 상세: `actions/checkout@v7`, `actions/setup-python@v7`, `python-version: '3.x'` 모두 리포의 기존 12개 워크플로 전부에서 동일하게 쓰이는 값이다(전수 grep 확인: e2e/deps-security/frontend/migration(-recheck)/harness-checks/packages/web-chat/spec-link-checks 전부 `@v7`, 전 Python 잡이 `'3.x'`). `concurrency`(`review-gate-${{ github.ref }}` / `cancel-in-progress: true`) 네이밍도 다른 8개 워크플로와 동일 패턴이고, `fetch-depth: 0` 도 이미 `migration-check.yml`/`migration-recheck-on-main.yml` 에 있는 기존 비용 패턴이라 신규 유형이 아니다.
  - 제안: 없음.

- **[INFO]** `check-review-gate.py` 의 `_load_gate()` 가 `.claude/hooks`(부모 디렉터리)를 sys.path 에 추가하지만, 실측상 현재 import 그래프에서는 불필요해 보임
  - 위치: `scripts/check-review-gate.py:55-57`(근거 주석), `:63-67`(특히 64행 `hooks = os.path.join(root, ".claude", "hooks")`, 65~67행 for-loop)
  - 상세: 주석은 "두 경로를 다 얹는다 — hooks/ 는 패키지가 아니고 …" 라고 근거를 대지만, `review_guard.py` 의 실제 cross-module import 는 (a) 같은 `_lib` 디렉터리의 `branch_guard`(127행, `_lib` 하나면 충분) 와 (b) `_shared.report_paths`/`_shared.block_integrity`(149~150행 — `review_guard.py` 자신이 121~148행에서 `_CLAUDE_DIR` 를 계산해 스스로 sys.path 에 얹으므로 호출자가 따로 챙길 필요 없음) 뿐이다. 직접 실측: `hooks` 변수를 sys.path 삽입 루프에서 빼고(`_lib` 만 남긴 상태로) `test_review_gate_ci.py` 13개를 재실행했더니 전부 그대로 통과했다(`git checkout --` 로 원복 후 정상 상태 재확인도 통과). 즉 현재 소스 기준으로는 `hooks` 추가가 어떤 테스트로도 요구되지 않는다 — 해가 되는 건 아니고 방어적 여유일 수 있으나, 주석의 "그래서 둘 다 필요하다"는 서술은 현재 그래프로는 근거가 약하다.
  - 제안: 방어적으로 유지하려면 주석을 "현재는 `_lib` 만으로 충분하나 향후 `hooks/` 루트에 형제 모듈이 생길 경우를 대비한 여유"로 정정하거나, 불필요하면 제거해 sys.path 오염면을 줄일 것. 기능 결함은 아니므로 급하지 않음.

- **[INFO]** "판정자 단일성"(`OneJudgeTest`) 가드는 실측으로 vacuous 하지 않음이 확인됐으나, 금지 목록은 열거형이라 전수 차단은 아님
  - 위치: `.claude/tests/test_review_gate_ci.py:209-210`(호출 금지 목록), `:222-224`(import 금지 목록)
  - 상세: 뮤테이션으로 직접 검증했다 — `scripts/check-review-gate.py` 최상단에 `import re` 와 이를 쓰는 미사용 함수를 주입하자 `test_the_script_performs_no_judgement_operations_of_its_own` 이 `AssertionError: 're' unexpectedly found in {...}` 로 정확히 RED 됐다(원복 후 GREEN 재확인). 이 테스트는 실제로 실패할 수 있는 테스트다. 다만 금지 대상은 `os.walk`/`glob.glob`/`glob.iglob`/`re.compile`/`subprocess.run`/`subprocess.check_output`/`open`(호출) 및 `re`/`glob`/`subprocess`(import) 로 열거돼 있어, 동등 기능을 제공하는 다른 API — 예: `pathlib.Path(...).rglob(...)`/`os.scandir`/`os.listdir` 를 이용한 트리 순회, `io.open(...)`/`Path(...).open()` 를 이용한 파일 열기 — 는 목록에 없어 이론적으로는 우회 가능하다. `subprocess`/`re`/`glob` 은 import 자체가 금지라 `subprocess.Popen`/`.call` 같은 우회는 이미 막혀 있음도 확인했다(해당 모듈을 import 하는 순간 잡힘). 악의적 우회보다 "실수로 재구현"을 막는 게 목적이므로 실무 위험은 낮지만, docstring 이 함의하는 "완전 차단"과 실제 열거형 사이 간극은 기록해 둘 가치가 있다.
  - 제안: 필요시 `pathlib`/`io` 를 import 금지 목록에 추가하거나, 최소한 이 열거형이 "알려진 우회 경로에 대한 방어"이지 "이론상 전수 차단"은 아니라는 점을 테스트 docstring 에 한 줄 명시.

- **[INFO]** 내부 의존성 재사용 원칙("판정자는 하나") 이 실측으로 성립 확인 — 5번째 default-branch 구현을 추가하지 않음
  - 위치: `scripts/check-review-gate.py:69-70`(`import review_guard` / `return review_guard.evaluate_review`), `plan/in-progress/harness-review-gate-ci-backstop.md:137-143`(기존 defer 항목)
  - 상세: `check-review-gate.py` 는 자체 판정 로직(트리 순회·정규식·git 호출)을 두지 않고 로컬 훅과 동일한 `review_guard.evaluate_review()` 를 그대로 재사용한다 — `report_paths`/`retry_state` 에서 이미 두 번 겪은 "로컬/CI 판정 drift" 재발을 구조적으로 차단하려는 설계 의도가 코드로 실제 구현돼 있음을 위 뮤테이션 테스트로 재확인했다. 한편 plan 문서가 이미 추적 중인 "origin 기본 브랜치 해석 4중 구현" 부채(`branch_guard._origin_default_branch()` / `review_guard._default_branch()` / `code_review_orchestrator._default_branch_ref()` / `consistency_orchestrator` 의 리터럴)에 이번 diff 는 5번째 구현을 보태지 않는다 — 기존 `review_guard.evaluate_review()` 를 그대로 재사용할 뿐이다.
  - 제안: 없음 (기존 defer 결정 유지 — `_lib` 네임스페이스 충돌 해소가 선행돼야 통합 가능하다는 문서의 판단에 동의).

- **[INFO]** "리뷰 산출물이 gitignore 되지 않는다"는 설계 전제를 독립 재측정 — 일치
  - 위치: `.gitignore:38`(`review/**/_prompts/`), 배경: `plan/in-progress/harness-review-gate-ci-backstop.md:179-181`, `scripts/check-review-gate.py:22-23`
  - 상세: 이 전제는 "CI 가 gitignored 산출물을 어떻게 볼 것인가"라는 설계 고민 자체를 소거하는 핵심 근거라 별도로 재확인했다. `.gitignore` 를 직접 읽으면 `review/` 관련 제외 규칙은 `review/**/_prompts/` 하나뿐이다. `git ls-tree -r origin/main` 으로 직접 카운트한 결과 `review/code/` 9,113개, `review/` 전체 14,779개가 추적 중이었다 — 문서가 적어 둔 8,851개/14,517개보다 크지만, 이는 측정 이후 추가된 리뷰 세션 커밋 때문으로 해석하는 것이 자연스럽고(같은 방향, 같은 자릿수), "산출물이 커밋된다"는 정성적 결론을 뒤집지 않는다.
  - 제안: 없음 — 전제 성립 확인.

- **[INFO]** CI 실행 비용 — 코드 검사 기반 추론이며 실측(CI 로그) 아님을 명시
  - 위치: `.github/workflows/review-gate.yml:22-25`(트리거 범위 `codebase/**`), `:37-61`(job 본문)
  - 상세: 새 job 은 설치 스텝이 없고 `checkout`(`fetch-depth: 0`) → `setup-python` → `git fetch` 1회 → 파이썬 스크립트 1회 실행으로 구성돼 코드만 보면 가볍다. 다만 이는 스크립트의 I/O 패턴(파일 읽기 + git 서브프로세스 호출 수 회)을 읽고 추론한 것이지, 실제 GitHub Actions 실행 시간을 측정한 수치가 아니다 — 이 세션에서 CI 로그에 접근할 수 없어 정량적 확인은 불가했다. `codebase/**` 가 트리거 범위라 대부분의 제품 코드 PR 에서 매번 도는 추가 job 이 된다는 점은 경로 확인으로 사실이다.
  - 제안: 병합 후 실제 실행 시간을 몇 차례 관찰해 `timeout-minutes: 5` 상한에 여유가 있는지 확인 권장 — 코드 추론상 문제는 안 보이나 실측으로 닫는 편이 안전.

## 요약

이번 diff 는 새 서드파티 패키지를 추가하지 않는다 — `scripts/check-review-gate.py` 와 `test_review_gate_ci.py` 는 표준 라이브러리와 프로젝트 내부 모듈(`review_guard`, `_harness`)만 쓰고, `review-gate.yml` 은 설치 스텝 자체가 없다. 배경으로 등장하는 PyYAML 은 선행 커밋에서 이미 도입됐고 이번 diff 범위 밖이며, 실사용처를 모두 확인한 결과 안전한 로더(`safe_load`/`SafeLoader` 서브클래스)만 쓴다. GitHub Actions 버전(`@v7`, `python-version: '3.x'`)·`concurrency`·`fetch-depth: 0` 는 리포 전역 관례와 완전히 일치해 새 드리프트가 없다. 설계의 핵심 강점 — "판정자는 하나, CI 는 트리거만 다르다" — 은 코드(자체 판정 로직 없음)와 테스트(`OneJudgeTest`) 양쪽에서 실제로 성립함을 뮤테이션 테스트로 직접 검증했다(vacuous 아님). 유일한 실질적 흠은 `review-gate.yml` 자신의 `paths:` 트리거가 `evaluate_review()` 가 실제로 쓰는 형제 모듈(`branch_guard.py`)을 누락했다는 점인데, 이는 이 PR 이 다른 워크플로에서 여섯 번 겪고 고친 것과 같은 실패 클래스이면서도 이 워크플로 자신에는 같은 감사가 적용되지 않은 사례다 — 다만 `harness-checks.yml` 의 넓은 커버리지와 기존 단위 테스트로 실무 위험은 낮다. 그 외 sys.path 상 실측으로 불필요해 보이는 `.claude/hooks` 추가, 판정자-단일성 금지 목록의 이론적 우회 표면, CI 실행 비용의 미실측은 모두 저위험 INFO 로 기록했다.

## 위험도

LOW
