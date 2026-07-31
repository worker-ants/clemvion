# 부작용(Side Effect) 리뷰 — deps-guard-hardening

## 발견사항

- **[CRITICAL]** `harness-checks.yml`에 삽입된 `Install PyYAML` 스텝이 인접한 `Run harness unit tests` 스텝의 YAML 매핑 경계를 손상시켜, (a) 의도한 `pip install "pyyaml>=6,<7"` 실행이 무효화되고 (b) 그 결과 워크플로 자체가 스키마 위반으로 깨질 수 있다.
  - 위치: `.github/workflows/harness-checks.yml:69-76`
  - 상세: diff는 기존 `- name: Run harness unit tests` 스텝(69번 줄) 뒤에 주석 4줄(70-73번 줄)을 넣고 이어서 `- name: Install PyYAML` / `run: pip install "pyyaml>=6,<7"` 두 줄(74-75번 줄)을 새로 삽입했는데, 원래 있던 `run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 줄(76번 줄)의 들여쓰기를 그대로 두었다. 그 결과 YAML 파서가 보는 구조는 다음과 같다(직접 `yaml.safe_load()`로 파싱해 확인):
    ```
    {'name': 'Run harness unit tests'}              # run/uses 둘 다 없음
    {'name': 'Install PyYAML',
     'run': "python3 -m unittest discover -s .claude/tests -p 'test_*.py'"}  # run 키 중복 → 뒤엣것만 살아남음
    ```
    즉 76번 줄의 `run:`이 75번 줄의 `run: pip install "pyyaml>=6,<7"`과 **같은 매핑(Install PyYAML 스텝)의 중복 키**가 되어 PyYAML 설치 명령이 통째로 사라지고, `python3 -m unittest discover ...`가 "Install PyYAML"이라는 이름의 스텝 아래에서 실행된다. 동시에 원래의 "Run harness unit tests" 스텝은 `run`도 `uses`도 없는 빈 스텝이 된다 — GitHub Actions 워크플로 스키마는 각 스텝이 `run`/`uses` 중 하나를 가질 것을 요구하므로, 이 형태는 최소한 스텝 자체가 무의미해지는 것을 넘어 GitHub이 워크플로 파일 자체를 파싱 단계에서 거부할 위험이 있다(그 경우 harness-checks의 어떤 job도 아예 실행되지 않는다).
    이것이 명령어 순서 오기 같은 사소한 문제가 아닌 이유: 이 변경은 바로 직전 리뷰 세션(`review/code/2026/08/01/01_12_24`)의 WARNING 4번("harness-checks.yml unittest 잡에 PyYAML 설치 스텝 없음")에 대한 수정으로 커밋 `3ff26348c`에서 추가된 것인데, 그 수정 자체가 깨져 있어 목적("`test_override_floors.py`가 PyYAML을 쓸 수 있게 한다")을 달성하지 못한다 — CI 환경에 PyYAML이 기본 설치돼 있지 않다면 `test_override_floors.py`의 `_load_module()`(모듈 최상단 `import yaml` 실행)이 `sys.exit(2)`를 던져 여전히 실패한다. 이 결함은 현재 워크트리 HEAD(커밋 `969f7ac0d`까지)에 그대로 남아 있음을 `Read`로 실제 파일을 열어 확인했고, 이후 커밋도 이 파일을 건드리지 않았다. `paths:` 목록이 `.claude/agents/**`·`.claude/skills/**`·`.claude/tests/**`·`scripts/*`·`PROJECT.md` 등 매우 넓은 범위를 커버하므로, 이 상태로 머지되면 이후 그 경로들을 건드리는 **모든 PR**에서 `harness-checks` job이 (파싱 실패든 로직 실패든) 계속 실패하게 된다.
  - 제안: 74-75번 줄(`- name: Install PyYAML` / `run: pip install "pyyaml>=6,<7"`)을 별도의 독립된 스텝으로 69번 줄의 `- name: Run harness unit tests` **앞**에 배치하고, 76번 줄의 `run: python3 -m unittest discover ...`는 원래대로 69번 줄 스텝의 `run:` 값으로 되돌릴 것. 수정 후 반드시 `python3 -c "import yaml; print(yaml.safe_load(open('.github/workflows/harness-checks.yml'))['jobs']['unittest']['steps'])"` 같은 방식으로 스텝이 의도대로(3개 스텝: checkout/setup-python은 그대로, PyYAML 설치 스텝 1개, "Run harness unit tests" 스텝 1개) 파싱되는지 확인.

- **[INFO]** (긍정 관측) `test_override_floors.py`의 `PATH` 조작이 실제 프로세스 환경을 오염시키지 않도록 안전하게 구현되어 있다.
  - 위치: `.claude/tests/test_override_floors.py:172` (`_run_with_stub_audit`)
  - 상세: `env = dict(os.environ, PATH=f"{bindir}:{os.environ['PATH']}")`는 `os.environ`을 직접 변경하지 않고 새 `dict` 사본을 만들어 `subprocess.run(..., env=env)`에만 전달한다. 가짜 `pnpm` 실행파일도 `tempfile.TemporaryDirectory()` 스코프 안에서만 생성·정리되어, 테스트가 끝난 뒤 실제 시스템 `PATH`나 파일시스템에 잔존 상태를 남기지 않는다. 실제 레지스트리 네트워크 호출도 이 PATH 우선순위 트릭으로 완전히 차단된다.

## 요약

이번 변경은 신규 CI 게이트(`override-floors`)·스크립트·회귀 테스트·dependabot 등록을 추가하는 작업으로, 새 코드(`scripts/check-override-floors.py`, `test_override_floors.py`) 자체는 전역 상태·환경 변수·파일시스템에 대해 부작용이 잘 통제되어 있다(subprocess 환경은 복사본만 전달, 임시 파일은 tempdir 안에서만 생성·자동 정리, 함수 시그니처·공개 인터페이스 변경 없음, 네트워크 호출은 목적에 부합하는 의도된 `pnpm audit` 하나뿐이고 테스트에서는 PATH 우선순위로 완전히 스텁 처리됨). 그러나 직전 리뷰 라운드의 WARNING을 해소하려던 `harness-checks.yml` 수정 자체가 YAML 매핑 경계를 잘못 건드려, 의도한 `pip install "pyyaml>=6,<7"` 스텝이 인접 스텝의 `run:` 키와 중복되며 소실되고 원래 스텝은 `run`/`uses`가 없는 빈 스텝이 되는 구조적 결함을 새로 만들었다 — 실제 `yaml.safe_load()` 파싱과 현재 워크트리 HEAD의 파일 상태로 직접 확인했다. 이는 "PyYAML을 설치해 테스트가 CI에서 돌게 한다"는 수정 목적을 달성하지 못하는 것을 넘어, 매우 넓은 `paths:` 트리거 범위 때문에 이후 관련 경로를 건드리는 모든 PR에서 `harness-checks` 워크플로가 계속 실패(또는 완전히 파싱 거부)할 위험이 있는 CI 파이프라인 부작용이다.

## 위험도

CRITICAL
