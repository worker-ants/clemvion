# 테스트(Testing) 리뷰

## 개요

이번 diff(`scripts/_typecheck_ratchet.py` 공유 코어 + `check-{backend,frontend}-typecheck-ratchet.py`
+ frontend 전용 `tsconfig.typecheck.json` + `jest-axe.d.ts`/`vitest-matchers.d.ts` 모듈 경계 수정 +
CI 워크플로/harness pathspec 등재)는 이미 같은 PR 안에서 **2 라운드의 코드 리뷰**
(`review/code/2026/09/02/11_27_26/**`, `review/code/2026/09/02/15_04_04/**`)를 거쳤고, 두 라운드의
testing 관점 Critical/Warning(파서의 route-group 파싱 실패, 코어 이중 로드로 인한 무증거 배선,
`run_tsc()`의 "진단 있는 정상 실패" 분기 무증거, 게이트 자기 자신의 pathspec 미등재)이 전부 조치돼
있다. 이번 라운드에서는 그 조치가 실제로 반영·유효한지 직접 실행/재현으로 재검증했다.

## 직접 검증한 것

- `.claude/tests/test_typecheck_ratchet.py` 36개 테스트 전부 GREEN(0.009s). `EntrypointWiringTest`
  가 `CONFIGS[label]`이 `CORE.RatchetConfig`의 인스턴스임을 확인하고(코어 이중 로드 재발 여부),
  `RunTscFailClosedTest.test_nonzero_exit_with_diagnostics_is_the_normal_path`가 "진단 있는 정상
  실패" 분기를 실제로 태우는지 확인 — 둘 다 실제로 존재하고 통과한다.
- `.claude/tests/test_workflow_run_inputs_covered.py` 3개 테스트 GREEN. 자기 자신의 `changes`
  잡 판별이 9개 워크플로(backend/deps-security/frontend/harness/migration/packages/repo-guards/
  spec-link/web-chat)를 찾아내 `test_at_least_one_workflow_is_examined`(임계값 3)이 vacuous 하지
  않음을 확인.
- `DIAGNOSTIC` 정규식(`scripts/_typecheck_ratchet.py:49-51`)에 대해 별도로 pathological 입력
  (parens 5만개 연속, `(11,22): error T` 4만회 반복 등)을 넣어 벤치마크 — 선형 시간(수 ms)
  이며 파국적 backtracking 없음을 확인(이 저장소가 과거 ReDoS 오판·실증 사고를 겪은 이력이 있어
  `.*?` 도입 자체를 별도로 점검했다).
- `_PATH_TOKEN` 추출 정규식(`.claude/tests/test_workflow_run_inputs_covered.py:45`)을 여러
  실전형 입력(트레일링 구두점·따옴표·세미콜론·`python3 -m scripts.foo` 같은 dotted-module
  오탐 후보)으로 별도 실행해 오탐/누락 없음을 확인.
- `.claude/tests/test_review_guard_hardening.py`의 `TempRepoFixturesGoThroughTheSharedHelperTest`
  3개 테스트 GREEN — 신규 `test_workflow_run_inputs_covered.py`가 `REPO_ROOT`로 `git ls-files`를
  부르는 이유가 레지스트리에 등재돼 있고, 등재가 빠지면 `test_every_temp_repo_git_call_pins_dir_and_ceiling`
  이 잡는 구조임을 확인.
- `test_workflow_yaml_structure`/`test_harness_checks_paths_coverage`/`test_required_check_skip_jobs`
  56개 테스트 GREEN — 이번 diff가 건드린 레지스트리(`typecheck-ratchet` gating 문자열, harness
  pathspec)에 회귀 없음.
- `git status --short`로 저장소에 잔여 뮤테이션 없음 확인(테스트 실행은 전부 `tempfile`
  임시 디렉터리에만 기록).

## 발견사항

- **[INFO]** `test_typecheck_ratchet.py`의 여러 테스트가 `Path(tempfile.mkdtemp())`로 만든 임시
  baseline 디렉터리를 `tearDown`/`addCleanup` 없이 남긴다.
  - 위치: `.claude/tests/test_typecheck_ratchet.py` — `VerdictTest.run_main`(:167),
    `FailClosedTest.call_load`(:202), `RunTscFailClosedTest`의 `expect_exit_2`(:237)·
    `test_clean_run_returns_empty_output`(:265)·`test_tsc_is_invoked_with_the_configured_tsconfig`(:295),
    `UpdateBaselineTest`의 두 테스트(:319, :341).
  - 상세: 삭제된 구 `test_backend_typecheck_ratchet.py`에도 있던 기존 스타일이고, 1라운드
    testing 리뷰가 이미 지적한 뒤 "우선순위 낮음"으로 미조치 판정됐다(`RESOLUTION.md` 1R·2R
    양쪽 모두 확인). 이번 라운드에서도 여전히 미해소 상태임을 재확인했다 — backend 전용이던
    스위트가 backend+frontend 겸용으로 통합되며 같은 패턴의 호출 지점이 5→7개로 늘었다. OS temp
    디렉터리라 CI/로컬 재부팅 시 정리되므로 기능적 위험은 없다.
  - 제안: 조치 불요(기존 판정 유지). 정리하고 싶다면 `fake_config`/`expect_exit_2` 같은 공용
    헬퍼 지점에 `addCleanup(shutil.rmtree, tmp.parent, ignore_errors=True)` 한 줄을 추가하면
    전체 호출부에 한 번에 적용된다.

- **[INFO]** `_PATH_TOKEN` 추출 정규식(`test_workflow_run_inputs_covered.py:45`) 자체를 겨냥한
  고립된 fixture 단위 테스트가 없다 — 현재는 실제 워크플로 YAML 스캔(통합 테스트)과
  `filter_covers_file`의 매칭 결과에 대한 자기 검사(`test_the_guard_would_catch_a_missing_entry`)
  뿐이고, 추출(=어떤 토큰을 후보로 뽑는가) 단계 자체의 경계(트레일링 구두점, 따옴표, 세미콜론,
  `scripts.foo` 같은 dotted-module 오탐 방지 등)를 고정하는 테스트는 없다.
  - 위치: `.claude/tests/test_workflow_run_inputs_covered.py:45`(`_PATH_TOKEN` 정의),
    소비처 `test_run_steps_reference_only_covered_files`(:91-111, 항상 실제 워크플로 파일 내용에
    의존).
  - 상세: 직접 여러 입력으로 `_PATH_TOKEN.findall()`을 돌려본 결과 현재 동작은 정확하다(위 "직접
    검증한 것" 참조) — 지금 당장의 결함은 아니다. 다만 이 파일의 자매 파일들(예:
    `FrontendExcludeCoverageTest`, `ParseTest`)은 "정규식을 바꾸면 fixture로 즉시 드러난다"는
    관례를 갖고 있는데, 이 신규 가드의 추출 단계만 그 관례 밖에 있다 — 앞으로 `_PATH_TOKEN`을
    넓히거나 좁힐 때(주석에 "넓히는 편집은 안전하다"고 적혀 있지만 좁히는 편집은 그렇지 않다)
    회귀를 즉시 잡을 밀리초 단위 테스트가 없고, 통합 테스트가 우연히 그 변화를 태우는 워크플로
    내용을 갖고 있어야만 잡힌다.
  - 제안: 필수는 아님. `_PATH_TOKEN.findall()`에 대해 트레일링 구두점/따옴표, `scripts.foo`류
    오탐 후보, `.github/actions/x/action.yml`처럼 중첩 확장자를 가진 정상 경로 등을 표로 둔
    가벼운 단위 테스트 클래스를 추가하면 통합 테스트와 독립적으로 추출 정확성을 고정할 수 있다.

## 회귀 테스트 유효성

- 1R/2R가 새로 추가한 회귀 가드(`test_paths_containing_parentheses_are_counted`,
  `test_indented_continuation_with_a_position_is_still_ignored`, `EntrypointWiringTest`,
  `FrontendExcludeCoverageTest`, `AmbientDeclarationIsAModuleTest`,
  `RunTscFailClosedTest.test_nonzero_exit_with_diagnostics_is_the_normal_path`,
  `test_workflow_run_inputs_covered.py` 전체)는 전부 현재 코드 상태에서 실행·GREEN이며, 각각이
  고정하려는 실패 조건(회귀 재현 시 RED)을 서술에 근거해 확인했다 — 프록시가 아니라 실제 배선을
  태운다(`EntrypointWiringTest`가 `CORE.main`을 실제 `CONFIGS[label]`로 구동, `test_workflow_run_inputs_covered.py`가 실제 `git ls-files` 결과를 씀).
- `.claude/tests/README.md`가 `test_typecheck_ratchet.py`/`test_workflow_run_inputs_covered.py`
  양쪽 모두에 "어떤 사고를 재발 방지하는가"를 클래스명과 함께 구체적으로 서술 — 삭제된
  `test_backend_typecheck_ratchet.py`에 대한 참조가 어디에도 남아 있지 않음을 grep으로 확인.

## 요약

두 차례의 선행 리뷰 라운드에서 지적된 testing 관점 Critical 1건·Warning 2건(코어 이중 로드로
인한 무증거 배선, `run_tsc()`의 가장 흔한 실전 경로 무증거, 게이트 자기 자신을 못 트리거하는
클래스에 대한 재발 방지 가드 부재)이 전부 실측 가능한 회귀 테스트로 닫혀 있고, 이번 라운드에서
전체 관련 스위트(36+3+3+56 테스트)를 직접 재실행해 GREEN을 재확인했으며 핵심 정규식(`DIAGNOSTIC`·
`_PATH_TOKEN`) 두 개를 별도 벤치마크/fixture로 독립 검증해 새로운 결함을 찾지 못했다. 남은 것은
전 라운드부터 의도적으로 낮은 우선순위로 남긴 tempfile 정리 부재(INFO, 재확인)와, 이번에 새로
관찰한 `_PATH_TOKEN` 추출 자체의 고립 단위 테스트 부재(INFO, 신규 관찰이나 현재 결함은 아님)
둘뿐이다. 둘 다 머지를 막을 성격이 아니다.

## 위험도

LOW
