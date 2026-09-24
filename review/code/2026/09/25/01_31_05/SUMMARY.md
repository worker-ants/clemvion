# Code Review 통합 보고서

## 전체 위험도
**LOW** — 리뷰 대상 두 커밋(`5f8c1c472` 리팩터 · `24803d575` docs/RESOLUTION) 자체에는 Critical/Warning 급 결함이 없다. 유일한 WARNING 은 이 diff 와 무관한 **병렬 세션이 남긴 작업 트리 오염**(`spec/5-system/7-llm-client.md` 미커밋 수정 + `plan/in-progress/__probe_plan__.md` untracked 파일)이며, 본 요약 작성 시점에 직접 `git status --short` 로 재확인한 결과 **이미 clean 상태**(오염 흔적 없음, `plan/in-progress/__probe_plan__.md` 부재)임을 확인했다 — requirement/testing reviewer 가 원본 대조 후 `cp` 로 복원 완료. forced 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보, 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 환경/저장소 위생 (diff 무관) | 리뷰 도중 이 diff 와 무관한 작업 트리 오염이 관측됨 — `spec/5-system/7-llm-client.md` 끝에 `<!-- uncommitted probe -->` 3줄 추가된 미커밋 수정 + `plan/in-progress/__probe_plan__.md`(빈 내용) untracked 파일. 원인은 `.claude/tests/test_consistency_bundle_priority.py::TheDocumentBeingEditedIsNeverOmittedTest::test_the_probe_leaves_no_residue` 의 자기 원복 로직이 동시 실행(병렬 리뷰어 세션)에서 잔여물을 남긴 것으로 추정 — 이 diff(`test_minio_image_parity.py`, `minio-image-parity-guard.md`)가 만든 변경이 아니다. | `spec/5-system/7-llm-client.md`, `plan/in-progress/__probe_plan__.md`, 원인 코드 `.claude/tests/test_consistency_bundle_priority.py:628-747` | requirement·testing reviewer 가 `git show HEAD:spec/5-system/7-llm-client.md` 원본과 `diff` 대조 후 `cp` 로 이미 복원(`git checkout`/`restore` 미사용). **요약 작성 시점 재확인 결과 현재 저장소는 clean**(review 산출물 디렉터리만 untracked) — 추가 조치 불요. 다만 `test_consistency_bundle_priority.py` 의 자기-원복(probe cleanup) 로직이 동시 실행에 취약할 수 있다는 신호이므로 harness 소유자가 별도로 점검할 가치가 있다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `_PINNED` 정규식의 ReDoS 가능성을 실측 벤치마크(길이 2×~80×, 4가지 적대적 입력)로 검증 — 선형 시간 스케일링 확인, 문제 없음. 입력도 항상 신뢰된 저장소 내 YAML 이라 공격 표면 아님 | `.claude/tests/test_minio_image_parity.py:77-79` | 조치 불요 |
| 2 | 유지보수성 | k8s 픽스처 YAML 리터럴(StatefulSet/Job 조각)이 3곳에 거의 그대로 하드코딩 반복 — 이 PR 이 프로덕션 로직에는 적용한 "자리마다 복제 금지" 원칙이 테스트 픽스처엔 미적용 | `.claude/tests/test_minio_image_parity.py:192, 224, 242` (StatefulSet), `:194, 228, 328` (Job) | `_sts_ok()` 류 헬퍼/모듈 상수로 유효 YAML 조각을 한 곳에서 생성해 세 테스트가 재사용하도록 리팩터 (이미 `_k8s()` 가 Job 쪽엔 파라미터화 적용) |
| 3 | 유지보수성 | `all_images()` 의 표시용 라벨 문자열이 `DEV_COMPOSE`/`E2E_COMPOSE`/`K8S_MINIO` 경로 상수와 별도로 손으로 재기술됨 — 경로 변경 시 라벨만 drift 가능(실패 메시지 텍스트에만 영향) | `.claude/tests/test_minio_image_parity.py:168` | `f"{DEV_COMPOSE.relative_to(REPO_ROOT)}"` 식으로 라벨을 경로 상수에서 파생 |
| 4 | 유지보수성 | `_dig` 이 첫 실패(비-dict) 이후에도 남은 키를 계속 순회 — 결과는 동일(`{}`)하지만 "매핑 아니면 즉시 포기"라는 의도가 코드로 명시되지 않음 | `.claude/tests/test_minio_image_parity.py:108` | `if not isinstance(node, dict): return {}` 로 조기 반환 |
| 5 | 테스트 | `is_distroless()` 가 태그가 아닌 전체 이미지 문자열에 대한 부분 문자열 검사라, 레지스트리/네임스페이스 세그먼트에 우연히 "distroless" 가 들어가면 오탐(false positive) 가능 — 실측: `"pgsty-distroless-mirror/silo:tag@sha256:<64hex>"` → 오탐 True. 안전 쪽으로 치우친 결함(거짓 음성은 없음)이며 현재 실제 이미지(`pgsty/silo`)에선 발생 안 함 | `.claude/tests/test_minio_image_parity.py:94-95` | `pin_violation` 이 추출하는 `tag` 그룹만 검사하도록 변경하거나, 최소한 이 경계를 명시하는 서브케이스 테스트 추가 |
| 6 | 테스트 | `_render()`(실패 메시지 포맷터) 전용 테스트 없음 — 판정 자체엔 영향 없어 우선순위 낮음 | `.claude/tests/test_minio_image_parity.py:176-177` | 필요시 전용 테스트 추가(선택) |
| 7 | 테스트 | "레지스트리 포트 뒤 latest" 회귀(3라운드 W1) 경계 테스트가 2단계 네임스페이스까지만 다루고 3단 이상은 미검증 — 정규식 자체는 다단에서도 정상 동작함을 프로브로 확인(기능 결함 아님, 커버리지 완결성 이슈) | `.claude/tests/test_minio_image_parity.py:312-332` | 3단 이상 네임스페이스 케이스를 `test_pin_violation_edges` 에 추가해 회귀 재발 감지 강화 |
| 8 | 문서화 | `compose_images`/`all_images`/`_render`/`is_distroless` 4개 함수에 함수 단위 docstring 없음 — 3·4라운드에서 이미 동일 지적·동일 처분("모듈 docstring 이 대신함, 차단 사유 아님") 완료, 재발 아님 | `.claude/tests/test_minio_image_parity.py` (94, 139, 168, 176번째 줄 부근) | 조치 불요(선택 유지) |
| 9 | 부작용 | `harness-checks.yml` pathspec 확장으로 세 매니페스트 파일 변경 시 `.claude/tests` 전체 스위트가 새로 트리거됨 — 가드의 설계 목적 자체이며 `k8s/**` 로 넓히지 않고 파일 단위로 최소화됨 | `.github/workflows/harness-checks.yml:96` | 조치 불요(의도된 설계) |
| 10 | 부작용 | `ExtractorBoundaryTest` 클래스명이 `test_minio_image_parity.py` 와 `test_harness_checks_paths_coverage.py` 양쪽에 존재 — 동시 실행 시 충돌 없음(pytest node-id 는 파일 단위 스코프, 46 passed 로 실측 확인) | `.claude/tests/test_minio_image_parity.py` / `test_harness_checks_paths_coverage.py:416` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | ReDoS 벤치마크 검증 INFO 1건, 그 외 취약점 없음(safe_load 만 사용, 인젝션/시크릿 없음) |
| requirement | NONE | 실제 6곳 이미지 값·pathspec 3줄·CHANGELOG/README·plan 체크리스트 전부 실측 일치. diff 무관 저장소 오염 관측·원복(INFO) |
| scope | NONE (커밋 기준) | 직전 라운드 Warning 2·3, INFO 1·2·4 에 대한 조치가 1:1 대응 확인. diff 무관 작업 트리 오염 WARNING 보고(미원복 상태로 관측, 그러나 다른 reviewer 가 이후 원복) |
| side_effect | NONE | 순수 읽기 전용 모듈, 전역 상태/파일 변경/네트워크 없음. CI 트리거 확장·클래스명 중복은 의도됨/무해(INFO 2건) |
| maintainability | LOW | 픽스처 YAML 3중 반복·라벨 문자열 수기 중복·`_dig` 비-조기반환 INFO 3건, 전부 정확성엔 무영향 |
| testing | LOW | `is_distroless` 부분문자열 오탐 가능성·`_render` 미검증·다단 네임스페이스 미검증 INFO 3건 + diff 무관 저장소 오염 WARNING(원복 완료 보고) |
| documentation | NONE | 숫자·기제(20 passed/45 subtests, 16 뮤턴트, pathspec 3줄) 전부 실측 일치. docstring 부재 INFO 1건은 기 처분 사항 재확인 |

## 발견 없는 에이전트

없음 (전 reviewer 가 최소 1건 이상의 INFO/WARNING 기록, 단 6곳 모두 Critical/코드 결함은 0건).

## 권장 조치사항

1. (선택, 후속 라운드) `is_distroless()` 를 태그 성분에만 적용하도록 좁히거나 오탐 경계 서브케이스 테스트 추가 — 안전 방향 결함이라 급하지 않음.
2. (선택) k8s StatefulSet/Job 픽스처 YAML 을 헬퍼로 통합해 3곳 하드코딩 반복 제거, `all_images()` 라벨을 경로 상수에서 파생.
3. (선택) `test_pin_violation_edges` 에 3단 이상 네임스페이스 케이스 추가해 "포트 뒤 latest" 클래스 회귀 재발 감지 강화.
4. (harness 소유자 별도 확인) `test_consistency_bundle_priority.py::TheDocumentBeingEditedIsNeverOmittedTest` 의 자기-원복(probe cleanup) 로직이 병렬 실행 시 `spec/5-system/7-llm-client.md` 에 잔여물을 남길 수 있음 — 이번엔 다른 reviewer 세션이 대조·복원했고 현재 저장소는 clean 이지만, 근본 원인(동시성 취약)은 별도 조사 가치가 있음. 이 diff 의 push 를 막을 사유는 아님.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (forced 7명 전원 결과 확보됨 — 누락 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이 diff 범위에 해당 없음 |
  | architecture | router 판단 — 이 diff 범위에 해당 없음 |
  | dependency | router 판단 — 이 diff 범위에 해당 없음 |
  | database | router 판단 — 이 diff 범위에 해당 없음 |
  | concurrency | router 판단 — 이 diff 범위에 해당 없음 |
  | api_contract | router 판단 — 이 diff 범위에 해당 없음 |
  | user_guide_sync | router 판단 — 이 diff 범위에 해당 없음 |
