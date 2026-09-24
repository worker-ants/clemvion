# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. Warning 3건은 모두 테스트 커버리지 갭(k8s `_mapping` 개별 call site 미고정, "정확히 하나" 검증 골격 중복)과 plan 체크리스트의 stale 서브테스트 수치(20→25)로, 기능/보안 결함이 아니라 유지보수·문서 정합성 이슈다. forced whitelist(7개) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/요구사항 (requirement, testing, documentation 중복 통합) | plan 체크리스트가 "15 passed · 20 subtests"로 기재돼 있으나, 3라운드 W1 수정(커밋 `9d734571e`, `test_pin_violation_edges`에 good/bad 케이스 추가)으로 실측(`python3 -m pytest .claude/tests/test_minio_image_parity.py -q`)은 `15 passed, 25 subtests passed`. 이 항목은 이전 라운드에도 낡은 카운트로 지적받은 이력이 있는 자리에서 재차 stale해졌다. | `plan/in-progress/minio-image-parity-guard.md:110-111` | 체크리스트 문구를 "15 passed · 25 subtests"로 갱신. |
| 2 | 유지보수성 (maintainability) | `k8s_images` 내부 "정확히 하나여야 한다" 검증 골격이 리소스 단위·컨테이너 단위 두 층위에 그대로 복제돼 있고, `compose_images`/`k8s_images` 사이 이미지 값 유효성 검사(`not isinstance(image, str) or not image`)도 문자 그대로 중복. 과거 두 라운드 리뷰가 "한 칸씩 안쪽에서" 놓쳤던 바로 그 구조(`minio-image-parity-guard.md` §B-2)라 향후 위치 추가 시 같은 실수가 재발할 표면을 제공. | `.claude/tests/test_minio_image_parity.py:111, 128, 135, 140` | `_expect_one(items, description)`, `_require_image_str(value, label)` 헬퍼로 통합. 리팩터링 시 기존 뮤테이션 표(B1~B8)를 재실행해 동일하게 RED가 나는지 재확인 필요. |
| 3 | 테스트 (testing) | `k8s_images` 안 `_mapping()` 개별 call site 3곳(`metadata`/`spec`/`template`)이 실제로 어느 테스트로도 개별 고정되지 않음. 국소 치환(`.get("metadata")`를 `_mapping()` 대신 `... or {}`로 대체)으로 `AttributeError` 크래시를 실측 재현 — 전역 B9 뮤턴트는 compose 쪽 테스트가 먼저 죽어 k8s 개별 call site 검증 공백을 가려 왔다. | `.claude/tests/test_minio_image_parity.py:126, 130, 131` (관련 `_mapping` 정의 `:99-103`) | `ExtractorBoundaryTest`에 k8s "매핑이 아닌 필드" 경계 테스트 추가 (예: `metadata: [x]`인 StatefulSet 문서 → `PlaceNotFound` 개별 고정). |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | SHA-256 다이제스트 길이(64 hex)가 이름 없는 매직 넘버로 4곳에 반복 하드코딩. | `.claude/tests/test_minio_image_parity.py:162, 240, 252, 260` | 모듈 상단에 `SHA256_HEX_LEN = 64` 상수화하여 정규식·픽스처가 공유 참조. |
| 2 | 테스트 | `_PINNED` 정규식의 "lowercase hex only" 불변식이 주석으로만 존재하고 회귀 테스트가 없음(대문자 hex는 실측상 정확히 거부되나, 검증 케이스 부재로 향후 정규식이 관대해져도 스위트가 초록으로 남을 수 있음). | `.claude/tests/test_minio_image_parity.py:74`, `:239-257` | `test_pin_violation_edges`의 `bad` 목록에 대문자 hex 다이제스트 케이스 추가. |
| 3 | 유지보수성 | `test_k8s_duplicate_resource_is_named`가 `_k8s()` 헬퍼와 동일한 YAML 골격을 손으로 재작성해 중복. | `.claude/tests/test_minio_image_parity.py:200` (헬퍼 `:167`) | 우선순위 낮음 — 향후 리팩터링 시 `_sts()` 헬퍼로 통합 고려. |
| 4 | 보안 | 이미지 핀 정규식의 `$` 앵커가 `re.MULTILINE`/`\Z`가 아닌 문자열 끝(또는 trailing 단일 개행 직전)에서만 매치 — 실측상 악용 가능한 우회는 없음(무해). | `.claude/tests/test_minio_image_parity.py:74-76` | 낮은 우선순위. 방어적 엄격함을 원하면 `$` → `\Z`로 교체 가능. |
| 5 | 요구사항 | 이미지 pinning/버전 정책(latest 금지·digest 필수·distroless 금지)을 규정하는 `spec/` 문서 없음 — `spec/0-overview.md` §2.7은 이 영역을 다루지 않는 회색지대이며, 이번 변경은 harness 소유권 예외(CLAUDE.md)에 부합해 spec 신설을 요구하는 제품 계약이 아님. | `.claude/tests/test_minio_image_parity.py` 전체 | 조치 불요. |
| 6 | 변경 범위 | `plan/in-progress/spec-draft-nullable-notation-followups.md`에 4줄 추가된 것은 리뷰 대상 3파일 밖이지만, 확인 결과 이전 라운드(00_25_55 W3 · 00_56_30 W2)가 지적한 스코프 밖 아바타 정책 체크박스를 `self-hosting-deployment.md`에서 제거하고 기존 백로그 트래커로 옮긴 정정 이동이며 새로운 확장이 아님. | `plan/in-progress/spec-draft-nullable-notation-followups.md` (k8s 버킷 Job 항목 하위, ~line 5847) | 조치 불요. 향후 orchestrator가 scope reviewer 페이로드 구성 시 이런 "원복/이동" 커밋의 이동 대상 파일도 포함하면 완결성 향상. |
| 7 | 부작용 | 신규 테스트의 `setUp`이 매 테스트 메서드마다 compose 2개 + k8s 1개 매니페스트를 디스크에서 재읽음 — 읽기 전용·순수 함수라 상태 오염 없음(성능 참고 사항일 뿐). | `.claude/tests/test_minio_image_parity.py:266-267` | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | YAML `safe_load` 사용, 시크릿 하드코딩 없음, 커맨드/경로 인젝션 표면 없음 — 오히려 공급망 무결성을 강화하는 방향의 변경 |
| requirement | LOW | plan 체크리스트 "20 subtests" stale(실측 25). 핵심 가드 로직은 docstring이 서술한 4개 회귀 형태를 정확히 구현 |
| scope | NONE | 리뷰 대상 3파일 + 트래커 이동 4줄 모두 의도된 작업 범위/직전 리뷰 피드백에 정확히 대응. 리팩터링·기능 확장 뒤섞임 없음 |
| side_effect | NONE | 신규 테스트 파일은 순수 읽기 전용, 전역 상태 변경·네트워크 호출 없음. plan 문서 변경은 실행 코드 무영향 |
| maintainability | LOW | "정확히 하나" 검증 골격이 리소스/컨테이너 두 층위에 중복(과거 두 라운드가 놓친 바로 그 구조), SHA-256 매직 넘버 반복 |
| testing | LOW | k8s `_mapping()` 개별 call site 3곳 미고정(AttributeError 재현), 대문자 hex 미검증, plan 카운트 stale |
| documentation | LOW | 체크리스트 서브테스트 수(20) 실측(25)과 불일치. CHANGELOG·README·workflow pathspec·상호 참조는 전부 코드와 일치 확인 |

## 발견 없는 에이전트

없음 — 실행된 7개 에이전트 전원이 최소 INFO 이상의 발견사항을 보고함(단, security/scope/side_effect는 위험도 NONE으로 실질적 조치 불요 확인 위주).

## 권장 조치사항

1. `plan/in-progress/minio-image-parity-guard.md:110-111`의 서브테스트 수치를 "15 passed · 25 subtests"로 갱신한다(3개 에이전트가 중복 지적, 이전 라운드에도 동일 클래스 지적 이력 있음 — 재발 방지 우선).
2. `ExtractorBoundaryTest`에 k8s `metadata`/`spec`/`template`이 매핑이 아닌 경우의 경계 테스트를 추가해 `_mapping()`의 "malformed shape → `PlaceNotFound`" 설계 계약을 개별 call site 단위로 고정한다.
3. 여유가 있다면 `_expect_one()`/`_require_image_str()` 헬퍼로 "정확히 하나" 검증·이미지 값 검사 중복을 통합하고, 리팩터링 후 기존 뮤테이션 표(B1~B8)를 재실행해 회귀 없음을 확인한다.
4. 낮은 우선순위: SHA-256 길이 상수화, 대문자 hex 회귀 케이스 추가, `test_k8s_duplicate_resource_is_named` 헬퍼 재사용.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 누락 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(CI 하네스 테스트 + plan 문서)과 관련성 낮음 |
  | architecture | 동일 |
  | dependency | 동일 — 신규 의존성 추가 없음 |
  | database | 동일 — DB 관련 변경 없음 |
  | concurrency | 동일 — 동시성 관련 코드 변경 없음 |
  | api_contract | 동일 — API 계약 변경 없음 |
  | user_guide_sync | 동일 — 사용자 가이드 대상 변경 없음 |
