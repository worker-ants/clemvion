# 의존성(Dependency) 리뷰 — 2R

대상: 리뷰 게이트의 훅-독립 CI 백스톱, 1R 리뷰 반영 커밋(`fb463845d`) 포함 6개 파일.

## 검증 방법 (실제로 실행한 것)

- `git diff --stat origin/main...HEAD` 로 실제 diff 범위 재확인(6개 코드/문서 파일 + review 세션 산출물). `harness-checks.yml` 은 이번 PR 전체에서 **+3줄만** — `Install PyYAML` 스텝은 merge-base(`06c2651c9`, origin/main)에 **이미 존재**함을 `git show 06c2651c9:.github/workflows/harness-checks.yml`로 직접 확인(이번 PR 이 도입한 신규 서드파티 의존성이 아님).
- `grep -rn "pip install.*pyyaml"` 전 워크플로 대조 → `harness-checks.yml`/`deps-security-checks.yml`(2곳) 전부 `pyyaml>=6,<7` 문자 그대로 동일.
- `grep -n "yaml\.\(safe_load\|load\|SafeLoader\)"` 로 `check-override-floors.py`/`test_workflow_yaml_structure.py`/`test_review_gate_ci.py` 의 PyYAML 사용처 전수 확인 → 전부 `safe_load` 또는 `yaml.SafeLoader` 서브클래스, 인자 없는 `yaml.load()`(고전 RCE CVE 패턴) 없음.
- **"판정자는 하나다"(`OneJudgeTest`) 가드를 실제로 우회 시도** — 가드의 AST 로직을 그대로 복사해 합성 페이로드에 실행(스크립트는 `review/code/**` 쓰기 권한만 있어 실제 파일에 뮤테이션을 넣는 대신 알고리즘 자체를 재현 실행). 결과: `os.popen("find … -name SUMMARY.md")` 또는 `subprocess = __import__("subprocess"); subprocess.check_output(...)` 는 **import 허용목록도, 호출 금지목록도 모두 통과** — 실측 코드는 아래 참조.
- **`WorkflowWiringTest`(1R 에서 "substring 아니라 구조" 로 재작성됐다고 주장하는 클래스) 를 같은 방식으로 재시도** — `test_the_job_condition_exempts_dependabot` 는 `"dependabot[bot]" in cond` 와 `"!=" in cond` 를 **독립적으로** 검사한다. 두 서브스트링이 실제로 하나의 비교식으로 붙어 있는지는 확인하지 않는다 — `cond = "github.actor == 'dependabot[bot]' && env.FOO != env.BAR"` (의미상 **정반대**: 봇일 때만 실행) 로 두 assertIn 이 모두 통과함을 파이썬으로 직접 실행해 확인. `test_a_step_actually_runs_the_script` 도 마찬가지로 `"scripts/check-review-gate.py" in c` 를 `run:` 필드 **전체 텍스트**에 대한 substring 으로 검사 — `run: |\n  echo "not actually running: scripts/check-review-gate.py"\n  true` 를 합성해 실행해도 통과함을 확인.
- `.gitignore` / `git ls-tree -r origin/main -- review/code` 재확인 — "리뷰 산출물은 gitignored 아니다" 전제 유지.
- `git show fb463845d -- .github/workflows/review-gate.yml` 로 1R 수정분(`branch_guard.py` paths 등재, `.claude/hooks` sys.path 제거, `permissions: contents: read`, env 경유 `${{ }}`)이 실제로 반영됐는지 diff 로 직접 확인.

## 발견사항

- **[WARNING]** "판정자는 하나다"(`OneJudgeTest`) 가드가 **4번째 우회 표면**을 남긴다 — `os.popen` / 동적 `__import__`
  - 위치: `.claude/tests/test_review_gate_ci.py:224`(`_ALLOWED_IMPORTS` 허용목록), `:279`(호출 금지목록 `("os.walk", "os.scandir", "os.listdir", "open")`)
  - 상세: 이 가드는 이미 세 번 우회됐고(전체 grep → docstring 충돌, 금지 문구 → 안내 문구 충돌, 금지 연산 목록 → `pathlib.rglob`/`from os import walk as _w`) 4번째 판(import 허용목록 + alias 정규화)으로 재작성됐다. 그런데 두 가지 잔여 표면이 있다: (1) `os` 는 이미 허용목록에 있고 `os.popen`은 금지 호출 목록(`os.walk`/`os.scandir`/`os.listdir`/`open`)에 없다 — `os.popen("find " + root + " -name SUMMARY.md").read()` 처럼 셸을 통해 리뷰 산출물을 스스로 읽는 "두 번째 판정자"를 새 import 없이 그대로 쓸 수 있다. (2) `subprocess = __import__("subprocess")` 형태는 `ast.Import`/`ast.ImportFrom` 노드를 전혀 생성하지 않으므로 `imported` 집합에 `subprocess` 가 들어가지 않고, 뒤이은 `subprocess.check_output(...)` 호출도 `alias_of` 에 없는 이름이라 그대로 `"subprocess.check_output"` 로 기록될 뿐 금지목록과 매칭되지 않는다. 두 페이로드 모두 가드의 실제 AST 알고리즘을 그대로 복사해 실행한 결과 `extra == set()` 이고 `banned` 매칭도 없어 **테스트가 GREEN 을 낸다** — "판정자가 스크립트 안에 재구현되지 않는다"는 성질이 거짓인 채로 통과한다. 현재 `check-review-gate.py` 자체는 이 패턴을 쓰지 않으므로 활성 결함은 아니지만, 이 파일이 이미 3번 우회된 이력을 가진 만큼 4번째 표면을 기록해 둘 가치가 있다.
  - 제안: 금지 호출목록에 `os.popen`을 추가하고, `Call` 노드의 `func` 가 `ast.Name`(`__import__`) 인 경우 그 자체를 재판정 시도로 취급(전체 차단 또는 별도 경고). 근본적으로는 "허용된 모듈로 도달 가능한 모든 파일/프로세스 I/O" 를 열거하는 대신, "이 스크립트가 `review_guard.evaluate_review` 외의 어떤 파일시스템/프로세스 부수효과도 갖지 않는다"는 성질을 실행 시점에 확인하는 방향(예: `os.popen`/`subprocess`/파일 열기를 몽키패치해 호출되면 실패시키는 통합 테스트)을 고려.

- **[WARNING]** `WorkflowWiringTest` — 1R 에서 "substring 이 아니라 구조로 판정한다"고 재작성을 주장했으나, 4개 서브테스트 중 2개는 **여전히 필드 내부 substring**
  - 위치: `.claude/tests/test_review_gate_ci.py:328-333`(`test_a_step_actually_runs_the_script`), `:335-340`(`test_the_job_condition_exempts_dependabot`, 특히 339-340행의 두 개별 `assertIn`)
  - 상세: 1R 리뷰가 잡은 두 우회 — (a) `if:` 를 지우고 같은 문자열을 `env:` 에 남기기, (b) `run:` 을 `true` 로 바꾸기 — 는 "파일 전체 텍스트" 대신 "해당 YAML 필드 값"으로 스코프를 좁혀 실제로 막혔다(검증: `self.job.get("if", "")`, `st["run"]` 처럼 필드 단위로 파싱). 하지만 좁혀진 그 필드 **안에서도 검사 방식이 여전히 substring** 이다. 직접 실행해 확인한 두 반례: ① `test_the_job_condition_exempts_dependabot` 은 `"dependabot[bot]" in cond` 와 `"!=" in cond` 를 독립 검사만 하므로, `cond = "github.actor == 'dependabot[bot]' && env.FOO != env.BAR"` — **의미상 정반대**(봇일 때만 job 이 돈다)인 조건도 두 assertIn 을 모두 통과한다. ② `test_a_step_actually_runs_the_script` 는 `"scripts/check-review-gate.py" in c` 를 `run:` 값 전체에 대해 검사하므로, `run: |\n  echo "not actually running: scripts/check-review-gate.py"\n  true` 처럼 스크립트를 **실행하지 않고 문자열만 언급**하는 decoy step 도 통과한다. 두 경우 모두 클래스 docstring 이 명시적으로 주장하는 "구조로 판정한다 — substring 이 아니라" 는 성질을 실제로는 완전히 만족하지 않는다 — 이번엔 whole-file→field 로 스코프만 좁혔을 뿐, field 내부 매칭 방식 자체는 그대로다. (반대로 `test_checkout_fetches_full_history`(fetch-depth 키 직접 비교)와 `test_trigger_paths_cover_the_logic_it_depends_on`(리스트 원소 exact match)은 진짜 구조적이라 이 결함이 없음을 함께 확인했다.)
  - 제안: (a) 는 정규식(예: `re.search(r"actor\s*!=\s*['\"]dependabot\[bot\]['\"]", cond)` 하나로 대체하거나, GH Actions 식을 최소 토큰화해 `!=` 좌우 피연산자를 실제로 대조. (b) 는 `run:` 텍스트를 셸 파서로 토큰화해 실행 커맨드(주석/echo 인자가 아닌 실제 명령 위치)만 대조하거나, 최소한 `#`/`echo` 로 시작하는 라인은 제외하는 휴리스틱을 추가.

- **[INFO]** 1R WARNING("`branch_guard.py` 가 `review-gate.yml` trigger paths 에서 누락") 해소 확인
  - 위치: `.github/workflows/review-gate.yml:31`(`- '.claude/hooks/_lib/branch_guard.py'`), 대응 테스트 `.claude/tests/test_review_gate_ci.py:360`
  - 상세: `review_guard._default_branch()` 가 `branch_guard._origin_default_branch` 를 import 하는데, 1R 시점엔 `review-gate.yml` 의 `paths:` 에 `review_guard.py` 만 있고 형제 모듈이 없었다. `git show fb463845d -- .github/workflows/review-gate.yml` 로 이번 diff 가 그 항목을 추가했음을, `test_trigger_paths_cover_the_logic_it_depends_on` 이 리스트 멤버십으로(진짜 구조적으로) 고정했음을 확인했다.
  - 제안: 없음 — 해소 확인.

- **[INFO]** 새 서드파티 의존성 없음 — 이번 PR(2R diff) 자체는 PyYAML 설치 스텝을 추가하지 않는다
  - 위치: `.github/workflows/harness-checks.yml`(전체 diff = `scripts/check-review-gate.py`/`scripts/check-override-floors.py` 두 paths 항목뿐), `.github/workflows/review-gate.yml`(설치 스텝 없음, "표준 라이브러리만 쓴다" 주석)
  - 상세: `Install PyYAML` 스텝(`pip install "pyyaml>=6,<7"`)은 merge-base 커밋 `06c2651c9`(=현재 `origin/main`)에 이미 존재하며, 이번 PR 은 해당 스텝을 건드리지 않는다 — `git diff --stat origin/main...HEAD` 상 `harness-checks.yml` 변경은 +3줄뿐이고, `git show 06c2651c9:.github/workflows/harness-checks.yml` 에서 동일 스텝을 직접 확인했다. 핀(`pyyaml>=6,<7`)은 `deps-security-checks.yml` 의 두 잡과 문자 그대로 동일해 버전 파편화가 없다. PyYAML(MIT)은 저장소 라이선스(AGPL-3.0)와 호환되고, 전 사용처가 `safe_load`/`SafeLoader` 서브클래스만 써 고전적 `yaml.load()` RCE 계열 취약점 패턴이 없다. `check-review-gate.py`/`test_review_gate_ci.py` 는 표준 라이브러리(`argparse os sys shutil subprocess tempfile unittest`)와 프로젝트 내부 모듈(`review_guard`, `_harness`)만 쓴다.
  - 제안: 없음.

- **[INFO]** 내부 의존성 — "판정자는 하나" 설계가 실제로 재구현을 두지 않는다(위 WARNING 의 잔여 표면 제외)
  - 위치: `scripts/check-review-gate.py:69-70`(`import review_guard` / `return review_guard.evaluate_review`)
  - 상세: `check-review-gate.py` 는 트리 순회·정규식·git 호출 등 자체 판정 로직을 두지 않고 로컬 훅과 동일한 `review_guard.evaluate_review()` 하나에 위임한다 — `report_paths`/`retry_state` 에서 이미 두 번 겪은 "로컬/CI drift" 재발을 구조적으로 차단한다. `_load_gate()` 는 이제 `.claude/hooks/_lib` 하나만 `sys.path` 에 얹는다(1R INFO — "`.claude/hooks` 부모 디렉터리 추가가 실측상 불필요" — 반영되어 제거됨, `review_guard.py` 자신이 `_CLAUDE_DIR` 를 계산해 `_shared` 임포트를 스스로 해결하므로 호출자가 추가로 챙길 게 없음을 `review_guard.py:122,147-150` 에서 재확인).
  - 제안: 없음.

## 요약

이번 2R diff 는 새 서드파티 패키지를 추가하지 않는다 — 배경으로 언급되는 PyYAML 설치 스텝은 merge-base 에 이미 있었고 핀·로더 사용 모두 안전함을 재확인했다. 1R 의 실질적 WARNING(`branch_guard.py` trigger-path 누락, 불필요한 `.claude/hooks` sys.path 추가)은 이번 diff 에서 해소됐다. 다만 이 파일이 반복적으로 우회돼 온 두 가드 — "판정자는 하나"(`OneJudgeTest`) 와 "구조로 판정한다"(`WorkflowWiringTest`) — 를 같은 방법(가드 알고리즘을 그대로 실행해 합성 페이로드로 시험)으로 재시도한 결과, 각각 새로운 잔여 우회 표면을 실측했다: `OneJudgeTest` 는 `os.popen`/동적 `__import__` 로 새 import 없이 재판정을 구현할 수 있고, `WorkflowWiringTest` 의 두 서브테스트(`if:` 조건 검증, `run:` 실행 확인)는 필드 스코프는 좁혔지만 그 안에서 여전히 독립적 substring 매칭에 의존해 의미가 반대인 조건이나 미실행 decoy 를 통과시킨다. 둘 다 활성 결함은 아니며(현재 스크립트/워크플로는 안전한 형태), 이 파일이 같은 클래스로 이미 3~4번 우회된 이력이 있다는 점에서 다음 라운드 전 닫아 두는 편이 싸다.

## 위험도

MEDIUM
