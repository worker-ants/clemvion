# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `PATCH /api/users/me` 의 Swagger 문서가 `avatarUrl` 변경 시 생기는 새 부작용(이전 S3 아바타 객체 삭제)을 반영하지 않는다.
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:120-129` (`updateMe` 의 `@ApiOperation`/`description`, 특히 123-124줄) — 실제 부작용은 `codebase/backend/src/modules/users/users.service.ts:232`(`update()`)의 신규 정리 로직.
  - 상세: 이 PR 로 `UsersService.update()` 는 `avatarUrl` 이 페이로드에 있고 값이 바뀌면 이전 S3 객체를 best-effort 로 삭제하도록 바뀌었다(`users.service.ts:218-246`). 그런데 `PATCH /users/me` 의 `@ApiOperation.description` 은 여전히 "이름, 언어(locale), 테마, 아바타 URL 중 전달된 필드만 부분 갱신합니다" 로만 서술되어 이 부작용을 알리지 않는다. 클라이언트에게 직접 보이는 응답 형태나 상태 코드는 그대로라 하위 호환성 breaking은 아니지만, 이 엔드포인트를 신뢰하는 외부 통합(예: 아바타 URL을 다른 시스템과 동기화하는 클라이언트)이 "PATCH 로 avatarUrl 을 바꾸면 예전 이미지가 사라질 수 있다"는 사실을 문서에서 알 방법이 없다.
  - 제안: `updateMe` 의 `@ApiOperation.description` 에 "이전에 업로드한 아바타 객체가 있으면 교체 시 정리된다(best-effort)" 정도의 한 줄을 추가한다. 동일한 맥락에서 `spec/5-system/3-error-handling.md` 갱신 계획(아래 항목)과 함께 `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 §6.1 계약 서술에도 이 부작용을 포함시키는 것이 좋다.

- **[INFO]** `UserProfileDto.avatarUrl` 필드 자체의 Swagger 문서에는 "공개 URL(access-control 없음)" 이라는 새 의미가 반영되어 있지 않다.
  - 위치: `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts:15-16` (`avatarUrl?: string | null;`)
  - 상세: `POST /users/me/avatar` 의 `@ApiOperation.description`(`users.controller.ts:159-165`)에는 "URL 을 아는 누구나 접근할 수 있는 공개 오브젝트"라는 설명이 잘 붙어 있다. 하지만 `avatarUrl` 은 `getMe`·`updateMe`·`uploadAvatar` 세 응답이 공유하는 같은 `UserProfileDto` 필드이고, 그 필드 자체의 `@ApiPropertyOptional` 에는 아무 설명이 없다. API 소비자가 `GET /users/me` 응답 스키마만 보고는 이 URL 이 (업로드 경로를 거쳤을 때) 공개 접근 가능하다는 것을 알 수 없다 — 또한 이 필드는 `PATCH /users/me` 로 임의 외부 URL 을 넣을 수도 있어(별개 신뢰 수준), 같은 필드가 두 가지 다른 접근-통제 의미를 가질 수 있다는 점도 스키마에 드러나지 않는다.
  - 제안: `avatarUrl` 필드에 `description: '업로드 경로(POST /users/me/avatar)로 설정된 경우 URL 을 아는 누구나 접근 가능한 공개 오브젝트. PATCH 로 직접 설정한 외부 URL 일 수도 있다.'` 정도를 추가.

- **[INFO]** 신규 에러 코드 `FILE_REQUIRED`·`INVALID_FILE_TYPE` 이 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md`)에 아직 등재되지 않았다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:88`(`FILE_REQUIRED`), `:108`(`INVALID_FILE_TYPE`)
  - 상세: 두 코드 모두 `BadRequestException({ code, message })` 형태로 기존 관례(코드+메시지 동봉, 메시지 문자열 파싱 금지)를 잘 따른다. `INVALID_FILE_TYPE` 은 `knowledge-base.service.ts:928` 과 공유되는 기존 코드라 재사용은 문제 없다. 다만 두 코드가 spec 의 에러 카탈로그에는 아직 없다 — 이 자체는 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md:50-52` 에 planner 후속 작업으로 명시적으로 추적되어 있어 새로 발견된 갭은 아니지만, API 계약 관점에서 "코드-스펙 정합성이 일시적으로 깨진 상태"라는 점은 리뷰 기록에도 남긴다.
  - 제안: 별도 조치 불요(이미 추적 중). 해당 plan 이 완료되기 전까지 이 PR 을 머지해도 계약상 리스크는 낮다(런타임 동작 자체는 올바름).

- **[INFO]** `FileInterceptor` 에 `fileFilter` 가 없어, 허용되지 않는 MIME/확장자 파일도 (최대 2MB까지) 전량 메모리 버퍼링된 뒤에야 서비스 레이어에서 거부된다.
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:143-157` (`@UseInterceptors(FileInterceptor('file', { limits: { fileSize: ... } }))`)
  - 상세: 크기 초과(413)는 multer 스트림 단계에서 조기 차단되지만, 타입 검증(확장자 화이트리스트)은 `UsersService.updateAvatar()` 내부, 즉 버퍼링이 끝난 뒤에 일어난다(`users.service.ts:97-111`). 최종적으로 클라이언트가 받는 응답(`400 INVALID_FILE_TYPE`)은 계약대로 올바르지만, 검증이 요청 처리 파이프라인의 뒷단에서 일어난다는 점만 기록해 둔다 — 계약 위반은 아니고 리소스 사용 관점의 참고 사항.
  - 제안: 필요하면 `FileInterceptor` 의 `fileFilter` 옵션으로 확장자 사전 거부를 추가해 조기 차단할 수 있으나, 현재 2MB 상한이 낮아 실질 리스크는 작다. 이번 PR 범위에서 필수 조치는 아니다.

## 양호한 점 (참고)

- `POST /users/me/avatar` 가 NestJS 기본 201 대신 `@HttpCode(HttpStatus.OK)` 로 이 컨트롤러의 다른 5개 POST 와 동일하게 200 을 명시하고, 회귀 테스트(`users-avatar-swagger-sync.spec.ts`)로 고정했다 — 응답 형식 일관성.
- `USER_NOT_FOUND` 에러 응답이 `getMe`·`updateMe`·`changePassword` 형제 엔드포인트와 동일하게 `{code, message}` 를 모두 싣도록 테스트로 고정됐다 — 에러 응답 일관성.
- 인증은 컨트롤러 클래스 레벨 `@UseGuards(JwtAuthGuard)` 를 그대로 상속하므로 신규 엔드포인트에도 자동 적용되어 인가 누락이 없다. `@Throttle` 미적용은 가장 유사한 형제 엔드포인트(`changePassword`)와도 동일해 새로운 이탈이 아니다.
- 응답 봉투가 `getMe`/`updateMe`/`uploadAvatar` 세 곳에서 `toProfileData()` 헬퍼로 통일되어, 필드 추가 시 세 곳이 개별적으로 갈릴 위험을 없앴다.
- 파일 크기 상한이 컨트롤러(multer `limits.fileSize`)와 서비스(`AVATAR_MAX_BYTES`) 양쪽에서 동일 상수를 직접 참조해 값 drift 가 구조적으로 불가능하다. Swagger 산문(리터럴 "2MB"·확장자 나열)은 별도 회귀 테스트(`users-avatar-swagger-sync.spec.ts`)로 상수와 동기화를 고정했다.
- `POST /api/users/me/avatar` 는 이 컨트롤러의 기존 액션형 엔드포인트 네이밍 관례(`/me/change-password`, `/me/email-change/*`)와 일관된다.

## 요약

이번 변경은 신설 엔드포인트(`POST /api/users/me/avatar`)와 기존 `PATCH /api/users/me` 의 부수 효과 확장(아바타 교체 시 이전 S3 객체 정리)으로 구성된다. 응답 봉투·에러 코드 형태·HTTP 상태 코드·인증 적용은 기존 형제 엔드포인트들과 일관되게 맞춰져 있고 회귀 테스트로 고정돼 있어 계약 위반이나 하위 호환성 breaking은 발견되지 않았다. 남은 항목은 전부 문서화 갭 수준이다 — `PATCH /users/me` 의 새 부작용(아바타 정리)이 Swagger 설명에 반영되지 않은 것(WARNING), `avatarUrl` 필드의 "공개 URL" 의미가 DTO 스키마에 드러나지 않는 것, 신규 에러 코드가 아직 중앙 에러 카탈로그에 없는 것(단, 이미 planner 후속 작업으로 추적 중)이 그것이다. 이들은 클라이언트를 깨뜨리지 않는 문서 정합성 이슈이므로 즉시 차단 사유는 아니다.

## 위험도

LOW
