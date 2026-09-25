# 부작용(Side Effect) 리뷰

## 검토 범위 확인

이번 라운드의 실제 diff(`fd3810242~1..HEAD`)는 3개 파일만 건드린다: `.claude/tests/test_minio_bucket_policy_parity.py`,
`scripts/minio/README.md`, `plan/in-progress/k8s-avatar-policy.md`. 프로덕션 매니페스트
`k8s/overlays/local/infra-minio.yaml`(실제 `mc anonymous set-json` 을 실행하는 Job 스크립트, 커밋 `80bfa4862`)은
이번 라운드에서 변경되지 않았고 이전 라운드(`review/code/2026/09/25/08_33_19`, `08_48_37`)에서 이미 부작용 관점
검토 대상이었다. 따라서 이번 라운드의 부작용 표면은 **테스트 하네스 코드 + 문서 2건**으로 한정된다.

## 발견사항

파일별로 아래 관점을 모두 점검했으나 지적할 부작용을 찾지 못했다.

- `test_minio_bucket_policy_parity.py`: 신규 테스트 모듈. 모듈 레벨 상수(`K8S_MINIO`, `POLICY`, `JOB`,
  `BUCKET_VAR`, 컴파일된 정규식들)는 이 파일 안에서만 참조되고, 외부에서 import 하는 지점이 없음을
  `grep -rn "heredoc_policy\|job_script\|granted_actions" .claude/tests` 로 확인했다(이 파일 자신 외 hit 없음) —
  `heredoc_policy` 반환 튜플이 이번 라운드에서 2요소→3요소(`written_path` 추가)로 바뀌었지만 시그니처 변경의
  영향을 받는 외부 호출자가 없다.
  - `from test_minio_image_parity import PlaceNotFound, _dig, _expect_one, _seq` 는 TestCase 가 아닌 헬퍼 함수만
    가져온다. `test_minio_image_parity.py` 상단을 확인한 결과 모듈 레벨에 `Path` 객체 상수만 있고 import 시점에
    파일을 읽거나 다른 부작용을 내는 코드는 없다 — 두 스위트가 pytest 로 이중 수집되거나 import 시점에 디스크
    I/O 가 두 번 발생하는 문제는 없다.
  - `BucketPolicyParityTest.setUp`/`ExtractorBoundaryTest` 는 `K8S_MINIO.read_text()` / `POLICY.read_text()` 로
    저장소 파일을 **읽기만** 하고 쓰기는 없다. subprocess/네트워크 호출, 환경변수 읽기/쓰기, 전역 변수 변경도 없다.
  - 이 헬퍼들은 정적 텍스트/YAML 분석만 하며 실제 `mc` 커맨드를 실행하지 않으므로, 테스트 실행이 실제 MinIO
    서버나 파일시스템에 영향을 줄 위험은 없다.
- `scripts/minio/README.md`, `plan/in-progress/k8s-avatar-policy.md`: 순수 문서 변경. 코드 경로·런타임 동작에
  영향 없음.

## 뮤테이션 검증

이번 리뷰에서는 저장소를 뮤테이션하지 않았다(정적 리딩·grep 만 사용). `git status --short` 는 세션 시작 시
스냅샷과 동일하게 `review/code/2026/09/25/09_03_48/` untracked 항목만 보이며 다른 변경은 없다.

## 요약

이번 라운드의 diff 는 신규 테스트 파일(읽기 전용, 외부에서 참조되지 않는 순수 헬퍼)과 문서 2건으로 구성되어
있어 부작용 관점에서 지적할 사항이 없다. 실제 부작용 표면(k8s Job 이 `mc anonymous set-json` 으로 MinIO 버킷
정책을 실제로 변경하는 부분)은 이번 라운드의 diff 밖(이전 커밋 `80bfa4862`, 이전 리뷰 라운드에서 이미 검토됨)에
있다.

## 위험도

NONE
