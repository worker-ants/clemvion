# 의존성(Dependency) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 조사 방법

`git diff origin/main...HEAD --stat` 로 변경 파일 전수를 확인하고, `codebase/backend/package.json`·
`pnpm-lock.yaml` 이 이번 diff 에 포함되는지 직접 `git diff`(0줄) 로 재확인했다. `S3Service`·
`UsersController`·`UsersService`·`s3.config.ts`·`main.ts` 의 `import` 문을 전수 grep 해 신규 외부
패키지 사용 여부를 대조했다. `pnpm-lock.yaml` 에서 `multer` override/resolution 을 직접 열어 버전
고정 상태를 확인했다. 저장소 파일은 쓰지 않았다(읽기 전용 조사, `git status --short` 로 세션 종료
시점 clean 확인).

## 발견사항

- **[INFO]** 이 PR 은 신규 외부 패키지를 추가하지 않는다
  - 위치: 저장소 루트 — `git diff origin/main...HEAD --stat -- codebase/backend/package.json
    pnpm-lock.yaml` 결과 0줄
  - 상세: `POST /api/users/me/avatar` 구현에 쓰인 모든 심볼이 기존 의존성이다.
    `S3Service`(`codebase/backend/src/common/services/s3.service.ts:1-10`)는 기존
    `@aws-sdk/client-s3`(`^3.1097.0`)만 import 하고 새 하위 패키지(예: presigned URL 용
    `@aws-sdk/s3-request-presigner`)는 추가하지 않았다 — 공개 URL 전략이므로 필요도 없다.
    `UsersController`(`codebase/backend/src/modules/users/users.controller.ts:18`)는 기존
    `@nestjs/platform-express` 의 `FileInterceptor`를 쓰는데, 같은 API 를
    `knowledge-base.controller.ts` 가 이미 쓰고 있어 런타임 경로가 사전 검증돼 있다. 확장자→UUID
    파일명 생성은 `node:crypto` 의 `randomUUID`(stdlib)를 썼고, `package.json:91` 에 이미 있는
    `uuid@^14.0.1` 패키지도 새로 끌어오지 않았다. Content-Type 판정은 별도 mime-detection
    라이브러리 없이 `UsersService.AVATAR_CONTENT_TYPES` 확장자 화이트리스트로 직접 구현했다.
  - 제안: 없음 — 항목 1(새 의존성)·5(불필요한 의존성)·6(크기) 모두 무영향.

- **[INFO]** `multer` 런타임 버전은 워크스페이스 `overrides` 로 이미 고정돼 있고, 이 PR 은 그 고정을
  바꾸지 않는다
  - 위치: `pnpm-lock.yaml:21`(`overrides: multer: ^2.2.0`), 해석 결과
    `pnpm-lock.yaml:8269,19848`(`multer@2.2.0`) — PR 변경분 아님, 참조 확인용
  - 상세: `@nestjs/platform-express` 는 자신의 `package.json` 에 `multer: 2.1.1` 을 직접 의존성으로
    선언하지만, 루트 workspace override 가 `multer: ^2.2.0` 으로 강제해 실제 설치본은
    `multer@2.2.0` 하나로 수렴한다. `@types/multer@^2.2.0`(`codebase/backend/package.json:105`)과도
    버전이 맞는다. 이 override 자체는 이 PR 이전부터 존재했고 이번 diff 에 포함되지 않았다.
  - 제안: 없음 — override 가 이미 방어하고 있음을 기록으로만 남김.

- **[INFO]** `import ExpressNS from 'express'` 개명은 새 의존성이 아니라 기존 직접 의존성의 import
  네임스페이스 충돌 회피다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:57`(`import ExpressNS from
    'express'`), `:193`(`Express.Multer.File`), `:217-218,304-305`(`ExpressNS.Request/Response`)
  - 상세: `express` 는 `codebase/backend/package.json:69` 에 `^5.2.1` 로 이미 직접 의존성이며, 같은
    `import Foo from 'express'` 패턴이 `auth.controller.ts`·`sessions.controller.ts`·
    `webauthn.controller.ts` 등 다른 모듈에서도 쓰인다. 이번 변경은 그 이름을 `Express` →
    `ExpressNS` 로 바꿔, `@types/multer` 가 전역에 augment 하는 `Express.Multer.File` 네임스페이스가
    로컬 `import Express` 바인딩에 가려지는 문제를 해결한 것뿐이다 — 패키지 추가·버전 변경 없음.
  - 제안: 없음.

- **[INFO]** 내부 의존성 — `UsersModule` 이 `S3Service` 를 로컬 provider 로 추가하는 것은 기존
  `KnowledgeBaseModule` 패턴을 그대로 따른다
  - 위치: `codebase/backend/src/modules/users/users.module.ts:8`(신규 import),
    `:24`(`providers: [UsersService, S3Service]`) — 대조:
    `codebase/backend/src/modules/knowledge-base/knowledge-base.module.ts` (기존, 동일 패턴)
  - 상세: `S3Service` 를 공유 모듈로 export 하는 대신 두 모듈이 각각 로컬 provider 로 선언해, 앱
    전체에서 `S3Client`(및 그 내부 커넥션 리소스) 인스턴스가 2개가 된다. `S3Service` 는 stateless
    이고 코드 자체 주석("KB 모듈과 같은 방식으로 지역 provider 로 둔다")도 이 선택을 의식하고
    있어 기능적 결함은 아니다. `plan/in-progress/spec-sync-user-profile-gaps.md` 도 "아바타 외에
    S3 를 쓰는 사용자-스코프 리소스가 하나 더 생길 때"를 공유 모듈화 재개 신호로 명시해 뒀다.
  - 제안: 조치 불필요 — 세 번째 소비자가 생기면 그때 `common` 공유 모듈로 승격을 검토할 근거가
    이미 plan 에 있다.

- **[INFO]** `isPrivateHost` 재사용 — SSRF 판정 로직을 새로 만들지 않고 기존 정본 유틸을 그대로
  가져다 썼다
  - 위치: `codebase/backend/src/main.ts:52`(`import { isPrivateHost } from
    './common/utils/ssrf.util'`), `:167`(사용처)
  - 상세: production 부팅 시 `S3_PUBLIC_BASE_URL` 이 사설/loopback 주소인지 판정할 때 RFC1918·
    link-local·ULA·IPv4-mapped IPv6 판정을 다시 구현하지 않고 기존 SSRF 가드 모듈에 의존했다.
    내부 의존성 재사용의 바람직한 예이며 로직 중복(=드리프트 위험) 없음.
  - 제안: 없음.

## 요약

이 PR 은 의존성 관점에서 사실상 무결점이다 — `package.json`/`pnpm-lock.yaml` 변경이 전혀 없고, 신규
런타임 기능(파일 업로드·공개 URL 조립·SSRF 사설 주소 경고)을 전부 이미 검증된 기존 의존성
(`@aws-sdk/client-s3`, `@nestjs/platform-express`+`multer`, `node:crypto`, 내부 `ssrf.util`)으로
구현했다. `multer` 실행 버전은 워크스페이스 override 로 이미 `2.2.0` 에 고정돼 있어 이번 변경으로
새로 도입된 취약점 표면이 없다. `import ExpressNS from 'express'` 개명은 패키지가 아니라 타입
네임스페이스 충돌 회피이므로 의존성 항목이 아니다. 유일하게 짚을 만한 것은 `S3Service` 가
`UsersModule`·`KnowledgeBaseModule` 양쪽에 로컬 provider 로 중복 등재돼 인스턴스가 두 개가 된다는
내부 의존성 구조인데, 이는 이 PR 이 만든 패턴이 아니라 기존 관행을 그대로 따른 것이고 plan 문서에
재개 신호(3번째 소비자 등장 시 공유 모듈화)까지 적혀 있어 지금 조치가 필요하지 않다. 라이선스·
취약점·번들 크기·버전 충돌 항목 모두 이번 diff 로 인한 새 위험이 없다.

## 위험도

NONE
