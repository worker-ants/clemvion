# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — reviewer 8명 전원이 동일한 CI 배선 결함을 독립적으로 확인했다: `harness-checks.yml`의 PyYAML 설치 스텝 삽입이 YAML 매핑 구조를 깨뜨려, 직전 라운드 WARNING(PyYAML 미설치)을 고치려던 편집이 오히려 `pip install` 명령을 소실시키고 워크플로 자체를 무효화할 위험을 만들었다. 이 결함은 로컬 TEST WORKFLOW로는 드러나지 않고 GitHub Actions 실행에서만 노출되므로 병합 전 반드시 수정이 필요하다. forced reviewer 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 위 CRITICAL 판정에 누락된 강제 리뷰어는 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | CI/YAML 구조 | `harness-checks.yml`의 "Install PyYAML" 스텝이 기존 "Run harness unit tests" 스텝의 `name:`/`run:` 사이에 잘못 삽입되어 YAML 매핑에 `run:` 키가 중복된다. 파싱 시 뒤의 값(`python3 -m unittest discover ...`)이 앞의 값(`pip install "pyyaml>=6,<7"`)을 조용히 덮어써 **PyYAML 설치 명령이 완전히 소실**되고, 원래의 "Run harness unit tests" 스텝은 `run`/`uses`가 전혀 없는 스키마 위반 스텝이 된다. 8개 reviewer(security/requirement/scope/side_effect/maintainability/testing/documentation/dependency) 전원이 `yaml.safe_load()` 직접 파싱으로 교차 검증했다. GitHub Actions가 워크플로 파일 자체를 invalid로 거부하거나(스텝은 run/uses 필수), 통과하더라도 PyYAML 미설치로 CI에서만 `test_override_floors.py` 관련 테스트가 깨진다 — 로컬은 이미 PyYAML이 설치돼 있어 로컬 TEST WORKFLOW로는 절대 드러나지 않는다. `harness-checks.yml`은 `.claude/**`·`scripts/*`·`PROJECT.md` 등 광범위 경로를 커버하는 유일한 하네스 회귀 게이트(~730여 건)라 영향 범위가 이 PR 밖으로 확산된다. | `.github/workflows/harness-checks.yml:69-76` | 두 스텝을 완전히 분리: `- name: Install PyYAML` / `run: pip install "pyyaml>=6,<7"` 을 `- name: Run harness unit tests` / `run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'` **앞**에 독립 스텝으로 배치. 수정 후 `python3 -c "import yaml; print(yaml.safe_load(open('.github/workflows/harness-checks.yml'))['jobs']['unittest']['steps'])"`로 각 스텝이 `run`/`uses` 정확히 하나씩만 갖는지 재확인. 재발 방지로 `.github/workflows/*.yml`에 대해 중복 키·run-or-uses 여부를 검증하는 harness 테스트(또는 actionlint) 추가 권고. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | 문서 정확성 | `test_override_floors.py` docstring과 `README.md` 카탈로그가 "세 축"/"Three axes"라고 서술하지만 실제로는 4개 축(키 추출·분류·`ignoreCves` 억제 경로 baseline·fail-closed)을 나열한다 — README는 같은 문장에서 스스로 "Fail-closed covers the **fourth**"라고 써 자기모순이다. `plan/in-progress/deps-guard-hardening.md`는 이미 "4축"으로 정정되어 있어, 정정이 한쪽에만 전파되고 근거 문서(테스트/README)에는 미반영됐다. (requirement/maintainability/testing/documentation 4개 reviewer 공통 지적, scope는 INFO로 유사 지적) | `.claude/tests/test_override_floors.py:7`, `.claude/tests/README.md:29` | "세 축"/"Three axes" → "네 축"/"Four axes"로 정정해 plan 체크리스트와 맞춘다. |
| 3 | 테스트 갭 | `override_target()`이 다단 체인의 **중간** 세그먼트가 scope 패키지인 경우 여전히 잘못된 값을 반환한다(`override_target("a>@scope/b>c")` → `'@scope/b>c'`, 기대값 `'c'`) — 이번 라운드가 고친 "첫 `>` vs 마지막 `>`" 버그의 형제 케이스이며 신규 회귀 테스트가 커버하지 않는다. 현재 `pnpm-workspace.yaml`엔 이 형태의 키가 없어 당장 터지지 않지만, scope 패키지가 체인 중간에 오는 override 키가 추가되면 "가드가 아무것도 안 잡는" 실패가 조용히 재발할 수 있다. | `scripts/check-override-floors.py:96-98`; 테스트 갭 `.claude/tests/test_override_floors.py:90-104` | `a>@scope/b>c` 류 "중간 scope" 케이스를 회귀 테스트에 추가하고, 추출 로직을 체인을 `>`로 분리한 뒤 세그먼트별로 scope 경계를 판단하도록 일반화. |
| 4 | 유지보수성/리포트 완결성 | `check-override-floors.py::main()`이 `widened`(ignoreCves 경로 확대) 검사에서 문제 발견 시 `eroded`(override 바닥 침식) 계산 전에 `return 1`로 조기 종료해, 두 실패가 동시에 있어도 한 번의 실행엔 `widened`만 보고된다 — 자매 스크립트 `check-pnpm-security-config.py`의 "모두 계산 후 한 번에 보고" 패턴과 다르다. exit code(fail)는 두 경우 모두 정확해 fail-open 위험은 없음(순수 리포트 완결성 문제). | `scripts/check-override-floors.py` `main()`(widened 조기 반환부) | 두 리스트를 모두 계산한 뒤 한 번에 보고하도록 재구성하거나 `_report_widened`/`_report_eroded` 헬퍼로 분리. |
| 5 | 테스트 구조 | 테스트 헬퍼 `_run_with_stub_audit`가 `self`를 전혀 쓰지 않는데도 `ClassificationTest`의 인스턴스 메서드로 선언돼 있고, 다른 3개 클래스(`SuppressedPathBaselineTest`/`FailClosedTest`/`MultipleMatchTest`)가 언바운드 메서드 호출(`ClassificationTest._run_with_stub_audit(self, ...)`) 관용구로 재사용한다 — 저장소 기존 관례(`test_orchestrator_state.py`의 모듈 레벨 헬퍼)와 다르고, `ClassificationTest`를 리팩터링/삭제하면 나머지 3개가 조용히 깨질 숨은 결합이다. | `.claude/tests/test_override_floors.py:119-178`(정의), `:244-249`/`:275-278`/`:301-311`(호출부) | `_run_with_stub_audit`을 모듈 레벨 함수로 승격해 4개 클래스가 `self` 없이 직접 호출. |
| 6 | 문서 동기화 | `PROJECT.md`가 `deps-security-checks.yml`의 잡 구성을 여전히 2개(`pnpm audit`, `check-pnpm-security-config.py`)로만 서술한다 — 이번 PR이 추가한 3번째 잡 `override-floors`(`check-override-floors.py`)가 누락돼, 이 문서만 읽는 개발자는 신규 게이트의 존재나 override 값 변경 시 이 게이트도 통과해야 한다는 사실을 알 수 없다. | `PROJECT.md:48` (diff 밖 파일, `deps-security-checks.yml:74-94` 신규 잡과 대조) | "(3) `scripts/check-override-floors.py`로 override 핀 패키지의 바닥 침식을 검출한다" 절 추가. |
| 7 | 문서-불변식 drift | 하네스 스위트의 "stdlib 전용·설치 스텝 없음" 불변식(`README.md:14-17`, `harness-checks.yml:1-3` 헤더)이 이번 PR로 깨졌는데(PyYAML 요구) 두 서술 모두 갱신되지 않았다 — 같은 파일 안에서도 헤더("no install step")와 신설된 "Install PyYAML" 스텝 이름이 서로 모순된다. | `.claude/tests/README.md:14-17`, `.github/workflows/harness-checks.yml:1-3` | 위 CRITICAL 수정과 함께 "`test_override_floors.py`가 대상 스크립트의 `import yaml` 때문에 예외적으로 PyYAML을 요구한다"는 명시적 예외 문구 추가. |
| 8 | 문서 정확성 | `README.md`의 `test_dependabot_npm_coverage.py` 카탈로그 행이 이번 PR이 추가한 워크스페이스-루트 등록 예외 로직(`test_workspace_root_stays_registered`, `test_root_exception_does_not_admit_workspace_members`, #1029/#1030 근거)을 반영하지 못한다 — 카탈로그 완전성 가드(`test_tests_readme_catalog.py`)는 행의 "존재"만 검사하고 "내용 정확성"은 검사하지 않아 이 갭이 CI로 드러나지 않는다. | `.claude/tests/README.md:28` vs `.claude/tests/test_dependabot_npm_coverage.py:46-48,309,323` | 행에 "워크스페이스 루트는 lockfile 최신성(#1029/#1030) 목적으로 예외 등록되며, 예외는 루트 한 곳으로 한정된다"는 문장 추가. |
| 9 | 커밋 위생/추적성 | 커밋 `3ff26348c` 메시지가 "CI 등재 3건 + `override_target`/PyYAML Warning"만 나열하고, 같은 커밋에 포함된 실질 보안 로직 변경 2건(`ignoreCves` 억제 사각 대응 `EXPECTED_SUPPRESSED_PATHS`/`classify_vulnerable` 신설, `run_audit()` fail-closed 전환)을 언급하지 않아 추적성이 깨진다. 수정 자체는 정당하나 커밋 메시지만으로는 보안 탐지 로직이 바뀐 사실을 알 수 없다. | 커밋 `3ff26348c` 메시지 vs `scripts/check-override-floors.py`의 `EXPECTED_SUPPRESSED_PATHS`/`classify_vulnerable`/`run_audit()` | 향후 유사 커밋은 메시지에 변경 축을 명시하거나, 배선 변경과 탐지 로직 강화를 별도 커밋으로 분리(plan 체크리스트엔 이미 사후 기록돼 최소 조치는 완료). |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 10 | 1차 리뷰 조치 검증 | 1차 리뷰(`review/code/2026/08/01/01_12_24`)의 Critical 4건·Warning 4건 중 위 CRITICAL #1(PyYAML)을 제외한 나머지 전부가 실제 실행/재현으로 검증된 상태에서 올바르게 조치됐음을 6개 reviewer(security/requirement/scope/testing/dependency/maintainability)가 독립적으로 확인했다 — `pnpm audit` 실행 exit 0("override 대상 26개 패키지 중 취약 재유입 0건"), 하네스 스위트 731건 discover 전체 PASS, `override_target()` 12개 케이스 재실행, `FailClosedTest`/`SuppressedPathBaselineTest`/`MultipleMatchTest` 통과 등. | 전반 | 조치 불요 — 참고용 확인. |
| 11 | 타입 안전성 | `classify_vulnerable()`의 `reported[module]` 폴백(`adv.get("github_advisory_id") or adv.get("id") or name`)이 선언 타입(`dict[str, str]`)과 달리 `id`만 있는 advisory에서 `int` 값이 될 수 있다 — 현재 테스트 픽스처는 전부 `github_advisory_id`를 포함해 이 경로는 미검증(발생 가능성은 낮음). | `scripts/check-override-floors.py`(`classify_vulnerable`, `reported` 구성부) | `str(...)`로 명시 캐스팅하거나 해당 폴백 경로 회귀 테스트 추가(우선순위 낮음). |
| 12 | 테스트 데이터 중복 | 테스트 데이터 `OVERRIDES` YAML 리터럴이 `ClassificationTest`(`:180`)와 `MultipleMatchTest`(`:299`) 두 곳에 완전히 동일한 문자열로 하드코딩돼 있다 — 한쪽만 고치는 향후 편집이 다른 쪽을 조용히 낡게 만들 위험이 있다. | `.claude/tests/test_override_floors.py:180`, `:299` | 모듈 레벨 상수로 추출해 공유. |
| 13 | 매직 넘버 | 에러 메시지 미리보기 길이(`proc.stderr[:500]`, `out[:2000]`, `list(data)[:10]`)가 근거 설명 없는 하드코딩 숫자다. | `scripts/check-override-floors.py:137,143,152` | 여유 있을 때 이름 있는 상수로 추출. |
| 14 | 중복 순회 | `advisories`를 `classify_vulnerable()`(`reported` 구성)과 `main()`(`patched_by_module` 구성)에서 각각 순회한다 — 입력 크기가 작아 성능 영향은 없음. | `scripts/check-override-floors.py:181-185`, `:204-208` | 우선순위 낮음 — 다음에 손댈 때 `reported` 값 타입 확장을 고려. |
| 15 | 테스트 갭 | "워크스페이스 파일 부재"(`pnpm-workspace.yaml` 자체가 없는 디렉터리) 분기가 이번 라운드의 `FailClosedTest` 추가 이후에도 여전히 테스트되지 않는다. exit 2 fail-safe라 위험은 낮음. | `scripts/check-override-floors.py:196-199` | tmp 디렉터리(워크스페이스 파일 없음)에서 직접 실행하는 케이스 1건 추가. |
| 16 | 문서 누락 | `README.md`의 신규 카탈로그 행이 `MultipleMatchTest`(다건 매칭 시나리오 회귀, #1038)를 이름으로 언급하지 않는다. | `.claude/tests/README.md:29` | 우선순위 낮음 — 한 구절 추가. |
| 17 | 주석 정확성 | `harness-checks.yml`에 신규 삽입된 주석이 "같은 파일 `deps-security-checks.yml`의 config-guard 잡"이라고 쓰지만, 주석이 위치한 파일은 `harness-checks.yml`이라 실제로는 별개 파일이다. | `.github/workflows/harness-checks.yml:70-72` | 위 CRITICAL #1 재작성 시 문구도 함께 정리. |
| 18 | 긍정 확인 | (a) `override-floors` 잡이 참조하는 GitHub Actions 버전(`actions/checkout@v7` 등)은 같은 파일 기존 잡과 동일 컨벤션(가변 메이저 태그)이라 신규 회귀 아님. (b) `test_override_floors.py`의 `PATH` 조작(`_run_with_stub_audit`)은 `os.environ` 사본만 변경하고 `tempfile.TemporaryDirectory()` 스코프 안에서 정리되어 실제 프로세스/파일시스템에 잔존 상태를 남기지 않음. (c) `pnpm-workspace.yaml` diff는 주석 확장뿐이며 `overrides`/`ignoreCves` 실제 값은 이번 PR에서 불변 — §2(수용 근거 규약 문서화) 범위를 정확히 지킴. | `.github/workflows/deps-security-checks.yml:79-86`; `.claude/tests/test_override_floors.py:172`; `pnpm-workspace.yaml:69-85` | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | `harness-checks.yml` YAML 중복 키로 PyYAML 설치 소실(공통 CRITICAL). 그 외 fail-open/탐지 사각 등 1차 WARNING·CRITICAL은 정상 조치 확인(INFO). |
| requirement | CRITICAL | 공통 CRITICAL 재확인 + "세 축" 서술 오류(WARNING) + `reported` 타입 불일치 가능성(INFO). 1차 리뷰 7/8 항목 실행 재검증 완료. |
| scope | CRITICAL | 공통 CRITICAL(순수 추가 의도가 기존 스텝을 침범) + 커밋 메시지-실제 변경 불일치(WARNING). |
| side_effect | CRITICAL | 공통 CRITICAL(CI 파이프라인 부작용, 넓은 `paths:` 트리거로 이후 모든 PR 영향). 신규 스크립트 자체의 전역 상태·env 관리는 안전(INFO). |
| maintainability | CRITICAL | 공통 CRITICAL + "세 축" 오류(WARNING) + `main()` 조기 반환 리포트 미완결(WARNING) + 테스트 헬퍼 self 이례적 공유(WARNING). |
| testing | CRITICAL | 공통 CRITICAL + `override_target` 중간 scope 미커버 변종(WARNING, 신규 발견) + README 자기모순(WARNING). 1차 리뷰 조치 다수 직접 재실행 검증. |
| documentation | CRITICAL | 공통 CRITICAL(주석-실제 동작 불일치로 재분류) + PROJECT.md/README 문서 drift 3건(WARNING). |
| dependency | CRITICAL | 공통 CRITICAL(신규 의존성 설치 스텝 자체가 손상) + 1차 리뷰 CRITICAL 3건 실제 실행으로 해소 확인(INFO). 신규 외부 의존성 없음, 버전/라이선스 문제 없음. |

## 발견 없는 에이전트

없음 — forced 7명 + router 선정 1명(dependency), 총 8명 전원이 최소 1건 이상의 실질 발견(공통 CRITICAL 포함)을 보고했다.

## 권장 조치사항

1. **(최우선, 병합 차단)** `.github/workflows/harness-checks.yml:69-76`의 "Install PyYAML" 스텝을 "Run harness unit tests" 스텝과 완전히 분리된 독립 스텝으로 재작성 — `run:` 키 중복을 제거하고 두 스텝 모두 정확히 하나의 `run:`을 갖도록 한다. 수정 후 `yaml.safe_load()`로 `jobs.unittest.steps`를 직접 파싱해 스텝 개수·각 스텝의 run/uses 존재를 재확인할 것.
2. 위 수정과 함께 `README.md`(`:14-17`)와 `harness-checks.yml` 헤더(`:1-3`)의 "stdlib 전용·설치 스텝 없음" 서술에 PyYAML 예외를 명시하고, `harness-checks.yml:70-72`의 파일명 오기("같은 파일 deps-security-checks.yml")도 함께 정리한다.
3. `test_override_floors.py:7`과 `README.md:29`의 "세 축"/"Three axes"를 "네 축"/"Four axes"로 정정해 이미 정정된 plan 체크리스트와 맞춘다.
4. `PROJECT.md:48`에 신규 `override-floors` 잡(3번째 잡)을 추가 서술하고, `README.md:28`의 dependabot 카탈로그 행에 워크스페이스-루트 등록 예외를 반영한다.
5. `override_target()`의 "체인 중간 scope 패키지" 미커버 변종(`a>@scope/b>c`)에 대한 회귀 테스트를 추가하고 추출 로직을 일반화 — 현재는 잠재적(latent) 결함이나, 이 스크립트가 막으려는 "가드가 조용히 무력화"되는 것과 동일한 실패 클래스다.
6. 여유 있을 때: `main()`의 widened/eroded 통합 리포팅, `_run_with_stub_audit` 모듈 레벨 승격, 커밋 메시지에 보안 로직 변경 축 명시 — 우선순위 낮은 유지보수성/추적성 개선.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, dependency` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(success). 위 CRITICAL/WARNING 판정에 누락된 강제 리뷰어 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 상세 사유 미제공. diff가 CI 설정/스크립트/테스트 중심으로 성능 민감 경로(hot path) 변경이 없어 낮은 관련성으로 추정. |
  | architecture | router 판단 — 상세 사유 미제공. 시스템 아키텍처/모듈 경계 변경 없음(스크립트 1개 신설 + CI 배선)으로 낮은 관련성 추정. |
  | database | router 판단 — 상세 사유 미제공. DB 스키마/쿼리 변경 없음. |
  | concurrency | router 판단 — 상세 사유 미제공. 동시성 민감 코드 변경 없음. |
  | api_contract | router 판단 — 상세 사유 미제공. API 계약 변경 없음(내부 CI 스크립트). |
  | user_guide_sync | router 판단 — 상세 사유 미제공. 사용자 대상 제품 문서/가이드 영향 없음(`spec_impact: none`과 일치). |