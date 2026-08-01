# 테스트(Testing) 리뷰 — deps-guard-hardening

## 발견사항

- **[CRITICAL]** `scripts/check-override-floors.py` 신설에 맞춰 `harness-checks.yml` 의 `paths:` 등재를 빠뜨려, 그 사실을 정확히 잡아내려고 만든 **기존 회귀 테스트가 지금 RED** 다.
  - 위치: `.github/workflows/harness-checks.yml:46-49` (`scripts/` 등재 목록 — `check-override-floors.py` 미포함) / 원인 쪽은 `.claude/tests/test_override_floors.py:33` (`SCRIPT = REPO_ROOT / "scripts" / "check-override-floors.py"` — 이 module-level 상수가 스크립트를 "가드 대상"으로 만든다) / 검출하는 가드는 `.claude/tests/test_harness_checks_paths_coverage.py:453-463` (`PathsCoverageTest.test_every_guarded_file_is_covered`).
  - 상세: 직접 실행해 확인함 — `python3 -m unittest discover -s .claude/tests -p "test_harness_checks_paths_coverage.py"` 결과 `test_every_guarded_file_is_covered` 가 `AssertionError: Lists differ: ['scripts/check-override-floors.py'] != []` 로 FAIL 한다. `harness-checks.yml` 은 `.claude/tests/**` 변경으로는 트리거되지만(그래서 이 PR 자체는 그 잡을 태운다), `scripts/check-override-floors.py` 단독 수정 시에는 트리거되지 않는다 — 정확히 이 테스트의 docstring 이 "여섯 번째 반복" 이라 명명한 실패 클래스의 **일곱 번째 사례**다. `deps-security-checks.yml` 쪽 paths 에는 이미 등재돼 있으나(그건 `override-floors` 통합 잡을 태우는 것이고), harness 단위 회귀 테스트(`test_override_floors.py`)를 태우는 쪽은 `harness-checks.yml` 이며 여기 등재가 빠졌다. plan 체크리스트의 "TEST WORKFLOW — lint/unit/build/e2e PASS" 는 PROJECT.md 정의상 `.claude/tests` 스위트를 포함하지 않으므로 그 claim 자체는 정확하지만, 이 PR 은 `.claude/tests/**` 를 건드리므로 `harness-checks.yml` 이라는 **별도의 실제 CI 게이트**가 걸리고 지금 상태로는 거기서 fail 한다.
  - 제안: `harness-checks.yml` 의 `# scripts/ 중 harness unittest 가 커버하는 것은 명시 등재` 블록(46-49행)에 `- 'scripts/check-override-floors.py'` 를 `report_playwright_flaky.py`/`check-e2e-playwright-config.py` 와 같은 방식으로 추가.

- **[CRITICAL]** 신설 테스트 파일이 `.claude/tests/README.md` 의 "What's covered" 카탈로그 표에 등재되지 않아, 그 등재를 강제하는 **기존 회귀 테스트가 지금 RED** 다.
  - 위치: `.claude/tests/README.md:23-60` (카탈로그 표 — `test_override_floors.py` 행 없음) / 검출 가드는 `.claude/tests/test_tests_readme_catalog.py`(`CatalogCoverageTest.test_every_test_file_is_documented`).
  - 상세: 직접 실행 확인 — `test_every_test_file_is_documented` 가 `AssertionError: Lists differ: ['test_override_floors.py'] != []` 로 FAIL. 실패 목록에 다른 파일은 안 잡히고 정확히 이 신설 파일 하나만 잡히므로, 기존에 이미 있던 갭이 아니라 이 PR 이 유발한 회귀임이 확인된다.
  - 제안: README "What's covered" 표에 `test_override_floors.py` 행 추가 — 두 축(override 키 추출, 분류→exit code)과 회귀 배경(패키지명 추출 두 번 오조합)을 요약.

- **[CRITICAL]** 신규 `dependabot.yml` 루트 워크스페이스 등록(`directory: "/"`)이 "dependabot 의 npm 항목은 전부 pnpm 워크스페이스 **밖**의 독립 트리를 가리켜야 한다"를 전제로 하는 **기존 회귀 테스트를 깨뜨린다**.
  - 위치: 신규 등록 자체는 `.github/dependabot.yml:24-46`(신규 diff 블록, gate 42-46 이 실제 엔트리). 깨지는 가드는 `.claude/tests/test_dependabot_npm_coverage.py:280-291`(`test_no_stale_dependabot_npm_entry`) 이며, 그 판정이 참조하는 `_independent_trees()`(같은 파일 137-148행)는 워크스페이스 루트 `package.json`(`_ROOT_MANIFEST`, 34행)을 명시적으로 "독립 트리 아님"으로 제외한다.
  - 상세: 직접 실행 확인 — `test_no_stale_dependabot_npm_entry` 가 `AssertionError: '' not found in {'.claude/tools/mermaid-lint'}` 로 FAIL. 이 PR 의 루트 등록은 "audit 사각지대 해소"(그 가드의 원래 목적)가 아니라 "같은 group PR 의 순차 머지에서 rebase 적용"이라는 **다른 목적**이라, 기존 가드의 암묵 전제("등록된 디렉터리 = 독립 트리")와 정면으로 충돌한다. 어느 쪽 코드를 고치든(가드 쪽 예외 처리 추가, 혹은 새 목적을 위한 별도 표현), 현재 상태로는 기존 테스트가 깨진 채로 남는다.
  - 제안: `test_dependabot_npm_coverage.py` 에 워크스페이스-루트(`""`/`"/"`) 등록을 "독립 트리 커버"와 별개의 **의도적 예외**로 인지시키는 케이스를 추가(예: `_ROOT_MANIFEST` 와 나란히 "허용된 비-독립 등록" 집합을 두고 `test_no_stale_dependabot_npm_entry` 에서 skip). 가드 자체를 못 건드리는 상황이면 최소한 이 diff 를 원 리뷰 전에 로컬에서 `.claude/tests` 전체 스위트로 검증해 CI 이전에 잡아야 한다.

- **[WARNING]** `override_target()` 의 다단 부모 경로(`a>b>c`) 처리가 자신의 docstring 주장과 다르고, 그 입력 형태에 대한 테스트가 전무하다.
  - 위치: `scripts/check-override-floors.py:69-88`(`override_target`) — docstring 은 74-75행에서 "**마지막 `>` 뒤부터** 다시 레인지를 떼는" 이라고 적지만, 실제 구현은 85행 `key.split(">", 1)[1]` 로 **첫 번째** `>` 만 자른다.
  - 상세: 실제(뮤테이션 아닌 원본) 모듈을 직접 호출해 확인함 — `override_target("a>b>c")` → `'b>c'` (기대와 다르게 마지막 구간까지 못 벗겨낸다), `override_target("next>@types/react>foo")` → `'@types/react>foo'`. 이 값은 실제 advisory 의 `module_name` 과 결코 일치하지 않으므로, 만약 3단 이상 체인 override 키가 추가되면 이 가드는 **크래시 없이 조용히 통과**한다 — 바로 이 파일의 docstring 이 "가장 중요하다"고 명시한 그 실패 클래스(두 번의 실측 버그와 동일 부류)를 3단 체인에서 재현하는 것이다. 현재 `pnpm-workspace.yaml` 에는 3단 체인 키가 없어 오늘 당장 터지는 결함은 아니지만, 테스트 스위트(`test_override_floors.py`)는 단일 레벨 `next>postcss`/`next>@types/react` 만 커버하고 이 형태는 다루지 않는다.
  - 제안: (a) `test_version_range_suffix_is_not_a_parent_path` 류 옆에 다단 체인 케이스를 추가해 최소한 실패를 문서화하거나, (b) 실제로 다단 체인을 지원할 필요가 있다면 `>` 분리 로직을 "레인지 시작 이전 구간의 **마지막** `>`" 기준으로 고치고 그에 맞는 회귀 테스트를 추가. docstring 의 "마지막 `>` 뒤부터" 문구도 구현과 일치시킬 것.

- **[WARNING]** "여러 advisory 중 일부만 override 대상"이라는, 이 기능의 발단이 된 바로 그 시나리오(실측: 17건 중 4건)를 재현하는 테스트가 없다.
  - 위치: `.claude/tests/test_override_floors.py:90-181`(`ClassificationTest`) — 모든 케이스가 advisory 정확히 1건.
  - 상세: `main()` 의 `eroded` 리스트 누적·정렬·복수 항목 stderr 출력 로직(`scripts/check-override-floors.py:126-158`)은 advisory 2건 이상 동시 매칭 시나리오에서 한 번도 실행되지 않는다. plan 문서(`plan/in-progress/deps-guard-hardening.md`) 자신이 "관리 대상 4건이 17건 속에 묻혔다"를 이 기능의 존재 이유로 서술하는데, 정작 그 다건-매칭 형태가 테스트되지 않았다.
  - 제안: managed 2개(예: `liquidjs`, `next>postcss`) 모두에 advisory 가 걸리고 unmanaged 1개도 섞인 케이스를 추가해, `eroded` 가 둘 다 보고하고 어느 쪽도 묻히지 않음을 stderr 로 확인.

- **[WARNING]** `harness-checks.yml` 의 `unittest` 잡에는 PyYAML 설치 스텝이 없는데, `test_override_floors.py` 가 이 스위트에서 **처음으로** `import yaml` 를 필요로 하게 된다 (확인 필요, 미확정 리스크).
  - 위치: `.github/workflows/harness-checks.yml` `unittest` 잡(56-69행, `pip install` 없음) vs `.claude/tests/test_override_floors.py:36-40`(`_load_module()` 이 `setUp()` 에서 `scripts/check-override-floors.py` 를 직접 `exec_module` — 그 스크립트 46-50행이 모듈 최상단에서 `import yaml`).
  - 상세: `grep -rn "pyyaml" .github/workflows/*.yml .claude/tests/*.py` 결과 PyYAML 설치는 `deps-security-checks.yml` 의 두 잡(`config-guard`, `override-floors`)에만 있고 `harness-checks.yml` 에는 없다. `actions/setup-python@v7` 가 제공하는 인터프리터가 PyYAML 을 기본 포함하지 않는 경우(자체 호스팅 미니멀 빌드라 흔한 케이스), `OverrideTargetExtractionTest` 전체(`setUp` 에서 `sys.exit(2)` → unittest 가 SystemExit 을 per-test ERROR 로 잡는 것은 직접 실험으로 확인했으나 여전히 실패)와 `ClassificationTest`(서브프로세스 returncode 가 2 로 나와 assertEqual 실패)가 CI 에서만 깨질 수 있다. 로컬에서는 PyYAML 이 이미 설치돼 있어 이 갭이 드러나지 않는다.
  - 제안: `harness-checks.yml` 의 `unittest` 잡에도 `pip install "pyyaml>=6,<7"` 스텝을 추가하거나, 최소한 실제 GitHub Actions 실행 로그로 해당 인터프리터에 PyYAML 이 있는지 확인.

- **[INFO]** `scripts/check-override-floors.py` 의 방어적 분기 2곳이 테스트되지 않는다.
  - 위치: `run_audit()` 의 `json.JSONDecodeError` 분기(`scripts/check-override-floors.py:113-118` — `ImportError` 분기(46-50행)와 달리 `# pragma: no cover` 표시 없음) / `main()` 의 워크스페이스 파일 부재 분기(121-124행).
  - 상세: `pnpm audit --json` 이 JSON 앞에 경고 텍스트를 섞어 내보내는 경우(알려진 pnpm 특이 동작)나 CI 작업 디렉터리가 어긋나는 경우를 재현하는 테스트가 없다. 위험도는 낮음(실패해도 exit 2 로 fail-safe).
  - 제안: 우선순위 낮음 — 여유 있을 때 스텁 pnpm 이 깨진 JSON/공백을 출력하는 케이스, `pnpm-workspace.yaml` 없는 tmp 디렉터리에서 실행하는 케이스를 추가.

## 요약

`test_override_floors.py` 자체의 설계는 탄탄하다 — mock 을 남용하지 않고 fake `pnpm` 실행파일을 PATH 에 얹어 실제 서브프로세스로 스크립트를 돌리는 블랙박스 방식이라 회귀에 강하고, 각 테스트는 독립된 tempdir 를 써서 격리도 완전하며, 실측 회귀(패키지명 추출 두 번 오판)를 정확히 겨냥한 케이스와 서술이 읽기 좋다. plan 체크리스트가 주장하는 mutation 수치("추출 로직 되돌림 → 3 failures", "분류 fail 경로 제거 → 2 failures")도 실제로 두 mutation 을 직접 적용·복원해 정확히 일치함을 확인했다(이 저장소에서 과거 여러 차례 발견된 "수치 오기" 부류가 이번엔 아니다). 다만 이 PR 은 그 좋은 단위 테스트를 감싸는 **하네스 인프라 배선을 세 군데 빠뜨렸다** — `harness-checks.yml` paths 미등재, README 카탈로그 미등재, dependabot 루트 등록이 기존 `test_dependabot_npm_coverage.py` 가드의 전제와 충돌 — 셋 다 실제로 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 를 돌려 FAIL 로 확인했다(722건 중 3건 실패). 이 세 가지 모두 정확히 이 저장소가 "6번 반복된 실패 클래스"라고 스스로 문서화해 놓은 패턴의 연장이며, 지금 상태로 push 하면 `harness-checks.yml` CI 가 빨간불이 된다. 이를 고치고 나면, override 키 추출의 다단 부모 경로(`a>b>c`) 미검증·다건 동시 침식 미검증 정도가 남는 개선 항목이다.

## 위험도

CRITICAL
