# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. Warning 2건(둘 다 이 PR이 스스로 겨냥한 "동일 목적 사본이 조용히
갈린다" 실패 클래스의 국소적 재발 — 기능 영향 없음, 좁고 명확한 수정으로 해소 가능). 나머지는
전부 INFO 이거나 이전 두 리뷰 라운드(11_27_26, 15_04_04)가 지적한 Critical 2건·Warning 5건이
실제로 반영됐음을 코드/테스트 재실행으로 재검증한 확인 사항. forced(router_safety) 화이트리스트
7명 전원 결과 확보됨 — 미이행 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | 신규 `_tracked_files()` 헬퍼가 자매 테스트 모듈(`test_harness_checks_paths_coverage.py`)의 동일 목적 함수를 재사용하지 않고 미묘하게 다른 구현(빈 줄 처리 방식 상이: `split("\n")`+filter vs `splitlines()`)으로 재작성됨 — 바로 옆에서 `filter_covers_file`은 import해 재사용하면서, 같은 성격 헬퍼는 이 PR이 다른 곳(`plan_guard.py`↔`plan-stale-audit.sh` 사례)에서 명시적으로 경계하는 "동일 목적 독립 사본이 조용히 갈린다" 실패 클래스를 국소적으로 재현 | `.claude/tests/test_workflow_run_inputs_covered.py:48-52` (신규) vs `.claude/tests/test_harness_checks_paths_coverage.py:299-304` (기존) | `test_harness_checks_paths_coverage.py`의 `_tracked_files`를 import해 재사용(이미 `filter_covers_file` import 선례 있음). 또는 두 곳이 공유하는 `.claude/tests/_harness.py` 같은 위치로 승격 |
| 2 | Documentation | frontend exclude 목록을 서술하는 산문 2곳이, 이번 라운드에 코드로 고친 바로 그 누락(`*.spec.ts(x)`)을 반영하지 못하고 여전히 3항목(`src/test/**`·`*.test.ts(x)`·`**/__tests__/**`)만 나열 — 실제 `tsconfig.json` exclude 는 5항목. `README.md` 쪽은 **같은 문단 안에서** 뒷문장("the test-file predicate omitted `.spec.ts(x)`")과 직접 모순 | `.claude/tests/test_typecheck_ratchet.py:9` (모듈 docstring), `.claude/tests/README.md:44` (`test_typecheck_ratchet.py` 행 첫 문장) | 두 산문에 `*.spec.ts(x)` 추가해 5항목으로 맞추고, 가능하면 "전수는 `FRONTEND_EXCLUDE_SAMPLES`/`FrontendExcludeCoverageTest` 참조"로 정본을 가리키게 해 향후 재drift 방지 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | `harness-checks.yml` pathspec 확장(`tsconfig.typecheck.json` 등재)이 그 파일 내용을 실제로 읽지 않는 harness 스위트를 불필요하게 더 자주 트리거(과다포함, fail-safe 방향이라 차단 사유 아님) | `.github/workflows/harness-checks.yml` | 조치 불요. 근거 주석을 "harness가 잡는다"에서 "frontend-checks가 잡는다"로 조정하면 오독 감소 |
| 2 | Side Effect | `test_workflow_run_inputs_covered.py`가 다른 `test_*.py`를 모듈째 import하는 이 스위트 최초 사례 — 시그니처 변경 시 즉시 깨지는 신규 결합점(기능 버그 아님, 관측 기록) | `.claude/tests/test_workflow_run_inputs_covered.py:38` | 조치 불요 |
| 3 | Maintainability | `tsconfig.typecheck.json`의 `"//"` 주석 필드가 문자열 배열 형태 — 같은 PR의 baseline JSON 2곳은 단일 문자열 형태라 저장소 내 유일한 예외 (기능 무영향, 순수 서식) | `codebase/frontend/tsconfig.typecheck.json:2-21` | 조치 불요에 가까움. 다음 편집 시 형태 통일 고려 |
| 4 | Maintainability | `test_run_steps_reference_only_covered_files`가 4단 중첩 for 루프(workflow→job→step→token), 자매 파일은 헬퍼 함수로 분리돼 있어 상대적으로 눈에 띔 | `.claude/tests/test_workflow_run_inputs_covered.py:91-111` | 조치 불요. 확장 시 제너레이터로 분리 고려 |
| 5 | Testing | `test_typecheck_ratchet.py`의 여러 테스트가 `tempfile.mkdtemp()` 임시 baseline 디렉터리를 `tearDown`/`addCleanup` 없이 남김(5→7개 호출 지점으로 증가) — 1R부터 우선순위 낮음으로 기조치 판정, 이번에도 미해소 재확인. OS temp라 기능 위험 없음 | `.claude/tests/test_typecheck_ratchet.py` (`VerdictTest.run_main` 외 6곳) | 조치 불요(기존 판정 유지). 정리하려면 공용 헬퍼에 `addCleanup` 1줄 추가 |
| 6 | Testing | `_PATH_TOKEN` 추출 정규식 자체를 겨냥한 고립 단위 테스트 부재 — 현재는 실제 워크플로 YAML 스캔(통합 테스트)에만 의존. 직접 검증(트레일링 구두점·따옴표·dotted-module 오탐 후보 등) 결과 현재 동작은 정확 | `.claude/tests/test_workflow_run_inputs_covered.py:45` | 필수 아님. 표 기반 가벼운 단위 테스트 추가 시 향후 회귀를 통합 테스트와 독립적으로 고정 가능 |
| 7 | Security/Requirement/Scope | 액션 major-tag 핀(`actions/checkout@v7` 등)·`sys.path.insert` 중복·`RatchetConfig` 리터럴 중복·backend 공유 코어 리팩터·`jest-axe.d.ts` 분리·이전 리뷰 산출물 커밋 포함 — 전부 저장소 기존 관례와 일치하거나 신규 게이트의 선행조건으로, 3개 리뷰(security/requirement/scope)가 개별 근거를 갖춰 조치 불요로 판정 | 다수(각 리포트 본문 참조) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | Critical/Warning 없음. CI 인프라 전용 변경, 커맨드 인젝션·ReDoS·시크릿·script injection 표면 없음 |
| requirement | NONE | 1R/2R Critical 2건·Warning 5건이 실제로 코드에 반영됐음을 테스트 실행(harness 1121/1121 등)으로 독립 재검증, 신규 결함 없음 |
| scope | NONE | 42개 파일 전부 단일 plan 항목("frontend 타입체크 게이트 신설")에 수렴, 프롬프트 밖 은닉 변경 없음 |
| side_effect | LOW | 새 부작용 없음. `harness-checks.yml` pathspec 과다트리거(fail-safe, INFO) |
| maintainability | LOW | `_tracked_files()` 중복 재구현 (WARNING 1건, 신규) |
| testing | LOW | 이전 라운드 회귀가드 전부 GREEN 재검증(98개 테스트 실행). tempfile 정리·`_PATH_TOKEN` 단위테스트 부재(INFO 2건) |
| documentation | LOW | frontend exclude 산문 2곳 미갱신·README 자기모순 (WARNING 1건, 신규) |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 INFO 이상 보고(대부분 "조치 불요"로 판정된 확인/재검증 항목).

## 권장 조치사항

1. `test_workflow_run_inputs_covered.py`의 `_tracked_files()`를 `test_harness_checks_paths_coverage.py`의 동일 함수 import로 대체 — WARNING #1 해소.
2. `.claude/tests/test_typecheck_ratchet.py:9` 모듈 docstring과 `.claude/tests/README.md:44`의 frontend exclude 서술에 `*.spec.ts(x)` 추가해 코드(5항목)와 산문(현재 3항목) 동기화, README 자기모순 해소 — WARNING #2 해소.
3. (선택, 낮은 우선순위) tempfile 정리 addCleanup 추가, `_PATH_TOKEN` 고립 단위테스트, `tsconfig.typecheck.json` 주석 형식 통일 — INFO 항목, 즉시 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전원) — forced 전원 결과 확보됨, 미이행 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(CI/타입체크 harness 인프라, 런타임 성능 경로 없음)와 관련성 낮음 |
  | architecture | 상동 |
  | dependency | 상동 |
  | database | 상동 (DB 접근 코드 없음) |
  | concurrency | 상동 (동시성 로직 변경 없음) |
  | api_contract | 상동 (API 계약 변경 없음) |
  | user_guide_sync | 상동 (사용자 가이드 대상 아닌 내부 개발 harness) |