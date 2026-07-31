# 보안(Security) 리뷰 — deps-guard-hardening (3차 재검증 라운드)

이번 라운드는 직전 두 라운드(`review/code/2026/08/01/01_12_24`, `review/code/2026/08/01/01_56_46`)에서
지적된 CRITICAL/WARNING이 실제로 해소됐는지 재검증하는 diff다. 신규 스크립트(`scripts/check-override-floors.py`),
신규 워크플로 잡, 신규 회귀 테스트(`test_override_floors.py`, `test_workflow_yaml_structure.py`)를 직접
`Read`로 열람하고, 로컬에서 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'`(739건 전체) +
커스텀 중복-키 파서로 `.github/workflows/*.yml` 재파싱을 실행해 대조 검증했다.

## 발견사항

- **[INFO]** (직전 라운드 CRITICAL 해소 확인) `harness-checks.yml`의 YAML 중복 키로 `pip install "pyyaml>=6,<7"`이
  소실되던 결함이 현재 상태에서 완전히 분리된 두 스텝으로 정정되어 있다.
  - 위치: `.github/workflows/harness-checks.yml:81-82`(`- name: Install PyYAML` / `run: pip install "pyyaml>=6,<7"`),
    `:84-85`(`- name: Run harness unit tests` / `run: python3 -m unittest discover ...`)
  - 상세: 파일을 직접 `Read`하고, `yaml.SafeLoader`를 상속한 커스텀 로더로 `harness-checks.yml` /
    `deps-security-checks.yml` / `dependabot.yml` 세 파일을 재파싱해 중복 매핑 키가 0건임을 확인했다.
    신설된 회귀 가드 `.claude/tests/test_workflow_yaml_structure.py`(중복 키 검출 + 스텝당 `run`/`uses` 정확히
    1개 검증)를 `discover -p 'test_workflow_yaml_structure.py'`로 단독 실행해 6/6 PASS 확인. `harness-checks.yml`의
    `paths:` 트리거도 `.github/workflows/**`(52행)로 넓어져, 이 클래스가 재발하면 CI가 반드시 감지하는 배선까지
    갖췄다.
  - 제안: 조치 불요(완결성 기록용).

- **[INFO]** (직전 라운드 CRITICAL 해소 확인) `auditConfig.ignoreCves`의 CVE-ID 단위 전역 억제로
  override-floors 탐지가 무력화되던 결함(`brace-expansion` 실사례)이 경로 baseline 방식으로 재설계됐다.
  - 위치: `scripts/check-override-floors.py:61-67`(`EXPECTED_SUPPRESSED_PATHS`), `:165-200`(`classify_vulnerable` —
    `advisories`에서 사라진 항목도 `actions[]`의 `module`+`resolves[].path`로 존재를 포착), `:217-227`
    (`main()`의 `widened` 판정 — baseline 대비 신규 경로 발견 시에만 fail).
  - 상세: `ignoreCves`로 수용된 CVE는 `advisories`에서 통째로 사라지지만 `actions[]`에는 남는다는 점을 이용해
    "수용 시점 경로"를 코드에 고정하고, 그 경로 집합을 넘어서는(=수용 범위 밖 재유입) 경우에만 fail시킨다.
    `SuppressedPathBaselineTest`(`.claude/tests/test_override_floors.py:249-278`) 2건을 직접 실행해 PASS 확인
    (baseline 경로만 있으면 통과, 신규 경로 추가 시 `수용 범위 밖` 메시지와 함께 fail).
  - 제안: 조치 불요. baseline이 수동 유지된다는 한계는 스크립트 docstring이 스스로 명시하고 있어 은폐되지 않았다.

- **[INFO]** (직전 라운드 WARNING 해소 확인) `run_audit()`의 fail-open 가능성이 fail-closed로 정정됐다.
  - 위치: `scripts/check-override-floors.py:124-162`(`run_audit()`) — 빈 stdout(139-146행), JSON 파싱 실패
    (147-152행), `actions` 키 부재(153-161행) 세 경로 모두 `sys.exit(2)`.
  - 상세: `pnpm audit`가 취약점 발견 시 비-0으로 끝나 returncode로 성공을 판단할 수 없다는 제약 위에서, 출력
    형태(빈 문자열/파싱 불가/`actions` 키 부재)로 "판단 불가"를 "취약점 0건"과 구분하도록 재작성됐다.
    `FailClosedTest`(`.claude/tests/test_override_floors.py:281-331`) 4건을 직접 실행해 PASS 확인(각각 exit 2).
  - 제안: 조치 불요.

- **[INFO]** 신규 프로덕션 코드(`check-override-floors.py`)에 고전적 인젝션/시크릿/인가 클래스 취약점 없음.
  - 위치: `scripts/check-override-floors.py:132-137`(`subprocess.run(["pnpm", "audit", "--audit-level=moderate",
    "--json"], cwd=REPO_ROOT, ...)` — 리스트 인자, `shell=True` 미사용), `:116`(`load_override_targets`가
    `yaml.safe_load()`만 사용).
  - 상세: 처리 대상(override 키, `pnpm audit` JSON 응답)은 전부 저장소 내부 파일과 신뢰된 툴체인 출력이라
    외부 사용자 입력 경로가 없다. `_NAME_CHAR`/`_RANGE_SUFFIX` 정규식(89-92행)도 중첩 정량자가 없는 단순 문자
    클래스 기반이라 ReDoS 패턴이 아니고, 입력 자체가 저장소 내부 `pnpm-workspace.yaml`이라 신뢰 경계 밖 공격
    표면도 아니다. 변경분 전체(`git diff origin/main...HEAD`)를 API 키/비밀번호/토큰/PEM 패턴으로 grep해
    하드코딩된 시크릿 0건 확인.
  - 제안: 조치 불요.

- **[INFO]** `test_workflow_yaml_structure.py`의 중복 키 탐지가 `yaml.SafeLoader`를 상속한 커스텀 로더만
  사용 — 임의 코드 실행 위험이 있는 기본 `yaml.Loader`/`yaml.UnsafeLoader` 미사용.
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:61-74`(`class _Loader(yaml.SafeLoader)` +
    `yaml.load(text, Loader=_Loader)`).
  - 상세: `yaml.safe_load()`는 커스텀 생성자를 받지 않아 이 파일이 필요로 하는 "중복 키를 기록하며 파싱"을
    구현하려면 `yaml.load()` + 명시적 `Loader`가 불가피한데, 그 Loader를 `SafeLoader`의 하위 클래스로 선언해
    `!!python/object` 등 위험 태그는 여전히 거부한다(PyYAML 공식 권장 패턴). 처리 대상도 저장소 내부
    `.github/workflows/*.yml`뿐이라 실질 공격 표면은 없지만, 안전한 패턴을 정확히 사용했음을 확인한다.
  - 제안: 조치 불요.

- **[INFO]** 테스트 헬퍼가 JSON 직렬화 결과를 Python 소스에 raw 삽입하는 패턴 — 현재 공격 경로는 없으나
  향후 boolean/null 값이 섞이면 깨질 수 있는 다소 취약한 관례(경미, 1·2차 리뷰와 동일 평가 유지).
  - 위치: `.claude/tests/test_override_floors.py:74-97`(`run_with_stub_audit` 내부 `body` 조립 —
    `json.dumps(actions)`/`json.dumps(advisories)`를 `repr()` 없이 f-string에 직접 삽입해 가짜 `pnpm` 스크립트
    소스를 생성).
  - 상세: 값이 전부 같은 테스트 파일 안의 하드코딩 리터럴(`OVERRIDES`, advisories dict 등)이라 신뢰 경계 밖
    입력이 없어 실제 인젝션 취약점은 아니다. 다만 JSON의 `true`/`false`/`null`은 Python 리터럴이 아니므로,
    향후 이 헬퍼로 boolean/null 값을 담은 advisory를 주입하는 테스트를 추가하면 생성된 스텁 스크립트가
    `NameError`(`true`/`false`/`null`이 미정의 이름)로 깨진다 — 같은 함수의 `raw_stdout` 분기가 이미 쓰는
    `{raw_stdout!r}`(75행, `repr()`) 패턴으로 통일하면 이 클래스를 원천 차단할 수 있다.
  - 제안: 우선순위 낮음(보안 결함 아님, 테스트 인프라 견고성 개선 권장) — `json.dumps(...)` 결과를 그대로
    심는 대신 `repr(json.dumps(...))`로 문자열 리터럴로 감싸고 스텁 스크립트 쪽에서 `json.loads()`로 다시
    파싱하게 하면 JSON/Python 리터럴 불일치가 사라진다.

- **[INFO]** 신규 `override-floors` 잡이 참조하는 서드파티 GitHub Actions가 가변 메이저 태그(`@v7`,`@v6`)로
  고정됨 — 기존 컨벤션 유지, 이번 PR 신규 회귀 아님. 두 워크플로 모두 권한 상승·시크릿 노출 표면 추가 없음.
  - 위치: `.github/workflows/deps-security-checks.yml:79-86`(`override-floors` 잡의
    `actions/checkout@v7`·`pnpm/action-setup@v6`·`actions/setup-node@v7`·`actions/setup-python@v7`).
  - 상세: 같은 파일의 기존 `config-guard`/`audit` 잡도 동일 컨벤션이다. `deps-security-checks.yml`·
    `harness-checks.yml` 두 파일 모두 top-level `permissions:` 블록이 없고(저장소 전역 기존 상태, 이 PR이
    바꾸지 않음) `secrets.*` 참조도 없으며, 트리거는 `pull_request_target`이 아닌 `pull_request`/`push`/
    `schedule`만 사용한다(직접 grep으로 확인) — 포크 PR에서 상승된 토큰이나 시크릿에 접근하는 위험한 조합이
    아니다.
  - 제안: 이번 PR 스코프 밖 — 향후 별도 트랙에서 액션 SHA 고정 하드닝 검토.

## 요약

이번 diff는 의존성 보안 거버넌스를 강화하는 CI/스크립트/문서 작업이며, 직전 두 라운드가 지적한 CRITICAL 2건
(`ignoreCves` 전역 억제로 인한 override-floors 탐지 무력화, `harness-checks.yml` YAML 중복 키로 인한 PyYAML
설치 소실)과 WARNING 1건(`run_audit()` fail-open 가능성)을 모두 실제로 재현·검증해 해소를 확인했다 — 코드를
직접 `Read`하고, 커스텀 중복-키 파서로 워크플로 YAML을 재파싱하고, 관련 회귀 테스트(`FailClosedTest`,
`SuppressedPathBaselineTest`, `WorkflowStructureTest` 등)와 하네스 전체 스위트(739건)를 로컬에서 실행해
전부 PASS를 확인했다. 신규 프로덕션 코드(`check-override-floors.py`)는 `subprocess.run`을 리스트 인자·
`shell=True` 없이만 호출하고 `yaml.safe_load`/`SafeLoader` 파생 클래스만 사용해 커맨드 인젝션이나 임의 코드
실행 경로가 없으며, 처리 대상이 전부 저장소 내부 파일과 신뢰된 툴체인 출력이라 외부 입력 경로 자체가 없다.
하드코딩된 시크릿도 diff 전체에서 발견되지 않았다. 남은 항목은 전부 INFO 수준으로, 실제 공격 경로가 없는
테스트 인프라의 사소한 취약성(JSON 리터럴을 Python 소스에 raw 삽입, 향후 boolean/null 도입 시에만 깨짐)과
기존 컨벤션을 그대로 따른 액션 태그 고정(이번 PR이 새로 만든 회귀 아님) 뿐이다.

## 위험도

NONE
