# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. 스코프 이탈 1건(투명 기록됨)과 가드 정규식의 `registry:port/...` 형태 `latest` 오탐 1건(현재 대상 3파일에는 미해당)이 WARNING 으로 남지만, 둘 다 즉시 차단할 사유는 아니다. forced 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7명 전원 결과가 인라인 전문으로 확보되어 있어 강제 목록 미이행에 의한 거짓 음성은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `pin_violation()`의 `_PINNED` 정규식이 `registry:port/...` 형태(예: `myregistry.io:5000/pgsty/silo:latest@sha256:<64hex>`)에서 name 그룹이 첫 `:` 앞까지만 소비해 `latest` 태그를 조용히 놓친다(false negative) — 실측 재현: `pin_violation('myregistry.io:5000/pgsty/silo:latest@sha256:'+'a'*64)` → `None`(위반 없음으로 오판). 현재 3개 파일은 이 형태가 아니라 당장 오탐은 없으나, 가드의 존재 이유(W-59: `latest` 회귀 차단)를 정면 우회할 수 있는 형태가 캐너리 테스트로 고정돼 있지 않다 | `.claude/tests/test_minio_image_parity.py:69`(`_PINNED`), 테스트 갭은 `test_pin_violation_edges`(:232) | `test_pin_violation_edges`의 `bad` 케이스에 `registry:port/...`+`latest` 조합을 추가해 현재 동작을 캐너리로 고정하고, 오탐이면 정규식을 마지막 `/` 뒤 세그먼트만 name 으로 매칭하도록 수정하거나, 비목표라면 docstring/plan 에 명시적으로 적을 것 |
| 2 | 스코프 | 이번 작업(이미지 참조 일치 가드)과 무관한 별개 결함("아바타 공개 정책 누락")이 같은 커밋에서 `self-hosting-deployment.md`에 새 체크박스로 편승 추가됨. `--impl-prep` 처분표에 사유가 투명하게 기록돼 있고 실제 동작 변경 없는 TODO 항목이라 위험은 낮지만, 순수 "요청된 변경" 기준으로는 스코프 밖 | `plan/in-progress/self-hosting-deployment.md:57-58` | 이미 투명 기록되어 되돌릴 필요는 없어 보임. 다음부터는 "만지는 파일에서 우연히 발견한 무관 결함"은 별도 plan 항목/커밋으로 분리 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/테스트 | `_PINNED` 정규식이 소문자 hex(`[0-9a-f]{64}`)만 허용하고 65자 이상·대문자 hex 경계가 명시 테스트되지 않음. 다만 실패 방향이 "안전 쪽"(거부)이라 보안 위험은 없고 오탐으로 인한 CI 실패 가능성만 있는 견고성/완전성 이슈 | `.claude/tests/test_minio_image_parity.py:69`, 테스트는 `:232` | 필요 시 `[0-9a-fA-F]{64}`로 확장하거나 `test_pin_violation_edges`에 경계 케이스 한 줄 추가(선택) |
| 2 | 보안 | 변경 전체가 공급망 무결성을 강화하는 방향(`latest` 거부, digest 필수, distroless 변형 거부, `yaml.safe_load`/`safe_load_all`만 사용) | `.claude/tests/test_minio_image_parity.py` 전체 | 조치 불요 |
| 3 | 보안 | CI 워크플로 권한이 `contents: read`로 최소 스코프, secrets 참조 없음(`pull_request_target` 아님) | `.github/workflows/harness-checks.yml:24-25` | 조치 불요 |
| 4 | 보안 | `self-hosting-deployment.md`가 MinIO root credential 노출 리스크를 이미 별도 항목으로 기록 중(미착수 TODO, 이번 diff 범위 아님) | `plan/in-progress/self-hosting-deployment.md`(`## 의존성·리스크`) | 조치 불요(향후 구현 PR에서 재확인) |
| 5 | 요구사항 | 이미지 pin 정책(`latest` 금지, digest 필수 등)에 대응하는 `spec/` 문서가 없음 — 다만 이번 변경은 `.claude/**`+`.github/workflows/**`+`plan/**`뿐인 harness 전용 변경이라 CLAUDE.md의 harness 소유권·리뷰 게이트 스코프 예외에 부합, spec 신설을 요구하지 않음(SPEC-DRIFT 아님 — spec이 애초에 이 영역을 다루지 않음) | `.claude/tests/test_minio_image_parity.py` 전체 | 조치 불요 |
| 6 | 스코프 | `self-hosting-deployment.md`에 "새 매니페스트가 이미지를 쓰면 이 가드의 자리 목록·pathspec에 수동 등록하라"는 정방향 교차 참조 추가 — 가드 자신의 한계(등록 안 된 파일은 발견 못함)를 미리 알리는 순수 문서화로, 범위 이탈 아님 | `plan/in-progress/self-hosting-deployment.md:59-62, :73-74` | 조치 불요 |
| 7 | 스코프 | `harness-checks.yml` 변경은 정확히 필요한 3줄(pathspec)+근거 주석만 추가, 다른 부분은 손대지 않음 | `.github/workflows/harness-checks.yml:92-98` | 조치 불요 |
| 8 | 스코프 | `test_minio_image_parity.py`는 전량 신규 파일로 "6곳 이미지 일치 검증"이라는 단일 목적에 수렴, 불필요한 임포트·리팩토링·포맷팅 잡음 없음 | `.claude/tests/test_minio_image_parity.py` | 조치 불요 |
| 9 | 부작용 | CI 트리거 표면이 3개 파일(`docker-compose.yml`, `docker-compose.e2e.yml`, `k8s/overlays/local/infra-minio.yaml`)만큼 넓어져 이미지와 무관한 수정도 하네스 스위트를 돌게 함 — plan이 `#1325` 부분 반영 재발 방지를 위해 사전에 인지하고 파일 단위로 범위를 최소화한 의도된 트레이드오프 | `.github/workflows/harness-checks.yml:92-98` | 조치 불요 |
| 10 | 부작용 | 신규 테스트가 인프라 파일 3개를 읽기 전용으로 파싱 — 파일 이동/삭제 시 `PlaceNotFound`가 아니라 미처리 `FileNotFoundError`로 실패할 수 있음(결함 아닌 견고성 이슈) | `.claude/tests/test_minio_image_parity.py:139-144`(`all_images`) | 조치 불요(범위 밖) |
| 11 | 부작용 | 신규 전역 상수 전부 불변 리터럴, 테스트 간 공유 가변 상태 없음 | `.claude/tests/test_minio_image_parity.py:56-69` | 조치 불요(긍정 확인) |
| 12 | 유지보수성 | `compose_images`와 `k8s_images`의 이미지 값 검증 블록(`not isinstance or not image` → raise)이 형태상 동일하게 반복 | `.claude/tests/test_minio_image_parity.py:104-105`, `:133-134` | 현 규모(각 2줄)에서는 헬퍼 추출이 오히려 간접성만 늘 수 있어 유지가 합리적. 추가 반복 시 소형 헬퍼 고려 |
| 13 | 유지보수성 | `k8s_images`의 컨테이너 목록 추출에 `_mapping()`과 대칭되는 시퀀스 가드가 없음(다음 줄의 `isinstance(c, dict)` 필터로 정확성엔 문제 없음, 스타일만) | `.claude/tests/test_minio_image_parity.py:175` | 필요 시 `_sequence()` 헬퍼로 대칭 보강(선택) |
| 14 | 문서화 | 헬퍼 함수 4개(`compose_images`, `all_images`, `_render`, `is_distroless`)에 독스트링 없음 — 로직이 단순하고 모듈 최상단 독스트링이 설계를 충분히 설명해 실질적 이해에 지장 없음 | `.claude/tests/test_minio_image_parity.py:99,139,147,84` | 선택 사항. 다음 편집 시 한 줄씩 보강 가능 |
| 15 | 요구사항 | `_PINNED` 정규식의 빈 태그(`name:@sha256:...`) 경계에 대한 명시 테스트 없음 — 정규식 자체(`(?P<tag>[^@\s]+)`, `+`)는 이미 이 형태를 정상적으로 거부함(정적 확인) | `.claude/tests/test_minio_image_parity.py:69`, 테스트는 `:232-242` | 낮은 우선순위. 완전성 관점의 사소한 보강 여지 |
| 16 | 테스트 | `_render()` 실패 메시지 조립 헬퍼가 직접 테스트되지 않음 — 정오답에는 영향 없고 실패 메시지 가독성에만 영향 | `.claude/tests/test_minio_image_parity.py:147` | 필수 아님, 우선순위 낮음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 공급망 무결성 강화 방향 변경, CI 권한 최소 스코프, secrets 없음. INFO 4건(정규식 대소문자, root credential 리스크는 이미 문서화) |
| requirement | NONE | `pytest -q` 15 passed/20 subtests 등 전 항목 실측 검증 통과, plan 뮤턴트 주장(B1) 재현 성공. spec 문서 부재는 harness 전용 변경이라 결함 아님(INFO) |
| scope | LOW | 핵심 변경은 요청 범위에 정확히 부합. 무관한 아바타 공개 정책 항목이 plan 편집에 편승(WARNING, 투명 기록됨) |
| side_effect | LOW | `codebase/**` 변경 없음, 런타임 부작용 표면 매우 좁음. CI 트리거 표면 확대는 의도된 트레이드오프(INFO) |
| maintainability | LOW | 함수 단위 작고 복잡도 낮음, 네이밍 명확. 경미한 검증 블록 중복·가드 비대칭 2건(INFO) |
| testing | LOW | 11개 분기 전부 뮤턴트-경계 테스트로 커버, 전체 스위트(1155 tests) 회귀 없음. `pin_violation()`의 `registry:port/...` 형태 `latest` 오탐을 실측으로 신규 발견(WARNING) |
| documentation | NONE | 독스트링·README·CHANGELOG·plan 상호 정합성 실측 전부 일치. 헬퍼 4개 독스트링 부재만 INFO |

## 발견 없는 에이전트

해당 없음 — 실행된 7개 에이전트 모두 최소 INFO 이상을 보고했다(Critical/Warning이 없는 에이전트는 security · requirement · documentation, 이들도 INFO는 존재).

## 권장 조치사항

1. `test_pin_violation_edges`에 `registry:port/...` + `latest` 조합 케이스를 추가해 `pin_violation()`의 오탐 여부를 캐너리로 고정하고, 오탐이면 정규식의 name 그룹을 마지막 `/` 뒤 세그먼트만 매칭하도록 좁히거나 비목표로 명시할 것(WARNING #1).
2. `self-hosting-deployment.md`의 아바타 공개 정책 항목은 이미 처분표에 투명 기록되어 되돌릴 필요는 없음 — 다음부터는 무관 발견 항목을 별도 plan/커밋으로 분리(WARNING #2).
3. (선택) `_PINNED` 대문자 hex/길이 경계 테스트 보강, 헬퍼 4개 독스트링 보강, `k8s_images`의 시퀀스 가드 대칭화 — 모두 INFO 수준으로 필수는 아님.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명, 전원 forced 로 지정되었고 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (실행 목록과 동일 — 이번 라운드는 router 판단과 안전 강제가 모두 같은 7명으로 수렴)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(개별 사유 원문 미제공) — 이번 diff가 하네스 테스트+CI pathspec+plan 문서로, 런타임 성능 경로 변경이 없다는 정황과 부합 |
  | architecture | 상동 — 런타임 아키텍처 변경 없음 |
  | dependency | 상동 — 신규 외부 의존성 추가 없음(pyyaml 스텝은 기존 것) |
  | database | 상동 — DB 스키마/쿼리 변경 없음 |
  | concurrency | 상동 — 동시성 로직 변경 없음 |
  | api_contract | 상동 — 공개 API/계약 변경 없음 |
  | user_guide_sync | 상동 — 사용자 가이드 대상 기능 변경 없음(harness 전용) |
