# API 계약(API Contract) 리뷰

대상: `POST /api/users/me/avatar` 신설(아바타 업로드) + 부수로 `PATCH /api/users/me` 에 추가된
스토리지 정리 side-effect. 관련 인프라/문서 파일(`.env.example`, k8s configmap, docker-compose,
`scripts/minio/*`)은 API 계약 자체보다는 배포 선행 조건이라 별도로 짧게만 언급한다.

## 확인한 것 (문제 없음으로 판정)

- **인증/인가**: `UsersController` 는 클래스 레벨 `@UseGuards(JwtAuthGuard)` (`codebase/backend/src/modules/users/users.controller.ts:62`)를 쓰므로 `uploadAvatar` 도 자동으로 JWT 인증이 걸린다. 대상 사용자도 `@CurrentUser() payload.sub` 로 강제돼(컨트롤러 테스트로 고정) 남의 아바타를 덮어쓸 경로가 없다.
- **응답 형식**: `getMe`/`updateMe`/`uploadAvatar` 셋 다 `toProfileData()` 로 통일된 `{ data: { id, email, name, avatarUrl, locale, theme } }` 봉투를 쓴다(`users.controller.ts:84-93`). `UserProfileDto` 의 `pendingEmail` 이 optional 이라 `uploadAvatar`/`updateMe` 가 그 필드를 생략해도 스키마 위반이 아니다.
- **HTTP 상태 코드**: 다른 POST 액션 엔드포인트와 동일하게 명시 `@HttpCode(200)` 을 걸어 Swagger 문서(200)와 런타임을 일치시켰다(회귀 테스트로 고정: `users-avatar-swagger-sync.spec.ts`). 400(`FILE_REQUIRED`/`INVALID_FILE_TYPE`)·401·404·413 매핑도 적절하다.
- **에러 응답 봉투 일관성 실측**: `multer` 의 `LIMIT_FILE_SIZE` 는 `@nestjs/platform-express` 의 `transformException` 이 `PayloadTooLargeException`(NestJS `HttpException`)으로 변환하고(`node_modules/@nestjs/platform-express/multer/multer/multer.utils.js`), 이건 `GlobalExceptionFilter` 의 `HttpException` 분기를 그대로 타 `{error:{code:'PAYLOAD_TOO_LARGE',message,requestId}}` 표준 봉투로 나간다 — 별도 예외 경로 없이 기존 규약과 일치.
- **요청 크기 한도 간섭 없음**: `main.ts` 의 전역 100KB 본문 파서(`createGlobalBodyParsers`)는 `json()`/`urlencoded()` 뿐이라 `multipart/form-data` 요청에는 관여하지 않는다(콘텐츠 타입 불일치 시 body-parser 는 스트림을 건드리지 않고 `next()`). 2MB 아바타 업로드가 이 전역 100KB 방어선과 충돌하지 않음을 소스로 확인.
- **필드/문서 동기화**: multer `limits.fileSize` 가 `UsersService.AVATAR_MAX_BYTES` 를 직접 참조(리터럴 중복 없음), Swagger 산문의 "2MB"·확장자 목록은 전수 대조 테스트(`users-avatar-swagger-sync.spec.ts`)로 상수와 고정돼 있다.
- **에러 코드 재사용**: `INVALID_FILE_TYPE` 은 `knowledge-base.service.ts` 와 같은 코드·메시지 포맷(`Only X, Y … are allowed`)을 재사용한다 — 불필요한 신규 코드 중복 없음.
- **하위 호환성**: 기존 `PATCH /api/users/me` 의 요청/응답 스키마·`@IsUrl` 검증은 그대로이며, `getMe`/`updateMe` 리팩터(`toProfileData` 추출)도 출력 필드 집합이 동일해 회귀 없음.

## 발견사항

- **[INFO]** 신규 에러 코드 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 이 아직 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md` §1)에 등재되지 않았다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:84-91`(FILE_REQUIRED), `:106-111`(INVALID_FILE_TYPE)
  - 상세: 두 코드 모두 구조화된 `{code, message}` 형태로 일관성 있게 던져지고 있어 클라이언트 계약 자체는 문제없다. 다만 API 전체 에러 코드 SoT 가 spec 카탈로그인데, 거기 아직 없다.
  - 제안: 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 planner 트랙 to-do 로 등재돼 있으므로 새 조치는 불필요 — 그 항목이 정리될 때까지 계약 자체는 유효하다는 점만 확인.

- **[INFO]** 파일 내용 검증이 확장자(파일명) 기반뿐이고 매직바이트(실제 이미지 시그니처) 검증이 없다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `UsersService.updateAvatar` (확장자 화이트리스트 분기)
  - 상세: `Content-Type` 을 서버가 확장자에서 강제로 파생시키므로(`text/html` 저장형 XSS 표면은 이미 차단) 심각도는 낮다. 다만 `.png` 확장자를 붙인 비-이미지 바이너리가 `image/png` 로 그대로 공개 서빙될 수 있다 — 순수 API 계약(요청 검증 완전성) 관점의 잔여 갭으로 기록.
  - 제안: 우선순위 낮음. 필요 시 첫 바이트 시그니처 검사를 추가 축으로 고려.

- **[INFO]** `PATCH /api/users/me` 에 추가된 "값이 바뀌면 옛 S3 객체를 정리한다" 부수효과는 Swagger `description` 에는 반영됐지만(`codebase/backend/src/modules/users/users.controller.ts:121-128`), `spec-update-avatar-upload-implemented.md` 의 정정 대상 목록은 **신규 POST 엔드포인트 계약**만 명시하고 이 PATCH 쪽 부수효과 문서화는 항목화돼 있지 않다.
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:121-128` (Swagger 설명, 이미 반영됨) / `plan/in-progress/spec-update-avatar-upload-implemented.md` "할 일" 목록 (PATCH 쪽 누락)
  - 상세: `/docs` 를 통해 노출되는 실제 계약(OpenAPI)은 이미 정확하므로 클라이언트에 미치는 영향은 없다. spec 문서(`9-user-profile.md`)가 PATCH 엔드포인트의 이 side-effect를 함께 서술하지 않으면, 이후 이 계약을 spec 만 보고 파악하려는 사람이 놓칠 수 있다.
  - 제안: planner 트랙 to-do 에 `PATCH /api/users/me` 의 스토리지 정리 부수효과 한 줄 추가 검토(작은 보강, 이 PR 을 막을 사유는 아님).

## 요약

신설된 `POST /api/users/me/avatar` 는 인증(클래스 레벨 JwtAuthGuard)·응답 봉투(`toProfileData` 공유)·에러 상태 코드(400/401/404/413)·Swagger 문서(2MB·확장자 목록 자동 동기화 테스트로 고정)·본문 크기 파서 경계(전역 100KB JSON 파서와 무간섭 확인)까지 API 계약 8개 관점에서 실측 가능한 부분은 모두 기존 형제 엔드포인트와 일관되게 구현돼 있다. `PATCH /api/users/me` 에 추가된 스토리지 정리 부수효과도 응답 스키마를 바꾸지 않고 Swagger 설명으로 문서화돼 하위 호환성을 해치지 않는다. 남은 항목은 전부 이미 낮은 심각도이거나(매직바이트 미검증) 이미 planner 트랙에 추적 중인(에러 카탈로그 등재) 사안이라 신규 차단 사유가 없다.

## 위험도

LOW
