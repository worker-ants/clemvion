# 보안(Security) 리뷰 — deps-guard-hardening (재검증 라운드)

이번 라운드는 직전 리뷰(`review/code/2026/08/01/01_12_24`)의 CRITICAL/WARNING 조치 결과를 재검증하는 diff다. 대부분의 지적사항은 올바르게 조치됐으나, **`harness-checks.yml`에 대한 조치 자체가 새 CRITICAL 결함을 만들었다** — 실제로 스크립트를 실행해 검증했다.

## 발견사항

- **[CRITICAL]** `harness-checks.yml`의 PyYAML 설치 스텝 추가가 YAML 중복 키로 깨져 있다 — 설치 커맨드는 절대 실행되지 않고, 그 워크플로 전체가 무효화될 위험이 있다.
  - 위치: `.github/workflows/harness-checks.yml:69`(빈 스텝이 되는 `- name: Run harness unit tests`), `:74-76`(중복 `run:` 키가 있는 `- name: Install PyYAML` 스텝)
  - 상세: 실제로 이 저장소의 커밋된 파일(`git show HEAD:.github/workflows/harness-checks.yml`)을 `yaml.safe_load`로 직접 파싱해 검증했다. `unittest` job의 steps 배열은 다음과 같이 파싱된다.
    ```
    { "name": "Run harness unit tests" }                                    # run/uses 둘 다 없음
    { "name": "Install PyYAML",
      "run": "python3 -m unittest discover -s .claude/tests -p 'test_*.py'" }  # pip install 줄이 사라짐
    ```
    원인은 YAML 문법 그 자체다 — 69행 `- name: Run harness unit tests` 스텝에 원래 있던 `run:` 한 줄을 아래로 이동시키지 않은 채 74행에 `- name: Install PyYAML`이라는 **새 스텝**을 끼워 넣었고, 그 새 스텝 안에 `run: pip install "pyyaml>=6,<7"`(75행)과 기존 `run: python3 -m unittest discover ...`(76행)이 **같은 매핑에 중복 키로 공존**하게 됐다. YAML 은 동일 매핑 내 중복 키를 마지막 값으로 덮어쓰므로(PyYAML `safe_load` 로 직접 재현·확인됨), `pip install "pyyaml>=6,<7"`은 **파싱 단계에서 조용히 소실**되고 "Install PyYAML" 스텝은 실제로는 `python3 -m unittest discover ...`만 실행한다. 동시에 앞선 "Run harness unit tests" 스텝은 `run`도 `uses`도 없는 빈 스텝이 되는데, 이는 GitHub Actions 워크플로 스키마 위반이다(스텝은 `run`/`uses` 중 하나를 반드시 가져야 함) — 이 조합은 실행 시점이 아니라 **워크플로 파싱 시점에 GitHub Actions가 "Invalid workflow file"로 job 전체를 거부**할 가능성이 높다(중복 매핑 키·액션 부재 스텝은 GitHub Actions 워크플로 파서가 알려진 방식으로 거부하는 패턴). 파싱 자체는 통과하더라도 결과적으로 PyYAML은 절대 설치되지 않는다는 사실은 이미 직접 파싱으로 확정됐다.
    이 결함은 정확히 **직전 라운드 자신의 WARNING을 고치려던 시도가 만든 회귀**다 — 직전 testing 리뷰는 "`test_override_floors.py`가 `import yaml`을 필요로 하는데 `harness-checks.yml`의 unittest job엔 설치 스텝이 없다"를 지적했고, 이번 조치 커밋(`3ff26348c`)이 그 스텝을 추가했지만 병합 위치가 틀려 정반대로 "PyYAML이 확정적으로 설치되지 않는다"는 상태를 만들었다(이전엔 "일부 러너 이미지에 없으면"이라는 조건부 리스크였는데, 지금은 무조건이다). `git diff origin/main -- .github/workflows/harness-checks.yml`로 대조해 이 결함이 이번 PR이 새로 도입한 것임을 확인했다(기존 라인은 정상적인 단일 `run:` 스텝이었다).
    영향 범위가 이 새 job 하나에 그치지 않는다 — `harness-checks.yml`은 `.claude/agents/**`, `.claude/hooks/**`, `.claude/skills/**`, `.claude/tests/**`, `.github/dependabot.yml`, `.github/workflows/e2e.yml`, `pnpm-workspace.yaml` 등 이 저장소의 보안·일관성 불변식 대부분을 지키는 700여 건의 하네스 회귀 테스트(dependabot 커버리지, e2e 면제 화이트리스트 동기화, doc-sync-matrix 등)를 도는 유일한 게이트다. 워크플로 자체가 무효화되면 이 PR이 막으려는 "조용한 회귀"의 탐지 인프라 전체가 무력화된다.
    또한 plan 체크리스트의 "TEST WORKFLOW — lint/unit/build/e2e PASS"는 PROJECT.md 정의상 `harness-checks.yml`(GitHub Actions 전용, 로컬 실행 경로 없음)을 포함하지 않으므로, 이 결함은 로컬 검증으로는 원천적으로 드러나지 않는다.
  - 제안: "Install PyYAML" 스텝과 "Run harness unit tests" 스텝을 완전히 분리한 두 개의 독립 스텝으로 고친다.
    ```yaml
    - name: Install PyYAML
      run: pip install "pyyaml>=6,<7"

    - name: Run harness unit tests
      run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    ```
    가능하면 `actionlint`(또는 `yaml.safe_load` + 중복 키 검출 로더)를 워크플로 파일 대상 pre-commit/CI 린트로 추가해, 이 클래스의 결함이 다시 "로컬 TEST WORKFLOW로는 안 보이고 GitHub Actions에서만 드러나는" 사각지대로 남지 않게 할 것.

- **[INFO]** 직전 라운드의 보안 WARNING(`run_audit()`의 fail-open 가능성)이 정확히 조치됐다.
  - 위치: `scripts/check-override-floors.py:116-154`(`run_audit()`) — 빈 stdout(131-138행), JSON 파싱 실패(139-144행), `actions` 키 부재(145-153행) 세 경로 모두 `sys.exit(2)`로 fail-closed 처리. 회귀 테스트는 `.claude/tests/test_override_floors.py`의 `FailClosedTest`(빈 stdout·파싱 불가·`actions` 없는 오류 페이로드 세 케이스, 각각 exit 2 검증) + 최신 커밋(`969f7ac0d`, "fail-closed 분기 회귀 테스트")이 세 분기를 fail-open으로 되돌리는 뮤턴트 3건 전부 RED임을 확인했다고 기록.
  - 상세: `pnpm audit` 실행 실패·레지스트리 오류를 "취약점 0건"으로 오인하지 않도록 출력 형태 기반 판정으로 전환했고, 이는 이 가드가 막으려는 "조용한 통과"를 자기 자신이 재현하던 이전 결함을 해소한다. 추가 조치 불요.

- **[INFO]** 직전 라운드의 dependency CRITICAL(`ignoreCves` 전역 억제로 override-floors 탐지가 무력화되는 문제, `brace-expansion` 실사례)이 `classify_vulnerable()` + `EXPECTED_SUPPRESSED_PATHS` 경로 baseline으로 조치됐다.
  - 위치: `scripts/check-override-floors.py:157-193`(`classify_vulnerable` — `advisories`에서 사라진 항목도 `actions[]`의 `module`+`resolves[].path`로 존재를 포착), `:210-241`(`main()`의 `widened` 판정 — baseline 대비 신규 경로 발견 시 fail).
  - 상세: `ignoreCves`가 CVE-ID 단위로 `advisories`를 전역 삭제해도, `actions[]`에는 억제된 항목이 남는다는 점을 이용해 "수용 시점 경로"를 `EXPECTED_SUPPRESSED_PATHS`에 고정하고 경로가 늘면(=수용 범위 밖 재유입) fail시키는 설계다. 새 baseline에 없는 모듈/경로는 기본값 빈 집합과 비교되어 항상 "extra"로 걸리므로 실패-안전(fail-safe) 방향으로 설계됐다. 수동 유지되는 baseline이라는 한계는 스크립트 docstring이 스스로 인정하고 plan에 후속으로 등재해 뒀다 — 현시점 결함은 아니다.

- **[INFO]** 신규 스크립트·테스트에서 고전적 인젝션/시크릿/인가 클래스 문제는 발견되지 않았다.
  - 위치: `scripts/check-override-floors.py`(전체) — `subprocess.run(["pnpm", "audit", ...], ...)`이 리스트 인자·`shell=True` 없이 호출되어 커맨드 인젝션 경로가 없고, `yaml.safe_load()`만 사용해(`load_override_targets`, 108행) 임의 코드 실행 위험이 있는 `yaml.load`/`yaml.unsafe_load`를 피했다. `_RANGE_SUFFIX` 정규식(`^(?P<name>@[^@/]+/[^@]+|[^@]+)@.+$`)은 중첩 정량자가 없는 부정 문자 클래스 기반이라 파국적 백트래킹(ReDoS) 패턴이 아니다. 하드코딩된 API 키·토큰·비밀번호 없음.
  - 상세: 처리 대상(override 키, `pnpm audit` JSON 응답)은 전부 저장소 내부 파일과 신뢰된 툴체인 출력이라 외부 사용자 입력 경로가 없다. `.claude/tests/test_override_floors.py`의 `_run_with_stub_audit`가 `json.dumps()`로 감싼 값을 f-string에 삽입해 가짜 `pnpm` 스크립트를 생성하는 패턴도 값이 전부 같은 테스트 파일 내 하드코딩 리터럴이라 공격 경로 없음(직전 라운드와 동일 평가, 변경 없음).

- **[INFO]** 신규 `override-floors` job이 참조하는 GitHub Actions가 가변 메이저 태그로 고정됨 — 기존 관례 유지, 신규 회귀 아님.
  - 위치: `.github/workflows/deps-security-checks.yml:79-86`(`actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`, `actions/setup-python@v7`).
  - 상세: 같은 파일의 기존 `config-guard`/`audit` job도 동일 컨벤션이라 이번 PR이 새로 만든 회귀는 아니다. 이 파일 자체는 YAML 중복 키 등 구조적 결함 없음(직접 파싱으로 확인).

## 요약

이번 diff는 직전 리뷰가 지적한 CRITICAL/WARNING 대부분(README 카탈로그 미등재, dependabot 루트 등록 vs 기존 가드 전제 충돌, `ignoreCves` 전역 억제로 인한 탐지 무력화, `override_target()`의 다단 부모 경로 처리, fail-open 가능성)을 실제로 올바르게 조치했다 — 코드·테스트를 직접 실행·파싱해 대조 검증했다. 그러나 **직전 WARNING("harness-checks.yml에 PyYAML 설치 스텝이 없다") 자체를 고치려던 편집이 새 CRITICAL 결함을 만들었다**: 삽입된 "Install PyYAML" 스텝이 기존 "Run harness unit tests" 스텝과 잘못 병합돼 YAML 매핑에 `run:` 키가 중복되고, PyYAML 설치 커맨드가 파싱 단계에서 소실되며 앞선 스텝은 액션이 없는 스키마 위반 상태가 된다(커밋된 파일을 `yaml.safe_load`로 직접 파싱해 확정). 이 워크플로는 이 저장소 전역의 보안·CI 완전성 불변식을 지키는 유일한 게이트라, 이 결함이 워크플로 전체를 무효화할 경우 이번 PR이 막으려던 "조용한 보안 회귀" 탐지 인프라 자체가 꺼진다. 이 결함은 로컬 TEST WORKFLOW(lint/unit/build/e2e)로는 드러나지 않아 GitHub Actions 실행 전에는 발견되기 어렵다. 그 외 신규 프로덕션 코드(`check-override-floors.py`)에서는 커맨드 인젝션·안전하지 않은 YAML 로딩·하드코딩 시크릿 등 고전적 취약점이 없고, 이전에 지적된 fail-open·탐지 무력화 결함도 견고하게 재설계됐다.

## 위험도

CRITICAL
