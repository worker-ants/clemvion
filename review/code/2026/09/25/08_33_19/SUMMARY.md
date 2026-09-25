# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. forced 7개 reviewer(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 완료, 화이트리스트 미이행 없음. WARNING 3건은 모두 신규 가드 테스트의 완성도·문서 반영 갭으로, 배포 자체를 막을 사안은 아니다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 신규 가드 `job_script()`/`heredoc_policy()` 가 첫 매치만 반환(`search`)해, 형제 가드(`test_minio_image_parity.py`)가 이미 방어하는 "중복 Job/중복 컨테이너/중복 heredoc" 회귀 클래스를 방어하지 않는다. 동일 Job 리소스에 중복 정의가 들어가도 검사가 조용히 GREEN 을 낸다. plan §D 의 11개 뮤턴트 census 에도 이 클래스는 없어 뮤테이션 테스트로도 검증되지 않았다. | `.claude/tests/test_minio_bucket_policy_parity.py:61`(`job_script`), `:78`(`heredoc_policy`) | 형제 가드의 `_expect_one` 패턴처럼 매치 0개/2개 이상을 모두 이름 붙여 실패시키고, "중복이 명명되어 실패한다" 테스트를 `ExtractorBoundaryTest` 에 추가 |
| 2 | Maintainability | 같은 `job_script` 함수가 자매 파일(`test_minio_image_parity.py`)이 이미 정립한 `_dig`/`_seq`/`_expect_one` helper 를 재사용하지 않고 dict 순회 로직을 새로 작성했다. 또한 "Job 없음"·"container 없음"·"args 개수/타입 오류" 4가지 서로 다른 실패가 전부 동일한 고정 문구로 뭉개져, 형제 가드가 세운 "실패 사유를 이름으로 구분한다"는 관례가 이 파일엔 빠져 있다. | `.claude/tests/test_minio_bucket_policy_parity.py:61-75` | `_dig`/`_seq` 를 공유 helper 로 승격해 import 하거나, 최소한 실패 사유(구조 결측 vs 개수/타입 오류)를 메시지에 구분해 반영 |
| 3 | Documentation | `scripts/minio/README.md` 가 정책 적용 지점을 여전히 "두 compose 파일이 이 파일을 마운트해 적용"으로만 서술 — 이번 변경으로 생긴 세 번째 적용 지점(k8s Job, kustomize 제약으로 마운트 대신 heredoc 사본 적용)이 SoT 문서에 반영되지 않았다. 이 저장소가 가드로 막으려는 "손으로 적은 사본의 부분 반영" 문제와 같은 모양의 문서 갭이다. | `scripts/minio/README.md:8-9` | "k8s local 오버레이의 Job `minio-create-bucket` 은 이 파일을 직접 마운트하지 못해 heredoc 으로 정책을 복제 적용하며, 드리프트는 `test_minio_bucket_policy_parity.py` 가 고정한다" 한 문단 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | heredoc 이 `${S3_BUCKET}` 을 이스케이프 없이 JSON 에 삽입 — 값이 ConfigMap(운영자 통제) 에서 오고 `set -e` 로 실패 시 fail-closed 이므로 실질 위험은 낮은 이론적 엣지케이스 | `k8s/overlays/local/infra-minio.yaml:130-142` | 조치 불요 — 외부 입력 유입 경로가 생기면 재검토 |
| 2 | Security | 익명 공개 읽기 정책의 기밀성이 아바타 오브젝트 키 UUID 추측 불가능성에 의존 — 기존에 문서화·측정된 accepted trade-off이며 이 diff 가 새로 만든 리스크가 아님. `ListBucket` 배제는 신규 가드로 회귀 방지됨 | `scripts/minio/README.md`, `k8s/overlays/local/infra-minio.yaml:109-121` | 조치 불요 |
| 3 | Side Effect | `set -e` 도입으로 k8s Job 의 실패 시맨틱이 lenient → strict 로 변경(관측 가능한 배포-시점 행동 변화). compose 의 `createbuckets` 는 여전히 `exit 0` 로 실패를 흡수해 배포 경로 간 비대칭 존재 — plan·consistency-check 에서 이미 측정·기록되고 defer 처분됨 | `k8s/overlays/local/infra-minio.yaml:121,125` | 조치 불요(기록 완료). compose 쪽 비대칭 해소는 별도 트랙 후보 |
| 4 | Side Effect | k8s 로컬 오버레이에 신규 anonymous-read 정책 적용(권한 확대 방향의 의도된 변경) — `ListBucket` 배제 및 신규 회귀 테스트로 확장 방향 통제됨 | `k8s/overlays/local/infra-minio.yaml:130-143` | 조치 불요 |
| 5 | Side Effect | heredoc 이 unquoted(`<<EOF`)라 셸 변수 확장 발생 — 본문에 `${S3_BUCKET}` 외 추가 확장/명령치환 표면 없음을 직접 확인 | `k8s/overlays/local/infra-minio.yaml:130-142` | 조치 불요 |
| 6 | Maintainability | `job_script` docstring("or an error naming it")이 실제로는 4가지 실패가 모두 동일 고정 문구인 구현보다 넓게 들림 | `.claude/tests/test_minio_bucket_policy_parity.py:62` | 위 WARNING #2 처방과 함께 docstring 을 실제 동작에 맞게 낮추거나 이름을 붙일 것 |
| 7 | Maintainability | kustomize 제약·heredoc 채택·`set -e` 근거가 Job 주석·가드 docstring·CHANGELOG·plan 4곳에 근접 중복 — 저장소 관례(근거를 각 산출물 옆에 재서술)상 의도된 스타일 | Job 주석, 가드 docstring, CHANGELOG, plan | 조치 불요(관례). kustomize 동작이 바뀌면 4곳 동시 갱신 필요 |
| 8 | Testing | `job_script()` 가 `args` 키 자체 결측·컨테이너 리스트 공백 케이스를 별도 이름의 subTest 로 구분하지 않음(기존 케이스와 같은 분기를 타서 실질 위험은 낮음) | `.claude/tests/test_minio_bucket_policy_parity.py` `test_job_script_missing_or_malformed_is_named` | 우선순위 낮음 — 다음 수정 시 subTest 라벨 추가 |
| 9 | Requirement | impl-prep 단계의 유일한 WARNING(신규 가드 파일명이 기존 `test_minio_image_parity.py` 와 인접해 스코프 혼동 소지)은 docstring·workflow 주석·README 카탈로그 갱신으로 실제 반영되어 종결 확인 | `.claude/tests/test_minio_bucket_policy_parity.py:1-5`, `.github/workflows/harness-checks.yml:92-100`, `.claude/tests/README.md:49` | 없음(반영 완료) |
| 10 | Scope | 14개 변경 파일 전부가 단일 결함(k8s 로컬 오버레이 버킷 Job 의 아바타 공개 정책 누락) 해소에 직접 대응 — over-engineering·무관한 수정 없음 | 전체 diff | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 하드코딩 시크릿·인젝션·인가 우회 없음. 익명 공개 정책은 기존 승인된 최소 권한 설계의 패리티 확장 |
| requirement | NONE | 신규 테스트 12/12, 하네스 전체 스위트 1172 PASS 실측 확인. spec §2.7 과 line-level 일치, impl-prep WARNING 종결 확인 |
| scope | NONE | 14개 파일 전부 단일 결함 해소에 필요한 최소 집합. over-engineering·무관한 변경 없음 |
| side_effect | LOW | Job 실패 시맨틱 strict 화 + 공개 읽기 정책 적용(모두 의도되고 가드로 통제됨) |
| maintainability | LOW | `job_script` 가 자매 가드의 helper/명명된 실패 관례를 따르지 않음 |
| testing | LOW | `job_script`/`heredoc_policy` 가 "정확히 하나" 검증이 없어 중복 리소스 회귀 클래스 누락 |
| documentation | LOW | `scripts/minio/README.md` 가 신규 k8s 적용 지점을 반영하지 않음 |

## 발견 없는 에이전트

- scope — CRITICAL/WARNING/INFO 모두 없음("발견된 CRITICAL/WARNING/INFO 없음"으로 명시적 클린 리뷰)

## 권장 조치사항

1. `scripts/minio/README.md` 에 k8s local 오버레이의 heredoc 사본 적용 지점과 드리프트 가드를 설명하는 문단 추가 (WARNING #3).
2. `.claude/tests/test_minio_bucket_policy_parity.py` 의 `job_script()`/`heredoc_policy()` 를 형제 가드의 `_expect_one` 패턴으로 바꿔 중복 리소스/중복 heredoc 을 명명해 실패시키고, 대응하는 회귀 테스트 추가 (WARNING #1).
3. 같은 함수의 dict 순회 로직을 `test_minio_image_parity.py` 의 `_dig`/`_seq` 로 통일하거나, 최소한 실패 사유별 메시지를 구분 (WARNING #2).
4. 위 세 항목은 CRITICAL 이 아니며 현재 diff 의 배포를 막을 필요는 없다 — 후속 커밋 또는 다음 이 파일을 만질 때 반영 권장.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 **router_safety 강제 포함**(router 자체 선택은 0명이었고 안전망이 7개 필수 reviewer 를 전부 강제 실행함)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — forced 전원 결과 확보됨(화이트리스트 미이행 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 변경이 k8s manifest·정적 테스트 harness 축이라 성능 영향 없음으로 분류 |
  | architecture | router 판단 — 아키텍처 구조 변경 없음(기존 정책을 다른 배포 경로에 패리티 적용) |
  | dependency | router 판단 — 신규 의존성 추가 없음 |
  | database | router 판단 — DB 영향 없음 |
  | concurrency | router 판단 — 동시성 로직 변경 없음 |
  | api_contract | router 판단 — API 계약 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 가이드 영향 없음(내부 인프라/harness 변경) |
