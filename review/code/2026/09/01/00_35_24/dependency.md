# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 전부 기존 의존성 재사용
  - 위치: `codebase/backend/package.json`(무변경), `codebase/backend/src/common/services/s3.service.ts:1-10`, `codebase/backend/src/modules/users/users.controller.ts:18,30,62`
  - 상세: 이번 diff 는 `package.json`/`pnpm-lock.yaml` 을 전혀 건드리지 않는다(`git diff --stat origin/main...HEAD -- codebase/backend/package.json codebase/backend/pnpm-lock.yaml` 결과 빈 출력으로 확인). 아바타 업로드 기능이 쓰는 `@aws-sdk/client-s3`(`^3.1097.0`), `@nestjs/platform-express`(`FileInterceptor`, `^11.0.1`), `@types/multer`(`^2.2.0`, devDependency)는 모두 이 브랜치 이전부터 `codebase/backend/package.json` 에 존재하던 항목이다. `Content-Type` 판정도 `mime-types` 류 신규 패키지 대신 손으로 만든 확장자→MIME 매핑(`UsersService.AVATAR_CONTENT_TYPES`, `codebase/backend/src/modules/users/users.service.ts:43-49`)을 쓴다. SSRF 판정도 새 라이브러리(`ip-range-check` 류) 대신 기존 내부 유틸 `isPrivateHost`(`codebase/backend/src/common/utils/ssrf.util.ts:14`)를 재사용한다(`codebase/backend/src/main.ts` import 라인, CHANGELOG diff 52-53행 게이트).
  - 제안: 없음 — 새 의존성 도입 없이 기존 스택으로 구현한 점은 의존성 관점에서 바람직하다.

- **[INFO]** 버전 고정 방식은 이번 PR 이전부터의 프로젝트 컨벤션 — 신규 드리프트 아님
  - 위치: `codebase/backend/package.json` (dependencies 블록 전체, 예: `@aws-sdk/client-s3: ^3.1097.0`)
  - 상세: 이 저장소는 전 의존성을 caret range(`^`)로 고정하는 컨벤션을 이미 쓰고 있고, 이번 PR 은 그 파일을 수정하지 않았다. 새로 추가된 의존성이 없으므로 "이번 변경이 도입한 미고정 버전" 은 없다.
  - 제안: 없음(기존 프로젝트 정책 범위, 이번 diff 의 책임 아님).

- **[INFO]** 라이선스/취약점 검토 대상 없음
  - 위치: N/A (신규 패키지 없음)
  - 상세: 새 외부 패키지가 없으므로 라이선스 호환성·CVE 노출면이 늘지 않는다. 기존 `@aws-sdk/client-s3` 사용 범위도 `PutObjectCommand`/`GetObjectCommand`/`DeleteObjectCommand`/`DeleteObjectsCommand` 만 추가로 쓰며 SDK API 자체는 변경 전과 동일하다(`codebase/backend/src/common/services/s3.service.ts:3-9`).
  - 제안: 없음.

- **[INFO]** 내부 의존성 — `S3Service` 를 `UsersModule` 지역 provider 로 추가, 기존 `KnowledgeBaseModule` 패턴과 동일
  - 위치: `codebase/backend/src/modules/users/users.module.ts:8,22-24`
  - 상세: `S3Service` 를 공유 모듈 export 로 승격하지 않고 `UsersModule.providers` 에 직접 등록했다. 동일 패턴이 이미 `codebase/backend/src/modules/knowledge-base/knowledge-base.module.ts:21,66` 에 존재하며, 이번 PR 의 주석도 이를 명시("KB 모듈과 같은 방식으로 지역 provider")한다. 결과적으로 `S3Service`(및 내부 `S3Client`)가 모듈마다 별도 인스턴스로 생성되는 구조가 KB 에서 Users 로 한 곳 더 늘었다 — 다만 이는 이번 PR 이 새로 만든 설계가 아니라 기존 관행을 그대로 따른 것이라 회귀는 아니다.
  - 제안: 인스턴스 중복이 실제 비용(연결 수·설정 파싱)으로 문제가 되면, `S3Service` 를 `@Global()` 모듈로 승격해 앱 전역에서 싱글턴으로 공유하는 리팩터를 별도 plan 항목으로 고려할 수 있다. 이번 PR 범위에서 조치할 필요는 없다.

- **[INFO]** 인프라 설정(비-npm) 변경은 있으나 코드 의존성은 아님
  - 위치: `docker-compose.yml`, `docker-compose.e2e.yml`, `k8s/base/configmap.yaml`, `k8s/overlays/prod/kustomization.yaml`, `k8s/overlays/staging/kustomization.yaml`
  - 상세: `mc anonymous set-json` 볼륨 마운트, `S3_PUBLIC_BASE_URL` 신규 env 는 기존 MinIO 클라이언트(`minio/mc`) 이미지·기존 S3 SDK 를 그대로 쓰며 새 컨테이너 이미지나 새 서비스를 추가하지 않는다. 이미지 태그 변경도 diff 에 없다.
  - 제안: 없음.

## 요약

이번 변경은 아바타 업로드 기능(공개 버킷 + 공개 URL) 구현이지만, **`package.json`/`pnpm-lock.yaml` 을 전혀 건드리지 않아 새 외부 npm 패키지를 추가하지 않았다** — `@aws-sdk/client-s3`, `@nestjs/platform-express`(`FileInterceptor`), `@types/multer` 모두 이전부터 존재하던 의존성을 재사용했고, `Content-Type` 판정·SSRF 판정도 신규 라이브러리 대신 손수 구현/기존 내부 유틸(`isPrivateHost`)로 처리했다. 따라서 버전 고정·라이선스·취약점·번들 크기 측면에서 이번 PR 이 새로 만드는 리스크는 없다. 유일한 내부 의존성 변화는 `S3Service` 를 `UsersModule` 지역 provider 로 추가한 것인데, 이는 기존 `KnowledgeBaseModule` 이 이미 쓰던 패턴을 그대로 따른 것이라 아키텍처 일관성 관점에서도 문제가 없다(중복 인스턴스화는 기존부터 존재하던 특성이며 이번 PR 이 새로 만든 것이 아니다).

## 위험도

NONE
