# API 계약(API Contract) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 신규/재사용 에러 코드가 중앙 에러 카탈로그에 아직 미등재
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (`updateAvatar`, `FILE_REQUIRED`·`INVALID_FILE_TYPE` throw 지점 — 함수 JSDoc `@throws` 라인)
  - 상세: `POST /api/users/me/avatar` 가 새로 던지는 `FILE_REQUIRED`(400)는 `spec/5-system/3-error-handling.md` §1 카탈로그 어디에도 없다. `INVALID_FILE_TYPE`(400)은 코드는 재사용하지만 실제로는 KB 문서 업로드(`data-flow/4-file-storage.md:52`, 허용 확장자 `txt/md/pdf/csv`)와 **다른 컨텍스트**(허용 확장자 `png/jpg/jpeg/webp/gif`)에서 같은 코드로 발행된다 — 클라이언트가 `code` 만으로 두 컨텍스트를 구분할 수 없고 `message` 문자열에 의존해야 한다(이 저장소 컨벤션은 메시지 파싱을 금지). 다만 두 엔드포인트가 서로 다른 URL 이라 실무 혼선 가능성은 낮다.
  - 제안: 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 체크리스트에 "`spec/5-system/3-error-handling.md` §1 에러 카탈로그에 `FILE_REQUIRED`·`INVALID_FILE_TYPE` 등재" 항목으로 추적되고 있다 — 이 세션에서 추가 조치는 불필요, planner 턴에서 처리될 항목으로 확인만 함.

- **[INFO]** 실제 구현된 엔드포인트가 제품 spec 문서에는 여전히 "미구현 (Planned)" 로 남아 있음
  - 위치: `spec/2-navigation/9-user-profile.md:334` (표 행), `:136` (아바타 행) — 코드 쪽 대응은 `codebase/backend/src/modules/users/users.controller.ts` `uploadAvatar` (`@Post('me/avatar')`)
  - 상세: API 소비자(프론트엔드)가 제품 spec 만 보면 `POST /users/me/avatar` 가 존재하지 않는다고 오판할 수 있다. `spec/` 쓰기는 `project-planner` 권한이라 이 PR(developer)이 직접 고칠 수 없고, `plan/in-progress/spec-update-avatar-upload-implemented.md` 로 올바르게 위임되어 있다(대상 3문서·엔드포인트 계약 명세·공개 버킷이라는 제품 속성 명시까지 포함). 프로세스상 결함은 없음 — 다음 planner 턴 전까지 spec-코드 간극이 존재한다는 사실만 기록.
  - 제안: 조치 불필요(추적 중). planner 턴에서 `9-user-profile.md` §6.1 에 요청/응답 계약(멀티파트 `file`, 최대 2MB, 허용 확장자, 응답 봉투)이 반영되는지만 후속 확인.

## 그 외 점검 결과 (문제 없음)

- **하위 호환성**: `POST /api/users/me/avatar` 는 완전히 신규·additive 엔드포인트다. 기존 `PATCH /api/users/me`(`UpdateMeDto`)·`User` 엔티티는 이 diff 에서 변경되지 않았고(`git diff origin/main...HEAD` 로 확인, 두 파일 모두 diff 없음), 기존 클라이언트 계약을 깨지 않는다.
- **버전 관리**: 이 저장소에 별도 API 버전 스킴이 없고, 신규 엔드포인트도 기존 미버전 규칙을 그대로 따른다 — 일관성 있음.
- **응답 형식**: `uploadAvatar` 는 `{ data: this.toProfileData(updated) }` 로 `getMe`/`updateMe` 와 동일한 `toProfileData()` 헬퍼를 공유해 응답 스키마가 세 엔드포인트에서 갈리지 않는다. `pendingEmail` 은 `getMe` 에만 스프레드로 덧붙는데, `updateMe`/`uploadAvatar` 모두 동일하게 제외한다 — 일관됨. `@ApiOkWrappedResponse(UserProfileDto, …)` 로 Swagger 문서화도 대응.
- **HTTP 상태 코드**: NestJS 기본 `POST` 는 201 인데, 이 컨트롤러의 다른 5개 POST 와 동일하게 `@HttpCode(HttpStatus.OK)` 를 명시해 200 으로 통일했고, `users-avatar-swagger-sync.spec.ts` 가 `@HttpCode(200)` 메타데이터를 회귀 테스트로 고정한다 — 데코레이터가 지워지면 테스트가 잡는다.
- **에러 응답 형식**: `FILE_REQUIRED`(400)·`INVALID_FILE_TYPE`(400)·`USER_NOT_FOUND`(404) 모두 `{code, message}` 형태로 `BadRequestException`/`NotFoundException` 에 실려 있어, 공용 `http-exception.filter.ts` 가 만드는 `{ error: { code, message, requestId, details? } }` 봉투(spec §2)와 정합한다. `USER_NOT_FOUND` 는 `message` 를 명시해 형제 엔드포인트(`getMe`/`updateMe`/`changePassword`)와 응답 본문을 맞췄다는 주석이 코드에 남아 있다. 파일 크기 초과(413) 매핑은 이 PR 이 새로 만든 경로가 아니라 KB 모듈(`knowledge-base.controller.ts`)과 같은 `http-exception.filter.ts` 의 기존 413 처리 경로(`errStatus === 413` 분기)를 재사용한다.
- **요청 검증**: 파일 부재(`FILE_REQUIRED`) → 확장자 화이트리스트(`hasOwnProperty` 로 prototype pollution 우회 차단, `INVALID_FILE_TYPE`) → 사용자 존재(`USER_NOT_FOUND`) 순으로 검증하고, 검증 실패 시 S3 업로드(부작용)가 발생하지 않는다 — 순서가 올바르다. multer `limits.fileSize` 는 `UsersService.AVATAR_MAX_BYTES` 상수를 직접 참조해 컨트롤러·서비스·Swagger 문서(`최대 2MB`) 세 곳이 `users-avatar-swagger-sync.spec.ts` 로 동기 고정되어 있다(전수 열거 방식이라 값이 갈리면 테스트가 잡음).
- **URL/경로 설계**: `POST /users/me/avatar` 는 이 컨트롤러의 `me/change-password`·`me/email-change/*` 와 동일한 `me/*` 하위 리소스 네이밍을 따른다. 별도 `DELETE`/`GET` 을 신설하지 않고 제거는 기존 `PATCH /users/me`(`avatarUrl` 값 변경)에 위임한 것도 기존 설계(옛 객체 정리 로직 공유)와 일관된다.
- **페이지네이션**: 목록 API 가 아니므로 해당 없음.
- **인증/인가**: 컨트롤러 레벨 `@UseGuards(JwtAuthGuard)` 가 `uploadAvatar` 에도 적용되며, `@CurrentUser()` 의 `payload.sub` 만을 대상 사용자로 사용해(서비스 호출 인자 고정 테스트가 `users.controller.spec.ts` 에 신규 추가됨) 다른 사용자의 아바타를 건드릴 수 없다. 역할 기반 추가 제약이 없는 것도 "본인 프로필 self-service" 라는 형제 엔드포인트들과 동일한 설계다.

## 요약

`POST /api/users/me/avatar` 는 기존 엔드포인트를 변경하지 않는 순수 추가형 API 이며, 응답 봉투·HTTP 상태 코드·에러 코드 구조·요청 검증 순서·인증 적용이 이 컨트롤러의 형제 엔드포인트들과 일관되게 맞춰져 있고, 그 일관성 상당수가 회귀 테스트(Swagger 동기화 스펙·컨트롤러 스펙)로 고정되어 있다. 발견된 두 항목(에러 코드 카탈로그 미등재, 제품 spec 의 "미구현" 배지)은 실제 API 계약 결함이 아니라 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 로 올바르게 위임·추적 중인 문서 동기화 갭이다.

## 위험도

LOW
