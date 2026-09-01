# 의존성(Dependency) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 이번 PR 은 `package.json`/`pnpm-lock.yaml` 을 전혀 건드리지 않는다 — 신규 외부 패키지 추가 없음
  - 위치: N/A (`package.json`/lockfile diff 없음 — `git diff origin/main...HEAD --stat -- '**/package.json' '**/pnpm-lock.yaml'` 결과 빈 출력, `git diff origin/main...HEAD --stat` 전체(160개 파일)에도 두 파일 미포함으로 직접 재확인)
  - 상세: 신규 코드가 쓰는 패키지는 전부 이 브랜치 이전부터 존재하던 것들이다. `codebase/backend/src/modules/users/users.controller.ts` 는 `@nestjs/platform-express` 의 `FileInterceptor`, `@nestjs/swagger` 의 `ApiBody`/`ApiConsumes`/`ApiPayloadTooLargeResponse` 등, `@nestjs/config`, `@nestjs/throttler` 를 그대로 import — 신규 라이브러리 없음. `codebase/backend/src/modules/users/users.service.ts:1` 은 `import { randomUUID } from 'node:crypto'` 로 UUID 생성을 stdlib 로 해결했다(저장소에 이미 `uuid`/`@types/uuid` 가 있는데도 새로 끌어오지 않음 — 항목 5 "불필요한 의존성 회피" 관점에서 바람직).
  - 제안: 조치 불필요.

- **[INFO]** `S3Service` 를 `UsersModule` 지역(local) provider 로 추가 — 내부 의존 구조는 기존 `KnowledgeBaseModule` 패턴 재사용
  - 위치: `codebase/backend/src/modules/users/users.module.ts` (`import { S3Service } from '../../common/services/s3.service';` / `providers: [UsersService, S3Service]`)
  - 상세: `S3Service` 가 전역/공유 모듈이 아니라 `common/services` 의 stateless 클래스라, 소비 모듈(`UsersModule`, `KnowledgeBaseModule`)마다 별도의 `S3Client` 인스턴스가 생성된다. 이 PR 이 새로 만든 패턴이 아니라 기존 컨벤션을 그대로 재사용한 것이며 순환 의존성은 없다(`common/services` → 각 feature module 단일 방향). 8라운드 누적 리뷰에서 이미 반복 확인된 지점.
  - 제안: 지금 조치 불필요. 3번째 소비 모듈이 생기는 시점에 `S3Service` 전역 승격(커넥션 풀 공유)을 검토.

- **[INFO]** docker-compose/k8s 변경은 env var 전파일 뿐, 새 서비스·이미지·패키지 도입 없음
  - 위치: `docker-compose.yml`, `docker-compose.e2e.yml`, `k8s/base/configmap.yaml`, `k8s/overlays/{local,prod,staging}/*.yaml`
  - 상세: 신규 `S3_PUBLIC_BASE_URL` env 를 기존 MinIO/S3 서비스 정의에 추가하고, MinIO 버킷 정책 파일(`scripts/minio/avatars-public-read.json`)을 volume mount 하는 것뿐이다. 새 컨테이너 이미지·새 외부 서비스·새 포트가 추가되지 않았다. CHANGELOG 가 이 변수 하나가 k8s overlay 전파를 빠뜨릴 뻔한 근접사고를 명시하고 있고, 실제로 이 diff 는 `local`/`prod`/`staging` 세 overlay 전부에 값을 채워 그 배포 표면 갭을 닫았다(운영 판단 사항이라 배포 관점은 인프라/보안 리뷰 영역 — 여기서는 "새 의존성 도입 없음"만 확인).
  - 제안: 조치 불필요.

## 그 외 점검 결과 (문제 없음)

- **버전 고정**: `package.json` 자체 diff 없음. 기존 `^` 캐럿 버전 표기 컨벤션과 `pnpm-lock.yaml` 이 그대로 유지 — 이번 PR 로 인한 변화 없음.
- **라이선스**: 신규 의존성이 없으므로 검토 대상 없음. 재사용된 기존 패키지(`@aws-sdk/client-s3`=Apache-2.0, `@nestjs/*`=MIT, `express`=MIT, `multer`=MIT)는 이전부터 이미 사용 중이던 permissive 라이선스.
- **취약점**: 신규 패키지 없음. `FileInterceptor` 가 내부적으로 쓰는 `multer` 는 `@nestjs/platform-express` 의 기존 전이 의존성이며 이번 diff 가 새로 고정한 버전이 아니다.
- **불필요한 의존성**: UUID(`node:crypto` stdlib), MIME 판정(손으로 만든 확장자→MIME 매핑), SSRF 판정(기존 내부 유틸 `isPrivateHost`) 모두 신규 패키지 대신 stdlib/기존 자산을 재사용 — 새로 도입할 만한 표준 라이브러리 대체 지점 없음.
- **의존성 크기**: 번들/빌드 시간에 영향 있는 신규 패키지 없음.
- **호환성**: 신규 패키지가 없어 기존 의존성과의 버전 충돌 가능성 자체가 없음.
- **내부 의존성**: `UsersModule → S3Service`(local provider), `main.ts → s3.config.ts` (resolvePublicBaseUrl/shouldWarnPublicBaseIsPrivate 순수 함수 재사용) 모두 단방향이고 순환 없음. `s3.config.ts` 를 SoT 로 두고 `main.ts`·`s3.service.ts` 양쪽이 그 판정을 그대로 소비하는 구조는 6라운드 리뷰에서 인라인 중복 판정의 결함(뮤테이션 85건 GREEN 생존)을 반증한 뒤 나온 결과다.

## 요약

이번 라운드(9R)의 변경분은 `test(users): 리뷰 8R` 커밋 하나로, JSDoc 주석(로그인 잠금 시계 비대칭 disclose)과 신규 테스트 추가가 전부이며 `package.json`/`pnpm-lock.yaml` 은 물론 어떤 의존성 관련 파일도 건드리지 않는다. `git diff origin/main...HEAD --stat` (160개 파일 전체)와 lockfile 대상 좁힌 diff 양쪽을 직접 실행해 빈 결과를 확인했고, 신규 코드가 쓰는 패키지(`@aws-sdk/client-s3`, `@nestjs/platform-express`, `@nestjs/swagger` 등)는 모두 이 브랜치 이전부터 설치돼 있던 것들이다. UUID·MIME·SSRF 판정 모두 신규 패키지 대신 stdlib 또는 기존 내부 유틸을 재사용해 "불필요한 의존성 회피" 관점에서 모범적이다. 유일한 내부 의존 구조 이슈(`S3Service` 를 소비 모듈마다 지역 provider 로 중복 등록)는 기존 `KnowledgeBaseModule` 패턴을 그대로 따른 것으로 이번 PR 이 새로 만든 리스크가 아니며, 8라운드에 걸쳐 반복 확인된 저위험 INFO 다. 버전 고정·라이선스·취약점·번들 크기·호환성 항목 모두 이번 diff 로 인한 새 위험이 없다.

## 위험도

NONE
