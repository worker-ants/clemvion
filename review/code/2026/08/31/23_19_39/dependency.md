# 의존성(Dependency) 리뷰 — 아바타 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 전부 기존 의존성 재사용
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:14,18` (`UploadedFile`/`UseInterceptors`, `FileInterceptor from '@nestjs/platform-express'`), `codebase/backend/src/modules/users/users.controller.ts:26-29` (`ApiBody`·`ApiConsumes`·`ApiPayloadTooLargeResponse` from `@nestjs/swagger`), `codebase/backend/src/modules/users/users.service.ts:1` (`randomUUID` from `node:crypto`), `codebase/backend/src/common/services/s3.service.ts` 전역(`@aws-sdk/client-s3` 재사용)
  - 상세: `git diff origin/main...HEAD --stat` 와 `pnpm-lock.yaml` 확인 결과 이 PR 은 어떤 `package.json`/lock 파일도 건드리지 않는다. 사용된 패키지 — `@aws-sdk/client-s3`(`codebase/backend/package.json:30`, `^3.1097.0`), `@nestjs/platform-express`(`:40`, `^11.0.1`), `@nestjs/swagger`(`:42`, `^11.4.5`), `@types/multer`(`:105`, `^2.2.0`) — 는 모두 이 PR 이전부터 이미 설치돼 있었다. `randomUUID` 는 Node stdlib 이고 `engines.node: ">=24"`(`codebase/backend/package.json:133`)·`FROM node:24-alpine`(`Dockerfile:8,73`) 로 버전 요건을 충분히 만족한다. 신규 uuid 패키지를 추가하지 않고 stdlib 로 대체한 것은 "불필요한 의존성 회피" 관점에서 바람직하다.
  - 제안: 없음 — 현행 유지.

- **[INFO]** 내부 의존성 — `S3Service` 를 `UsersModule` 지역 provider 로 추가, 기존 패턴과 일치
  - 위치: `codebase/backend/src/modules/users/users.module.ts:8,22-24`
  - 상세: `S3Service`(`codebase/backend/src/common/services/s3.service.ts`)는 공용 모듈로 export 되지 않고, 각 소비 모듈이 개별 provider 로 등록한다. `knowledge-base.module.ts` 도 동일하게 `S3Service` 를 지역 provider 로 갖고 있어(`grep` 확인, `knowledge-base.module.ts:21,66`), 이번 추가가 새 안티패턴이 아니라 기존 컨벤션을 따른 것임을 확인했다. `S3Service` 는 stateless(생성자에서 `S3Client` 1개만 구성)이므로 모듈마다 별도 인스턴스가 생겨도 부팅 시 1회 비용 외에 런타임 영향은 없다.
  - 제안: 없음 — 모듈이 3개 이상으로 늘어나면 그때 공용 `S3Module` 로 승격을 고려할 수 있으나 현재 2개(KB, Users) 규모에서는 과설계다.

- **[INFO]** 인프라 이미지 버전 고정은 이번 PR 로 흔들리지 않음
  - 위치: `docker-compose.yml` (`minio/minio:RELEASE.2025-04-22T22-12-26Z`, `minio/mc:RELEASE.2025-04-16T18-13-26Z` — 두 줄 모두 diff 밖, 전체 파일 컨텍스트 33·51행), `docker-compose.e2e.yml`
  - 상세: 이번 변경은 `createbuckets` 서비스에 정책 파일 볼륨 마운트(`./scripts/minio/avatars-public-read.json:/policy/...:ro`)와 `mc anonymous set-json` 커맨드 한 줄만 추가한다. `minio`/`mc` 이미지 태그는 건드리지 않아 `W-59`(latest 회피) 고정 관례가 그대로 유지된다.
  - 제안: 없음.

- **[INFO]** 신규 env var(`S3_PUBLIC_BASE_URL`) 는 패키지 의존성이 아니라 설정값 — 의존성 관점에서는 영향 없음
  - 위치: `codebase/backend/src/common/config/s3.config.ts:19-22`
  - 상세: `S3_PUBLIC_BASE_URL || S3_ENDPOINT || 'http://localhost:9000'` 3단 폴백은 라이브러리 의존이 아니라 순수 설정 로직이라 이 리뷰의 범위(패키지/라이선스/취약점) 밖이다. 참고로만 남긴다 — 다른 관점(설정/보안) reviewer 가 별도로 다룰 사안.
  - 제안: 없음(범위 외).

- **[INFO]** 라이선스·취약점 스캔 대상 변경 없음
  - 위치: N/A (package.json/lockfile diff 없음)
  - 상세: 새 의존성이 없으므로 라이선스 호환성·CVE 노출 표면도 변하지 않는다. `@aws-sdk/client-s3`(`^3.1097.0`)의 알려진 취약점 여부는 이 PR 이 그 버전을 바꾸지 않았으므로 본 diff 의 책임 범위 밖이다(기존 상태 유지).
  - 제안: 없음.

## 요약

이 PR 은 아바타 업로드 기능을 신설하지만 **의존성 관점에서는 변경이 없다** — `package.json`/`pnpm-lock.yaml` 어느 파일도 diff 에 없고, 사용된 모든 패키지(`@aws-sdk/client-s3`, `@nestjs/platform-express`, `@nestjs/swagger`, `@types/multer`)는 이전부터 설치돼 있던 것이며 신규 UUID 생성도 별도 패키지 대신 Node stdlib(`node:crypto` `randomUUID`)를 썼다. `S3Service` 를 `UsersModule` 에 지역 provider 로 추가한 내부 의존 구조는 `knowledge-base.module.ts` 의 기존 패턴과 동일해 일관성이 있다. 버전 고정·라이선스·취약점·번들 크기·호환성 항목 모두 이번 diff 로 인한 새 위험이 없다.

## 위험도

NONE
