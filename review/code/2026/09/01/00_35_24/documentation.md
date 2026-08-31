# 문서화(Documentation) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 개요

이 PR 은 feat 커밋 1개 + 리뷰 대응 fix/test 커밋 5개(누적 `origin/main..HEAD`)로 구성돼 있고,
이번 라운드(6번째)는 그 최종 상태를 대상으로 한다. CHANGELOG·README·`.env.example`·
`k8s/README.md`·`k8s/base/configmap.yaml`·`k8s/overlays/{local,prod,staging}`·
`docker-compose.yml`·`docker-compose.e2e.yml`·신규 `scripts/minio/README.md`·
`s3.config.ts`/`s3.config.spec.ts`·`s3.service.ts`/`s3.service.spec.ts`·
`users.controller.ts`·`users.service.ts`·`main.ts`·`users-avatar-upload.e2e-spec.ts`·
plan 문서 2건을 `Read`/`git show`/`git log -S` 로 실제 소스와 대조했다.

이전 5라운드 문서화 리뷰가 지적한 항목(부팅 가드 CHANGELOG 누락, plan 의 회귀 테스트
건수 stale, `?? endpoint` 이중 폴백과 "SoT 한 곳" 주석의 불일치 등)은 이번 라운드
시점에는 전부 해소돼 있음을 확인했다. 다만 그 해소 과정에서 **직전 라운드(리뷰
5R, 커밋 `ecaa785bd`)가 새로 만든 주석 중복**을 하나 발견했다 — 아래 WARNING.

## 발견사항

- **[WARNING]** `users.controller.ts` — `ExpressNS` 리네임 사유를 설명하는 주석이
  **거의 동일한 내용으로 두 번 반복**된다 (직전 라운드가 새로 만든 중복)
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:53-61`
    (`import ExpressNS from 'express';` 바로 위 주석 블록)
  - 상세: 현재 파일은 이 import 위에 9줄짜리 주석이 있는데, 앞 4줄(53-56)과 뒤 5줄(57-61)이
    "`Express` 로 default import 하면 전역 `Express` 네임스페이스를 가려서 `@types/multer`
    의 `Express.Multer.File` 을 쓸 수 없다(실측: `Namespace 'e' has no exported member
    'Multer'`)" 라는 **같은 근거를 거의 그대로 두 번** 서술한다. `git log -S`로 추적한 결과:
    앞 문단(53-56)은 원판 feat 커밋(`d51954999`)에서부터 있었고, 뒤 문단(57-61)은 가장 최근
    커밋(`ecaa785bd`, "리뷰 5R")이 **그 문단을 지우거나 고치지 않고 바로 아래에 새로 추가**한
    것이다(`git show ecaa785bd -- .../users.controller.ts` 에서 순수 5줄 추가만 확인됨).
    이 추가는 직전 라운드(`review/code/2026/09/01/00_11_39/maintainability.md`)의
    WARNING("`ExpressNS` 가 코드베이스 전역 `Express` 별칭 컨벤션과 다르고, 이 리네임
    범위·근거가 `spec/conventions/` 나 주석에 명시돼 있지 않다")에 대응하려던 것으로 보이는데,
    실제로 필요했던 추가 정보는 뒤 문단의 마지막 문장뿐이다 — "다른 컨트롤러 4곳은 Multer
    타입을 쓰지 않아 `Express` 그대로다 — 전역 컨벤션으로 승격하려면 `spec/conventions/`
    문서화가 선행돼야 한다." 나머지 앞 4줄과 겹치는 부분은 순수 중복이다. 이 중복은 (1) 다음
    유지보수자가 같은 근거를 두 번 읽게 만들고, (2) 두 문단 중 하나만 고쳐지면 서로 다른
    설명이 나란히 남는 drift 위험을 새로 만든다(이 PR 자체가 "폴백 규칙이 두 곳에 있으면
    갈린다"·"stale 주석이 결함을 감춘다"를 반복해서 경계해 온 것과 같은 클래스의 문제다).
  - 제안: 두 문단을 하나로 합친다 — 기존 앞 문단(53-56)의 근거 설명은 그대로 두고, 뒤 문단의
    새 정보("다른 컨트롤러 4곳은 `Express` 그대로다 — 전역 컨벤션 승격 전 `spec/conventions/`
    문서화 선행 필요")만 그 문단 끝에 한 문장으로 붙인 뒤 나머지 중복 문장(57-60)은 삭제한다.

- **[INFO]** `S3Service.getPublicUrl` JSDoc 에 `@returns` 설명이 여전히 없음 (3·5라운드
  INFO 로 이미 지적, 우선순위 낮음으로 미조치 — 이번 라운드도 동일 상태 재확인)
  - 위치: `codebase/backend/src/common/services/s3.service.ts:69-86` (JSDoc 블록, `:84`
    `@param key` 다음)
  - 상세: 같은 파일 `deleteMany` 는 반환 형태를 문서화하지만 `getPublicUrl` 은 `@param` 만
    있다. 팀이 두 라운드 연속으로 "선택 사항"으로 유예한 항목이라 새 결함은 아니다.
  - 제안: `@returns 공개 GET URL (base/bucket/encoded-key)` 한 줄 추가 — 여전히 선택 사항.

- **[INFO]** `AVATAR_MAX_BYTES` JSDoc("컨트롤러의 multer 한도와 **같은 값이어야** 한다")이
  실제로는 리터럴 동기화가 아니라 **직접 참조**라는 사실과 표현이 여전히 어긋난다 (3·5라운드
  INFO 로 이미 지적, 미조치 — 재확인만)
  - 위치: `codebase/backend/src/modules/users/users.service.ts:51`
    vs `codebase/backend/src/modules/users/users.controller.ts` 의
    `limits: { fileSize: UsersService.AVATAR_MAX_BYTES }` 옆 주석("상수를 직접 참조하므로
    서비스와 갈릴 수 없다")
  - 상세: 컨트롤러 쪽 주석은 "직접 참조라 갈릴 수 없다"고 정확히 서술하는데, 서비스 쪽
    JSDoc은 "같은 값이어야 한다"(마치 손으로 동기화해야 하는 두 상수처럼 읽힘)로 남아
    있다. 실제 드리프트 위험은 코드가 이미 참조로 막고 있어 낮다.
  - 제안: 선택 사항. `AVATAR_MAX_BYTES` JSDoc을 "컨트롤러의 multer `limits.fileSize` 가
    이 값을 직접 참조한다(리터럴 중복 아님)"로 맞추면 일관성이 좋아진다.

## 검증한 항목 (문제 없음 확인)

- **CHANGELOG**: 신규 `## Unreleased — 아바타 이미지 업로드` 항목이 공개 버킷 결정·세 축의
  방어(키 UUID·Content-Type 확장자 파생·저장 후 삭제)·부팅 가드·`mc anonymous set download`
  기각 실측·spec 배지 flip 위임까지 근거와 함께 상세히 서술한다. 코드(현재 `updateAvatar` 가
  `userRepository.update(userId, { avatarUrl })` 컬럼 단위 갱신을 쓰는 것, `deletePreviousAvatarObject`
  가 `avatars/{userId}/` 앵커로 키를 복원하는 것 등)와 대조해 전부 일치한다.
- **README.md / `.env.example` / k8s 3-overlay 전부(`base`·`local`·`prod`·`staging`) /
  `docker-compose.yml`·`docker-compose.e2e.yml`**: `S3_PUBLIC_BASE_URL` 이 빠짐없이
  등재돼 있고, "브라우저가 도달하는 주소" vs `S3_ENDPOINT`(내부 주소)의 구분·폴백 규칙·
  버킷 정책 배포 선행 조건이 모든 위치에서 일관되게 서술된다. k8s 오버레이 3곳(`local`·
  `prod`·`staging`) 모두 값을 덮어 CHANGELOG 가 경고한 "overlay 전파 누락" 근접사고
  클래스가 재발하지 않게 막혀 있다.
- **`scripts/minio/README.md`(신규)**: `mc anonymous set download` 가 `s3:ListBucket` 을
  함께 여는 것을 실측 로그(정책 JSON·`curl` 응답)와 함께 반증하고, 명시 정책으로 바꾼 뒤
  목록 403·GET 200 을 재실측했다 — 근거 기반 문서의 좋은 예다. `scripts/minio/avatars-public-read.json`
  의 버킷명(`workflow-storage`)도 `docker-compose*.yml`/`.env.example` 의 `S3_BUCKET` 과 일치.
- **`main.ts` 부팅 가드**: 주석의 "`isPrivateHost` 는 loopback·RFC1918·link-local·ULA·
  IPv4-mapped IPv6 를 다루고 DNS 이름(`minio` 등)엔 `false` 를 돌려준다"는 서술을
  `common/utils/ssrf.util.ts` 실제 구현(동기 `isPrivateHost`)과 대조 — 정확하다. DNS 이름은
  IPv4 정규식에 매칭되지 않고 `::`/`localhost` 분기도 타지 않아 실제로 `false` 를 반환한다.
- **`s3.config.ts`/`s3.service.ts` 폴백 이중화 주석**: "`?? endpoint` 는 SoT 사본이 아니라
  설정 모듈 미로드 조립을 위한 2차 방어" 설명이 실제 코드(`resolvePublicBaseUrl` 이 항상
  truthy 문자열을 반환하므로 이 분기가 정상 부트 경로에서 도달 불가능)와 일치하고, "초판
  주석은 여기 폴백이 한 곳이라 단언했는데 바로 이 줄이 다시 폴백하고 있었다" 는 자기 정정
  이력까지 코드에 남아 있다 — 과거 라운드가 지적한 코드-주석 drift 는 해소된 상태.
  `s3.config.spec.ts`/`s3.service.spec.ts` 가 이 규칙과 이중 폴백 분기 양쪽을 각각 테스트로
  고정한다.
- **plan 문서의 수치 stale 재발 방지**: `plan/in-progress/spec-sync-user-profile-gaps.md:41-44`,
  `plan/in-progress/spec-update-avatar-upload-implemented.md:92-94` 모두 회귀 테스트
  "건수"를 더 이상 하드코딩하지 않고 "필요하면 `jest --silent <file>` 로 센다"로 바꿔,
  직전 라운드(00:11:39)가 지적한 "30건→실측 35건" stale 재발 클래스를 근본적으로 차단했다.
- **`users-avatar-upload.e2e-spec.ts`(신규)**: 파일 최상단 docstring이 "이 스펙만 증명할 수
  있는 것"(유닛이 `S3Service` 를 mock 해 버킷 정책 자체를 못 본다는 점)과 "왜 응답의
  `avatarUrl` 을 그대로 fetch 하지 않는가"(컨테이너 망 주소와 브라우저 도달 주소가 다르다는
  점)를 근거와 함께 명확히 설명하고, 각 `it` 의 인라인 주석도 검증 대상과 실패 시 증상을
  구체적으로 남긴다.
- **plan 문서의 spec 위임 근거**: `spec-update-avatar-upload-implemented.md` 가
  `9-user-profile.md` 외에 `0-overview.md §2.7`·`data-flow/4-file-storage.md`·
  `5-system/3-error-handling.md` 까지 stale SoT 를 열거하고, developer 가 `spec/` 를 직접
  고치지 않은 근거("자기-반증형 소정정 예외 미해당 — 제품 정의 서술이지 developer 의 예고
  문장이 아니다")를 명시한다. CLAUDE.md 권한 경계와 정확히 일치.
- **`users.module.ts`**: "S3Service 를 KB 모듈과 같은 방식으로 지역 provider 로 둔다"는
  주석을 `knowledge-base.module.ts` 와 대조 — 실제로 동일 패턴(`providers` 목록에
  `S3Service` 지역 등록)임을 확인.

## 요약

이 PR 의 문서화 밀도·정확도는 6라운드 누적으로도 이례적으로 높은 수준을 유지한다 —
CHANGELOG·README·`.env.example`·k8s 매니페스트·`scripts/minio/README.md`·plan 문서
다섯 계층이 "공개 버킷의 대가"·"`mc anonymous set download` 실측 기각"·"lost update 회피를
위한 컬럼 단위 UPDATE"·"prototype-chain 우회 방어" 등 핵심 결정을 실측과 함께 일관되게
설명하고, 과거 라운드가 지적한 코드-주석 drift(이중 폴백 주석 불일치, plan 수치 stale)는
전부 해소돼 있다. 다만 그 해소 과정 자체가 이번 라운드에서 새 결함을 하나 남겼다 —
직전 라운드의 "리네임 컨벤션 미문서화" WARNING에 대응하며 `users.controller.ts` 의
`ExpressNS` 근거 주석을 **삭제·수정 대신 그 위에 거의 동일한 내용으로 다시 추가**해,
같은 설명이 9줄 안에 두 번 반복되는 상태가 됐다. 기능 영향은 없지만 다음 사람이 같은
근거를 두 번 읽어야 하고, 두 문단 중 하나만 고쳐지면 서로 다른 설명이 나란히 남는 drift
위험을 새로 만든다 — 이 PR이 스스로 여러 차례 경계해 온 "사본이 갈리면 조용히 어긋난다"는
패턴과 같은 클래스다. 나머지 두 건(`@returns` 누락, `AVATAR_MAX_BYTES` JSDoc 프레이밍)은
3·5라운드부터 이어진 낮은 우선순위 INFO 로, 이번에도 미조치 상태임을 재확인했을 뿐 새로
발견한 것은 아니다.

## 위험도

LOW
