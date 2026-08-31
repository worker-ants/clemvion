# 의존성(Dependency) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 이번 PR 은 `package.json`/`pnpm-lock.yaml` 을 전혀 건드리지 않는다 — 신규 외부 패키지 추가 없음
  - 위치: N/A (`package.json`/lockfile diff 없음 — `git diff origin/main...HEAD --stat -- codebase/backend/package.json pnpm-lock.yaml` 결과 빈 출력으로 직접 확인)
  - 상세: 새로 추가된 코드가 쓰는 패키지는 전부 이 브랜치 이전부터 `codebase/backend/package.json` 에 있던 것들이다 — `@aws-sdk/client-s3`(`^3.1097.0`, `package.json:30`), `@nestjs/platform-express`(`FileInterceptor`, `^11.0.1`, `:40`), `@nestjs/swagger`(`^11.4.5`, `:42`), `@nestjs/config`·`@nestjs/throttler`(기존), `express`(`^5.2.1`, `:69`, `ExpressNS` 리네임 대상), `@types/multer`(devDependency, `^2.2.0`, `:105`)·`@types/express`(`^5.0.0`, `:102`). 신규 UUID 생성도 별도 패키지 대신 Node stdlib 을 썼다 — `users.service.ts:1` `import { randomUUID } from 'node:crypto'`, 사용처 `users.service.ts:130`. 저장소에 이미 `uuid`(`^14.0.1`, `package.json:91`) + `@types/uuid`(`^10.0.0`, `:115`) 가 있음에도 그것을 새로 끌어오지 않고 stdlib 를 골랐다 — 항목 5(불필요한 의존성 회피) 관점에서 바람직한 선택이다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 코드가 실제로 쓰는 전이 의존성(`multer`)의 해석 버전이 알려진 구버전 취약점 계열이 아님을 확인
  - 위치: N/A (lockfile 조회 — `pnpm-lock.yaml:8269,19848` `multer@2.2.0`)
  - 상세: `FileInterceptor`(`@nestjs/platform-express`)가 내부적으로 쓰는 `multer` 는 `package.json` 에 직접 선언되어 있지 않고 `@nestjs/platform-express` 의 전이 의존성으로 들어오는데, lockfile 상 해석 버전은 `2.2.0` 이다. 과거 `multer` 1.x 계열에 알려졌던 DoS 류 이슈(비정상 multipart 처리)가 있던 오래된 라인이 아니다. 다만 이 버전은 이번 PR 이 새로 고정한 것이 아니라 기존 lockfile 상태를 그대로 물려받은 것이므로, 이번 diff 가 새로 만든 리스크는 없다.
  - 제안: 조치 불필요 — 참고용 확인.

- **[INFO]** `S3Service` 를 `UsersModule` 의 지역(local) provider 로 추가 — 내부 의존 구조는 기존 `KnowledgeBaseModule` 패턴과 동일
  - 위치: `codebase/backend/src/modules/users/users.module.ts:8,24` (`import { S3Service } from '../../common/services/s3.service';` / `providers: [UsersService, S3Service]`)
  - 상세: `KnowledgeBaseModule`(`codebase/backend/src/modules/knowledge-base/knowledge-base.module.ts:21,66`)도 동일하게 `S3Service` 를 지역 provider 로 선언한다. `S3Service` 는 `@Global()`/공유 모듈이 아니라 `common/services` 의 stateless 클래스이므로, 이 방식대로면 소비 모듈마다 별도의 `S3Client`(및 그 HTTP 커넥션 풀) 인스턴스가 생성된다 — 이번 PR 이 새로 만든 결함이 아니라 기존 컨벤션을 그대로 재사용한 것이다(순환 의존성은 없음: `common/services` → 각 feature module 방향 단일 참조).
  - 제안: 지금 당장 조치 불필요. S3 소비 모듈이 하나 더 늘어나는 시점에 `S3Service` 를 전역 모듈로 승격해 커넥션 풀을 공유하는 편을 검토할 만하다(이미 performance/architecture 리뷰에서도 동일 지점이 별도로 지적됨 — 중복 지적 방지를 위해 여기서는 내부 의존 구조 관점으로만 요약).

## 그 외 점검 결과 (문제 없음)

- **버전 고정**: `package.json` 자체 diff 없음. 기존 `^` 캐럿 버전 표기 컨벤션이 그대로 유지되고 루트 `pnpm-lock.yaml` 이 재현 가능한 설치를 보장 — 이번 PR 로 인한 변화 없음.
- **라이선스**: 신규 의존성이 없으므로 검토 대상 없음. 재사용된 기존 패키지(`@aws-sdk/client-s3`=Apache-2.0, `@nestjs/*`=MIT, `express`=MIT, `multer`=MIT)는 모두 프로젝트와 호환되는 permissive 라이선스이며 이전부터 이미 사용 중이었다.
- **불필요한 의존성**: 위 발견사항 참고 — `randomUUID`(stdlib)로 신규 uuid 의존을 만들지 않았고, `Content-Type` 판정도 신규 mime 라이브러리 대신 손으로 만든 확장자→MIME 매핑(`UsersService.AVATAR_CONTENT_TYPES`)을 쓴다. SSRF 판정도 신규 라이브러리 대신 기존 내부 유틸 `isPrivateHost`(`common/utils/ssrf.util.ts`)를 재사용한다(`main.ts` import).
- **의존성 크기**: 번들/빌드에 영향 있는 신규 패키지 없음.
- **호환성**: 신규 패키지가 없어 기존 의존성과의 버전 충돌 가능성 자체가 없음.

## 요약

이 PR 은 아바타 이미지 업로드(공개 버킷 + 공개 URL) 기능을 신설하지만, `package.json`/`pnpm-lock.yaml` 을 전혀 건드리지 않아 의존성 관점의 신규 위험이 없다. 실제로 쓰이는 패키지(`@aws-sdk/client-s3`, `@nestjs/platform-express`의 `FileInterceptor`, `express`, `@types/multer`)는 모두 이전부터 존재했고, UUID·MIME 판정·SSRF 판정 모두 신규 패키지 대신 stdlib 또는 기존 내부 유틸로 처리해 불필요한 의존성 추가를 회피했다(직접 파일 read + git diff 로 실측 확인). 유일하게 기록해 둘 내부 의존 구조는 `S3Service` 를 `UsersModule` 지역 provider 로 추가한 것인데, 이는 `KnowledgeBaseModule` 이 이미 쓰던 패턴을 그대로 따른 것으로 순환 의존성이나 새로운 아키텍처 리스크를 만들지 않는다. 버전 고정·라이선스·취약점·번들 크기·호환성 항목 모두 이번 diff 로 인한 변화가 없다.

## 위험도

NONE
