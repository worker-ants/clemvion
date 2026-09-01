# 보안(Security) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 검토 방법

`review/code/2026/09/01/01_37_27/_prompts/security.md` 에 조립된 diff 외에, 프롬프트 크기 제한으로
생략된 파일(`users.controller.ts`, `users.service.ts`, `s3.service.ts`, `ssrf.util.ts`,
`test/users-avatar-upload.e2e-spec.ts`, `scripts/minio/*`)은 저장소에서 직접 `Read` 로 전문을
확인했다. 인용 줄 번호는 모두 **해당 소스 파일의 실제 줄 번호**다(조립 프롬프트 오프셋 아님).

이 변경은 이미 4라운드 리뷰(`review/code/2026/08/31/22_12_54` → `23_46_40`)를 거쳤고, 그 중 발견된
**Critical(동시 쓰기 lost-update — `save(user)` 전체 저장이 로그인 잠금·2FA 등 다른 컬럼을 되돌림)은
현재 코드에서 `userRepository.update(userId, { avatarUrl })` 컬럼 단위 갱신으로 이미 수정되어 있음을
직접 확인했다**(`codebase/backend/src/modules/users/users.service.ts:144`). 본 리뷰는 그 수정 상태와,
남은 잔여 리스크가 실제로 낮은 위험도로 남아 있는지를 독립적으로 재확인한다.

## 발견사항

- **[INFO]** 업로드 파일의 매직바이트(실제 콘텐츠) 검증이 없다 — 확장자 화이트리스트만으로 판정
  - 위치: `codebase/backend/src/modules/users/users.service.ts:104-118` (`updateAvatar` 의 확장자 판정 블록)
  - 상세: `ext = file.originalname.split('.').pop()?.toLowerCase()` 로 얻은 확장자가
    `AVATAR_CONTENT_TYPES`(`png`/`jpg`/`jpeg`/`webp`/`gif`) 의 **own property** 인지만 확인하고,
    실제 바이트 내용이 유효한 이미지인지는 검사하지 않는다. 다만 주 방어선(stored XSS 차단)은
    실제 바이트가 아니라 **서버가 강제하는 `Content-Type`**(`users.service.ts:143`, `s3.service.ts` 의
    `PutObjectCommand.ContentType`)이며, 클라이언트가 보낸 `mimetype` 은 애초에 쓰지 않는다. 게다가
    스크립트를 실행시킬 수 있는 유일한 이미지 포맷인 SVG 가 화이트리스트에서 의도적으로 빠져 있어,
    이 갭이 실제로 열어 주는 것은 "임의 바이너리를 이미지 확장자로 공개 버킷에 유포"(평판·스토리지
    낭비) 정도다. `plan/in-progress/spec-sync-user-profile-gaps.md` 에 재개 신호(서버측 이미지 처리
    도입 시 파서 익스플로잇 표면이 생기므로 그때 필수화)와 함께 명시적으로 유예 등재되어 있다.
  - 제안: 현재 유예 사유가 타당하다(재개 신호가 구체적). 새 조치 불필요 — 서버측 이미지 리사이즈/
    썸네일 등 바이트를 실제로 파싱하는 기능이 추가되는 시점에 `file-type`/`sharp` 매직바이트 검증을
    전제조건으로 다시 검토할 것.

- **[INFO]** 공개 아바타 오브젝트 응답에 `X-Content-Type-Options: nosniff` 헤더가 없다
  - 위치: `codebase/backend/src/common/services/s3.service.ts:53-67` (`upload()` — `PutObjectCommand` 에 `ContentType` 만 지정, 추가 응답 헤더 없음)
  - 상세: MinIO/S3 는 `GetObject` 응답에 기본적으로 `X-Content-Type-Options: nosniff` 를 붙이지 않는다.
    주 방어(서버가 확장자에서 파생한 `Content-Type` 을 강제 저장)가 견고하고 SVG 가 제외돼 있어
    실질 위험은 낮지만, 구형 브라우저·비표준 클라이언트의 MIME 스니핑에 대한 심층방어 계층이 하나
    빠져 있다.
  - 제안: 필수는 아님. `PutObjectCommand` 에 `Metadata`/`Tagging` 을 통한 CDN 레벨 헤더 주입이나,
    프로덕션에서 CDN(CloudFront 등)을 앞단에 둘 때 응답 헤더 정책으로 `nosniff` 를 추가하는 것을
    고려.

- **[INFO]** `avatarUrl` 을 통한 키 복원(`deletePreviousAvatarObject`)이 크래프팅된 URL로도 타 사용자
  객체를 지울 수 없음을 재확인 — 문제 없음, 기록용
  - 위치: `codebase/backend/src/modules/users/users.service.ts:176-203` (`deletePreviousAvatarObject`)
  - 상세: 복원 키는 항상 `avatars/{자기 userId}/` 마커 **이후**의 부분 문자열이므로(`marker`,
    `at = previousUrl.indexOf(marker)`), `PATCH /users/me` 로 `avatarUrl` 에 `../../{다른 userId}/x`
    같은 문자열을 심어도 S3 `Key` 는 리터럴 문자열이라 `..` 를 경로 순회로 해석하지 않는다 — 즉
    실제로 존재하는 타 사용자 오브젝트의 키(`avatars/{다른 userId}/{uuid}.ext`)와 결코 일치할 수
    없다. `deletePreviousAvatarObject` 가 지울 수 있는 키는 항상 호출자 자신의 접두 아래로
    구조적으로 국한된다. `S3Service.delete` 도 `this.bucket`(서버 설정값)만 대상으로 하므로 URL 에
    포함된 버킷명은 애초에 반영되지 않는다.
  - 제안: 조치 불요 — 확인 결과로만 기록.

- **[INFO]** 아바타 업로드 전용 rate limit 이 없다 — 전역 스로틀에만 의존
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:149-200` (`uploadAvatar`, 다른
    `me/email-change/*` 엔드포인트와 달리 `@Throttle` 데코레이터 없음)
  - 상세: 인증된 사용자는 앱 전역 `UserThrottlerGuard`(기본 100req/60s) 한도 안에서 최대 2MB 짜리
    업로드를 반복할 수 있어(≈200MB/분/사용자), 스토리지·대역폭 소모 벡터가 된다. 다만 엔드포인트가
    `@UseGuards(JwtAuthGuard)` 로 보호돼 익명 접근은 불가능하고, 다른 기존 엔드포인트들도 개별
    스로틀 없이 전역 한도만 쓰는 것이 이 저장소의 일반 패턴이라 이 PR 이 새로 낮춘 기준은 아니다.
  - 제안: 필수는 아님. 스토리지 남용이 실제로 관측되면 `@Throttle` 로 별도 한도를 고려.

## 그 외 점검 결과 (문제 없음)

- **인증/인가**: `POST /api/users/me/avatar` 는 컨트롤러 클래스 레벨 `@UseGuards(JwtAuthGuard)` 로
  보호되고, 대상 사용자 ID 는 요청 바디가 아니라 JWT 의 `payload.sub` 에서만 취한다(IDOR 불가 —
  `users.controller.spec.ts` 의 "다른 사용자의 id 를 쓰면 남의 아바타를 덮어쓴다" 케이스로 고정).
- **인젝션**: SQL 은 전부 파라미터 바인딩(`userRepository.update`/`findOne`, 별도 raw 쿼리 없음).
  경로 탐색은 위에서 확인한 대로 S3 키가 리터럴 문자열이라 `../` 가 무의미하고, `getPublicUrl` 도
  키 세그먼트별 `encodeURIComponent` 로 인코딩해 URL 조립 단계의 인젝션도 없다.
  Prototype-pollution: `ext` 화이트리스트 조회가 `Object.prototype.hasOwnProperty.call(...)` 로
  일반 인덱싱의 `constructor`/`__proto__` truthy 통과를 명시적으로 막는다
  (`users.service.ts:104-112`).
- **하드코딩된 시크릿**: 이번 diff 로 추가된 값은 전부 URL(`S3_PUBLIC_BASE_URL`) 이며 신규 비밀값
  없음. `.env.example`/`docker-compose*`/k8s configmap 의 기존 `minioadmin` 류 자격증명은 이 PR 이
  건드리지 않은 기존 개발용 기본값이다. k8s prod/staging overlay 는 `REPLACE_ME.cloudfront.net`
  placeholder 사용.
  버킷 정책(`scripts/minio/avatars-public-read.json`)은 `s3:GetObject` 만 허용하고
  `s3:ListBucket` 은 열지 않도록 명시적으로 구성돼 있으며, `mc anonymous set download` 가
  `ListBucket` 을 암묵적으로 함께 여는 문제를 실측으로 기각한 근거가 `scripts/minio/README.md` 에
  남아 있다 — 공개 버킷의 유일한 접근 통제(키의 UUID 추측 불가능성)가 실제로 지켜진다.
  e2e(`test/users-avatar-upload.e2e-spec.ts`) 가 익명 GET 200 · 목록 조회 403 을 실 MinIO 로 확인한다.
- **입력 검증**: 파일 부재(`FILE_REQUIRED`), 확장자 화이트리스트(`INVALID_FILE_TYPE`), 크기 상한
  (multer `limits.fileSize` → 413) 이 컨트롤러/서비스 양쪽에서 검증되고 e2e 로 확인됐다.
- **에러 처리**: `NotFoundException`/`BadRequestException` 모두 구조화된 `code` 필드를 쓰고,
  S3/AWS SDK 예외처럼 매핑되지 않은 `Error` 는 `GlobalExceptionFilter` 가 일반 500 메시지로
  마스킹하고 원문은 서버 로그로만 보낸다(CWE-209 대응, `http-exception.filter.ts` 의
  `UNHANDLED_ERROR_MESSAGE`) — 이번 변경이 이 기존 계약을 우회하지 않는다.
- **SSRF**: 이번 PR 이 도입한 `isPrivateHost`/`resolvePublicBaseUrl` 조합은 서버가 사용자 URL 을
  fetch 하는 경로가 아니라 **부팅 시 정적 설정값**(`S3_PUBLIC_BASE_URL`)을 검사하는 용도이므로
  SSRF 진입점이 아니다. `avatarUrl` 을 외부 URL 로 저장하는 `PATCH /users/me` 경로(기존 코드, 이번
  diff 밖)도 서버가 그 URL 을 fetch 하지 않고 브라우저가 `<img src>` 로만 로드하므로 동일하게
  SSRF 표면이 아니다(`update-me.dto.ts` 의 기존 주석과 일치).
  `main.ts` 의 신규 경고 로그는 `resolvePublicBaseUrl(process.env)` 값(공개 목적의 URL)만 출력해
  민감정보 노출이 없다.
  DNS rebinding 등 `ssrf.util.ts` 자체의 한계는 이번 PR 범위 밖(기존 유틸 재사용)이라 재론하지 않는다.
- **동시성 관련 lost-update(과거 Critical)**: `updateAvatar` 가 `userRepository.update(userId, { avatarUrl })`
  컬럼 단위 갱신만 쓰고(`users.service.ts:144`), 로그인 시도 카운터 등은 `incrementLoginAttempts` 의
  원자적 `UPDATE ... RETURNING`(`users.service.ts:346-373`)으로 별도 처리돼 서로의 컬럼을 되돌리지
  않는다 — 이전 라운드가 지목한 계정 보안 상태 되돌림 CRITICAL 이 현재 코드에서 재발하지 않음을
  직접 코드로 확인했다.
- **의존성 보안**: `package.json`/`pnpm-lock.yaml` 변경 없음(신규 외부 패키지 미도입).
- **암호화/평문 전송**: 이번 변경이 새로 다루는 값(공개 아바타 URL, 이미지 바이트) 은 설계상
  비밀정보가 아니다 — 별도 암호화 요구사항 없음. TLS 종단은 기존 인프라 설정 범위.

## 요약

이 PR 은 공개 버킷에 사용자 업로드 파일을 노출하는, 설계상 리스크가 큰 기능임에도 불구하고 핵심
위협 세 가지 — (1) 키 열거를 통한 무단 접근(UUID + 명시적 `ListBucket` 차단 버킷 정책 + e2e 로
검증), (2) 저장형 XSS(서버 강제 `Content-Type` + SVG 화이트리스트 제외), (3) 다른 사용자 리소스에
대한 IDOR/삭제(JWT `sub` 기반 스코핑 + S3 키가 리터럴이라 경로 탐색 무의미) — 를 코드·설정·테스트
세 층위 모두에서 방어하고 있다. 이전 라운드에서 지적된 유일한 Critical(장시간 S3 업로드 도중 다른
요청의 계정 보안 컬럼 변경을 `save()` 전체 저장이 조용히 되돌리는 lost-update)은 컬럼 단위
`update()` 로 이미 수정되어 현재 코드에 남아 있지 않음을 직접 확인했다. 남은 항목은 전부 INFO
수준으로, 매직바이트 미검증과 `nosniff` 헤더 부재는 서버가 `Content-Type` 을 강제하고 SVG 를
제외한 1차 방어가 견고해 실질 위험이 낮으며, 둘 다 재개 신호를 명시한 채 plan 에 유예 등재돼 있다.
차단 사유가 되는 발견사항은 없다.

## 위험도

LOW
