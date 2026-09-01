# 의존성(Dependency) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 전부 기존 의존성 재사용
  - 위치: `codebase/backend/package.json`(무변경), `codebase/backend/src/modules/users/users.controller.ts` import 블록(`UploadedFile`/`UseInterceptors` from `@nestjs/common`, `FileInterceptor` from `@nestjs/platform-express`, `ApiBody`/`ApiConsumes`/`ApiPayloadTooLargeResponse` from `@nestjs/swagger`), `codebase/backend/src/modules/users/users.service.ts:1`(`randomUUID` from `node:crypto`), `codebase/backend/src/common/services/s3.service.ts`(기존 `@aws-sdk/client-s3` import 재사용, 새 SDK command 없음)
  - 상세: `git diff origin/main...HEAD --stat -- codebase/backend/package.json codebase/backend/pnpm-lock.yaml codebase/frontend/package.json pnpm-lock.yaml package.json` 을 직접 실행해 빈 출력을 확인했다 — 이 PR 은 어떤 `package.json`/lock 파일도 건드리지 않는다. 사용된 패키지 — `@aws-sdk/client-s3`(`^3.1097.0`, `package.json:30`), `@nestjs/platform-express`(`^11.0.1`, `:40`), `@nestjs/swagger`(`^11.4.5`, `:42`), `@types/multer`(`^2.2.0`, devDependency, `:105`) — 는 모두 이 브랜치 이전부터 설치돼 있었다. `s3.service.ts` 의 `getPublicUrl()` 도 문자열 조립(`String.prototype.replace`/`split`/`encodeURIComponent`)만 하며 새 AWS SDK command 를 추가로 import 하지 않는다(기존 `PutObjectCommand`/`GetObjectCommand`/`DeleteObjectCommand`/`DeleteObjectsCommand` 그대로). `randomUUID` 는 Node stdlib(`node:crypto`)이고 `engines.node: ">=24"`(`package.json:133`)·`FROM node:24-alpine`(`Dockerfile`)로 버전 요건을 충분히 만족한다. `Content-Type` 판정도 `mime-types` 류 신규 패키지 대신 손으로 만든 확장자→MIME 매핑(`UsersService.AVATAR_CONTENT_TYPES`)을 쓰고, SSRF 판정도 새 라이브러리 대신 기존 내부 유틸 `isPrivateHost`(`common/utils/ssrf.util.ts`)를 재사용한다.
  - 제안: 없음 — 표준 라이브러리/기존 의존성으로 충분히 구현했다는 점은 "불필요한 의존성" 관점에서 바람직하다.

- **[INFO]** 버전 고정 방식은 이번 PR 이전부터의 프로젝트 컨벤션이며 신규 드리프트 아님
  - 위치: `codebase/backend/package.json` (dependencies 블록, 예: `@aws-sdk/client-s3: ^3.1097.0`)
  - 상세: 저장소는 전 의존성을 caret range(`^`)로 고정하는 기존 컨벤션을 쓰며, 이번 PR 은 그 파일 자체를 전혀 수정하지 않았다. 새로 추가된 의존성이 없으므로 "이번 변경이 새로 도입한 미고정 버전"은 없다.
  - 제안: 없음(기존 프로젝트 정책 범위, 이번 diff 의 책임 밖).

- **[INFO]** 라이선스·취약점 검토 대상 없음
  - 위치: N/A(신규 패키지 없음)
  - 상세: 새 외부 npm 패키지가 없으므로 라이선스 호환성·CVE 노출 표면이 늘지 않는다. 기존 `@aws-sdk/client-s3` 사용 버전(`^3.1097.0`)도 이 PR 이 바꾸지 않아 취약점 여부는 본 diff 책임 범위 밖이다(기존 상태 유지).
  - 제안: 없음.

- **[INFO]** 내부 의존성 — `S3Service` 를 `UsersModule` 지역 provider 로 신규 등록, 기존 `KnowledgeBaseModule` 패턴과 동일
  - 위치: `codebase/backend/src/modules/users/users.module.ts`(`import { S3Service } from '../../common/services/s3.service'`, `providers: [UsersService, S3Service]`)
  - 상세: `S3Service` 를 공유(`@Global`) 모듈로 승격하지 않고 `UsersModule.providers` 에 직접 등록했다. 동일 패턴이 `codebase/backend/src/modules/knowledge-base/knowledge-base.module.ts`(21행 import, 66행 providers)에 이미 존재함을 직접 확인했다 — PR 주석("KB 모듈과 같은 방식으로 지역 provider")도 이를 명시한다. 결과적으로 Nest 싱글톤 스코프 안에서 모듈별 `S3Client`(및 그 커넥션 풀)가 KB 에서 Users 로 한 곳 더 늘어나지만, 이는 이번 PR 이 새로 만든 설계가 아니라 기존 관행을 그대로 따른 것이라 아키텍처 회귀는 아니다.
  - 제안: 이번 PR 범위에서 조치 불필요. S3 소비 모듈이 더 늘어나면 `S3Service` 를 `@Global()` 로 승격해 커넥션 풀을 공유하는 리팩터를 별도 plan 항목으로 고려할 수 있다.

- **[INFO]** 비-npm 인프라 설정 변경(`docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/*`)은 있으나 코드 의존성 변화는 아님
  - 위치: `docker-compose.yml`, `docker-compose.e2e.yml`, `k8s/base/configmap.yaml`, `k8s/overlays/local/configmap-patch.yaml`, `k8s/overlays/prod/kustomization.yaml`, `k8s/overlays/staging/kustomization.yaml`, `scripts/minio/avatars-public-read.json`(신규)
  - 상세: `mc anonymous set-json` 볼륨 마운트, `S3_PUBLIC_BASE_URL` 신규 env 는 기존 MinIO 클라이언트(`minio/mc`) 이미지·기존 S3 SDK 를 그대로 쓰며 새 컨테이너 이미지나 새 서비스를 추가하지 않는다. 이미지 태그 변경도 diff 에 없다. `scripts/minio/avatars-public-read.json` 은 JSON 정책 파일일 뿐 npm 의존성이 아니다.
  - 제안: 없음.

## 요약

이번 변경(아바타 이미지 업로드, 공개 버킷 + 공개 URL)은 `package.json`/`pnpm-lock.yaml` 어느 파일도 건드리지 않아 **새 외부 npm 패키지를 하나도 추가하지 않았다** — `@aws-sdk/client-s3`, `@nestjs/platform-express`(`FileInterceptor`), `@nestjs/swagger`(`ApiBody`/`ApiConsumes`/`ApiPayloadTooLargeResponse`), `@types/multer` 모두 이전부터 설치돼 있던 항목을 재사용했고, UUID 생성(`node:crypto` `randomUUID`)·Content-Type 판정·SSRF 판정도 신규 라이브러리 대신 stdlib 또는 기존 내부 유틸로 처리했다. `git diff origin/main...HEAD --stat` 로 package.json/lock 무변경을 직접 재확인했다. 유일한 의존성 관련 변화는 `S3Service` 를 `UsersModule` 지역 provider 로 추가한 내부 모듈 의존인데, 이는 기존 `KnowledgeBaseModule` 이 이미 쓰던 패턴과 동일해(직접 확인) 일관성이 있다. 버전 고정·라이선스·취약점·번들 크기·기존 의존성과의 호환성 모든 항목에서 이번 diff 가 새로 만드는 리스크는 없다. 참고로 동일 결론이 이 PR 의 이전 리뷰 라운드들(22:12/22:44/23:19/23:46/00:11/00:35, `review/code/2026/08/31,09/01/**/dependency.md`)에서도 반복적으로 도출돼 있어 안정적으로 수렴한 상태다.

## 위험도

NONE
