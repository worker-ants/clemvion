# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `updateAvatar` 가 느린 S3 업로드 뒤 유저 엔티티 전체를 `save()` 해, 동시에 진행되는 로그인 잠금·2FA 등 다른 계정 상태 변경을 조용히 되돌릴 수 있는 lost-update 경쟁이 있다(concurrency reviewer). forced 화이트리스트(`dependency, documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 누락된 강제 reviewer 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | CONCURRENCY | `updateAvatar` 가 `findOne` 으로 유저 엔티티 전체를 로드한 뒤 **네트워크 I/O(S3 업로드)를 `await` 하고**, 그 오래된 메모리 스냅샷에 `avatarUrl` 만 바꿔 `userRepository.save(user)`(TypeORM 전체 컬럼 UPDATE)를 호출한다. 이 사이(S3 업로드 지속시간) 다른 요청이 같은 유저 row 를 `usersService.update()`(partial)로 바꾸면(예: `incrementLoginAttempts` 의 로그인 잠금), `updateAvatar` 의 뒤늦은 전체 `save()` 가 그 변경을 **조용히 되돌린다**. 트랜잭션·낙관적 락(`@VersionColumn`)·per-user 직렬화 전부 없음. | `codebase/backend/src/modules/users/users.service.ts:93-105` | `userRepository.update(userId, { avatarUrl })` 같은 targeted partial update 로 변경해 다른 컬럼을 절대 건드리지 않게 한다. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `AVATAR_CONTENT_TYPES` 가 일반 객체 리터럴이라 `Object.prototype` 상속 프로퍼티명(`constructor`/`__proto__`/`toString` 등)을 확장자로 쓰면 화이트리스트 검증을 우회한다(실측으로 7개 이름 전부 truthy 확인). 우회로 `Content-Type` 을 임의 문자열로 완전 탈취할 순 없으나, 문서화된 검증 불변식이 특정 입력에서 깨진다. | `codebase/backend/src/modules/users/users.service.ts:82-91` (정의 `:43-49`) | `Object.prototype.hasOwnProperty.call(...)` 가드 추가, 또는 `Object.create(null)`/`Map` 사용. `constructor`/`__proto__`/`toString` 확장자 회귀 테스트 추가. |
| 2 | ARCHITECTURE | `S3Service` 생성자 주석이 "폴백 규칙은 `s3.config.ts` 한 곳"이라 단언하지만, 바로 아래 코드가 `?? endpoint` 로 다시 폴백한다 — SoT 주장과 코드가 어긋남(테스트 mock 이 항상 값을 채워 이 분기는 커버되지 않음). | `codebase/backend/src/common/services/s3.service.ts:32-35` | `?? endpoint` 제거해 단일 SoT 강제하거나, 주석을 "이중 방어"로 정정. |
| 3 | ARCHITECTURE | `deletePreviousAvatarObject` 가 `S3Service.getPublicUrl` 이 만든 URL 포맷 지식을 `UsersService` 안에서 역산 재구현(레이어 경계 누수)하며, 그 과정에서 **버킷 세그먼트 불일치를 조용히 무시**하고 항상 현재 설정된 버킷에서 삭제한다(테스트가 이를 고정: `other-bucket` URL 이어도 통과). | `codebase/backend/src/modules/users/users.service.ts:120-147` | `S3Service` 에 `extractKeyFromPublicUrl()` 류 대응 메서드를 두어 URL↔key 매핑 지식을 한 곳에 모은다. 버킷 불일치 허용 여부를 명시적으로 문서화. |
| 4 | SIDE_EFFECT | 이번 PR 이 심은 "avatarUrl 변경 시 옛 S3 객체 정리" 불변식이 `UsersService.update()` 한 곳에만 있는데, 기존 코드 `auth-oauth.service.ts` 의 `resolveUser()` 는 raw `QueryBuilder` 로 `avatarUrl` 을 직접 써 이 진입점을 우회한다. 오늘은 값 우선순위 때문에 트리거되지 않지만, 우선순위 로직이 바뀌면 신규 회귀 테스트 13건 중 어느 것도 잡지 못하는 조용한 orphan 경로가 된다. | `codebase/backend/src/modules/auth/auth-oauth.service.ts` `resolveUser()` (~390-401줄, 이번 diff 밖) | `resolveUser()` 도 `UsersService.update()` 를 경유하도록 리팩터하거나, 최소한 경고 주석 + 캐너리 테스트 추가. |
| 5 | CONCURRENCY / REQUIREMENT | 아바타 교체 경로의 TOCTOU — `updateAvatar`/`update` 모두 정리 대상 키를 비원자적 사전 SELECT 로 캡처한다. 동시(더블클릭·다중 탭) 업로드/PATCH 시 "패자" 요청이 올린 새 S3 오브젝트는 어느 정리 로직도 대상으로 잡지 못해 영구 고아로 남는다. 동시성 케이스 회귀 테스트 없음. | `codebase/backend/src/modules/users/users.service.ts:93-107`, `:185-199` | 데이터 정합성 훼손은 없어 낮은 우선순위. per-user advisory lock 또는 주기적 orphan-sweep 백로그 등재 권장. |
| 6 | MAINTAINABILITY | S3 키 접두 `avatars/{userId}/` 리터럴이 키 생성(`updateAvatar`)과 키 복원 마커(`deletePreviousAvatarObject`) 두 곳에 독립적으로 하드코딩되어, 레이아웃 변경 시 한쪽만 고치면 조용히 고아 객체가 생기는 드리프트 위험이 있다. | `codebase/backend/src/modules/users/users.service.ts:97, 125` | `avatarKeyPrefix(userId)` 헬퍼로 추출해 두 곳에서 재사용. |
| 7 | TESTING / MAINTAINABILITY | Swagger "2MB" 동기화 테스트(`matchAll(/최대 (\d+)MB/g)`)가 `@ApiPayloadTooLargeResponse` 의 `'파일 크기 초과 (2MB)'` 리터럴을 검사하지 못한다 — "최대" 접두어가 없어 이 정규식에 구조적으로 매칭 안 됨. 이 값이 stale 로 갈려도 테스트는 GREEN. | `codebase/backend/src/modules/users/users-avatar-swagger-sync.spec.ts:20`, `codebase/backend/src/modules/users/users.controller.ts:185` | `@ApiPayloadTooLargeResponse` 문구를 "최대 NMB" 관용구로 통일하거나 별도 assertion 추가. |
| 8 | TESTING / REQUIREMENT / MAINTAINABILITY | 같은 spec 의 확장자 목록 검사가 `g` 플래그 없는 `.match()` 라 첫 번째 occurrence(`@ApiOperation`, :162)만 검증하고, 두 번째 리터럴(`@ApiBody`, :175)이 독립적으로 갈려도(예: SVG 조용히 허용) 잡지 못한다. | `codebase/backend/src/modules/users/users-avatar-swagger-sync.spec.ts:28`, `users.controller.ts:162, 175` | `matchAll`+`/g` 로 바꿔 모든 occurrence 순회 검증. |
| 9 | TESTING | 신규 `POST /api/users/me/avatar` 에 대한 e2e(supertest) 테스트가 없다 — 실 MinIO 업로드/413/공개 URL 200 왕복이 unit mock 으로는 검증되지 않는다. 게다가 `docker-compose(.e2e).yml` 의 `createbuckets` 가 여전히 `mc mb` 뿐이라 `avatars/` 익명 GET 정책 자체가 로컬 e2e 인프라에 없다. 자매 엔드포인트(`change-password`, `email-change`)는 둘 다 e2e-spec 보유. | `codebase/backend/test/` (부재), `docker-compose.yml:49-66`, `docker-compose.e2e.yml:78-93` | `users-avatar.e2e-spec.ts` 신설(업로드 성공/거부/413 + 공개 URL GET 200 + 교체 시 이전 객체 삭제). 선행으로 `createbuckets` 에 익명 다운로드 정책 추가 필요. |
| 10 | DOCUMENTATION / REQUIREMENT | `CHANGELOG.md`·`plan/in-progress/spec-sync-user-profile-gaps.md` 두 문서 모두 "`Express` 를 `ExpressModule` 로 개명했다"고 적었지만 실제 코드는 `ExpressNS` 다(`ExpressModule` 문자열은 코드 어디에도 없음). | `CHANGELOG.md:30`, `plan/in-progress/spec-sync-user-profile-gaps.md:64` vs `codebase/backend/src/modules/users/users.controller.ts:57` | 두 문서의 `ExpressModule` → `ExpressNS` 로 정정. |
| 11 | DOCUMENTATION | `updateAvatar` JSDoc 의 `@throws` 가 `BadRequestException` 만 열거하고 실제로 던지는 `NotFoundException`(USER_NOT_FOUND)을 누락 — 같은 파일 `changePassword` 의 관례(3개 모두 열거)와 불일치. | `codebase/backend/src/modules/users/users.service.ts:66` (JSDoc) vs `:94` (실제 throw) | `@throws NotFoundException \`USER_NOT_FOUND\`` 한 줄 추가. |
| 12 | DOCUMENTATION | CHANGELOG·`.env.example`·`k8s/README.md` 가 반복 경고하는 "익명 GET 버킷 정책 필요, 없으면 업로드 성공·이미지 403" 전제가 로컬/e2e `docker-compose` 의 `createbuckets` 에는 실제로 설정돼 있지 않고(`mc anonymous set`/`policy set` 0건), 여는 방법도 어떤 문서에도 없다 — 그대로 따르면 문서가 경고한 실패를 로컬에서 겪는다. | `docker-compose.yml:49-66`, `docker-compose.e2e.yml:78-93` | README/`.env.example`/CHANGELOG 중 한 곳에 `mc anonymous set download ...` 예시 명령 추가, 또는 `createbuckets` 에 자동화 반영. |
| 13 | API_CONTRACT | `updateAvatar` 의 `NotFoundException({ code: 'USER_NOT_FOUND' })` 가 `message` 필드를 생략해, 같은 `code` 를 쓰는 형제 엔드포인트(`getMe`/`updateMe`/`changePassword`, 전부 `message:'User not found'` 포함)와 응답 본문 텍스트가 갈린다. | `codebase/backend/src/modules/users/users.service.ts:94` | `NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' })` 로 통일. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | 업로드 파일의 실제 바이트(매직 넘버)는 검증하지 않고 파일명 확장자만으로 이미지 여부를 판정한다 — 저장형 XSS 방지엔 충분하나, 향후 서버측 이미지 처리 추가 시 파서 익스플로잇 표면이 될 수 있음. | `codebase/backend/src/modules/users/users.service.ts:82-91` | 이미지 처리 파이프라인 추가 시 매직 바이트 검증(`file-type` 류) 백로그 등재. |
| 2 | SECURITY | 공개 버킷 오브젝트에 `X-Content-Type-Options: nosniff` 등 MIME 스니핑 방지 헤더를 코드 레벨에서 강제하지 않는다. | `codebase/backend/src/common/services/s3.service.ts` (`upload()`) | 가능하면 `PutObjectCommand` 메타데이터로 강제하거나, CDN/프록시 단 정책 문서화. |
| 3 | SECURITY | `S3_PUBLIC_BASE_URL` 미설정 시 내부 주소(`S3_ENDPOINT`)로 조용히 폴백 — 운영에서 누락 시 사설 주소가 인증된 사용자에게 노출될 수 있음(낮은 위험). | `codebase/backend/src/common/config/s3.config.ts:19-22` | 운영 환경에서는 미설정 시 fail-fast 하는 것을 고려. |
| 4 | PERFORMANCE | 옛 아바타 정리(S3 DELETE)가 best-effort(실패 흡수)인데도 응답을 동기 대기시킨다. | `codebase/backend/src/modules/users/users.service.ts:105` | fire-and-forget(`.catch` 로 로깅만)으로 전환해 latency 절감 가능(필수 아님). |
| 5 | PERFORMANCE | 아바타 업로드 전용 rate-limit 이 없고 전역 기본값(100회/분/사용자)에만 의존 — 이론상 최대 ~200MB/분/사용자. | `codebase/backend/src/modules/users/users.controller.ts:143-158` | 필요 시 파일 업로드 특성에 맞춘 낮은 전용 `@Throttle` 고려. |
| 6 | ARCHITECTURE | `UsersService` 가 프로필 CRUD·비밀번호·로그인 카운터에 이어 스토리지 오케스트레이션까지 떠맡아 다책임 방향으로 계속 성장. | `codebase/backend/src/modules/users/users.service.ts` | 당장 분리 불요. 다음 파일 업로드 기능 추가 시 `AvatarStorageService` 분리 검토. |
| 7 | SPEC-DRIFT | `[SPEC-DRIFT]` spec 3개 문서(`spec/2-navigation/9-user-profile.md`, `spec/data-flow/4-file-storage.md`, 및 `0-overview.md §2.7`)가 아바타 업로드를 여전히 "미구현 (Planned)"·구식 키 패턴(`{workspaceId}/avatars/{userId}.{ext}`)으로 서술 — 코드가 spec 을 앞서 있다. developer 가 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 로 정확한 라인 근거와 함께 planner 위임 완료. | `spec/2-navigation/9-user-profile.md:136, 334`, `spec/data-flow/4-file-storage.md:58, 71, 78` | (코드 수정 아님) `project-planner` 가 plan 의 위임 항목을 실행해 배지·본문·키 패턴을 갱신. |
| 8 | REQUIREMENT / API_CONTRACT | 신규 에러 코드 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 이 `spec/5-system/3-error-handling.md` 카탈로그에 미등재(`INVALID_FILE_TYPE`은 이 PR 이전부터 기존 미등재 상태). 이미 위 spec 위임 plan 의 할 일 목록에 포함돼 별도 조치 불요. | `codebase/backend/src/modules/users/users.service.ts:77, 88` | 추적됨 — 조치 없음. |
| 9 | TESTING | `service as unknown as {...}` 로 private `userRepository` 필드에 직접 접근(타입 캐스팅 우회) — 같은 파일 뒤쪽 `build()` 헬퍼는 이미 `repo` 를 명시적으로 반환하는 더 안전한 패턴 사용. | `codebase/backend/src/modules/users/users-avatar.service.spec.ts:166-169` | `setup()` 도 `repo` 를 반환하도록 시그니처 변경. |
| 10 | TESTING | "빈 파일 거부" 테스트가 `file: undefined` 형태만 검증하고, 실제 multer 가 만드는 `{ buffer: Buffer.alloc(0) }` 형태는 별도 검증하지 않음(현재 가드 로직은 둘 다 처리하지만 회귀 대비 갭). | `codebase/backend/src/modules/users/users-avatar.service.spec.ts:113-119` | `buffer: Buffer.alloc(0)` 케이스 1건 추가. |
| 11 | DEPENDENCY | 신규 외부 패키지 추가 없음(`package.json`/`pnpm-lock.yaml` diff 없음) — UUID 생성도 기존 `uuid` 패키지 대신 표준 `node:crypto.randomUUID()` 선택, 모범 사례로 기록. | `codebase/backend/src/modules/users/users.service.ts:1` | 조치 불요. |
| 12 | USER_GUIDE_SYNC | frontend 가 아직 `POST /me/avatar` 를 호출하지 않아(grep 0건) user-guide 페이지·i18n 갱신 target 이 현재는 미도달 회색지대 — 프로필 설정 페이지 자체가 이 PR 이전부터 문서화돼 있지 않음. | `codebase/frontend/src/app/(main)/w/[slug]/profile/`, `codebase/frontend/src/content/docs/07-workspace-and-team/` | 후속 frontend 배선 plan 에 문서/i18n/에러 토스트 매핑 3갈래를 체크리스트로 미리 명시. |
| 13 | SCOPE | 경계에 걸치는 3개 리팩터링(`toProfileData()` 추출, `Express`→`ExpressNS` 개명, `UsersService.update()` 확장)은 모두 새 엔드포인트가 만든 필요·위험(응답 통일, 타입 충돌 해소, 고아 객체 방지)에서 직접 파생된 최소 조치이며 CHANGELOG/plan/테스트로 근거가 투명함 — 스코프 이탈 아님. | `codebase/backend/src/modules/users/users.controller.ts:84-93, 57, 214-215, 301-302`; `users.service.ts:185-199` | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| concurrency | CRITICAL | `updateAvatar` 전체 엔티티 `save()` 로 인한 lost-update(계정 잠금 등 롤백 가능) + 교체 TOCTOU 고아 객체 |
| architecture | MEDIUM | publicBaseUrl 폴백 주석-코드 불일치(SSOT), URL↔key 역산 로직의 레이어 누수 + 버킷 무시 |
| side_effect | MEDIUM | S3 정리 불변식이 `UsersService.update()` 밖 raw QueryBuilder 경로(auth-oauth)에 의해 우회 가능 |
| testing | MEDIUM | 신규 엔드포인트 e2e 부재 + Swagger 동기화 테스트가 스스로 주장하는 커버리지보다 좁음 |
| documentation | MEDIUM | 문서-코드 식별자명 불일치, JSDoc 누락, 버킷 정책 미설정+미문서화 |
| security | LOW | `AVATAR_CONTENT_TYPES` 프로토타입 상속 우회(WARNING) 외 핵심 위협모델(키 추측·Content-Type·인가)은 정상 방어 |
| performance | LOW | 정리 삭제 동기 대기·전용 rate-limit 부재 등 INFO 수준 개선 여지만 |
| requirement | LOW | 핵심 로직은 CHANGELOG/JSDoc 서술과 일치, 문서·테스트 커버리지 보강 성격 항목만 |
| maintainability | LOW | 키 접두 하드코딩 중복, swagger 동기화 테스트 부분 커버리지 |
| api_contract | LOW | `NotFoundException` message 누락으로 형제 엔드포인트와 응답 본문 불일치 |
| scope | LOW | 스코프 이탈 없음, 경계 리팩터 3건 모두 근거 투명 |
| user_guide_sync | LOW | frontend 미소비로 user-guide target 은 현재 회색지대(차단 아님) |
| dependency | NONE | 신규 외부 패키지 없음, 표준 라이브러리 선택 |

## 발견 없는 에이전트

없음 — 13개 reviewer 전원이 최소 INFO 이상의 발견사항을 남겼다(dependency 는 위험도 NONE 이나 "신규 패키지 없음" 확인 결과를 INFO 로 기록).

## 권장 조치사항

1. **(CRITICAL)** `UsersService.updateAvatar` 의 DB 반영을 `userRepository.update(userId, { avatarUrl })` 형태의 targeted partial update 로 변경 — 동시 로그인 잠금/2FA 등 다른 계정 상태 변경이 조용히 롤백되는 lost-update 경쟁을 제거한다.
2. `AVATAR_CONTENT_TYPES` 조회에 `hasOwnProperty` 가드를 추가하거나 `Map`/`Object.create(null)` 로 전환해 프로토타입 상속 프로퍼티명에 의한 화이트리스트 우회를 차단하고, `constructor`/`__proto__`/`toString` 확장자 회귀 테스트를 추가한다.
3. `auth-oauth.service.ts` 의 `resolveUser()` 가 `UsersService.update()` 를 우회해 `avatarUrl` 을 직접 쓰는 경로를 정리(경유하도록 리팩터하거나 최소 경고 주석+캐너리 테스트)해, S3 정리 불변식이 코드베이스 전체에 대해 실제로 성립하게 한다.
4. `users-avatar-swagger-sync.spec.ts` 의 두 정규식을 `matchAll`+`/g` 로 넓혀 `@ApiPayloadTooLargeResponse`("2MB")와 `@ApiBody`(확장자 목록) 리터럴 드리프트를 실제로 잡도록 보강한다.
5. 신규 `POST /api/users/me/avatar` 에 대한 e2e(supertest) 테스트를 추가하고, 선행으로 `docker-compose(.e2e).yml` 의 `createbuckets` 에 `avatars/` 익명 GET 정책 설정을 반영해 "공개 URL 이 실제로 열리는가"를 실증한다.
6. CHANGELOG/plan 문서의 `ExpressModule`→`ExpressNS` 오기, `updateAvatar` JSDoc 의 `@throws NotFoundException` 누락, `NotFoundException` 의 `message` 필드 누락(형제 엔드포인트와 통일)을 정정한다.
7. S3 키 접두 `avatars/{userId}/` 를 공유 헬퍼로 추출해 `updateAvatar`/`deletePreviousAvatarObject` 양쪽의 드리프트 위험을 제거하고, `S3Service.getPublicUrl` 의 역산 로직(URL→key)도 `S3Service` 로 이관해 레이어 경계를 정리한다(버킷 불일치 허용 여부는 명시적으로 문서화).
8. (별도 트랙, developer 조치 아님) `project-planner` 가 `plan/in-progress/spec-update-avatar-upload-implemented.md` 를 실행해 spec 3개 문서의 "미구현(Planned)" 배지·키 패턴을 갱신하고, `FILE_REQUIRED`/`INVALID_FILE_TYPE` 을 에러 카탈로그에 등재한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, concurrency, api_contract, user_guide_sync` (13명)
  - **제외**: 표 (1명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | database | router 가 이번 diff 를 DB 스키마/쿼리 변경과 무관하다고 판단해 제외 |