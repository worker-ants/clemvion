# 의존성(Dependency) 리뷰 — deps-guard-hardening (2차 라운드)

## 발견사항

- **[CRITICAL]** `harness-checks.yml`의 `unittest` 잡에 PyYAML 설치 스텝을 추가하려던 편집이 삽입
  위치를 잘못 잡아 **YAML 매핑 중복 키**를 만들었다 — 그 결과 (a) `pip install "pyyaml>=6,<7"`
  명령이 통째로 사라지고 (b) 기존 "Run harness unit tests" 스텝이 `run`/`uses` 가 없는 빈 스텝이
  된다. 실제 GitHub Actions 워크플로 스키마상 스텝은 `run` 또는 `uses` 중 하나를 반드시 가져야
  하므로, 이 파일은 **push 시 파싱/스키마 검증 단계에서 거부되어 `harness-checks` 워크플로(유일한
  잡인 `unittest`) 전체가 아예 실행되지 않을** 가능성이 매우 높다.
  - 위치: `.github/workflows/harness-checks.yml:69-76`
  - 상세: 저장소를 직접 읽어 확인함(`Read` 로 재확인, diff 아님 — 실제 on-disk 파일).

    ```yaml
     69:       - name: Run harness unit tests
     70:      # 2026-08-01 — 이 스위트는 원래 stdlib 전용이었다. ...
     74:      - name: Install PyYAML
     75:        run: pip install "pyyaml>=6,<7"
     76:         run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    ```

    69행 `- name: Run harness unit tests` 다음에 곧바로 `run:` 이 와야 하는데, 신규 4줄 주석 +
    `- name: Install PyYAML` + `run: pip install ...` 가 그 사이에 끼어들면서 원래 69행 스텝의
    `run:` 이었던 76행이 그대로 **74행 "Install PyYAML" 스텝의 두 번째 `run:` 키**가 됐다(75/76행이
    같은 들여쓰기·같은 매핑의 형제 키). 직접 YAML 로 파싱해 실측:

    ```
    $ python3 -c "import yaml,json; d=yaml.safe_load(open('.github/workflows/harness-checks.yml'));
                   print([s.get('name') or s.get('uses') for s in d['jobs']['unittest']['steps']])"
    ['actions/checkout@v7', 'actions/setup-python@v7', 'Run harness unit tests',
     'Install PyYAML', 'actions/setup-node@v7', 'Run workflow contract unit tests']

    $ python3 -c "... steps[2], steps[3] ..."
    2 {"name": "Run harness unit tests"}   # run/uses 없음
    3 {"name": "Install PyYAML",
       "run": "python3 -m unittest discover -s .claude/tests -p 'test_*.py'"}
       # pip install "pyyaml>=6,<7" 은 사라짐 — 뒤에 온 run: 이 덮어씀
    ```

    중복 키 자체를 엄격 모드(키별 유일성 강제)로 다시 파싱하면 `line 76` 에서 명시적으로
    `DUPLICATE KEY` 에러가 난다 — 즉 PyYAML(파이썬 구현)조차 관용적으로만 "나중 값 채택"을 하는
    비표준 상태이고, 표준 스키마 검사기(GitHub Actions 자체 포함)는 이 경우 파일 전체를 invalid 로
    거부할 개연성이 크다. 어느 쪽이든 결과는 같다: **PyYAML 설치는 실행되지 않고**, 이 스텝 순서
    문제로 `harness-checks` 워크플로 자체가 CI 에서 돌지 않을 위험이 있다. 이 워크플로 파일은
    `jobs:` 아래 `unittest` 하나뿐이라 blast radius 는 이 PR 이 새로 만든 3개 회귀 테스트만이
    아니라 `.claude/tests/**` 전체(~700여 건, `test_agent_return.mjs` 포함)다 — 이 PR 이 막으려는
    "가드가 조용히 안 도는" 바로 그 실패 클래스를 CI 배선 단계에서 재현한다.
  - 제안: 신규 스텝을 기존 스텝의 `name:`/`run:` 사이에 끼워 넣지 말고, 완전한 스텝으로 분리해
    앞뒤로 배치할 것.
    ```yaml
          - name: Install PyYAML
            run: pip install "pyyaml>=6,<7"

          - name: Run harness unit tests
            run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    ```
    수정 후 반드시 `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/harness-checks.yml'))"`
    가 아니라(이건 관용적으로 통과해 이번 결함을 놓쳤을 도구다) 스텝 리스트를 순회해 각 스텝이
    `run`/`uses` 중 하나만 정확히 가지는지, 그리고 dict 키 중복이 없는지 확인할 것 — 가능하면
    `actionlint` 또는 동등 스키마 검사를 harness-checks 자체에 추가하는 편이 이 클래스의 재발을
    막는다(현재 이 저장소엔 `.github/workflows/*.yml` 문법을 검증하는 하네스 테스트가 없음을
    확인했다 — `grep` 로 대조, `test_harness_checks_paths_coverage.py` 는 `paths:` 등재만 검증하고
    `steps:` 구조는 보지 않는다).

- **[INFO]** (긍정 관측) 1차 리뷰(`review/code/2026/08/01/01_12_24/`)의 의존성/보안 게이트 실효성
  Critical 3건이 실제 코드 변경으로 정확히 해소됐음을 라이브 실행으로 재확인했다.
  - 위치: `scripts/check-override-floors.py:55-67`(`EXPECTED_SUPPRESSED_PATHS`),
    `:157-193`(`classify_vulnerable`, `suppressed`/`widened` 로직) /
    `.claude/tests/test_dependabot_npm_coverage.py:36-49,309-337`(`_legitimate_dependabot_directories`
    + 신규 테스트 2건) / `.github/workflows/harness-checks.yml:50`(`scripts/check-override-floors.py`
    paths 등재).
  - 상세: (1) `ignoreCves` 전역 억제로 `brace-expansion` 재침식을 탐지 못하던 문제 — `actions[]`
    의 경로를 `EXPECTED_SUPPRESSED_PATHS` baseline 과 대조해 **경로가 늘면** fail 하는 방식으로
    막혔다. 실제로 `python3 scripts/check-override-floors.py` 를 이 저장소에서 직접 실행해
    `OK: override 대상 26개 패키지 중 취약 재유입 0건`(exit 0)을 확인했고, 별도 회귀 테스트
    (`SuppressedPathBaselineTest`)로 "baseline 경로만 있으면 통과 / 경로가 늘면 fail" 양쪽을
    커버한다. (2) `dependabot.yml` 루트 등록이 `test_no_stale_dependabot_npm_entry` 를 깨뜨리던
    문제 — `_legitimate_dependabot_directories()` 가 워크스페이스 루트를 "독립 트리 커버"와 별개의
    의도적 예외로 인지하도록 수정됐고, `test_root_exception_does_not_admit_workspace_members` 로
    그 예외가 워크스페이스 멤버 전체로 잘못 넓어지지 않음까지 못박았다. (3) `scripts/` 명시 등재
    누락 — `harness-checks.yml` 46-50행에 `check-override-floors.py` 가 추가됐다. 세 가드
    (`test_dependabot_npm_coverage.py`, `test_harness_checks_paths_coverage.py`,
    `test_tests_readme_catalog.py`) 를 개별 discover 로 직접 실행해 각각 14/26/5 건 전부 PASS 를
    확인했다. `override_target()` 다단 부모 경로(`a>b>c`) docstring-구현 불일치(1차 WARNING)도
    `head.rfind(">")` 로 "레인지 시작 이전 구간의 마지막 `>`" 기준으로 고쳐졌고
    (`override_target("a>b>c")` → `"c"` 직접 호출로 재확인), `run_audit()` fail-open(1차 WARNING,
    security)도 빈 stdout·`actions` 키 부재 두 경로 모두 `sys.exit(2)` 로 닫혔다(`FailClosedTest`
    3건 통과 확인). 즉 위 CRITICAL 1건을 제외하면 1차 라운드가 지적한 항목은 코드/테스트 양쪽에서
    실제로 해소됐다.

- **[INFO]** 신규/재사용 의존성의 버전 고정과 라이선스는 문제없다 — 추가 조치 불요.
  - 위치: `scripts/check-override-floors.py:46-50`(`import yaml`) /
    `.github/workflows/deps-security-checks.yml:87-88`, `:52-54` / `.github/workflows/harness-checks.yml:75`.
  - 상세: `pip install "pyyaml>=6,<7"` pin 이 저장소 내 3곳(기존 `config-guard`, 기존
    `override-floors`, 이번에 시도된 `harness-checks` unittest) 모두 정확히 동일 range 로
    일관됨을 `grep` 로 확인했다 — 새 외부 의존성이 아니라 기존 PyYAML 재사용이며 버전 충돌 없음.
    PyYAML 은 MIT 라이선스로 프로젝트와 호환된다. `pnpm-workspace.yaml` 의 실제 `overrides`
    버전 값은 이번 diff 에서 변경되지 않았다(주석만 추가) — 신규 npm 패키지 추가도 없다. YAML
    파싱은 `yaml.safe_load` 만 사용해 임의 코드 실행 위험이 있는 `yaml.load` 를 피했다(1차
    라운드에서도 확인된 사항, 이번 라운드에도 유지). GitHub Actions 서드파티 액션 버전
    (`actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`,
    `actions/setup-python@v7`)도 파일 내 기존 잡들과 정확히 일치해 drift 없음(1차 INFO 와 동일,
    회귀 아님). PyYAML 을 커스텀 YAML 파서로 대체하는 것은 불필요/위험 — README diff 자체가
    "ad-hoc YAML 파서 두 개가 지적당한 적 있다" 는 이 저장소의 과거 사례를 언급하고 있어,
    표준 라이브러리 대체는 오히려 퇴보다.

## 요약

1차 라운드가 지적한 4건(ignoreCves 전역 억제로 인한 게이트 실효성 CRITICAL, `harness-checks.yml`
scripts 미등재 CRITICAL, `dependabot.yml` 루트 등록 충돌 CRITICAL, README 카탈로그 미등재
WARNING/CRITICAL)은 이번 라운드에서 전부 코드·테스트로 실제 해소됐음을 각 가드를 직접 재실행해
확인했다(`check-override-floors.py` 실제 실행 exit 0, `test_dependabot_npm_coverage.py` 14/14,
`test_harness_checks_paths_coverage.py` 26/26, `test_tests_readme_catalog.py` 5/5 전부 PASS).
다만 그중 하나(1차 WARNING: `harness-checks.yml` unittest 잡에 PyYAML 미설치)를 고치는 과정에서
새 CRITICAL 이 생겼다 — 신규 "Install PyYAML" 스텝이 기존 "Run harness unit tests" 스텝의
`name:`/`run:` 사이에 잘못 삽입되어 YAML 매핑에 `run:` 키가 중복되고, 원래 스텝은 `run`/`uses` 가
없는 빈 스텝이 됐다. 실측(직접 YAML 파싱)으로 `pip install "pyyaml>=6,<7"` 명령이 사라짐을
확인했고, GitHub Actions 스키마상 `run`/`uses` 가 없는 스텝은 워크플로 파일 전체를 invalid 로
만들 가능성이 커 `harness-checks`(잡이 `unittest` 하나뿐)가 CI 에서 아예 실행되지 않을 위험이
있다. 결과적으로 이 PR 은 "의존성 보안 가드가 조용히 안 도는" 실패 클래스 3건을 고치면서 정확히
같은 클래스의 결함을 CI 배선(신규 의존성 설치 스텝)에서 새로 만들었다. 그 외 버전 고정·라이선스·
불필요한 의존성·번들 크기·호환성 관점에서는 새로 추가된 외부 의존성이 사실상 없고(PyYAML 재사용),
기존 컨벤션과 완전히 일관된다.

## 위험도

CRITICAL
