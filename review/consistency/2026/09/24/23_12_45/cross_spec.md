# Cross-Spec 일관성 검토 — MinIO → pgsty/silo 이미지 교체

## 검토 전제 확인

- target 으로 제시된 `scope-storage/0-overview.md`, `scope-storage/4-file-storage.md` 를
  각각 `spec/0-overview.md`, `spec/data-flow/4-file-storage.md` 와 바이트 단위로 diff 했다 —
  **완전히 동일**(diff exit 0, 변경 없음). 즉 이번 작업은 **spec 초안(draft) 을 만들지 않는다** —
  `plan/in-progress/minio-silo-image.md` 의 `spec_impact: none` 과 실측이 일치한다.
- 실제 변경 범위(plan §D)는 `docker-compose.e2e.yml` · `docker-compose.yml` · `k8s/overlays/local/infra-minio.yaml`
  세 인프라 파일의 컨테이너 이미지 태그(`quay.io/minio/*` → `pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:...`)뿐이다.
  `spec/**` 전체를 grep 했으나 특정 MinIO 이미지 태그·레지스트리를 명시한 spec 문서는 없다
  (`grep -rn "quay.io\|minio/minio\|RELEASE\.\|pgsty" spec/` → 0 건) — 이미지 교체가 갱신을 요구하는
  spec 서술 자체가 존재하지 않는다.
- 따라서 본 리뷰의 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 중 어느 것도
  이번 변경이 **새로 도입**하지 않는다 — 엔티티·엔드포인트·요구사항 ID·상태 머신·권한 구조·계층 분할
  전부 무변경.

## 보조 확인 (참고용, 비차단)

target 문서가 인용하는 인접 실체 정의가 실제 spec 과 어긋나지 않는지만 표본 확인했다(예산 초과로
번들에서 대부분 잘렸으므로 직접 `Read`):

- `spec/1-data-model.md` 의 `User.avatar_url`(String?, "프로필 이미지 URL")·`Document.file_url`(String,
  "원본 파일 저장 경로") 필드 정의는 `spec/data-flow/4-file-storage.md` §2.2 의 스키마 매핑(같은 두 컬럼,
  같은 의미론: `avatar_url`= 외부 URL 또는 자체 업로드 공개 URL 공유 컬럼, `file_url`= raw S3 key)과
  정합한다. 불일치 없음.
- `spec/0-overview.md` §2.7 의 버킷 정책 서술(아바타 접두만 익명 `GetObject` 허용, `ListBucket` 불허)은
  plan §C 의 실측(익명 목록 403 · avatars GET 200 · 그 외 403, 대조군 `set download` 프리셋은 목록 200)과
  일치 — 이미지 교체 후에도 기존 spec 이 서술하는 정책 의미론이 변하지 않았음을 developer 가 직접 확인했다.

## 발견사항

없음. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 전부에서 target 이 다른
`spec/**` 영역과 충돌할 조건(새 정의·새 계약·새 ID·새 상태·새 권한·새 책임 분할) 자체가 성립하지 않는다.

**참고(비-CRITICAL, 정보용)**: plan §D "범위 밖으로 등재할 것" 항목에 따르면 k8s 오버레이의
`minio-create-bucket` Job 은 애초부터(이번 변경 이전부터) 아바타 공개 버킷 정책을 걸지 않아 compose
두 경로와 동작이 갈린다. 이는 `spec/0-overview.md §5` 의 "두 배포 방식 모두 동일한 기능을 제공"
원칙과 표면적으로 다르지만, (a) 이번 이미지 교체가 새로 만든 차이가 아니라 기존 gap 이고, (b) plan
이 이미 트래커 항목으로 명시적으로 등재해 별도 처리를 예고했으므로, 본 cross-spec 리뷰의 대상(이번
target 초안)에 대한 발견사항으로 세지 않는다. 후속 세션에서 그 gap 을 닫을 때 `spec/0-overview.md §5`
정합 여부를 다시 확인할 것을 권고한다.

## 요약

target 은 실제로는 초안 변경이 없는 기존 spec 문서(무수정) 이며, 이번 작업 자체도 `spec/**` 어디에도
명시되지 않은 컨테이너 이미지 태그만 교체하는 순수 인프라 변경이다. 6개 Cross-Spec 관점 모두 새로
도입되는 정의가 없어 다른 영역과 충돌할 표면이 존재하지 않는다. k8s 아바타 정책 누락은 사전에 존재하고
이미 별도 트래킹된 gap 이므로 이번 target 에 대한 발견사항으로 잡지 않는다.

## 위험도

NONE
