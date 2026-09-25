# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 3건(모두 테스트 하네스 자체의 문서-구현 정합·DRY 이슈, 기능적 결함 아님). router가 강제 지정한 7개 reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원의 결과를 확보했고 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | 모듈 docstring이 "각 assertion은 하나의 회귀 형태를 이름 붙인다"며 회귀 형태를 7개로 열거하지만 실제 assertion 메서드는 8개다. 2라운드에서 추가된 `test_set_json_reads_the_file_the_heredoc_wrote`(heredoc이 쓴 경로와 `set-json`이 읽는 경로가 같은지 단언)가 번호 목록에 반영되지 않았다 | `.claude/tests/test_minio_bucket_policy_parity.py:70-87`(docstring), 대응 테스트 `:180-184` | docstring 번호 목록에 8번째 항목 추가: "the file the heredoc writes is the same file `set-json` reads" |
| 2 | 유지보수성 | `_SET_JSON` 정규식(모듈 상수)과 `test_policy_is_applied_to_the_created_bucket` 내부 인라인 정규식 리터럴이 named group 유무만 다를 뿐 동일 패턴을 중복 정의 — `mc anonymous set-json` 커맨드 형식이 바뀌면 두 곳을 모두 고쳐야 하고 한쪽만 고치면 나머지가 혼란스럽게 실패 | `.claude/tests/test_minio_bucket_policy_parity.py:68`(`_SET_JSON`), `:178`(인라인 리터럴) | `test_policy_is_applied_to_the_created_bucket`에서 `_SET_JSON`(또는 `.pattern`)을 직접 재사용 |
| 3 | 유지보수성 | `job_script()`가 형제 가드 `k8s_images()`의 "리소스→컨테이너 매핑-워크" 구조를 재구현. 파일 자체 주석(49~53행)은 "매핑-워크 체크는 이미지 가드에 ONCE만 있고 여기선 헬퍼만 임포트한다"고 주장하지만 실제로는 leaf 헬퍼만 재사용되고 복합 워크는 다시 작성돼 있어, 형제 파일이 스스로 경계하는 "walk를 장소마다 복사하는" 안티패턴과 같은 모양이 됨 | `test_minio_bucket_policy_parity.py` `job_script()` (72~90행) vs `test_minio_image_parity.py` `k8s_images()` (148~165행) | 리소스/컨테이너 탐색부를 공용 헬퍼(예: `_find_container`)로 추출해 양쪽에서 재사용하거나, "ONCE" 주석 범위를 leaf 헬퍼로만 한정해 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `job_script()`의 `_dig`/`_seq` 배선(metadata→spec→template→spec 체인)을 고정하는 "구조 오작동(metadata가 list, containers가 mapping 등)도 이름 있는 실패" 경계 테스트가 없음. 뮤턴트(`_dig` → 순진한 `.get()` 체인)로 직접 재현 결과 `PlaceNotFound` 대신 `AttributeError`가 그대로 터짐을 확인. 다만 실패 자체는 조용하지 않음(즉시 크래시)이라 정확성 결함이 아닌 진단 품질 문제 | `test_minio_bucket_policy_parity.py` `job_script()` (72~90행), `test_job_script_failures_are_named_by_reason` (128~149행) | 우선순위 낮음. 형제 가드의 `test_k8s_malformed_shapes_are_named_not_attribute_error`를 본떠 subTest 1~2개 추가 시 두 가드의 배선 보증 수준이 대칭을 이룸 |
| 2 | 문서화 | `heredoc_policy` 독스트링이 실패 조건을 "zero or two"로만 적어 3개 이상인 경우를 명시하지 않음(실제 구현은 `_expect_one`으로 일반화돼 있어 동작은 정확) | `test_minio_bucket_policy_parity.py:94` | "zero or (more than one) fail" 등으로 문구 일반화(사소, 차단 사유 아님) |
| 3 | 유지보수성 | 픽스처 헬퍼 배치 컨벤션이 형제 파일과 다름 — 새 파일은 `_job_yaml`/`_mc`를 모듈 레벨 함수로 두는데, 형제 파일은 동일 역할 헬퍼(`_k8s`)를 클래스 내부 `@staticmethod`로 둠 | `test_minio_bucket_policy_parity.py:110-119` vs `test_minio_image_parity.py:188-196` | 두 파일 중 하나의 컨벤션으로 통일 |
| 4 | 유지보수성 | `job_script()` 내부에서 모듈 상수 `K8S_MINIO`가 이미 갖고 있는 매니페스트 경로를 에러 메시지용 `label` 문자열로 별도 리터럴 재하드코딩(형제 파일에도 이미 있던 기존 관례, 이번 PR이 새로 만든 문제는 아님) | `job_script()` 내 `label = "k8s/overlays/local/infra-minio.yaml"` | 후속 과제로 상수 파생값 사용 검토(이번 PR 스코프 밖) |
| 5 | 보안 | 익명 공개 읽기의 유일한 방어선은 UUID 추측 불가능성이며, `s3:ListBucket` 미부여 불변식이 코드·문서·테스트 세 곳에서 동시에 고정돼 있음(설계 트레이드오프로 README에 명시적으로 인지·기록됨) | `scripts/minio/README.md:39` | 조치 불요. 더 강한 통제(예: 만료 있는 signed URL) 필요 시 별도 plan |
| 6 | 보안 | 가드 테스트가 정규식으로 셸 heredoc 문법을 파싱 — fail-closed 방향의 브리틀함(매치 실패 시 이름 있는 예외로 테스트가 시끄럽게 실패하는 구조이며, 입력도 공격 표면이 아님) | `test_minio_bucket_policy_parity.py:64-69` | 현행 유지 |
| 7 | 보안 | 3개 파일 전체에서 하드코딩된 시크릿/자격증명 리터럴 없음을 확인 | 전체 | 조치 불요 |
| 8 | 문서화 | 가드 docstring·README·plan·CHANGELOG·`harness-checks.yml`·`infra-minio.yaml` 간 상호 참조가 전부 실측과 일치함을 교차 확인(결함 아님, 참고 기록) | 다수 파일 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | CRITICAL/WARNING 없음. INFO 3건(설계 트레이드오프·정규식 파싱 브리틀함·시크릿 없음 확인) |
| requirement | LOW | WARNING 1건(docstring 회귀 형태 목록이 8번째 항목 누락). 기능/spec fidelity(spec §6.1과 line-level 일치), 테스트 실행(13 tests/17 subtests PASS) 전부 확인 |
| scope | NONE | 발견사항 없음 — 이번 라운드 diff가 직전 라운드 WARNING 2건에 정확히 대응, 스코프 이탈 없음 |
| side_effect | NONE | 발견사항 없음 — 신규 테스트는 읽기 전용 순수 헬퍼, 외부에서 참조되지 않음 |
| maintainability | LOW | WARNING 2건(정규식 중복 정의, 형제 가드 매핑-워크 재구현). INFO 2건(픽스처 배치 컨벤션 불일치, 경로 리터럴 재하드코딩) |
| testing | LOW | INFO 1건(구조-오작동 경계 테스트 비대칭, 뮤턴트로 재현). 17개 뮤턴트 전수 KILLED, 하네스 전체 1173 passed 확인 |
| documentation | NONE | INFO 2건(독스트링 경계 서술이 실제보다 좁음, 상호참조 실측 일치 확인 — 결함 아님) |

## 발견 없는 에이전트

- scope
- side_effect

## 권장 조치사항

1. `test_minio_bucket_policy_parity.py` 모듈 docstring의 회귀 형태 번호 목록에 8번째 항목(heredoc이 쓴 파일 = `set-json`이 읽는 파일) 추가.
2. `test_policy_is_applied_to_the_created_bucket`의 인라인 정규식 리터럴을 `_SET_JSON` 모듈 상수 재사용으로 교체해 중복 제거.
3. `job_script()`의 리소스/컨테이너 매핑-워크 재구현을 공용 헬퍼로 추출하거나, "walk는 ONCE만 있다"는 주석 범위를 실제(leaf 헬퍼만 재사용)에 맞게 정정.
4. (낮은 우선순위) `job_script()`에 형제 가드를 본뜬 구조-오작동 경계 테스트(`ExtractorBoundaryTest`에 subTest 추가) 도입.
5. (사소) `heredoc_policy` 독스트링의 "zero or two" 문구를 "zero or more than one"으로 일반화.

## 라우터 결정

- `routing_status=done` (router가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 전원 — forced 목록과 실행 목록이 동일하며, forced 전원 결과 확보됨)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff(테스트 하네스 2개 파일 + 문서 1개)와 무관한 축으로 분류 (개별 사유 미상세 제공) |
  | architecture | router 판단 — 상동 |
  | dependency | router 판단 — 상동 |
  | database | router 판단 — 상동 |
  | concurrency | router 판단 — 상동 |
  | api_contract | router 판단 — 상동 |
  | user_guide_sync | router 판단 — 상동 |
