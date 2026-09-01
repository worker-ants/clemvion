# 의존성(Dependency) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 조사 방법

`origin/main...HEAD` 기준 26개 변경 파일(`git diff --stat`) 전수와 `codebase/backend/package.json`,
`pnpm-lock.yaml`, `node_modules/@nestjs/platform-express/package.json` 을 대조했다. `pnpm audit --prod`
(backend) 를 1회 실행했다(결과: `No known vulnerabilities found`). 저장소 파일은 쓰지 않았다(읽기 전용
조사).

## 발견사항

- **[INFO]** 이 PR 은 **신규 외부 패키지를 추가하지 않는다**
  - 위치: 저장소 루트(`git diff --stat origin/main...HEAD`) — `package.json`/`pnpm-lock.yaml` 이 변경
    파일 26개 목록에 없음(직접 확인: `codebase/backend/package.json`, 루트 `pnpm-lock.yaml` 모두 diff 0줄)
  - 상세: `POST /api/users/me/avatar` 는 기존 의존성만으로 구현됐다 — `@aws-sdk/client-s3`(기존
    `S3Service` 확장), `@nestjs/platform-express` 의 `FileInterceptor`/`@UploadedFile`(이미
    `knowledge-base.controller.ts` 가 같은 API 를 쓰고 있어 런타임 경로가 이미 검증돼 있음),
    `@types/multer`(기존 devDependency `^2.2.0`), `node:crypto` 의 `randomUUID`(표준 라이브러리 —
    별도 uuid 패키지를 새로 끌어오지 않음). Content-Type 판정도 별도 mime 감지 라이브러리 없이
    확장자 화이트리스트(`AVATAR_CONTENT_TYPES`)로 직접 구현했다.
  - 제안: 없음 — 긍정적 관찰(항목 1·5·6 모두 무영향).

- **[INFO]** `multer` 런타임 버전은 워크스페이스 `overrides` 로 이미 고정돼 있고, 이 PR 은 그 값을
  바꾸지 않는다
  - 위치: `pnpm-lock.yaml:21` (`overrides: multer: ^2.2.0`) — PR 변경분 아님, 확인용 참조
  - 상세: `@nestjs/platform-express@11.1.27` 은 자신의 `package.json` 에 `multer: 2.1.1` 을 직접
    의존성으로 선언하지만(`node_modules/@nestjs/platform-express/package.json`), 루트
    `pnpm-lock.yaml` 의 workspace `overrides` 가 `multer: ^2.2.0` 으로 강제해 실제 설치본은
    `multer@2.2.0` 하나로 수렴한다(`pnpm-lock.yaml:8269,12276,19848`). `@types/multer@^2.2.0` 과도
    버전이 맞는다. `pnpm audit --prod` 는 무취약점을 보고했다. 이 override 자체는 이 PR 이전부터
    존재했고 이번 diff 에 포함되지 않았다 — 즉 이 기능이 처음으로 "고정된 안전한 버전" 을 도입한
    것이 아니라 기존 고정을 그대로 물려받는다.
  - 제안: 없음 — override 가 이미 방어하고 있음을 기록으로만 남김.

- **[INFO]** 내부 의존성 — `UsersModule` 이 `S3Service` 를 로컬 provider 로 추가하는 것은 기존
  `KnowledgeBaseModule` 패턴을 그대로 따른다
  - 위치: `codebase/backend/src/modules/users/users.module.ts:8,24` (신규 import + providers 배열
    등재) — 대조: `codebase/backend/src/modules/knowledge-base/knowledge-base.module.ts:21,66` (기존)
  - 상세: `S3Service` 를 공유 모듈로 export 하는 대신 두 모듈이 각각 로컬 provider 로 선언해, 앱
    전체에서 `S3Client`(및 그 내부 커넥션 리소스) 인스턴스가 이제 2개가 된다. `S3Service` 는
    stateless 이고 코드 자체 주석("KB 모듈과 같은 방식으로 지역 provider 로 둔다")도 이 선택을
    의식하고 있어 기능적 결함은 아니다. `plan/in-progress/spec-sync-user-profile-gaps.md` 도
    "아바타 외에 S3 를 쓰는 사용자-스코프 리소스가 하나 더 생길 때" 를 공유 모듈화 재개 신호로
    명시해 뒀다.
  - 제안: 조치 불필요 — 세 번째 소비자가 생기면 그때 `common` 공유 모듈로 승격을 검토할 근거가
    이미 plan 에 있다.

- **[INFO]** `isPrivateHost` 재사용 — SSRF 판정 로직을 새로 만들지 않고 기존 정본 유틸을 그대로 썼다
  - 위치: `codebase/backend/src/main.ts` (신규 `import { isPrivateHost } from './common/utils/ssrf.util'`,
    프로덕션 `S3_PUBLIC_BASE_URL` 사설/loopback 경고 분기)
  - 상세: 새 코드 주석이 직접 명시하듯("판정은 손으로 짜지 않고 정본 `isPrivateHost` 를 쓴다") 아바타
    공개 base URL 이 사설 주소를 가리키는지 검사할 때, RFC1918·link-local·ULA·IPv4-mapped IPv6 판정을
    다시 구현하지 않고 기존 SSRF 가드 모듈에 의존했다. 내부 의존성 재사용의 바람직한 예.
  - 제안: 없음.

## 참고 — 리뷰 도중 관측한 일시적 워킹트리 상태(무해)

조사 초반 `git status --short` 1회 실행에서 `codebase/backend/src/modules/users/users.service.ts` 가
` M`(unstaged modified)로 표시됐다. 바로 다음 `git diff`/`git status` 재확인에서는 clean 이었다
(`nothing to commit, working tree clean`). 병렬 fan-out 중인 다른 reviewer 가 같은 파일을 뮤테이션했다가
직접 원복한 것으로 보인다 — 본 리뷰는 그 파일을 건드리지 않았고, 종료 시점 `git status --short` 는
review 산출물 디렉터리(`review/code/2026/08/31/**`)만 untracked 로 표시해 정상이다. 의존성 결함은
아니지만 관측 의무에 따라 기록한다.

## 요약

이 PR 은 의존성 관점에서 사실상 무결점이다 — `package.json`/`pnpm-lock.yaml` 변경이 전혀 없고, 신규
런타임 기능(파일 업로드·공개 URL 조립·SSRF 사설 주소 경고)을 전부 이미 검증된 기존 의존성
(`@aws-sdk/client-s3`, `@nestjs/platform-express`+`multer`, `node:crypto`, 내부 `ssrf.util`)으로
구현했다. `multer` 실행 버전은 워크스페이스 override 로 이미 `2.2.0` 에 고정돼 있고 `pnpm audit`
결과도 깨끗하다. 유일하게 짚을 만한 것은 `S3Service` 가 `UsersModule`·`KnowledgeBaseModule` 양쪽에
로컬 provider 로 중복 등재돼 인스턴스가 두 개가 된다는 내부 의존성 구조인데, 이는 이 PR 이 만든
패턴이 아니라 기존 관행을 그대로 따른 것이고 plan 문서에 재개 신호까지 적혀 있어 지금 조치가
필요하지 않다.

## 위험도

NONE
