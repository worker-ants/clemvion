# 정식 규약 준수 검토 — avatar-upload-public-url

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
`spec/5-system/` 자체의 diff 는 0파일(정상 — 이번 PR 은 code-only). 검토는 **구현 diff(15개
파일/1977줄, `POST /users/me/avatar` 아바타 업로드)가 이미 존재하는 `spec/5-system/`·
`spec/conventions/` 의 정식 규약을 지키는가**를 실측했다(워킹트리 절대경로 직접 Read +
node_modules 소스 추적 포함).

## 발견사항

- **[WARNING] `@ApiOperation.description` 길이 강제(50~150자) 초과 — 2건**
  - target 위치: `codebase/backend/src/modules/users/users.controller.ts` — `updateMe`(`PATCH
    /users/me`) 및 신설 `uploadAvatar`(`POST /users/me/avatar`)의 `@ApiOperation({ description })`
  - 위반 규약: `spec/conventions/swagger.md` §3 "길이 — 강제되는 것과 지향하는 것을 가른다" 표
    — "엔드포인트 `description` | 50~150자 | **강제**"(DTO `description` 과 달리 이 항목은
    2026-08-23 개정에서도 지향이 아니라 강제로 **유지**됐다)
  - 상세: 실측 글자수(`len()`) —
    - `updateMe`: 이번 PR 전 **107자**(강제 범위 내, 준수) → 이번 PR 이 아바타 정리 서술을
      추가하며 **202자**로 확장(35% 초과).
    - `uploadAvatar`(신설): **170자**(13% 초과).
    두 문구 모두 실제로는 보안·부수효과 정보(아바타 교체 시 스토리지 best-effort 정리,
    공개 URL·UUID 추측 불가능성)를 담고 있어 — swagger.md §3 이 **DTO 필드**에는 이미
    "보안·정책 캐비엇은 길이를 이유로 줄이지 않는다"는 예외를 인정한 것과 같은 클래스의
    정보다. 다만 그 예외는 문면상 DTO `description` 에만 적용되고 엔드포인트
    `description` 에는 적용되지 않는다.
  - 제안: (a) 코드 쪽에서 150자 이내로 압축하거나 상세를 spec 링크로 옮긴다(단, 두 문구
    모두 "왜 이 필드가 위험한가"류 정보라 축약이 손실을 만들 수 있다), 또는 (b) DTO
    `description` 에 이미 적용된 "보안·정책 캐비엇은 길이 예외" 논리를 swagger.md §3 표에
    **엔드포인트 `description` 까지 명시적으로 확장**한다(§Rationale "DTO 길이는 왜 강제가
    아닌가"가 쓴 논거가 그대로 적용된다). 규약을 갱신하지 않고 그대로 둘 경우, 다음
    작성자가 같은 자리에서 같은 위반을 반복한다.

- **[WARNING] multer 기반 413 이 `error-handling.md §1.3` 의 CWE-209 고정 문구 계약을 깬다**
  - target 위치: `spec/5-system/3-error-handling.md` §1.3 `PAYLOAD_TOO_LARGE` 행 (target
    문서 자체) vs 실제 도달 코드 `codebase/backend/src/common/filters/http-exception.filter.ts`
    (`GlobalExceptionFilter.catch` / `mapHttpErrorLike`) + `users.controller.ts` 의
    `FileInterceptor('file', { limits: { fileSize: UsersService.AVATAR_MAX_BYTES } })`
  - 위반 규약: `spec/5-system/3-error-handling.md` §1.3 `PAYLOAD_TOO_LARGE` 행 — **"`message`
    는 내부 원문... 을 echo 하지 않고 고정 문구 `"Request payload too large."` 만 반환한다
    (CWE-209)"**. 이 문서 자체가 review target 이며, 이 문장이 곧 output-format 계약이다.
  - 상세: `@nestjs/platform-express` 의 `FileInterceptor` 는 multer 의 `LIMIT_FILE_SIZE`
    를 `new PayloadTooLargeException(error.message)`(`error.message = 'File too large'`,
    node_modules 소스로 직접 확인)로 변환한다. `PayloadTooLargeException` 은
    `HttpException` **서브클래스**이므로 `GlobalExceptionFilter.catch` 는 body-parser
    유래 413 을 처리하는 `mapHttpErrorLike`(CWE-209 마스킹 담당, 고정 문구 반환) 가 아니라
    `exception instanceof HttpException` 분기를 타고, 그 분기는 `exception.getResponse()`
    의 `message` 를 **그대로** 클라이언트에 반환한다 — 결과적으로 실제 응답은
    `{ error: { code: 'PAYLOAD_TOO_LARGE', message: 'File too large', ... } }` 가 되어
    §1.3 이 약속한 `"Request payload too large."` 와 다르다. `http-exception.filter.spec.ts`
    의 기존 테스트(`maps 413 PayloadTooLargeException to PAYLOAD_TOO_LARGE envelope`)는
    `PayloadTooLargeException()`(인자 없는 기본 메시지 `'Payload Too Large'`)만 검증하고
    `message` 자체를 단언하지 않아 이 분기(HttpException-origin 413)의 message 가 catalog
    와 일치하는지 아예 검증한 적이 없다. 이 PR 이 추가한 e2e(`users-avatar-upload.e2e-spec.ts`
    "2MB 를 넘으면 413")도 `res.status` 만 보고 `error.message` 는 단언하지 않는다.
    **이 결함 자체는 이 PR 이 최초 도입한 것은 아니다** — 같은 `FileInterceptor` +
    `fileSize` 조합이 기존 `knowledge-base.controller.ts`(50MB 한도)에 이미 있었고 그쪽도
    같은 경로를 탄다. 다만 이 PR 은 그 경로를 **평범한 사용자 동작(2MB 아바타 업로드
    초과)** 으로 훨씬 자주 도달 가능하게 만들어, 지금까지 사실상 죽어 있던 이 갈래를
    실전에 노출시킨다. 실제 누출 문자열("File too large")은 경로·스택 등 민감정보는
    아니라 실질 위험은 낮지만, target 문서가 명시한 고정 문구 계약과는 다르다.
  - 제안: `GlobalExceptionFilter`(또는 avatar/KB 두 `FileInterceptor` 호출부)에서
    `PayloadTooLargeException` 인스턴스의 `message` 도 §1.3 고정 문구로 정규화한다 —
    예: `HttpException` 분기에서 `status === 413` 이고 `exceptionResponse.message` 가
    라이브러리 기본 문자열(`'File too large'`/`'Payload Too Large'`)일 때 고정 문구로
    치환. 회귀 방지용으로 `http-exception.filter.spec.ts` 에 `new
    PayloadTooLargeException('File too large')`(multer 실제 메시지) 케이스를 추가해
    `body.error.message` 를 명시적으로 단언하는 테스트를 넣을 것을 권한다.

## 확인했으나 위반이 아닌 항목 (참고)

- **신규 에러 코드 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 미등재** — `spec/5-system/3-error-handling.md
  §1.3` 카탈로그에 아직 없다. 그러나 이는 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md`
  가 `9-user-profile.md` "미구현(Planned)" 배지 flip·`0-overview.md §2.7`·
  `data-flow/4-file-storage.md`(잘못된 키 패턴 `{workspaceId}/avatars/...` 정정 포함)와 함께
  **정확히 이 항목을 명시 추적**하고 있다(`developer` 는 spec read-only, `project-planner`
  트랙으로 올바르게 위임된 상태 — CLAUDE.md 역할 경계 준수). 새 위반으로 보고하지 않는다.
- **`INVALID_FILE_TYPE` 코드 재사용(KB 문서 업로드와 공유)** — `spec/conventions/error-codes.md`
  §1 의 "시스템 전역 공용 코드는 prefix 없이" 원칙과 같은 결의 재사용으로, 의미가 "허용되지
  않는 파일 형식"으로 두 도메인에서 동일해 위반이 아니다.
- **`incrementLoginAttempts` 의 신규 raw `UPDATE ... RETURNING`** —
  `spec/conventions/raw-query-results.md` §1(튜플 언랩은 `updateReturningRows` 경유)·§2(컬럼명
  snake_case, `login_attempts` 로 올바르게 읽음)를 정확히 준수한다.
- **Swagger 컨트롤러/DTO 패턴 전반** — `@Post('me/avatar')` + `FileInterceptor('file', …)` +
  `@ApiConsumes('multipart/form-data')` + `@ApiBody({ schema: { properties: { file: { format:
  'binary' } } } })` 는 기존 `knowledge-base.controller.ts` 의 문서 업로드 엔드포인트와
  **필드명·데코레이터 조합이 동일**해 §1~§2 패턴을 그대로 따른다. 응답은
  `ApiOkWrappedResponse(UserProfileDto, …)` + `{ data: … }` 로 swagger.md §5-2/§2-5 를 준수한다.
  `@Roles()`/`@WorkspaceId()` 를 쓰지 않는 개인 리소스라 §5-4 의 `@ApiForbiddenResponse` 의무
  대상도 아니다(User 는 워크스페이스 종속 리소스가 아니라는 설계와 일치).
- **에러 코드 표기·명명** — `FILE_REQUIRED`/`INVALID_FILE_TYPE`/`USER_NOT_FOUND` 모두
  `UPPER_SNAKE_CASE` + 의미 기반 명명(`error-codes.md §1`) 이고, `USER_NOT_FOUND` 는 이미
  §1.9 note 가 "generic 코드라 도메인 미등재"로 명시한 기존 패턴을 재사용한 것뿐이다.
  `throw new BadRequestException({ code, message })` 형태도 "메시지 문자열 파싱 금지 →
  코드로 분기" 원칙(§1)과 저장소 전반의 기존 관례를 그대로 따른다.

## 요약

이번 PR(`POST /users/me/avatar`)은 명명·API 문서(Swagger)·에러 코드·raw SQL 결과 처리 등
대부분의 정식 규약을 정확히 지켰고, spec 동기화가 필요한 부분(에러 카탈로그 등재·"미구현"
배지 정정)은 developer/planner 역할 경계를 지켜 별도 planner 작업(`spec-update-avatar-upload-implemented.md`)
으로 이미 정확히 위임돼 있다. 다만 두 가지 실측 가능한 규약 위반이 남는다 — (1) 새로
추가/확장된 두 `@ApiOperation.description` 이 swagger.md §3 의 "강제" 50~150자 상한을
13~35% 초과했고, (2) multer 유래 413 응답이 `error-handling.md §1.3` 이 명시한 CWE-209
고정 문구 계약과 다른 내부 라이브러리 메시지("File too large")를 그대로 반환한다(패턴
자체는 KB 모듈에 선재하나 이 PR 이 도달 가능성을 크게 높인다). 두 항목 모두 런타임을
깨뜨리는 CRITICAL 은 아니지만, target 문서가 명시적으로 적어 둔 계약과 실측이 어긋나는
WARNING 급 갭이다.

## 위험도

MEDIUM
