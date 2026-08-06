# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — CRITICAL 은 없음. 그러나 5개 리뷰어(architecture·requirement·maintainability·side_effect·concurrency)가 **독립적으로 동일 결함**(테스트 하네스 `_git` 픽스처 미경화)을 수렴 발견했고, concurrency-reviewer 는 이 중 하나(`UnstagedModificationKeepsItsPathTest`)가 이 브랜치 자신이 신규 도입한 코드임을 확인해 MEDIUM 으로 판정 — 본 요약 작성 중 `git log -S`/`git show origin/main:...` 로 재검증한 결과도 이를 뒷받침한다(아래 Critical 섹션 위 비고 참조). 판정 로직(`git_probe.py`/`review_guard.py`/`plan_guard.py`/`branch_guard.py`/워크플로 YAML) 자체에는 이번 라운드가 새로 도입한 결함이 없다는 데 전 리뷰어가 일치한다.

**비고(재시도 상태 관련)**: `_retry_state.json` 은 14개 reviewer 전원을 `agents_pending` 으로, `agents_success` 를 빈 배열로 기록하고 있어 장부상으로는 미완료처럼 보인다. 그러나 세션 디렉터리에 14개 reviewer 보고서(`security.md`~`user_guide_sync.md`) 파일이 전부 존재하고 각각 완결된 STATUS/위험도까지 포함하고 있어, 이 요약은 그 실물 파일을 authoritative 로 취급했다. 즉 **재시도 필요 0건** — 다만 장부 자체의 stale 상태는 하네스 신뢰성 관점에서 별도로 기록해 둘 가치가 있다(과거 "Workflow disk-write 갭" 패턴과 동일 모양).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 하네스 / 부작용 / 동시성 | 이번 라운드(및 이 브랜치)가 "전수 조사 후 경화"했다고 주장한 `_git()` git 픽스처 헬퍼 패턴이, 정작 **자신이 편집·소유한 파일 안에** 미경화 사본 3곳(및 유사 패턴 1곳 추가)으로 남아 있다. `RebaseAuthorDateTest._git`(L275)·`NotesReachThePublicEntryPointTest._git`(L588)은 origin/main 에 이미 존재하던 pre-existing 노출이고, `UnstagedModificationKeepsItsPathTest._git`(L677)은 **이 브랜치 자신의 커밋(7R, `cd38361ac`)에서 신규 도입**된 것으로, `origin/main` 에는 없음(요약 작성 중 `git show origin/main:.claude/tests/test_review_guard_hardening.py` 로 재검증 — `RebaseAuthorDateTest`/`NotesReachThePublicEntryPointTest`는 origin/main 에 존재하나 `UnstagedModificationKeepsItsPathTest`는 부재). 세 곳 모두 `-C`/`GIT_CEILING_DIRECTORIES`/임시-루트-밖 assert 없이 `subprocess.run(["git", *args], cwd=self.root, ...)` 형태 그대로다. requirement-reviewer 는 추가로 `test_consistency_context_budget.py:284` 도 같은 미경화 패턴이라고 지적(plan 문서 §13 "pre-existing 4곳" 목록에도 이 중 어느 것도 없음 — 즉 8곳 중 4곳이 조사에서 누락). | `.claude/tests/test_review_guard_hardening.py:275,588,677`(대조: 경화된 `ActionsCheckoutTopologyTest._git:851`), `.claude/tests/test_consistency_context_budget.py:284` | 세 헬퍼(+`test_consistency_context_budget.py`)에 `ActionsCheckoutTopologyTest` 와 동일한 `-C <root>`+`GIT_CEILING_DIRECTORIES=root`(가능하면 realpath 경계 assert) 적용. 근본적으로는 plan 문서가 이미 이름 지어둔 `_harness.py::make_temp_git_repo()` 공용 헬퍼로 하네스 전체(10개 사본)를 흡수하고, `GitProbesAreNotReDuplicatedTest` 식의 "동일 본문 함수 잔존 시 실패" 파생 가드를 테스트 계층에도 추가. plan §13 잔여 목록을 8곳 기준으로 갱신. |
| 2 | 성능 | `_default_branch()` 가 매 호출마다 실패가 보장된 네트워크 폴백(`_origin_default_branch` Method 2, `timeout=2.0`)을 이번 라운드가 추가한 로컬 `refs/remotes/origin/<name>` 폴백보다 **항상 먼저** 실행한다. 11R RESOLUTION 은 "그 경로에 도달할 일이 없어졌다"고 닫았지만, 실측(`git remote show origin` 2.58s, `_run_git` timeout=2.0 → 매번 kill)상 이 경로는 여전히 매번, 무조건 실행되며 2.0~2.6초를 소모한 뒤에야 로컬 폴백으로 정답을 낸다. `evaluate_review()` 는 "codebase/ 변경 없음" 조기 반환보다 **앞**에서 이 함수를 호출하므로 리뷰할 게 없는 턴에도 동일 비용을 지불하고, `check-review-gate.py`(CI 백스톱)는 `refs/remotes/origin/HEAD` 가 만들어지지 않는 `actions/checkout` 위상에서 **모든 PR마다 확정** ~2초를 소모한다. | `.claude/_shared/git_probe.py:74-77,139-168`, 호출부 `.claude/hooks/_lib/review_guard.py:920`(조기반환 이전), `.claude/hooks/_lib/plan_guard.py:273` | (a) `review-gate.yml` 의 "Fetch base ref" 스텝 뒤에 `git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/"$BASE_REF"` 한 줄 추가(순수 로컬, Method 1 즉시 성공). (b) 또는 `_default_branch()` 에서 로컬 폴백을 네트워크 폴백보다 먼저 시도하도록 순서 반전(정확성 손실 없음). (c) Method 2 의 `timeout` 을 실측 지연보다 짧게(0.3~0.5s) 조정. |
| 3 | 테스트 | `_origin_default_branch` Method 1(로컬 `symbolic-ref refs/remotes/origin/HEAD`, 네트워크 불필요한 정상 경로)이 실제 git 저장소로 구동되는 테스트가 전무하다 — 결정표 테스트는 이 함수 자체를 mock 으로 우회하고, 유일한 실 저장소 픽스처(`ActionsCheckoutTopologyTest`)는 정의상 이 ref 가 없는 `actions/checkout` 위상만 재현한다(`git clone` 쓰는 fixture 는 스위트 전체에 0건). prefix-strip 로직이나 Method1/2 우선순위가 실수로 바뀌어도 854개 테스트 전부 그대로 통과한다. | `.claude/_shared/git_probe.py:63-72` | `git clone` 또는 `git remote set-head` 를 명시로 실행하는 실 저장소 fixture 를 추가해 Method 1 이 정답을 내는지 직접 단언. |
| 4 | 테스트 | `_run_git` 의 타임아웃(hang 방지) 경로(일반 5초 기본값 + Method2 의 `timeout=2.0` 클램프)가 어떤 테스트에서도 재현되지 않는다 — `TimeoutExpired`/`timeout=2` 관련 grep 0건. 클램프나 예외 타입이 리팩터 중 조용히 빠져도 854개 테스트가 그대로 통과하고 저하는 "PR마다 CI 가 멎는다" 형태로만 드러난다. | `.claude/_shared/git_probe.py:106-129`(`_run_git`), `:77`(클램프 호출부) | 가짜 `git`(sleep) 을 PATH 앞에 주입하거나 `subprocess.run` 을 `TimeoutExpired` 로 stub 해 지정 한도 안에서 `(1, "", "")` 로 복귀하는지 서브프로세스/실측 기반으로 고정. |
| 5 | 문서화 | plan 문서의 "라운드별 경화 이력" 표가 10R 에서 멈춰 있어, 이 티켓의 서사가 "the one that mattered most" 라 부르는 11R CRITICAL(`actions/checkout` 위상에서 백스톱이 무력했던 결함)과 그 회귀 테스트(`ActionsCheckoutTopologyTest`)가 표에 행으로 없다. 표만 읽는 독자는 이 결함의 존재를 알 수 없다. | `plan/in-progress/harness-review-gate-ci-backstop.md:18`(상단 "1R~10R"), `:24-46`(라운드 표) | 11R(및 필요시 12R) 행을 표에 추가하고 상단 상태 줄도 갱신. |
| 6 | 문서화 | `.claude/tests/README.md` 의 `test_review_guard_hardening.py` 행이 이번(11R)에 추가된 `ActionsCheckoutTopologyTest` — 이 라운드의 가장 중요한 회귀 테스트 — 를 전혀 언급하지 않는다. `test_tests_readme_catalog.py` 는 파일명 행 존재 여부만 검사해 이 누락을 잡지 못한다. | `.claude/tests/README.md:57` | 해당 행에 `ActionsCheckoutTopologyTest` 설명 문장 추가. |
| 7 | 문서화 | README.md 의 `test_plan_guard.py` 행이 `GitProbesAreNotReDuplicatedTest` 를 라운드 9 시점("object identity + absence of local def") 그대로 서술 — 실제로는 라운드 10 에서 AST 비교 기반 도출식 검사로 전면 재작성됐고, 그 계기(6번째 프로브 `_current_branch` 누락)도 문서에 없다. | `.claude/tests/README.md:62` | 라운드 10 재설계와 계기가 된 CRITICAL 을 한 문장 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | GitHub Actions 가 커밋 SHA 가 아니라 이동 가능한 태그(`@v7`)로 고정 — 저장소 전체 기존 컨벤션과 일관되어 이번 PR 단독 이슈 아님 | `.github/workflows/review-gate.yml:55,59`, `harness-checks.yml:80,84,105` | 저장소 차원 SHA-pin 전환은 별도 트래킹 항목으로 |
| 2 | 보안 | `pyyaml` 이 정확한 버전/해시가 아니라 범위(`>=6,<7`)로 pin — 회귀 테스트(`PyYamlPinsAgreeTest`)로 워크플로 간 최소 일치는 보장됨 | `harness-checks.yml:93` | 위험도 낮음, 조치 불요 |
| 3 | 보안 | `_default_branch()` 최종 로컬 fallback 이 origin 의 실제 기본 브랜치를 확인하지 않고 이름 우선순위(`main`→`master`)로 추정 — origin에 `main`/`master` 둘 다 존재하는 특수 토폴로지에서만 도달 가능한 극단 엣지케이스 | `.claude/_shared/git_probe.py:163-167` | 다음에 이 경로를 만질 때 회귀 테스트로 추가 고려 |
| 4 | 성능 | 신규 `ActionsCheckoutTopologyTest` 가 위 WARNING#2 의 latency 회귀를 잡지 못하는 형태(DNS 즉시-실패 도메인 사용, 정확성만 고정)로 작성됨 | `test_review_guard_hardening.py::ActionsCheckoutTopologyTest` | WARNING#2 를 코드로 닫을 때 `mock.patch` 로 Method 2 미호출을 함께 단언 |
| 5 | 성능 | 로컬 폴백 루프가 최악의 경우 `git rev-parse --verify` 4회 순차 spawn(수 ms 수준, 무시 가능) | `.claude/_shared/git_probe.py:163-167` | 조치 불필요 |
| 6 | 아키텍처 | `review_guard.py`(1,007줄, 무변경)가 4가지 관심사(git 프로브 위임/freshness clock/spec glob 매칭/in-flight 억제)를 한 모듈에 담고 있음 — 결함 유발 안 함, 다섯 번째 관심사 추가 전 분리 고려 | `.claude/hooks/_lib/review_guard.py` 전체 | 다음 확장 시 `_freshness.py`/`_spec_glob.py`/`_inflight.py` 분리 검토 |
| 7 | 문서화 | `_default_branch()` 주석이 파일 내 다른 이력 주석과 달리 라운드 번호를 명시하지 않음 | `.claude/_shared/git_probe.py:146-163` | 실제 라운드 번호(11R) 명시 |
| 8 | 문서화 | plan 문서가 `branch_guard._origin_default_branch()` 를 "정본"이라 표기하나 실제로는 `_shared/git_probe.py` 로 위임 이전됨 — 서술이 라운드 9/10 통합 이후로 stale | `plan/in-progress/harness-review-gate-ci-backstop.md:210-216` | "정본" 표기를 `_shared/git_probe.*` 로 정정 |
| 9 | 의존성 | `harness-checks.yml:83` 주석("v5/v6 line")이 실제 `v7` 사용과 불일치 — 이번 라운드 diff hunk 밖(사전 존재, 회귀 아님) | `.github/workflows/harness-checks.yml:83` | 주석 정정 또는 도출형 가드로 대체 |
| 10 | 스코프 | 지엽적 drive-by 정리 3건(주석 "다섯 개"→"이" 단어 삭제, `if True:` dead code 제거+`noqa` 추가, 신규 docstring 내 공백-only 줄) — 전부 스코프 이탈 아님 | `.claude/hooks/_lib/plan_guard.py:102`, `.claude/_shared/git_probe.py:139`, `test_review_guard_hardening.py:851` 부근 | 조치 불필요 |
| 11 | 테스트 | `check-review-gate.py::main()` 의 `getattr(decision, "notes", ()) or ()` fallback 분기가 `notes` 속성이 없는 스텁으로 실행되는 테스트가 없음(실무 영향 낮음) | `scripts/check-review-gate.py:100` | `notes` 생략 최소 스텁 테스트 1건 추가(낮은 우선순위) |
| 12 | 요구사항 | 이번 변경 영역은 `spec/` 문서 대상이 아님(harness/CI 계층, 프로젝트 관례상 정상) | N/A | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인증 우회 신규 결함 없음. INFO 3건(태그 고정, pyyaml 범위 pin, fallback 엣지케이스) |
| performance | LOW | WARNING: `_default_branch()` 네트워크 폴백이 매 호출 2~2.6초 무조건 소모(11R RESOLUTION 의 "도달 안 함" 주장과 실측 불일치) |
| architecture | LOW | WARNING: 미경화 `_git` 헬퍼 3곳(사본 패턴 재발). INFO: review_guard.py 다관심사 누적 |
| requirement | LOW | WARNING: "전수 조사" 주장이 자기 파일 안 3곳+`test_consistency_context_budget.py` 를 놓침(854 테스트 통과는 실측 확인) |
| scope | NONE | 요청 범위 정확히 준수. INFO 4건(전부 지엽적 drive-by) |
| side_effect | WARNING | 위와 동일한 미경화 `_git` 헬퍼 3곳. 그 외 실제 변경분(env 로컬 복사, `-C` 전환)은 부작용 관점에서 건전 |
| maintainability | LOW | WARNING: 동일 미경화 헬퍼 3곳, plan 문서 자체 회계에도 누락 |
| testing | LOW | WARNING 2건(Method 1 무테스트, timeout 경로 무테스트). 854 테스트 전체 통과, 회귀 없음 |
| documentation | LOW | WARNING 3건(plan 이력 표 stale, README 두 행 stale). 기능 결함 없음, 전부 문서 갱신으로 닫힘 |
| dependency | NONE | 신규 서드파티 의존성 없음, PyYAML safe_load 전용, GH Actions 버전 일관. INFO 1건(사전 존재 주석 불일치) |
| database | NONE | 대상 코드 없음(DB 계층 무관) |
| concurrency | MEDIUM | WARNING: 미경화 `_git` 헬퍼 중 `UnstagedModificationKeepsItsPathTest` 가 이 브랜치 자신이 신규 도입한 것(pre-existing 아님)으로 확인 — 이번 사고와 동일 클래스가 이 브랜치 안에서 재생산됨 |
| api_contract | NONE | 대상 코드 없음(HTTP API 표면 무관) |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 전부 `codebase/`/`spec/` 전제 — 이번 변경(harness/CI) 은 매칭 0건, 동반 갱신 누락 없음 |

## 발견 없는 에이전트

- database — 대상 코드(SQL/ORM/마이그레이션/트랜잭션) 전무
- api_contract — 대상 코드(HTTP API/DTO/라우팅) 전무
- user_guide_sync — trigger 매칭 0건(harness/CI 변경은 매트릭스 대상 밖)

## 권장 조치사항

1. `test_review_guard_hardening.py` 내 미경화 `_git` 헬퍼 3곳(`RebaseAuthorDateTest`·`NotesReachThePublicEntryPointTest`·`UnstagedModificationKeepsItsPathTest`) + `test_consistency_context_budget.py:284` 에 `ActionsCheckoutTopologyTest` 와 동일한 `-C`/`GIT_CEILING_DIRECTORIES`(+realpath assert) 를 적용한다 — 이 중 하나는 이 브랜치 자신이 신규 도입한 것으로 확인되어 최우선.
2. 근본 처방으로 `_harness.py::make_temp_git_repo()` 공용 헬퍼를 만들어 하네스 전체(10개 사본)를 흡수하고, "동일 본문 함수 잔존 시 실패"하는 파생 가드(`GitProbesAreNotReDuplicatedTest` 패턴)를 테스트 계층에도 추가해 "부분 경화가 조용히 통과"하는 재발을 구조적으로 막는다.
3. `review-gate.yml` 의 "Fetch base ref" 스텝 뒤에 `git symbolic-ref refs/remotes/origin/HEAD` 한 줄을 추가하거나 `_default_branch()` 의 폴백 순서를 반전해, 매 PR·매 push·매 turn-end 마다 확정 소모되는 2초 네트워크 타임아웃을 제거한다.
4. `_origin_default_branch` Method 1(정상 경로)과 `_run_git` 타임아웃(hang 방지) 경로에 실제-저장소/실측 기반 회귀 테스트를 추가한다.
5. plan 문서의 라운드별 경화 이력 표에 11R 행을 추가하고, `.claude/tests/README.md` 의 두 stale 행(`ActionsCheckoutTopologyTest` 누락, `GitProbesAreNotReDuplicatedTest` 서술 stale)을 갱신한다.

## 라우터 결정

- `routing_status=skipped` — 사유: `--route=all`. 전체 14개 reviewer 실행.
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 — router 미사용이라 실질적으로는 전원 실행에 포함, meta.json 상 사유는 문서/소스 변경에 대한 표준 강제 목록 적용)