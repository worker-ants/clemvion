# 부작용(Side Effect) 리뷰 — deps-guard-hardening (4차 라운드)

이번 라운드는 origin/main 대비 누적 diff(commit `6b55b0f48`~`99f6110c0`, 41개 파일) 전체를
대상으로 한다. 이전 세 라운드(`01_12_24`·`01_56_46`·`02_38_45`)에서 이미 side-effect 관점의
CRITICAL 1건(`harness-checks.yml` YAML 매핑 중복 키로 PyYAML 설치가 소실되고 워크플로 자체가
무효화될 위험)이 발견·조치됐다. 본 라운드는 diff 를 다시 판독하는 대신, 실제 소스 파일을 직접
`Read`하고 가드 스위트를 재실행해 (a) 그 CRITICAL 이 여전히 해소 상태인지, (b) 3차 조치 커밋
(`99f6110c0`, 스키마 드리프트 fail-closed 등)이 새 부작용을 만들지 않았는지를 독립 재검증했다.

## 발견사항

- **[INFO]** (검증됨, 해소 유지 확인) `harness-checks.yml` 의 YAML 매핑 중복 키 CRITICAL(2차 라운드
  발견)이 현재 HEAD 에서도 해소 상태로 유지되고 있다 — 이번 라운드가 재검증한 시점 기준으로도
  회귀 없음.
  - 위치: `.github/workflows/harness-checks.yml:81-85`
  - 상세: 이 worktree 에서 `python3 -c "import yaml; ..."` 로 `unittest` 잡의 스텝 목록을 직접
    파싱해 `Install PyYAML`(81-82행, `run:` 정확히 1개)과 `Run harness unit tests`(84-85행,
    `run:` 정확히 1개)가 완전히 분리된 독립 스텝임을 재확인했다. `.claude/tests/test_workflow_yaml_structure.py`
    (신규 파일, `test_no_duplicate_keys`/`test_every_step_has_exactly_one_of_run_or_uses`)와
    `.claude/tests/test_harness_checks_paths_coverage.py`(`test_dependabot_npm_coverage.py`,
    `test_tests_readme_catalog.py` 포함) 를 개별 discover 로 직접 실행해 전부 PASS 함을 확인했다
    (override_floors 25건, workflow_yaml_structure 6건, dependabot_npm_coverage 14건,
    harness_checks_paths_coverage 26건, tests_readme_catalog 5건). CI 파이프라인을 깨뜨리는
    side effect는 남아있지 않다.

- **[INFO]** 신규 네트워크 호출 표면 — `scripts/check-override-floors.py::run_audit()` 이 `pnpm audit
  --audit-level=moderate --json` 로 npm 레지스트리에 실제 질의한다. 신규 CI 잡 `override-floors`
  에 배선되어 CI 에서 네트워크 호출이 발생하지만, 같은 파일의 기존 `audit` 잡과 동일한 패턴(레지스트리
  조회, `permissions:`/`secrets:` 블록 없음, 결과를 저장소에 다시 쓰지 않는 순수 read-only 검증)이라
  새로운 클래스의 부작용은 아니다. 단위 테스트 스위트에는 이 호출이 전혀 새지 않는다 —
  `run_with_stub_audit()` 이 `PATH` 맨 앞에 가짜 `pnpm` 실행파일을 얹은 **복사본** env
  (`env = dict(os.environ, PATH=..., STUB_AUDIT_PAYLOAD=...)`)만 서브프로세스에 넘기고, `os.environ`
  자체는 어디서도 직접 대입(`os.environ[...] = ...`)되지 않음을 diff 전체 grep 으로 확인했다 —
  실제 레지스트리 접근 경로가 테스트 프로세스로 새지 않는다.
  - 위치: `scripts/check-override-floors.py:138-170`(`run_audit`, 네트워크 호출은 `:146-151`) /
    `.claude/tests/test_override_floors.py:71-113`(`run_with_stub_audit`, env 복사는 `:103-106`,
    스텁이 읽는 `STUB_AUDIT_PAYLOAD` 는 `:59`) / `.github/workflows/deps-security-checks.yml:78-98`
    (`override-floors` 잡, `permissions`/`secrets` 블록 없음 — 파일 전체 grep 으로 확인).

- **[INFO]** 외부 시스템(GitHub Dependabot) 자동화 동작 변경 — `.github/dependabot.yml` 에 pnpm
  워크스페이스 루트(`directory: "/"`)를 신규 `npm` ecosystem 항목으로 등록했다. 이 저장소의 어떤
  코드도 호출·소비하지 않는 GitHub 플랫폼 자동화의 동작을 바꾸는 구성 변경이므로 — 병합 후
  Dependabot 이 워크스페이스 루트 전체에 대해 주간 버전 업데이트 PR 을 새로 열기 시작한다
  (#1029/#1030 사고 경위가 파일 내 주석에 상세). 코드 인터페이스가 아니라 리포 자동화 설정이라
  깨질 기존 호출자는 없으며, 신규 `test_workspace_root_stays_registered` /
  `test_root_exception_does_not_admit_workspace_members` 가 등록 유지·범위(루트 한 곳만)를
  회귀 테스트로 고정하고 있음을 개별 실행(14/14 PASS)으로 확인했다.
  - 위치: `.github/dependabot.yml:42-46` / `.claude/tests/test_dependabot_npm_coverage.py:43-48`
    (`_legitimate_dependabot_directories`), `:309-337`(전용 테스트 2건).

- **[INFO]** CI 트리거 표면의 의도적 확장 — `harness-checks.yml` 의 `on.pull_request.paths` 가
  개별 항목(`harness-checks.yml` 자기참조, `e2e.yml`) 대신 `.github/workflows/**` 와일드카드를
  등재한다. 실질 동작 변화다: `.github/workflows/` 아래 **어떤** 워크플로 파일을 고쳐도 이제
  harness-checks 잡이 트리거된다(이전엔 두 파일만). 신규 `test_workflow_yaml_structure.py` 가
  "모든 워크플로"를 대상으로 하므로 트리거 범위가 실제 커버리지와 정확히 일치하도록 넓힌 의도된
  변경이며, `test_harness_checks_paths_coverage.py::KNOWN_COVERAGE_DEPENDENCIES` 의
  `.github/workflows/**` → `e2e.yml` 매핑이 이 필터가 죽은 등재가 아님을 검증한다(개별 실행
  26/26 통과). 부작용의 실질 영향은 기능적 위험이 아니라 빈도 측면이다 — 향후 워크플로 파일이
  늘어날수록 harness-checks 실행 횟수가 늘어난다.
  - 위치: `.github/workflows/harness-checks.yml:41-52` / `.claude/tests/test_harness_checks_paths_coverage.py:110-111`.

- **[INFO]** 전역 라이브러리 상태 오염 없음 — `test_workflow_yaml_structure.py::_duplicate_keys()`
  가 호출될 때마다 `class _Loader(yaml.SafeLoader): pass` 로 로컬 서브클래스를 새로 만들고 그
  서브클래스에만 `add_constructor` 를 호출한다. PyYAML 의 `add_constructor` 는 대상 클래스
  `__dict__` 에 `yaml_constructors` 가 없으면 부모 것을 복사해 사본을 만들므로, `yaml.SafeLoader`
  자체나 다른 곳의 `yaml.safe_load` 호출은 이 검사기가 몇 번 돌든 영향받지 않는다(직접
  `yaml.SafeLoader.yaml_constructors` 를 호출 전후 비교해 동일 객체임을 재현 확인).
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:61-74`.

- **[INFO]** 시그니처/인터페이스 파손 없음, 환경 변수 오염 없음 — 이번 diff 의 프로덕션 코드측
  신규 심볼(`chain_segments`·`override_target`·`load_override_targets`·`_undecidable`·`run_audit`·
  `classify_vulnerable`·`main`·`_report_widened`·`_report_eroded`·`_legitimate_dependabot_directories`
  등)은 전부 net-new 이며, 저장소 전체 grep 으로 이 신규 스크립트/테스트 파일 자신 외에 다른
  호출자가 없음을 확인했다. `main()` 의 조기 실패 분기가 `return 2` 개별 호출에서 공용
  `_undecidable(...) -> NoReturn` 헬퍼(내부에서 `sys.exit(2)`)로 리팩터됐지만(`:125-135`), `main()`
  은 `if __name__ == "__main__": sys.exit(main())` 외에 in-process 호출자가 없어 관측 가능한
  차이는 없다. `os.environ[...] = ...` 형태의 직접 대입은 diff 전체에서 0건(grep 확인), `os.chdir`·
  `sys.path.insert`·`unittest.mock.patch` 류의 전역 몽키패치도 없다. `pnpm-workspace.yaml`/`PROJECT.md`
  diff는 주석·서술 문구 추가뿐이고 `overrides`/`ignoreCves` 실값은 변경되지 않았다(grep 으로 재확인).
  - 위치: `scripts/check-override-floors.py:53`(`REPO_ROOT`, 스크립트 자신의 `__file__` 기준이라
    테스트가 tmp 사본을 실행할 때는 tmp 를 가리키도록 격리됨), `:125-135`(`_undecidable`).

## 요약

3차례의 선행 리뷰가 발견한 유일한 실질적 부작용(`harness-checks.yml` YAML 매핑 손상으로 PyYAML
설치가 소실되고 CI 워크플로 자체가 스키마 위반으로 무효화될 위험)은 현재 HEAD 에서 해소 상태이며,
이번 라운드에서 파일을 직접 읽고 가드 5종을 개별 재실행해 회귀가 없음을 다시 확인했다. 그 이후
조치 커밋(`99f6110c0`: 스키마 드리프트 fail-closed, 테스트 스텁 고정화, fail-closed 헬퍼 통합)은
순수 내부 리팩터/방어 강화이며 새로운 부작용을 도입하지 않는다 — `os.environ` 직접 변경, 전역
라이브러리 상태 오염, 임시 파일 잔존, 기존 함수 시그니처 변경 중 어느 것도 diff 전체에서 발견되지
않았다. 이번 변경이 실제로 도입하는 부작용(신규 `pnpm audit` 네트워크 호출, `harness-checks.yml`
트리거 범위 확장, `dependabot.yml` 신규 루트 등록으로 인한 GitHub 자동화 동작 변경)은 전부 plan
문서에 명시된 설계 의도와 일치하고, 각각을 겨냥한 회귀 테스트로 범위가 고정돼 있으며, 단위 테스트
스위트 자체는 네트워크·`os.environ`·PyYAML 라이브러리 전역 상태 어느 것도 오염시키지 않는다(직접
재현으로 확인). 병합을 막을 side-effect 이슈는 없다.

## 위험도

LOW
