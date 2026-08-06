# Code Review 통합 보고서

## 운영 관측 (판정에 앞서 반드시 인지) — 리뷰 도중 작업 트리가 미커밋 상태로 계속 변경됨

`architecture`·`maintainability`·`requirement`·`security`·`side_effect`·`dependency` 6개 reviewer 가
**독립적으로** 같은 사실을 관측했다: 이 리뷰 세션(`13_33_32`)이 조립한 프롬프트는 HEAD 커밋
`88ce9994d`("CI 백스톱 8R") 스냅샷을 담고 있는데, 리뷰가 진행되는 동안 **다른 프로세스가 같은
워크트리에서 커밋 없이 파일을 계속 고쳤다**:

```
$ git status --porcelain   (요약 작성 시점에도 여전히 동일)
 M .claude/hooks/_lib/plan_guard.py
 M .claude/hooks/_lib/review_guard.py
 M .claude/tests/test_plan_guard.py
?? .claude/_shared/git_probe.py
```

내용은 두 훅이 손으로 복제해 갖고 있던 `_run_git`/`_repo_root`/`_default_branch`/`_merge_base`/
`_porcelain_path` 5개 함수를 신규 `.claude/_shared/git_probe.py` 로 위임 통합하는 리팩터 — 정확히
아래 **Critical #3**이 지적하는 결함 클래스에 대한 구조적 수정이 **미완성·미커밋 상태로 진행 중**이다.
모든 reviewer 는 작업 트리를 직접 건드리지 않고 프롬프트가 지시한 HEAD 스냅샷을 기준으로 판정했다.
**이 미완성 리팩터를 이번 라운드 안에 완료·커밋할지 되돌릴지를 오케스트레이터가 먼저 결정해야
하며**, 그 리팩터 자체에도 죽은 코드·역방향 의존 등 잔여 결함이 있다(WARNING #1~#6).

## 전체 위험도

**CRITICAL** — (1) `_summary_is_resolved()` 파싱 결함이 mutant 아닌 실물 코드로, 표 행 없는
서술형 HIGH/CRITICAL 리포트를 `RESOLUTION.md` 없이 "resolved" 로 통과시키는 것이 `evaluate_review()`
까지 관통해 재현됨(로컬 push 훅과 CI 백스톱이 공유하는 단일 판정 함수). (2) `_shared/report_paths.py`
/`block_integrity.py` 가 CI-env 분기 방어선 사정거리 밖에 있어 `--enforce` 전환 전에 닫아야 하는
갭(오늘은 비활성). (3) git 프로브 5개 함수의 손-복제가 이미 두 라운드 연속 실제 회귀(fail-open →
거짓 차단)를 냈고, HEAD 기준으로는 아직 해소되지 않았다(구조적 수정이 미커밋 상태로 진행 중).

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `_summary_is_resolved()` 의 위험도 파싱: "## 전체 위험도" heading **보다 앞서** 오는 헛매치(decoy) 한 줄만 있으면 바깥 `for` 루프가 무조건 `break` 되어 진짜 heading 이하 레벨을 다시 스캔하지 않는다. 표 행 없는 서술형 HIGH/CRITICAL 리포트가 `RESOLUTION.md` 없이도 "resolved" 로 게이트를 통과. mutant 가 아닌 실물 코드로 `evaluate_review()` 까지 관통시켜 verdict 뒤집힘을 재현(로컬 push 훅과 CI 백스톱이 공유하는 판정 함수). 이미 커밋된 SUMMARY.md 808개 중 6개가 이 형태(heading 아닌 곳에서 먼저 매치)를 갖고 있음 — 조작 불필요, 살아있는 지뢰. | `.claude/hooks/_lib/review_guard.py` `_summary_is_resolved` 526~544행 (바깥 루프 무조건 `break`, 544행) | 바깥 루프의 `break` 를 안쪽 루프가 실제로 레벨을 찾았을 때만 실행하도록 수정. "heading 전 헛매치" 케이스를 `RiskLevelWindowTest` 에 회귀 테스트로 추가(실제 6건 사례 중 최소 1건 포함해 손-선별 코퍼스 한계 보완) |
| 2 | security | `evaluate_review()` 가 실제 판정(Gate1 강제 리뷰어 커버리지, Gate2 BLOCK 하향 감지)을 위임하는 `_shared/report_paths.py::has_report` / `_shared/block_integrity.py::summary_block_verdict` 가 6R~7R 이 쌓은 CI-env 분기 방어선(정적 스캔 `_SCANNED`, 동적 bare/CI 비교 fixture) 어느 쪽 사정거리에도 들지 않는다. 두 함수에 `GITHUB_JOB=="gate"` 분기를 뮤테이션으로 심었더니 관련 4개 테스트 파일(127개 테스트) 전부 그린. 오늘 실제 env 접근 0건이라 활성 백도어는 아니지만, `_shared/**` 가 `review-gate.yml` 트리거 경로에 포함돼 있어 이 파일을 고치는 PR 이 자기 자신 위에서 백도어를 즉시 활성화-검증 없이 통과시킬 수 있는 구조. | `.claude/_shared/report_paths.py:80`, `.claude/_shared/block_integrity.py:152`; 정적 스캔 `_SCANNED`는 `.claude/tests/test_review_gate_ci.py:603` | `_SCANNED` 에 `_shared/report_paths.py`/`_shared/block_integrity.py`(및 향후 `_shared/*` 전부)를 등재하거나 스캔 대상을 동적 계산으로 전환. `TheRealGateIgnoresTheEnvironmentTest` fixture 를 Gate1/Gate2 가 실제로 이 두 함수를 호출하는 모양(SUMMARY.md+`_retry_state.json`, spec+code glob 세션)으로 확장. `--enforce` 전환 전 필수 |
| 3 | architecture (+ dependency/maintainability/requirement/side_effect/security 교차 확인) | `_run_git`/`_repo_root`/`_default_branch`/`_merge_base`/`_porcelain_path` 5개 함수가 `plan_guard.py`/`review_guard.py`/`branch_guard.py` 세 모듈에 AST 기준 완전 동일하게 손-복제돼 있고, 이 정확한 중복이 이미 두 라운드 연속 실회귀를 냈다(7R: `review_guard._run_git` 만 `.strip()`→`.rstrip()` 수정, `plan_guard.py` 사본엔 전파 안 됨 → 8R: 그 잔존 결함이 "정상 갱신한 plan 이 미갱신으로 오판돼 push 거짓 차단"으로 재발견). 위 운영 관측대로 `.claude/_shared/git_probe.py` 로 위임 통합하는 수정이 진행 중이나 **여전히 미완성·미커밋**(branch_guard.py 미포함, 죽은 import 잔존, `_shared`→`hooks/_lib` 역방향 의존 등 잔여 결함은 WARNING 참조). | `.claude/hooks/_lib/plan_guard.py` 98-176행, `.claude/hooks/_lib/review_guard.py` 224-314행, `.claude/hooks/_lib/branch_guard.py` 35-70행 (HEAD `88ce9994d` 기준) | 5개 함수를 `_shared/git_probe.py` 로 완전히 추출하고 `branch_guard.py` 포함 세 소비자 모두 위임하게 한 뒤, 객체 동일성 + AST 로 로컬 재정의 부재를 고정하는 회귀 테스트(`GitProbesAreNotReDuplicatedTest` 류)와 함께 **커밋을 완료**할 것 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | dependency, side_effect, maintainability | (진행 중·미커밋 git_probe 리팩터의 부작용) `_shared/git_probe.py` 가 import 시점에 `sys.path.insert(0, hooks/_lib)` 를 실행해, `_shared` 패키지 자신이 문서화한 "hooks/skills 어느 쪽도 소유하지 않는다" 원칙을 반대 방향으로 깬다(실측 재현: import 만으로 `hooks/_lib` 가 그 프로세스의 `sys.path` 에 영구 추가됨). 오늘은 이름 충돌 없으나 `_shared` 의 기존 소비자인 skills 오케스트레이터 3곳이 향후 `git_probe` 를 끌어쓰면 활성화될 잠재 위험. | `.claude/_shared/git_probe.py:39-45` | `_origin_default_branch` 해석을 `_default_branch()` 호출 시점의 지연 import 로 옮기거나, `branch_guard._origin_default_branch` 자체를 `_shared` 로 이관해 역방향 의존을 제거 |
| 2 | dependency, maintainability, side_effect, architecture | 같은 미커밋 리팩터가 두 훅에 죽은 `try: from branch_guard import _origin_default_branch except: _origin_default_branch = None` 블록을 남김 — `_default_branch` 가 이제 `_git_probe._default_branch` 로 완전 위임돼 이 지역 바인딩은 어디서도 읽히지 않는다("가짜 seam"). 향후 `mock.patch.object(pg/rg, "_origin_default_branch", ...)` 로 목킹을 시도하면 조용히 무효화됨(현재 그런 테스트는 없음). | `plan_guard.py:62-71`(≈66-71행), `review_guard.py:124-129` | 죽은 블록 제거(동작은 `_shared/git_probe.py` 가 전담한다는 사실만 필요시 주석으로 남김) |
| 3 | side_effect | 새 위임 모듈 `.claude/_shared/git_probe.py` 가 CI-env 정적 스캐너(`TheGateItselfDoesNotBranchOnCiEnvTest._SCANNED`, `.claude/hooks/_lib/` 만 스캔)의 대상 목록/경로 계산 밖에 있다 — 판정을 가르는 최하위 git 파싱 primitive 가 정적 커버리지 밖으로 나가고 행위 테스트(`TheRealGateIgnoresTheEnvironmentTest`) 하나에만 의존하게 됨(오늘은 `git_probe.py` 가 env 를 전혀 안 읽어 실해 없음). | `.claude/tests/test_review_gate_ci.py:603`(`_SCANNED`), `.claude/_shared/git_probe.py` | `_SCANNED`/스캔 경로 계산에 `.claude/_shared/git_probe.py` 를 포함하거나, 클래스 독스트링에 "행위 테스트가 실질 백스톱이고 이 목록은 참고용" 명시 |
| 4 | maintainability | 같은 미완성 리팩터가 남긴 추가 죽은 코드: 미사용 `import subprocess`(더는 `subprocess.*` 호출 없음), 미참조 `THIS_DIR`, 삭제된 함수 자리의 과도한 연속 빈 줄. | `plan_guard.py:49,64,120-124`, `review_guard.py:115,217-224` | 미사용 import/변수 제거, 빈 줄을 PEP8 관례(top-level 사이 2줄)로 정리 — 커밋 전 |
| 5 | maintainability | `.claude/_shared/git_probe.py` 모듈 docstring 5행에 인코딩 깨진 문자("匹")가 섞여 있음. | `.claude/_shared/git_probe.py:5` | 오타 정정(원 의도 "all five were identical" 류로 추정, 원 작성자 확인 필요) |
| 6 | maintainability, documentation, requirement | git_probe 위임 리팩터(및 8R 신규 테스트 클래스 `PorcelainPathSurvivesOnARealRepoTest`)가 `.claude/tests/README.md` 테스트 카탈로그와 `test_plan_guard.py` 모듈 docstring 에 아직 반영되지 않음(전용 `test_git_probe.py` 도 없음). 8R 커밋 메시지는 "README 카탈로그 2행 재작성"을 주장하나 실제로 갱신된 것은 `test_review_gate_ci.py`/`test_workflow_yaml_structure.py` 행뿐, `test_plan_guard.py` 행(62행)은 이전과 글자 하나 다르지 않음. | `.claude/tests/README.md:62`, `.claude/tests/test_plan_guard.py:1-11` | README 62행에 신규 클래스·그것이 고친 결함(7R/8R `.strip()` 회귀)을 `test_review_guard_hardening.py` 행(57행)과 동등한 수준으로 명시, `git_probe.py` 추출 커밋 시 함께 반영 |
| 7 | architecture | 푸시 게이트가 소비하는 "결정" 계약(`push_blocks: bool`, `reason: str`)이 `ReviewDecision`/`PlanDecision`/`branch_guard.GuardDecision`(필드명도 다름) 셋 다 Protocol/ABC 없이 관례로만 유지 — 이미 실제 사고가 난 자리(`test_stop_guard_failopen.py` 주석이 "`push_blocks` 없는 스텁 때문에 fail-open 이 exit 0 으로 위장돼 리뷰어가 stderr 를 읽기 전까지 몰랐다"고 직접 서술). | `review_guard.py::ReviewDecision` 194-203행, `plan_guard.py::PlanDecision` 86-95행, 소비부 `guard_review_before_push.py:874` | `typing.Protocol` 로 `push_blocks`/`reason` 최소 계약을 명문화하고 게이트 순회부 타입 힌트를 그걸로 걸어 정적 분석이 다음 결함을 커밋 전에 잡게 함 |
| 8 | security, requirement, testing | `branch_guard.py` 가 `_run_git` 을 (git_probe 통합에서 빠진) 독립 사본으로 여전히 갖고 있고 `.strip()`(`.rstrip()` 아님) — 7R/8R 이 고친 것과 동일 결함 모양의 세·네 번째 사본. 오늘은 이 모듈이 `git status --porcelain` 을 호출하지 않아 도달 불가. | `.claude/hooks/_lib/branch_guard.py:35-47` | git_probe 통합 대상에 `branch_guard.py` 도 포함하거나, 최소한 `.strip()` → `.rstrip()` 으로 정정해 향후 porcelain 파싱 추가 시 재발 방지 |
| 9 | requirement | `plan_guard.evaluate_plan()` 의 committed-diff 경로(`_committed_changes`/`_merge_base`/`_default_branch`)가 실물 git 저장소로 끝까지 구동하는 테스트 없이 전량 mock — `_committed_changes` 를 `return []` 로 무력화한 뮤턴트에서도 `test_plan_guard.py` 31개 전부 그린(같은 뮤턴트를 `review_guard._committed_code_changes` 에 적용하면 2건 즉시 RED). 수동 재현으로 오늘 정상 동작은 확인했으나(활성 결함 아님), 이 파일이 이미 두 번(7R/8R) "mock 으로만 구동돼 실결함을 놓친" 클래스의 당사자였다는 점에서 회귀 감지 능력 부재 자체가 위험. | `.claude/hooks/_lib/plan_guard.py:178-184` 등; 테스트 갭은 `.claude/tests/test_plan_guard.py`(`PorcelainPathSurvivesOnARealRepoTest`/`EvaluatePlanDecisionTableTest`) | `review_guard.py` 의 `NotesReachThePublicEntryPointTest`/`RebaseAuthorDateTest` 패턴으로, 실물 임시 git 저장소에서 plan 갱신 커밋 후 `evaluate_plan()` 을 목 없이 끝까지 구동하는 테스트 추가 |
| 10 | documentation | 정정 각주가 원문장을 고치지 않고 옆에 남겨, 존재하지 않는 함수명(`_changed_code_files`)이 본문에 현재형으로 여전히 서술되는 자기모순 상태로 8R 에 커밋됨. | `.claude/tests/test_review_guard_hardening.py:663-666` | 663-664행을 실제 함수명(`_uncommitted_code_changes`/`_dirty_set`)으로 직접 수정하고, 665-666행 각주는 제거하거나 한 줄로 축약 |
| 11 | documentation | `plan/in-progress/harness-review-gate-ci-backstop.md` 의 라운드 이력이 세 축 모두에서 실제 진행보다 뒤처짐: (a) 18행 배너 "1R~6R 진행 중"이 8R 까지 진행된 실제와 2라운드 이상 어긋남, (b) 24-34행 라운드 이력 표가 7R 에서 멈춰 8R(우회 0 + C1 설계결정 + C2 살아있던 결함)이 미등재 — 특히 C2(plan_guard 자매 결함)는 문서 전체에 단 한 번도 언급되지 않음, (c) 60행 "신규 후속 11건" 표기가 실제 13개 항목보다 뒤처짐. | `plan/in-progress/harness-review-gate-ci-backstop.md:18,24-34,60` | 18행을 "1R~8R 완료" 로, 표에 8R 행(C1/C2) 추가, 60행을 실제 개수(13)로 정정 |
| 12 | performance | `evaluate_review()` 의 두 freshness 함수(`_newest_resolved_review_mtime`/`_newest_resolved_impl_done_mtime`)가 필요한 건 "최신 resolved 세션 1개"뿐인데 `review/code`·`review/consistency` 이력 **전체**를 캐시·조기종료 없이 매번 선형 재스캔한다. 코드 변경이 있는 브랜치에서는 **매 assistant turn(Stop 훅)마다 무조건** 재계산되고(throttle 은 메시지 재출력만 억제, 계산 자체는 매번 재실행), 이번 브랜치가 신설한 CI 백스톱으로 PR마다도 반복. 실측: 저장소 실제 규모(800+738 세션)에서 ~0.09-0.17초, 자체 합성 벤치마크(n=200→3200)로는 순수 선형(4배 입력 → 4배 시간) 확인 — correctness 문제는 아니나 이력이 무기한 증가하는 이 프로젝트 특성상 체감 지연으로 이어질 방향. | `.claude/hooks/_lib/review_guard.py:438,573,755,795,1021-1022`, `.claude/hooks/guard_review_before_stop.py:350` | 세션 디렉터리명(`Y/m/d/H_M_S`)이 이미 시각순 정렬 가능하므로, 최신부터 역순 순회하며 첫 resolved 세션에서 즉시 반환하도록 변경(캐시 무효화 로직 불필요, 사실상 O(1)) |
| 13 | maintainability | 실 git 저장소를 구동하는 `_git`/`_write` 헬퍼 쌍(약 12-15줄)이 3개 파일 6개 테스트 클래스에 근-완전 동일하게 반복됨 — `test_review_gate_ci.py` 자신의 `_run()` docstring 이 정확히 이 종류의 중복 위험을 지적하면서도 `_git`/`_write` 자체는 중복해 갖고 있음. | `test_plan_guard.py::PorcelainPathSurvivesOnARealRepoTest`, `test_review_guard_hardening.py`(3클래스), `test_review_gate_ci.py`(2클래스) | `_harness.py` 에 `RealGitRepoTestCase` 믹스인(또는 함수 헬퍼)으로 추출 |
| 14 | scope | `plan_guard.py::_run_git` 의 `core.quotePath=false`/`rstrip()` 수정은 이 브랜치 표제 기능(리뷰 게이트 CI 백스톱)과 무관한 **다른 게이트**(plan-coverage push 게이트)의 라이브 결함 수정인데(코드·테스트 자체는 건전), 이 브랜치의 SoT 인 plan 문서 어디에도 "왜 plan_guard 도 건드렸는지" 교차 참조가 없다(grep 0건) — 이 저장소가 이미 "손-동기 쌍 drift" 로 세 번 겪은 추적성 문제를 정정하면서 또 한 번 반복. | `.claude/hooks/_lib/plan_guard.py:98-127`, `plan/in-progress/harness-review-gate-ci-backstop.md`(매치 없음) | 코드는 유지하되, plan 문서(또는 plan_guard 를 소유하는 completed plan)에 한 줄 교차 참조 추가 |
| 15 | side_effect | (프리엑시스팅, 이번 라운드 변경분 아님) `os.environ.pop("BYPASS_REVIEW_GUARD", None)` 이 저장/복원 없이 테스트 헬퍼에 남아 있음 — 바로 위 `CLAUDE_PROJECT_DIR` 는 `addCleanup` 으로 정확히 복원하는 것과 대비. 로컬에서 그 env 를 export 한 채 같은 프로세스로 스위트를 돌리면 이후 테스트에 값이 사라진 채 남는다(CI 는 잡별 신규 프로세스라 실전 영향 없음). | `.claude/tests/test_review_guard_hardening.py:540` 부근(`StopResolutionSuppressionTest._run_stop`) | 이전 값을 저장했다가 `addCleanup` 으로 복원하는 패턴을 같은 방식으로 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | Gate2 가 Gate1 이 이미 조회한 파일 부분집합(`spec_linked ⊆ changed`)에 대해 `git log` 를 한 번 더 돌림(중복 계산, 체감 비용은 미미). | `review_guard.py:1021`(`_newest_code_mtime` for `changed`) vs `:1044`(동일 함수 for `spec_linked`) | `_newest_commit_time` 을 `{path: author_date}` 맵으로 바꿔 Gate1/Gate2 가 한 번의 `git log` 결과를 공유 |
| 2 | performance | 하네스 테스트 스위트 실행시간이 라운드마다 증가하는 추세(실측 844 tests, 84.95초 — `harness-checks.yml` timeout 300초 대비 아직 ~28% 여유). 지금 조치 불요, 감시 대상. | `.claude/tests/test_*.py`(실물 git 저장소 구동 클래스들) | 없음(관찰 기록) |
| 3 | architecture | `scripts/check-review-gate.py` 가 "package-private" 를 신호하는 `.claude/hooks/_lib` 를 `sys.path` 조작으로 직접 소비 — 판정 로직 이중화(로컬/CI drift) 방지라는 의도적·근거 있는 트레이드오프. `review-gate.yml` 의 `paths:` 트리거가 이미 이 결합을 등재해 배선 자체는 안전. | `scripts/check-review-gate.py:63-74`(특히 65행) | 강제 아님 — `_lib/__init__.py` 또는 모듈 docstring 에 "이 디렉터리는 두 번째 프로덕션 소비자(CI 스크립트)를 갖는다" 한 줄 문서화 제안 |
| 4 | requirement | spec fidelity — 이 변경 영역(harness/CI 백스톱)을 정의하는 `spec/` 문서는 없음(제품 표면이 아니라 harness 거버넌스라 정상). 사실상의 spec 인 plan 문서와 구현을 line-level 로 대조해 불일치 없음을 확인(`pull_request.paths` 목록 일치, `--enforce` 미부착, `fetch-depth: 0` 존재 등). | `plan/in-progress/harness-review-gate-ci-backstop.md`, `.github/workflows/review-gate.yml:67` | 없음(기록용) |
| 5 | security | 위조 가능한 산출물(SUMMARY.md/RESOLUTION.md 직접 커밋으로 게이트 통과) 신뢰 모델은 plan 문서의 "`--enforce` 전환의 선행 조건" 항목이 이미 실증하고 사용자 결정으로 남긴 기록된 설계 결정 — 이번 라운드에서 뒤집을 새 근거 없음. | `plan/in-progress/harness-review-gate-ci-backstop.md` | 없음(기록 유지) |
| 6 | security | `scripts/check-review-gate.py` 자체(`OneJudgeTest` 의 import/call allowlist, env-이름 금지)는 소스와 정확히 일치하며 `_ALLOWED_IMPORTS`/`_ALLOWED_CALLS` 밖 호출 없음 — 이 층은 견고, 갭은 그 아래 `_shared/**` 위임 경계(Critical #2)에 있음. | `scripts/check-review-gate.py` | 없음 |
| 7 | testing | `WorkflowWiringTest.EXPECTED` 등 CI 워크플로 배선·환경변수 비분기·판정자 단일성 가드(6~9R 누적분)가 실물 `review-gate.yml`/`harness-checks.yml` 과 필드 단위로 정확 일치 — 새 우회 없음. | `.github/workflows/review-gate.yml`, `.claude/tests/test_review_gate_ci.py` | 없음 |
| 8 | api_contract, database | 이번 변경 세트(13개 harness/CI 파일)는 `codebase/**` 등 제품 REST/HTTP API·DB 계층을 전혀 포함하지 않아 두 관점 모두 평가 대상 없음. | — | 없음 |
| 9 | user_guide_sync | `doc-sync-matrix.json` 22개 trigger 전수 확인 — 변경 파일 7개(`.claude/hooks/_lib/**`, `.claude/tests/**`)가 매칭되는 trigger 0건, 동반 갱신 누락 0건. | — | 없음 |
| 10 | concurrency | round 9 실제 diff(git 프로브 DRY 추출 + 배선 테스트)는 신규 잠금·스레드·async·공유 가변 상태를 추가하지 않음. `sys.path` check-then-act 는 단일 프로세스 실행 모델에서 실질 경쟁 없음. `resolution_in_flight` 마커·CI `concurrency:` 그룹 등 인접 메커니즘도 기존 설계로 이미 봉쇄돼 있어 새 조치 불요. | `.claude/_shared/git_probe.py`, `.github/workflows/*.yml` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | CRITICAL | `_summary_is_resolved` heading-앞 헛매치로 verdict 뒤집힘 — mutant 아닌 실물 재현 |
| security | HIGH | `_shared/report_paths.py`/`block_integrity.py` 가 CI-env 방어선 사정거리 밖 (CRITICAL 항목 포함) |
| architecture | HIGH | git 프로브 5-함수 손-복제(이미 2회 실회귀), 구조적 수정이 미완성·미커밋 상태로 진행 중 |
| maintainability | MEDIUM | 미완성 git_probe 리팩터의 죽은 코드·문서 미반영, `_git`/`_write` 헬퍼 중복 |
| performance | MEDIUM | freshness 스캔이 캐시·조기종료 없는 순수 O(N), 매 Stop 훅/PR 마다 반복 |
| dependency | LOW | git_probe.py 의 `sys.path` 역방향 부작용, 죽은 `branch_guard` import |
| documentation | LOW | 정정 각주 자기모순, README 카탈로그 미반영, plan 문서 라운드 이력 staleness |
| requirement | LOW | plan_guard committed-diff 경로 mock-only 커버리지 갭, README 미반영 |
| scope | LOW | plan_guard 수정의 plan 문서 교차 참조 누락(코드 자체는 표제 범위 내) |
| side_effect | LOW | 죽은 import 목킹 함정, git_probe.py 가 CI-env 정적 스캐너 목록 밖 |
| concurrency | NONE | 발견 없음 |
| api_contract | NONE | 평가 대상 없음(API 표면 부재) |
| database | NONE | 평가 대상 없음(DB 계층 부재) |
| user_guide_sync | NONE | 매칭 trigger 0건 |

## 발견 없는 에이전트

concurrency, api_contract, database, user_guide_sync — 모두 "발견 없음"/"해당 없음"으로 명시 판정(위험도 NONE).

## 권장 조치사항

1. **[최우선]** `_summary_is_resolved()` 의 바깥 루프 `break` 조건을 수정 — heading 전 헛매치를 만나면 계속 다음 "전체 위험도" 매치를 찾도록 바꾸고, "heading 앞 헛매치" 케이스(실제 SUMMARY.md 6건 사례 포함)를 `RiskLevelWindowTest` 에 회귀 테스트로 추가. 로컬 push 훅과 CI 백스톱이 공유하는 단일 판정 함수이므로 양쪽 다 즉시 해소된다.
2. **[최우선]** `TheGateItselfDoesNotBranchOnCiEnvTest._SCANNED` 에 `_shared/report_paths.py`/`_shared/block_integrity.py`(및 향후 `_shared/*` 전부)를 등재하고, `TheRealGateIgnoresTheEnvironmentTest` fixture 를 Gate1/Gate2 실제 호출 경로가 지나가도록 확장 — `--enforce` 전환 전 필수.
3. 현재 미커밋 상태인 `.claude/_shared/git_probe.py` 추출 리팩터의 완료 여부를 결정하고, 완료한다면 (a) `branch_guard.py` 도 위임 대상에 포함, (b) 죽은 import(`_origin_default_branch` try/except, `subprocess`, `THIS_DIR`)와 과도한 빈 줄 제거, (c) `sys.path` 역방향 의존 제거(지연 import 또는 `_origin_default_branch` 이관), (d) `_SCANNED`에 `git_probe.py` 등재, (e) README/docstring 갱신 — 을 모두 함께 **커밋**하여 마무리할 것. (Critical #3 의 해소 조건)
4. `push_blocks`/`reason` 게이트 결정 계약을 `typing.Protocol` 로 명문화해 다음 게이트 추가 시 같은 클래스의 실사고("스텁이 push_blocks 를 빠뜨려 fail-open 이 exit 0 으로 위장") 재발을 정적 분석으로 방지.
5. `plan_guard.evaluate_plan()` 의 committed-diff 경로에 실물 git 저장소 기반 목-없는 테스트를 추가하고, `evaluate_review()` freshness 스캔을 세션 디렉터리 시각순 역순회 + 조기 반환으로 바꿔 O(1)에 가깝게 최적화.
6. 문서 정합성 부채(README 테스트 카탈로그 62행, plan 문서 라운드 이력/개수 표기, 정정 각주 자기모순, plan_guard 수정의 plan 교차 참조)를 한 커밋으로 모아 정리 — 모두 동작 영향 없는 순수 문서 결함이므로 후속 우선순위로 처리 가능.

## 라우터 결정

`routing_status=skipped` — 사유: `--route=all`. 전체 14개 reviewer 실행.

참고로 `_retry_state.json` 에는 파일-유형 기반 강제 목록(`agents_forced`, router 미실행 상태에서도 기록됨)이 남아 있다 — `documentation`(문서 파일 변경), `security`/`requirement`/`scope`/`side_effect`/`maintainability`/`testing`(소스 코드 변경, 항상 적용). `--route=all` 이 이미 전원을 포함하므로 이 목록은 실질적 배제 없이 정보성으로만 유효하다. `agents_skipped` 는 빈 배열 — 제외된 reviewer 없음.

---

관련 파일 경로(모두 절대경로):
- `/Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379/review/code/2026/08/06/13_33_32/{api_contract,architecture,concurrency,database,dependency,documentation,maintainability,performance,requirement,scope,security,side_effect,testing,user_guide_sync}.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379/review/code/2026/08/06/13_33_32/_retry_state.json`, `meta.json`