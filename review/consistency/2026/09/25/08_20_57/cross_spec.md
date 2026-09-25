# Cross-Spec 일관성 검토 — k8s-avatar-policy (--impl-prep)

## 스코프 확인

`prompt_file` 의 target 은 `scratchpad/scope-avatar/{0-overview.md, 9-user-profile.md}` 두 파일이며,
바이트 단위로 diff 한 결과 각각 현재 저장소의 `spec/0-overview.md`, `spec/2-navigation/9-user-profile.md`
(§6.1 아바타 관련 부분 포함) 와 **완전히 동일**하다 — 이번 작업은 `spec_impact: none` 이고 spec 본문을
바꾸지 않는다(plan: `plan/in-progress/k8s-avatar-policy.md`). 즉 target 은 "새 draft" 가 아니라 developer 가
`k8s/overlays/local` Job 스크립트에 아바타 공개 정책을 추가하기 전에 참조하는 **현행 spec 텍스트**다. 따라서
이번 검토의 실질 질문은 "이 문서가 다른 영역과 새로 충돌하는가" 가 아니라 "이 문서가 이미 다른 영역과
정합돼 있고, 계획된 구현(heredoc 정책 삽입)이 그 정합을 깨지 않는가" 다.

교차 확인한 자료:
- `spec/data-flow/4-file-storage.md` §1.3 (아바타 업로드) — 확장자 화이트리스트, SVG 제외, 2MB 제한, 키 패턴
  `avatars/{userId}/{uuid}.{ext}`, `Content-Type` 확장자 파생, 교체 시 삭제 순서 — target 의 0-overview.md §2.7 ·
  9-user-profile.md §6.1 과 **문구까지 정합**.
- `spec/1-data-model.md` §User — `avatar_url | String? | 프로필 이미지 URL` — target 서술(외부 URL/자체 업로드
  URL 공유 컬럼)과 충돌 없음.
- `k8s/base/configmap.yaml`, `docker-compose.yml`, `docker-compose.e2e.yml`, `codebase/backend/.env.example` —
  `S3_BUCKET=workflow-storage` 로 전부 동일. plan 이 지적한 "정책 파일의 `arn:...:workflow-storage/avatars/*`
  하드코딩" 문제와, 이를 heredoc + `$S3_BUCKET` 치환으로 푸는 처방은 이 값들과 상충하지 않는다.
- `k8s/overlays/staging`, `k8s/overlays/prod` — MinIO 를 전혀 provision 하지 않음(grep 결과 0건). 즉 이번
  버킷-정책 패리티 문제는 **local 오버레이에만 존재**하고, staging/prod 는 spec §2.7 "SaaS: AWS S3 사용"·
  "셀프 호스팅: MinIO" 구도와 이미 정합한다(외부 관리형 S3 endpoint 를 쓰므로 이 Job 자체가 없음). k8s 오버레이
  간 패리티 문제로 번지지 않는다.

## 발견사항

- **[INFO]** `spec/0-overview.md` §6.3 로드맵 "배포 자동화 확장" 행과 실제 `k8s/` 상태의 온도차
  - target 위치: target `0-overview.md` §6.3 로드맵 표 — "배포 자동화 확장 | 공식 Docker/Kubernetes 배포
    가이드, 셀프 호스팅 번들" (❌ 미구현으로 분류)
  - 충돌 대상: 저장소 루트 `README.md` "## Docker / Kubernetes 배포" 절(`k8s/base` + `overlays/{local,staging,prod}`
    구조·사용법 문서화됨) 및 `k8s/README.md`(Kustomize 사용법 전체 서술)
  - 상세: spec 로드맵은 "공식 Docker/Kubernetes 배포 가이드"를 미구현(❌)으로 분류하지만, README.md·
    `k8s/README.md` 에는 이미 상당히 완성된 배포 가이드(로컬/스테이징/프로드 오버레이, 이미지 빌드, Secret
    관리 안내)가 존재한다. 다만 이것이 spec 이 의도한 "**공식** 가이드·**셀프 호스팅 번들**"(고객이 직접 받아
    설치하는 배포 패키지)과 동일한 것인지, 아니면 프로젝트 자체 SaaS 인프라 운영용 내부 매니페스트인지는
    이번 스코프 자료만으로는 단정할 수 없다 — `staging`/`prod` 오버레이가 외부 관리형 S3/RDS 를 쓰는 것으로
    보아 후자(내부 운영용)에 가깝다는 정황은 있으나, 이는 이번 target 문서(0-overview.md·9-user-profile.md)의
    범위를 벗어나는 별도 확인이 필요한 사안이다.
  - 제안: 이번 k8s-avatar-policy 작업(`spec_impact: none`)의 스코프는 아니므로 차단 사유는 아니다. 다만
    `spec/0-overview.md` §6.3 의 이 로드맵 행이 실제로 stale 한지는 project-planner 가 별도 턴에서 판단할
    후보로 남긴다(이번 PR 에서 처리할 필요는 없음).

## 요약

target 으로 넘어온 `0-overview.md`·`9-user-profile.md` 의 아바타 관련 서술은 현재 `spec/` 상태 그대로이며,
`spec/data-flow/4-file-storage.md`·`spec/1-data-model.md`·k8s/docker-compose 설정값과 전 지점에서 정합한다.
계획된 구현(로컬 k8s 오버레이 Job 에 heredoc 기반 버킷 정책을 추가)은 이 문서들이 이미 서술한 "배포 선행
조건"(정책 없으면 업로드는 성공하고 이미지만 403)을 두 compose 파일과 동일하게 만드는 작업이며, 어떤
데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임도 새로 건드리거나 다른 영역과 모순시키지
않는다. staging/prod k8s 오버레이는 MinIO 를 쓰지 않아 이번 패리티 이슈의 대상이 아님을 확인했다. 유일한
비차단 관찰은 §6.3 로드맵 행의 잠재적 staleness(INFO)로, 이는 별도 트랙이다.

## 위험도

NONE
