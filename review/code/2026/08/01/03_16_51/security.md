# 보안(Security) 리뷰 — deps-guard-hardening (4차 라운드 · 재검증)

이 diff 는 `origin/main` 대비 브랜치 누적 diff(5 커밋)이며, 그중 1~3차 리뷰 산출물
(`review/code/2026/08/01/{01_12_24,01_56_46,02_38_45}/**`)도 이미 커밋된 파일로 포함돼
있다. 이번 라운드는 그 세 라운드가 발견·조치한 Critical/Warning 이 실제로 해소됐는지를
diff 판독이 아니라 **직접 코드를 읽고 명령을 실행해** 독립적으로 재검증했다.

## 발견사항

- **[INFO]** (재검증 완료, 긍정) 1차 라운드 보안 WARNING("`run_audit()` 이 audit 실행 실패와
  취약점 0건을 구분하지 못해 fail-open 할 수 있음")과 3차 라운드가 추가한 스키마 드리프트
  방어가 실제 코드에 정확히 반영돼 있다.
  - 위치: `scripts/check-override-floors.py:125-135`(`_undecidable()` — `NoReturn` 헬퍼로
    "판단 불가" 분기를 한 곳에 고정), `:153-169`(`run_audit()` — 빈 stdout·JSON 파싱 실패·
    `actions` 키 부재 세 경로 전부 `_undecidable()` 호출), `:212-227`(`classify_vulnerable()` —
    `advisories`/`actions` 항목이 있는데 `module_name`/`module` 을 가진 항목이 하나도 없으면
    "스키마가 바뀐 것"으로 보고 fail-closed).
  - 상세: `Read` 로 파일 전체를 직접 열어 확인했다 — 모든 "판단 불가" 분기가 `sys.exit(2)` 를
    산발적으로 호출하던 이전 패턴에서 `_undecidable() -> NoReturn` 단일 헬퍼 호출로 통합돼
    있어, 향후 새 분기가 추가돼도 exit(2) 처리를 빠뜨리면 타입 체크 단계에서 드러나는 구조다.
    회귀 테스트(`.claude/tests/test_override_floors.py`)의 `FailClosedTest`(369-419행, 빈
    출력·파싱 불가·`actions` 없는 오류 페이로드·워크스페이스 파일 부재 네 형태)와
    `SchemaDriftTest`(305-334행, `module_name`→`moduleName` 개명·`module`→`pkg` 개명·
    "진짜 빈 결과는 드리프트 아님" 세 케이스)를 직접 재실행해 전부 PASS, 그리고 해당 분기를
    되돌리는 뮤턴트(예: `if advisories and not reported: pass` 로 무력화)를 임시로 적용했을 때
    이 두 테스트 클래스가 즉시 RED 로 전환됨을 확인했다 — 가드가 실제로 이 실패 클래스를
    막고 있음을 뮤테이션으로 실측했다(원복 완료, `git status` clean 확인).
  - 제안: 조치 불요 — 검증 완료 기록.

- **[INFO]** (재검증 완료, 긍정) 2차 라운드 CRITICAL("`harness-checks.yml` 에 삽입된
  `Install PyYAML` 스텝이 인접 스텝과 YAML 매핑 중복 키로 병합돼 설치 명령이 소실되고
  워크플로 자체가 스키마 위반이 될 위험")이 실제로 해소됐고, 재발 방지 가드까지 신설됐다.
  - 위치: `.github/workflows/harness-checks.yml:81-85`(`Install PyYAML` 스텝과
    `Run harness unit tests` 스텝이 완전히 분리된 독립 스텝) / 재발 방지 가드는
    `.claude/tests/test_workflow_yaml_structure.py`(신규 파일, `_duplicate_keys()` +
    `run`/`uses` 배타 검사).
  - 상세: 이 worktree 에서 `.github/workflows/*.yml` 전체를 직접 `yaml.safe_load` 로 파싱해
    모든 스텝이 `run`/`uses` 를 정확히 1개씩만 가짐을 재확인했고(별도 스크립트로 재현),
    `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 전체를 직접 실행해
    **744건 전부 PASS** 를 확인했다(`test_workflow_yaml_structure.py` 의 `DetectorTest` 는
    2026-08-01 사고 문구를 그대로 재현한 `BROKEN_SAMPLE` 로 탐지 로직 자체가 살아있음을
    자체 검증한다). 신규 커스텀 로더(`test_workflow_yaml_structure.py:61-74`)는
    `yaml.SafeLoader` 를 서브클래싱해 매핑 생성자만 오버라이드하므로 안전 범위를 벗어나지
    않는다(임의 파이썬 객체 생성 태그를 추가하지 않음 — RCE 경로 없음).
  - 제안: 조치 불요 — 검증 완료 기록.

- **[INFO]** (재검증 완료, 긍정) 1차 라운드에서 낮은 우선순위로 기록됐던 테스트 스텁의
  문자열 조립 패턴(하드코딩 값이라 공격 경로는 없었으나 완결성 차원의 지적)이 이번
  라운드에서 더 안전한 형태로 개선됐다.
  - 위치: `.claude/tests/test_override_floors.py:54-113`(`_PNPM_STUB`/`run_with_stub_audit`).
  - 상세: 이전에는 `json.dumps(...)` 로 만든 payload 를 f-string 으로 파이썬 소스 문자열에
    직접 삽입해 가짜 `pnpm` 실행파일을 생성했다(값이 테스트 파일 내 하드코딩 리터럴이라
    실질 위험은 없었지만, 원리적으로는 `"""` 시퀀스가 섞이면 생성 소스의 구조를 깰 수 있는
    패턴이었다). 지금은 `_PNPM_STUB` 이 **고정 소스**이고, payload 는 별도 JSON 파일에 써서
    스텁이 `os.environ["STUB_AUDIT_PAYLOAD"]` 경로로 읽어 그대로 stdout 에 write 하는 구조로
    바뀌었다 — 값이 파이썬 소스 문자열 조립에 전혀 관여하지 않으므로 그 이론적 표면 자체가
    사라졌다.
  - 제안: 조치 불요 — 검증 완료 기록.

- **[INFO]** 신규/변경 코드 전반에서 고전적 OWASP Top 10 클래스 취약점은 발견되지 않았다
  (직접 실행·grep 으로 재검증).
  - 위치: `scripts/check-override-floors.py`(전체), `.claude/tests/test_override_floors.py`,
    `.claude/tests/test_workflow_yaml_structure.py`, `.claude/tests/test_dependabot_npm_coverage.py`,
    `.claude/tests/test_harness_checks_paths_coverage.py`.
  - 상세: `subprocess.run(...)` 호출 5곳 전부 리스트 인자·`shell=True` 없음(`shell=True`·
    `os.system`·`eval`·`exec(`·`pickle`을 대상 파일 전체에 grep 했으나 매치 없음, 유일한
    `exec_module` 호출은 `importlib` 표준 API 로 저장소 내부 신뢰 모듈을 로드하는 것뿐).
    YAML 파싱은 전부 `yaml.safe_load` 또는 `SafeLoader` 서브클래스만 사용. 처리 대상(override
    키, `pnpm audit` JSON 응답, `pnpm-workspace.yaml`/`dependabot.yml` 텍스트)은 전부 저장소
    내부 파일과 신뢰된 툴체인 출력이라 외부 사용자 입력 경로가 없다. `_RANGE_SUFFIX`/
    `_NAME_CHAR` 정규식은 중첩 정량자가 없는 부정 문자 클래스 기반이라 파국적 백트래킹
    (ReDoS) 패턴이 아니다. 하드코딩된 API 키·비밀번호·토큰은 diff 전체를 `password|secret|
    token|api[_-]?key|BEGIN (RSA|PRIVATE|OPENSSH)` 로 grep 해도 매치 없음. GitHub Actions
    워크플로의 `${{ }}` 보간은 `concurrency.group` 값(`github.ref`)에만 쓰이고 `run:` 셸
    문맥에는 등장하지 않아 스크립트 인젝션(전형적인 PR 제목/브랜치명 기반 GHA 인젝션) 경로가
    없다. `pull_request_target` 트리거도 사용되지 않는다.
  - 제안: 조치 불요.

- **[INFO]** (경미, 비차단·기존 컨벤션) 신규 `override-floors` 잡을 포함해 이 저장소의
  워크플로 대부분이 서드파티 액션을 가변 메이저 태그로 고정하고, 명시적 최소권한
  `permissions:` 블록도 두지 않는다 — 다만 이는 이 diff 가 새로 만든 회귀가 아니라 저장소
  전역 컨벤션이다.
  - 위치: `.github/workflows/deps-security-checks.yml:78-98`(신규 `override-floors` 잡의
    `actions/checkout@v7`·`pnpm/action-setup@v6`·`actions/setup-node@v7`·
    `actions/setup-python@v7`).
  - 상세: `grep -rl "^permissions:"` 로 `.github/workflows/*.yml` 전체를 대조한 결과
    `migration-recheck-on-main.yml` 한 곳만 명시적 `permissions:` 를 선언하고 있어, 이번에
    손댄 `harness-checks.yml`·`deps-security-checks.yml` 을 포함한 나머지 전부가 저장소
    기본 권한에 의존한다 — 이 diff 이전부터의 상태다. 액션 태그도 같은 파일의 기존
    `config-guard`/`audit` 잡과 정확히 동일한 버전이라 신규 drift 가 아니다(2·3차 라운드
    security/dependency reviewer 도 동일하게 평가·기록함).
  - 제안: 이 PR 스코프 밖. 여유가 있으면 별도 트랙으로 (a) 액션을 불변 commit SHA 로
    고정하고, (b) 시크릿을 쓰지 않는 read-only 성격의 잡(config-guard·audit·override-floors·
    unittest 전부 `GITHUB_TOKEN` 조차 쓰지 않음)부터 `permissions: {contents: read}` 명시를
    저장소 전역 정책으로 검토.

- **[INFO]** 3차 라운드에서 architecture reviewer 가 지적한 "`EXPECTED_SUPPRESSED_PATHS`
  가 baseline→실제 방향의 단방향 대조만 한다"(WARNING/INFO)는 plan 문서에 근거와 함께
  의도적 보류로 기록돼 있으며, 이번 재검토에서도 그 판단에 동의한다.
  - 위치: `scripts/check-override-floors.py:245-255`(`main()` 의 `widened` 계산 —
    `actual - allowed` 한 방향), `plan/in-progress/deps-guard-hardening.md:200-203`(보류 근거).
  - 상세: `allowed`(baseline)에만 남고 `actual`(관측)에는 없는 낡은 예외 항목이 조용히
    누적될 수 있다는 위생 문제는 사실이지만, 판정 방향 자체는 안전하다 — baseline 에 없는
    새 모듈/경로는 `.get(module, set())` 기본값이 빈 집합이라 항상 "확대"로 걸려 fail-closed
    로 향한다. 탐지가 약화되는 방향의 결함이 아니므로 보안 관점에서 즉시 조치가 필요한
    항목은 아니다.
  - 제안: 조치 불요(이미 plan 에 "항목이 늘면 그때 넣는다"로 문서화된 의도적 보류) —
    후속 추적 항목으로만 유지.

## 검증 방법 (참고)

diff 판독이 아니라 이 worktree 에서 직접 실행해 확인했다: (1) `Read` 로
`scripts/check-override-floors.py`·`.claude/tests/test_override_floors.py`·
`.github/workflows/{harness-checks,deps-security-checks}.yml`·`.github/dependabot.yml`·
`pnpm-workspace.yaml`·`.claude/tests/test_dependabot_npm_coverage.py` 전체를 열어 diff 가
아닌 최종 상태를 대조. (2) `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` —
744건 전부 PASS. (3) `.github/workflows/*.yml` 전체를 별도 스크립트로 재파싱해 모든 스텝이
`run`/`uses` 정확히 1개씩만 가짐을 재확인. (4) `git diff origin/main..HEAD -- . ':!review/'`
전체를 시크릿 패턴·`shell=True`/`os.system`·`eval`/`exec(`/`pickle` 패턴으로 grep.

## 요약

이번 diff(브랜치 누적, `origin/main` 대비)는 의존성 보안 거버넌스를 강화하는 CI 게이트·
스크립트·회귀 테스트 세트이며, 1~3차 리뷰가 발견한 Critical 5건(override-floors 게이트의
`ignoreCves` 전역 억제 사각·`harness-checks.yml` scripts 미등재·dependabot 루트 등록과 기존
가드 전제 충돌·`harness-checks.yml` YAML 중복 키로 인한 CI 무효화 위험 등)과 보안 관련
Warning(운영: `run_audit()` fail-open 가능성, 스키마 드리프트 시 fail-open 가능성)은 모두
실제 코드·테스트로 해소됐음을 이번 라운드에서 직접 실행·재파싱해 독립적으로 재확인했다.
신규로 발견된 Critical/Warning 급 보안 결함은 없다 — 커맨드/YAML/경로 인젝션 경로 없음,
하드코딩 시크릿 없음, `shell=True`/`eval`/`pickle` 미사용, GHA 스크립트 인젝션(`${{ }}` →
`run:`) 경로 없음, ReDoS 패턴 없음을 직접 확인했다. 남은 것은 이미 plan 에 근거와 함께
문서화된 저위험·의도적 보류 항목(baseline 단방향 대조, 서드파티 액션 가변 태그·명시적
`permissions:` 부재 — 둘 다 저장소 전역 기존 컨벤션이라 이 PR 의 신규 회귀 아님)뿐이다.

## 위험도

LOW
