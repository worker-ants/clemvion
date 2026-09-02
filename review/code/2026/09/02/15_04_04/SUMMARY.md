# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 하지만 testing reviewer 가 뮤테이션 테스트로 실증한 "게이트가 타입 오류 유무와 무관하게 CI 에서 영구 실패하는" 미검증 코드 경로 1건과, 1라운드가 스스로 지적한 "게이트가 자기 자신을 못 트리거하는" 실패 클래스의 자동 회귀 가드 부재 1건이 WARNING 으로 남아 종합 위험도를 MEDIUM 으로 판정. forced(router_safety) 화이트리스트 7개 reviewer(security/architecture/requirement/scope/side_effect/maintainability/testing/documentation — architecture 포함 총 8개 실행) 전원 결과가 정상 확보되었으며 누락된 forced reviewer 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `run_tsc()`의 "tsc가 비-0으로 끝났지만 stdout에 실제 진단이 있는" 분기(가장 흔한 실전 경로)가 어떤 단위 테스트에서도 실행되지 않음. 뮤테이션으로 실증: `:112` 조건을 `if proc.returncode != 0:` 로 약화시켜도 35개 테스트 전부 그대로 통과(`Ran 35 tests ... OK`). 이 회귀가 실제 커밋되면 baseline 이 비어있지 않은 한 게이트가 타입 오류 유무와 무관하게 CI 에서 매번 `undecidable()`(exit 2)로 영구 실패 | `scripts/_typecheck_ratchet.py:112`(`run_tsc`), 테스트 `.claude/tests/test_typecheck_ratchet.py:228-286`(`RunTscFailClosedTest`, 5개 서브테스트 전부 `returncode==0` 또는 `stdout==""` 조합만 다룸) | `RunTscFailClosedTest`에 `returncode=2, stdout="a.ts(1,1): error TS1: x\n"` Mock을 주입해 `run_tsc(cfg)`가 그 stdout을 그대로(예외 없이) 반환하는지 확인하는 대조군 테스트 추가 |
| 2 | testing | 1라운드 Critical #2("게이트가 자기 자신을 트리거하지 못함" — 신규 게이트 실행 파일이 워크플로 자신의 `changes.pathspecs`에 미등재)는 손으로 등재해 고쳤지만, 같은 클래스 재발을 막는 자동 회귀 테스트가 `frontend-checks.yml`/`backend-checks.yml` 자신에는 없음(`harness-checks.yml`만 `test_harness_checks_paths_coverage.py`가 방어). 1라운드 documentation 리뷰어가 제안한 일반화도 이번 라운드에 미구현 | `.claude/tests/test_required_check_skip_jobs.py`(`DeadFilterTest`는 "죽은 필터 방지"만 검사, "실행 파일이 pathspec 에 빠짐없이 등록됐는가"는 범위 밖). 대상: `.github/workflows/frontend-checks.yml`, `.github/workflows/backend-checks.yml` 의 `changes.pathspecs` | `test_harness_checks_paths_coverage.py`의 `KNOWN_COVERAGE_DEPENDENCIES` 패턴을 본떠, `typecheck-ratchet` job의 `run:` 스텝이 참조하는 스크립트/baseline 파일 집합과 그 워크플로 자신의 `changes.pathspecs`를 대조하는 테스트 추가 |
| 3 | documentation | `.claude/tests/README.md`의 `test_typecheck_ratchet.py` 행이, 이 PR 이 스스로 겪고 고친 3개의 실제 회귀(재발)를 막는 신규 테스트 클래스를 서술하지 않음 — 옆 행(`test_workflow_yaml_structure.py`)이 구체적 클래스/상수명으로 "어떤 사고를 재발 방지하는가"를 서술하는 관례에서 벗어남. 기능 위험은 없음(테스트는 실행·통과) | `.claude/tests/README.md:44`. 누락된 3건: ①route group 경로 파싱 회귀 — `test_paths_containing_parentheses_are_counted`(`test_typecheck_ratchet.py:136-152`) ②모듈 이중 로드로 인한 무증거 배선 — `EntrypointWiringTest`(`:386-418`) ③frontend exclude 규칙 비대칭 — `FrontendExcludeCoverageTest`(`:421-463`) | README 행에 세 문장 추가해 각 회귀와 대응 테스트 클래스를 한 줄씩 요약 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성/아키텍처 | "정당한 테스트 파일" 판별 규칙(`TEST_FILE_RULES`)이 프로덕션 `RatchetConfig` 가 아닌 테스트 전용 딕셔너리에만 존재 — 1라운드에서 이미 지적·의도적 미조치로 남긴 트레이드오프(코어가 테스트 관심사를 알 필요 없다는 근거) | `.claude/tests/test_typecheck_ratchet.py:81`(`TEST_FILE_RULES`), `scripts/_typecheck_ratchet.py:58-77`(`RatchetConfig`) | 현행 유지 가능. 세 번째 패키지 추가 시점에 `RatchetConfig` 필드로 승격할지 재검토 |
| 2 | 유지보수성/아키텍처/부작용 | 두 엔트리포인트가 각각 `sys.path.insert(0, ...)` 로 같은 `scripts/` 디렉터리를 삽입 — 동일 프로세스(테스트 하네스)에서 둘 다 로드되면 경로가 중복 삽입됨. 현재는 `sys.modules` 선등록(`"_typecheck_ratchet"` 실명)으로 실질 충돌 없음(`EntrypointWiringTest` 로 회귀 확인됨) | `scripts/check-backend-typecheck-ratchet.py:48`, `scripts/check-frontend-typecheck-ratchet.py:51` | 조치 불요. 스크립트 수 증가 시 `if path not in sys.path` 가드 또는 최소 네임스페이스 패키지화 검토 |
| 3 | 아키텍처 | CI job 정의(YAML)는 Python 코어만큼 통합되지 않음 — `frontend-checks.yml`의 신설 `typecheck-ratchet` job 이 `backend-checks.yml` 기존 job 구조(스킵→checkout→setup-python→실행)를 손으로 복제. 게이팅 조건 drift 는 `test_workflow_yaml_structure.py` 가 잡지만 스텝 순서/구성 자체를 검증하는 레지스트리는 없음 | `.github/workflows/frontend-checks.yml:107-135`(`typecheck-ratchet` job) | 조치 불요(job 2개로는 이득 작음). 세 번째 패키지 추가 시 reusable workflow(`workflow_call`) 또는 스텝 시퀀스 레지스트리 테스트 고려 |
| 4 | 유지보수성 | `RatchetConfig` 7필드 리터럴이 기존 `fake_config()` 헬퍼를 우회해 한 곳 더 중복 — 1라운드에서 이미 지적·의도적 미조치(우선순위 낮음) | `.claude/tests/test_typecheck_ratchet.py:279-286`(`test_tsc_is_invoked_with_the_configured_tsconfig`) | `dataclasses.replace(fake_config(tmp), tsconfig="tsconfig.typecheck.json")` 로 축소 고려(우선순위 낮음) |
| 5 | 테스팅 | `load_baseline()`의 `isinstance(data, dict)` 삼항식 `else None` 분기(baseline JSON 최상위가 dict 아닌 경우: `[]`/`"str"`/`42`)가 어떤 테스트에서도 실행 안 됨. 실제로는 두 분기 모두 같은 `undecidable()` 로 수렴해 안전하지만 방어 자체를 겨냥한 회귀 가드가 없음 | `scripts/_typecheck_ratchet.py:141`, 테스트 `.claude/tests/test_typecheck_ratchet.py:214`(`test_files_not_a_mapping_is_undecidable`, `{"files": []}` 만 검사해 dict 분기만 지남) | 최상위가 dict 가 아닌 baseline JSON(list 등) 케이스 테스트 추가 |
| 6 | 요구사항 | `PROJECT.md`의 "frontend 타입체크 ratchet" 행이 `tsconfig.json` 실제 exclude 의 `*.spec.ts(x)` 갈래를 언급에서 누락(동작 영향 없음, 순수 서술 완전성 — `tsconfig.typecheck.json` 주석/스크립트 docstring 은 정확히 서술) | `PROJECT.md`("frontend 타입체크 ratchet" 행) | `*.spec.ts(x)` 언급 추가(선택, 낮은 우선순위) |
| 7 | 범위 | backend 스크립트(`check-backend-typecheck-ratchet.py`)도 요청 범위(frontend 게이트 신설)를 넘어 공유 코어로 리팩터링됨 — 저장소의 반복된 "사본 drift" 실패 이력에 대한 구체적 근거(커밋 메시지·docstring)와 무회귀 실측(backend ratchet 199/38), subTest 커버리지 동반. 1라운드 자체 리뷰에서도 동일 판정(조치 불요) | `scripts/check-backend-typecheck-ratchet.py`, `scripts/_typecheck_ratchet.py`(신규 230줄) | 조치 불요. 세 번째 패키지 추가 시 이 공유 코어가 실제 재사용되는지가 사후 검증 포인트 |
| 8 | 부작용 | `mock.patch.object(CORE.subprocess, "run", ...)` 가 시점상 프로세스 전역 `subprocess.run` 을 패치(스코프는 `with` 블록으로 제한, 구 파일에도 동일 패턴 존재해 신규 위험 아님) | `.claude/tests/test_typecheck_ratchet.py`(`RunTscFailClosedTest` 각 서브테스트) | 조치 불요, 기록 목적 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | WARNING 2건 — `run_tsc()` 진단 분기 미검증(뮤테이션 35/35 GREEN 으로 실증된 잠재 회귀), 게이트 pathspec 자동 회귀가드 부재(1라운드 Critical #2 손 수정만, 재발방지 테스트 없음) |
| documentation | LOW | WARNING 1건 — README 가 이 PR 자신이 겪은 3개 실제 재발 방지 테스트 클래스를 미서술. 나머지는 1라운드 지적사항(대명사 모호성·수치 불일치 2건) 정정 확인 |
| architecture | LOW | INFO 3건 — TEST_FILE_RULES 테스트 전용 위치, `sys.path` 암묵 결합, CI YAML 비통합. DIP/SRP/OCP 적용 긍정 평가, 1라운드 Critical/Warning 4건 반영 확인 |
| scope | LOW | INFO 4건, 전부 근거 있는 조치 불요 판정(backend 리팩터 확장, jest-axe.d.ts 선행결함 수정, 이전 리뷰 산출물 포함, git rename 미인식은 메커니즘 한계) |
| side_effect | LOW | INFO 4건(sys.path 중복, 전역 subprocess 패치, sys.modules 등록순서 의존, main 시그니처 변경-무영향), 1라운드 Critical/Warning 해소 확인(pathspec 등재, 이중 로드 해소, baseline 쓰기는 `--update` 로만 게이트) |
| maintainability | LOW | INFO 2건(RatchetConfig 리터럴 중복, sys.path 중복 삽입) — 1라운드 지적 재확인, 신규 결함 없음. W1/W2 재발방지 테스트 신설 확인 |
| requirement | NONE | INFO 2건(PROJECT.md 문서 완전성, spec 범위 밖 확인). 1라운드 Critical(route group 파싱)·Warning(TEST_FILE_RULES 비대칭)·testing WARNING(이중 로드) 전부 코드+테스트 직접 재현·재실행(35/13/26 전부 OK)으로 재발 아님 확인 |
| security | NONE | 발견 없음 — CI/타입체크 harness 코드로 인증·DB·네트워크·사용자 입력 표면 자체가 없음. `subprocess.run` 인자 리스트 방식(커맨드 인젝션 없음), 하드코딩 시크릿 없음 |

## 발견 없는 에이전트

- security (NONE, 명시적 "없음")

## 권장 조치사항

1. **(최우선)** `run_tsc()`의 "진단이 있는 정상 실패" 분기(`returncode != 0` + stdout 에 실제 진단)를 직접 겨냥하는 단위 테스트를 `RunTscFailClosedTest` 에 추가한다 — 현재 이 분기는 뮤테이션 테스트로 미검증이 실증됐고, 깨지면 게이트가 타입 오류 유무와 무관하게 CI 에서 영구 실패한다.
2. `frontend-checks.yml`/`backend-checks.yml` 자신의 `changes.pathspecs` 가 실제 실행 파일과 동기화됐는지 검증하는 자동 회귀 가드를 추가한다(`test_harness_checks_paths_coverage.py` 패턴 차용) — 1라운드 Critical #2 는 손으로만 고쳐졌고 재발 방지 테스트가 없다.
3. `.claude/tests/README.md`의 `test_typecheck_ratchet.py` 행에 이번 PR 이 겪은 3개 실제 회귀(route group 파싱, 모듈 이중 로드, frontend exclude 비대칭)와 대응 테스트 클래스를 각각 한 줄로 서술 추가한다.
4. (낮은 우선순위, 선택) `RatchetConfig` 리터럴 중복을 `dataclasses.replace`로 축소, `PROJECT.md`에 `*.spec.ts(x)` 언급 추가, `load_baseline()`의 non-dict 최상위 케이스 테스트 추가 — 셋 다 즉각 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨. architecture 는 router 가 강제 없이 정상 선별.
  - **제외**: 아래 표(6명, router 가 diff 특성상 해당 도메인 비관련으로 판단 — CI/타입체크 harness 스크립트 변경으로 성능/의존성/DB/동시성/API 계약/사용자 문서 표면이 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 런타임 성능 영향 없는 CI harness 변경(router 판단) |
  | dependency | 신규 외부 패키지 추가 없음(router 판단) |
  | database | DB 스키마/쿼리 변경 없음(router 판단) |
  | concurrency | 동시성/레이스 표면 없는 정적 판정 스크립트(router 판단) |
  | api_contract | API 엔드포인트/계약 변경 없음(router 판단) |
  | user_guide_sync | 사용자 대상 가이드 문서 영향 없음(router 판단) |