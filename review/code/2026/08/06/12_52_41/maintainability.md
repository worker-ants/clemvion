# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** GH Actions 환경변수 딕셔너리가 같은 파일 안에서 사실상 복제됨 — 정확히 그 파일 자신이 반복 경고하는 drift 클래스
  - 위치: `.claude/tests/test_review_gate_ci.py:536-555` (`VerdictComesFromTheGateTest._HOSTILE_ENV`) 및 `.claude/tests/test_review_gate_ci.py:662-669` (`TheRealGateIgnoresTheEnvironmentTest._CI_ENV`)
  - 상세: 두 클래스가 `GITHUB_ACTIONS`/`GITHUB_ACTOR`/…/`GITHUB_WORKFLOW`/`CI`/`REVIEW_GATE_SKIP`/`BYPASS_REVIEW_GUARD` 등 13개 중 11개 키를 손으로 그대로 다시 타이핑해 정의한다. `_HOSTILE_ENV` 바로 위 주석은 "초판은 다섯 개뿐이었고 `GITHUB_WORKFLOW`/`GITHUB_JOB` 이 빠져 있어 리뷰어가 그 둘로 뚫었다"고 명시적으로 적어 두었는데, 그 교훈을 얻은 뒤에도 같은 값 집합이 파일 안에서 두 번째로 손 동기화 상태로 다시 만들어졌다. 둘 중 하나에 새 GH Actions 변수(예: 추후 라운드가 발견할 이름)를 추가해도 나머지 하나는 자동으로 따라가지 않는다.
  - 제안: 모듈 레벨 상수 하나(예: `_GH_ACTIONS_ENV`)로 합치고, `_HOSTILE_ENV`/`_CI_ENV`는 필요하면 그 상수에 각자의 우회용 키만 덧붙이는 형태(`{**_GH_ACTIONS_ENV, "REVIEW_GATE_ENFORCE": "1"}`)로 파생시킨다.

- **[WARNING]** 임시 git 저장소 픽스처(`_git`/`_write`)가 같은 파일 안에서 바이트 단위로 반복 작성됨
  - 위치: `.claude/tests/test_review_gate_ci.py:58-71` (`ReviewGateCliTest._git`/`_write`)와 `.claude/tests/test_review_gate_ci.py:686-699` (`TheRealGateIgnoresTheEnvironmentTest._git`/`_write`)가 완전히 동일한 본문. `.claude/tests/test_review_guard_hardening.py`에서도 `RebaseAuthorDateTest`(275-295), `NotesReachThePublicEntryPointTest`(588-601), 이번 라운드에 새로 추가된 `UnstagedModificationKeepsItsPathTest`(675-688) 세 클래스가 같은 ~14줄짜리 헬퍼를 각각 다시 정의한다.
  - 상세: 두 파일에서 도합 5곳이 `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM`/author-committer 환경 설정 + `subprocess.run` 호출 로직을 그대로 복제한다. 저장소는 이런 "손-동기 쌍"이 갈리는 사고(`report_paths`, `retry_state`)를 스스로 여러 번 기록해 두었는데(README·`PyYamlPinsAgreeTest` docstring 참고), 같은 형태의 복제가 테스트 픽스처 레벨에서 계속 늘고 있다. 크로스-파일 반복은 기존 관행(예: `test_bootstrap_mermaid_install.py`, `test_mermaid_lint_ready.py`도 같은 패턴)이라 파일 간 결합을 피하려는 의도적 선택일 수 있지만, **같은 파일 안**에서의 반복(`test_review_gate_ci.py`의 두 클래스, `test_review_guard_hardening.py`의 세 클래스)은 파일 간 결합 없이도 `unittest.TestCase` 믹스인 하나로 없앨 수 있다.
  - 제안: `_harness.py`(또는 각 파일 로컬)에 `_TempGitRepoMixin` 같은 공용 fixture 클래스를 두고 `_git`/`_write`를 한 번만 정의해 상속으로 재사용한다.

- **[WARNING]** 단일 테스트 메서드가 7개의 독립된 불변식을 한 번에 검증 — 이 파일의 다른 클래스들과도 스타일이 어긋남
  - 위치: `.claude/tests/test_review_gate_ci.py:265-378` (`OneJudgeTest.test_the_import_and_call_surface_stays_small`)
  - 상세: 이 메서드 하나(독스트링 포함 ~114줄)가 (1) import 허용목록, (2) 지역 별칭 정본화, (3) 호출 허용목록, (4) `getattr`로 모듈 속성을 꺼내는 우회 금지, (5) 속성 대입 금지, (6) `os.environ`류 Attribute 접근 금지, (7) `from os import environ as _E` 형태 금지, (8) `evaluate_review` 참조 여부 — 8가지 서로 다른 정적 불변식을 순차 검증한다. 같은 파일의 다른 클래스(`WorkflowWiringTest`, `TheGateItselfDoesNotBranchOnCiEnvTest`)는 성질 하나당 메서드 하나 또는 `with self.subTest(...)`로 개별 실패를 관측 가능하게 나누는데, 이 메서드의 (2)~(5) 구간은 `subTest` 없이 루프 중간에서 바로 `assertIsNotNone`/`assertIn`/`assertNotIsInstance`를 호출한다 — 앞쪽 불변식(예: 호출 허용목록)이 한 번 깨지면 뒤쪽 4개 불변식(속성 대입 금지, env 접근 금지 등)은 그 실행에서 아예 평가되지 않아 실패 원인 진단이 늦어진다.
  - 제안: 불변식별로 `test_import_surface_is_small` / `test_call_surface_is_small` / `test_no_attribute_reassignment` / `test_no_environment_access` 등으로 분리하고, 같은 파일의 `TheGateItselfDoesNotBranchOnCiEnvTest`가 이미 쓰는 `with self.subTest(...)` 패턴을 일관되게 적용한다.

- **[INFO]** 빈 줄 관례가 이 라운드에 추가된 코드에서만 어긋남
  - 위치: `.claude/tests/test_review_gate_ci.py:584` (`class TheGateItselfDoesNotBranchOnCiEnvTest`) — 파일의 다른 최상위 `class` 7개는 전부 앞에 빈 줄 2개(PEP8 관례)를 두는데 이 클래스만 1개다. `.claude/tests/test_workflow_yaml_structure.py:124-127`(`_SWALLOWS_FAILURE` 앞)·`184`(`_JOB_CONDITIONS` 앞)도 같은 클래스 안 다른 메서드 사이의 관례(빈 줄 1개)와 달리 빈 줄 2개를 쓴다.
  - 상세: 기능에는 영향이 없으나, 이 PR이 새로 추가한 부분에서만 국지적으로 관례가 흔들려 diff 를 읽을 때 "의도된 구분"인지 "실수"인지 헷갈리게 만든다.
  - 제안: 파일 기존 관례(최상위 클래스 사이 2줄, 클래스 내부 멤버 사이 1줄)에 맞춰 정리.

- **[INFO]** subprocess timeout 리터럴이 이름 없는 매직 넘버로 5회 반복
  - 위치: `.claude/tests/test_review_gate_ci.py:85, 154, 569, 780`(`timeout=120`), `713`(`timeout=180`), `764`(`timeout=60`)
  - 상세: 같은 파일 안에서 대부분 120초를 쓰지만 두 곳만 180/60으로 다르고, 그 차이가 왜 필요한지 설명하는 주석이 없다. 값 자체의 위험도는 낮지만, 반복되는 리터럴은 통일해야 할 값인지 의도적으로 다른 값인지 구분이 안 된다.
  - 제안: `_SUBPROCESS_TIMEOUT = 120` 같은 모듈 상수로 통일하고, 180/60처럼 벗어나는 값에는 그 이유를 한 줄 주석으로 남긴다.

- **[INFO]** `test_review_guard_hardening.py`는 이 PR 이전까지 전부 영어 docstring/주석이었는데, 이번에 추가된 클래스만 한국어로 전환됨
  - 위치: `.claude/tests/test_review_guard_hardening.py:652-666` (`UnstagedModificationKeepsItsPathTest` 클래스 docstring 및 메서드 docstring)
  - 상세: 이 파일의 기존 클래스(`RebaseAuthorDateTest`, `EvaluateInFlightShortCircuitTest`, `StopResolutionSuppressionTest`, `NotesReachThePublicEntryPointTest` 등)는 전부 영어 산문으로 "왜"를 설명한다(테스트 데이터로 들어가는 한국어 리터럴은 별개). 이번에 새로 추가된 클래스만 한국어 docstring/주석을 쓰면서 파일 내부에서 언어가 갈렸다. (참고로 같은 브랜치에서 새로 만들어진 `test_review_gate_ci.py`·`check-review-gate.py`·`review-gate.yml`은 한국어 위주라, 프로젝트 전체 규칙 위반은 아니고 **이 파일** 안에서의 일관성 문제다.)
  - 제안: 이 파일 안에서는 기존 관례(영어)를 유지하거나, 파일 전체를 한 언어로 통일하는 별도 결정을 내린다.

- **[INFO]** 라운드별 우회 이력 서술이 단일 출처 없이 5곳 이상에 손으로 반복 기록됨
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md`의 라운드 표, `.claude/tests/test_review_gate_ci.py`의 `OneJudgeTest`(220-235)·`WorkflowWiringTest`(380-404)·`VerdictComesFromTheGateTest`(498-512)·`TheRealGateIgnoresTheEnvironmentTest`(643-660) docstring, `.claude/tests/test_workflow_yaml_structure.py:139-149`(`test_no_guard_workflow_swallows_its_own_failure` docstring)
  - 상세: "몇 번째 라운드에 무엇으로 뚫렸는가"라는 같은 사실관계가 파일마다 조금씩 다른 표현으로 다시 서술된다. 값어치 있는 제도적 기억이긴 하지만, 이 저장소는 CLAUDE.md에서 "정보 저장 위치 단일 진실 원칙"을 명시하고 있고, 다음 라운드가 추가될 때마다 이 5곳 이상을 사람이 손으로 함께 갱신해야 한다 — 실제로 한 곳만 업데이트되고 다른 docstring의 "네 번"/"다섯 번" 카운트가 stale 해지는 실패 양상은 이 저장소가 이미 반복 지적해 온 것과 같은 종류다.
  - 제안: 정본은 `plan/in-progress/harness-review-gate-ci-backstop.md` 한 곳으로 두고, 코드 쪽 docstring은 "이 테스트가 지금 무엇을 검증하는가" 중심으로 줄이며 라운드 카운트가 필요하면 plan 문서로 링크만 남긴다. (당장 위험한 결함은 아니므로 이번 라운드에서 강제할 필요는 없다.)

## 요약

이번 라운드(8R)의 실제 프로덕션 코드 변경 — `review_guard.py`의 `_run_git` 한 줄(`.strip()` → `.rstrip()`) 수정과 신규 `scripts/check-review-gate.py` — 은 짧고, 함수가 작고, 왜 그렇게 짰는지 주석이 정확해 유지보수성 관점에서 흠잡을 데가 거의 없다. 문제는 그 주변을 둘러싼 방대한 하네스 테스트 스위트(`test_review_gate_ci.py` 823줄 신규 등) 쪽에 몰려 있다: 같은 파일 안에서 GH Actions 환경변수 딕셔너리와 git 저장소 픽스처 헬퍼가 손 동기화 상태로 반복 작성되고 있고(이 저장소 스스로가 "손-동기 쌍은 갈린다"고 여러 번 기록해 둔 바로 그 패턴), 정적 AST 스캔 테스트 하나가 7개 불변식을 한 메서드에 몰아넣어 다른 클래스들의 `subTest` 관례와 어긋난다. 이 외에는 빈 줄 관례·매직 타임아웃 상수·파일 내 언어 혼용·라운드 이력 문서 중복 같은 저위험 스타일 이슈들이다. 전체적으로 8라운드에 걸쳐 급하게 두꺼워진 방어 테스트 레이어가 스스로도 지적하는 "복제는 drift 를 부른다"는 원칙을 자기 자신에게는 아직 적용하지 못한 상태이며, 지금 정리하지 않으면 다음 라운드가 또 한 곳만 고치고 나머지를 stale 하게 남길 위험이 있다.

## 위험도

LOW
