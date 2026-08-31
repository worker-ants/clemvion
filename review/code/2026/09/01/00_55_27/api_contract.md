# API 계약(API Contract) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 신규 에러 코드(`FILE_REQUIRED`, `INVALID_FILE_TYPE`)가 중앙 에러 카탈로그에 아직 미등재
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `updateAvatar()` — `BadRequestException({ code: 'FILE_REQUIRED', ... })` / `BadRequestException({ code: 'INVALID_FILE_TYPE', ... })`
  - 상세: `spec/5-system/3-error-handling.md` §1 에러 카탈로그에 두 코드 모두 등재돼 있지 않다(직접 grep 확인, 0건). `INVALID_FILE_TYPE` 은 `knowledge-base.service.ts:928` 가 이미 같은 문자열 코드를 쓰고 있어 재사용 자체는 기존 관례와 일치한다. 응답 본문은 표준 `{ error: { code, message, requestId } }` 봉투를 그대로 따르므로 런타임 계약 위반은 아니고, 카탈로그 문서 갭이다. 이 갭은 `plan/in-progress/spec-update-avatar-upload-implemented.md` "같은 사실을 말하는 다른 SoT 문서" 섹션에 `spec/5-system/3-error-handling.md` §1 등재 항목으로 이미 명시적으로 추적 중이다(spec 쓰기 = planner 트랙, CLAUDE.md 권한 경계 준수).
  - 제안: 조치 불필요(이미 추적됨). 그 plan 항목이 이행되기 전까지는 API 소비자가 카탈로그만 보고는 이 두 코드를 찾지 못한다는 점만 참고.

- **[INFO]** 신규 엔드포인트가 spec 문서(`9-user-profile.md`)에는 아직 "미구현 (Planned)" 로 남아 있다
  - 위치: `spec/2-navigation/9-user-profile.md:334` (`~~POST~~ ~~/api/users/me/avatar~~ … 미구현 (Planned)`), `:136`
  - 상세: 실제 코드는 `POST /api/users/me/avatar` 를 구현했지만 spec 배지 flip 은 `spec/` 쓰기라 별도 planner 트랙(`plan/in-progress/spec-update-avatar-upload-implemented.md`)으로 분리돼 있다. 그 plan 문서에는 §6.1 엔드포인트 계약(멀티파트 필드명·2MB 상한·허용 확장자·응답 봉투)까지 명시하도록 할 일이 이미 적혀 있어 후속 조치가 비어 있지 않다. CHANGELOG 항목도 이 지연을 스스로 disclose 한다.
  - 제안: 조치 불필요 — 정상적인 프로세스 지연이며 이미 추적 중이다.

- **[INFO]** `avatarUrl` 필드에 값을 넣는 두 경로(신뢰 수준이 다름)가 공존한다 — 계약 위반이 아니라 사용자 결정에 의한 의도된 설계
  - 위치: `codebase/backend/src/modules/users/dto/update-me.dto.ts` (`avatarUrl?: string`, `@IsUrl({ require_tld: false })` — 임의 외부 URL 허용) vs `codebase/backend/src/modules/users/users.controller.ts` `uploadAvatar()`(서버가 S3 공개 URL 을 생성해 같은 필드에 씀)
  - 상세: `PATCH /api/users/me` 는 여전히 클라이언트가 임의의 외부 URL 문자열을 `avatarUrl` 에 직접 넣을 수 있고, 새 `POST /api/users/me/avatar` 는 서버가 만든 S3 공개 URL 로 같은 필드를 덮어쓴다. 두 응답 스키마(`UserProfileDto`)는 동일하므로 클라이언트 입장에서 형태 불일치는 없다. `users-avatar.service.spec.ts` 의 "외부 URL(우리가 올린 것이 아님)은 건드리지 않는다" 테스트가 이 공존을 전제로 옛 객체 정리 로직을 정확히 분기시킨다.
  - 제안: 조치 불필요.

## 그 외 점검 결과 (문제 없음)

- **하위 호환성**: `POST /api/users/me/avatar` 는 순수 신설 엔드포인트이고 기존 `PATCH /api/users/me` 의 `avatarUrl` 문자열 경로는 그대로 유지된다. `s3.config.ts` 의 신규 `publicBaseUrl` 필드도 `S3_PUBLIC_BASE_URL` 미설정 시 `S3_ENDPOINT` → `localhost` 순으로 폴백해 기존 배포 환경 설정을 깨지 않는다(k8s `base/configmap.yaml`·overlay 3종·`.env.example`·`README.md` 모두 새 키를 additive 로만 추가). 기존 클라이언트에 영향 없는 순수 additive 변경.
- **버전 관리**: 이 앱은 URL 버저닝(`/v1` 등)을 쓰지 않는 기존 컨벤션(`app.setGlobalPrefix('api')`)을 그대로 따른다. 이 PR 이 새로 벗어나지 않는다.
- **응답 형식**: `uploadAvatar` 는 `getMe`/`updateMe` 와 동일한 `toProfileData()` 헬퍼로 `{ data: UserProfileDto }` 봉투를 만든다(`pendingEmail` 미포함까지 동일). `@ApiOkWrappedResponse(UserProfileDto)` 로 Swagger 스키마도 형제 엔드포인트와 일치. `users.controller.spec.ts` 신규 테스트가 이 대칭을 명시적으로 고정한다.
- **에러 응답**: `FILE_REQUIRED`/`INVALID_FILE_TYPE`(400), `USER_NOT_FOUND`(404, `code`+`message` 모두 실어 형제 엔드포인트와 응답 본문 동일 — `users-avatar.service.spec.ts` 회귀로 고정), 파일 크기 초과(413)까지 전부 저장소의 기존 에러 봉투 컨벤션(`{ error: { code, message, requestId } }`)을 따른다. 413 경로는 `@nestjs/platform-express` `FileInterceptor` 의 `transformException` 이 multer `LIMIT_FILE_SIZE` 를 `PayloadTooLargeException` 으로 변환하고, `GlobalExceptionFilter` 가 이를 표준 봉투로 매핑함을 노드모듈 소스로 직접 확인했다(`node_modules/.pnpm/@nestjs+platform-express.../multer/multer/multer.utils.js`) — CHANGELOG 의 "multer 는 스트림 단계에서 끊어 413 을 낸다" 주장과 일치. e2e 스펙(`users-avatar-upload.e2e-spec.ts`)이 400 응답의 `error.code === 'INVALID_FILE_TYPE'` 를 실 HTTP 레벨에서 검증.
- **요청 검증**: 파일 부재(`!file?.buffer?.length` — 파일 자체 부재와 빈 버퍼 두 조건 모두 검사), 확장자 화이트리스트(`hasOwnProperty` 로 프로토타입 체인 우회 차단, `constructor`/`__proto__` 케이스까지 테스트로 고정), 크기 상한(컨트롤러 `FileInterceptor` limits 가 서비스 상수 `AVATAR_MAX_BYTES` 를 직접 참조해 드리프트 불가) 모두 유닛/e2e 양쪽에서 커버됨. `users-avatar-swagger-sync.spec.ts`(신규)는 Swagger 산문에 손으로 적힌 "2MB"·확장자 나열이 실제 상수와 갈리지 않도록 전수 대조한다.
- **URL/경로 설계**: `POST /users/me/avatar` 는 `/users/me/change-password`, `/users/me/email-change/*` 등 같은 컨트롤러의 기존 네이밍 관례(`/users/me` 하위에 동사성 하위 자원)를 그대로 따른다.
- **페이지네이션**: 해당 없음(단일 리소스 업로드 엔드포인트, 목록 API 아님).
- **인증/인가**: 컨트롤러 클래스 레벨 `@UseGuards(JwtAuthGuard)` 가 상속되어 `uploadAvatar` 에도 적용된다. `@CurrentUser()` payload 의 `sub` 를 그대로 서비스에 넘겨 본인 계정만 갱신함을 `users.controller.spec.ts` 신규 테스트("다른 사용자의 id 를 쓰면 남의 아바타를 덮어쓴다")가 고정한다. 전역 `UserThrottlerGuard`(100req/min, 사용자 단위)가 별도 opt-out 없이 그대로 적용된다.

## 라운드 간 회귀 확인

이 리뷰는 7번째 라운드다. 직전 라운드(`review/code/2026/09/01/00_35_24/api_contract.md`)가 남긴 WARNING 2건(다른 카테고리 소관 — `ExpressNS` 주석 중복, `main.ts` 부팅 경고 배선 미검증)은 API 계약 자체의 결함은 아니었지만, 커밋 `4d32e0734`("리뷰 6R — 부팅 경고 판정을 순수 함수로")로 `shouldWarnPublicBaseIsPrivate`/`resolvePublicBaseUrl` 이 `s3.config.ts` 로 추출되고 `s3.config.spec.ts` 가 `production`+사설호스트 조합·기본값 케이스·`REPLACE_ME` sentinel 비경고 케이스까지 전수 테스트로 고정한 상태를 직접 확인했다. `users.controller.ts:53-60` 의 `ExpressNS` 주석도 현재 단일 문단으로 정리돼 있다. API 계약 관점에서 새로 발생한 회귀는 없다.

## 요약

`POST /api/users/me/avatar` 신설은 기존 `/users/me` 계열 엔드포인트들의 응답 봉투·에러 코드 형식·HTTP 상태 코드(명시 200)·인증 가드 적용 방식을 정확히 재사용해 계약 일관성을 해치지 않는다. 확장자 화이트리스트·파일 부재/빈 버퍼 검증·크기 상한(413 매핑까지 노드모듈 소스로 직접 검증)·응답 스키마 동기화(Swagger↔상수 전수 대조 신규 테스트)가 유닛·e2e 양쪽에서 이중으로 고정되어 있다. 발견된 사항은 전부 이미 인지되고 별도 plan 문서(`spec-update-avatar-upload-implemented.md`)로 추적 중인 문서화 지연(에러 카탈로그 미등재, spec 배지 미반영)이며 코드 자체의 계약 결함은 아니다. `PATCH /users/me` 의 외부 URL 경로와 신규 업로드 경로가 같은 `avatarUrl` 필드를 공유하는 구조도 CHANGELOG 에 명시적으로 disclose 된 의도된 설계다. 직전 라운드가 남긴 비-API-계약 WARNING 2건도 이후 커밋에서 해소된 상태를 직접 확인했다.

## 위험도

LOW
