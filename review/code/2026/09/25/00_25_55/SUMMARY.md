# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 코드(`codebase/**`) 변경 없이 harness 테스트(`test_minio_image_parity.py`)와 CI pathspec·문서만 추가된 변경으로, Critical 은 없고 코드 품질/테스트 커버리지 관점의 소규모 Warning 3건만 있다. forced 화이트리스트 7명(security, requirement, scope, side_effect, maintainability, testing, documentation) 전원의 결과가 확보되어 있어 미이행 항목은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `k8s_images` 의 `len(matches) != 1` 분기 중 "동일 kind/name 리소스가 2개 이상 발견"(중복) 쪽이 어떤 fixture 로도 검증되지 않는다. `!= 1` → `< 1` 뮤턴트를 넣어도 기존 스위트로는 잡히지 않는다 | `.claude/tests/test_minio_image_parity.py:96-97` | 같은 `kind`+`metadata.name` 문서가 두 번 나오는 `ExtractorBoundaryTest` 케이스를 추가해 "found 2" 메시지를 `assertRaisesRegex` 로 고정 |
| 2 | Maintainability | `k8s_images` 의 `spec → template → spec → containers` 4단 중첩 `.get()` 체인이 파일 내 다른 1~2단 방어 체인보다 눈에 띄게 읽기 어렵다 | `.claude/tests/test_minio_image_parity.py:98-100` | 중간 단계를 이름 있는 변수로 분리하거나 `_dig(d, *keys)` 같은 작은 헬퍼로 통일 |
| 3 | Scope | `self-hosting-deployment.md` 에 이번 이미지 patiry 가드와 무관한 "아바타 버킷 공개 정책"(`scripts/minio/avatars-public-read.json`, `mc anonymous set-json`) 구체 기술 노트가 같은 커밋에 섞여 삽입됨 | `plan/in-progress/self-hosting-deployment.md:57-61` | 코드 리스크는 없어 차단 불요. 향후엔 스코프 밖 발견은 체크박스(트리거)만 등록하고 세부 내용은 해당 항목 착수 시점에 채우는 편이 PR 경계를 더 깔끔히 분리 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | YAML 파싱은 `yaml.safe_load`/`safe_load_all` 만 사용, 외부/사용자 입력 없이 저장소 내 고정 경로 3개만 읽음 | `test_minio_image_parity.py:76`(`compose_images`), `:88`(`k8s_images`) | 조치 불요 |
| 2 | Security | tag+digest 핀 고정, `latest` 금지 요구는 공급망 보안을 강화하는 방향(기존 상태를 회귀로부터 지키는 가드) | `test_minio_image_parity.py:69`(`_PINNED`) | 조치 불요 |
| 3 | Security | distroless 배제는 compose 헬스체크가 `curl` 실행에 의존하기 때문인 운영상 트레이드오프이지 취약점 아님 | `test_no_distroless_variant` | 조치 불요. 향후 헬스체크가 `curl` 비의존이 되면 재검토 가능 |
| 4 | Security | 하드코딩된 시크릿/민감정보 노출 없음 | 전체 diff | 조치 불요 |
| 5 | Requirement | `_PINNED` 정규식이 포트 포함 레지스트리 참조(`host:5000/repo:tag@sha256:...`)를 잘못 분해할 수 있으나, 현재 6개 값 모두 포트가 없어 오늘 시점 오탐은 없음 | `test_minio_image_parity.py:69` | 현재 조치 불요. 향후 프라이빗 레지스트리 이미지 도입 시 재검토 |
| 6 | Requirement | 파일 부재/YAML 파싱 실패는 `PlaceNotFound` 로 포착되지 않음 — 다만 이는 문서화된 보장 범위 밖으로, 계약 위반은 아님 | `test_minio_image_parity.py:108-113`, `all_images`/`compose_images`/`k8s_images` 진입부 | 조치 불요. 필요시 `all_images()` 에서 예외를 `PlaceNotFound` 로 재포장하는 개선 고려 |
| 7 | Requirement | 이번 변경 영역(이미지 참조 일치 가드)을 규정하는 `spec/` 문서를 찾지 못함(단순 회색지대, spec drift 아님) | `spec/0-overview.md` | 조치 불요 |
| 8 | Scope | `spec-draft-nullable-notation-followups.md` 에 이번 작업과 무관한 `spec/0-overview.md §8` 넘버링 불일치 백로그가 추가됨 — developer 가 직접 spec 을 고치지 않고 정상적으로 planner 소관 트래커에 위임한 절차적으로 정상인 부수 발견 | `plan/in-progress/spec-draft-nullable-notation-followups.md:5860-5865` | 조치 불요(정상 프로세스) |
| 9 | Scope | `review/consistency/2026/09/25/00_08_35/**` 8개 신규 파일은 `--impl-prep` 의무 실행의 표준 산출물 | `review/consistency/2026/09/25/00_08_35/**` | 해당 없음 |
| 10 | Side Effect | `_harness` import 가 유발하는 `sys.path` 전역 변경(멱등 가드 있음)은 이 스위트 전체의 기존 관례이며 이 PR 이 새로 도입한 위험이 아님 | `test_minio_image_parity.py:54`, `_harness.py:32-33` | 조치 불요 |
| 11 | Side Effect | `harness-checks.yml` pathspec 확장은 파일 3개로 정확히 한정된 의도된 CI 트리거 확장(의도-구현 일치) | `.github/workflows/harness-checks.yml:92-98` | 조치 불요 |
| 12 | Side Effect | 신규 테스트는 순수 함수 + read-only 파일 접근만 수행, 전역 상태/환경변수/네트워크 부작용 없음(긍정 관찰) | `test_minio_image_parity.py:110-113` | 조치 불요 |
| 13 | Side Effect | `review/consistency/**` 산출물에 로컬 워크트리 절대경로가 그대로 git 히스토리에 남음(기존 관례와 동일 패턴, 코드 부작용은 아님) | `review/consistency/2026/09/25/00_08_35/_retry_state.json` | 조치 불요(참고) |
| 14 | Maintainability | `all_images()` 의 3줄 반복은 "새 매니페스트는 손으로 자리 목록·pathspec 에 추가"라는 의도된 설계와 일치 — 지금 추상화하면 오히려 그 의도를 흐릴 수 있음 | `test_minio_image_parity.py:108-113` | 조치 불요 |
| 15 | Testing | compose 쪽 서비스 값이 dict 가 아닌 경우(예: YAML 오탈자로 시퀀스) 원시 `AttributeError` 로 죽어, "실패는 항상 이름을 댄다"는 이 가드의 자체 원칙과 괴리 | `test_minio_image_parity.py:81` | 우선순위 낮음. `isinstance(services.get(svc), dict)` 체크 추가해 `PlaceNotFound` 로 승격하는 개선 고려 |
| 16 | Documentation | 신규 헬퍼 함수 4개(`compose_images`, `k8s_images`, `all_images`, `_render`)에 함수 단위 docstring 없음 — 모듈 최상단 docstring 이 그 역할을 충분히 대신하고 있어 이해에 지장 없음 | `test_minio_image_parity.py:76,88,108,116` | 조치 불요에 가까움. `k8s_images` 에 `len(matches) != 1` 의도(다중 매칭도 실패)를 한 줄 docstring 으로 남기면 다음 사람의 재추론 비용을 줄임 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 취약점 없음. YAML `safe_load` 만 사용, 하드코딩 시크릿 없음, tag+digest 핀 고정은 보안 강화 방향 |
| requirement | NONE | 요구사항 4개 named assertion 이 코드·문서·plan 간 일치. 뮤턴트 실측(M1~M5) 반영 확인. 정규식 엣지케이스·spec 부재는 INFO |
| scope | LOW | 핵심 변경은 요청 범위에 정확히 부합. `self-hosting-deployment.md` 에 무관한 기술 노트 혼입(WARNING) |
| side_effect | NONE | Read-only, 전역 상태/네트워크 부작용 없음. `sys.path` 변경은 기존 관례 |
| maintainability | LOW | 저장소 관례(named exception, docstring 서술 스타일) 준수. `k8s_images` 4단 중첩 `.get()` 가독성 저하(WARNING) |
| testing | LOW | 추출기 텍스트 주입 설계로 테스트 용이성 우수. `k8s_images` 중복 리소스 분기 미검증(WARNING) |
| documentation | NONE | 코드·README·CHANGELOG·plan·workflow 주석 5표면이 "단언 1" 서술까지 line-level 로 일치 |

## 발견 없는 에이전트

없음 — 7개 에이전트 전원이 최소 INFO 이상의 관찰을 보고했다 (Critical/코드 결함은 없음).

## 권장 조치사항

1. `k8s_images` 의 `len(matches) != 1` 분기 중 "중복 리소스(2개 이상)" 케이스를 검증하는 `ExtractorBoundaryTest` fixture 를 추가한다 (testing WARNING).
2. `k8s_images` 의 4단 중첩 `.get()` 체인을 이름 있는 변수 또는 `_dig` 헬퍼로 분리해 가독성을 높인다 (maintainability WARNING).
3. `self-hosting-deployment.md` 에 혼입된 "아바타 버킷 공개 정책" 세부 기술 노트는 이번 PR 병합을 막을 사안은 아니나, 향후에는 스코프 밖 발견을 체크박스(트리거)만으로 남기고 세부 내용은 해당 항목 착수 시점에 채우는 관행을 정착시킨다 (scope WARNING).
4. (낮은 우선순위, 백로그) `_PINNED` 정규식의 포트 포함 레지스트리 참조 대비, compose 쪽 malformed-type 방어, `PlaceNotFound` 커버리지(파일 부재/YAML 파싱 실패) 확장을 향후 강화 항목으로 고려한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 7명 — 실행 목록과 동일하며, forced 전원의 결과가 확보되어 미이행 항목 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 이번 diff 특성(harness 테스트+문서, 프로덕션 코드 미변경)상 해당 영역 아님으로 판단(개별 사유 상세 미제공) |
  | architecture | 상동 |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |
