# 아키텍처(Architecture) Review

## 발견사항

- **[WARNING]** `review_guard.py` 가 응집도 낮은 "god module" 로 커지고 있다 — 4개의 독립 정책(코드리뷰 신선도 Gate 1, spec-impl 신선도 Gate 2, in-flight 억제, resolution-in-flight 억제)과 3개의 서로 다른 메커니즘 계층(git plumbing, checkout/rebase-immune 시계 계산, glob→regex DSL 컴파일)이 한 파일(1065줄)에 공존한다.
  - 위치: `.claude/hooks/_lib/review_guard.py` (전체 구조). 구체적으로 `evaluate_review`(954행)가 네 정책을 순차 호출하는 orchestrator 이고, `_run_git`/`_repo_root`/`_merge_base`(206-262행, git plumbing), `_authoritative_code_time`/`_newest_commit_time`/`_newest_resolved_review_mtime`(319-585행, 신선도 시계), `_glob_to_regex`/`_parse_frontmatter_code`(599-698행, spec glob DSL), `_resolution_in_flight`/`_code_review_in_flight`(822-951행, 파일시스템 마커 검출)이 한 모듈에 나란히 있다.
  - 상세: 테스트(`test_review_guard_hardening.py`)가 `mock.patch.object(rg, "_dirty_set", ...)` 식으로 거의 모든 private 함수를 독립 seam 으로 다루는데, 이는 사실상 모듈 속성 재바인딩을 통한 암묵적 DI다. 정책(무엇이 "fresh/resolved" 인지)과 메커니즘(git 호출, fs walk, regex 컴파일)의 경계가 파일 하나 안에서 흐려지고 있어, 다섯 번째 gate 가 추가되면 파일이 더 커지고 테스트가 patch 해야 할 seam 수가 계속 늘어난다.
  - 제안: `evaluate_review` façade 는 유지하되, `_freshness_clock.py`(git plumbing + 시계), `_spec_glob.py`(glob DSL), `_in_flight.py`(마커 검출)로 응집 단위를 분리할 것. 정책 로직(Gate 1/2/in-flight 판정)만 `review_guard.py` 에 남기면 파일이 계속 커져도 각 서브모듈의 책임은 안정적으로 유지된다.

- **[WARNING]** git 임시 저장소 부트스트랩 헬퍼(`_git`/`_write`, ~15줄, `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM`/author-committer identity 격리 포함)가 이번 라운드가 다루는 테스트 파일들 안에서만 최소 5회 복제돼 있다.
  - 위치: `.claude/tests/test_review_gate_ci.py:58` (`ReviewGateCliTest._git`), `.claude/tests/test_review_gate_ci.py:686` (`TheRealGateIgnoresTheEnvironmentTest._git`, 동일 파일 내 2번째 사본), `.claude/tests/test_review_guard_hardening.py:275` (`RebaseAuthorDateTest._git`, author/committer 변형), `.claude/tests/test_review_guard_hardening.py:588` (`NotesReachThePublicEntryPointTest._git`), `.claude/tests/test_review_guard_hardening.py:675` (`UnstagedModificationKeepsItsPathTest._git`).
  - 상세: 이 저장소 자신이 README(`test_retry_state_shared.py`/`test_report_paths_shared.py` 행)와 plan 문서(item 12, "fresh-interpreter 테스트 보일러플레이트가 4개 파일에 복제") 양쪽에서 "손-동기 쌍은 드리프트한다" 를 반복 기록해 둔 실패 클래스인데, 이번 라운드가 새로 들여온 `_git`/`_write` 복제는 그 목록에 없는 **별도 인스턴스**다. `_harness.py` 가 이미 `REPO_ROOT`/`HOOKS_DIR`/`CLAUDE_DIR`/`load_module_by_path` 로 공유 인프라 역할을 하고 있어 자연스러운 확장 지점이 있다.
  - 제안: `_harness.py` 에 `make_temp_git_repo()`(또는 `GitRepoTestCase` mixin)를 추가해 5곳을 1곳으로 수렴시킬 것. timeout 인자 하나를 3곳에 각각 넣어야 했던 사례(plan 문서 item 12)가 이미 이 복제의 실제 비용을 보여준다.

- **[WARNING]** `.claude/hooks/_lib` 네임스페이스가 `.claude/skills/_lib` 와 이름이 겹치는 기존 취약점에, 이번 라운드가 세 번째 in-process 소비자(`scripts/check-review-gate.py`)를 추가했다.
  - 위치: `scripts/check-review-gate.py:55-67` (`_load_gate`, `sys.path.insert(0, lib)` 후 `import review_guard`), 비교 대상 `.claude/hooks/guard_review_before_push.py:53-54`, `.claude/hooks/guard_review_before_stop.py:40`.
  - 상세: 현재는 세 소비자 모두 항상 별도 프로세스(훅 서브프로세스 / CI step / 테스트의 `subprocess.run`)로 실행되므로 실제 충돌은 발생하지 않는다 — `test_review_gate_ci.py` 의 docstring 도 "형제 suite 들이 문서화한 것과 같은 회피" 라고 스스로 인정한다. 그러나 이는 설계로 막힌 것이 아니라 **배포 형태(항상 subprocess)에 우연히 의존**하는 상태다. 향후 누군가 `check-review-gate.py` 의 판정 로직을 orchestrator 스크립트(`.claude/skills/**`, 이미 `skills/_lib` 를 in-process import 함)에서 재사용하려고 하면 이름 충돌이 그 순간 실제 결함이 된다.
  - 제안: 지금 당장 고칠 필요는 없지만(범위 밖), 두 `_lib` 트리 중 하나를 고유 이름(예: `hooks/_guard_lib`)으로 바꾸거나 패키지화(`__init__.py` + 고유 top-level 이름)하는 근본 수정을 백로그에 등재해 둘 것. 현재는 "항상 subprocess" 라는 불문율에 기대는 회피가 세 번째 자리로 늘었다.

- **[INFO]** 동일한 "gate 모듈 로드" 보일러플레이트(`sys.path.insert` + `try: from review_guard import evaluate_review except: … = None`)가 세 소비자에 각각 손으로 복제돼 있고 이미 형태가 살짝 갈리기 시작했다.
  - 위치: `.claude/hooks/guard_review_before_push.py:53-66`, `.claude/hooks/guard_review_before_stop.py:40,67-71`, `scripts/check-review-gate.py:60-74` (`_ROOT_DEFAULT` 계산 방식과 `if lib not in sys.path` 가드 유무가 이미 다르다).
  - 상세: 훅은 각자 독립 실행돼야 하는 배포 모델이라 완전한 통합은 부적절할 수 있지만, "모듈을 불러오고 실패를 문자열로 남긴다" 는 5~10줄짜리 순수 로직 자체는 세 곳에서 동일한 계약을 갖는다. 세 곳이 실패 보고 형식을 계속 손으로 맞춰야 하는 자리다.
  - 제안: `_lib/gate_loader.py` 에 `try_import(lib_dir, module, attr) -> (value, error_str)` 같은 얇은 헬퍼를 두고 세 소비자가 공유하는 것을 고려할 것. 이미 `failopen_state.py` 로 fail-open 보고 로직을 성공적으로 공유한 선례가 있다.

- **[INFO]** 긍정적 확인 — 이 계층의 핵심 설계(단일 판정자 + 얇은 어댑터)는 실제로 잘 지켜지고 있고, 순환 의존도 없다.
  - 위치: `scripts/check-review-gate.py` (전체, ~80 실행줄), `.claude/hooks/_lib/review_guard.py:147-150` (`_shared` import), `.claude/_shared/report_paths.py`, `.claude/_shared/block_integrity.py`.
  - 상세: `check-review-gate.py` 는 정책을 전혀 갖지 않고 100% `review_guard.evaluate_review` 에 위임하는 얇은 CLI 어댑터로, 기존 두 훅 어댑터와 동일한 형태다 — 의존성 역전이 실제로 지켜진 사례다. `_shared/report_paths.py`·`_shared/block_integrity.py` 는 stdlib 만 import 하는 leaf 모듈이라 `hooks/_lib → _shared` 는 단방향이고, `branch_guard.py`/`plan_guard.py`/`failopen_state.py` 어디도 `review_guard.py` 를 되돌아 import 하지 않는다 — 순환 의존 없음을 직접 확인했다. 7R 에서 발견된 결함이 정확히 "위임 대상(`_shared/**`)이 정적 스캔에서 빠졌다" 는 것이었는데, 그 위임이 애초에 비순환 구조였기 때문에 그 갭을 닫는 것이 가능했다.

- **[INFO]** `WorkflowWiringTest.EXPECTED`(워크플로 문서 전체를 미러링하는 Python 리터럴)와 `harness-checks.yml` 의 `paths:` 열거는 의도된 "유한 비교" fitness function 이지만, 결합 방향이 역전돼 향후 확장 비용을 발생시킨다.
  - 위치: `.claude/tests/test_review_gate_ci.py:407-509` (`WorkflowWiringTest.EXPECTED`/`test_the_expectation_still_describes_a_gate_that_runs`), `.github/workflows/harness-checks.yml:9-64` (`paths:`).
  - 상세: `review-gate.yml` 에 정당한 새 스텝(권한 추가, 새 permission 등)이 추가될 때마다 `test_review_gate_ci.py` 의 Python 리터럴도 함께 손으로 고쳐야 하고, 새 가드 대상 파일 클래스가 생길 때마다 `harness-checks.yml` 의 `paths:` 도 함께 고쳐야 한다. 이는 4라운드에 걸친 "부분 일치는 여전히 부분 일치" 패배 이후 의식적으로 선택된 트레이드오프이고(파일 자체 docstring 이 이를 명시), 현재 시점에서는 올바른 선택이다 — 다만 "확장성" 관점에서 비용이 실재하므로 기록해 둔다. 새로운 결함으로 취급할 필요는 없다.

- **[INFO]** 이미 추적 중인 결함(신규 아님) — `_default_branch` 해석 로직이 4곳에 독립 구현돼 있고, 이번 라운드가 그 중 하나(`review_guard._default_branch`)를 CI 경로에서도 상시 실행되게 만들었다.
  - 위치: `.claude/hooks/_lib/review_guard.py:239-252` (`_origin_default_branch` 시도 후 `origin/` 접두 없이 로컬 `main`/`master` ref 를 직접 probe 하는 폴백).
  - 상세: `plan/in-progress/harness-review-gate-ci-backstop.md` 의 "신규 후속 (defer)" 항목이 이미 이 4중 구현(`branch_guard._origin_default_branch` 정본, `review_guard._default_branch`, `code_review_orchestrator._default_branch_ref`, consistency orchestrator 리터럴)을 `_lib` 네임스페이스 충돌 해소 선행 조건과 함께 defer 로 기록해 뒀다. 재지적이 아니라, `scripts/check-review-gate.py` 가 이 로직을 매 PR 마다 CI 에서 실행하는 네 번째 활성 호출부가 됐다는 사실만 갱신해 둔다 — 기본 브랜치 정책이 바뀌면 로컬뿐 아니라 CI 판정도 함께 갱신해야 하는 지점이 하나 늘었다.

## 요약

이번 라운드가 다루는 CI 백스톱 계층은 아키텍처 핵심 원칙(단일 판정자에 대한 얇은 어댑터, `_shared` 를 향한 비순환 단방향 의존, 정적 열거 대신 유한 비교로의 전환)을 실제로 지키고 있고, 7라운드에 걸친 배선-가드 강화 과정에서 "정적 금지 목록은 무한 표면과의 경주에서 진다" 는 교훈을 "행위 동등성 비교"(스텁 판정 × 플래그 조합, 최소/적대적 환경 판정 일치)로 전환한 것은 이 코드베이스 규모에서 타당한 설계 성숙이다. 남은 문제는 새 결함이라기보다 유지보수 비용 쪽에 있다: `review_guard.py` 가 정책과 메커니즘을 계속 한 파일에 누적하며 응집도를 잃어가는 점, 이번 라운드의 테스트 파일들이 git 저장소 부트스트랩 보일러플레이트를 또 한 번(추적되지 않은 채) 복제한 점, 그리고 `hooks/_lib`/`skills/_lib` 이름 충돌이라는 기존 취약점에 in-process 잠재 소비자가 하나 더 늘어난 점이다. 셋 다 지금 당장 판정을 흔들 수 있는 자리는 아니며, 우선순위상 리팩터링 백로그에 등재할 성격이다.

## 위험도

LOW
