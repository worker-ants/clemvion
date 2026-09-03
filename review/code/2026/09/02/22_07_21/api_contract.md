# API 계약(API Contract) 리뷰

## 대상 요약

`POST /users/me/change-password` 가 두 서로 다른 실패 조건(비밀번호 미설정 OAuth-only / 현재
비밀번호 불일치)에 같은 에러 코드 `INVALID_PASSWORD` 를 발행하던 것을, 형제 흐름
(`AuthService.verifyPasswordForUser`, `SessionsService.verifyReauth`)이 이미 쓰던
`PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 정렬한 변경이다. 신규 코드는 만들지 않았고
(`common/utils/password.util.ts` 의 `PASSWORD_VERIFY_CODES` 상수로 발행 지점 3곳을 통합),
`spec/conventions/error-codes.md` §5 rename 레지스트리에 **등급 B(잔여 위험 인수)** 로 등재되어
있으며 사용자 결정(2026-09-02)이 기록돼 있다.

## 발견사항

- **[INFO]** `POST /users/me/change-password` 의 에러 코드 wire 계약이 바뀐다 — 진짜 breaking change 다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:286-303` (`changePassword`)
  - 상세: OAuth-only 실패·현재 비밀번호 불일치 실패가 종전 둘 다 `INVALID_PASSWORD` 였던 것이
    각각 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 갈린다. 이 엔드포인트는 워크스페이스 JWT 로
    호출 가능한 내부 REST 라 저장소 밖 호출자를 원리적으로 배제할 수 없어(`error-codes.md` 도
    같은 이유로 등급 B 로 분류) 코드 값으로 분기하는 제3자 클라이언트가 있다면 그 분기가 깨진다.
    다만 이 리뷰에서 `codebase/frontend/src` 전수 grep(`INVALID_PASSWORD`) 결과 0건이고, change-password
    페이지(`codebase/frontend/src/app/(main)/w/[slug]/profile/change-password/page.tsx`)는
    `axiosMessage(err, …)` 로 서버 `message` 를 그대로 노출할 뿐 `error.code` 로 분기하지 않는 것을
    직접 확인했다 — 1st-party 클라이언트 영향은 없다. HTTP status(401)·에러 봉투 구조
    (`{ error: { code, message, requestId } }`, `GlobalExceptionFilter` 기준)는 그대로이므로 이 변경은
    **코드 값에 한정된 breaking change** 다. 스펙 3곳(`1-auth.md`·`3-error-handling.md`·
    `error-codes.md` §5)에 등재·문서화되어 있고 마이그레이션 grace window(구·신 코드 동시 발행 등)나
    API 버전 분기는 두지 않았다 — 다만 이는 이 저장소가 기존에 `INVALID_INPUT`→`INVALID_TRIGGER_PARAMETERS`
    (#1193)에서도 썼던 동일한 선례 패턴이라 이 diff 만의 새로운 관행은 아니다.
  - 제안: 조치 불필요 — 이미 governance 절차(§5 등급 B, 사용자 결정, 3-스펙 동기화)를 완전히
    통과했다. 향후 유사 사례에서도 "등급 B" 판정 시 grace window 도입 여부를 검토 항목에 추가하면
    더 안전해질 수 있다는 점만 기록해 둔다.

- **[INFO]** Swagger(OpenAPI) 문서가 코드 분리를 반영하지 않음
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` — `changePassword` 핸들러의
    `@ApiUnauthorizedResponse({ description: '현재 비밀번호 불일치 또는 인증 실패' })` (이 파일은 이번
    diff 대상이 아니라 게이트 줄 번호를 인용하지 않음 — 함수/데코레이터명으로 특정)
  - 상세: 컨트롤러는 `UsersService.changePassword` 가 던지는 예외를 그대로 전파할 뿐 코드를
    검사하지 않아 기능상 문제는 없다. 다만 Swagger 설명은 여전히 단일 문구("현재 비밀번호 불일치
    또는 인증 실패")라 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 두 코드가 분리됐다는 사실이
    OpenAPI 스펙 소비자(예: 자동 client 생성기)에게는 드러나지 않는다.
  - 제안: 여유가 있을 때 `@ApiUnauthorizedResponse` description 을 두 코드로 세분화하면 API 문서
    소비자에게 더 정확하다. 이번 변경의 필수 항목은 아니다.

## 점검 관점별 확인 내역

1. **하위 호환성** — 위 INFO#1 참조. wire 코드 값 변경이나 등급 B 로 governance 완료, 1st-party
   영향 0 실측 확인.
2. **버전 관리** — 이 API 자체가 URL 버저닝을 쓰지 않는(`/api/...` 단일 버전) 기존 컨벤션을
   그대로 따른다 (`spec/5-system/2-api-convention.md`). 이 diff 가 새로 도입한 문제는 아니다.
3. **응답 형식** — `GlobalExceptionFilter` 봉투(`{ error: { code, message, requestId } }`) 구조 불변.
   `changePassword` 성공 응답(`{ data: { accessToken } }`)도 불변.
4. **에러 응답** — HTTP status 는 모두 401 유지, 코드만 조건별로 분리되어 오히려 클라이언트가
   두 실패를 구분할 수 있게 됐다(개선). 세 발행 지점(`auth.service.ts`·`sessions.service.ts`·
   `users.service.ts`)이 문자열 리터럴 대신 `PASSWORD_VERIFY_CODES` 공유 상수를 쓰도록 구조적으로
   drift 원인을 제거했다 — 좋은 패턴.
5. **요청 검증** — 이번 diff 에 요청 바디/파라미터 검증 로직 변경 없음(에러 코드만 변경).
6. **URL/경로 설계** — 변경 없음.
7. **페이지네이션** — 해당 없음(목록 API 아님).
8. **인증/인가** — 인증/인가 로직 자체는 변경되지 않았다(이미 인증된 본인 계정에 대한 재확인
   실패 사유만 세분화). `POST /users/me/...` 는 호출자 본인 계정에 한정되므로 "OAuth-only 인지
   여부" 코드 분리가 사용자 열거(enumeration) 등 새로운 정보 노출 벡터를 만들지 않는다 — 이미
   인증된 본인만 자신의 계정 상태를 알 수 있다.

## 요약

`POST /users/me/change-password` 의 에러 코드를 형제 흐름과 정렬하는 의도적 breaking change 다.
코드 자체(`password.util.ts`·`auth.service.ts`·`sessions.service.ts`·`users.service.ts`)는 공유 상수로
drift 원인을 구조적으로 제거했고, 에러 봉투 구조·HTTP status·요청 검증·URL 설계·인증 경계 모두
변경 없이 안정적으로 유지된다. breaking 요소(코드 값 변경)는 `error-codes.md` §5 등급 B 로 정식
governance 절차(사용자 결정 기록, 1st-party 영향 실측 0건, spec 3곳 동기화)를 거쳤으므로 실질
위험은 낮다. Swagger 설명 미세분화 정도만 사소한 개선 여지로 남는다.

## 위험도

LOW
