# 문서화(Documentation) 리뷰 — deps-guard-hardening (2차 라운드)

## 발견사항

- **[CRITICAL]** `harness-checks.yml`에 새로 삽입한 "PyYAML 설치" 주석·스텝이 YAML 매핑 구조를 깨뜨려, 그 주석이 서술하는 동작이 실제로 일어나지 않는다 — 1차 리뷰(01_12_24) WARNING("harness-checks.yml unittest 잡에 PyYAML 설치 스텝이 없다")을 고치려던 편집이 같은 결함을 다른 모습으로 재현한다.
  - 위치: `.github/workflows/harness-checks.yml:69-76`
  - 상세: 69행 `- name: Run harness unit tests` 바로 아래 70-73행에 4줄 주석이 끼어들고, 74행에서 `- name: Install PyYAML`이라는 **새 스텝**이 시작된다. 그 결과 (a) "Run harness unit tests" 스텝은 `run:`/`uses:`가 전혀 없는 빈 스텝이 되고, (b) "Install PyYAML" 스텝 안에는 `run:` 키가 75·76행에 **두 번** 나온다. 실제로 이 파일을 `python3 -c "import yaml; print(yaml.safe_load(open('.github/workflows/harness-checks.yml'))['jobs']['unittest']['steps'])"`로 직접 파싱해 확인한 결과:
    ```
    {"name": "Run harness unit tests"}
    {"name": "Install PyYAML", "run": "python3 -m unittest discover -s .claude/tests -p 'test_*.py'"}
    ```
    YAML 매핑에서 중복 키는 **마지막 값이 남는다** — 75행의 `run: pip install "pyyaml>=6,<7"`은 조용히 사라지고, "Install PyYAML"이라는 이름의 스텝이 실제로는 `python3 -m unittest discover ...`를 실행한다. `pip install`은 이 잡의 어떤 스텝에서도 실행되지 않는다(GitHub Actions 자체가 중복 매핑 키를 스키마 위반으로 거부해 워크플로 파일 전체가 무효화될 가능성도 있다 — 어느 쪽이든 CI 결과는 실패다). 새로 삽입된 주석(70-73행)은 "PyYAML 이 필요해졌다 ... 같은 pin 을 재사용한다"고 서술하지만, 그 서술이 가리키는 스텝은 실제로 그 일을 하지 않는다 — 주석 내용과 실제 동작이 정면으로 어긋나는, 이 리뷰 관점(§4 주석 정확성)에서 가장 심각한 사례다. `.claude/tests/test_override_floors.py`는 `setUp()`/서브프로세스에서 `scripts/check-override-floors.py`를 직접 로드하는데 그 스크립트가 모듈 최상단에서 `import yaml`을 시도하므로(스크립트 46-50행), PyYAML이 기본 포함되지 않은 `actions/setup-python@v7` 러너에서는 해당 테스트들이 CI에서만 ERROR/FAIL한다 — 로컬은 이미 PyYAML이 설치돼 있어 이 갭이 은폐된다는 점까지 원 WARNING이 정확히 예견한 그대로다. 부수적으로, 70-72행 주석 자체도 "같은 파일 `deps-security-checks.yml` 의 config-guard 잡"이라고 쓰는데, 이 주석이 있는 파일은 `harness-checks.yml`이므로 `deps-security-checks.yml`은 "같은 파일"이 아니라 별개 파일이다 — 재작성 시 함께 정리할 것.
  - 제안: 두 스텝을 분리해 원래 의도대로 복원한다.
    ```yaml
          - name: Install PyYAML
            run: pip install "pyyaml>=6,<7"

          - name: Run harness unit tests
            run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    ```
    수정 후 `python3 -c "import yaml; ..."`로 실제 파싱 결과를 재확인할 것 — diff를 눈으로만 보면 "줄이 정상적으로 삽입됐다"로 보이기 쉽고, 매핑 키 중복은 리뷰에서 놓치기 쉬운 클래스다.

- **[WARNING]** 하네스 스위트의 "stdlib 전용·설치 스텝 없음"이라는 명시적 불변식이 이번 PR로 깨졌는데, 그 불변식을 선언하는 두 문서 중 어느 쪽도 갱신되지 않았다.
  - 위치: `.claude/tests/README.md:14-17`, `.github/workflows/harness-checks.yml:1-3`
  - 상세: `README.md`는 "No install step. The suite uses **only the standard library** ... hooks must run on a bare `python3`. **Do not introduce `pytest`/`requirements.txt` here without revisiting that convention.**"라고 명시하고, `harness-checks.yml` 헤더 주석도 "Stdlib-only `unittest`, no install step."이라고 못박는다. 이번 PR은 `test_override_floors.py`가 대상 스크립트의 `import yaml`을 통해 PyYAML(서드파티 패키지)을 요구하게 만들어 정확히 이 "revisit"이 필요한 상황을 만들었지만, 두 서술 중 어느 것도 고쳐지지 않았다. 심지어 `harness-checks.yml` 내부에서도 (구조는 깨져 있지만) "Install PyYAML"이라는 이름의 스텝이 새로 생겼는데 파일 맨 위 1-3행은 여전히 "no install step"이라고 말해, 같은 파일 안에서도 서술과 실제 의도가 모순된다.
  - 제안: 위 CRITICAL을 고치면서 두 문서에 "harness 스위트는 원칙적으로 stdlib 전용이나, `test_override_floors.py`가 검사 대상 스크립트의 `import yaml` 때문에 예외적으로 PyYAML을 요구한다"는 취지의 한 줄을 명시적 예외로 추가할 것.

- **[WARNING]** `PROJECT.md`가 `deps-security-checks.yml`의 잡 구성을 여전히 2개로만 서술해, 이번 PR이 추가한 세 번째 잡이 누락돼 있다.
  - 위치: `PROJECT.md:48` (diff에 포함되지 않은 파일 — `deps-security-checks.yml:74-94`의 신규 `override-floors` 잡과 비교해 직접 확인)
  - 상세: 해당 줄은 "CI(`deps-security-checks.yml`)가 (1) `pnpm audit --audit-level=moderate` 로 ... 차단하고, (2) `scripts/check-pnpm-security-config.py` 로 ... 검증한다"는 번호 매긴 문장으로 이 워크플로가 수행하는 검사를 정의한다. 이번 PR은 같은 워크플로 파일에 세 번째 잡 `override-floors`(`scripts/check-override-floors.py`, 오버라이드로 관리 중인 패키지의 바닥 침식 검출)를 추가했지만 이 서술은 갱신되지 않았다. `PROJECT.md`는 CLAUDE.md가 "실제 명령·인프라"의 단일 진실로 지목하는 문서이고, 이 줄 자체가 "의존성 취약점 audit·핀 거버넌스" 절이라 신규 잡과 주제가 정확히 겹친다 — 이 문서만 읽는 개발자는 override-floors 게이트의 존재도, `EXPECTED_SUPPRESSED_PATHS`/override 값을 바꿀 때 이 게이트도 함께 통과해야 한다는 사실도 알 수 없다.
  - 제안: "(3) `scripts/check-override-floors.py` 로 이미 `overrides` 핀이 걸린 패키지가 새 CVE 로 다시 취약해지는 '바닥 침식'을 검출한다" 정도의 절을 (1)/(2) 뒤에 추가.

- **[WARNING]** `.claude/tests/README.md`의 `test_dependabot_npm_coverage.py` 카탈로그 행이 이번 PR로 추가된 워크스페이스-루트 예외 로직을 반영하지 못한다 — 카탈로그 완전성 가드는 행의 존재만 검사하고 내용 정확성은 검사하지 않아 이 갭이 CI로 드러나지 않는다.
  - 위치: `.claude/tests/README.md:28` vs `.claude/tests/test_dependabot_npm_coverage.py`(`_legitimate_dependabot_directories` 46-48행, `test_workspace_root_stays_registered` 309행, `test_root_exception_does_not_admit_workspace_members` 323행 — 전부 이번 diff의 신규 추가분)
  - 상세: README 행은 "Every npm tree OUTSIDE the pnpm workspace is registered ... (and no entry points at a tree that no longer exists)"로만 서술한다. 이번 PR은 같은 테스트 파일에 (a) 워크스페이스 **루트**가 등록에서 빠지면 안 된다는 정반대 방향의 새 불변식(`test_workspace_root_stays_registered` — 근거: `#1029`/`#1030` lockfile drift 방지), (b) 그 예외가 루트 한 곳으로만 좁게 한정된다는 불변식(`test_root_exception_does_not_admit_workspace_members`)을 추가했는데, README 행은 이 확장을 전혀 언급하지 않는다. `test_tests_readme_catalog.py`의 `CatalogCoverageTest.test_every_test_file_is_documented`는 파일명이 표에 등재만 됐는지 검사할 뿐 행의 내용이 실제 커버리지와 일치하는지는 검사하지 않으므로(직접 확인: `class ParserSanityTest`/`CatalogCoverageTest` 어디에도 본문 대조 로직 없음), 이 서술 갭은 자동 가드로 잡히지 않는다.
  - 제안: 행에 "워크스페이스 루트(`directory: \"/\"`)는 독립 트리 커버리지 목적이 아니라 lockfile 최신성 유지(#1029/#1030) 목적으로 예외적으로 등록이 요구되며, 그 예외는 루트 한 곳으로 한정된다"는 문장을 추가.

- **[WARNING]** `test_override_floors.py` 모듈 docstring이 "세 축이다"라고 선언한 직후 번호 매긴 항목을 **4개** 나열한다 — 같은 불일치가 `README.md`의 미러 서술에도 반복된다.
  - 위치: `.claude/tests/test_override_floors.py:7`("여기서 고정하는 것은 세 축이다.") vs 9/17/20/25행의 1~4번 항목 / `.claude/tests/README.md:29`("Three axes."로 시작해 **Key extraction**·**Classification**·**Suppressed-path baseline**·**Fail-closed** 4개를 볼드로 나열, 마지막은 스스로 "covers the **fourth**"라고 씀)
  - 상세: 테스트 클래스도 `OverrideTargetExtractionTest`·`ClassificationTest`·`SuppressedPathBaselineTest`·`FailClosedTest`(+ 시나리오 회귀 `MultipleMatchTest`) 로 3축이 아니라 4축 구성이다. 4번 항목 자신도 "축 1~3 을 다 통과한 채로"(25-27행)라고 적어 1~3과 4를 구분하고 있어, 이 자체가 "축이 4개"라는 사실을 스스로 증언한다. `plan/in-progress/deps-guard-hardening.md`(현재 워크트리, 아직 미커밋 — `git diff HEAD`로 확인)는 이미 "**18건**(**4축**: 키 추출 · 분류 · `ignoreCves` 억제 경로 baseline · fail-closed)"로 정정되어 있어, 축이 3→4로 늘었다는 사실이 plan에는 전파됐지만 그 근거인 테스트 docstring과 README 카탈로그 행에는 아직 전파되지 않았음을 재확인할 수 있다. 이 파일 자신이 "추출이 틀리면 가드가 아무것도 안 잡으므로 이 축이 가장 중요하다"며 정밀한 서술을 표방하는 만큼, 셀프 카운트가 틀린 채로 남아있는 건 사소해도 자기모순적이다.
  - 제안: `test_override_floors.py:7`을 "네 축이다"로, `README.md:29`의 "Three axes."를 "Four axes."로 정정해 plan 체크리스트와 맞춘다.

- **[INFO]** `README.md`의 신규 카탈로그 행이 `MultipleMatchTest`(이 기능의 발단 시나리오 회귀)를 이름으로 언급하지 않는다.
  - 위치: `.claude/tests/README.md:29`
  - 상세: `MultipleMatchTest`(`test_reports_only_managed_among_many`)는 "여러 advisory 중 일부만 override 대상"이라는, plan 문서가 이 기능의 존재 이유로 서술하는 바로 그 시나리오(#1038, 17건 중 4건)를 검증하려고 1차 리뷰 WARNING에 대응해 추가된 별도 클래스인데, 네 축 서술 어디에도 명시적으로 등장하지 않는다(암묵적으로 "Classification" 인접 범주로 읽힐 수 있으나 별개 클래스다).
  - 제안: 우선순위 낮음 — 여유 있을 때 한 구절 추가.

## 요약

이번 diff는 1차 리뷰(01_12_24)가 지적한 CI 완전성 3건(harness-checks paths 등재, README 카탈로그 등재, dependabot 루트 등록 충돌)과 보안·테스트 WARNING(`ignoreCves` 전역 억제 사각, `run_audit()` fail-open, `override_target()` 다단 체인 docstring 불일치, harness 잡의 PyYAML 미설치)을 대체로 성실히 반영했고, 그 과정에서 남긴 docstring·plan 서술은 이례적으로 상세하고 "왜"를 정확히 설명한다. 그러나 정확히 그 PyYAML 수정 자체가 `harness-checks.yml`의 YAML 매핑 구조를 깨뜨려(중복 `run:` 키가 `pip install`을 조용히 삼키고, 원래 스텝은 빈 껍데기로 남음) — 자신이 고치려던 "설치 스텝 없음" 문제를 다른 모습으로 그대로 재현하며 CI를 확정적으로 실패시킨다. 이 편집이 남긴 흔적으로, 하네스의 "stdlib 전용·설치 불필요"라는 자체 선언(README.md·harness-checks.yml 헤더)도 갱신 없이 깨진 채 방치됐다. 그 외에 자동 가드가 "존재 여부"만 확인하고 "내용 정확성"은 확인하지 못하는 지점들 — `PROJECT.md`에 신규 CI 잡 미기재, README의 dependabot 테스트 서술이 이번에 추가된 워크스페이스-루트 예외를 반영하지 못함, `test_override_floors.py` 자신의 "세 축" 서술이 실제 4축과 어긋남(plan 문서만 정정됨) — 이 여러 곳에서 확인됐다. 프로덕션 로직(스크립트·YAML 값)의 문서화 자체는 촘촘하지만, 이번 라운드의 편집이 기존 서술 3곳(PROJECT.md·README 두 지점·자기 docstring)에 새로운 drift를 만들었다는 점이 핵심 리스크다.

## 위험도

CRITICAL — 문서화 성격의 편집 실수(주석 삽입 위치)가 그대로 CI 확정 실패로 이어지는 결함을 만들었기 때문.
