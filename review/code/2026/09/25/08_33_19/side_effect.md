# 부작용(Side Effect) 코드 리뷰

## 검토 범위

`k8s-avatar-policy` 작업 diff 전체(파일 1~14): `.claude/tests/README.md`, 신규 `.claude/tests/test_minio_bucket_policy_parity.py`, `.github/workflows/harness-checks.yml`, `CHANGELOG.md`, `k8s/overlays/local/infra-minio.yaml`, `plan/in-progress/k8s-avatar-policy.md`, 그리고 `review/consistency/2026/09/25/08_20_57/**` (impl-prep consistency-check 산출물, 순수 리뷰 아티팩트). 저장소 트리에는 아무것도 뮤테이션하지 않았다(읽기 전용 정적 분석) — `git status --short` 확인 불필요.

## 발견사항

- **[INFO]** k8s Job 의 실패 시맨틱을 lenient → strict 로 바꾼다 (`set -e` 도입)
  - 위치: `k8s/overlays/local/infra-minio.yaml:125` (`set -e`, args 블록 첫 줄)
  - 상세: 종전 스크립트는 `set -e` 가 없어 어떤 하위 명령(`mc alias set`, `mc mb`, 이번에 추가된 `mc anonymous set-json`)이 실패해도 마지막 명령의 종료 코드만 Job 상태로 반영됐다. 이번 변경으로 `mc anonymous set-json` 등 임의 명령이 실패하면 Job 전체가 즉시 비정상 종료하고 `backoffLimit: 5` 에 따라 재시도된다. plan(§B, §C-2)이 이를 의도적 설계로 측정까지 마쳤고(구분자 오타 시 exit 1 을 실측) CHANGELOG 에도 기록돼 있어 "의도치 않은" 부작용은 아니지만, **관측 가능한 배포-시점 행동 변화**(minio 가 일시적으로 응답하지 않을 때 Job 이 이전엔 조용히 성공 처리되던 것이 이제는 실패·재시도로 나타남)이므로 side-effect 관점에서 명시적으로 기록해 둔다. `until` 대기 루프 자체는 조건절이라 `set -e` 의 영향을 받지 않는다는 점은 plan 서술과 실제 셸 시맨틱이 일치함을 확인했다.
  - 제안: 추가 조치 불필요 — 이미 문서화·실측됨. 다만 배포 런북/알림 담당자가 "Job 이 이제 실패할 수 있다"는 사실을 인지하도록 CHANGELOG 항목(이미 있음)을 참고하라는 정도.

- **[INFO]** k8s 로컬 오버레이의 MinIO 버킷에 신규 anonymous-read 정책이 적용됨 (보안 관점 행동 변화)
  - 위치: `k8s/overlays/local/infra-minio.yaml:130-143` (heredoc 정책 + `mc anonymous set-json` 호출)
  - 상세: `minio-create-bucket` Job 이 이제 `avatars/*` 프리픽스에 대해 익명 `s3:GetObject` 를 허용하는 정책을 서버에 적용한다. 이는 두 compose 파일과의 패리티를 맞추는 의도된 수정(스펙 §5 요구사항 충족)이며 `s3:ListBucket` 은 명시적으로 배제해 목록 노출은 막았다. 새로 도입된 것은 "권한이 넓어지는 방향"의 부작용이므로 side-effect 관점에서 짚어 둔다 — 다만 compose 경로에서 이미 동일 정책이 적용 중이었고, 신규 가드 테스트(`test_minio_bucket_policy_parity.py::test_no_list_bucket_anywhere`)가 `s3:ListBucket` 재도입을 막는 회귀 테스트로 존재해 향후 확장 방향은 통제된다.
  - 제안: 조치 불필요 — 의도된 수정이고 가드로 고정됨.

- **[INFO]** 신규 heredoc 은 unquoted(`<<EOF`)라 셸 변수 확장이 일어난다 — 주입 표면 확인
  - 위치: `k8s/overlays/local/infra-minio.yaml:130-142` (heredoc 본문)
  - 상세: 의도적으로 `${S3_BUCKET}` 을 확장시키기 위해 구분자를 unquoted 로 뒀다(가드 테스트 `test_heredoc_delimiter_is_unquoted` 가 이를 고정). heredoc 본문을 직접 확인한 결과 `${S3_BUCKET}` 외의 `$`, 백틱, 백슬래시가 없어 의도치 않은 추가 확장·명령 치환 표면은 없다. `S3_BUCKET` 값 자체는 base ConfigMap 의 고정 리터럴(`workflow-storage`)이라 외부 입력에 의한 인젝션 경로도 아니다.
  - 제안: 조치 불필요 — 확인 완료.

- **[INFO]** `.github/workflows/harness-checks.yml` pathspec 확장은 CI 트리거 범위를 넓히는 부작용(의도됨)
  - 위치: `.github/workflows/harness-checks.yml:104` (`scripts/minio/avatars-public-read.json` 신규 등재)
  - 상세: 신규 pathspec 등재로 `scripts/minio/avatars-public-read.json` 단독 수정 PR 에서도 harness-checks 스위트 전체(862+ 테스트)가 실행되게 된다. 이는 "새 가드가 트리거되지 않는" 부작용을 막기 위한 의도된 확장이며, 기존 세 항목(`docker-compose.yml`·`docker-compose.e2e.yml`·`k8s/overlays/local/infra-minio.yaml`)은 그대로 유지돼 삭제/축소된 커버리지는 없다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 테스트 파일은 파일시스템 읽기만 수행, 쓰기 없음
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:133-137` (`BucketPolicyParityTest.setUp`)
  - 상세: `K8S_MINIO.read_text(...)`, `POLICY.read_text(...)` 로 두 파일을 읽기만 한다. 임시 파일 생성·전역 상태 변경·환경 변수 읽기/쓰기·네트워크 호출이 전혀 없다. 모듈 레벨 상수(`K8S_MINIO`, `POLICY`, `JOB`, `BUCKET_VAR`, `_HEREDOC`, `_ARN_BUCKET`)는 이 테스트 모듈에 국한돼 다른 모듈의 전역 상태에 영향을 주지 않는다.
  - 제안: 문제 없음.

## 요약

이번 변경은 신규 파일 추가(하네스 테스트)·문서/CI 설정 갱신·k8s manifest 한 곳의 동작 수정으로 구성되며, 기존 함수·API 시그니처를 바꾸거나 예상 밖의 전역 상태·파일시스템·환경 변수를 건드리는 부분은 없다. 유일한 실질적 "부작용"은 k8s `minio-create-bucket` Job 이 이제 (1) 익명 읽기 정책을 실제로 적용하고 (2) `set -e` 로 실패 시맨틱이 엄격해진다는 점인데, 둘 다 이 PR 의 목적 그 자체이며 plan 문서에서 실측(§C-2)·mutation 테스트(11개 KILLED)로 뒷받침돼 있다. heredoc 의 unquoted 확장도 `${S3_BUCKET}` 외 추가 주입 표면이 없음을 직접 확인했다. CI pathspec 확장은 트리거 범위를 넓히는 의도된 변경이며 기존 커버리지를 축소하지 않는다. 신규 테스트 파일은 읽기 전용이라 부작용이 없다. 전반적으로 CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도
LOW
