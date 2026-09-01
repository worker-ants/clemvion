# API 계약(API Contract) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 신규 에러 코드 `FILE_REQUIRED`·`INVALID_FILE_TYPE` 이 아직 중앙 에러 카탈로그에 등재되지 않았다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `updateAvatar` (`throw new BadRequestException({ code: 'FILE_REQUIRED', ... })` / `code: 'INVALID_FILE_TYPE'`)
  - 상세: `spec/5-system/3-error-handling.md` §1 에 두 코드가 없다. 다만 이 갭은 `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 할 일 목록에 명시적으로 추적 중이고(`spec/` 쓰기 권한이 없는 developer 가 planner 트랙으로 정상 위임), 코드 자체는 `{code, message}` 표준 에러 봉투 형태를 지킨다. e2e(`codebase/backend/test/users-avatar-upload.e2e-spec.ts`)가 `error.code === 'INVALID_FILE_TYPE'` 을 실측으로 고정해 두었다. 새 결함이 아니라 이미 인지된 문서 부채다.
  - 제안: 별도 조치 불필요 — 해당 planner 항목 처리 시 함께 등재되면 된다.

- **[INFO]** `USER_NOT_FOUND` 응답이 형제 엔드포인트(`getMe`/`updateMe`/`changePassword`)와 `{code, message}` 형태로 이미 일치한다 (참고용, 결함 아님)
  - 위치: `codebase/backend/src/modules/users/users.service.ts:122-127` (`updateAvatar` 의 `NotFoundException`)
  - 상세: 초기 라운드에서 `message` 필드 누락이 지적됐던 이력이 있으나(`codebase/backend/src/modules/users/users-avatar.service.spec.ts:455-486` 가 `code`+`message` 동시 포함을 회귀 고정), 현재 코드는 형제 엔드포인트와 동일하게 `message: 'User not found'` 를 싣는다. 응답 형식 일관성 문제가 해소된 상태임을 확인 목적으로 기록한다.

- **[INFO]** 413(`PayloadTooLargeException`)·400(`INVALID_FILE_TYPE`)·200 세 경로 모두 실제 HTTP 응답까지 e2e 로 검증됨 (참고용, 결함 아님)
  - 위치: `codebase/backend/test/users-avatar-upload.e2e-spec.ts:101-133` (400/413 케이스), `codebase/backend/src/common/filters/http-exception.filter.ts` (봉투 매핑)
  - 상세: `@nestjs/platform-express` 의 `FileInterceptor` 는 multer `LIMIT_FILE_SIZE` 를 `PayloadTooLargeException`(413, `HttpException` 서브클래스)으로 변환하고(`node_modules/@nestjs/platform-express/multer/multer/multer.utils.js`), `GlobalExceptionFilter` 가 이를 표준 `{error:{code:'PAYLOAD_TOO_LARGE', message, requestId}}` 봉투로 매핑한다. `@ApiPayloadTooLargeResponse({description:'파일 크기 초과 (2MB)'})` 문서와 런타임이 실측으로 일치.

## 점검 관점별 요약

1. **하위 호환성**: `POST /api/users/me/avatar` 는 신설 엔드포인트이고, 기존 `GET /users/me`·`PATCH /users/me`(외부 URL 문자열 방식) 는 시그니처·응답 형태 변경 없이 그대로 공존한다. Breaking change 없음. `S3_PUBLIC_BASE_URL` 신규 env 는 미설정 시 `S3_ENDPOINT` 로 폴백하는 옵셔널 설정이라 배포 계약을 깨지 않는다(다만 폴백이 `localhost` 로 떨어지면 응답의 `avatarUrl` 값 자체가 브라우저에서 도달 불가능해질 수 있다는 점은 `main.ts` 부팅 경고 + k8s prod/staging overlay 패치로 이미 완화되어 있다 — API 계약 위반은 아니고 배포 설정 문제).
2. **버전 관리**: 이 저장소 전체가 URL 버저닝(`/v1` 등)을 쓰지 않는 기존 컨벤션을 그대로 따른다 — 이번 변경이 새로 벗어난 지점 없음.
3. **응답 형식**: `uploadAvatar` 응답은 `getMe`/`updateMe` 와 동일한 `{data: toProfileData(user)}` 봉투를 공유 헬퍼(`UsersController.toProfileData`, `users.controller.ts:87-96`)로 통일했고 `UserProfileDto` 스키마와 일치한다(`pendingEmail` 미포함도 `updateMe` 와 동일 — `users.controller.spec.ts:434-449` 로 회귀 고정).
4. **에러 응답**: `{error:{code, message, requestId}}` 표준 봉투를 그대로 따른다. 400(`FILE_REQUIRED`/`INVALID_FILE_TYPE`)·401(`JwtAuthGuard`)·404(`USER_NOT_FOUND`)·413(멀터 크기 초과) 네 상태 모두 형제 엔드포인트와 같은 매핑 방식이며, `USER_NOT_FOUND` 메시지 일관성 이슈는 이미 해소됨(위 INFO 참고).
5. **요청 검증**: 파일 부재(`!file?.buffer?.length` — 파일 자체 부재와 빈 버퍼 둘 다 커버)·확장자 화이트리스트(`hasOwnProperty` 로 프로토타입 체인 우회 차단)·크기 상한(컨트롤러 데코레이터가 서비스 상수를 직접 참조해 드리프트 불가) 세 축 모두 유닛(`users-avatar.service.spec.ts`)·e2e 양쪽에서 검증된다.
6. **URL/경로 설계**: `POST /users/me/avatar` 는 같은 컨트롤러의 `POST /users/me/change-password`, `POST /users/me/email-change/*` 와 동일한 "`/users/me/<action>`" 네이밍 패턴을 따른다. RESTful 순수 리소스 CRUD 는 아니지만 기존 컨벤션과 일치한다.
7. **페이지네이션**: 해당 없음 — 목록 API 가 아니다.
8. **인증/인가**: 컨트롤러 레벨 `@UseGuards(JwtAuthGuard)` 가 `uploadAvatar` 에도 적용된다(엔드포인트별 예외 데코레이터 없음). 인가는 `payload.sub`(JWT subject)를 그대로 대상 사용자로 사용해 본인 리소스에만 쓰기가 가능하고, 컨트롤러 위임 인자가 정확한지는 `users.controller.spec.ts:427-432` 로 고정되어 있다.

## 요약

`POST /api/users/me/avatar` 신설은 API 계약 관점에서 건실하다. 응답 봉투·에러 봉투 모두 기존 `/users/me/*` 형제 엔드포인트들과 동일한 형태를 유지하고, `@HttpCode(200)` 명시로 Swagger 문서와 런타임이 일치하며(`users-avatar-swagger-sync.spec.ts` 가 데코레이터 소실을 회귀 방지), 요청 검증(파일 존재·확장자·크기)과 상태 코드 매핑(400/401/404/413)이 유닛+e2e 양쪽에서 실측 검증되어 있다. 기존 `GET/PATCH /users/me` 는 변경되지 않아 하위 호환성 문제가 없다. 유일하게 남은 항목은 신규 에러 코드 2종(`FILE_REQUIRED`, `INVALID_FILE_TYPE`)의 중앙 에러 카탈로그 미등재인데, 이는 이미 planner 트랙 plan 문서에 명시적으로 추적되고 있어 이번 리뷰에서 새로 조치할 사항은 아니다. URL 설계·페이지네이션·버전 관리 항목은 기존 컨벤션을 그대로 따르거나 해당 사항이 없다.

## 위험도

LOW
