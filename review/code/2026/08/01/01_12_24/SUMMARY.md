# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — 신규 `override-floors` 게이트가 `ignoreCves` 전역 억제 특성 때문에 정확히 자신이 막으려던 실패 모드("취약 재유입이 조용히 통과")를 그대로 재현함(실제 `pnpm audit` 실행으로 검증). 동시에 이 PR 은 저장소의 기존 CI 완전성 회귀 테스트 3건(`harness-checks.yml` paths 등재, `.claude/tests/README.md` 카탈로그, `dependabot` npm coverage)을 깨뜨려 **push 시 `harness-checks` CI 가 확정적으로 실패**한다(모두 실제 `python3 -m unittest discover` 실행으로 FAIL 확인됨). forced(router_safety) reviewer(security, testing)는 전원 결과 확보되어 이행 누락은 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 의존성/보안 게이트 실효성 | `pnpm` 의 `ignoreCves` 가 CVE-ID 단위로 `pnpm audit --json` 의 `advisories` 맵 자체를 전역 억제한다(경로·버전 무관). 이 때문에 override 대상이면서 동시에 `ignoreCves` 로 이미 수용된 CVE 를 가진 패키지(현재 `brace-expansion` 이 정확히 이 사례 — override 3키 + `CVE-2026-14257` ignoreCves)의 재침식을 신규 게이트가 절대 탐지 못함. 실제 `pnpm audit` 실행 및 ignoreCves 제거 재실행으로 대조 검증 완료(dependency reviewer) | `scripts/check-override-floors.py:101,127`; `pnpm-workspace.yaml:52-54,94-113` | `advisories` 단독이 아니라 `actions[].module` 등 보조 신호까지 확인하거나, 최소한 override+ignoreCves 동시 보유 패키지(`brace-expansion`)를 스크립트 docstring 에 한계로 명시하고 수동 점검 대상으로 문서화 |
| 2 | CI 완전성 (하네스 배선 누락, 반복 실패 클래스) | 신규 `scripts/check-override-floors.py` 가 `harness-checks.yml` 의 "harness unittest 가 커버하는 scripts/ 명시 등재" 목록에서 빠져, 기존 회귀 테스트 `test_every_guarded_file_is_covered` 가 RED (`python3 -m unittest discover` 실행으로 FAIL 확인, dependency·testing 양쪽 독립 검증 일치). 이 파일 자신의 docstring 이 "여섯 번째 반복"이라 명명한 실패 클래스의 일곱 번째 사례. 지금 당장은 이 PR 이 `.claude/tests/**` 도 건드려 CI 가 이 실패를 드러내지만, 향후 스크립트 **단독** 수정 PR 은 harness-checks 트리거 자체가 안 되어 `override_target()` 회귀를 다시 조용히 통과시킬 위험 | `.github/workflows/harness-checks.yml:46-49`; `.claude/tests/test_harness_checks_paths_coverage.py:458` | 46-49행 목록에 `- 'scripts/check-override-floors.py'` 추가 |
| 3 | CI 완전성 (기존 가드 전제 충돌) | 신규 `.github/dependabot.yml` 루트 워크스페이스 등록(`directory: "/"`)이 "dependabot 에 등록된 npm 디렉터리는 전부 pnpm 워크스페이스 **밖**의 독립 트리여야 한다"를 전제로 하는 기존 가드 `test_no_stale_dependabot_npm_entry` 를 깨뜨림(`AssertionError: '' not found in {...}` 로 FAIL, dependency·testing 양쪽 독립 검증 일치). 이번 루트 등록의 실제 목적("같은 group PR 순차 머지 시 rebase 적용")이 그 가드의 원래 전제("audit 사각지대 해소용 독립 트리 커버")와 다른 종류라 정면 충돌 | `.github/dependabot.yml:42-46`; `.claude/tests/test_dependabot_npm_coverage.py:280-291`(`_independent_trees()` 137-148행이 루트 `package.json` 을 명시적으로 제외) | `test_dependabot_npm_coverage.py` 에 워크스페이스-루트(`""`/`"/"`) 등록을 "독립 트리 커버"와 별개의 의도적 예외로 인지시키는 케이스 추가(혹은 등록 방식 자체를 재검토) |
| 4 | CI 완전성 / 문서 동기화 | 신규 `test_override_floors.py` 가 `.claude/tests/README.md` "What's covered" 카탈로그 표에 미등재되어 기존 가드 `test_every_test_file_is_documented` 가 RED (양쪽 독립 검증 일치, 실패 목록엔 이 파일 하나만 잡혀 기존 갭이 아니라 이 PR 이 유발한 회귀임을 확인). dependency reviewer 는 WARNING, testing reviewer 는 CRITICAL 로 판정했으나, 다른 두 CI 완전성 항목과 동일하게 "이 PR 로 인해 기존 자동 회귀 테스트가 PASS→FAIL 전환"된 것이라 병합 차단 성격이 동일해 **CRITICAL 로 통일** | `.claude/tests/README.md:19-60`; `.claude/tests/test_tests_readme_catalog.py:73` | README "What's covered" 표에 `test_override_floors.py` 행 추가(두 축 요약 + 회귀 배경) |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/가드 실효성 | `run_audit()` 이 `pnpm audit` 의 returncode 를 검사하지 않고, stdout 이 비어 있거나(레지스트리 타임아웃 등) `advisories` 키가 없는 JSON(예: `{"error": {...}}`, 인증 오류 등)도 무조건 "취약점 0건"으로 간주해 `main()` 이 그대로 통과시킴 — 이 PR 이 막으려는 "조용한 보안 회귀"를 게이트 자신이 audit 미실행 상황에서 재현할 수 있음(fail-open) | `scripts/check-override-floors.py:101-118,127` | returncode 가 pnpm audit 이 정의하는 정상/취약점-발견 코드 집합에 속하는지 확인하고, `advisories` 키 부재나 최상위 `error` 키 존재 시 "0건"이 아니라 "판단 불가 → fail-closed(exit 2)"로 처리 |
| 2 | 로직 결함 (docstring-구현 불일치) | `override_target()` 의 다단 부모 경로(`a>b>c`) 처리가 docstring 주장("마지막 `>` 뒤부터 다시 레인지를 뗌")과 다르게 실제로는 **첫 번째** `>` 만 잘라 실제 advisory 의 `module_name` 과 결코 일치하지 않는 값을 반환(직접 호출로 검증: `override_target("a>b>c")` → `'b>c'`). 3단 이상 체인 override 키가 추가되면 크래시 없이 조용히 통과 — 이 파일이 스스로 "가장 중요"하다고 명시한 실패 클래스(과거 실측 버그 2건과 동일 부류)를 다단 체인에서 재현. 현재 `pnpm-workspace.yaml` 에는 해당 형태가 없어 오늘 당장 발현하는 결함은 아니며, 테스트 스위트도 단일 레벨만 커버 | `scripts/check-override-floors.py:69-88`(docstring 74-75행 vs 구현 85행 `key.split(">", 1)[1]`) | 다단 체인 회귀 테스트 추가, 또는 "레인지 시작 이전 구간의 마지막 `>`" 기준으로 분리 로직을 수정하고 docstring 을 구현과 일치시킬 것 |
| 3 | 테스트 커버리지 갭 | 이 기능의 발단이 된 시나리오("여러 advisory 중 일부만 override 대상", 실측: 17건 중 4건 — plan 문서가 이를 존재 이유로 서술)를 재현하는 테스트가 전무. `main()` 의 `eroded` 리스트 누적·정렬·복수 항목 stderr 출력 로직이 advisory 2건 이상 동시 매칭 시나리오에서 한 번도 실행되지 않음 | `.claude/tests/test_override_floors.py:90-181`(모든 케이스가 advisory 정확히 1건) | managed 2개(예: `liquidjs`, `next>postcss`) 모두에 advisory 가 걸리고 unmanaged 1개도 섞인 케이스 추가 |
| 4 | CI 환경 리스크 (미확정) | `harness-checks.yml` 의 `unittest` 잡에는 PyYAML 설치 스텝이 없는데, `test_override_floors.py` 가 이 스위트에서 **처음으로** `import yaml` 을 필요로 하게 됨(`_load_module()` 이 `check-override-floors.py` 를 직접 exec, 그 스크립트가 모듈 최상단에서 `import yaml`). 인터프리터가 PyYAML 을 기본 포함하지 않으면 CI 에서만 실패 가능 — 로컬은 이미 설치돼 있어 은폐됨 | `.github/workflows/harness-checks.yml` unittest 잡(56-69행, `pip install` 없음) vs `.claude/tests/test_override_floors.py:36-40` | `pip install "pyyaml>=6,<7"` 스텝 추가하거나, 실제 GitHub Actions 실행 로그로 해당 인터프리터에 PyYAML 이 있는지 확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 공급망 하드닝 (기존 관례, 신규 회귀 아님) | 신규 `override-floors` 잡이 참조하는 서드파티 GitHub Actions 가 가변 메이저 태그(`@v7`, `@v6` 등)로 고정 — 이론상 태그 재지정 공급망 공격 노출 가능하나, 같은 파일의 기존 두 잡도 동일 컨벤션이라 이번 PR 이 새로 만든 회귀는 아님 | `.github/workflows/deps-security-checks.yml:79-85` | 이번 PR 스코프 밖. 향후 별도 트랙에서 워크플로 전체 액션의 SHA 고정 하드닝 검토 |
| 2 | 테스트 코드 패턴 (공격 경로 없음) | 테스트 하네스가 `advisories` dict 를 `json.dumps()` 로 감싸 f-string 에 삽입해 가짜 `pnpm` 스크립트 소스를 생성 — 값에 `"""` 시퀀스가 있으면 이론상 트리플쿼트를 깨는 injection 패턴이나, 값이 전부 같은 테스트 파일 내 하드코딩 리터럴이라 신뢰 경계 밖 입력 경로가 없음 | `.claude/tests/test_override_floors.py:112-121` | 조치 불요(완결성 기록용) |
| 3 | 미검증 방어 분기 | `run_audit()` 의 `json.JSONDecodeError` 분기(`# pragma: no cover` 미표시)와 `main()` 의 워크스페이스 파일 부재 분기가 테스트되지 않음. 실패해도 exit 2 fail-safe 라 위험 낮음 | `scripts/check-override-floors.py:113-118,121-124` | 우선순위 낮음 — 여유 있을 때 스텁 pnpm 이 깨진 JSON/공백 출력하는 케이스, 워크스페이스 파일 없는 tmp 디렉터리 실행 케이스 추가 |
| 4 | 의존성 위생 (긍정 관측) | 신규 CI 잡·스크립트의 의존성 고정·버전 정합이 기존 컨벤션과 일관 — PyYAML pin 이 기존 `config-guard` 잡과 동일 range 로 재사용(신규 외부 의존성 사실상 없음), `load_override_targets` 는 `yaml.safe_load` 만 사용(임의 코드 실행 위험 있는 `yaml.load` 회피), 액션 버전도 같은 파일 기존 잡들과 정확히 일치해 drift 없음 | `.github/workflows/deps-security-checks.yml:87-88` vs 기존 `config-guard` 잡(:53-54); `scripts/check-override-floors.py:93` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `run_audit()` 이 실행 실패와 "취약점 0건"을 구분 못해 fail-open 가능(WARNING). 그 외 고전적 injection/시크릿/인가 우회 등 취약점 없음, INFO 2건(가변 태그·테스트 전용 injection 패턴, 둘 다 실질 위험 아님) |
| dependency | CRITICAL | `ignoreCves` 전역 억제로 override-floors 탐지가 무력화되는 실제 사례(`brace-expansion`)를 pnpm audit 실행으로 실증(CRITICAL). 신규 파일들이 기존 CI 완전성 가드 3건(harness-checks.yml paths, README 카탈로그, dependabot coverage)을 깨뜨림(CRITICAL 2건 + WARNING 1건). 의존성 고정 자체는 문제 없음(INFO) |
| testing | CRITICAL | 동일한 CI 완전성 결함 3건을 독립적으로 재확인(722건 discovery 중 정확히 이 3건만 FAIL). 추가로 `override_target()` 다단 부모 경로 버그(docstring-구현 불일치), 발단 시나리오(다건 동시 매칭) 미검증, harness-checks.yml unittest 잡의 PyYAML 설치 누락 리스크(WARNING 3건) 및 미검증 방어 분기(INFO) 발견. 핵심 회귀 테스트(`test_override_floors.py`) 자체 설계와 mutation 검증은 견고하다고 평가 |

## 발견 없는 에이전트

없음 — 3개 reviewer(security, dependency, testing) 전원 하나 이상의 발견사항을 보고함.

## 권장 조치사항

1. `.github/workflows/harness-checks.yml` 46-49행 목록에 `- 'scripts/check-override-floors.py'` 추가 — CI 즉시 실패(`test_every_guarded_file_is_covered`) 해소 + 향후 스크립트 단독 수정 시 회귀 테스트 트리거 보장.
2. `.claude/tests/README.md` "What's covered" 표에 `test_override_floors.py` 행 추가 — CI 즉시 실패(`test_every_test_file_is_documented`) 해소.
3. `.claude/tests/test_dependabot_npm_coverage.py` 에 워크스페이스-루트 등록을 "독립 트리 커버"와 별개의 의도적 예외로 인지시키는 케이스 추가(또는 `dependabot.yml` 루트 등록 방식 자체 재검토) — CI 즉시 실패(`test_no_stale_dependabot_npm_entry`) 해소.
4. `check-override-floors.py` 의 탐지 로직을 `ignoreCves` 전역 억제와 상호작용하도록 보강(`advisories` 외 `actions[].module` 등 보조 신호 확인)하거나, 최소한 override+ignoreCves 동시 보유 패키지(현재 `brace-expansion`)를 docstring 에 한계로 명시하고 수동 점검 대상으로 문서화.
5. `run_audit()` 에 returncode 유효성 확인 + `advisories` 키 부재/최상위 `error` 키 존재 시 fail-closed(exit 2) 처리 추가.
6. `override_target()` 의 다단 부모 경로(`a>b>c`) 분리 로직을 docstring("마지막 `>` 뒤부터")과 일치시키고 회귀 테스트 추가.
7. managed 2개+unmanaged 1개가 동시에 매칭되는 다건 advisory 테스트 케이스 추가(이 기능의 발단 시나리오 실증).
8. `harness-checks.yml` 의 `unittest` 잡에 `pip install "pyyaml>=6,<7"` 추가하거나 실제 CI 로그로 PyYAML 존재 여부 확인.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(security, dependency, testing) 실행.
  - **실행**: security, dependency, testing (3명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: security, testing — 라우터가 사용되지 않아 전원 실행되었으므로 강제 목록도 자연히 충족됨. 전원 결과 확보 확인됨(forced 인데 결과 없는 항목 없음).