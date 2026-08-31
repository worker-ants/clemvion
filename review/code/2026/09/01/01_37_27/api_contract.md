# API 계약(API Contract) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 신규 에러 코드 `FILE_REQUIRED`가 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md` §1)에 아직 등재되지 않았다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `updateAvatar` (`throw new BadRequestException({ code: 'FILE_REQUIRED', ... })`)
  - 상세: `grep`으로 확인한 결과 `spec/5-system/3-error-handling.md`, `spec/2-navigation/9-user-profile.md` 어디에도 `FILE_REQUIRED`가 없다. `INVALID_FILE_TYPE`은 `knowledge-base.service.ts`의 기존 코드를 그대로 재사용해 신규 코드가 아니며 상태 코드(400/`BadRequestException`)도 동일해 일관성 문제는 없다. `FILE_REQUIRED`만 이번에 신설된 코드다. 이 갭은 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md`의 할 일 목록("`spec/5-system/3-error-handling.md` §1 에러 카탈로그에 `FILE_REQUIRED`… 등재")에 명시적으로 추적 중이고, `spec/` 쓰기 권한이 없는 developer가 planner 트랙으로 정상 위임한 상태다 — 새로 발견한 결함이 아니라 이미 인지된 문서 부채다.
  - 제안: 별도 조치 불필요 — 해당 planner 항목 처리 시 함께 등재되면 된다.

- **[INFO]** 응답 봉투·상태 코드·인증/인가가 형제 엔드포인트와 일관됨 (참고용, 결함 아님)
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` `uploadAvatar` (`@Post('me/avatar')`)
  - 상세: `getMe`/`updateMe`/`uploadAvatar` 세 메서드가 공용 `toProfileData()` 헬퍼로 `{ data: {...} }` 봉투를 만들어 스키마 드리프트를 구조적으로 막는다. `@HttpCode(HttpStatus.OK)`로 NestJS 기본 201을 명시 200으로 덮어써 이 컨트롤러의 다른 POST 5개와 런타임·Swagger 문서(`@ApiOkWrappedResponse`)가 일치하며, 별도 회귀 테스트(`users-avatar-swagger-sync.spec.ts`, `users.controller.spec.ts` `describe('POST me/avatar 는 200 을 낸다…')`)가 이를 고정한다. 클래스 레벨 `@UseGuards(JwtAuthGuard)`가 신규 엔드포인트에도 자동 적용되고, `@CurrentUser()`의 `payload.sub`만 서비스에 전달해(IDOR 여지 없음) 자기 자신의 아바타만 갱신한다. 확장자 화이트리스트(`Object.prototype.hasOwnProperty` 가드)·파일 크기 상한(multer `limits.fileSize` = 서비스 상수 직접 참조)·`Content-Type`을 클라이언트 `mimetype`이 아닌 서버측 확장자 매핑에서 파생시키는 검증도 요청 검증 관점에서 충분하다. 에러 응답은 400(`FILE_REQUIRED`/`INVALID_FILE_TYPE`)·404(`USER_NOT_FOUND`, `message` 필드 포함해 형제 엔드포인트와 동일 형태)·413(`PAYLOAD_TOO_LARGE`, `GlobalExceptionFilter`의 상태코드 기반 폴백 매핑)·401 모두 e2e(`users-avatar-upload.e2e-spec.ts`)로 실측 확인됐다. `PATCH /users/me`의 기존 `avatarUrl` 문자열 필드(DTO `update-me.dto.ts`, 응답 DTO `user-response.dto.ts`)는 이번 diff에서 전혀 변경되지 않아 하위 호환성 breaking change가 없다.

## 요약

`POST /api/users/me/avatar` 신설은 API 계약 관점에서 건실하다 — 하위 호환성(기존 `PATCH /users/me`의 `avatarUrl` 문자열 계약 무변경), 응답 형식 일관성(공용 `toProfileData` 헬퍼), 에러 응답 형식·HTTP 상태 코드(400/404/413/401 전부 형제 엔드포인트와 동일 패턴, e2e로 실측), 요청 검증(확장자 화이트리스트 + 크기 상한 + Content-Type 서버측 파생), URL 네이밍(`/users/me/*` 기존 네임스페이스 준수), 인증 적용(클래스 레벨 가드) 모두 기존 컨벤션을 그대로 따른다. 페이지네이션·API 버전 관리는 이 변경과 무관하다. 유일하게 남은 항목은 신규 에러 코드 `FILE_REQUIRED`의 중앙 카탈로그 미등재인데, 이는 developer의 `spec/` 쓰기 권한 제약에 따라 이미 planner 트랙(`plan/in-progress/spec-update-avatar-upload-implemented.md`)으로 정상 위임·추적되고 있어 INFO 수준으로만 기록한다. 동시성(lost update)·아키텍처(SSOT 이중 폴백) 등 다른 관점의 결함은 별도 리뷰어(concurrency/architecture) 영역이며, `users.service.ts` 실측 결과 lost-update는 이미 컬럼 단위 `update()`로 수정 완료된 상태다.

## 위험도

LOW
