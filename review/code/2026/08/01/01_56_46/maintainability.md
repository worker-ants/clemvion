# 유지보수성(Maintainability) 리뷰 — deps-guard-hardening (2차 라운드)

## 발견사항

- **[CRITICAL]** `harness-checks.yml`의 `unittest` 잡 스텝 블록이 구조적으로 깨져 있다 — 중복 YAML 키로 인해 방금 추가한 PyYAML 설치가 조용히 소실된다.
  - 위치: `.github/workflows/harness-checks.yml:69-76`
  - 상세: 현재 파일 내용은 다음과 같다.
    ```yaml
    - name: Run harness unit tests
    # 2026-08-01 — 이 스위트는 원래 stdlib 전용이었다. ...
    - name: Install PyYAML
      run: pip install "pyyaml>=6,<7"
      run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    ```
    `Run harness unit tests` 스텝에는 `run:`/`uses:` 가 전혀 없고(빈 스텝), `Install PyYAML` 스텝 하나에 `run:` 키가 **두 번** 등장한다. `python3 -c "import yaml; yaml.safe_load(...)"` 로 실제 파싱해 확인한 결과, PyYAML(및 대부분의 YAML 파서)은 중복 매핑 키를 "마지막 값이 이긴다"로 처리한다 — 즉 파싱 결과는 `{'name': 'Install PyYAML', 'run': "python3 -m unittest discover -s .claude/tests -p 'test_*.py'"}` 이고 `pip install "pyyaml>=6,<7"` 줄은 **완전히 소실**된다. `Run harness unit tests` 스텝은 `{'name': 'Run harness unit tests'}` 뿐이라 GitHub Actions 스키마상 `run`/`uses` 가 없는 무효 스텝이다(워크플로 자체가 파싱 단계에서 거부될 위험도 있다). 어느 경로든 결과는 같다 — 이 diff 가 고치려던 "harness-checks.yml 의 unittest 잡에 PyYAML 설치 스텝이 없다"(1차 리뷰 WARNING #4)는 문제가 **그대로 재발**하며, CI 에서 `check-override-floors.py` 의 `import yaml` 이 실패해 `test_override_floors.py` 전체가 로컬에서는 통과하고 CI 에서만 깨지는 결과를 낳는다. 이런 이중 `run:` 은 필시 스텝을 순서 바꿔 삽입하다 잘라붙인 편집 실수이며, 지금 상태로는 다음에 이 파일을 읽는 사람이 "PyYAML 설치가 이미 있다"고 착각하기 쉽다(스텝 이름은 `Install PyYAML` 인데 실제 `run:` 은 unittest 커맨드다).
  - 제안: 두 스텝을 분리해 원래 의도대로 되돌린다.
    ```yaml
    - name: Install PyYAML
      # ...주석...
      run: pip install "pyyaml>=6,<7"

    - name: Run harness unit tests
      run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    ```

- **[WARNING]** "세 축"/"Three axes" 서술이 실제로 나열된 4개 항목과 모순된다 — 같은 오류가 두 곳에 있고, 이미 수정된 세 번째 문서(plan)와도 어긋난다.
  - 위치: `.claude/tests/test_override_floors.py:7`(모듈 docstring, "여기서 고정하는 것은 세 축이다.") 및 `.claude/tests/README.md:29`("Three axes." 로 시작)
  - 상세: `test_override_floors.py` 의 docstring 은 "세 축이다"라고 선언한 뒤 `1. override 키 추출`, `2. 분류 동작`, `3. ignoreCves 억제분의 경로 baseline`, `4. fail-closed` 로 **4개**를 번호까지 붙여 나열한다(`:9-28`). 심지어 4번 항목 서술 안에서 스스로 "축 1~3 을 다 통과한 채로"(`:27`)라고 적어, 3번까지와 4번을 구분하고 있다. `README.md:29` 행도 동일하게 "Three axes." 로 연 뒤 **Key extraction / Classification / Suppressed-path baseline / Fail-closed** 4개를 볼드로 나열하고, 마지막은 명시적으로 "covers the **fourth**" 라고 쓴다 — 자기 문장 안에서 "Three" 와 "fourth" 가 충돌한다. 반면 `plan/in-progress/deps-guard-hardening.md` 체크리스트(라이브 파일 기준 `:110`)는 이미 "**18건**(**4축**: 키 추출 · 분류 · `ignoreCves` 억제 경로 baseline · fail-closed)"로 정확히 고쳐져 있다 — 즉 1차 리뷰 이후 "축이 3→4개로 늘었다"는 사실이 plan 에는 반영됐지만, 그 근거였던 테스트 docstring 과 README 카탈로그 행에는 전파되지 않은 것으로 보인다. 세 문서가 같은 사실을 서로 다른 숫자로 서술하고 있어, 다음에 이 가드를 손대는 사람이 "정말 3축인가 4축인가"를 다시 원문 코드를 읽어 확인해야 한다.
  - 제안: `test_override_floors.py:7` 과 `README.md:29` 의 "세 축"/"Three axes" 를 "네 축"/"Four axes" 로 정정해 plan 체크리스트와 맞춘다.

- **[WARNING]** `check-override-floors.py::main()` 이 두 실패 클래스를 서로 다른 스타일로 다뤄, 자매 스크립트의 확립된 패턴에서 벗어나고 실제로 한 번에 하나의 실패 클래스만 보고한다.
  - 위치: `scripts/check-override-floors.py:196-271`(`main()`), 특히 `:222-241`(`widened` 조기 반환) vs `:243-271`(`eroded` 처리) — 비교 대상: `scripts/check-pnpm-security-config.py:91-145`(`main()`)
  - 상세: 같은 디렉터리의 자매 스크립트 `check-pnpm-security-config.py` 는 세 검사 항목을 전부 `errors: list` 하나에 누적한 뒤 마지막에 한 번만 출력한다(`_check_set()` 헬퍼 + `if errors: print(...)`). 반면 `check-override-floors.py::main()` 은 `widened`(ignoreCves 수용 범위 밖 재유입)를 검사해 문제가 있으면 그 자리에서 stderr 블록을 출력하고 `return 1` 로 **즉시 종료**한다 — 그 아래 `eroded`(override 바닥 침식) 검사 코드는 이 경우 아예 실행되지 않는다(`:243`부터 시작하는 `eroded` 계산 자체가 `widened` 조기 반환 이후에 위치). 즉 `widened` 문제와 `eroded` 문제가 동시에 존재해도 CI 는 `widened` 쪽만 보고하고, 그걸 고쳐 재실행해야 비로소 `eroded` 문제가 드러나는 "한 번에 하나씩" 구조다. 이는 자매 스크립트가 이미 피해간 패턴(전부 모아서 한 번에 보고)과 다르고, `main()` 길이도 그 결과 ~76행으로 `check-pnpm-security-config.py::main()`(~55행)보다 길다.
  - 제안: `widened`/`eroded` 를 모두 계산한 뒤 존재하는 문제를 한 번에 보고하도록 바꾸거나, 최소한 각 보고 블록을 `_report_widened(widened)` / `_report_eroded(eroded)` 헬퍼로 추출해 `main()` 을 제어 흐름 위주로 압축할 것.

- **[WARNING]** 테스트 헬퍼 `_run_with_stub_audit` 가 `self` 를 쓰지 않는데도 인스턴스 메서드로 선언돼 있고, 다른 세 테스트 클래스가 "남의 self" 를 넘겨 호출한다 — 이 저장소의 기존 관례(모듈 레벨 헬퍼)와 다르다.
  - 위치: `.claude/tests/test_override_floors.py:119-178`(`ClassificationTest._run_with_stub_audit` 정의 — 본문에서 `self` 를 한 번도 참조하지 않는다) — 호출부: `:244-249`(`SuppressedPathBaselineTest._run`), `:275-278`(`FailClosedTest._run_raw`), `:301-311`(`MultipleMatchTest.test_reports_only_managed_among_many`) 전부 `ClassificationTest._run_with_stub_audit(self, ...)` 형태로, `self` 자리에 자기 자신(`SuppressedPathBaselineTest`/`FailClosedTest`/`MultipleMatchTest` 인스턴스)을 넘긴다.
  - 상세: `_run_with_stub_audit` 는 `tempfile`/`subprocess` 만 다루는 순수 함수이고 `self` 는 시그니처에만 있을 뿐 본문에서 전혀 사용되지 않는다. 그런데도 `ClassificationTest` 의 (밑줄 접두 = 비공개 의도) 인스턴스 메서드로 선언돼 있고, 3개의 무관한 테스트 클래스가 언바운드 메서드 호출(`ClassName._method(다른_인스턴스, ...)`) 관용구로 이를 재사용한다. 같은 디렉터리의 `test_orchestrator_state.py:34`(`def _run(*args, cwd=None) -> ...`)는 정확히 이런 "인스턴스 상태가 필요 없는 서브프로세스 헬퍼"를 모듈 레벨 함수로 두는 관례를 따른다(`grep` 로 저장소 전체를 확인했을 때 이 파일 밖에서 `ClassName._method(self, ...)` 형태의 크로스클래스 언바운드 호출 패턴은 발견되지 않았다). 지금 구조는 새 기여자가 "왜 `ClassificationTest` 의 private 메서드를 남이 호출하지?"를 되짚어야 하고, 향후 누군가 `_run_with_stub_audit` 안에 진짜 `self.OVERRIDES` 등 `ClassificationTest` 고유 상태를 추가하면 다른 세 클래스의 호출이 조용히 잘못된 값을 참조하게 될 위험도 만든다.
  - 제안: `_run_with_stub_audit` 를 모듈 레벨 함수(`def _run_with_stub_audit(advisories, overrides, actions=None, raw_stdout=None): ...`)로 끌어올리고, 4개 클래스 모두 `self` 없이 직접 호출하도록 정리 — `test_orchestrator_state.py` 의 기존 관례와 일치시킨다.

- **[INFO]** `OVERRIDES` 리터럴 중복 — 두 테스트 클래스가 정확히 같은 문자열을 각자 하드코딩한다.
  - 위치: `.claude/tests/test_override_floors.py:180`(`ClassificationTest.OVERRIDES`)와 `:299`(`MultipleMatchTest.OVERRIDES`) — 둘 다 `"overrides:\n  liquidjs: ^10.27.1\n  next>postcss: ^8.5.18\n"` 로 완전히 동일.
  - 상세: 우연히 지금은 값이 일치하지만, 둘 중 하나만 고치는 향후 편집(예: `liquidjs` 버전 갱신)이 나머지 하나를 조용히 낡게 만들 수 있다. 영향은 테스트 데이터 한정이라 낮음.
  - 제안: 모듈 레벨 상수(예: `_MANAGED_OVERRIDES_YAML`)로 추출해 두 클래스가 공유하게 할 것.

- **[INFO]** 에러 메시지의 잘라내기 길이가 이름 없는 매직 넘버로 하드코딩돼 있다.
  - 위치: `scripts/check-override-floors.py:137`(`proc.stderr[:500]`), `:143`(`out[:2000]`), `:152`(`list(data)[:10]`)
  - 상세: 세 값 모두 디버그 출력 미리보기 길이일 뿐 로직에 영향은 없어 위험도는 낮지만, 왜 500/2000/10 인지 근거가 코드에 없다. 세 스크립트/한 함수 안에서만 쓰이므로 지금 당장 문제는 아니다.
  - 제안: 여유 있을 때 `_STDERR_PREVIEW_CHARS = 500` 류 이름 상수로 옮기면 의도가 더 분명해진다.

- **[INFO]** `advisories` 를 두 번 순회한다 — `classify_vulnerable()` 내부(`reported` 구성)와 `main()` 내부(`patched_by_module` 구성)가 같은 컬렉션을 각각 훑는다.
  - 위치: `scripts/check-override-floors.py:181-185`(`classify_vulnerable` 의 `reported` 루프) vs `:204-208`(`main()` 의 `patched_by_module` dict comprehension)
  - 상세: 기능상 문제는 없다(입력 크기가 audit 결과 수십 건 수준이라 성능 영향도 무시 가능) — 다만 `classify_vulnerable()` 이 반환하는 `reported: dict[str, str]` 을 애초에 `(advisory_id, patched_versions)` 튜플로 확장했다면 `main()` 쪽의 두 번째 순회가 불필요했을 것이라는 구조적 여지가 있다.
  - 제안: 우선순위 낮음 — 다음에 이 함수를 손댈 때 `reported` 의 값 타입을 확장하는 방향을 고려.

## 요약

이번 diff 는 1차 리뷰(01_12_24)의 Critical 4건·Warning 4건을 성실히 반영한 2차 라운드로, `EXPECTED_SUPPRESSED_PATHS` baseline 도입·`run_audit()` fail-closed 강화·다단 체인 override 대상 추출 수정·`harness-checks.yml`/`README.md`/`test_dependabot_npm_coverage.py` 배선 보강 등 실질적인 개선이 확인된다. 스크립트와 신규 테스트 파일(`test_override_floors.py`) 자체는 함수가 짧고 이름이 목적을 잘 드러내며, "왜"를 설명하는 주석과 축 단위로 나눈 테스트 클래스 구조가 읽기 좋다. 그러나 그 배선 보강 자체가 새 결함을 만들었다 — `harness-checks.yml` 의 PyYAML 설치 스텝이 중복 YAML 키로 인해 조용히(또는 파싱 실패로 시끄럽게) 무효화되어, 고치려던 문제를 그대로 재현한다. 이는 diff 검토 없이 편집한 흔적이 남은 구조적 결함이라 반드시 병합 전 수정이 필요하다. 그 외에 "세 축"이라는 서술이 실제로는 4개 항목을 나열하는 자기모순이 테스트 docstring 과 README 카탈로그 두 곳에 동일하게 남아 있고(plan 문서만 4축으로 정정됨), `main()` 의 두 실패 클래스 처리 방식이 자매 스크립트의 확립된 "모아서 한 번에 보고" 패턴과 달라 한 번에 한 클래스만 보고되는 구조이며, 테스트 헬퍼 하나가 이 저장소의 관례(모듈 레벨 서브프로세스 헬퍼)를 벗어나 세 클래스가 서로의 `self` 를 빌려 쓰는 비관용적 패턴으로 공유되고 있다. 나머지는 매직 넘버·중복 리터럴 수준의 경미한 개선 여지다.

## 위험도

CRITICAL
