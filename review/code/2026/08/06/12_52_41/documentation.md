# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `.claude/tests/README.md`의 `test_review_gate_ci.py` 카탈로그 행이
  라운드 5~7에서 추가된 핵심 테스트 클래스 4개를 전혀 언급하지 않아 stale하다.
  - 위치: `.claude/tests/README.md:48`
  - 상세: 이 행은 "Four properties pinned." 이후 `OneJudgeTest` / `WorkflowWiringTest` /
    `VerdictComesFromTheGateTest`만 서술한다. 그러나 실제 `test_review_gate_ci.py`에는
    이후 라운드에서 추가된 `TheGateItselfDoesNotBranchOnCiEnvTest`(env 등재제, 6R),
    `TheRealGateIgnoresTheEnvironmentTest`(실물 게이트 이중판정 비교, 7R —
    커밋 메시지가 "이번 라운드의 실제 수확"으로 꼽은 바로 그 가드),
    `ReviewArtifactsStayTrackedTest`(이 백스톱 전체가 서 있는 전제 가드),
    `PyYamlPinsAgreeTest`(pyyaml pin 드리프트 가드)가 존재하는데 README 행 어디에도
    이름이 등장하지 않는다. `test_tests_readme_catalog.py`는 "행이 존재하는 파일명"만
    검증하고(`_ROW` 정규식으로 파일명만 추출) 행 **내용**이 최신 클래스 구성을 반영하는지는
    검증하지 않으므로, 이 drift는 기계적으로 잡히지 않는다. README 자신이 "the only place
    that says WHAT each harness test guards"(`test_tests_readme_catalog.py` 모듈
    docstring)라고 선언하는 문서이고, 이 저장소는 "손-동기 쌍은 드리프트한다"를 여러 차례
    스스로 기록해 둔 바로 그 클래스의 재발이다.
  - 제안: `test_review_gate_ci.py` 행에 (최소한) `TheRealGateIgnoresTheEnvironmentTest`
    (실물 게이트를 최소/적대적 환경 두 번 판정해 결과 동일성 확인 — 3회째 뚫린 정적 스캔을
    대체한 핵심 가드)와 `ReviewArtifactsStayTrackedTest`(이 백스톱이 서 있는 전제)를 최소
    한 문장씩 추가한다.

- **[WARNING]** 새로 추가된 테스트 클래스의 docstring이 존재하지 않는 함수명을 인용한다.
  - 위치: `.claude/tests/test_review_guard_hardening.py:663`
  - 상세: `UnstagedModificationKeepsItsPathTest` 클래스 docstring이 "헬퍼가 아니라 실제
    저장소를 만들어 `_changed_code_files` 까지 구동한다"고 적었으나, `review_guard.py`에
    `_changed_code_files`라는 이름의 함수는 존재하지 않는다(전체 저장소 grep 0건). 실제로
    이 테스트가 구동하는 함수는 `rg._uncommitted_code_changes()`와 `rg._dirty_set()`이다
    (같은 파일 690~695행에서 실제로 호출). 라운드 7에서 신규 작성된 코드인데도 14명 리뷰
    라운드를 거치며 잡히지 않은 것으로 보인다.
  - 제안: `_changed_code_files`를 `_uncommitted_code_changes`(및 `_dirty_set`)로 정정.

- **[WARNING]** `review-gate.yml`의 신규 `Fetch base ref` 스텝 주석이 merge-base를
  실제로 계산하는 함수가 아닌 다른 함수를 지목한다.
  - 위치: `.github/workflows/review-gate.yml:63`
  - 상세: 주석은 "base ref 가 origin/<base> 로 해석돼야 `_default_branch()` 가
    merge-base 를 찾는다"고 적었다. 그러나 `review_guard.py`의 `_default_branch()`는
    `origin/HEAD` 심볼릭 링크 또는 `refs/heads/{main,master}`를 조회해 **브랜치 이름
    문자열**만 반환할 뿐 merge-base 연산을 하지 않는다(`.claude/hooks/_lib/review_guard.py:239-252`).
    실제로 `f"origin/{default_branch}"`를 우선 시도해 `git merge-base`를 호출하는 함수는
    `_merge_base()`이다(`.claude/hooks/_lib/review_guard.py:255-262`). 즉 "Fetch base ref"
    스텝이 실제로 지원하는 것은 `_merge_base()`의 `origin/<default>` 우선 조회 경로이지
    `_default_branch()`가 아니다. 기능에는 영향이 없지만, 향후 이 스텝의 필요성을 재검토할
    사람(plan 문서 자신이 "GH Actions 러너 없이 실측 못 함"이라 밝힌 열린 질문)이 잘못된
    함수를 추적하게 만든다.
  - 제안: `_default_branch()` → `_merge_base()`로 정정.

- **[INFO]** `PyYamlPinsAgreeTest` docstring의 "세 워크플로" 표현이 실제 파일 수와
  어긋난다.
  - 위치: `.claude/tests/test_review_gate_ci.py:797`
  - 상세: "단일 진실화(`constraints.txt`)가 더 낫지만 그건 **세 워크플로**의 설치 방식을
    바꾸는 일이라 범위 밖이다"라고 적었다. 그러나 실측(`grep -rln pyyaml .github/workflows`)
    하면 pyyaml을 pin하는 워크플로 **파일**은 `deps-security-checks.yml`·`harness-checks.yml`
    2개뿐이다(같은 파일의 클래스 docstring 791행이 말하는 "세 곳"은 `deps-security-checks.yml`
    안의 두 job(`config-guard`, `override-floors`) + `harness-checks.yml` 한 곳 = 설치
    **지점** 3곳을 가리키는 것으로 보이며 이는 정확하다). 다만 797행의 "세 워크플로"는
    "워크플로 파일 3개"로 읽혀 791행의 "설치 지점 3곳(파일 2개)"과 표현이 어긋난다.
    기능·테스트 정확성에는 영향 없는 표현상의 사소한 불일치.
  - 제안: "세 워크플로" → "이 세 설치 지점"처럼 지점(occurrence) 기준임을 명확히 하거나,
    두 표현을 동일 단위(파일 vs 지점)로 통일.

## 요약

이번 라운드(CI 백스톱 7R)의 실질 코드 변경은 작지만(`_run_git`의 `.strip()`→`.rstrip()`
한 줄 + 행위 기반 회귀 테스트 3개 + docstring 정정 1건) 그 하나하나가 매우 상세하고
근거(실측 수치·라운드별 우회 이력·정확한 재현 절차)를 갖춘 주석/docstring으로 뒷받침되어
있어 전반적인 문서화 수준은 높다. `test_workflow_yaml_structure.py`의 "Two invariants" →
개수 비의존 문구 정정은 이 PR이 스스로 문서 드리프트 패턴을 인지하고 선제 수정한 좋은 예다.
다만 같은 취약점이 이번에도 재발했다: (1) README의 "what's covered" 카탈로그가 여러
라운드에 걸쳐 추가된 핵심 테스트 클래스를 반영하지 못해 stale하고, (2) 신규 테스트
docstring 하나가 존재하지 않는 함수명을 인용하며, (3) 신규 워크플로 주석 하나가 merge-base
연산 주체를 잘못 지목한다. 셋 다 기능적 결함은 아니며 코드 자체의 정확성에는 영향이 없지만,
이 저장소가 "댓글/문서를 곧이곧대로 믿다가 여러 번 비용을 치렀다"는 교훈을 반복 기록하고
있다는 점에서 사소하게 넘기기보다 다음 라운드에서 함께 정정할 가치가 있다.

## 위험도

LOW
