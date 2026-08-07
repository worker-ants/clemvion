# 테스트(Testing) 리뷰 — `codebase/packages/*/prepare` 계약 통일 + CI 배선

## 발견사항

- **[WARNING]** `tsc` 컴파일 실패가 실제로 전파되는지 검증하는 테스트가 없다
  - 위치: `.claude/tests/test_packages_prepare_contract.py:24-25` (계약 문서화: "typescript resolvable → run tsc ALWAYS ... a compile error propagates") / 검증 누락 지점은 `PrepareBranchBehaviourTest` 클래스(102-169줄), 특히 스텁 정의 125-127줄과 `test_typescript_present_always_compiles_even_when_dist_exists`(147-151줄)
  - 상세: 신규 계약(3갈래: compile / no-op / throw)의 docstring은 "typescript resolvable → run tsc ALWAYS (stale dist is rebuilt; **a compile error propagates**)" 를 명시적으로 약속한다. 그런데 `_run()` 헬퍼가 만드는 가짜 `tsc` 스텁(125-127줄, `#!/bin/sh\necho x >> {called}\nexit 0\n`)은 **항상 exit 0**이다. 4개 조합(typescript×dist) 테스트 전부 "tsc 가 호출됐는가"만 관측하고, "tsc 가 실패했을 때 `prepare` 전체가 실패로 전파되는가"는 어느 테스트도 실행하지 않는다. 실제 프로덕션 스크립트(`node -e "...if(ts){c.execSync('tsc',{stdio:'inherit'})}..."`)에서 `execSync` 호출이 try/catch 밖에 있어 tsc 비정상 종료 시 uncaught exception → node 비정상 종료로 이어지는 설계는 맞아 보이지만, 이 refactor 의 핵심 동기가 "조용한 성공을 막는다"(구버전 버그: `[ -d dist ] || tsc` 가 stale dist 를 조용히 통과시킴)이므로, 그 반대 극단인 "컴파일 에러가 조용히 삼켜지지 않는다"는 이 계약에서 가장 안전-critical 한 속성인데 무테스트로 남아 있다.
  - 제안: `_run()` 에 tsc 스텁이 실패하도록 하는 파라미터(예: `tsc_fails: bool`)를 추가하고, `typescript=True, tsc_fails=True` 조합에서 `p.returncode != 0` 을 단언하는 회귀 테스트를 하나 추가한다.

- **[INFO]** `codebase/packages/*/package.json` 트리거 등록을 지키는 자동 가드가 없다
  - 위치: `.github/workflows/harness-checks.yml:69` (`- 'codebase/packages/*/package.json'`)
  - 상세: 새 테스트(`test_packages_prepare_contract.py`)가 실제로 발동하려면 이 paths 항목이 `harness-checks.yml`에 남아 있어야 하는데, README 관례상 `test_harness_checks_paths_coverage.py`는 "module-level `ROOT / "a" / "b"` 상수"만 자동 추출하고 "product paths(`codebase/`, `spec/`, ...)는 제외"라고 명시하므로, `test_packages_prepare_contract.py` 안의 `PACKAGES_DIR = REPO_ROOT / "codebase" / "packages"` 상수는 그 자동 커버리지 검사 대상에서 애초에 제외된다. 즉 이 항목은 순전히 수동 등재이고, 향후 누군가 `.github/workflows/harness-checks.yml`을 편집하다 이 줄을 실수로 지워도 잡아낼 테스트가 없다. 다만 이는 `scripts/report_playwright_flaky.py` 등 기존 수동 등재 항목들과 동일한 패턴이라 이 diff 가 새로 만든 문제는 아니다.
  - 제안: 우선순위 낮음 — 기존 관례를 따른 것이므로 지금 당장 조치는 불필요. 다만 이 패턴(스크립트/매니페스트 트리거를 수동 코멘트로만 고정)이 계속 누적되면 `test_harness_checks_paths_coverage.py`의 module-level-constant 스코프를 확장하는 별도 백로그 항목으로 고려할 만하다.

- **[INFO]** `PrepareBranchBehaviourTest.setUpClass`가 빈 목록일 때 불친절한 실패를 낸다
  - 위치: `.claude/tests/test_packages_prepare_contract.py:112` (`cls.prepare = sorted(prepares)[0]`)
  - 상세: `prepares` 집합이 비면(예: 향후 리팩터로 모든 패키지의 `prepare` 스크립트가 사라지는 회귀가 생기면) `sorted(prepares)[0]`이 `IndexError`를 던져 `setUpClass` 자체가 에러로 죽는다. `PrepareIsUniformTest.test_every_package_that_builds_uses_the_same_prepare`가 이미 같은 상황을 명시적 메시지("prepare 를 가진 패키지가 너무 적다")로 잡아주므로 실전 진단력은 있지만, `PrepareBranchBehaviourTest` 쪽 실패 메시지는 스택트레이스뿐이라 원인 파악이 한 단계 더 걸린다.
  - 제안: `setUpClass`에 `assertTrue(prepares, ...)` 성격의 명시적 가드(또는 `unittest.SkipTest`)를 추가해 실패 메시지를 명확히 한다. 낮은 우선순위.

## 요약

새 테스트 파일 `test_packages_prepare_contract.py`는 이번 변경의 핵심 리스크(패키지별 `prepare` 스크립트가 stale `dist`를 조용히 통과시키는 문제)를 문자열 비교가 아니라 **실제 서브프로세스 실행으로 4개 조합(typescript 유무 × dist 유무) 전부를 행위 검증**하는 방식으로 잘 다뤘다 — 가짜 `tsc` 바이너리를 PATH 에 심어 실제 프로덕션 스크립트 문자열(`package.json`에서 파싱한 것 그대로)을 `sh -c`로 돌리는 설계는 테스트-구현 간 문자열 중복을 피하면서도 진짜 셸/노드 의미론을 검증해 견고하다. 격리(각 테스트가 독립 `tempfile.TemporaryDirectory()` 사용, 환경변수 복사)와 가독성(테스트명 + 한국어 인라인 주석)도 양호하다. 다만 이 계약이 명시적으로 약속한 세 갈래 중 "컴파일 실패가 조용히 삼켜지지 않고 전파된다"는 속성 — 리팩터의 안전성 논거에서 가장 중요한 축 중 하나 — 은 스텁이 항상 성공하도록 고정돼 있어 어떤 테스트도 실행하지 않는다. 이 외에는 CI 트리거 등록·클래스 셋업 실패 메시지 정도의 경미한 개선 여지만 남아 있다.

## 위험도
LOW
