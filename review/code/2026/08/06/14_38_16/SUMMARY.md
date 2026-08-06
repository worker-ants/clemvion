# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — CI 백스톱이 이번 라운드에 처음 연결한 `_origin_default_branch()`/`_default_branch()`가 `actions/checkout` 위상(`git clone`이 아닌 `init`+`remote add`+`fetch`)에서 네트워크 폴백에 의존하고, 그 폴백이 실패(또는 단순 히컵)하면 CI 백스톱이 "코드 변경 없음 — 허용"으로 조용히 뒤집힌다는 것을 side_effect-reviewer 가 실제 스크립트 실행으로 재현했고, testing-reviewer 는 이 함수가 하네스 스위트 전체(286개 테스트)에서 단 한 번도 실경로로 구동되지 않는다는 것을 뮤테이션으로 실증했다(둘 다 같은 근본 결함). 현재는 "관측 모드"(항상 exit 0)라 즉시 빌드를 막지는 않지만, `--enforce` 전환을 결정할 관측 데이터 자체를 오염시키고 전환 즉시 fail-open 우회가 된다.

> **DB 리포트 미확보**: `database` reviewer 는 `_prompts/database.md` 프롬프트가 존재하고 `_retry_state.json`의 `agents`/`subagent_invocations` 목록에도 포함돼 있으나, 세션 디렉터리에 `database.md` 산출물이 없다(디스크 확인: 13/14 리포트만 존재). `_retry_state.json` 자체도 전 에이전트를 `agents_pending`으로, `agents_success`/`agents_fatal`을 빈 배열로 기록한 채(디스크의 실제 13개 완료 리포트와 불일치) 갱신되지 않은 상태다 — 이 요약은 디스크에 실재하는 13개 리포트만 반영했다. **database 관점(예: 트랜잭션/마이그레이션/쿼리 안전성)의 Critical 이 있었다면 이 요약에 반영되지 못했을 수 있다** — 재시도 필요.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용/테스트 | `_origin_default_branch()`/`_default_branch()`의 "Method 1(symbolic-ref)이 정상 케이스를 공짜로 처리한다"는 전제가 `actions/checkout` 위상에서 거짓이다. `actions/checkout`은 `git remote set-head`를 호출하지 않아 `refs/remotes/origin/HEAD`가 없고, 로컬 `refs/heads/main`도 없어(PR ref만 존재) 유일한 성공 경로가 네트워크 폴백(Method 2, `git remote show origin`)뿐이다. 그 호출이 실패하면 `_default_branch()`가 `None`을 반환 → `evaluate_review()`가 `base=None` → `committed=[]` → `changed=[]` → **"코드 변경 없음 — 허용"으로 조용히 통과**한다. side_effect-reviewer 가 `mktemp -d` 격리 환경에서 `actions/checkout`과 동일한 절차(init+remote add+fetch)로 이를 실제 재현했다(Scenario B: origin 도달 불가 → 오답 "통과"). 별도로 testing-reviewer 는 이 함수를 실제 git 저장소로 구동하는 테스트가 하네스 스위트 전체(9개 소비 테스트 파일)에 단 하나도 없음을 확인하고, prefix-strip 로직을 깨뜨리는 뮤테이션을 적용해도 286개 테스트가 전원 GREEN임을 실증했다 — 이 정확한 변형은 `branch_guard`의 핵심 정책("메인 워크트리에서 기본 브랜치 직접 편집 금지")을 조용히 무력화한다(review_guard/plan_guard 쪽은 `_merge_base` 폴백이 우연히 자기보정해 증상이 안 보임). requirement-reviewer 도 같은 커버리지 갭을 독립적으로 확인(WARNING 등급, "현재 로직 자체는 정확함 — 활성 버그 아닌 커버리지 공백"이라는 근거). performance-reviewer 는 관련해 Method 2 자체가 선언된 2초 타임아웃보다 실측 2.6~3.7초 더 오래 걸림을 실측했다. | `.claude/_shared/git_probe.py:46-85`(`_origin_default_branch`), `:139-152`(`_default_branch`) / 소비: `.claude/hooks/_lib/review_guard.py:920`, `.claude/hooks/_lib/plan_guard.py:273`, `.claude/hooks/_lib/branch_guard.py:57-58` / 배선: `.github/workflows/review-gate.yml:55-57`(`actions/checkout@v7, fetch-depth: 0`) → `scripts/check-review-gate.py:97`(`decision = evaluate(root)`) | (a) CI 호출부(`check-review-gate.py`)가 이미 아는 `github.base_ref`(워크플로 "Fetch base ref" 스텝이 `$BASE_REF`로 씀)를 `--base-ref` 인자/환경변수로 게이트에 명시 전달해, CI 경로에서는 네트워크 재추론 자체를 우회. (b) 최소 조치로 워크플로에 `git remote set-head origin --auto` 스텝 추가해 Method 1을 CI에서도 유효하게. (c) `origin` remote를 실제 구성한 `actions/checkout` 위상(init+remote add+fetch, `remote set-head` 없음) 회귀 테스트를 `test_plan_guard.py`류 real-repo 패턴으로 추가 — 현재 9개 소비 테스트 파일 전부 `git remote add` 0건. (d) Method 2 타임아웃을 실측치(≥3s) 이상으로 올리거나 `git ls-remote --symref origin HEAD`처럼 가벼운 호출로 교체. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | CI 백스톱이 "판정자 자기 자신"을 PR HEAD 커밋에서 신뢰한다 — `--enforce` 전제 목록에 없는 별도 신뢰 축. `.claude/hooks/_lib/**`/`.claude/_shared/**`를 같은 PR 안에서 함께 조작해 `evaluate_review()`가 항상 `blocked=False`를 반환하도록 바꾸면, 백스톱은 그 조작된 버전으로 자신을 평가해 통과시킨다. 관측 모드인 현재는 실피해 없음. | `scripts/check-review-gate.py:63`(`_load_gate`) / `.github/workflows/review-gate.yml:31`(`paths`에 `.claude/hooks/_lib/**` 포함, `actions/checkout@v7`가 PR HEAD 체크아웃) | `plan/in-progress/harness-review-gate-ci-backstop.md`의 "열린 질문"/전제조건 절에 "게이트 코드 자체가 PR HEAD에서 로드된다 — `--enforce` 이전에 `.claude/hooks/_lib/**`·`.claude/_shared/**`에 대한 branch-protection(CODEOWNERS 필수 승인 등)이 선행돼야 한다"를 명시적으로 추가. |
| 2 | 테스트/보안 | git-probe 중복 검출 가드(`GitProbesAreNotReDuplicatedTest`)가 "두 모듈에 **같은 이름**으로 정의된 함수"의 본문만 비교한다 — 새 이름으로 손-복제한 함수(예: `branch_guard.py`에만 `_run_git_impl`을 새로 추가)는 어느 쪽 테스트에도 안 걸린다. | `.claude/tests/test_plan_guard.py:329-400`(`_bodies` 349행, `test_no_identical_function_survives_in_two_guards` 360행, `test_the_shared_probes_are_the_same_objects_everywhere` 377행) | `_run_git`을 몽키패치해 반환값을 오염시킨 뒤 세 가드 모듈이 실제로 구동하는 판정 경로 전부가 그 패치를 관측하는지 end-to-end로 도는 행위(behavioural) 검증을 정적 이름-매칭에 보강. |
| 3 | 성능 | `review_guard.py`의 리뷰 커버리지 판정이 `review/code/**`(810개 SUMMARY.md)·`review/consistency/**`(738개)를 캐시 없이 매 호출마다 `os.walk` 전체 스캔하고, 이번 PR로 로컬 훅과 CI가 같은 스캔을 독립적으로 중복 수행한다. 현재 실측 0.1~0.25초로 무해하나 세션 수가 프로젝트 수명 내내 단조 증가(archive 배출구 없음)해 O(누적 세션 수)로 계속 자란다. | `.claude/hooks/_lib/review_guard.py:350`(`_iter_summaries`), `:367`, `:405`, `:498`, `:680`, `:720`, `:897`(`evaluate_review`) | 세션 디렉터리가 이미 `<Y>/<m>/<d>/<H>_<M>_<S>`로 정렬 가능하므로 최신 N개월로 `os.walk` 범위를 자르거나, 가장 최근 resolved 리뷰 시각을 캐시해 증분 스캔. 최소한 오래된 세션을 감사 대상에서 빼는 아카이브 규약 검토. |
| 4 | 성능 | `_origin_default_branch`의 네트워크 폴백(`git remote show origin`)이 선언된 `timeout=2.0`보다 실측(2.60~2.68s, 콜드 커넥션 3.7s) 더 오래 걸려 사실상 상시 타임아웃-실패하는 경로다. (Critical #1과 근본 원인 공유, 별도의 타임아웃 실측치라 함께 조치 필요) | `.claude/_shared/git_probe.py:74-77`(Method 2, `timeout=2.0`), `:106-129`(`_run_git`, `TimeoutExpired`를 삼켜 `rc=1`) | Critical #1의 (d)와 동일 — 타임아웃을 실측치 이상으로 올리거나 더 가벼운 단일 네트워크 호출로 교체, 또는 CI에서는 이 폴백 자체를 건너뛰게. |
| 5 | 아키텍처 | "origin 기본 브랜치 해석" 로직이 여전히 4곳에 독립 구현돼 있고, 그중 2곳(`code_review_orchestrator.py:1128` `_default_branch_ref`, `consistency_orchestrator.py:413`)은 이번 통합 대상 밖이며 반환 계약도 다르다(`git_probe`는 `"main"`, `code_review_orchestrator`는 `"origin/main"`). 이미 plan 문서에 defer로 기록돼 있어 CRITICAL로 올리지 않음. | 정본 `.claude/_shared/git_probe.py:46` / 재구현 `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1128` / 리터럴 `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:413` | `_lib` 네임스페이스 충돌이 해소되기 전까지는 최소한 두 orchestrator의 반환 계약을 docstring에 명시해 다음 사람이 다섯 번째 사본을 만들지 않게. (기존 plan 항목 우선순위 재확인, 신규 항목 아님) |
| 6 | 요구사항 | `plan_guard.py`의 위임 블록 주석이 "다섯 개(five) 프로브"라고 서술하지만 115행의 `_current_branch` 위임까지 합치면 실제로는 여섯 개를 위임한다 — `review_guard.py:200`의 동일 문구는 정확(review_guard는 `_current_branch`를 안 씀). 두 모듈이 같은 문장을 복사해 갖고 있다가 한쪽만 갱신되며 갈린 손-동기 주석 drift. 기능 영향 없음. | `.claude/hooks/_lib/plan_guard.py:102`("These five git probes...") ~ `:115`(`_current_branch` 위임) | 102행 주석을 "여섯"으로 고치거나 115행까지 한 블록으로 합치거나, 개수를 프로즈로 박지 않는 서술로 변경. |
| 7 | 스코프 | `ResolutionMarkerPathIsConsistentTest`(`test_review_guard_hardening.py`) — 이 티켓(CI 백스톱)과 코드 경로가 전혀 겹치지 않는 별개 서브시스템(resolution-in-flight 마커, #699)의 잠복 결함 수정이 동봉됐다. 커밋 메시지에는 투명하게 밝혀졌으나 `plan/in-progress/harness-review-gate-ci-backstop.md`의 라운드별 발견 이력에는 반영되지 않았다. 되돌릴 필요는 없음. | `.claude/tests/test_review_guard_hardening.py`(라운드 10 커밋 `9a7b28764` 신규 추가) | plan 배너에 "W10: resolution 마커 4중 손-동기 정합성 테스트 추가 — 티켓 주제와 무관한 별도 결함, review 중 발견해 즉시 처분" 한 줄 추가. |
| 8 | 유지보수성 | "어떤 모듈을 git-probe 중복 검사 대상으로 스캔할지" 목록이 여전히 하드코딩된 두 개의 독립 튜플(`GitProbesAreNotReDuplicatedTest._MODULES`, `TheGateItselfDoesNotBranchOnCiEnvTest._SCANNED_LIB`)이다 — "열거를 도출로 바꿨다"는 10R의 교훈이 함수 비교 자체에는 적용됐지만 "어떤 파일을 볼지"에는 적용 안 됨. 향후 `_lib/`에 4번째 guard 모듈이 추가돼 `_shared/git_probe`를 위임받으며 실수로 함수를 복제해도 두 목록 중 어느 쪽도 그 파일을 스캔 대상에 넣지 않아 조용히 통과한다. | `.claude/tests/test_plan_guard.py:346`(`_MODULES`), `.claude/tests/test_review_gate_ci.py:607`(`_SCANNED_LIB`) | `.claude/hooks/_lib/*.py` 전체를 순회하며 `from _shared import git_probe`(또는 `_git_probe.`) 참조가 있는 파일만 골라내는 방식으로 도출. 최소한 두 목록이 서로 일치하는지 대조하는 테스트라도 추가. |
| 9 | 유지보수성 | 실제 git 저장소를 구동하는 테스트 부트스트랩 헬퍼(`_git`/`_write`, 각 ~7줄, 동일 본문)가 이번 라운드 리뷰 대상 파일 안에서만 5곳(저장소 전체 7곳)에 바이트 단위 복제돼 있다. 프로덕션 git 헬퍼는 `_shared/git_probe.py`로 통합했으면서 같은 논리가 테스트 부트스트랩 헬퍼에는 적용되지 않았다. | `.claude/tests/test_plan_guard.py:292,301`(`_git`/`_write`); `.claude/tests/test_review_guard_hardening.py:588,677`(`_git` 2곳)/`291,597,686`(`_write` 3곳); `.claude/tests/test_review_gate_ci.py:58,692`(`_git`)/`67,701`(`_write`) | `_harness.py`에 `run_git(root, *args)`/`make_temp_git_repo()` 공유 헬퍼(또는 TestCase 믹스인) 추가. |
| 10 | 테스트 | `test_block_integrity.py::PlanStubsMirrorTheRealInterfaceTest`의 "raise-only 스텁" 면제(`if "raise " in stub: continue`)가 문자열 부분일치라, 리터럴 안에 raise 분기와 `push_blocks` 없는 정상 반환 분기가 **섞여 있어도** 리터럴 전체가 통째로 면제된다. 실측: 마커 매칭 스텁 14개 중 5개가 이미 이 사유로 면제(그중 4개는 실제로는 raise/return 혼합인데 우연히 전부 `push_blocks`를 갖고 있어 오늘은 무증상). | `.claude/tests/test_block_integrity.py:691-696` | "raise-only" 판정을 문자열 부분일치가 아니라 리터럴을 `ast.parse`해 본문에 `raise`가 아닌 `return` 문이 있는지로 좁힐 것(return이 있으면 `push_blocks` 요구). |
| 11 | 문서화 | `.claude/tests/README.md`의 `test_plan_guard.py` 행이 10R이 바꾼 검증 방식(손으로 쓴 목록 + "로컬 def 부재" 체크 → 세 모듈 AST 비교로 "본문 동일 함수" 탐지)을 반영하지 않고 9R 상태("round 9 found a third")에서 멈춰 있다. `test_tests_readme_catalog.py`는 행의 **존재**만 검증하고 **내용**은 검증하지 않아 이 drift를 못 잡는다. | `.claude/tests/README.md:62` vs `.claude/tests/test_plan_guard.py`(`GitProbesAreNotReDuplicatedTest`, 329-400행) | README 행을 10R 상태로 갱신 — "이제 목록을 쓰지 않는다, 세 모듈 AST를 비교해 본문 동일 함수가 남아 있으면 실패시킨다" + "10R이 6번째(`_current_branch`)를 찾았다" 추가. |
| 12 | 문서화 | 같은 README의 `test_review_guard_hardening.py` 행이 10R이 새로 추가한 `ResolutionMarkerPathIsConsistentTest` 클래스(마커 디렉터리 경로 4곳 정합성 검사)를 언급하지 않는다 — 9R 이전 서술에서 멈춰 있음. (WARNING #7과 같은 근본 변경의 문서화 누락이지만 별개 결함) | `.claude/tests/README.md:57` | README 행에 "resolution-marker 경로가 4곳(정본+두 훅+테스트 헬퍼)에 손 복제돼 있는지 `ResolutionMarkerPathIsConsistentTest`가 대조한다" 한 문장 추가. |
| 13 | 의존성 | `RESOLUTION_MARKER_SUBDIR` 경로 리터럴이 여전히 4곳(정본 상수 + 두 훅 스크립트 + 테스트)에 손으로 중복돼 있다 — 이번 세션이 git 프로브에는 "위임으로 통합"을 적용했지만, 같은 실패 클래스(손-동기 쌍은 갈린다)를 여기서는 "테스트로 drift만 감지"라는 더 약한 완화로 처리했다. fail-closed 방식이라 CRITICAL은 아님. | 정본 `.claude/hooks/_lib/review_guard.py:811`, `.claude/hooks/mark_resolution_in_flight.py:53`, `.claude/hooks/clear_resolution_in_flight.py:30`, 테스트 `.claude/tests/test_review_guard_hardening.py:779-810` | 가능하면 두 훅 스크립트가 상수 자체만 import(`from _lib.review_guard import RESOLUTION_MARKER_SUBDIR`, review_guard 전체 로드 없이)하도록 리터럴 제거. 어려우면 상수 옆에 "새 소비자가 생기면 이 테스트도 갱신" 주석 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처/요구사항/유지보수성/부작용/문서화/스코프 | `_default_branch()`에 실질 역할이 없는 죽은 조건문 `if True:`가 남아 있다 — 예전 `if resolver is not None:`(옵셔널 import 시절 방어 코드) 잔재. 동작 영향 없음. 6개 리뷰어가 공통 지적(스코프 리뷰어는 "이번 라운드 자체가 만든 정리 잔재"라는 이유로 WARNING으로 분류). | `.claude/_shared/git_probe.py:139-146`(`if True:` 블록) | `if True:`를 제거하고 `try/except`를 함수 최상위로 dedent. |
| 2 | 유지보수성 | `scripts/check-review-gate.py`가 `ReviewDecision.push_blocks` 프로퍼티 대신 `decision.blocked`를 직접 읽는다 — 오늘은 `ReviewDecision`만 소비해 문제없으나, 이 스크립트가 `PlanDecision`도 함께 보게 확장되면 그때 `push_blocks`로 맞춰야 한다는 사실을 다시 발견해야 한다. | `scripts/check-review-gate.py:101` | 지금 당장 조치 불필요, 두 번째 게이트를 소비하게 되는 시점에 `push_blocks`로 전환. |
| 3 | 유지보수성 | `branch_guard.py`에서 `_shared/git_probe`로 위임한 네 개 별칭이 무관한 `_is_main_worktree` 정의를 사이에 두고 두 블록으로 쪼개져 있다 — 가독성 문제, 기능 영향 없음. | `.claude/hooks/_lib/branch_guard.py:45-46, 57-58` | 네 줄을 파일 상단 import 직후 한 블록으로 통합. |
| 4 | 테스트 | `test_block_integrity.py`의 `"\n" in n.value` 필터가 개행 없는 한 줄짜리 스텁 리터럴을 검사 대상에서 완전히 제외한다 — 오늘은 모든 스텁이 여러 줄이라 무증상. 같은 블록의 주석도 이번 라운드에 삭제된 `"".join(stubs)` 동작을 여전히 서술해 stale. | `.claude/tests/test_block_integrity.py:678-681`(필터), `:682-684`(stale 주석) | 다음에 이 가드를 손댈 때 주석을 현재 동작(스텁별 개별 검사)에 맞게 갱신, `"\n"` 필터 대신 마커 상수 자체를 명시적으로 제외하는 방식 검토. |
| 5 | 문서화 | `_current_branch`/`_origin_default_branch` 위임 줄에만 설명 주석이 빠져 있다 — 같은 파일의 형제 위임 블록(`_run_git`~`_porcelain_path`)은 "몇 번째 사본이었는지" 주석이 달려 있는데 이 두 줄만 비대칭. | `.claude/hooks/_lib/plan_guard.py:115`, `.claude/hooks/_lib/branch_guard.py:57-58` | 두 줄 위에 "10R이 여기서 6번째 사본을 찾았다" 류 한 줄 추가(필수 아님). |
| 6 | 부작용 | `_shared/git_probe.py`의 신설 위임 함수들이 프로세스 전역 `sys.path`를 뮤테이트하는 기존 패턴(`review_guard.py`가 이미 갖고 있던 것)을 그대로 물려받았다 — `if _CLAUDE_DIR not in sys.path:`로 멱등성 보장, 각 훅이 별개 서브프로세스로 실행돼 세션 간 상태 공유 없음. 새 위험 아님, 오히려 이전의 `importlib` 기반 `sys.modules` 영구 오염보다 안전. | `.claude/hooks/_lib/branch_guard.py:25-32`, `.claude/hooks/_lib/plan_guard.py:52-61` | 조치 불필요. |
| 7 | 성능 | `review-gate.yml`이 매 트리거마다 `fetch-depth: 0`으로 전체 히스토리(현재 `.git` 154MB, 커밋 2,401개)를 체크아웃한다 — merge-base/freshness 판정에 필요하다는 근거가 워크플로 주석에 이미 명시된 인지된 트레이드오프. 저장소가 계속 자라면 게이트 실행 시간의 지배적 비용이 될 수 있다는 점만 기록. | `.github/workflows/review-gate.yml:55-57` | 조치 불필요(현재는), 저장소 성장 추이 관찰. |
| 8 | 요구사항 | spec fidelity — 이 영역(harness/CI)엔 `spec/` 대응 문서가 없어(`review-gate`/`review_guard`/`check-review-gate` 문자열 `spec/` 어디에도 0건) `plan/in-progress/harness-review-gate-ci-backstop.md`를 사실상의 spec으로 대조했고, 관측 모드·dependabot 예외·`paths:` 글롭·`fetch-depth: 0`+"Fetch base ref" 순서·판정자 단일성 모두 line-level로 일치. 불일치 없음. | `plan/in-progress/harness-review-gate-ci-backstop.md` 전체 대조 | 해당 없음. |
| 9 | 동시성 | GH Actions `concurrency:` 블록(두 워크플로 모두 `cancel-in-progress: true`)이 워크플로별로 다른 `group` 접두사를 써 교차 오염이 없다. 이번 라운드 diff는 `harness-checks.yml`에 `permissions: contents: read`만 추가했을 뿐 동시성 축은 미변경. `_origin_default_branch` 위임 구조 변경으로 기존의 (도달 불가능했던) check-then-act 캐싱 패턴도 함께 제거됨 — 개선 방향. | `.github/workflows/harness-checks.yml:66-68`, `.github/workflows/review-gate.yml:36-38`, `.claude/_shared/git_probe.py:41-90` | 조치 불필요. |
| 10 | 의존성 | 이번 라운드(및 브랜치 전체 14커밋)는 새 외부 패키지를 도입하지 않았다. 유일한 non-stdlib 의존(PyYAML)은 기존 pin(`>=6,<7`) 재사용이며 3개 워크플로 간 pin 일치를 `PyYamlPinsAgreeTest`가 뮤테이션으로 검증된 상태로 지키고 있다. GH Actions 버전 핀(`@v7`)도 저장소 전체 관행과 일치. | 브랜치 전체 diff, `.github/workflows/{harness-checks,deps-security-checks}.yml`, `.claude/tests/test_review_gate_ci.py:807-825` | 조치 불필요. |
| 11 | 아키텍처/의존성 | `_shared/git_probe.py` → `hooks/_lib` 역방향 의존이 이번 라운드에서 제거됐다 — 이전엔 `importlib.util.spec_from_file_location`으로 `branch_guard.py`를 동적 로드하는 안티패턴이었으나, `_origin_default_branch` 정본을 `_shared`로 옮기고 `branch_guard.py`가 위임하는 방향으로 뒤집혀 이제 `hooks/_lib → _shared` 단방향. | `.claude/_shared/git_probe.py:34-35, 46-85` | 조치 불필요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| side_effect | CRITICAL | `_origin_default_branch()`가 actions/checkout 위상에서 네트워크 폴백에 의존, 폴백 실패 시 CI 백스톱이 조용히 "통과"로 뒤집힘(라이브 재현) |
| testing | HIGH | 같은 함수가 하네스 전체에서 실경로 테스트 커버리지 0 — mutation으로 branch_guard 무력화 실증. 부수로 test_block_integrity.py의 raise-only 면제 과다포섭 |
| security | LOW | 판정 코드 자체가 PR HEAD에서 로드돼 조작 가능(`--enforce` 전제 밖 신뢰축), git-probe 중복검출이 이름-매칭 한정 |
| performance | LOW | review 커버리지 판정 전체 선형 스캔 캐시 없음, Method 2 타임아웃(2s)이 실측(2.6~3.7s)보다 짧음 |
| architecture | LOW | 죽은 `if True:`, 기본 브랜치 해석 로직이 4곳 중복(2곳 통합 범위 밖, 계약 상이) — 레이어 경계·역방향 의존 제거는 긍정적 |
| requirement | LOW | `_origin_default_branch` 실경로 미커버(WARNING 등급), plan_guard 주석 "다섯"→실제 "여섯" drift, spec 불일치 없음 |
| scope | LOW | 이번 라운드가 남긴 죽은 `if True:`, 티켓과 무관한 `ResolutionMarkerPathIsConsistentTest` 동봉(plan 이력 미기재) |
| maintainability | LOW | 스캔 대상 모듈 목록 여전히 하드코딩(10R이 고친 것과 동일 클래스 재발 가능), 테스트 부트스트랩 헬퍼 5곳 복제 |
| documentation | LOW | tests/README.md가 10R의 검증 방식 변경(AST 비교)과 신규 클래스(`ResolutionMarkerPathIsConsistentTest`)를 반영 안 함 |
| dependency | LOW | 신규 외부 패키지 없음(긍정), `RESOLUTION_MARKER_SUBDIR` 4곳 손 복제는 "테스트 핀"으로만 완화(git 프로브보다 약함) |
| concurrency | NONE | 동시성 프리미티브 전무(스레드/락/async 없음), 신규 결함 없음. 범위 밖 기존 lost-update는 이미 accepted로 하향돼 재상정 안 함 |
| api_contract | NONE | 대상 15개 파일 모두 harness/CI 판정 로직·워크플로 정의이며 HTTP/REST 엔드포인트·요청/응답 스키마 없음 |
| user_guide_sync | NONE | doc-sync-matrix 22개 trigger 중 매칭 0건, `codebase/**`/`spec/**` 변경 없음 |
| database | **재시도 필요** | 리포트 산출물(`database.md`) 미확보 — DB 관점 리뷰 미반영 |

## 발견 없는 에이전트

- **api_contract** — 해당 없음(HTTP API·스키마 관련 코드 없음)
- **user_guide_sync** — 해당 없음(doc-sync-matrix 매칭 trigger 없음)
- **concurrency** — 신규 동시성 결함 없음(전부 INFO, 긍정적 확인 위주)

## 권장 조치사항

1. **[최우선]** CI 경로에서 `_default_branch()`의 네트워크 기반 재추론을 우회하도록 `github.base_ref`를 게이트에 명시 전달(`--base-ref`/env var)하거나, 워크플로에 `git remote set-head origin --auto` 스텝을 추가해 Method 1을 CI에서도 유효하게 만든다. (Critical #1)
2. `actions/checkout` 위상(init+remote add+fetch, `remote set-head` 없음)을 실제로 구성한 real-repo 회귀 테스트를 `_origin_default_branch`/`_default_branch`에 추가한다 — 현재 하네스 스위트 어디에도 `origin` remote를 구성한 테스트가 없다. (Critical #1)
3. Method 2(`git remote show origin`)의 타임아웃을 실측치(≥3s) 이상으로 조정하거나 더 가벼운 호출(`git ls-remote --symref origin HEAD`)로 교체한다. (Warning #4, Critical #1과 근본 원인 공유)
4. `--enforce` 전환 전에 `.claude/hooks/_lib/**`·`.claude/_shared/**`에 대한 branch-protection(CODEOWNERS 등)을 plan 문서 전제조건에 명시한다. (Warning #1)
5. `database` reviewer를 재실행(또는 미실행 사유 확인)해 DB 관점 커버리지 갭을 해소한다.
6. 여유가 있을 때: `.claude/tests/README.md`의 10R drift 2건(Warning #11, #12) 갱신, `plan_guard.py` 주석 개수 정정(Warning #6), 죽은 `if True:` 정리(Info #1) — 전부 기능 영향 없는 낮은 비용의 정리 작업.

## 라우터 결정

- `routing_status=skipped` — 사유: `--route=all`. 전체 14개 reviewer 실행 대상(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync)이었으나, 세션 디렉터리에는 **13개 리포트만 실재**한다(`database.md` 산출물 없음 — 위 상단 경고 참조). `_retry_state.json`의 `agents_forced`(documentation, maintainability, requirement, scope, security, side_effect, testing)는 `--route=all`로 라우터가 아예 스킵됐음에도 "만약 라우팅했다면 강제 포함됐을 목록"으로 함께 기록돼 있을 뿐, 실제 실행 여부에는 영향이 없었다(어차피 전원 실행 대상).

---

## 후속 정정 (main, database 재실행 후)

본 SUMMARY 는  리뷰어 산출물이 없는 상태(13/14)에서 작성됐고 그 사실을 스스로
경고했다. 재실행 완료 — **발견 없음(위험도 NONE)**. 이 changeset 은 하네스 Python·CI YAML·
문서로만 구성돼 DB 관점 검토 대상이 없다. 최종 집계는 **14/14, CRITICAL 1** 로 변동 없다.
