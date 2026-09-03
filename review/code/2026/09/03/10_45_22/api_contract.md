# API 계약(API Contract) 리뷰

## 대상 요약

`POST /api/users/me/change-password` 가 두 서로 다른 실패 조건(비밀번호 미설정 OAuth-only / 현재
비밀번호 불일치)에 같은 에러 코드 `INVALID_PASSWORD` 를 발행하던 것을, 형제 흐름
(`AuthService.verifyPasswordForUser`, `SessionsService.verifyReauth`)이 이미 쓰던
`PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 정렬한 변경이다. 신규 코드는 만들지 않았고
(`common/utils/password.util.ts` 의 `PASSWORD_VERIFY_CODES` 상수로 발행 지점 3곳을 통합),
`spec/conventions/error-codes.md` §5 rename 레지스트리에 등급 B(잔여 위험 인수)로 등재되어 있다.

이 changeset 은 동일 커밋(`93146d2f2`)에 대한 **직전 코드 리뷰 라운드**
(`review/code/2026/09/02/22_07_21/`)의 WARNING 4건 조치분을 포함한다 — 특히 W2(HTTP 레벨
e2e 커버리지 부재)·W3(CHANGELOG 누락)가 API 계약 관점 갭이었고, 이번 라운드에서 둘 다 채워졌음을
직접 대조로 확인했다.

## 발견사항

- **[INFO]** `POST /users/me/change-password` 의 에러 코드 wire 계약이 바뀐다 — 진짜 breaking
  change 이나 governance·문서화·테스트가 모두 갖춰져 있다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `changePassword` 함수, 게이트
    286~303 (`PASSWORD_REQUIRED` 분기 286~294, `PASSWORD_INVALID` 분기 297~303)
  - 상세: OAuth-only 실패·현재 비밀번호 불일치 실패가 종전 둘 다 `INVALID_PASSWORD` 였던 것이
    각각 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 갈린다. 이 엔드포인트는 워크스페이스 JWT 로
    호출 가능한 내부 REST 라 저장소 밖 호출자를 원리적으로 배제할 수 없어(`error-codes.md` §5
    도 같은 이유로 등급 B 로 분류) 코드 값으로 분기하는 제3자 클라이언트가 있다면 그 분기가
    깨진다. 1st-party 영향은 `codebase/frontend/src` 전수 grep(`INVALID_PASSWORD`) 0건으로
    실측 확인됨(change-password 페이지는 `axiosMessage()` 로 서버 `message` 만 노출, `error.code`
    분기 없음). HTTP status(401)·에러 봉투 구조(`{ error: { code, message, requestId } }`,
    `GlobalExceptionFilter` 기준)는 그대로다. 이번 라운드에서 새로 확인한 것: (1) `CHANGELOG.md`
    에 wire 코드 변경표·영향 범위·감사값 레이어 분리를 명시한 `## Unreleased` 항목이 추가됐다.
    (2) `codebase/backend/test/users-change-password.e2e-spec.ts` 에 OAuth-only 분기의 HTTP
    레벨 e2e(`401` + `error.code === 'PASSWORD_REQUIRED'` + 대조군 `!== 'PASSWORD_INVALID'` +
    안내 문구 + 감사 미기록)가 추가돼, 자매 분기(`PASSWORD_INVALID`)와 커버리지 비대칭이 해소됐다.
    (3) `spec/5-system/1-auth.md`·`3-error-handling.md`·`spec/conventions/error-codes.md` §5
    가 조건별 2종 대체(`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID`)를 명시하고
    `login_history.failure_reason` 동명 감사값과의 레이어 분리도 §5 비고에 남겼다.
  - 제안: 조치 불필요 — governance(§5 등급 B, 사용자 결정 2026-09-02, 3-스펙 동기화, CHANGELOG,
    e2e 커버리지)가 완전히 갖춰졌다.

- **[INFO]** Swagger(OpenAPI) 문서가 코드 분리를 여전히 반영하지 않음 (직전 라운드 대비 미변경,
  RESOLUTION.md #5 에서 의도적으로 defer 됨)
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` — `changePassword` 핸들러
    (`@Post('me/change-password')`, 게이트 202)의 `@ApiUnauthorizedResponse({ description:
    '현재 비밀번호 불일치 또는 인증 실패' })` (게이트 213~215). 이 파일은 이번 diff 대상이 아니라
    직접 `Read` 로 열어 확인함.
  - 상세: 컨트롤러는 `UsersService.changePassword` 가 던지는 예외를 그대로 전파할 뿐 코드를
    검사하지 않아 기능상 문제는 없다. 다만 Swagger 설명은 여전히 단일 문구라
    `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 두 코드가 분리됐다는 사실이 OpenAPI 스펙 소비자(예:
    자동 client 생성기)에게는 드러나지 않는다. 직전 라운드에서 같은 지적이 있었고 개발자가
    "`swagger.md` 규약 범위라 이 PR 에서 넓히지 않는다" 고 명시적으로 defer 한 판단을 그대로
    유지하고 있다 — 새로 발견된 결함이 아니라 기존 판단이 이번 커밋에도 유효함을 재확인.
  - 제안: 여유가 있을 때 `@ApiUnauthorizedResponse` description 을 두 코드로 세분화하면 API 문서
    소비자에게 더 정확하다. 이번 변경의 필수 항목은 아니다.

## 점검 관점별 확인 내역

1. **하위 호환성** — 위 INFO#1 참조. wire 코드 값 변경(breaking)이나 등급 B 로 governance
   완료, 1st-party 영향 0 실측, e2e 로 신규 분기까지 커버됨.
2. **버전 관리** — 이 API 는 URL 버저닝을 쓰지 않는(`/api/...` 단일 버전) 기존 컨벤션을 그대로
   따른다. 이 diff 가 새로 도입한 문제는 아니다.
3. **응답 형식** — `GlobalExceptionFilter` 봉투(`{ error: { code, message, requestId } }`) 구조
   불변(직접 확인). `changePassword` 성공 응답 구조도 불변.
4. **에러 응답** — HTTP status 는 모두 401 유지, 코드만 조건별로 분리되어 클라이언트가 두 실패를
   구분할 수 있게 됐다(개선). 세 발행 지점(`auth.service.ts`·`sessions.service.ts`·
   `users.service.ts`)이 문자열 리터럴 대신 `PASSWORD_VERIFY_CODES` 공유 상수를 쓰도록 구조적으로
   drift 원인을 제거했고, 이번 라운드에서 `sessions.service.ts` 소비 지점(`verifyReauth`)의 코드값도
   리터럴 테스트로 pin 됐다(`sessions.service.spec.ts`, "비밀번호 불일치 실패 코드는
   PASSWORD_INVALID 다").
5. **요청 검증** — 이번 diff 에 요청 바디/파라미터 검증 로직(`ChangePasswordDto`) 변경 없음(에러
   코드 발행 분기만 변경).
6. **URL/경로 설계** — 변경 없음.
7. **페이지네이션** — 해당 없음(목록 API 아님).
8. **인증/인가** — 인증/인가 로직 자체는 변경되지 않았다. `POST /users/me/change-password` 는
   `@CurrentUser()` 로 호출자 본인 계정에만 한정되므로 코드 분리가 계정 열거(enumeration) 등 새
   정보 노출 벡터를 만들지 않는다.

## 요약

`POST /users/me/change-password` 의 에러 코드를 형제 흐름과 정렬하는 의도적 breaking change 다.
코드(`password.util.ts`·`auth.service.ts`·`sessions.service.ts`·`users.service.ts`)는 공유 상수로
drift 원인을 구조적으로 제거했고, 에러 봉투 구조·HTTP status·요청 검증·URL 설계·인증 경계 모두
변경 없이 안정적으로 유지된다. 직전 코드 리뷰 라운드가 지적한 API 계약 관점 갭(CHANGELOG 누락,
신규 분기의 HTTP 레벨 e2e 부재)이 이번 라운드에서 정확히 채워졌음을 실측으로 확인했다. 남은 흠은
Swagger 설명 미세분화 하나(INFO, 기존에 의도적으로 defer 된 판단 유지)뿐이며, 이는 이 PR 의
필수 조치 항목이 아니다.

## 위험도

LOW
