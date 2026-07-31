# 의존성(Dependency) 리뷰 — deps-guard-hardening (3차 라운드)

## 발견사항

- **[INFO]** (긍정 관측, 실행 검증 완료) 1·2차 라운드에서 dependency reviewer 가 지적한 Critical 4건이
  전부 실제로 해소됐음을 이번 라운드에서 다시 **라이브 실행**으로 독립 재확인했다.
  - 위치: `scripts/check-override-floors.py`(`EXPECTED_SUPPRESSED_PATHS` — 46-50행 `import yaml`
    fail-closed, 61-67행 baseline, 165-200행 `classify_vulnerable`) /
    `.claude/tests/test_dependabot_npm_coverage.py:36-48,309-337`
    (`_legitimate_dependabot_directories` + 전용 테스트 2건) /
    `.github/workflows/harness-checks.yml:58`(`scripts/check-override-floors.py` 등재) /
    `.github/workflows/harness-checks.yml:81-85`(PyYAML 설치 스텝 구조 정정 완료).
  - 상세: 이 worktree 에서 직접 재실행해 확인했다 — `python3 scripts/check-override-floors.py` →
    `OK: override 대상 26개 패키지 중 취약 재유입 0건`(exit 0, 실제 `pnpm audit` 호출).
    `python3 scripts/check-pnpm-security-config.py` → `OK: overrides 29건(값 포함) ·
    onlyBuiltDependencies 5건 · ignoreCves 2건 baseline 일치`(exit 0, 기존 2-place 규약도 드리프트
    없음). `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → **739건 전부 PASS**
    (1·2차에서 FAIL 했던 `test_no_stale_dependabot_npm_entry` ·
    `test_every_guarded_file_is_covered` · `test_every_test_file_is_documented` 포함). 추가로
    `.github/workflows/*.yml` 전체를 직접 파싱해 모든 스텝이 `run`/`uses` 정확히 1개씩만 가짐을
    재확인했다 — 2차에서 발견된 "PyYAML 스텝이 인접 스텝의 `name:`/`run:` 사이에 끼어들어 `run:`
    키가 중복되고 설치 명령이 소실"된 결함(`harness-checks.yml`)이 재발하지 않았다. 이번 라운드에서
    새로 검토 대상에 오른 `.claude/tests/test_workflow_yaml_structure.py`(신규 파일, 회귀 방지용)도
    `yaml.safe_load`/`yaml.SafeLoader` 서브클래스만 사용해 임의 코드 실행 위험 없이 안전하게
    구현돼 있다.
  - 제안: 조치 불요 — 검증 완료 기록.

- **[INFO]** 신규/재사용 의존성의 버전 고정·라이선스·CI 배선 정합성 — 조치 불요.
  - 위치: `.github/workflows/harness-checks.yml:81-82`(신규 3번째 설치 지점) vs
    `.github/workflows/deps-security-checks.yml:52-54,87-88`(기존 2개 지점) /
    `.claude/tests/README.md:19-27`(정책 서술 갱신).
  - 상세: `pip install "pyyaml>=6,<7"` 이 저장소 내 3곳(기존 `config-guard`, 기존
    `override-floors`, 이번에 배선된 `harness-checks` unittest 잡) 모두 정확히 동일 range 로
    일관됨을 `grep` 로 확인했다 — 새 외부 의존성이 아니라 기존 PyYAML 재사용이고 버전 충돌이
    없다. PyYAML 은 MIT 라이선스로 프로젝트와 호환된다. 표준 라이브러리에 YAML 파서가 없어 대체
    불가하며, `.claude/tests/README.md:22-23` 이 "자체 파서를 손으로 짜면 가드 자신의 정확성이
    의문에 부쳐진다"는 근거를 명시적으로 남겨 불필요한 의존성이 아님을 문서화했다. `pnpm-lock.yaml`
    은 이번 diff 에 포함되지 않았고(런타임 npm/pnpm 의존성 변경 없음), `pnpm-workspace.yaml` 의
    diff 는 `auditConfig` 주석(수용 절차 요구사항 명문화)뿐으로 `overrides`/`ignoreCves` 실값은
    변경되지 않았다 — 빌드 산출물·번들 크기에 대한 영향이 없다. `harness-checks.yml` 의
    `.github/workflows/**` 로의 트리거 확장(기존 `e2e.yml` 개별 등재를 흡수)도 신설
    `test_workflow_yaml_structure.py` 가 **파일 무관하게 모든 워크플로**를 검사하는 것과 정확히
    스코프가 일치해, CI 실행 횟수 증가가 가드의 실제 커버리지 대비 과도하지 않다(잡 자체도
    stdlib+PyYAML 뿐이라 5분 타임아웃 내에서 수 초 수준 오버헤드).

- **[INFO]** (경미, 비차단) pip 의존성이 정확 버전/해시 고정이 아니라 range(`>=6,<7`)로만 고정됨.
  - 위치: `.github/workflows/harness-checks.yml:82`, `.github/workflows/deps-security-checks.yml:54,88`.
  - 상세: 세 지점 모두 range 가 동일해 drift 위험은 없지만, `pnpm-lock.yaml` 이 재현성의 단일
    진실이라는 PROJECT.md 의 버전 핀 정책(pnpm/npm 대상)과 달리 pip 쪽은 lockfile/hash 고정이
    없어 CI 실행마다 6.x 범위 내 다른 패치 버전이 설치될 수 있다. 이번 PR 이 새로 만든 패턴이
    아니라 기존 두 지점(`config-guard`)에 있던 패턴을 세 번째 지점으로 확장한 것이고, 소비
    코드(`check-override-floors.py`, `test_workflow_yaml_structure.py`)는 전부 `yaml.safe_load`/
    `SafeLoader` 서브클래스만 사용해 PyYAML 자체의 알려진 취약점 클래스(구버전 `yaml.load()` 의
    임의 객체 생성, 5.4 이전)와 무관하므로 실질 위험은 낮다.
  - 제안: 이번 PR 스코프 밖(기존 컨벤션 확장일 뿐). 여유가 있으면 향후 `pip install` 을
    `pip install --require-hashes` 류로 강화하는 것을 저장소 전체 정책으로 별도 검토.

- **[INFO]** (경미, 비차단, 기록 확인) `dependabot.yml` 루트 등록이 해소하려던 원 사고
  (`#1029`/`#1030`)의 근본 방지책은 아직 repo Settings 소관으로 남아 있음 — 이 PR 의 코드
  변경으로는 닫을 수 없는 범위라는 점을 plan 문서가 스스로 명시하고 있다.
  - 위치: `plan/in-progress/deps-guard-hardening.md:202-208`("남은 수동 조치" 섹션, `--frozen-lockfile`
    검증을 required check 로 승격 — Branch protection 설정) / `.github/dependabot.yml:39-41`(동일
    갭을 주석으로 교차 언급).
  - 상세: 이번 diff 는 (a) 같은 `npm_and_yarn` 그룹의 순차 머지에서 rebase 가 적용되도록
    `directory: "/"` + `rebase-strategy: auto` 를 등록했지만, (b) 애초 사고의 발현 지점이었던
    "`--frozen-lockfile` 실패가 required check 가 아니어서 이미 머지를 막지 못했다"는 부분은
    이 diff 로 닫히지 않는다. plan 이 그 갭을 "P2"로 명시하고 파일로 표현 불가능한 이유까지
    정확히 서술해 뒀으므로 은폐된 리스크는 아니다.
  - 제안: 조치 불요(이 PR 스코프 밖, 이미 인지·기록됨) — 후속 추적 항목으로만 남겨둘 것.

## 요약

3차 라운드는 순수하게 다형 이전 두 라운드가 발견한 결함들의 **조치 검증** 성격이다. 1차가 지적한
"`ignoreCves` 전역 억제로 인한 override-floors 탐지 무력화"·"harness-checks.yml `scripts/` 미등재"·
"dependabot 루트 등록과 기존 가드 전제 충돌"(Critical 3건)과 2차가 지적한 "PyYAML 설치 스텝 삽입이
YAML 매핑 중복 키를 만들어 워크플로 자체를 무효화할 위험"(Critical 1건)을 diff 판독이 아니라 실제
스크립트 실행(`check-override-floors.py`, `check-pnpm-security-config.py` 둘 다 exit 0)과 하네스
전체 스위트(739/739 PASS) 및 `.github/workflows/*.yml` 전량 재파싱으로 **독립적으로 재현·확인**했다
— 넷 다 코드/설정 양쪽에서 실제로 해소돼 있다. 새로 도입된 의존성은 사실상 없다(PyYAML 은 기존
2곳과 정확히 동일한 range 로 3번째 지점에 재사용됐을 뿐이고, 신규 npm/pnpm 런타임 의존성·
`pnpm-lock.yaml` 변경은 이 diff 에 없다). 라이선스(MIT)·불필요성(표준 라이브러리 대체 불가, 문서화된
근거)·호환성(3곳 range 완전 일치)·내부 의존 관계(override-floors 스크립트 ↔ `pnpm-workspace.yaml`
`ignoreCves` 의 2-place 수동 동기화, 드리프트 시 fail-closed 방향)에서 이번 diff 가 새로 만든
문제는 발견되지 않았다. 남은 것은 이 PR 스코프 밖으로 이미 문서화된 저위험 잔여 항목(pip range-pin,
`--frozen-lockfile` required-check 승격이 아직 repo Settings 미조치) 뿐이다.

## 위험도

LOW
