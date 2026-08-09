# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 보안·기능 회귀는 없으나(security/scope 는 NONE~LOW), 테스트 스위트가 스스로 문서화한 "액션 버전 드리프트 검증" 약속을 실제로 지키지 못하는 갭(testing 자체 판정 MEDIUM)과, 신규 문서(docstring·assertion 메시지·README)가 소비자 수를 반복 오기하는 WARNING 이 있어 MEDIUM 으로 집계한다. Critical 발견 없음, forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 강제 이행 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `test_toolchain_pins_did_not_drift_in_the_extraction` 이 docstring·README 가 약속한 "액션 버전 핀 고정"을 실제로 검증하지 않는다. `actions/setup-node`/`pnpm/action-setup` 스텝을 `startswith("...")` 로만 찾아 존재만 확인하고, `@v7`/`@v6.0.9` 같은 정확한 버전 문자열은 비교하지 않는다 — 버전이 조용히 드리프트해도 RED 가 되지 않는다 | `.claude/tests/test_pnpm_workspace_action.py:170-185` | `node["uses"]`/해당 step 의 `uses` 값을 `assertEqual` 로 정확히 고정(`"actions/setup-node@v7"`, `"pnpm/action-setup@v6.0.9"`)하거나, docstring·README 서술을 실제 검증 범위(존재 여부만)에 맞게 낮춘다 |
| 2 | Documentation / Requirement | 신규 문서(테스트 모듈 docstring, assertion 실패 메시지, README 카탈로그 행)가 이 액션의 소비자 수를 "8개 워크플로"로 반복 오기(誤記) — 실제로는 5개 워크플로 파일에 걸친 **9개 잡**(byte-identical 8 + backend `typecheck-ratchet` 1)이다. 같은 PR 의 `action.yml` 헤더 주석·`plan/in-progress/ci-required-check-skip-jobs.md` 는 이미 정확히 9로 서술해 문서 간 내부 불일치가 존재한다 ("워크플로"와 "잡" 단위 혼용도 동반) | `.claude/tests/test_pnpm_workspace_action.py:1, 13-14, 115`, `.claude/tests/README.md:52` | "8개 워크플로" 표현을 "9개 잡(5개 워크플로에 걸침, byte-identical 8 + backend typecheck-ratchet 1)"으로 정정 — `action.yml` 헤더 주석의 표현을 그대로 재사용 가능 |
| 3 | Architecture | `_MAY_SWALLOW` 예외 레지스트리가 `path.name`(베이스네임) 만으로 키를 구성하는데, 이번 확장으로 검사 대상에 composite action 파일이 포함됐다. GitHub Actions 규약상 composite action 파일명은 항상 `action.yml` 로 동일하므로, 두 번째 composite action 이 생기면 `(action.yml, <step 이름>)` 키가 어느 액션인지 구분 못 하고 서로 다른 액션의 동명 스텝에 잘못 적용될 수 있다(현재는 액션 1개뿐이라 미발현) | `.claude/tests/test_workflow_yaml_structure.py:183` (정의), `:215-217` (사용처, `key = (path.name, step.get("name"))`) | 키를 `path.relative_to(REPO_ROOT)` 등 유일 경로 기반으로 변경해 액션이 여러 개가 되어도 충돌하지 않게 함 — 두 번째 액션이 생기는 시점 이전에 선제 조치 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 서드파티 액션(`pnpm/action-setup`, `actions/setup-node`)이 커밋 SHA 가 아닌 버전 태그로 핀 — 추출로 인해 그 신뢰 지점이 9개 잡(대부분 required-check 후보) 단일 파일로 집중됨. 이 diff 가 새로 만든 결함은 아니고(기존 관행의 집중), 즉시 익스플로잇 가능한 결함도 아님 | `.github/actions/pnpm-workspace/action.yml:53, 55` | (선택) 커밋 SHA 로 고정 + 버전 주석 병기 — 저장소 전역 관례와 일관되므로 필수는 아님 |
| 2 | Maintainability | `STUB` 상수 + `argv()` 헬퍼가 기존 `test_changed_paths_reusable.py` 와 바이트 단위로 완전 중복 — 스텁 프로토콜(`ARGC=`/`ARG=`) 변경 시 두 파일을 수동 동기화해야 하며 drift 위험 존재 | `.claude/tests/test_pnpm_workspace_action.py:57-61, 102-103` (비교 대상: `test_changed_paths_reusable.py:35-39, 72-73`) | 공유 헬퍼 모듈(예: `_run_block_argv.py`)로 추출해 두 파일이 같은 구현을 import — 세 번째 사례가 추가되기 전 권장 |
| 3 | Testing / Maintainability / Side_effect (3개 reviewer 중복 지적) | `run_install()` 이 `tempfile.mkdtemp()` 로 만든 임시 디렉터리(+ pnpm 스텁)를 정리하지 않아 반복 실행 시 `/tmp` 에 누적 — 저장소 전반의 기존 관례(수십 개 파일이 동일 패턴)를 답습한 것으로 이 diff 의 신규 결함 아님, CI 러너는 매 잡 폐기 환경이라 영향 낮음 | `.claude/tests/test_pnpm_workspace_action.py:83-99` | `tempfile.TemporaryDirectory()` 컨텍스트 매니저 또는 `self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)` 사용 고려(급하지 않음) |
| 4 | Testing | `next(s for s in steps if ...)` 를 기본값·진단 메시지 없이 사용 — 매칭 실패 시 `StopIteration` 만 던져 "무엇이 없어서 실패했는지" 불명확. 같은 파일의 `install_run_block()` 은 이미 `assert ..., f"..."` 형태로 더 나은 패턴을 쓰고 있어 내부 일관성도 어긋남 | `.claude/tests/test_pnpm_workspace_action.py:162, 174, 183` | `next(..., default=None)` + `self.assertIsNotNone(node, "...")` 형태로 실패 메시지 명시 |
| 5 | Testing | `ConsumerBindingTest.consumers()` 가 `*.yml` 만 스캔해 같은 계약(전체 워크플로 스캔)을 지키는 `test_workflow_yaml_structure.py::_workflow_files()`(`*.y*ml` 사용)와 glob 규약이 비대칭 — 현재 전부 `.yml` 이라 실질 위험 낮으나 `.yaml` 파일 유입 시 이 클래스만 조용히 소비처를 놓칠 수 있음 | `.claude/tests/test_pnpm_workspace_action.py:204-215` | `WORKFLOWS.glob("*.y*ml")` + suffix 필터로 통일, 또는 두 파일이 같은 glob 상수 공유 |
| 6 | Architecture | `test_pnpm_workspace_action.py` 가 `test_required_check_skip_jobs` 모듈을 직접 import 해 그 안의 `pathspecs_of()` 를 재사용 — 로직 복제를 피한 방향은 옳으나, 독립 공유 모듈이 아니라 테스트 파일이 테스트 파일을 import 하는 암묵적 결합(순환은 아님) | `.claude/tests/test_pnpm_workspace_action.py:243` | 세 번째 소비처가 생기면 `pathspecs_of` 를 공용 헬퍼 모듈로 승격 |
| 7 | Architecture | `REPO_ROOT`/`_harness.REPO_ROOT` 를 로컬 별칭 없이 그대로 쓰라는 주석 강제 — harness 커버리지 등재가 명시적 레지스트리가 아니라 소스 코드의 이름 형태(naming convention)에 암묵적으로 의존. 이미 자기 문서화되어 있고 별도 가드가 이탈을 감지하므로 현재는 안전 | `.claude/tests/test_pnpm_workspace_action.py:46-50` | 현행 유지로 충분. 유사 신규 harness 테스트 작성 가이드에 "guarded-file 상수는 `REPO_ROOT`/`_harness.REPO_ROOT` 에서 직접 뻗어야 한다" 규칙을 한 줄 명문화하면 반복 실수 예방 |
| 8 | Scope | `plan/in-progress/backend-lint-gate-broken-on-main.md` 갱신이 이 PR 의 직접 작업(composite action 추출)과 다른 plan 문서를 건드림 — 다만 그 문서가 이번 추출을 트리거한 원 출처이므로 체크박스/실행요약 동기화는 정당(실질 스코프 이탈 아님) | `plan/in-progress/backend-lint-gate-broken-on-main.md:295, 322-331` | 조치 불필요 |
| 9 | Side Effect | 셋업 3스텝 → composite action 1스텝 통합으로 install 로직이 단일 지점에 집중돼 실패 파급 범위가 9개 잡(대부분 required-check 후보)으로 확대됨(single point of failure). 의도된 설계이며 실행 검증 테스트(뮤테이션 13/13 RED)와 소비처 결속 테스트로 충분히 상쇄됨 | `.github/actions/pnpm-workspace/action.yml:68-73`, 9개 소비 잡 전역 | 조치 불필요 — 이미 완화됨 |
| 10 | Security | `permissions:` 블록이 신규 편입 워크플로 4개에는 없고 `harness-checks.yml` 에만 명시된 비대칭 — 이 diff 의 회귀 아님(사전 존재 상태), plan 문서에 이미 후속 항목으로 등재됨 | `plan/in-progress/ci-required-check-skip-jobs.md` §INFO 1 | 조치 불필요(중복 지적 방지) |
| 11 | Maintainability | `.claude/tests/README.md` 신규 행이 표 셀 하나에 장문 서사를 담아 가독성 낮음 — 다만 기존 다른 행들도 동일 스타일이라 이 파일의 기존 컨벤션과 일관됨 | `.claude/tests/README.md` (신규 `test_pnpm_workspace_action.py` 행) | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 인젝션 방어(env 경유) 양호·테스트로 고정됨; 서드파티 액션 태그 핀 집중(선택적 강화 대상) |
| architecture | LOW | `_MAY_SWALLOW` basename 키 latent 충돌 가능성(WARNING); Extract-Component 설계·blast radius 대응은 우수 |
| requirement | LOW | 기능 요구사항 완전 구현·9개 소비처 실측 일치; 문서상 소비자 수 "8개" 과소서술(documentation WARNING 과 통합) |
| scope | NONE | 스코프 이탈 없음; 관련 plan 문서 동시 갱신은 정당한 동기화 |
| side_effect | LOW | 임시 디렉터리 미정리(경미)·install 단일장애점 집중(의도/상쇄됨) |
| maintainability | LOW | STUB/argv() 헬퍼 중복, 임시디렉터리 미정리, README 셀 장문(모두 저위험) |
| testing | MEDIUM | 액션 버전 pin 테스트가 실제로 버전을 검증하지 않는 갭(WARNING) — 스스로 약속한 회귀 방지 미이행 |
| documentation | LOW | 신규 문서의 소비자 수 "8개 워크플로" 반복 오기(WARNING, requirement 와 동일 근원) |

## 발견 없는 에이전트

없음 — 실행된 8개 에이전트 전원이 최소 1건 이상(INFO 이상)의 발견을 보고했다(scope 는 실질 결함 없이 INFO 1건만 참고 기록).

## 권장 조치사항

1. `test_toolchain_pins_did_not_drift_in_the_extraction` 을 `uses:` 값 정확 비교(`assertEqual`)로 강화하거나, docstring/README 의 "액션 버전 핀" 서술을 실제 검증 범위에 맞게 낮춘다 — 테스트가 스스로 세운 회귀 방지 목표를 실제로 달성하지 못하는 유일한 실질 갭.
2. 신규 문서(테스트 docstring·assertion 메시지·README 카탈로그)의 "8개 워크플로" 표현을 실제 수치("9개 잡, 5개 워크플로")로 정정해 `action.yml` 헤더 주석·plan 문서와 일치시킨다.
3. `_MAY_SWALLOW` 등 workflow-only 전제로 설계된 basename 키 레지스트리를 relative-path 기반으로 변경 — 두 번째 composite action 이 생기기 전에 선제 조치하면 비용이 가장 낮다.
4. (선택, 후속) 서드파티 액션 SHA 핀, `STUB`/`argv()` 공유 헬퍼 추출, 임시 디렉터리 정리, `next()` 진단 메시지, glob 대칭성 등 테스트 위생 개선 — 낮은 우선순위.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 미이행 없음
  - **제외**: 아래 표 (6명). 개별 사유는 prompt 에 상세 제공되지 않았으나, 이번 diff 가 CI YAML/composite action/harness 테스트 전용(애플리케이션 코드·DB·API 계약·의존성 변경 없음)이라는 특성과 부합한다.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 애플리케이션 런타임 성능에 영향 없는 CI 설정 변경(라우터 판단, 상세 사유 미제공) |
  | dependency | 패키지 의존성 변경 없음(YAML/테스트 전용) |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음(CI 잡 게이팅은 side_effect/architecture 가 커버) |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자 대상 문서/가이드 변경 없음(CI 인프라 전용) |