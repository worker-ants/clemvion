# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. testing 리뷰어가 실측(뮤테이션 프로브)으로 확인한 WARNING 2건(README 의 CI 트리거 등재 주장이 실측과 불일치, heredoc 임시 파일 경로 쌍의 일치를 어떤 테스트도 단언하지 않음)이 병합을 막을 정도는 아니나 이 PR 이 스스로 표방하는 "정확한 문서·완전한 커버리지" 기준에는 못 미친다. 나머지는 모두 INFO(정보성) 이며, 정책 자체(익명 GetObject 전용, UUID 추측 불가능성 의존)는 기존에 검토·측정된 설계의 parity 확장으로 신규 위험이 아니다.

**라우터 강제 이행 확인**: `forced (router_safety)` 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 인라인으로 확보되었다 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `scripts/minio/README.md` 가 신규 문단에서 자신(README)이 `harness-checks.yml` CI 트리거 pathspec 에 등재돼 있어 "이 파일만 고친 PR 에서도 가드가 돈다" 고 주장하나, 실측(`grep -n "^\s*scripts/" .github/workflows/harness-checks.yml`) 결과 pathspec 에는 `k8s/overlays/local/infra-minio.yaml`·`scripts/minio/avatars-public-read.json` 두 개만 있고 README.md 는 등재돼 있지 않다. 게다가 신규 가드는 애초에 README.md 를 읽지도 않는다 | `scripts/minio/README.md:17`; 관련 `.github/workflows/harness-checks.yml` pathspecs | 문장을 삭제/완화(예: "이 파일이 설명하는 두 원본이 바뀌면 가드가 돈다")하거나, 실제로 README.md 를 pathspec 에 등재 |
| 2 | 테스트 | heredoc 이 쓰는 임시 파일 경로(`cat > /tmp/avatars-public-read.json <<EOF` 의 대상)와 `mc anonymous set-json` 의 소스 인자가 같은 문자열이어야 함을 어떤 테스트도 단언하지 않는다 — 경로를 다르게 바꾼 스크립트로도 기존 12개 테스트 단언이 전부 통과함을 뮤테이션 프로브로 실증 | `.claude/tests/test_minio_bucket_policy_parity.py` (`heredoc_policy()`, `test_policy_is_applied_to_the_created_bucket`) | 두 인자의 경로 문자열이 동일함을 단언하는 테스트를 추가하거나 `heredoc_policy` 가 `cat >` 대상 경로도 함께 반환하도록 확장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 익명 `s3:GetObject` 공개 정책이 오브젝트 키(UUID)의 추측 불가능성 하나에만 의존(defense-in-depth 부재). 2026-08-31 사용자 결정과 일치하는 기존 설계의 parity 확장 | `k8s/overlays/local/infra-minio.yaml:130-142` | 조치 불요. UUID 생성 로직 변경 PR 에서 전제 재확인 |
| 2 | 보안 | heredoc 의 `${S3_BUCKET}` 셸 변수 치환은 ConfigMap 값(`workflow-storage`, 클러스터 관리자 통제) 신뢰에 의존. 값이 깨져도 `mc anonymous set-json` 파싱 실패로 loud 하게 실패 | `k8s/overlays/local/infra-minio.yaml:130-142` | 조치 불요 |
| 3 | 보안 | MinIO 루트 자격증명이 버킷 생성 Job 컨테이너에 그대로 주입(이번 diff 이전부터 존재, 로컬 전용 오버레이, `ttlSecondsAfterFinished: 300`) | `k8s/overlays/local/infra-minio.yaml:104-108` | 이번 PR 범위 밖. 최소 권한 축소를 원하면 별도 트래커 |
| 4 | 요구사항 | compose 는 정책 적용 실패를 `exit 0` 으로 삼키고 k8s Job 은 `set -e` 로 실패시키는 비대칭이 여전히 존재(plan 에서 이미 defer 확정된 항목의 재확인) | `k8s/overlays/local/infra-minio.yaml:121`(주석) / `docker-compose.yml:87` 부근 | 조치 불요(plan 확정). 후속 PR 후보로만 유지 |
| 5 | 테스트 | `_HEREDOC` 정규식이 `<<-EOF`(탭 들여쓰기 종료 델리미터) 형태는 지원하지 않음. 현재 Job 스크립트는 YAML block-scalar 디덴트로 종료 `EOF` 가 컬럼 0 이라 문제 없음 | `.claude/tests/test_minio_bucket_policy_parity.py:62,145` | 조치 불요. 향후 들여쓰기 방식 변경 시 재검토 |
| 6 | 테스트 | `_HEREDOC` 정규식은 닫는 `EOF` 뒤 개행이 하나 더 필요 — heredoc 이 스크립트의 마지막 줄이면 매치 실패(현재는 뒤에 `mc anonymous set-json` 줄이 항상 있어 문제 없음, 실패 시 `PlaceNotFound` 로 loud) | `.claude/tests/test_minio_bucket_policy_parity.py:62` | docstring 에 가정 명시 또는 lookahead 로 완화 |
| 7 | 테스트 | `granted_actions()` 는 `Action` 키만 보고 `NotAction` 은 보지 않아 이론상 `NotAction: ["s3:GetObject"]` 형태로 `test_no_list_bucket_anywhere` 우회 가능(실현 가능성 낮음) | `.claude/tests/test_minio_bucket_policy_parity.py:94-100` | 낮은 우선순위, 현재 조치 불요 |
| 8 | 부작용 | k8s Job 이 매 실행마다 MinIO 버킷 정책(`set-json`)을 실제로 덮어씀 — 전체 교체 연산이라 idempotent, `Action` 은 `s3:GetObject` 하나뿐(의도된 부작용) | `k8s/overlays/local/infra-minio.yaml:143` | 정보성. `Action` 배열이 늘어나면 `test_no_list_bucket_anywhere` 재확인 |
| 9 | 부작용 | `set -e` 추가로 Job 실패 시맨틱이 "마지막 명령 결과" → "첫 실패 즉시 중단" 으로 변경(plan·Job 주석에 문서화된 의도적 변경, `backoffLimit: 5` 로 재시도) | `k8s/overlays/local/infra-minio.yaml:125` | 정보성. 이미 문서화되어 추가 조치 불요 |
| 10 | 유지보수성 | 신규 테스트가 형제 모듈(`test_minio_image_parity.py`)의 밑줄(private) 헬퍼(`_dig`,`_expect_one`,`_seq`,`PlaceNotFound`)를 직접 import — 이름 규약(비공개)과 실제 사용(공유 계약)이 어긋나, 형제 모듈에서 이름/시그니처 변경 시 `ImportError` 로만 감지됨(side_effect·maintainability 리뷰어 공통 지적) | `.claude/tests/test_minio_bucket_policy_parity.py:54` | 네 헬퍼를 두 파일이 공유하는 `_harness` 모듈로 옮기고 언더스코어 없는 공개 이름으로 노출 |
| 11 | 유지보수성 | 버킷 치환 로직(`self.heredoc.replace(BUCKET_VAR, ...)` → `json.loads(...)`)이 두 테스트에서 거의 동일하게 반복 | `.claude/tests/test_minio_bucket_policy_parity.py:184,189` | `_heredoc_json(self, bucket)` 같은 작은 헬퍼로 추출 |
| 12 | 유지보수성 | `/tmp/avatars-public-read.json` 경로 리터럴이 heredoc 스크립트 안에서 두 번 하드코딩(버킷 이름은 변수화했지만 같은 원칙이 경로엔 미적용) | `k8s/overlays/local/infra-minio.yaml:130,143` | `POLICY_FILE=/tmp/avatars-public-read.json` 변수로 통일 |
| 13 | 유지보수성 | 설계 근거(heredoc 채택 이유·`set download` 금지·`set -e` 필요성)가 README·plan·YAML 주석·테스트 docstring 4곳에 독립 산문으로 반복 — 정책 JSON 일치는 테스트가 고정하지만 산문 일치는 강제 수단 없음 | `scripts/minio/README.md:11-17`, `plan/in-progress/k8s-avatar-policy.md`, `k8s/overlays/local/infra-minio.yaml:109-121`, `.claude/tests/test_minio_bucket_policy_parity.py:1-40` | 저장소의 위치별 독립 서술 관례상 CRITICAL/WARNING 아님. 필요 시 README 를 정본으로 삼고 나머지는 요약 인용으로 축소 고려 |
| 14 | 유지보수성 | `ExtractorBoundaryTest` 클래스명이 형제 파일(`test_minio_image_parity.py:180`)과 동일 — pytest 수집엔 문제없으나 `-k ExtractorBoundaryTest` 필터링 시 두 파일 결과가 섞임 | `.claude/tests/test_minio_bucket_policy_parity.py:115` | 조치 불요(기존 관례 준수), 우선순위 낮음 |
| 15 | 문서화 | 신규 `BucketPolicyParityTest` 클래스에 클래스 독스트링 없음 — 형제 가드(`MinioImageParityTest`)도 동일하게 없는 기존 컨벤션, 모듈 독스트링·메서드명이 자기서술적이라 실질 정보 손실 없음 | `.claude/tests/test_minio_bucket_policy_parity.py:162` | 조치 불요(기존 컨벤션과 일관) |
| 16 | 문서화 | `scripts/minio/README.md` 11-17줄에서 "이 파일" 대명사가 반복 사용되어, 마지막 문장("이 파일은 그 가드의 CI 트리거에 등재돼 있어…")의 선행사가 정책 파일인지 가드 파일인지 오독될 여지(문장 자체는 사실관계상 정책 파일을 가리켜 정확함) | `scripts/minio/README.md:15-17` | "이 파일은" 대신 "정책 파일은" 등 명시적 명사로 교체(선택 사항) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 익명 GetObject 정책이 UUID 추측 불가능성에만 의존(기존 검토된 트레이드오프), 신규 취약점 없음 |
| requirement | NONE | spec(§2.7, §6.1)·코드·문서·plan 이 문구 수준까지 일치, 뮤테이션(D5·D3) 재검증 완료 |
| scope | NONE | 4개 파일 전부 단일 목표(버킷 정책 parity)에 정확히 대응, 스코프 이탈 없음 |
| side_effect | LOW | Job 이 매 실행 버킷 정책을 덮어쓰고 `set -e` 로 실패 시맨틱 변경(둘 다 의도되고 문서화됨), 크로스모듈 private import 결합 |
| maintainability | LOW | private 헬퍼 크로스임포트, 소규모 중복 2건, 경로 리터럴 중복, 설계 근거 4곳 반복 — 전부 INFO |
| testing | MEDIUM | README 의 CI 트리거 등재 주장이 실측과 불일치, heredoc 경로 쌍 일치를 검증하는 테스트 부재(뮤테이션으로 실증) |
| documentation | NONE | 신규 가드·README·CHANGELOG·pathspec·spec 교차 참조가 전부 실제 코드와 일치, INFO 2건뿐 |

## 발견 없는 에이전트

- scope — "발견사항: 없음" (4개 파일 모두 단일 결함 수정 및 drift 가드에 정확히 대응한다고 명시)

## 권장 조치사항

1. `scripts/minio/README.md:17` 의 "이 파일은 그 가드의 CI 트리거에 등재돼 있다" 문장을 실측에 맞게 정정하거나(정책 JSON/k8s YAML 이 바뀌면 가드가 돈다는 식으로), 실제로 README.md 를 `harness-checks.yml` pathspec 에 등재한다. (WARNING #1)
2. `.claude/tests/test_minio_bucket_policy_parity.py` 에 heredoc 임시 파일 경로(`cat >` 대상)와 `mc anonymous set-json` 소스 인자가 동일한 문자열임을 단언하는 테스트를 추가한다. (WARNING #2)
3. (선택) 형제 모듈의 private 헬퍼(`_dig`,`_expect_one`,`_seq`,`PlaceNotFound`)를 공유 `_harness` 모듈로 옮겨 공개 이름으로 노출하고, `/tmp/avatars-public-read.json` 경로를 변수로 통일하는 등 INFO 항목들은 우선순위가 낮으므로 다음 리팩터링 시 일괄 처리한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 전원 — forced 전원 결과 확보됨, 미이행 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 변경 범위(사유 상세 미제공) |
  | architecture | router 판단 — 이번 변경 범위(사유 상세 미제공) |
  | dependency | router 판단 — 이번 변경 범위(사유 상세 미제공) |
  | database | router 판단 — 이번 변경 범위(사유 상세 미제공) |
  | concurrency | router 판단 — 이번 변경 범위(사유 상세 미제공) |
  | api_contract | router 판단 — 이번 변경 범위(사유 상세 미제공) |
  | user_guide_sync | router 판단 — 이번 변경 범위(사유 상세 미제공) |
