# 부작용(Side Effect) 리뷰 — k8s-avatar-policy

## 발견사항

- **[INFO]** k8s Job 이 매 실행마다 MinIO 서버 상태를 실제로 변경한다 (의도된 부작용, 확인만)
  - 위치: `k8s/overlays/local/infra-minio.yaml:143` (`mc anonymous set-json /tmp/avatars-public-read.json local/"$S3_BUCKET"`)
  - 상세: 이 Job 은 `mc mb` 로 버킷을 만드는 것에 더해 이제 매 실행마다 MinIO 서버의 버킷 정책(익명 `s3:GetObject`)을 실제로 덮어쓴다. `set-json` 은 전체 정책을 교체(overwrite)하는 연산이라 재실행해도 최종 상태는 동일(idempotent)하고, `Action` 목록도 `s3:GetObject` 하나뿐이라 테스트(`test_no_list_bucket_anywhere`)가 `ListBucket` 부재를 고정한다. 의도된 변경이고 위험한 확장(예: `ListBucket` 부여)은 없음을 확인했다 — 결함으로 보고하는 것이 아니라, "외부 상태를 변경하는 네트워크 호출이 새로 생겼다"는 사실 자체를 부작용 관점에서 기록한다.
  - 제안: 없음(정보성). 향후 이 Job 스크립트를 고칠 때 `Action` 배열에 항목이 늘어나면 반드시 `test_no_list_bucket_anywhere`/`test_heredoc_equals_canonical_policy` 가 이를 막는지 재확인할 것.

- **[INFO]** Job 의 실패 시맨틱이 "마지막 명령 결과" → "첫 실패 즉시 중단"으로 바뀐다 (문서화된 의도적 변경)
  - 위치: `k8s/overlays/local/infra-minio.yaml:125` (`set -e`)
  - 상세: 기존에는 스크립트의 마지막 명령(`mc mb`)의 종료 코드만 Job 상태를 결정했다. `set -e` 추가로 이제는 `mc alias set` 대기 루프 이후 어떤 명령이든 실패하면 즉시 스크립트가 중단되고 Job 이 실패 처리되어 `backoffLimit: 5` 만큼 재시도된다. 이는 plan(`plan/in-progress/k8s-avatar-policy.md` §C-2, §B)에서 실측(구분자 오류 시 `exit 1`)까지 거쳐 의도적으로 도입한 변경이며, docstring assertion 7 · Job 인라인 주석에도 명시돼 있어 은닉된 부작용은 아니다. 다만 "Job 이 왜 전보다 자주 재시도/실패하는지" 를 모르는 운영자 입장에서는 배포 시 관찰되는 동작이 달라지는 것이므로, 부작용 관점에서 명시적으로 짚어둔다.
  - 제안: 없음(정보성). 이미 Job 주석·plan·README 에 반영되어 있어 추가 조치 불요.

- **[INFO]** 신규 테스트 파일이 형제 테스트 모듈의 밑줄(prefix `_`) 비공개 헬퍼를 직접 import 해 재사용한다 (숨은 결합)
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:54` (`from test_minio_image_parity import PlaceNotFound, _dig, _expect_one, _seq`)
  - 상세: `_dig`/`_expect_one`/`_seq` 는 이름 규약상 `test_minio_image_parity.py` 내부 전용으로 보이지만, 이번 변경으로 다른 테스트 파일의 공개 계약처럼 취급된다. 실제로 `.claude/tests/test_minio_image_parity.py` 를 열어 확인한 결과 이 헬퍼들은 이미 자체 boundary test 로 견고하게 고정돼 있고(`PlaceNotFound`, `_dig`, `_seq`, `_expect_one` 각각), plan 체크리스트(§D, "리뷰 1라운드 뒤 다시" 문단)에도 이 배선(W1~W6)이 15개 뮤턴트로 재검증됐다고 기록돼 있어 실질적 위험은 낮다. 다만 향후 `test_minio_image_parity.py` 리팩터링 시 이 크로스-파일 의존을 놓치면(예: 헬퍼 이름 변경·시그니처 변경) `test_minio_bucket_policy_parity.py` 가 조용히 깨지거나, 최악의 경우 의미가 달라진 채로 계속 통과할 수 있다. 코드 내 주석(`.claude/tests/test_minio_bucket_policy_parity.py:50-53`)이 "TestCase 는 import 하지 않아 이중 수집을 피한다"는 의도는 밝히고 있지만, 헬퍼 시그니처 안정성에 대한 의존은 명시돼 있지 않다.
  - 제안: 없음(정보성, 이미 완화됨). 후속으로 `test_minio_image_parity.py` 를 건드리는 PR 리뷰 시 이 import 목록을 함께 확인 대상에 넣을 것을 권장.

## 그 외 확인한 항목 (문제 없음)

- `.claude/tests/test_minio_bucket_policy_parity.py`: `K8S_MINIO.read_text()` / `POLICY.read_text()` 는 읽기 전용이며, 모듈 레벨 상수(`JOB`, `BUCKET_VAR`, 컴파일된 정규식 등)는 이 모듈 스코프에 한정돼 다른 전역 상태를 건드리지 않는다. 파일 시스템 쓰기/삭제 없음.
- `scripts/minio/README.md`, `plan/in-progress/k8s-avatar-policy.md`: 순수 문서 변경, 부작용 없음.
- `k8s/overlays/local/infra-minio.yaml`: 새로 추가된 `Action` 은 `s3:GetObject` 하나뿐이며 `s3:ListBucket` 은 어디에도 부여되지 않는다(테스트로 고정). 새 환경변수 도입/기존 환경변수 의미 변경 없음 — 기존 `S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET` 를 그대로 참조. 외부(클러스터 밖) 네트워크 호출은 없고 클러스터 내부 `minio` Service 로의 호출만 있다(기존 패턴과 동일한 대상).
- 기존 함수/공개 API 시그니처 변경 없음 — 이번 변경 세트에 포함된 신규 함수(`job_script`, `heredoc_policy`, `granted_actions` 등)는 모두 새로 추가된 것이며 기존 호출자에 영향을 주는 시그니처 변경이 아니다.

## 요약

이번 변경의 핵심 부작용은 k8s Job 이 이제 실제로 MinIO 서버의 버킷 정책을 매 실행마다 덮어쓰고(`set-json`), 실패 시맨틱이 "마지막 명령 결과"에서 "첫 실패 즉시 중단"(`set -e`)으로 바뀐다는 점인데, 둘 다 이번 작업의 목적 그 자체이며 plan·Job 인라인 주석·테스트(`ListBucket` 부재, heredoc-정본 일치, 실패 즉시성)로 문서화·고정돼 있어 은닉된 부작용이 아니다. 유일하게 짚을 만한 잠재 리스크는 신규 테스트 파일이 형제 테스트 모듈의 밑줄-비공개 헬퍼를 직접 import 하는 크로스-모듈 결합인데, 이 역시 plan 에서 뮤테이션 테스트로 배선 자체를 검증했다고 기록돼 있어 현재는 위험이 낮다. 전역 변수 신설, 예상치 못한 파일 생성/삭제, 시그니처·공개 인터페이스 파괴적 변경, 미승인 환경변수 접근, 외부 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다.

## 위험도

LOW
