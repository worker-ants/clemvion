# 문서화(Documentation) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 개요

이 PR 은 이미 6라운드의 리뷰를 거쳤고(`review/code/2026/08/31/22_12_54` ~
`review/code/2026/09/01/00_35_24`), 이번은 그 최종 상태를 다시 보는 라운드다. 프롬프트에
diff 가 생략된 파일(`users.controller.ts`·`users.service.ts`·`s3.config.spec.ts`·
`users-avatar.service.spec.ts`·`users-avatar-upload.e2e-spec.ts`·plan 문서 2건·
`scripts/minio/README.md`·`scripts/minio/avatars-public-read.json`)은 저장소에서 직접
`Read` 로 원문을 확인했고, CHANGELOG·README·`.env.example`·`s3.config.ts`·`s3.service.ts`·
`main.ts`·docker-compose·k8s 매니페스트는 diff 원문을 그대로 대조했다.

직전 라운드(`00_35_24`) 문서화 리뷰가 잡은 WARNING(`users.controller.ts` 의 `ExpressNS`
리네임 근거 주석이 두 문단으로 중복돼 있던 것)은 현재 `users.controller.ts:53-59` 에서
**단일 문단**으로 합쳐져 있음을 확인했다 — 해소됨. RESOLUTION(`review/code/2026/09/01/00_35_24/RESOLUTION.md`
W1)이 서술하는 조치와 실제 코드가 일치한다.

## 발견사항

- **[INFO]** `S3Service.getPublicUrl` JSDoc 에 `@returns` 설명이 여전히 없음 (3·5·6라운드에
  이어 4번째 재확인 — 매번 "선택 사항, 낮은 우선순위"로 미조치)
  - 위치: `codebase/backend/src/common/services/s3.service.ts:69-86` (JSDoc 블록, `:84` 의
    `@param key` 다음 줄에 `@returns` 없이 바로 메서드 본문으로 이어짐)
  - 상세: 같은 파일의 `deleteMany` 는 반환 형태(`Promise<{ errored: string[] }>`)를
    JSDoc 에 명시하는데 `getPublicUrl` 은 `@param` 만 있다. 기능에는 영향이 없고, 여러
    라운드에 걸쳐 팀이 명시적으로 유예한 항목이라 새로 발견한 결함은 아니다.
  - 제안: `@returns 공개 GET URL (base/bucket/encoded-key)` 한 줄 추가 — 여전히 선택 사항.

- **[INFO]** `AVATAR_MAX_BYTES` JSDoc("컨트롤러의 multer 한도와 **같은 값이어야** 한다")이
  실제 구현(리터럴 동기화가 아니라 **직접 참조**)과 표현이 어긋남 (3·5·6라운드에 이어
  4번째 재확인 — 미조치)
  - 위치: `codebase/backend/src/modules/users/users.service.ts:51`
    (`/** 아바타 크기 상한. 컨트롤러의 multer 한도와 **같은 값이어야** 한다. */`)
    vs `codebase/backend/src/modules/users/users.controller.ts:154-162`
    (`limits: { fileSize: UsersService.AVATAR_MAX_BYTES }` 옆 주석 — "상수를 **직접
    참조**하므로 서비스와 갈릴 수 없다")
  - 상세: 컨트롤러 쪽 주석은 정확히 "직접 참조라 갈릴 수 없다"고 서술하는 반면, 서비스
    쪽 JSDoc 은 "같은 값이어야 한다"(마치 손으로 동기화해야 하는 두 상수처럼 읽힘)로
    남아 있다. 실제 드리프트 위험은 코드가 참조로 이미 막고 있어 낮다.
  - 제안: 선택 사항. `AVATAR_MAX_BYTES` JSDoc 을 "컨트롤러의 multer `limits.fileSize` 가
    이 값을 직접 참조한다(리터럴 중복 아님)"로 맞추면 일관성이 좋아진다.

## 검증한 항목 (문제 없음 확인)

- **CHANGELOG**: `## Unreleased — 아바타 이미지 업로드` 항목이 공개 버킷 결정·세 축의 방어
  (키 UUID·`Content-Type` 확장자 파생·저장 후 삭제)·`avatarUrl` 컬럼 단위 UPDATE(lost
  update 회피)·부팅 가드·`mc anonymous set download` 기각 실측·spec 배지 flip 위임까지
  근거와 함께 서술한다. 실제 코드(`users.service.ts` 의 `userRepository.update(userId, {
  avatarUrl })`, `deletePreviousAvatarObject` 의 `avatars/{userId}/` 앵커 복원)와 전부
  일치한다.
- **README.md / `.env.example` / k8s 3-overlay(`base`·`local`·`prod`·`staging`) /
  `docker-compose.yml`·`docker-compose.e2e.yml`**: `S3_PUBLIC_BASE_URL` 이 빠짐없이
  등재돼 있고, "브라우저가 도달하는 주소" vs `S3_ENDPOINT`(내부 주소)의 구분·폴백 규칙·
  버킷 정책 배포 선행 조건이 모든 위치에서 일관되게 서술된다. k8s 오버레이 3곳 모두 값을
  덮어써, CHANGELOG 가 경고한 "overlay 전파 누락으로 localhost 가 prod 에 실릴 뻔한
  근접사고" 클래스가 재발하지 않게 막혀 있다.
- **`scripts/minio/README.md`(신규) + `avatars-public-read.json`(신규)**: `mc anonymous
  set download` 가 `s3:ListBucket` 을 함께 여는 것을 실측 로그(정책 JSON·`curl` 응답)와
  함께 반증하고, 명시 정책으로 바꾼 뒤 목록 403·GET 200 을 재실측했다 — 근거 기반 문서의
  좋은 예다. 정책 JSON 의 `Resource`(`arn:aws:s3:::workflow-storage/avatars/*`)도
  `docker-compose*.yml`/`.env.example` 의 `S3_BUCKET=workflow-storage` 와 일치한다.
- **`main.ts` 부팅 가드**: `shouldWarnPublicBaseIsPrivate`/`resolvePublicBaseUrl` 을
  가져와 조합 판정을 순수 함수에 위임하고, 인접 주석이 "부트스트랩 본문에 인라인으로
  두면 조합 전체가 테스트로 안 물린다(리뷰 6라운드 실측: 85건 GREEN)"는 이유를 정확히
  설명한다. `ALLOW_PRIVATE_HOST_TARGETS` 경고와 같은 `throw` vs `warn` 정책 근거도
  일관되게 서술된다.
- **`s3.config.ts`/`s3.service.ts` 폴백 이중화 주석**: "`?? endpoint` 는 SoT 사본이 아니라
  설정 모듈 미로드 조립을 위한 2차 방어" 설명이 실제 코드(`resolvePublicBaseUrl` 이 항상
  truthy 문자열을 반환하므로 정상 부트 경로에서 이 분기가 도달 불가능)와 일치하고, "초판
  주석은 폴백이 한 곳이라 단언했는데 바로 이 줄이 다시 폴백하고 있었다"는 자기 정정
  이력까지 코드에 남아 있다. `s3.config.spec.ts`/`s3.service.spec.ts` 가 규칙과 이중
  폴백 분기 양쪽을 각각 테스트로 고정한다.
- **`users.controller.ts` `ExpressNS` 리네임 주석**: 직전 라운드가 지적한 중복이 현재는
  단일 문단(`:53-59`)으로 합쳐져 있다 — "다른 컨트롤러 4곳은 `Express` 그대로다,
  전역 컨벤션 승격은 `spec/conventions/` 문서화가 선행돼야 한다"는 새 정보만 기존 근거
  뒤에 한 문장으로 남아 있다.
- **plan 문서 2건(`spec-sync-user-profile-gaps.md`, `spec-update-avatar-upload-implemented.md`)**:
  회귀 테스트 "건수"를 더 이상 하드코딩하지 않고 "필요하면 `jest --silent <file>` 로
  센다"로 일관되게 서술해, 과거 라운드가 지적한 "숫자 stale 재발" 클래스를 근본적으로
  차단했다. `spec-update-avatar-upload-implemented.md` 는 `9-user-profile.md` 외에
  `0-overview.md §2.7`·`data-flow/4-file-storage.md`·`5-system/3-error-handling.md`
  까지 stale SoT 를 열거하고, developer 가 `spec/` 를 직접 고치지 않은 근거("자기-반증형
  소정정 예외 미해당 — 제품 정의 서술이지 developer 의 예고 문장이 아니다")를 명시한다.
  CLAUDE.md 권한 경계와 정확히 일치한다.
- **`users-avatar-upload.e2e-spec.ts`(신규)**: 파일 최상단 docstring 이 "이 스펙만 증명할
  수 있는 것"(유닛이 `S3Service` 를 mock 해 버킷 정책 자체를 못 본다는 점)과 "왜 응답의
  `avatarUrl` 을 그대로 fetch 하지 않는가"(컨테이너 망 주소와 브라우저 도달 주소가 다르다는
  점)를 근거와 함께 설명하고, 각 `it` 의 인라인 주석도 검증 대상과 실패 시 증상을 구체적으로
  남긴다.
- **`users.service.ts`/`users-avatar.service.spec.ts`**: `updateAvatar`·
  `deletePreviousAvatarObject`·`update` 의 JSDoc/인라인 주석이 lost-update 회피(컬럼
  단위 UPDATE)·프로토타입 체인 우회 방어·정리 순서(저장 후 삭제)·URL 앵커 복원 방식·
  `try` 범위(퍼센트 인코딩 파싱 실패 처리)를 각각 "왜 이렇게 했는가"까지 포함해 서술하며,
  대응하는 테스트가 각 서술을 뮤테이션으로 고정한다 — 코드와 주석이 어긋나는 지점을
  찾지 못했다.
- **`users.module.ts`**: "`S3Service` 를 KB 모듈과 같은 방식으로 지역 provider 로 둔다"는
  주석을 실제 `knowledge-base.module.ts` 패턴과 대조 — 동일 방식(`providers` 목록에
  `S3Service` 지역 등록)임을 확인했다.
- **`users.controller.spec.ts` 신규 `describe('UsersController.uploadAvatar (§6.1)')`**:
  주석이 "이 컨트롤러의 다른 6개 엔드포인트는 전부 컨트롤러 레벨 테스트가 있는데
  `uploadAvatar` 만 없었다"는 WARNING 을 자기-지목하며 왜 이 테스트가 필요한지 근거를
  남긴다.

## 요약

이 PR 의 문서화 밀도·정확도는 7라운드 누적 시점에서도 이례적으로 높은 수준을 유지한다.
CHANGELOG·README·`.env.example`·k8s 매니페스트·`scripts/minio/README.md`·plan 문서
다섯 계층이 "공개 버킷의 대가"·"`mc anonymous set download` 실측 기각"·"lost update
회피를 위한 컬럼 단위 UPDATE"·"prototype-chain 우회 방어" 등 핵심 결정을 실측과 함께
일관되게 설명하고, 직전 라운드가 지적한 유일한 WARNING(`ExpressNS` 근거 주석 중복)은
확인 결과 해소돼 있다. 남은 항목은 3라운드 넘게 반복 지적·반복 유예된 두 건의 저위험
INFO(`getPublicUrl` `@returns` 누락, `AVATAR_MAX_BYTES` JSDoc 표현이 "직접 참조"라는
실제 구현과 살짝 어긋남)뿐이며, 둘 다 기능에 영향이 없고 팀이 이미 "선택 사항"으로
명시적으로 판정한 항목이다. 새로 발견한 CRITICAL/WARNING 은 없다.

## 위험도

LOW
