# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능적 CRITICAL 결함·보안 사고는 없으나(핵심 리팩터 자체는 8개 리뷰어 전원이 정합성을 확인), 이 PR 이 없애려던 "각자 사본을 들고 있다가 조용히 어긋난다"는 실패 유형이 새 코드에서 소규모로 재발할 여지(CI 트리거 누락, dead code 로 인한 미검증 happy-path, 두 orchestrator 간 비대칭 테스트)가 다수 확인되고, `has_report()` 의 디렉터리 오판 회귀가 실행 검증으로 확인되어 MEDIUM 으로 판정. forced 화이트리스트 7개(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 에러처리/설계 | `review_guard.py` 신규 `_shared.report_paths` import 의 "Fail loudly"(try/except 미적용) 주석이 실제 예외 전파 경로와 어긋남 — 4개 리뷰어(architecture·requirement·side_effect·maintainability) 독립 지적. 실제 production 진입점(`guard_review_before_push.py`, `guard_review_before_stop.py`)은 `from review_guard import evaluate_review` 전체를 이미 broad `try/except Exception`으로 감싸고 있어, `_shared` import 실패 시 review_guard 모듈 전체가 로드 실패 → coverage 서브체크만이 아니라 **REVIEW 게이트 전체**(push 차단·stop nudge·resolution-in-flight 억제)가 두 호출자의 기존 except 로 조용히 fail-open 된다. 주석이 막으려는 "coverage gate 조용히 통과"는 막히지 않고 더 넓은 범위로 재발하며, 관찰 가능한 최종 결과(허용됨, stderr 에만 traceback)는 로컬 fallback 을 했을 때와 동일하다. 같은 파일의 `_origin_default_branch`(국소 폴백) 패턴과도 비대칭. 다만 런타임 자체는 어느 경우든 fail-open·wedge 없음으로 안전(모듈 전체 철학과 일치) — 실질 차이가 나는 유일한 대상은 이 import 를 직접 쓰는 단위테스트뿐. | `.claude/hooks/_lib/review_guard.py:101-118`(신규 import+주석 vs `_origin_default_branch` try/except), `.claude/hooks/guard_review_before_push.py:34-38`, `.claude/hooks/guard_review_before_stop.py:53-71` | 주석을 "이 실패는 결국 호출자의 broad try/except 로 fail-open 흡수되며, production 스코프가 아니라 이 import 를 직접 쓰는 단위테스트가 조용히 넘어가지 않게 하는 것이 실익" 으로 정정. 더 좁은 blast radius 를 원하면 `_forced_coverage_missing()` 내부에서만 로컬 처리하는 대안도 고려. |
| 2 | 보안/게이트무결성 | `has_report()`가 `os.path.isfile()` 없이 `os.path.getsize() > 0` 만으로 "리포트 존재"를 판정 — `output_file` 값이 `/`로 끝나거나 정확히 `..`인 경우 `os.path.basename()`이 빈 문자열/`".."`를 반환해 경로가 세션 디렉토리 자신 또는 그 부모(디렉터리)가 되고, 디렉터리의 `getsize()`는 대부분 0이 아니므로 "리포트 있음"으로 오판된다(로컬 실측 64~96 bytes로 검증됨). 리팩터 이전 두 orchestrator는 `os.path.isfile()`을 써서 이 케이스를 막았던 것이 공유화 과정에서 사라진 **회귀**. 3개 소비처(`review_guard.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`) 전부에 전파됨. 악용에는 `_retry_state.json` 직접 조작이 필요하고 그 정도 접근권이면 더 쉬운 우회(빈 아닌 파일 직접 작성)가 이미 가능해 실질 위험도는 낮으나, 모듈의 존재 이유(위조 불가능한 판정) 자체를 훼손하는 재현 가능한 결함. | `.claude/_shared/report_paths.py` `report_path()`(115-129행), `has_report()`(144-149행) | `has_report()`를 `os.path.isfile(p) and os.path.getsize(p) > 0`로 강화. `report_path()`에서 `basename(recorded)`가 빈 문자열/`"."`/`".."`이면 안전 폴백(`f"{name}.md"`)으로 대체. `test_report_paths_shared.py`에 trailing `/`·`..` 회귀 테스트 추가. |
| 3 | 테스트/CI | 신규 `.claude/_shared/**`가 `harness-checks.yml`의 PR 트리거 `paths:` 목록에서 빠져 있음 — 이 PR 이 막으려는 바로 그 drift 클래스(단독 수정이 CI 를 안 태움)가 재발할 수 있는 자리. `.claude/_shared/report_paths.py` 한 파일만 고치고 `.claude/hooks/**`/`.claude/skills/**`/`.claude/tests/**` 중 어느 것도 같이 안 건드리면 harness 단위테스트 스위트(`test_report_paths_shared.py` 등)가 CI 에서 조용히 안 돈다. 같은 파일 내 과거 동일 유형 실패에 대한 수정 기록 주석이 이미 존재. | `.github/workflows/harness-checks.yml:9-27`(`on.pull_request.paths`) | `paths:` 목록에 `- '.claude/_shared/**'` 추가. |
| 4 | 테스트/문서화 | 두 orchestrator의 `_report_paths()` 로컬 wrapper가 리팩터 후 호출부 0건(grep 확인)인 dead code가 됐는데, docstring은 여전히 "Kept as a named function because call sites read better"(또는 동일 취지)라며 사실이 아닌 존치 근거를 주장. 그 결과 이 wrapper가 감싸던 shared 모듈의 `report_paths()`(복수형) 정상 경로는 프로덕션에서 도달 불가능하고, 유일한 직접 테스트(`test_malformed_manifest_shapes_do_not_crash`)도 기형 입력 분기만 검증할 뿐 정상 입력 happy-path 는 어디에도 테스트돼 있지 않음 — "looks tested, isn't"가 이 PR 이 잡으려던 패턴인데 `report_paths()` 자체가 그 패턴에 해당. | `code_review_orchestrator.py:244-251`, `consistency_orchestrator.py:101-107`, `.claude/_shared/report_paths.py:54`(`report_paths`) | (a) 죽은 wrapper 2개와 미사용이면 `report_paths()`까지 정리, 또는 (b) 존치할 거면 docstring을 "현재 내부 call site 없음 — API 형태만 유지" 로 정정 + `report_paths()` 정상 입력 케이스 단위 테스트 최소 1개 추가. |
| 5 | 테스트 | `consistency_orchestrator.py`의 "빈 리포트는 success 로 승격 안 됨"(existence-only → non-empty) 동작 변경이 `code_review_orchestrator.py`와 달리 직접 테스트되지 않음. code-review 쪽은 `AgreementTest.test_agree_on_an_empty_report`가 실제 CLI 서브프로세스(`--verify-coverage`)와 gate 를 나란히 돌려 e2e 로 못박지만, consistency 쪽은 `--verify-coverage` 커맨드 자체가 없고 `--summary-state`/`--resume`이 호출하는 `_reconcile_state_with_disk` 에서만 드러나는데 저장소 전체에서 consistency 테스트 중 `write_text("")`(빈 파일) 사용처 0건. | `consistency_orchestrator.py:128`(`_reconcile_state_with_disk`), `test_consistency_orchestrator_state.py`(대응 테스트 부재) | `test_an_empty_checker_report_is_not_promoted_to_success` 류 테스트 추가 — `code_review_orchestrator` 의 `AgreementTest` 와 대칭을 맞춰 "change both" 주석이 아니라 테스트로 두 orchestrator 를 동기화. |
| 6 | 문서화/요구사항 | `plan/complete/harness-report-contract-followups.md` frontmatter 의 `spec_impact: none` 근거 서술("`.claude/** + 프론트 테스트 헬퍼 전용 — 어떤 spec 의 code: glob 에도 매칭되지 않는다`")이 사실과 다름. 변경 파일 중 3개 프론트엔드 테스트 파일(`sidebar-nav-href.test.tsx`, `sidebar-test-utils.tsx`, `sidebar.test.tsx`)은 `spec/2-navigation/_layout.md` frontmatter `code: codebase/frontend/src/components/layout/**` 글로브에 실제로 매칭됨(grep 확인). `spec_impact: none` 결론 자체는 방어 가능(순수 mock/setup 추출, assertion·동작 변경 없음, vitest 11/11 동일 통과 재확인) — 근거 문장만 부정확. Gate C 테스트는 이 선언을 diff 로 교차검증하지 않는 설계(spec-impl-evidence.md R-8)라 빌드는 안 걸리지만, 이 문서를 신뢰하는 향후 `/spec-coverage` audit 나 사람에게 오도 소지. | `plan/complete/harness-report-contract-followups.md` frontmatter 주석 | 주석을 "`components/layout/**` 는 `spec/2-navigation/_layout.md` 의 `code:` glob 에 매칭되나, 본 PR 은 assertion·동작 변경 없는 순수 리팩터라 spec 갱신 불필요"로 정정(developer 쓰기 권한 범위, spec 수정 위임 불필요). |
| 7 | 문서화 | `.claude/tests/README.md` "What's covered" 표에 신규 테스트 파일 2개(`test_forced_coverage_selection.py`, `test_report_paths_shared.py`) 미등재. 이 표는 전수 색인이 아니라 핵심 불변식을 지키는 테스트를 큐레이션하는 문서인데, 두 신규 파일 모두 정확히 그 성격에 부합(전자는 forced-coverage grandfather-free 안전 논거를 실 세션으로 최초 검증, 후자는 gate/CLI 판정 일치라는 이 PR 의 핵심 주장을 `AgreementTest` 로 실측 증명)함에도 표에서 빠짐. | `.claude/tests/README.md` | 두 파일에 대한 행 추가, 각 docstring 핵심 논지 요약. |
| 8 | 부작용 | 오케스트레이터 CLI 의 "존재만"→"존재+비어있지 않음" 판정 전환이 이미 커밋된 과거 세션에 소급 적용되며, 조회 목적 커맨드의 기존 self-heal 쓰기 부작용 트리거 범위를 넓힘. `_reconcile_state_with_disk`는 계산 결과가 기존 `_retry_state.json`과 다르면 즉시 디스크에 덮어쓰는 기존 동작(`--summary-state`/`--resume` 호출 시)이 있는데, 0바이트 placeholder 리포트를 가진 과거 세션을 이제 "missing"으로 재분류하므로 순수 조회 실행만으로도 워크트리가 dirty 해질 수 있음. CI 자동화가 과거 세션에 이 CLI 를 도는 경로는 없어(그렙 확인) 실질 폭발 반경은 제한적. | `code_review_orchestrator.py::_reconcile_state_with_disk`/`_verify_coverage`, `consistency_orchestrator.py::_reconcile_state_with_disk` | `code-review-agents/SKILL.md`·`consistency-checker/SKILL.md`에 "이 변경 이후 과거 세션에 `--summary-state`/`--sync-from-disk` 실행 시 0바이트 placeholder 리포트가 있던 세션은 판정이 바뀌고 `_retry_state.json`이 갱신될 수 있다"는 한 줄 안내 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `report_paths()`/`missing_reports()` 벌크 연산이 단건 `report_path()` 재사용으로 인해 세션당 O(n²) 패턴이 됨(architecture·maintainability 공통 지적). 현재 agent 수(≤14)에서 실질 영향 없는 의도적 DRY 트레이드오프. | `.claude/_shared/report_paths.py:54-63, 74-...` | 조치 불필요 — 향후 소비자·규모 증가 시 dict 1회 구성 후 공유하는 선형 버전 고려. |
| 2 | 유지보수성 | `sys.path.insert(0, _CLAUDE_DIR)` 부트스트랩이 3개 스크립트(`review_guard.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`)에 각자 재구현됨(architecture·security·side_effect 공통 지적). 기존 `lib`/`_lib` import 부트스트랩 관례의 연장이라 새 위협면·구조 문제는 아님. `.claude/` 하위 최상위 디렉토리들이 `__init__.py` 없는 PEP420 네임스페이스 패키지 후보라 향후 bare import 추가 시 이론상 충돌 여지 있으나 현재는 grep 실측으로 안전 확인됨. | `review_guard.py:98-99,116-118`, `code_review_orchestrator.py:28-34`, `consistency_orchestrator.py:33-35,860-867` | 조치 불필요 — 4번째 소비자 생기면 부트스트랩 자체 헬퍼화 고려. |
| 3 | 유지보수성 | `missing_reports()`의 `names` 파라미터만 타입힌트 누락 — 같은 파일 다른 함수(`report_path`, `report_paths`, `has_report`)는 전부 annotated(maintainability·documentation 공통 지적). | `.claude/_shared/report_paths.py:74` | `names: list[str]`로 타입힌트 추가(런타임 `isinstance` 방어 로직은 유지). |
| 4 | 문서화 | "커밋된 리포트" 실측치가 두 문서에서 다름 — `report_paths.py` docstring "4749" vs `harness-report-contract-followups.md` §2 "4763"(requirement·documentation 공통 지적). 측정 스코프/시점 차이로 추정, 임계값 로직 자체엔 영향 없는 서사적 수치. | `.claude/_shared/report_paths.py:28`, `plan/complete/harness-report-contract-followups.md:46` | 필요 시 측정 스코프 명시해 통일 — 낮은 우선순위. |
| 5 | 문서화 | `.claude/docs/subagent-call-contract.md` §7 이 신규 SoT 모듈(`.claude/_shared/report_paths.py`)을 링크하지 않고, 그 모듈의 두 번째 규칙("비어있지 않아야 함")도 언급하지 않음. 코드 쪽 강제 로직은 이미 통일·검증됐으므로 순수 가독성/발견성 개선 사항. | `.claude/docs/subagent-call-contract.md:120-124` | §7 마지막 문단에 모듈 링크 + non-empty 조건 한 줄 추가. |
| 6 | 부작용 | `report_paths()` 공유화로 malformed manifest 처리 방식이 "예외(KeyError/TypeError)" → "`isinstance` 가드로 조용한 스킵/빈 dict 반환"으로 완화됨. 정상 케이스엔 영향 없고 방어성 개선 방향이며 `test_malformed_manifest_shapes_do_not_crash`로 pin 됨. | `.claude/_shared/report_paths.py` `report_paths()` | 조치 불필요. |
| 7 | 테스트 | `test_report_paths_shared.py`가 동일 물리 파일(`report_paths.py`)을 프로세스 내 두 개의 다른 모듈 이름(`_shared.report_paths` / `_shared_report_paths`)으로 중복 로드(side_effect·testing 공통 지적). 순수 함수만 있어 무해하며 `AgreementTest`는 실제 서브프로세스+gate 함수를 각각 실행해 신뢰성에 영향 없음. | `test_report_paths_shared.py:22-27` | 조치 불필요 — 향후 모듈에 mutable 상태 추가 시 재검토. |
| 8 | 테스트 | `report_path()`(단수형)의 `isinstance(invocations, list)` 가드 분기가 직접 테스트되지 않음(복수형 `report_paths()`의 동일 가드만 `test_malformed_manifest_shapes_do_not_crash`로 커버). 실제 위험은 낮음 — `has_report`/`missing_reports`를 통해 간접 커버. | `.claude/_shared/report_paths.py:41` | 선택 사항: `subagent_invocations` 키 자체가 없는 케이스 테스트 한 줄 추가. |
| 9 | 요구사항 | `report_path()`의 중복 `name` 처리가 이전 구현과 미묘하게 다름 — 신규는 `next(...)`로 첫 매치 채택, 구 dict comprehension은 마지막 항목이 덮어씀. 매니페스트에 동일 name 중복 등록되는 실무 경로 자체가 없어 실질 영향 관측 없음. | `.claude/_shared/report_paths.py` `report_path()` | 참고용 기록, 조치 불필요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `has_report()`가 `isfile()` 없이 `getsize()>0`만으로 판정 — 디렉터리를 리포트로 오판할 수 있는, 실행으로 검증된 회귀 |
| architecture | LOW | `review_guard.py`의 fail-loudly import가 파일 내 기존 로컬 폴백 패턴과 비대칭이며 파급 범위가 의도보다 넓음 |
| requirement | LOW | plan 문서 `spec_impact: none` 근거와 "fail loudly" 주석 둘 다 실제와 어긋나는 문서 정확성 문제(기능 회귀·보안 구멍 아님) |
| scope | NONE | 12개 변경 파일 전부가 diff 내 plan 문서의 5개 항목에 1:1 대응, 계획 외 변경 없음 |
| side_effect | LOW | fail-loudly import 가 review 게이트 전체를 조용히 무력화할 파급력 보유 + CLI 재분류의 소급 write 트리거 범위 확대 |
| maintainability | LOW | "fail loudly" 주석의 인과관계 서술이 실제 예외 전파 경로와 불일치(런타임 자체는 안전) |
| testing | MEDIUM | `.claude/_shared/**` CI 트리거 누락, `_report_paths()` dead code 로 `report_paths()` 정상경로 미검증, consistency 쪽 비대칭 테스트 누락 |
| documentation | LOW | `_report_paths()` wrapper docstring 의 "call sites" 존치 근거가 실제로는 call site 0건, README 신규 테스트 파일 미등재 |

## 발견 없는 에이전트

없음 — 라우터가 실행한 8개 에이전트 모두 최소 1건 이상(WARNING 또는 INFO)의 관찰사항을 보고했습니다. 다만 scope 는 위험도 NONE(관찰사항은 전부 확인성 INFO)입니다.

## 권장 조치사항

1. `has_report()`를 `os.path.isfile(p) and os.path.getsize(p) > 0`로 강화 — 게이트 무결성을 정면으로 훼손하는, 실행 검증된 유일한 기능적 회귀 (WARNING #2).
2. `.github/workflows/harness-checks.yml`의 `paths:`에 `- '.claude/_shared/**'` 추가 — 이 PR 이 만든 새 SoT 모듈 자체가 CI 로부터 누락되는 걸 막는 저비용·고가치 수정 (WARNING #3).
3. `review_guard.py`의 "Fail loudly" 인라인 주석을 실제 예외 전파 경로(호출자의 broad try/except로 결국 fail-open)에 맞게 정정 — 4개 리뷰어가 독립적으로 지적한 만큼 우선순위 있음 (WARNING #1).
4. `consistency_orchestrator.py`에 "빈 리포트는 success 아님"을 검증하는 테스트 추가해 `code_review_orchestrator`의 `AgreementTest`와 대칭 맞추기 (WARNING #5).
5. 죽은 `_report_paths()` wrapper 2개 정리 또는 docstring 정정 + `report_paths()`(복수형) 정상 입력 happy-path 테스트 추가 (WARNING #4).
6. `plan/complete/harness-report-contract-followups.md` frontmatter의 `spec_impact: none` 근거 문장 정정, `.claude/tests/README.md`에 신규 테스트 2건 등재 (WARNING #6, #7).
7. 낮은 우선순위: SKILL.md 에 CLI 소급 재분류 안내 한 줄 추가 (WARNING #8), INFO 항목들(타입힌트, O(n²), 문서 간 수치 불일치, subagent-call-contract.md §7 링크)은 여유 있을 때 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 소스 코드 변경 시 항상 적용되는 6개 + 문서 파일 변경으로 트리거된 documentation 1개; forced 전원 결과 확보됨, 누락 없음). 이 중 `architecture` 는 forced 목록에는 없으나 router 가 이 diff(에러처리·모듈 경계 재구성)에 능동적으로 관련 있다고 판단해 별도 선택.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 세부 사유는 매니페스트에 포함되지 않음 — diff 특성(하네스 Python 리팩터 + 프론트 테스트 mock 추출, 알고리즘/런타임 성능 영향 없는 순수 구조 변경)상 라우터가 해당 없음으로 판단한 것으로 추정 |
  | dependency | 의존성 추가/버전 변경 없음(전 리뷰어 공통 확인 사항과 일치) |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성/락/비동기 관련 변경 없음 |
  | api_contract | 외부/내부 API 계약 변경 없음(harness 내부 스크립트 + 프론트 테스트 전용) |
  | user_guide_sync | 사용자 대상 가이드/문서 콘텐츠 변경 없음(변경된 `plan/**`·`.claude/**` 문서는 내부 개발 하네스 문서) |

---
