# 의존성(Dependency) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 기존 의존성만 재사용
  - 위치: `codebase/backend/package.json` (본 diff 에 파일 변경 없음), `codebase/backend/src/modules/users/users.controller.ts:18` (`import { FileInterceptor } from '@nestjs/platform-express';`), `codebase/backend/src/modules/users/users.service.ts:1` (`import { randomUUID } from 'node:crypto';`)
  - 상세: `git diff <merge-base>..HEAD -- '**/package.json' '**/pnpm-lock.yaml'` 실측 결과 두 파일 모두 diff 가 **비어 있다** — 이번 PR 은 신규 패키지를 하나도 추가하지 않았다. 파일 업로드에 쓰인 `FileInterceptor`(`@nestjs/platform-express`)와 `@types/multer` 가 augment 하는 `Express.Multer.File` 타입은 이미 `codebase/backend/package.json` 에 `@nestjs/platform-express: ^11.0.1`, `@types/multer: ^2.2.0` 로 존재하는 기존 의존성이다. UUID 생성도 이미 설치된 `uuid`(`^14.0.1`) npm 패키지 대신 Node 표준 라이브러리 `node:crypto`의 `randomUUID()`를 선택했다 — 새 의존성을 피하고 표준 라이브러리로 대체한 바람직한 선택이다.
  - 제안: 없음 (모범 사례로 기록)

- **[INFO]** 내부 모듈 의존성 추가 — 기존 패턴을 따름 (KB 모듈과 동형)
  - 위치: `codebase/backend/src/modules/users/users.module.ts:8,24` (`import { S3Service } from '../../common/services/s3.service';` / `providers: [UsersService, S3Service]`)
  - 상세: `UsersModule` 이 `common/services/s3.service.ts` 를 지역(local) provider 로 새로 의존한다. `grep -rn "S3Service" codebase/backend/src --include="*.module.ts"` 로 확인한 결과 `knowledge-base.module.ts` 가 이미 동일한 방식(공유 모듈로 export 하지 않고 각 모듈이 지역 provider 로 재선언)으로 `S3Service` 를 사용 중이다. `S3Service` 는 `ConfigService` 만 주입받는 stateless 클래스라 순환 의존이나 시크릿 중복 노출 위험은 없다. 다만 이 패턴이 반복되면(현재 2개 모듈) 모듈마다 별도 인스턴스가 생성되고 `common` 하위에 전용 `S3Module`(shared, `exports: [S3Service]`)이 없다는 점은 구조적 부채로 커질 수 있다.
  - 제안: 즉시 조치 불요. 세 번째 모듈이 `S3Service` 를 필요로 하는 시점에는 `S3Module` 로 승격해 provider 목록 중복을 없애는 것을 고려.

- **[INFO]** 버전 고정(pinning) — 기존 관례를 그대로 따름, 새 리스크 없음
  - 위치: `codebase/backend/package.json:30,40,91,105,115` (`@aws-sdk/client-s3`, `@nestjs/platform-express`, `uuid`, `@types/multer`, `@types/uuid` — 모두 caret(`^`) 범위, 기존 값 그대로)
  - 상세: 이번 PR 이 의존성 버전을 손대지 않았으므로 pinning 정책의 변화도 없다. 참고로 인프라 이미지(`minio/minio:RELEASE.2025-04-22T22-12-26Z`, `minio/mc:RELEASE.2025-04-16T18-13-26Z`)는 `docker-compose.yml`/`docker-compose.e2e.yml` 양쪽에서 이미 정확한 RELEASE 태그로 고정돼 있고 이번 PR 은 이 파일들에서 `S3_PUBLIC_BASE_URL` 환경변수만 추가했을 뿐 이미지 버전은 건드리지 않았다.
  - 제안: 없음

- **[INFO]** 라이선스 — 신규 의존성이 없으므로 신규 라이선스 리스크 없음
  - 상세: 새로 추가된 npm 패키지가 없어 라이선스 호환성 검토 대상이 없다.
  - 제안: 없음

- **[INFO]** 취약점 — 신규/기존 의존성 버전 변경 없음
  - 상세: `@aws-sdk/client-s3`(`^3.1097.0`) 등 기존 사용 패키지의 버전이 바뀌지 않았으므로 이 PR 자체가 새로운 CVE 노출 표면을 만들지 않는다. (참고: AWS SDK v3 계열은 활발히 유지보수되며 이번 diff 에서 버전 변경이 없으므로 이 리뷰 범위에서 확인할 신규 취약점은 없음.)
  - 제안: 없음 (정기 `pnpm audit`/dependabot 은 별개 트랙)

- **[INFO]** 불필요한 의존성 — 해당 없음, 오히려 표준 라이브러리를 선택한 사례
  - 상세: 위 `randomUUID`(node:crypto) 사례가 "표준 라이브러리로 대체 가능한지" 관점에서 이미 올바르게 처리됨. 추가로 `Content-Type` 판정을 `mime-types` 류의 별도 npm 패키지 없이 `AVATAR_CONTENT_TYPES` 자체 화이트리스트 맵(`users.service.ts`)으로 처리해 신규 의존성을 만들지 않았다.
  - 제안: 없음

- **[INFO]** 의존성 크기 — 번들/빌드 영향 없음
  - 상세: `node_modules` 설치 대상 변화가 없어 backend 빌드 시간·Docker 이미지 크기(`codebase/backend/Dockerfile`)·프론트엔드 번들 크기 어느 쪽도 이번 PR 로 인한 증가가 없다.
  - 제안: 없음

- **[INFO]** 호환성 — 기존 의존성 간 충돌 없음, 단 `Express` 네임스페이스 shadowing 우회는 기존 코드 위험을 드러낸 부수 수정
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:57` (`import ExpressNS from 'express';`, 종전 `import Express from 'express';`)
  - 상세: `@types/multer` 가 전역 `Express` 네임스페이스에 `Express.Multer.File` 을 augment 하는데, 기존 코드가 `import Express from 'express'` 로 그 전역 이름을 지역 스코프에서 가려서(`Namespace 'e' has no exported member 'Multer'`) 실제로 컴파일 에러가 났음이 CHANGELOG.md 에 기록돼 있다. 이는 `@types/multer`(의존성)와 `express`(의존성) 두 타입 선언 간의 이름 충돌이 기존 코드에 잠재해 있었고 이번 PR 이 처음 그 지점을 밟은 것 — 새로 만든 비호환이 아니라 기존 임포트 관례의 결함을 드러낸 것이다. `import ExpressNS from 'express'` 로 개명해 해소했고 4개 사용처(`ExpressNS.Request`/`ExpressNS.Response`) 동반 수정을 확인했다.
  - 제안: 없음 — 수정이 적절함. 다만 컨트롤러 파일 전체에서 `Express` 를 다시 default-import 하는 코드가 재도입되지 않도록 lint 규칙(예: `no-restricted-imports`)을 고려할 여지는 있으나 이는 이번 PR 의 필수 범위는 아님.

- **[INFO]** 환경변수 신규 도입은 "의존성"이 아니라 "배포 선행조건" — 참고로만 기록 (타 리뷰어 영역과 중첩)
  - 위치: `codebase/backend/src/common/config/s3.config.ts:19-22` (`publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || process.env.S3_ENDPOINT || 'http://localhost:9000'`)
  - 상세: 이 항목은 패키지 의존성이 아니라 인프라(버킷 정책·env) 의존성이라 본 리뷰(dependency) 관점보다는 설정/보안 리뷰 영역에 더 가깝다. 다만 "새 의존성 도입 시 문서화 여부" 관점에서, `.env.example`·`README.md`·`k8s/README.md`·`docker-compose*.yml`·`k8s/base/configmap.yaml`·`k8s/overlays/local/configmap-patch.yaml` 전 배치 표면에 `S3_PUBLIC_BASE_URL` 이 일관되게 반영돼 있음을 확인했다 — 신규 필수 설정치고는 전파가 누락 없이 완결됐다.
  - 제안: 없음 (정보 제공용)

## 요약
이번 PR(아바타 이미지 업로드, 공개 버킷+공개 URL)은 `codebase/backend/package.json`/`pnpm-lock.yaml` 어느 쪽도 건드리지 않아 **신규 외부 패키지 추가가 전혀 없다** — `git diff <merge-base>..HEAD -- '**/package.json' '**/pnpm-lock.yaml'` 로 실측 확인. 파일 업로드에 필요한 `FileInterceptor`(`@nestjs/platform-express`)·`Express.Multer.File`(`@types/multer`)은 이미 설치돼 있던 의존성이며, UUID 생성은 기존에 설치된 `uuid` npm 패키지 대신 Node 표준 `node:crypto.randomUUID()`를 선택해 오히려 의존성 표면을 늘리지 않았다. 유일한 신규 "의존"은 내부 모듈 의존(`UsersModule` → `common/services/s3.service.ts`)인데, 이는 `knowledge-base.module.ts` 가 이미 쓰던 지역 provider 패턴과 동형이라 새로운 아키텍처 리스크가 아니다. `Express` 네임스페이스 shadowing 해소(`Express`→`ExpressNS` 개명)는 `express`/`@types/multer` 두 기존 의존성 간의 잠재 타입 충돌을 드러내고 고친 정당한 부수 수정이다. 라이선스·취약점·버전 고정·번들 크기 항목은 신규 패키지가 없으므로 이번 diff 범위에서는 리스크가 없다.

## 위험도
NONE
