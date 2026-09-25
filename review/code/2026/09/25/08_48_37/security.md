# Security Review — k8s 아바타 정책 (avatars-public-read parity)

## 검토 범위

`git diff 643813935^ 8b8eeb776` 기준 실제 변경분:
- `k8s/overlays/local/infra-minio.yaml` — Job `minio-create-bucket` 에 anonymous-read 정책 heredoc 추가 (`set -e` 포함)
- `.claude/tests/test_minio_bucket_policy_parity.py` — 신규 drift 가드 테스트
- `scripts/minio/README.md` — 세 번째 적용 지점 문서화

## 발견사항

- **[INFO]** 익명 `s3:GetObject` 공개 정책은 UUID 키 추측 불가능성 하나에 의존한다 (defense-in-depth 부재)
  - 위치: `k8s/overlays/local/infra-minio.yaml:130-142` (heredoc `Principal: {"AWS": ["*"]}` / `Resource: ["arn:aws:s3:::${S3_BUCKET}/avatars/*"]`)
  - 상세: 이 Job 이 적용하는 정책은 인증 없이 `avatars/*` 전체를 대상으로 `s3:GetObject` 를 연다. `Action` 이 `s3:GetObject` 하나로, `s3:ListBucket` 은 명시적으로 배제되어 있고(가드 `test_no_list_bucket_anywhere`, README 실측으로 확인됨) 접근 통제는 오브젝트 키에 포함된 UUID 의 추측 불가능성에 전적으로 의존한다. 이는 `codebase/backend/src/modules/users/users.service.ts:73-80` 에 문서화된 2026-08-31 사용자 결정과 일치하는 **의도된 설계**이며, 이번 diff 는 그 정책을 k8s 로컬 오버레이에도 동일하게 맞추는 parity 작업일 뿐 새로 도입하는 위험이 아니다. 다만 새로운 배포 경로에서 이 트레이드오프가 반복 적용된다는 점은 리뷰어가 인지할 필요가 있다 — UUID 생성 알고리즘(v4 여부)이 바뀌거나 `avatars/{userId}/` 접두만으로 키가 완성되는 변형이 생기면 이 정책이 열거 공격의 표면이 된다.
  - 제안: 조치 불요(기존에 검토·측정된 설계). 향후 UUID 생성 로직을 건드리는 PR 에서는 이 정책의 전제(추측 불가능성)가 여전히 성립하는지 재확인할 것.

- **[INFO]** heredoc 의 `${S3_BUCKET}` 셸 변수 치환은 이론상 정책 파일 무결성에 대한 컨트롤 값(configmap) 신뢰에 의존한다
  - 위치: `k8s/overlays/local/infra-minio.yaml:130-142`
  - 상세: `<<EOF`(unquoted) 구분자이므로 heredoc 본문 안 `${S3_BUCKET}` 은 셸이 그대로 치환한다. 그 값은 `k8s/base/configmap.yaml:29` 의 `S3_BUCKET: "workflow-storage"` 로 고정되어 있고 사용자 입력이 아니라 클러스터 관리자가 배포하는 ConfigMap 값이므로 공격자가 통제할 수 있는 표면이 아니다. 값에 JSON 을 깨는 문자(`"`, 개행 등)가 섞이는 극단적 상황이라도 결과는 `mc anonymous set-json` 파싱 실패로 Job 이 `exit 1` 하는 것이지(문서화된 "loud failure" 설계, 가드 assertion 3), 조용한 정책 오적용이 아니다. 실질적 위험은 없음.
  - 제안: 조치 불요. ConfigMap 수정 권한 자체가 이미 클러스터 신뢰 경계 안이므로 별도 검증 불필요.

- **[INFO]** MinIO 루트 자격증명이 버킷 생성 Job 컨테이너에 그대로 주입됨 (기존 코드, 이번 diff 범위 아님)
  - 위치: `k8s/overlays/local/infra-minio.yaml:104-108` (envFrom `secretRef: backend-secret` → `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`)
  - 상세: 이 블록은 이번 diff 이전부터 존재하던 컨텍스트로, 이번 변경이 새로 추가한 권한 확대는 아니다. 버킷 생성/정책 적용만 필요한 배치 Job 에 MinIO 루트 자격증명 전체가 주입되는 구조라 최소 권한 원칙 관점에서 이상적이지는 않지만, `k8s/overlays/local` (로컬 개발 전용 오버레이)이고 `ttlSecondsAfterFinished: 300` 으로 Pod 가 곧 정리되므로 실사용 영향은 제한적이다.
  - 제안: 이번 PR 범위 밖. 별도 스코프 축소(예: 버킷 생성 전용 IAM 사용자)를 원한다면 별 트래커로 분리.

검증한 항목(문제 없음):
- 하드코딩된 시크릿 없음 — `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` 는 `secretKeyRef` 로만 참조.
- IAM 정책 최소 권한 — `Action` 은 `s3:GetObject` 단 하나, `Resource` 는 `avatars/*` 접두로 스코프 한정, `s3:ListBucket` 은 세 지점(compose ×2 + k8s) 모두에서 가드로 배제 확인.
- 인젝션 — `_HEREDOC`/`_ARN_BUCKET` 정규식은 `.*?`(non-greedy)/고정 문자 클래스라 ReDoS 표면 없음. 테스트 하네스는 고정 저장소 파일만 읽어 외부 입력을 처리하지 않음.
- 에러 처리 — `PlaceNotFound` 메시지는 YAML 구조 설명뿐, 민감정보 노출 없음.
- 의존성 — `pgsty/silo` 이미지는 이번 diff 에서 변경되지 않은 기존 컨텍스트(커밋 `643813935`/`b2cccde87` 에서 이미 검토·다이제스트 고정됨). 재검토 대상 아님.

## 요약

이번 변경은 두 compose 파일과 동일한 "avatars/\* 익명 GetObject-only" 버킷 정책을 k8s 로컬 오버레이에도 적용해 배포 방식 간 parity 를 맞추는 작업이다. 정책 자체(`s3:GetObject` 단독, `s3:ListBucket` 배제)는 기존에 사용자 결정·실측으로 검증된 설계를 그대로 재사용하며, 새 drift 가드 테스트가 두 정책 사본(canonical JSON ↔ heredoc)의 의미적 동등성과 버킷 정규화, 구분자 unquoted 여부까지 회귀 방지로 고정한다. 하드코딩된 시크릿, 인젝션, 인증 우회, 안전하지 않은 암호화 등 이 diff 가 새로 도입한 취약점은 발견되지 않았다. 유일하게 주목할 지점은 익명 공개 읽기가 UUID 키 추측 불가능성 하나에만 의존한다는 설계 자체이나, 이는 이번 PR 의 신규 위험이 아니라 사전에 검토된 트레이드오프의 parity 확장이다.

## 위험도

LOW
