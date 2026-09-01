# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** 같은 에러 코드(`USER_NOT_FOUND`)인데 신규 엔드포인트만 `message` 필드가 빠져 응답 본문이 갈린다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:94` (`UsersService.updateAvatar`)
  - 상세: `updateAvatar` 는 사용자 부재 시 `throw new NotFoundException({ code: 'USER_NOT_FOUND' })` 로 `message` 를 생략한다. 같은 컨트롤러의 형제 경로들 — `getMe`(`users.controller.ts` `NotFoundException({code:'USER_NOT_FOUND', message:'User not found'})`), `updateMe`(동일 패턴), `changePassword`(`users.service.ts` 의 `NotFoundException({code:'USER_NOT_FOUND', message:'User not found'})`) — 는 전부 `message` 를 명시한다. NestJS `HttpException.initMessage()` 는 응답 객체에 `message` 가 없으면 클래스명에서 유도한 제네릭 문자열("Not Found")로 대체하고, `GlobalExceptionFilter` 는 그 값을 그대로 클라이언트 `error.message` 로 내보낸다(`common/filters/http-exception.filter.ts:69-72`). 결과적으로 같은 `code:'USER_NOT_FOUND'` 에 대해 엔드포인트마다 `message` 텍스트가 달라진다("User not found" vs "Not Found"). 저장소 규약이 메시지 문자열 파싱을 금지하므로 클라이언트 분기 로직을 깨뜨리지는 않지만, 에러 응답 형식의 일관성이 이 엔드포인트에서만 어긋난다.
  - 제안: `throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' })` 로 형제 경로들과 동일하게 맞춘다.

- **[INFO]** 신규 에러 코드 `FILE_REQUIRED`·`INVALID_FILE_TYPE` 이 아직 중앙 에러 카탈로그에 등재되지 않았다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:77`, `:88` (`UsersService.updateAvatar`)
  - 상세: 두 코드 모두 `spec/5-system/3-error-handling.md` §1 에 없다. 다만 이 갭은 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 할 일 목록에 명시적으로 추적되고 있고(`spec/` 쓰기 권한이 없는 developer 가 planner 트랙으로 정상 위임한 상태), 코드 자체는 `code` 필드를 갖춘 표준 에러 봉투 형태를 지키고 있다. 새로운 결함이라기보다 이미 인지된 문서 부채다.
  - 제안: 별도 조치 불필요 — 해당 planner 항목 처리 시 함께 등재되면 된다.

- **[INFO]** `POST /users/me/avatar` 413 매핑은 검증됨 (참고용, 결함 아님)
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:146-157` (`FileInterceptor` limits) / `:185` (`@ApiPayloadTooLargeResponse`)
  - 상세: `@nestjs/platform-express` 의 `FileInterceptor` 는 `multer` 의 `LIMIT_FILE_SIZE` 에러를 내부적으로 `PayloadTooLargeException`(HttpException, 413) 으로 변환한 뒤(`node_modules/@nestjs/platform-express/multer/multer.utils.js`) 컨트롤러 밖으로 던진다. `GlobalExceptionFilter` 는 `HttpException.getStatus()===413` 을 표준 `{error:{code:'PAYLOAD_TOO_LARGE', ...}}` 봉투로 매핑하므로(`common/filters/http-exception.filter.ts:152-153`), Swagger 문서의 `@ApiPayloadTooLargeResponse` 는 실제 런타임과 일치한다. 확인 목적으로 기록만 남긴다.

## 요약

`POST /api/users/me/avatar` 신설은 API 계약 관점에서 전반적으로 건실하다 — 응답 봉투(`{data:...}`)가 `PATCH /users/me` 와 동일한 헬퍼(`toProfileData`)로 통일돼 있고, `@HttpCode(200)` 을 명시해 Swagger 문서(200)와 런타임이 일치하며, `@ApiBadRequestResponse`/`@ApiPayloadTooLargeResponse`/`@ApiUnauthorizedResponse`/`@ApiNotFoundResponse` 로 에러 케이스가 고루 문서화돼 있고 별도 회귀 테스트(`users-avatar-swagger-sync.spec.ts`)가 Swagger 산문과 상수 드리프트를 고정한다. 인증(`JwtAuthGuard`)·요청 검증(파일 존재·확장자 화이트리스트·크기 상한)도 컨트롤러/서비스 양쪽에서 테스트로 뒷받침된다. 유일한 흠은 신규 엔드포인트의 `NotFoundException` 이 형제 엔드포인트들과 달리 `message` 필드를 생략해 같은 에러 코드에 대해 응답 본문 텍스트가 갈리는 점이며, 이는 기능적 breaking change 는 아니고 사소한 일관성 결함이다. 새 에러 코드의 중앙 카탈로그 미등재는 이미 planner 트랙으로 추적 중이라 별도 조치가 필요 없다. 페이지네이션·버전 관리·URL 설계 항목은 이번 변경과 무관하거나 기존 컨벤션을 그대로 따른다.

## 위험도

LOW
