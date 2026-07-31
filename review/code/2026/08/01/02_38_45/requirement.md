# 요구사항(Requirement) 리뷰 — deps-guard-hardening (3차)

## 전제: 1·2차 리뷰 조치 재검증 방법

이 diff 는 1차(`01_12_24`, Critical 4 + Warning 4)와 2차(`01_56_46`, Critical 1 + Warning 8 + INFO
다수) 리뷰의 조치 결과물이다. diff 만 읽지 않고 각 파일을 `Read` 로 직접 열고, 관련 테스트를
`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`(전체, 739건) 및
`-p 'test_override_floors.py'`(20건, `-v` 개별 확인)로 실행하고, `.github/workflows/*.yml` 전체를
`yaml.safe_load()` 로 직접 파싱해 스텝 구조를 재확인하고, **실제로 `pnpm audit --audit-level=moderate
--json` 을 이 저장소에서 실행**하고 `python3 scripts/check-override-floors.py` 를 직접 실행해
재검증했다.

결과: 2차 리뷰가 지적한 CRITICAL 1건(YAML 중복 키로 PyYAML 설치 소실) + WARNING 8건(축 개수
서술·중간 scope 체인 버그·widened/eroded 통합 리포트·테스트 헬퍼 self 공유·PROJECT.md 3번째 잡
누락·stdlib 전용 서술 모순·dependabot 카탈로그 행·— 및 1차 리뷰 항목들) 전부 코드 레벨에서
실제로 해소됨을 확인했다. 상세는 아래 "재검증 상세" 참조. 이번 라운드에서 새로 발견한 것은
WARNING 1건(plan 문서 자체 서술 오기, 논리적으로 이번 diff 가 만든 것)과 INFO 2건뿐이다.

## 발견사항

- **[WARNING]** plan 체크리스트가 회귀 테스트 건수를 실제보다 적게(18건) 서술한다 — 그 서술을
  적은 바로 그 커밋이 테스트를 2건 더 추가해 서술을 즉시 낡게 만들었다.
  - 위치: `plan/in-progress/deps-guard-hardening.md:110-111`
  - 상세: 해당 줄은 "`.claude/tests/test_override_floors.py` **18건**(4축: ...) ... 하네스 전체
    스위트 731건 통과"라고 적는다. 그러나 `grep -c "def test_" .claude/tests/test_override_floors.py`
    는 현재 **20**을 반환한다(`OverrideTargetExtractionTest` 9 + `ClassificationTest` 4 +
    `SuppressedPathBaselineTest` 2 + `FailClosedTest` 4 + `MultipleMatchTest` 1). `git show
    c019a3e1b -- plan/in-progress/deps-guard-hardening.md` 로 확인하면 이 줄은 "11건" →
    "**18건**"으로 c019a3e1b 커밋 안에서 직접 정정됐는데, **같은 커밋**이 동시에
    `test_scope_package_in_the_middle_of_a_chain`·`test_missing_workspace_file_is_undecidable`
    두 테스트를 추가해(`git show c019a3e1b -- .claude/tests/test_override_floors.py | grep
    '^\+.*def test_'`) 실제 건수를 20으로 올렸다 — 즉 "18건"이라는 정정 자체가 같은 diff 안에서
    이미 stale 해졌다. "하네스 전체 스위트 731건"도 마찬가지로 c019a3e1b 이전(969f7ac0d 시점)
    상태에는 맞지만, 같은 커밋이 `test_workflow_yaml_structure.py`(6개 테스트)를 신설해 현재
    전체 스위트는 739건이다(`python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 로
    직접 실행해 확인, `Ran 739 tests ... OK`). 기능에는 영향 없는 순수 서술 오차이지만, 이
    저장소가 바로 이번 PR 안에서 거의 동일한 클래스("세 축" vs 실제 4축, 2차 리뷰 WARNING #2)를
    이미 CRITICAL 급 취급으로 정정한 이력이 있어 같은 결의 재발이다. TEST WORKFLOW(3차) 항목
    (같은 파일, 아직 미커밋 상태의 로컬 편집분)이 "하네스 739 OK"라고 별도로 적어, 같은 문서
    안에서 "731"과 "739"가 서로 다른 시점 스냅샷인지 현재 상태인지 구분 없이 공존하게 된다.
  - 제안: `plan/in-progress/deps-guard-hardening.md:110-111` 의 "18건"을 "20건"으로, "731건"을
    (그 줄이 "현재 상태" 요약이라면) "739건"으로 정정하거나, 혹은 그 줄이 특정 라운드 시점의
    스냅샷이라는 것을 명확히 하려면 다른 TEST WORKFLOW 항목들처럼 라운드 번호를 명시할 것.

- **[INFO]** `.github/dependabot.yml` 루트 등록의 `rebase-strategy: "auto"` 가 §3 이 막으려던
  정확한 재발 시나리오(#1029/#1030, 구 base 에서 생성된 PR 이 최신 보안 bump 를 되돌림)를 실제로
  방지하는지는 이 환경에서 검증 불가능하다 — 다만 plan 자신이 이 한계를 이미 인지하고 있다.
  - 위치: `.github/dependabot.yml:35-37`
  - 상세: 주석 자체가 "`rebase-strategy: auto` 는 기본값이지만 ... 의도를 명시적으로 남긴다"고
    적어, 이 등록이 default 동작을 바꾸는 것이 아니라 의도 문서화에 가깝다는 점을 스스로
    인정한다. `git log`로 확인한 실제 사고(#1029/#1030/#1032)는 모두 "in the / directory"로
    생성됐지만 이 저장소의 `.github/dependabot.yml` 에는 그 시점에 `/` 항목이 아예 없었다 — 즉
    그 PR들은 `dependabot.yml` 의 `updates:` 목록이 아니라 repo Settings 의 **security updates**
    (스키마 밖 토글)에서 나온 것이었다(plan 서술과 일치). 새로 등록한 `/` npm 항목은 **주간
    스케줄의 버전 업데이트**용이라 성격이 다르고, GitHub 문서상 security update PR 이 매칭되는
    `updates:` 항목의 설정(예: `rebase-strategy`)을 상속하는지는 이 오프라인 환경에서 실측할 수
    없다. 다만 plan 의 Rationale 이 이미 "왜 §3 은 required check 를 못 넣었나"와 "남은 수동
    조치" 절에서 이 잔여 위험(branch protection required check 승격 필요)을 명시적으로 인지하고
    후속으로 남겼으므로, 은폐된 갭이 아니라 **투명하게 추적되는 P2 잔여 리스크**다. 조치 불요 —
    참고용 기록.

- **[INFO]** spec fidelity — `spec/` 전체에 override 침식 검출·dependabot·`ignoreCves`·pnpm audit
  거버넌스 관련 문서가 없음을 `grep -rli`로 재확인했다. `plan/in-progress/deps-guard-hardening.md`
  frontmatter 의 `spec_impact: none`(CI·스크립트·설정 전용 변경, 제품 명세 무관)과 일치하며, 관련
  spec 문서 부재도 그 선언과 정합적이다. 조치 불요.

## 재검증 상세 (1·2차 지적 사항 — 전부 코드 레벨로 확인)

- **YAML 중복 키(2차 CRITICAL)** — `harness-checks.yml`·`deps-security-checks.yml` 전체를
  `yaml.safe_load()` 로 파싱해 모든 스텝이 `run`/`uses` 를 정확히 하나씩만 가짐을 직접 확인했다
  (`harness-checks.yml` unittest 잡: `Install PyYAML`(`run`)과 `Run harness unit tests`(`run`)가
  이제 분리된 별도 스텝). 신설 `test_workflow_yaml_structure.py` 6건도 실행해 PASS 확인.
- **`override_target()` 다단 체인·중간 scope 버그(1차 Warning, 2차 Warning)** — `chain_segments()`
  로 재설계되어 `override_target("a>@scope/b>c")` 등 중간 scope 케이스까지 문자 단위 lookback
  으로 옳게 처리됨을 로직 추적 + `OverrideTargetExtractionTest`(9건, 전부 PASS)로 확인.
- **`ignoreCves` 전역 억제 사각(1차 CRITICAL)** — 실제 `pnpm audit --audit-level=moderate --json`
  을 이 저장소에서 실행한 결과 `actions[]` 에 `brace-expansion` 하나만 남고 그 `resolves[].path`
  가 `EXPECTED_SUPPRESSED_PATHS["brace-expansion"]` 과 정확히 일치함을 확인했다(`python3
  scripts/check-override-floors.py` → exit 0, "override 대상 26개 패키지 중 취약 재유입 0건").
- **widened/eroded 조기 반환(2차 INFO)** — 현재 `main()` 은 두 리스트를 모두 계산한 뒤 "둘 다
  계산한 뒤 한 번에 보고한다" 주석과 함께 통합 보고하도록 재구성됨을 확인.
- **"세 축"/"Three axes" 자기모순(2차 Warning)** — `test_override_floors.py:7`은 "네 축", `README.md:39`
  는 "Four axes"로 정정됨.
- **테스트 헬퍼 self 공유(2차 Warning)** — `run_with_stub_audit` 가 모듈 레벨 함수로 승격되어 4개
  클래스 전부 `self` 없이 직접 호출.
- **CI 등재 3건(1차 Critical)** — `harness-checks.yml`(`scripts/check-override-floors.py` +
  `.github/workflows/**`), `.claude/tests/README.md` 카탈로그, `dependabot.yml` 루트 예외
  (`test_workspace_root_stays_registered`/`test_root_exception_does_not_admit_workspace_members`)
  모두 확인, 관련 가드 전부 PASS.
- **PROJECT.md 3번째 잡 누락(2차 Warning)** — `PROJECT.md`에 "(3) `scripts/check-override-floors.py`
  로..." 절 추가 확인.
- **`reported` 타입 안전성(2차 INFO)** — `str(adv.get("github_advisory_id") or adv.get("id") or
  name)` 로 명시 캐스팅됨.
- **워크스페이스 파일 부재 미테스트(1·2차 INFO)** — `FailClosedTest.test_missing_workspace_file_is_undecidable`
  신설로 해소.
- 전체 하네스 스위트 739건 재실행 결과 `OK`(실패 0), `test_override_floors.py` 20건 개별 실행도
  전부 `ok`.
- TODO/FIXME/HACK/XXX 주석은 신규 파일(`scripts/check-override-floors.py`,
  `.claude/tests/test_override_floors.py`, `.claude/tests/test_workflow_yaml_structure.py`,
  `.github/dependabot.yml`, `.github/workflows/*.yml`, `pnpm-workspace.yaml`)에 없음을 확인.

## 요약

1·2차 리뷰가 지적한 CRITICAL 5건·WARNING 다수(YAML 구조 파손, `ignoreCves` 전역 억제 사각,
CI 배선 누락 3건, `override_target` 다단/중간 scope 버그, 축 개수 자기모순, 리포트 조기 반환,
테스트 헬퍼 구조, 문서 누락 등)를 diff 재독이 아니라 코드 직접 실행(`pnpm audit` 실호출 포함)으로
전부 재검증했고, 예외 없이 실제로 해소돼 있음을 확인했다. `check-override-floors.py`·
`test_override_floors.py`·`test_workflow_yaml_structure.py`·CI 배선(`harness-checks.yml`,
`deps-security-checks.yml`)은 기능·에러 시나리오(fail-closed 4형태)·엣지 케이스(스코프 패키지·
다단 체인·다건 동시 매칭)를 의도대로 구현하고 있으며, 관련 spec 문서가 존재하지 않아(확인됨)
spec fidelity 위반도 없다(`spec_impact: none`과 일치). 이번 라운드에서 새로 발견한 것은 plan
체크리스트 자체의 테스트 건수 서술 오기(18건 실제 20건 — 정정 커밋이 스스로 만든 stale) 하나뿐이며,
이는 코드/CI 기능에 영향이 없는 순수 문서 서술 문제다. dependabot rebase-strategy 의 실제 효력은
검증 불가능하지만 plan 이 이미 투명하게 잔여 리스크로 추적 중이라 은폐된 갭이 아니다.

## 위험도

LOW
