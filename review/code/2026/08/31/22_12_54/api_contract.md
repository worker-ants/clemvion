# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `POST /users/me/avatar` 의 실제 HTTP 상태 코드가 문서화된 200 이 아니라 **201** 이 된다 — 같은 파일의 모든 자매 `POST` 엔드포인트와 규약이 어긋난다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:140` (`uploadAvatar`, `@Post('me/avatar')` 데코레이터부터 `async uploadAvatar(...)` 시그니처까지, gate 140–181) — 대조군: `:195-196`(`changePassword`), `:250-251`(`requestEmailChange`), `:283-284`(`verifyEmailChange`), `:327-328`(`resendEmailChange`), `:346-347`(`cancelEmailChange`) 전부 `@Post(...)` 바로 다음 줄에 `@HttpCode(HttpStatus.OK)` 를 붙인다.
  - 상세: NestJS 는 `@HttpCode` 가 없으면 `@Post()` 핸들러의 기본 상태를 **201 Created** 로 응답한다. `uploadAvatar` 는 이 컨트롤러에서 `@HttpCode` 를 생략한 **유일한** `@Post` 핸들러다 — 나머지 다섯 개는 전부 명시적으로 200 을 강제한다. 그런데 응답 데코레이터는 `@ApiOkWrappedResponse(UserProfileDto, ...)` 를 쓰는데, 이는 내부적으로 `ApiOkResponse`(`codebase/backend/src/common/swagger/api-wrapped.ts:140`)를 호출해 Swagger 문서에 **200** 을 명시한다. 즉 Swagger 계약(200)과 런타임 실제 응답(201)이 어긋난다. `getMe`/`updateMe` 등 같은 "프로필 봉투" 패밀리 엔드포인트도 전부 200 이라, 이 엔드포인트만 클라이언트가 `response.status === 200` 로 성공을 분기하면(혹은 OpenAPI 로 생성한 타입드 클라이언트가 200 스키마만 인식하면) 실패로 오인될 수 있다.
  - 제안: `@Post('me/avatar')` 다음 줄에 `@HttpCode(HttpStatus.OK)` 를 추가해 자매 엔드포인트·Swagger 문서와 실제 동작을 일치시킨다.

- **[WARNING]** 파일 누락과 허용되지 않는 확장자가 **같은 에러 코드** `INVALID_FILE_TYPE` 를 공유해 클라이언트가 `error.code` 만으로 두 실패를 구분할 수 없다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:70-75`(파일 누락 — `'Avatar image file is required'`) 와 `:81-86`(확장자 불허 — `'Only ... images are allowed'`) — 둘 다 `code: 'INVALID_FILE_TYPE'`.
  - 상세: 이 저장소의 에러 코드 규약(`spec/conventions/error-codes.md §1`)은 *"클라이언트는 코드의 의미로 분기하며 메시지 문자열을 파싱하지 않는다"* 를 원칙으로 한다. 그런데 "파일을 아예 안 보냄"과 "지원하지 않는 형식의 파일을 보냄"은 사용자에게 보여줄 안내 문구가 달라야 하는 서로 다른 사용자 행동을 요구하는 실패인데도 같은 코드를 낸다. 클라이언트가 이 둘을 구분하려면 `message` 자유 텍스트를 파싱해야 하는데, 그건 이 저장소가 스스로 금지하는 패턴이다.
  - 제안: 파일 누락 케이스에 별도 코드(예: `FILE_REQUIRED` 또는 `MISSING_AVATAR_FILE`)를 신설하거나, 두 케이스 모두를 감싸는 상위 개념이 실제로 의도된 것이라면 그 판단을 spec(`error-handling.md §1` 카탈로그)에 명시한다.

- **[WARNING]** `PATCH /users/me` 로 `avatarUrl` 을 외부 URL로 교체하면, 직전에 `POST /users/me/avatar` 로 올려둔 S3 객체가 정리되지 않고 영구히 고아로 남는다 — 같은 필드(`avatarUrl`)를 쓰는 두 엔드포인트의 부수효과가 비대칭이다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:161-164`(`update()` — `PATCH /users/me` 가 호출하는 범용 갱신, S3 정리 호출 없음) vs `:66-102`(`updateAvatar()` — `deletePreviousAvatarObject` 호출).
  - 상세: `updateAvatar()` 는 교체 시 옛 S3 객체를 (best-effort로) 지우도록 신경 써서 구현됐다(CHANGELOG·테스트가 이 축을 명시적으로 고정). 그런데 `avatarUrl` 을 바꿀 수 있는 또 다른 유일한 진입점인 `PATCH /users/me`(`UpdateMeDto.avatarUrl`, `users.service.ts:161` `update()`)는 순수 `repository.update()` 만 호출해 이런 정리 로직이 전혀 없다. 그 결과: 사용자가 (1) `POST /avatar` 로 이미지를 올린 뒤 (2) `PATCH /users/me` 로 `avatarUrl` 을 다른 URL(외부 이미지 또는 빈 문자열)로 바꾸면, 1단계에서 만든 S3 객체는 어느 경로로도 지워지지 않는다. 기능은 정상 동작하지만(오브젝트 URL이 노출되거나 API 응답이 깨지는 것은 아님) 이는 이 PR 이 스스로 강조한 *"동작은 하는데 잘못된 채로 동작"* 위험 클래스와 정확히 같은 성격의 잔여 갭이다 — 다만 스토리지 누수(과금·용량) 방향으로.
  - 제안: `PATCH /users/me` 경로에서도 `avatarUrl` 변경 시 동일한 `deletePreviousAvatarObject` 를 호출하도록 통합하거나, 최소한 이 비대칭을 plan/spec(트래커)에 알려진 갭으로 명시적으로 등재한다.

- **[INFO]** `getMe`/`updateMe`/`uploadAvatar` 세 핸들러가 같은 "프로필 봉투" 응답을 각자 손으로 조립하고 있어, 필드 셋이 서서히 갈라질 위험이 있다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:93-105`(`getMe`, `pendingEmail` 포함) vs `:127-137`(`updateMe`, `pendingEmail` 없음) vs `:181-192`(`uploadAvatar`, 역시 `pendingEmail` 없음).
  - 상세: 셋 다 `@ApiOkWrappedResponse(UserProfileDto, ...)` 로 같은 응답 타입을 선언하지만 실제로 채우는 필드 집합은 다르다(`pendingEmail` 은 `getMe` 에만 존재). `pendingEmail` 이 DTO 상 optional(`pendingEmail?: string | null`)이라 스키마 위반은 아니지만, 새 엔드포인트가 이 패턴을 세 번째로 복제해 향후 필드 추가 시 세 곳을 手동 동기화해야 하는 표면을 넓혔다.
  - 제안: 공용 `toProfileResponse(user)` 매핑 함수로 추출해 세 핸들러가 공유하게 하면, 신규 필드 추가 시 자동으로 세 응답 모두에 반영된다.

- **[INFO]** 신규 에러 코드 `INVALID_FILE_TYPE` 이 아직 에러 카탈로그(spec)에 등재돼 있지 않다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:71`, `:83` (코드 발행부) — 카탈로그 SoT 는 `spec/5-system/3-error-handling.md §1`(`spec/conventions/error-codes.md §Overview` 가 이 문서를 SoT 로 지목).
  - 상세: `avatarUrl` 검증 실패에 대해 `USER_NOT_FOUND` 는 기존 카탈로그 패턴을 따르지만, `INVALID_FILE_TYPE` 은 이번 PR 이 처음 발행하는 신규 코드다. 함께 올라온 `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 할 일 목록은 "§6.1 엔드포인트 계약"만 언급하고 에러 카탈로그 등재를 명시적으로 항목화하지 않았다.
  - 제안: 해당 planner 작업(`spec-update-avatar-upload-implemented.md`)의 할 일에 "`INVALID_FILE_TYPE` 을 `3-error-handling.md §1` 카탈로그에 등재" 를 명시적으로 추가한다.

## 검증용 뮤테이션

이 리뷰는 코드 수정 없이 정적 분석 + node_modules 내 `@nestjs/platform-express` 소스 확인(멀티파트 파일 크기 초과 시 `PayloadTooLargeException` 으로 매핑되는지, `GlobalExceptionFilter` 가 이를 표준 `{error:{code,message,requestId}}` 봉투로 감싸는지)만으로 수행했다. 저장소 파일은 전혀 수정하지 않았다 (`git status --short` 로 확인할 변경 없음).

## 요약

신규 `POST /api/users/me/avatar` 엔드포인트는 기존 API 를 깨지 않는 순수 추가(backward-compatible addition)이고, 인증(`JwtAuthGuard` 상속)·RESTful 경로 설계(`me` 하위 리소스)·요청 검증(확장자 화이트리스트·크기 제한을 컨트롤러와 서비스가 같은 상수로 공유)·Swagger 문서화(멀티파트 스키마·400/413/401/404 응답)는 대체로 견고하다. 다만 (1) 이 파일의 다른 모든 `POST` 핸들러와 달리 `@HttpCode(HttpStatus.OK)` 가 누락돼 실제 응답이 Swagger 가 약속하는 200 이 아니라 201 이 되는 점, (2) 서로 다른 실패 원인(파일 부재 vs 형식 불허)이 같은 에러 코드를 공유해 클라이언트 분기를 방해하는 점, (3) `PATCH /users/me` 와 `POST /users/me/avatar` 가 같은 `avatarUrl` 필드를 쓰면서도 정리(cleanup) 부수효과가 비대칭이라 스토리지 고아 객체가 생길 수 있는 점은 API 계약 관점에서 고쳐야 할 실질적 결함이다. CRITICAL 은 없다.

## 위험도
MEDIUM
