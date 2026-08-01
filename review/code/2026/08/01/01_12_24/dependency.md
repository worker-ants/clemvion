# 의존성(Dependency) 리뷰 — deps-guard-hardening

## 발견사항

- **[CRITICAL]** 신규 `override-floors` 게이트가 `ignoreCves` 로 이미 수용된 CVE 와 **같은 CVE ID** 를
  공유하는 override 대상 패키지의 재침식을 탐지하지 못한다 (실제 `pnpm audit` 실행으로 검증 완료).
  - 위치: `scripts/check-override-floors.py:101`(`run_audit()`), `:127`
    (`advisories = (run_audit().get("advisories") or {}).values()`) — 근거 데이터는
    `pnpm-workspace.yaml:52-54`(brace-expansion override 3키) 및 `pnpm-workspace.yaml:94-113`
    (`ignoreCves` 의 `CVE-2026-14257` 블록).
  - 상세: 이 저장소에서 직접 `pnpm audit --audit-level=moderate --json` 을 실행해 확인했다 — 현재
    `ignoreCves` 에 있는 CVE-2026-14257(brace-expansion, high)은 `metadata.vulnerabilities.high: 1`
    로 여전히 카운트되고 exit code 도 1 이지만 `"advisories": {}` 로 **완전히 비어 있다**. 동일 레포를
    스크래치 복사해 `ignoreCves` 만 빈 배열로 바꾸고 재실행하니 같은 취약점이 `advisories` 에
    `module_name: "brace-expansion"`, `cves: ["CVE-2026-14257"]`, `vulnerable_versions: "<=5.0.7"` 로
    **완전히 채워져 나왔다** — 즉 ignoreCves 는 (exit code 뿐 아니라) `--json` 의 `advisories` 맵
    자체를 CVE-ID 단위로 전부 억제한다(경로·버전 무관, 전역 억제). `check-override-floors.py::main()`
    은 정확히 이 `advisories` 필드만 순회해 override 대상 여부를 판정하므로, ignoreCves 에 이미
    올라간 CVE ID 는 어떤 설치 경로/버전에서 재발하든 이 스크립트에 절대 보이지 않는다.
    `brace-expansion` 은 지금 이 저장소에서 **override 로 관리되는 패키지(3개 키)이면서 동시에
    정확히 같은 CVE(취약범위 `<=5.0.7` — major 를 가리지 않아 1.x~5.x 전체에 매칭)가 ignoreCves 에
    있는** 유일 사례다. 향후 `"brace-expansion@>=2.0.0 <3.0.0"`/`"...>=3.0.0 <5.0.8"` override 값이
    (이 PR 이 방지하려는 바로 그 caret 패턴으로) 5.0.7 이하로 재침식돼도, 본 게이트는
    "취약 재유입 0건" 을 그대로 출력한다 — 이 PR 이 막으려는 실패 모드를 게이트 자신이 재현하는
    셈이다. 신규 회귀 테스트(`test_override_floors.py`)는 스텁 `pnpm` 이 advisories 를 직접 주입하는
    구조라 이 ignoreCves 상호작용은 검증하지 않는다.
  - 제안: `advisories` 단독이 아니라 pnpm audit JSON 의 `actions[].module`(관측상 ignoreCves 로
    억제된 항목도 여기엔 남아 있었다)까지 함께 확인하거나, 최소한 이 한계를 스크립트 docstring 에
    명시하고 override+ignoreCves 를 동시에 갖는 패키지(현재 `brace-expansion`)를 수동 점검
    대상으로 문서화할 것.

- **[CRITICAL]** 신규 `.github/dependabot.yml` 루트 워크스페이스 등록이 기존 회귀 가드를 즉시
  깨뜨린다 (실행 확인 완료 — `harness-checks` CI 확정 실패).
  - 위치: `.github/dependabot.yml:42-46`(신규 항목, `directory: "/"`) vs
    `.claude/tests/test_dependabot_npm_coverage.py:280-291`(`test_no_stale_dependabot_npm_entry`).
  - 상세: 이 worktree 에서 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'`
    (=`harness-checks.yml:69` 이 CI 에서 도는 것과 동일 커맨드)를 실행하면
    `test_no_stale_dependabot_npm_entry` 가
    `AssertionError: '' not found in {'.claude/tools/mermaid-lint'}` 로 FAIL 한다. 그 가드는
    "dependabot.yml 에 등록된 모든 npm `directory:` 는 pnpm workspace **밖의 독립 트리**여야 한다"는
    불변식을 검증하며, `_independent_trees()` 는 루트 `package.json` 을 명시적으로 제외한다(주석:
    "워크스페이스 ROOT package.json 은 pnpm 프로젝트 자신이라 독립 트리가 아니다"). 이번에 추가한
    항목은 정확히 그 루트(`directory: "/"` → 파싱 시 빈 문자열)를 등록한 것이라 그 불변식과
    충돌한다. `.github/dependabot.yml` 은 `harness-checks.yml:39` 의 `paths:` 에 이미 등재돼 있어
    이 PR 은 그대로 push 되면 `harness-checks` CI 를 확정적으로 fail 시킨다. (plan 체크리스트의
    "TEST WORKFLOW — lint/unit/build/e2e PASS" 는 이 `.claude/tests` 전체 discovery 를 포함하지
    않은 것으로 보인다.)
  - 제안: `test_dependabot_npm_coverage.py` 를 함께 갱신 — 루트(`/`) 항목은 "독립 트리 커버리지"가
    아니라 "이미 audit 이 보는 워크스페이스에 스케줄/rebase 설정을 추가하는" 별개 목적이므로, stale
    판정에서 루트를 명시적으로 예외 처리하거나 검증 로직을 분리할 것.

- **[CRITICAL]** 신규 스크립트가 `harness-checks.yml` 의 명시적 `scripts/` 등재 목록에서 빠져, 그
  파일 자신에 적힌 컨벤션과 그걸 지키는 가드를 동시에 위반한다 (실행 확인 완료 — CI 확정 실패).
  - 위치: `.github/workflows/harness-checks.yml:46-49`(신규 스크립트 미등재) vs
    `scripts/check-override-floors.py`(신규 파일 전체) vs
    `.claude/tests/test_harness_checks_paths_coverage.py:458`
    (`test_every_guarded_file_is_covered`).
  - 상세: 같은 discovery 실행에서 `test_every_guarded_file_is_covered` 도
    `Lists differ: ['scripts/check-override-floors.py'] != []` 로 FAIL 한다.
    `harness-checks.yml:46-47` 의 주석이 정확히 이 상황을 막으려고 적힌 규약이다: "scripts/ 중
    harness unittest 가 커버하는 것은 명시 등재 — 테스트 없이 단독 수정돼도 회귀 테스트가
    트리거되도록." 지금은 `scripts/report_playwright_flaky.py`,
    `scripts/check-e2e-playwright-config.py` 둘만 등재돼 있고, 자신의 회귀 테스트
    (`test_override_floors.py`)를 가진 신규 `check-override-floors.py` 는 빠졌다. 이 가드 자신의
    docstring 은 "이 클래스가 새는 게 여섯 번째" 라고 적을 만큼 이 저장소에서 반복 재발한 실패
    패턴이다. 이 PR 자체는 `.claude/tests/**` 도 함께 건드리므로 지금 당장은 harness-checks 가
    돌아 이 실패를 드러내지만, 향후 `check-override-floors.py` **단독** 수정 PR 은 harness-checks
    트리거 자체가 안 돼 `override_target()` 회귀(이번에 실측으로 두 번 틀렸던 바로 그 로직)를 다시
    조용히 통과시킬 수 있다.
  - 제안: `harness-checks.yml` 46-49행의 목록에 `- 'scripts/check-override-floors.py'` 추가.

- **[WARNING]** 신규 테스트 파일이 `.claude/tests/README.md` 카탈로그 표에 미등재 (같은 discovery
  실행에서 확인, CI 실패 원인 중 하나).
  - 위치: `.claude/tests/README.md:19`("## What's covered" 표, 인접 행 예시는 `:28`) vs
    `.claude/tests/test_override_floors.py`(신규 파일) vs
    `.claude/tests/test_tests_readme_catalog.py:73`(`test_every_test_file_is_documented`).
  - 상세: 같은 실행에서 `test_every_test_file_is_documented` 도
    `Lists differ: ['test_override_floors.py'] != []` 로 FAIL. 의존성 자체보다는 문서 동기화
    항목이지만, 위 두 CRITICAL 항목과 동일하게 "전체 discovery 를 돌리지 않아 놓친 것" 원인
    계열이라 함께 기록한다. (참고: `python3 -m unittest discover -s .claude/tests -p 'test_*.py'`
    전체 722건 중 정확히 이 셋만 FAIL — 그 외 회귀는 없음을 확인했다.)
  - 제안: README.md 표에 `test_override_floors.py` 행 추가.

- **[INFO]** (긍정 관측) 신규 CI 잡·스크립트의 의존성 고정·버전 정합은 기존 컨벤션과 일관됨 —
  추가 조치 불요.
  - 위치: `.github/workflows/deps-security-checks.yml:87-88`(신규 `override-floors` 잡의
    `pip install "pyyaml>=6,<7"`) vs 기존 `config-guard` 잡(`:53-54`).
  - 상세: 신규 잡의 PyYAML pin 이 기존 `config-guard` 잡과 동일 range 라 신규 외부 의존성이 사실상
    추가되지 않았다(이미 쓰이던 PyYAML 재사용, MIT 라이선스로 호환성 문제 없음).
    `scripts/check-override-floors.py:93`(`load_override_targets`)도 `yaml.safe_load` 만 사용해
    임의 코드 실행 위험이 있는 `yaml.load` 를 피했다. `actions/checkout@v7`·`pnpm/action-setup@v6`·
    `actions/setup-node@v7`·`actions/setup-python@v7` 버전도 같은 워크플로 파일의 기존 잡들과
    정확히 일치해 액션 버전 drift 가 없다. `pnpm-workspace.yaml` 자체 diff 는 주석(수용 근거
    규약) 추가뿐이며 실제 override 버전 변경은 이번 PR 범위에 없다.

## 요약

이번 변경은 "의존성 보안 바닥이 조용히 낮아지는 것을 막는다"는 목적의 신규 CI 게이트·스크립트·
회귀 테스트 세트다. 그러나 실제로 `pnpm audit`·`.claude/tests` discovery 를 이 worktree 에서
직접 실행해 검증한 결과, 정반대의 두 종류 문제가 확인됐다. 첫째, `check-override-floors.py` 는
pnpm 의 `ignoreCves` 가 `--json` 출력의 `advisories` 맵 자체를 CVE-ID 단위로 전역 억제한다는 사실을
반영하지 않아, override 관리 대상이면서 동시에 ignoreCves 로 수용된 CVE 를 가진 패키지(현재
`brace-expansion` 이 정확히 그 사례)의 재침식을 절대 탐지하지 못한다 — PR 이 방지하려는 실패
모드를 신규 게이트 자신이 그대로 재현한다. 둘째, 신규 파일들이 이 저장소의 기존 CI-완전성 가드
2건(`test_dependabot_npm_coverage.py`, `test_harness_checks_paths_coverage.py`)과
문서 가드 1건(`test_tests_readme_catalog.py`)을 깨뜨린다 — `.claude/tests` 전체 discovery(722건 중
3건 FAIL)를 돌리지 않고 신규 테스트 11건만 별도 확인한 결과로 보인다. 새 외부 의존성 추가·라이선스·
버전 고정 자체는 문제없고 기존 컨벤션과 일관되지만(PyYAML 재사용, 액션 버전 정합), 위 세 가지
CI-완전성 결함과 하나의 보안 게이트 실효성 결함은 병합 전 반드시 해소해야 한다.

## 위험도

CRITICAL
