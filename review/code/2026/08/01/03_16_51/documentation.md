# 문서화(Documentation) 리뷰 — deps-guard-hardening (4차 라운드)

## 전제: 1·2·3차 리뷰의 문서화 관련 지적사항 재검증

3차(`02_38_45`) 문서화 리뷰가 남긴 WARNING 2건 — `deps-security-checks.yml` 헤더 주석 "두 가지"
서술 · `plan/in-progress/deps-guard-hardening.md` 의 테스트 건수/서사 stale(18건→20건,
731건→739건, "두 번"→"세 번") — 을 실제 파일을 `Read`하고 하네스 스위트를 직접 실행해
재검증했다.

- `.github/workflows/deps-security-checks.yml:3` — "세 가지를 강제한다:"로 정정되고
  `override-floors` 절(11-14행)이 추가됨. `PROJECT.md:48`과 문구도 정합. **유효.**
- `plan/in-progress/deps-guard-hardening.md:110-114` — "**25건**(4축: ... + 통합 리포트·
  스키마 드리프트) ... 하네스 전체 744건 통과"로 갱신됨. `grep -c "def test_"
  .claude/tests/test_override_floors.py` = 25, `python3 -m unittest discover -s .claude/tests
  -p 'test_*.py'` 직접 실행 = **"Ran 744 tests ... OK"** — 둘 다 실측으로 정확히 일치함을
  확인했다. `test_workflow_yaml_structure.py` "6건" 서술도 `grep -c`로 일치 확인.
- `plan/in-progress/deps-guard-hardening.md:144-152` — "패키지명 추출을 **세 번** 틀렸다"로
  갱신되고 3번째 사례(체인 중간 scope, `a>@scope/b>c`)가 추가됨. **유효.**
- `plan/in-progress/deps-guard-hardening.md:216-223` — "왜 `actionlint` 대신 직접 짰나"
  Rationale 문단이 신설되어, 2차 리뷰에서 3명이 제안한 대안을 기각한 근거가 이제 기록됨
  (3차 architecture WARNING 대응). **유효.**

네 항목 모두 diff 판독이 아니라 코드/문서 직접 대조와 스위트 실행으로 확인했다. 다만 이번
라운드에서 하나의 잔여 stale 서술을 새로 발견했다 — 아래 발견사항 참조.

## 발견사항

- **[WARNING]** `.claude/tests/README.md` 의 `test_override_floors.py` 카탈로그 행이 3차례에
  걸쳐 갱신된 실제 코드 상태를 반영하지 못하고 있다 — 이 PR이 이미 두 번(라운드 2, 라운드 3)
  똑같은 성격의 "축 개수/횟수 자기모순"을 WARNING으로 다룬 바로 그 위치인데, 이번에 남은 잔여
  하나는 아직 잡히지 않았다.
  - 위치: `.claude/tests/README.md:39` (`test_override_floors.py` 행 전체) — 대조 대상은
    `.claude/tests/test_override_floors.py:1-31`(모듈 docstring) 및
    `plan/in-progress/deps-guard-hardening.md:110-114,144-152`.
  - 상세: README 행은 지금도 "it broke **twice** in development"라며 실패 사례를 정확히 2건만
    나열한다 (`>` 를 먼저 잘라 `undici@>=7.0.0` 의 `>=` 를 구분자로 오인한 것, 레인지를 먼저 떼
    scope 패키지의 `@` 를 물어버린 것). 그러나 같은 diff가 반영하는 `test_override_floors.py`
    모듈 docstring(1-31행)은 "개발 중 **세 번** 틀렸고 셋 다 증상이 같았다"며 3번째 사례
    (`a>@scope/b>c` 형태의 체인 **중간** scope 패키지 — 2차 리뷰가 발견)를 명시하고, 이는
    `OverrideTargetExtractionTest.test_scope_package_in_the_middle_of_a_chain`
    (`test_override_floors.py:176`)으로 회귀 테스트까지 갖췄다. `plan/in-progress/
    deps-guard-hardening.md:144-152`도 이미 "세 번"과 3개 사례로 정확히 정정돼 있다 — 즉
    **세 문서 중 README 카탈로그만** 옛 "두 번" 서술에 머물러 있다.
    같은 행은 "Four axes."로 시작해 Key extraction/Classification(+`MultipleMatchTest`)/
    Suppressed-path baseline/Fail-closed 네 가지만 나열하는데, 실제 파일에는 이번 라운드(3차
    조치, 커밋 `99f6110c0`)에서 신설된 `CombinedReportTest`(위험도 조기 return 회귀 방지,
    `:278`)와 `SchemaDriftTest`(pnpm audit 하위 필드명 드리프트 fail-closed, `:305`) 두 클래스가
    더 있는데(총 7개 테스트 클래스), 이 둘은 README 행에 전혀 언급이 없다.
    `plan/in-progress/deps-guard-hardening.md:110-111`은 이 둘을 "4축" 과 별개로
    "+ 통합 리포트·스키마 드리프트"라고 명시적으로 부기해 두었으므로 "축을 6개로 재번호화하라"는
    뜻은 아니지만(설계 의도상 이 둘은 "축"이 아니라 보강 회귀로 다뤄짐), 카탈로그 행이 존재
    자체를 언급하지 않는 것은 다른 행(예: `test_dependabot_npm_coverage.py` 행,
    `.claude/tests/README.md:38`은 워크스페이스-루트 예외와 그 회귀 테스트 2건을 정확히
    설명한다)과 비교해도 관리 수준이 떨어진다. `test_tests_readme_catalog.py`
    (`test_every_test_file_is_documented`)는 파일당 행의 **존재**만 검사하고 행의 **내용**은
    검사하지 않으므로, 이 클래스의 drift는 어떤 하네스 가드로도 구조적으로 못 잡는다(직접
    `grep -n "def test_\|class "` 로 확인) — 사람/LLM 리뷰가 유일한 방어선이다.
  - 제안: `.claude/tests/README.md:39`의 "it broke twice in development ( ... )"를 "broke three
    times"로 바꾸고 세 번째 사례(`a>@scope/b>c` 형태의 체인 중간 scope 패키지)를 괄호 목록에
    추가할 것. 동시에 `CombinedReportTest`(widened/eroded 동시 보고 회귀 방지)와
    `SchemaDriftTest`(pnpm audit 하위 필드명 변경 시 판단 불가 처리)에 대한 한두 문장을 행에
    보강해, 이 파일이 실제로 7개 클래스로 구성돼 있음을 카탈로그에서도 알 수 있게 할 것 —
    "축" 번호를 다시 매길 필요는 없다(plan 문서가 이미 이 둘을 별개 보강으로 구분해 뒀다).

## 참고 (INFO)

- **[INFO]** (긍정 관측) `review/code/2026/08/01/{01_12_24,01_56_46,02_38_45}/**`(이번 diff에
  신규 파일로 포함된 과거 3개 라운드 산출물)는 CLAUDE.md 정보 저장 규약상 코드 리뷰 산출물의
  불변 스냅샷이며, 3차 문서화 리뷰가 이미 이 원칙을 명시했다(review/ 는 갱신 대상 아님). 이번
  라운드도 그 판단을 유지해 스냅샷 내부 수치("739건"/"731건" 등, 각 라운드 시점의 실측)를
  현재 상태와 대조해 "고치라"고 요구하지 않았다 — 살아있는 문서(`README.md`,
  `plan/in-progress/*.md`, `PROJECT.md`, 워크플로 주석)만 점검 대상으로 삼았다.
- **[INFO]** (긍정 관측) 신규 스크립트·테스트·YAML 주석의 문서화 수준은 이례적으로 높고, 실제
  구현과 정확히 일치함을 직접 실행으로 재확인했다. `scripts/check-override-floors.py`의
  `_undecidable()`(신규 헬퍼, `:125`)·`classify_vulnerable()`의 스키마 드리프트 방어(`:212-227`,
  3차 architecture WARNING에 대한 정확한 대응) 독스트링은 실제 분기 로직과 일치한다.
  `.claude/tests/test_override_floors.py`의 `_PNPM_STUB`(고정 소스 + 환경변수로 payload 전달,
  `:50-60`) 리팩터는 3차 maintainability WARNING("가짜 pnpm 스크립트를 f-string으로 동적
  조립")과 3차 security INFO(JSON true/false/null이 파이썬 소스에 raw 삽입되는 위험)를 정확히
  겨냥해 고쳤고, 그 이유를 주석에 남겼다.
- **[INFO]** `.github/workflows/harness-checks.yml`의 `paths:` 확장 주석(41-51행,
  `.github/workflows/**`로 넓힌 이유를 (a)(b) 두 갈래로 설명)과 `.claude/tests/
  test_harness_checks_paths_coverage.py`의 `KNOWN_COVERAGE_DEPENDENCIES` 갱신 주석(103-105행)이
  서로 정확히 대응하며, `.github/dependabot.yml`의 신규 루트 등록 주석(24-41행)도 §3 plan 서술과
  1:1로 일치함을 확인했다 — 새로 추가된 설정/CI 항목 중 문서화 누락은 이 셋 외에는 발견되지
  않았다.

## 요약

1·2·3차 리뷰가 지적한 문서화 항목(YAML 구조 손상, "세 축/네 축" 자기모순, `PROJECT.md`/
`deps-security-checks.yml` 헤더의 3번째 잡 누락, plan 체크리스트의 테스트 건수·개발 서사
stale, `actionlint` 기각 근거 미기록)은 이번 라운드에서 실행·직접 대조로 재검증한 결과 전부
해소돼 있다 — `python3 -m unittest discover`로 744/744 전체 PASS, `grep -c`로 테스트 건수 일치,
관련 파일을 `Read`로 직접 열어 대조 완료. 다만 정확히 같은 클래스의 잔여 하나가 새로 발견됐다
— `.claude/tests/README.md`의 `test_override_floors.py` 카탈로그 행이 여전히 "개발 중 두 번
틀렸다"는 옛 서술과 "Four axes"만 나열하고 있어, 이미 세 번(다른 두 문서에서는 정정된)으로
확정된 개발 서사, 그리고 이번 라운드에 신설된 `CombinedReportTest`/`SchemaDriftTest` 두 테스트
클래스를 반영하지 못한다. 이는 CI를 막거나 기능에 영향을 주지 않는 비차단성 문서 drift이고,
`test_tests_readme_catalog.py`가 행의 존재만 검사해 내용 정확성은 어떤 자동 가드로도 잡히지
않는 사각지대라는 점에서 이번에 명시적으로 기록해 둔다. 그 외 신규 코드(스크립트·테스트·CI
YAML·의존성 설정)의 독스트링·인라인 주석은 실제 동작과 정확히 일치하며 문서화 수준이 높다.

## 위험도

LOW — 병합을 차단하거나 기능/보안에 영향을 주는 문서화 결함은 없다. 유일한 WARNING은 내부
개발자용 테스트 카탈로그(`README.md`)의 서술이 diff 내 최신 코드 상태를 완전히 반영하지 못한
비차단성 drift이며, 이 PR이 이미 세 라운드에 걸쳐 성실히 조치해 온 것과 동일한 클래스의 잔여
1건이다.
