# 보안(Security) 리뷰 — k8s-avatar-policy

## 대상 요약
- `k8s/overlays/local/infra-minio.yaml`: 로컬 오버레이의 `minio-create-bucket` Job 에 아바타 공개 읽기(anonymous `s3:GetObject` on `avatars/*`) 버킷 정책을 heredoc 으로 추가, `set -e` 로 fail-fast 화.
- `.claude/tests/test_minio_bucket_policy_parity.py` (신규): 위 Job 의 heredoc 정책이 `scripts/minio/avatars-public-read.json` 원본과 의미적으로 동일함을 고정하는 harness 테스트.
- `.github/workflows/harness-checks.yml`: 위 정책 파일을 pathspec 에 등재.
- `.claude/tests/README.md`, `CHANGELOG.md`, `plan/in-progress/k8s-avatar-policy.md`, `review/consistency/**`: 문서/플랜/일관성 검토 산출물.

## 발견사항

- **[INFO]** 버킷 정책 heredoc 이 `${S3_BUCKET}` 을 이스케이프 없이 JSON 문자열에 삽입한다.
  - 위치: `k8s/overlays/local/infra-minio.yaml:130`-`142` (heredoc 블록, 특히 138줄 `"Resource": ["arn:aws:s3:::${S3_BUCKET}/avatars/*"]`)
  - 상세: `S3_BUCKET` 값에 `"` 나 개행 등 JSON 구조를 깨는 문자가 들어가면 heredoc 이 생성한 JSON 이 깨진다. 다만 이 값은 사용자 입력이 아니라 `backend-config` ConfigMap(클러스터 운영자 통제) 에서 오고, `set -e` 덕분에 `mc anonymous set-json` 이 잘못된 JSON 을 거부하면 Job 이 그대로 실패한다(fail-closed) — 침묵 성공이 아니다. 새로 도입된 리스크가 아니라 기존 신뢰 경계(ConfigMap=신뢰됨) 안에서의 이론적 엣지케이스.
  - 제안: 별도 조치 불필요. ConfigMap 값에 검증되지 않은 외부 입력이 흘러들어오는 경로가 생기면 그때 재검토.

- **[INFO]** 익명 공개 읽기 정책의 기밀성은 아바타 오브젝트 키의 UUID 추측 불가능성에 전적으로 의존한다(설계상 트레이드오프, 신규 도입 아님).
  - 위치: `scripts/minio/README.md` §"왜 `mc anonymous set download` 를 쓰지 않는가" / `k8s/overlays/local/infra-minio.yaml:109-121` (근거 주석)
  - 상세: `s3:ListBucket` 을 명시적으로 배제하고 `Action: s3:GetObject` 만 `avatars/*` 에 한정한 것은 올바른 최소 권한 설계이며, README 에 `mc anonymous set download` 프리셋이 `ListBucket` 까지 여는 것을 실측으로 기각한 근거가 남아 있다. 신규 테스트(`test_no_list_bucket_anywhere`, `test_no_download_preset`)가 이 경계를 회귀로부터 고정한다. 이 diff 는 기존(compose) 정책과의 **패리티**를 k8s 로컬 오버레이에 가져오는 것이므로 새로운 노출면이 아니다.
  - 제안: 조치 불필요 — 이미 문서화·테스트된 accepted risk. 프로덕션/스테이징에 동일 정책을 적용할 때도 `ListBucket` 부재를 재확인할 것(README 에 이미 명시).

- **[INFO]** 이번 변경은 `k8s/overlays/local` 에만 적용되며 `staging`/`prod` 오버레이에는 MinIO 매니페스트 자체가 없다(확인함).
  - 위치: `k8s/overlays/{staging,prod}` 디렉터리 (해당 파일 없음)
  - 상세: 로컬 개발 환경에 한정된 변경이라 이 diff 로 인한 운영 환경 노출 확대는 없다.
  - 제안: 없음.

기타 관점 점검 결과 — 하드코딩된 시크릿 없음(`MINIO_ROOT_USER`/`PASSWORD` 는 기존과 동일하게 `secretKeyRef` 경유), 인젝션 취약점 없음(테스트 코드는 저장소 내부 파일만 읽고 사용자 입력을 다루지 않음, 정규식은 유한한 로컬 텍스트에 대해 파국적 백트래킹 형태가 아님), CI 워크플로 권한은 `contents: read` 로 최소 유지, 의존성 추가 없음(PyYAML 은 기존 승인된 예외).

## 요약
핵심 변경은 로컬 k8s 오버레이의 MinIO 버킷 Job 이 아바타 공개 읽기 정책을 걸지 않던 기존 갭을 compose 환경과 동일한 최소 권한 정책(`s3:GetObject` on `avatars/*` 만, `ListBucket` 배제)으로 메우는 보안 개선이며, 신규 harness 테스트가 그 정책의 형태(버킷 변수화, heredoc 구분자 비인용, `ListBucket`/`download` 프리셋 배제, `set -e` fail-fast)를 7개 named assertion 으로 고정한다. 하드코딩 시크릿·인젝션·인가 우회·평문 전송 등 OWASP Top 10 관점의 새로운 취약점은 발견되지 않았고, 익명 공개 접근의 기밀성이 UUID 추측 불가능성에 의존한다는 점은 이미 측정·문서화된 accepted trade-off로 이 diff 가 새로 만든 리스크가 아니다.

## 위험도
NONE
