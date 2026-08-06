# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — 격리 sandbox(mktemp/git clone --local)에서 5개의 독립적인 CI 백스톱 우회 경로가 재현 확인됐다. 전부 "831개 하네스 테스트가 GREEN인 채로 실제 PR의 판정을 뒤집는다"는 동일 목표를 서로 다른 층(워크플로 트리거 도형, step-level `if:`, `os.environ` 접근 문법 축, 판정자 스코프 밖의 `review_guard.py`, 워크플로 파일 identity 유일성)에서 달성한다. `--enforce`가 아직 꺼져 있어 오늘 당장의 실피해는 0이지만, plan 문서가 예고한 `--enforce` 전환 시점에 이 중 하나라도 남아 있으면 즉시 활성 결함이 된다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | CI-Wiring (security) | `harness-checks.yml`의 `on.pull_request` 트리거 자체가 무방비 — `types`/`branches` 형제 키 한 줄만 추가해도 831개 하네스 테스트 전체를 실어 나르는 CI 진입점이 영구·침묵 무력화된다. 로컬 스위트는 831/831 그대로 GREEN(mktemp 사본에서 실측). | `.github/workflows/harness-checks.yml:9-11` (`on.pull_request.paths` 블록) | `WorkflowWiringTest`가 `review-gate.yml`에 이미 건 "`pull_request` 키 집합 = `{paths}`" 불변식을, `harness-checks.yml`을 포함한 전 워크플로에 등재제로 확장 |
| 2 | CI-Wiring (performance, testing, api_contract — 3인 독립 확인) | `harness-checks.yml`의 "Run harness unit tests" step에 **step-level** `if:`를 달면 스텝이 skip되고도 job은 success로 보고된다 — `_JOB_CONDITIONS` 레지스트리는 job-level `if:`만 검사하고 step-level `if:`는 어떤 테스트도 순회하지 않는다. 831/831 GREEN 재현. | `.claude/tests/test_workflow_yaml_structure.py:193-210`(`test_job_conditions_are_registered`), 공격 표면 `.github/workflows/harness-checks.yml:88-91` | `_JOB_CONDITIONS`를 `continue-on-error` 가드(`_SWALLOWS_FAILURE`)와 대칭으로 step 레벨까지 확장 — 등재되지 않은 step `if:`는 실패 |
| 3 | Static-AST-Bypass (architecture) | `check-review-gate.py`의 `os.environ` 접근 금지 가드가 `ast.Attribute`/`ast.Call` 축만 덮고 `ast.Subscript`/`ast.Compare`는 비어 있다. `from os import environ as _E; _E["GITHUB_WORKFLOW"]=="review-gate"` 형태로 6줄 패치하면 `review-gate.yml`의 gate job 위에서만 판정이 `blocked=False`로 뒤집힌다. `VerdictComesFromTheGateTest`의 `_HOSTILE_ENV`(5개)도 `GITHUB_WORKFLOW`를 포함하지 않아 행위 테스트로도 못 잡는다. | `scripts/check-review-gate.py` import 블록/`main()`; `.claude/tests/test_review_gate_ci.py` `OneJudgeTest`(358-362), `VerdictComesFromTheGateTest`(`_HOSTILE_ENV`) | 정적 열거 확장보다 런타임 격리(`env -i`로 `Review coverage backstop` step 실행)가 근본 해법; `_HOSTILE_ENV`에 GitHub 표준 컨텍스트 변수(`GITHUB_WORKFLOW`/`GITHUB_JOB` 등) 전체 추가 |
| 4 | Judge-Scope-Gap (side_effect) | "판정자는 하나"라는 라운드 6 전제 자체가 `check-review-gate.py` 한 파일만 지킨다. 실제 판정 함수 `review_guard.py::evaluate_review()`에 `if os.environ.get("GITHUB_JOB")=="gate": return ReviewDecision(False, ...)` 3줄을 심으면 `review-gate.yml`의 `gate` job 위에서만 영구 통과된다. `OneJudgeTest`는 이 파일을 스캔하지 않고, `VerdictComesFromTheGateTest`는 `review_guard.py`를 스텁으로 통째로 교체해 실물을 한 번도 실행하지 않는다. | `.claude/hooks/_lib/review_guard.py::evaluate_review()` (~942행 부근) | 판정자 단일성 검증 범위를 `review_guard.py`/`branch_guard.py`/`_shared/**`까지 확장 — (a) 정적 등재제 `environ`/`getenv`/`argv` 접근 금지, (b) `VerdictComesFromTheGateTest`를 스텁이 아닌 실물 `review_guard.py` 위에서 `GITHUB_JOB=gate` 포함 현실적 환경으로 도는 변형 추가 |
| 5 | Workflow-Identity-Uniqueness (requirement, concurrency — 2인 독립 확인) | `.github/workflows/`에 같은 `name:`(`review-gate`)·job id(`gate`)를 참칭하는 "always green" 워크플로 파일을 새로 추가해도 어떤 가드도 걸리지 않는다 — `WorkflowWiringTest`는 `review-gate.yml` 한 파일만 로드하고, 파일 간 name/job-id 유일성을 검사하는 테스트가 없다. GitHub의 required-status-check는 워크플로 파일이 아니라 체크 이름 문자열로 매칭되므로(플랫폼 동작, 러너 없이 100% 확정은 불가하나 "가드 부재" 자체는 확정), 두 워크플로가 동시에 같은 identity로 상태를 보고하는 경쟁이 성립한다. | 갭 위치: `.claude/tests/test_review_gate_ci.py:444`(`WorkflowWiringTest.setUp`), `.claude/tests/test_workflow_yaml_structure.py:85`(`_workflow_files`) | 전 워크플로에 대해 `(name, job_id)` 쌍 유일성을 `collections.Counter`로 등재제 강제 — `--enforce` 전환 즉시 유효해지는 잠복 우회이므로 우선순위 높음 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Review-Pipeline (dependency) | 리뷰 프롬프트 번들이 `test_review_gate_ci.py`의 `ReviewArtifactsStayTrackedTest` 클래스(56줄, CI 백스톱의 전제 "`review/**`가 추적됨"을 지키는 안전장치)를 절단 표시 없이 통째로 누락시켰고 이후 게이트 줄 번호가 57줄 밀렸다 — 다른 파일들은 절단 시 명시적 표시가 있었는데 이번엔 없었다. 이 세션 리뷰어들이 이 안전장치 자체를 검토 못 했을 가능성. | 프롬프트 파일3 "561"부터 vs 실제 파일 561-616행 | 프롬프트 조립기가 파일-전체 절단뿐 아니라 파일 중간 구간(클래스/함수 경계) 절단 시에도 동일한 절단 표시를 강제; 해당 클래스는 별도 라운드에서 재검토 |
| 2 | CI-Wiring (dependency) | `review-gate.yml`의 `paths:` 트리거가 `.claude/hooks/_lib/review_guard.py`/`branch_guard.py`를 글롭이 아니라 개별 파일명으로 손으로 나열 — `_lib`에 세 번째 모듈이 추가되고 `review_guard.py`가 이를 import해도 트리거되지 않는다(이 저장소가 6번 겪은 "paths 커버리지 갭" 클래스가 이 신규 워크플로엔 아직 미이식). | `.github/workflows/review-gate.yml:28,31,32` | `.claude/hooks/_lib/**` 글롭으로 대칭 확대하거나, `test_harness_checks_paths_coverage.py`와 같은 원리로 import-그래프 완전성 테스트 추가 |
| 3 | Maintainability | `_CLEAN_PLAN` 스텁 리터럴이 두 테스트 파일에 byte-identical 중복 — 코드 자신의 주석이 "같은 버그가 두 곳에서 독립 재발했다"고 증언하는데도 공유 헬퍼로 승격되지 않음. | `test_stop_guard_failopen.py:52` ↔ `test_block_integrity.py:383` | `_harness.py`에 `CLEAN_PLAN_STUB_SRC` 공유 상수/헬퍼로 승격 |
| 4 | Maintainability | `OneJudgeTest.test_the_import_and_call_surface_stays_small`이 ~100줄, 서로 무관한 6-7개 검사(import 허용목록/호출 허용목록/getattr 우회/속성 대입 금지/environ 접근 금지/evaluate_review 존재)를 한 메서드에 누적. | `.claude/tests/test_review_gate_ci.py:265-366` | 검사 단위로 `_assert_import_allowlist`/`_assert_no_environ_access` 등 private 헬퍼로 분리 |
| 5 | Maintainability | `_ALLOWED_CALLS`(`"ap.add_argument"` 등)가 스크립트의 우발적 지역 변수명 `ap`에 결합 — `ap`→`parser` 리네임만 해도(의미 변화 없음) 테스트가 실패하고, 실패 메시지가 무관한 리네임을 재구현 위험처럼 보이게 한다. | `.claude/tests/test_review_gate_ci.py:243` ↔ `scripts/check-review-gate.py:81` | `ArgumentParser` 호출도 `alias_of`에 타입 기준으로 등록하거나, 최소한 결합 사실을 주석으로 명시 |
| 6 | Documentation | `.claude/tests/README.md`의 `test_workflow_yaml_structure.py`/`test_review_gate_ci.py` 카탈로그 행이 실제 소스가 지키는 성질(각각 최소 3개 테스트/`PyYamlPinsAgreeTest`+`getattr`/`environ` 접근 금지 축)의 절반 이상을 누락 — stale. | `.claude/tests/README.md:44`, `:48` | 각 행에 누락된 검사 축 1-2문장 추가 |
| 7 | Documentation | `plan/in-progress/harness-review-gate-ci-backstop.md`의 §배선 가드 절이 "1R~4R 진행 중"에 멈춰 있고, 이미 커밋된 5R과 진행 중인 6R의 방어(job 조건 등재제, `continue-on-error` 전역 금지, 스위트 invocation 고정, environ/getenv/argv 금지, 적대적 환경 행위 테스트)를 반영하지 못함. | `plan/in-progress/harness-review-gate-ci-backstop.md:18,20,32-36` | §배선 가드 표에 5R/6R 행 추가, 상단 요약 표 갱신 |
| 8 | Process (security/architecture/requirement/side_effect/concurrency/testing — 6인 독립 관측) | 리뷰 세션 도중 실 워킹트리 HEAD가 병렬(developer) 세션에 의해 `8ce96e72b`→`e46f5382c`로 전진(`ReviewArtifactsStayTrackedTest` 신규 커밋, "review/**가 추적됨" 전제를 가드) — 이 리뷰의 프롬프트 번들 스냅샷이 stale해졌다. 코드 자체는 무해해 보이며 각 CRITICAL 발견은 신·구 HEAD 양쪽에서 재현 확인됐다. | 저장소 HEAD (`git log`) | 병합/push 전 최신 HEAD와 리뷰 번들 스냅샷 대조, 필요 시 재리뷰 라운드 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 이미 방어됨 (requirement, dependency) | `harness-checks.yml`의 `paths:`에서 `scripts/check-review-gate.py` 단독 항목 삭제 시도는 `test_harness_checks_paths_coverage.py::test_every_guarded_file_is_covered`가 즉시 잡는다(실측). `.github/workflows/**` 광역 필터 제거/GH 부정 패턴 삽입 시도도 각각 `test_each_historical_leak_is_load_bearing`/`test_no_filter_is_dead`가 막는다(security.md, 부산물 성격이라 향후 픽스처 변경 시 사라질 수 있음을 별도 주의). | `.claude/tests/test_harness_checks_paths_coverage.py` | 조치 불요 — plan 문서에 "이미 방어됨" 한 줄만 남겨 다음 라운드 재탐색 비용 절감 |
| 2 | 미검증 (concurrency) | `concurrency: cancel-in-progress: true`가 `--enforce` 전환 후 required-status-check 평가에 미치는 영향은 실 Actions 러너 없이 검증 불가. | `.github/workflows/review-gate.yml:36-38`, `harness-checks.yml:66-68` | `--enforce` 켜는 시점에 실 PR로 1회 확인 |
| 3 | 의존성 위생 양호 (dependency) | 이번 변경은 신규 외부 의존성 없음(stdlib만 사용); PyYAML pin 3곳 중복은 `PyYamlPinsAgreeTest`가 드리프트를 이미 방어; Actions가 SHA 대신 `@v7` 메이저 태그인 것은 저장소 전체 기존 관행(이 PR 범위 밖); `harness-checks.yml:77-78`의 "v5/v6" 주석은 stale(이 PR이 만든 drift 아님). | 각 항목 본문 참조 | 낮은 우선순위 — `constraints.txt` 단일화, 주석 정리는 후속 |
| 4 | Scope 경계 (scope) | `PyYamlPinsAgreeTest`(같은 라운드 WARNING 처분)와 plan 문서 5R 미반영은 범위 위반이 아니라 각각 정당한 fix-in-place, 문서 지연(일관성 검토 영역)으로 분류. | `.claude/tests/test_review_gate_ci.py:561~590`, plan 문서 | 없음 |
| 5 | Requirement 보조 확인 | spec 문서 부재는 harness 인프라 특성상 정상(SoT=plan 문서); "Fetch base ref 필요 여부" 열린 질문은 여전히 정직하게 미확정 표시됨; TODO/FIXME 없음, 반환값·에러 경로 완전성 문제 없음. | `plan/in-progress/harness-review-gate-ci-backstop.md` | 없음 |
| 6 | Maintainability 보조 | README 표 셀 하나(`test_review_gate_ci.py` 행)가 3중 서술(표+모듈 docstring+클래스 docstring)로 과밀; `WorkflowWiringTest.EXPECTED`(문서 전체 2차 진실)에 `review-gate.yml`→테스트 역참조 주석 없음; `WorkflowStructureTest` 내부 레지스트리 4개가 메서드 사이에 산재. | `.claude/tests/README.md:48`; `test_review_gate_ci.py:396-432`; `test_workflow_yaml_structure.py:123-189` | 표 압축, 역참조 주석 추가, 레지스트리 클래스 상단 집중 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | `harness-checks.yml` `on.pull_request` 트리거 도형 자체가 무방비 |
| performance | CRITICAL | step-level `if:` 미가드 (독립 확인 1/3) |
| architecture | CRITICAL | `os.environ` Subscript/Compare 축 AST 우회 |
| requirement | HIGH | 워크플로 파일 name/job-id 유일성 갭(shadow 워크플로) |
| scope | NONE | 범위 위반 없음, INFO 2건만 |
| side_effect | CRITICAL | `review_guard.py` 자체에 env 조건 백도어 — 판정자 스코프 밖 |
| maintainability | LOW | 테스트/문서 중복·가독성·우발적 결합 (WARNING 3, INFO 2) |
| testing | CRITICAL | step-level `if:` 미가드 (독립 확인 2/3) |
| documentation | LOW | README/plan 카탈로그 stale (WARNING 3, INFO 1) |
| dependency | MEDIUM | 리뷰 프롬프트 절단 사고 + `review-gate.yml` paths 손-나열 갭 |
| database | NONE | 대상 코드 없음 |
| concurrency | CRITICAL | 워크플로 identity 유일성 갭 — 디코이 워크플로 (shadow 발견의 concurrency 관점 재확인) |
| api_contract | CRITICAL (harness 관점, API 축 자체는 NONE) | step-level `if:` 미가드 (독립 확인 3/3) |
| user_guide_sync | NONE | 매트릭스 22개 trigger 매칭 0건 |

## 발견 없는 에이전트

- **database** — 이번 변경분(CI 백스톱 harness/워크플로/문서 9개 파일)에 SQL·ORM·마이그레이션·트랜잭션 등 데이터베이스 관련 코드가 전혀 없음.
- **user_guide_sync** — `codebase/**`/`spec/**` 변경이 없어 `doc-sync-matrix.json` 22개 trigger(glob 8 + semantic 14) 매칭 0건.

## 권장 조치사항

1. **step-level `if:` 등재제 도입** (Critical #2, 3인 독립 확인) — `_JOB_CONDITIONS`를 `continue-on-error` 가드와 대칭으로 모든 워크플로의 모든 step까지 확장. 구현 비용이 가장 낮고(기존 레지스트리 패턴 재사용) 재현 diff가 이미 회귀 테스트 입력으로 준비돼 있음.
2. **워크플로 파일 identity 유일성 가드** (Critical #5, 2인 독립 확인) — `(name, job_id)` 쌍을 `Counter`로 전 워크플로에 걸쳐 유일성 강제. `--enforce` 전환 시 즉시 활성화되는 잠복 우회라 시급.
3. **`harness-checks.yml` 자신의 `on.pull_request` 트리거 도형 고정** (Critical #1) — `review-gate.yml`에 이미 건 "`pull_request` 키 집합 = `{paths}`" 불변식을 전 워크플로 등재제로 일반화. CI 백스톱 전체의 유일한 진입점이므로 `review-gate.yml` 자신보다 우선순위가 높다는 지적(security.md) 반영.
4. **판정자 단일성 검증 범위를 `review_guard.py`까지 확장** (Critical #4) — 정적 등재제 + `VerdictComesFromTheGateTest`를 스텁이 아닌 실물 위에서 도는 행위 테스트 변형 추가.
5. **`os.environ` 접근을 열거가 아니라 런타임 격리로 차단** (Critical #3) — `env -i`로 `Review coverage backstop` step을 감싸 구조적으로 열거 게임을 종료. 정적 목록 확장은 미봉책.
6. **리뷰 프롬프트 조립기의 부분 절단 표시 누락 수정** (Warning #1) — 파일 중간 구간 생략 시에도 명시적 절단 마커 강제, 이번에 누락된 `ReviewArtifactsStayTrackedTest` 재검토.
7. `review-gate.yml` paths 트리거 글롭화(Warning #2), README/plan 문서 동기화(Warning #6·7), 테스트 스텁 중복 제거(Warning #3·4·5) — 우선순위 낮음, 별도 라운드 또는 문서 정리 커밋으로 처리 가능.

## 라우터 결정

`routing_status=skipped` — 라우터 미사용, 사유: `--route=all`. 전체 14개 reviewer 실행됨(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync).