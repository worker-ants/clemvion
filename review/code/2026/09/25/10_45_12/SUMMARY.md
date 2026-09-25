# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 0건. `.claude/tests/**` 하네스(병렬 pytest 프로브가 실제 저장소 트리를 밟던 경쟁 조건 제거) 전용 변경으로, `codebase/**` 제품 코드는 건드리지 않는다. 1라운드(`10_27_27`)에서 지적된 Warning 2건은 `89ae9fa24`로 실제 해소됐음을 10개 reviewer 전원이 소스 대조·재실행으로 독립 재확인했다. forced 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 완료 — 화이트리스트 미이행 없음. 남은 지적은 전부 INFO 수준.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/아키텍처/부작용 | `make_temp_repo_copy`가 git 객체가 아니라 살아있는 워킹트리를 `shutil.copytree`로 그 순간 복사한다 — 복사 도중 같은 서브트리를 다른 프로세스가 동시에 고치면 이론상 torn read 가능(닫은 것은 "쓰기 대 쓰기" 경쟁뿐, docstring이 그 범위를 명시) | `.claude/tests/_harness.py:163-171` | 조치 불요. 현재 재현·수정 대상 경쟁(쓰기-쓰기)과 다른 축. 필요 시 `git archive`/`git show` 기반 스냅샷으로 완전 시점 고정 고려 |
| 2 | 테스트/동시성 | 이 PR이 막는 실제 병렬 프로세스 간 경쟁을 재현하는 **상시 회귀 테스트가 없음**(미커밋 재현 스크립트 + 개별 뮤테이션 테스트 + 산문 규약(`README.md:109`)뿐) — 5번째 테스트 파일이 같은 안티패턴을 재도입해도 `pytest`로 자동 검출 불가, 런타임(CI) 가드 부재 | `.claude/tests/README.md:109-118`, `test_consistency_bundle_priority.py` | 조치 불요 — 이미 `plan/in-progress/harness-review-gate-followups.md` / `spec-draft-nullable-notation-followups.md`에 백로그 등재됨. 후속 세션에서 상시 가드화(감사 훅 census 상시화 등) 검토 |
| 3 | 유지보수성 | 프로브 대상 경로 문자열 `"spec/5-system/7-llm-client.md"`이 3곳(이번 PR이 세 번째 사용처 신설)에 리터럴로 반복 | `.claude/tests/test_consistency_bundle_priority.py` (약 652, 689, 779행) | 모듈 상수(예: `PROBE_TARGET_REL`)로 추출 권장. 우선순위 낮음 |
| 4 | 보안 | `make_temp_repo_copy(path, *subtrees)`의 `subtrees` 값이 검증 없이 `REPO_ROOT / rel`에 연결됨 — `..` 등 상위 경로 탈출 패턴이 이론상 가능하나 현재 호출부 5곳 전부 테스트 코드 자신의 리터럴(`"spec/5-system"`)만 사용 | `.claude/tests/_harness.py:166-167` | 조치 불요. 향후 `subtrees`가 외부 입력(설정 파일·CLI 인자)으로 확장될 경우에만 `Path.resolve().is_relative_to(REPO_ROOT)` 류 검증 추가 |
| 5 | 테스트 | `make_temp_repo_copy`의 `subtrees` 입력 이상 경로(미존재 → `FileNotFoundError`, 중첩 경로(`("spec","spec/5-system")`) → `FileExistsError`)에 대한 테스트 없음 | `.claude/tests/_harness.py:138-171` | 우선순위 낮음. 다중/중첩 subtree 호출부가 실제로 생기기 전까지는 불요 |
| 6 | 성능 | 동일 서브트리(`spec/5-system`, 18개 파일·1.4MB)를 5~6곳이 매번 독립적으로 `copytree`+git 커밋(캐싱 없음) — 실측 0.115초/copy로 현재 규모에선 무시 가능 | `.claude/tests/test_consistency_bundle_priority.py` (654, 691, 728, 781, 899행) | 조치 불요. 대상 서브트리가 커지거나 프로브 수가 늘면 base-copy를 `setUpClass`로 캐싱 후 얕은 복제하는 방식 고려 |
| 7 | 문서화 | 커밋된 사전 consistency-check 산출물(`review/consistency/2026/09/25/09_56_00/**`)이 개명 전 식별자(`make_probe_repo`)를 그대로 인용 — 개명 이전 시점 스냅샷이라 발생 | `review/consistency/2026/09/25/09_56_00/naming_collision.md` 등 | 조치 불요(리뷰 산출물은 시점 스냅샷 관례). 최종 이름은 코드·plan `§G`에 정확히 반영됨 |
| 8 | 문서화 | `make_temp_repo_copy` docstring이 subtree 경로 중첩 시 `FileExistsError` 실패 경계를 언급하지 않음 | `.claude/tests/_harness.py` (`make_temp_repo_copy` docstring) | 조치 불요. 다중/중첩 호출부가 생기는 시점에 보강 검토 |
| 9 | 아키텍처 | 프로세스 격리 방식이 파일마다 세 갈래(함수 직접 호출+`root` 인자 / CLI `cwd=` 재배치 / git 없는 순수 임시 디렉터리)로 다르며 공용 추상화가 없음 — 발산 축이 갈려 지금 통합하면 분기만 늘어나는 의도적 defer | `.claude/tests/_harness.py`, `test_consistency_spec_draft_snapshot.py:57`, `test_router_decision_trust.py:335` | 조치 불요. 다섯 번째 유사 픽스처가 생기는 시점에 재검토 |
| 10 | 보안 | 리뷰/검토 산출물에 개발 머신의 로컬 절대경로가 다수 노출(자격증명 아님, 기존 관례와 동일) | `review/code/2026/09/25/10_27_27/_retry_state.json` 등 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션 벡터·하드코딩 시크릿 없음(전수 grep 확인). `subtrees` 경로 결합 이론적 탈출 여지(현재 무해, INFO) |
| performance | NONE | 서브트리 반복 복사(5~6곳)·git 프로세스 오버헤드가 실측상 무시 가능한 수준(0.115초/copy) |
| architecture | LOW | 세 갈래 격리 메커니즘 병존(의도적 defer, 기존 저장소 방침과 합치); 워킹트리 torn-read 이론적 여지; 헬퍼 자신을 검증하는 신규 계약 테스트(`TheRepoCopyFixtureTest`) 긍정 평가 |
| requirement | NONE | 대응 spec 문서 없음(N/A, 0건 grep 확인); 1라운드 WARNING 2건 코드 레벨로 독립 재확인·해소 |
| scope | NONE | 핵심 로직 변경은 6개 하네스 파일에 정확히 국한, 나머지 26개는 프로젝트 표준 기록물(CHANGELOG/plan/review) |
| side_effect | NONE | 워킹트리 torn-read(재확인, 저위험); private 헬퍼 시그니처 변경 4건 전부 파일-로컬·호출부 동반 갱신 확인 |
| maintainability | LOW | 경로 문자열 리터럴 3곳 중복(낮은 우선순위); `try/finally`→`TemporaryDirectory` 리팩터링으로 가독성 개선 |
| testing | LOW | 74 passed 실측 재확인, 1라운드 WARNING 2건 회귀 테스트로 고정됨 확인; 상시 회귀 테스트 부재·subtrees 입력검증 테스트 부재는 INFO |
| documentation | NONE | docstring·README·CHANGELOG·plan 수치가 실제 코드와 교차 일치 확인; 스냅샷 산출물의 옛 식별자 인용은 재확인 |
| concurrency | LOW | 핵심 경쟁 조건(잔여 5/6→0/6, 실패 22/24→0/24)이 격리 설계로 근본 해소됐음을 추적 확인; torn-read·런타임 가드 부재는 INFO 재확인 |

## 발견 없는 에이전트

없음 — 10개 에이전트 전원이 최소 1건 이상의 INFO 관찰을 보고했다(Critical/Warning은 전원 0건).

## 권장 조치사항

1. (선택, 백로그 진행 중) 병렬 프로세스 간 실제 경쟁 조건을 재현하는 상시 회귀 테스트/CI 가드 부재 — `plan/in-progress/harness-review-gate-followups.md` 및 `spec-draft-nullable-notation-followups.md`에 이미 등재됨. 후속 세션에서 처리.
2. (낮은 우선순위) `"spec/5-system/7-llm-client.md"` 경로 문자열을 모듈 상수로 추출해 3곳 중복 제거.
3. (낮은 우선순위, 조건부) `make_temp_repo_copy`의 `subtrees` 인자가 향후 외부 입력으로 확장될 경우에 한해 경로 탈출 검증(`is_relative_to`) 및 중첩/미존재 경로 테스트 추가 검토.
4. 그 외 항목은 모두 조치 불요 — 병합을 막을 사유 없음.

## 라우터 결정

`routing_status=done` (router가 선별):

- **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency` (10명)
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 완료, 화이트리스트 미이행 없음
- **제외**: 아래 표 (4명)

| 제외된 reviewer | 이유 |
|------------------|------|
| dependency | router 판단 — 이번 diff는 신규 의존성 도입 없는 harness 테스트 전용 변경(개별 사유는 prompt에 미포함) |
| database | router 판단 — DB 스키마·쿼리 변경 없음 |
| api_contract | router 판단 — API 계약 표면 변경 없음(`codebase/**` 미변경) |
| user_guide_sync | router 판단 — 사용자 가이드 대상 제품 기능 변경 없음 |
