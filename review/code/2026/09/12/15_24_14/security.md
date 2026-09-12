# 보안(Security) 리뷰 — e2e-minio-registry

## 리뷰 범위

이번 변경은 `docker-compose.e2e.yml`·`docker-compose.yml` 두 파일에서 `minio`/`createbuckets` 서비스의
이미지 레지스트리를 `docker.io` → `quay.io` 로 바꾸는 것(각 2줄, 태그는 동일 유지)과, 그 배경을 기록한
신규 plan 문서(`plan/in-progress/e2e-minio-registry.md`) 추가로 구성된다. 애플리케이션 코드·인증/인가
로직·입력 처리 경로는 변경되지 않았다.

## 발견사항

- **[INFO]** 이미지가 digest 가 아닌 tag 로만 고정되어 레지스트리 신뢰가 확장된다
  - 위치: `docker-compose.e2e.yml:68`, `docker-compose.e2e.yml:81`, `docker-compose.yml:38`, `docker-compose.yml:56`
  - 상세: `image: quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z` / `quay.io/minio/mc:RELEASE.2025-04-16T18-13-26Z` 모두 태그 참조다. 태그는 mutable 하므로(레지스트리 운영자가 같은 태그에 다른 콘텐츠를 재푸시하면) 이후 pull 이 다른 바이너리를 받아올 수 있다. 기존에도 Docker Hub 태그 참조라 동일한 성격의 약점이었고, 이번 diff 는 그 약점의 정도를 늘리거나 줄이지 않는다 — 다만 신뢰하는 레지스트리 소스가 하나 늘었다는 점(quay.io 도 신뢰 대상에 포함)은 supply-chain 관점에서 기록할 가치가 있다. quay.io/minio/* 는 MinIO 프로젝트가 공식적으로 배포하는 레지스트리이므로(plan 문서의 실측: Docker Hub 401 vs quay.io 200, 동일 image ID `sha256:6c83c74c8028…`/`sha256:0029bb25aef9…`) 이번 전환 자체는 합리적이며 공격자 통제 레지스트리로의 이동이 아니다.
  - 제안: e2e/dev 인프라라 우선순위는 낮지만, 재발(레지스트리가 또 막히거나 태그가 조용히 바뀌는 것) 방지를 원하면 `image: quay.io/minio/minio@sha256:...` 형태의 digest pin 을 검토할 수 있다. plan 문서에 이미 두 image 의 sha256 이 기록돼 있어 비용이 낮다.

- **[INFO]** e2e 전용 시크릿 하드코딩은 diff 범위 밖(기존 상태 유지)이며 라벨링이 적절하다
  - 위치: `docker-compose.e2e.yml` 전체 컨텍스트 148행(`JWT_SECRET`), 158행(`ENCRYPTION_KEY`) 부근 — 이번 diff 가 건드린 줄이 아님
  - 상세: `JWT_SECRET`, `ENCRYPTION_KEY`, `MINIO_ROOT_PASSWORD` 등이 컴포즈 파일에 평문으로 존재하나, 모두 "e2e 전용 임시 secret. 운영 절대 사용 금지" 주석이 이미 달려 있고 이번 변경으로 신규 추가된 것이 아니다. 새로운 결함으로 보고하지 않으며 참고용으로만 남긴다.

- **[INFO]** plan 문서에 기록된 image ID(sha256)는 민감정보 아님
  - 위치: `plan/in-progress/e2e-minio-registry.md:65-67` (본문 근거)
  - 상세: 검증용으로 기록한 이미지 다이제스트는 공개 레지스트리의 공개 정보이며 유출 위험이 없다.

## 요약

이번 변경은 CI/e2e 및 로컬 dev 인프라의 컨테이너 이미지 pull 소스를 Docker Hub 에서 quay.io 로 옮기는 순수 인프라 설정 변경으로, 애플리케이션 코드·인증/인가·입력 처리·시크릿 관리 로직에는 아무 영향이 없다. quay.io 는 MinIO 프로젝트의 공식 배포처이며 plan 문서에 실측(HTTP 상태 코드, image ID 동일성)이 근거로 남아 있어 공격자 통제 레지스트리로의 우회가 아니다. 유일하게 짚을 점은 이미지가 tag 참조라 digest pin 대비 mutable 참조라는 것인데, 이는 변경 전부터 존재하던 성격이고 이번 diff 가 새로 도입한 위험이 아니다. 인젝션·인증 우회·암호화 약화·에러 메시지 정보노출 등 다른 관점에서는 해당 사항이 없다.

## 위험도

NONE
