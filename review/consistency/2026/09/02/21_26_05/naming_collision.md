# 신규 식별자 충돌 검토 — `spec-draft-change-password-code-alignment.md`

## 검토 범위와 특이점

이 target 은 구조적으로 이례적이다 — **새 식별자를 만들지 않는 것 자체가 결정의 핵심**이다
(결정①: "새 코드를 만들지 않는다", 원안 `PASSWORD_NOT_SET` 신설을 명시적으로 기각). 따라서
전형적인 "신규 식별자가 기존과 충돌하는가" 보다는 (a) 그 자기-반증 근거가 사실인지, (b) 그럼에도
남는 소규모 표면(발행처 확장·§5 신규 행)에 충돌이 없는지를 실측으로 확인했다.

## 실측 방법

- `spec/conventions/error-codes.md`, `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md`,
  `spec/2-navigation/9-user-profile.md`, `spec/1-data-model.md`, `spec/data-flow/2-auth.md` 전문 대조
- `codebase/backend/src/modules/{auth,users}/**` grep — `PASSWORD_REQUIRED`·`PASSWORD_INVALID`·
  `INVALID_PASSWORD`·`PASSWORD_NOT_SET` 전수 발행 지점
- `codebase/frontend` 전수 grep(0건 확인)

## 발견사항

### [INFO] `PASSWORD_NOT_SET` 재사용 회피 근거 — 실측으로 확정 확인

- target 신규 식별자 후보: (기각된) `PASSWORD_NOT_SET`
- 기존 사용처: `codebase/backend/src/modules/auth/auth.service.ts:330`
  (`login()` 메서드 — 로그인 시 `passwordHash` 부재 케이스의 `login_history.failure_reason`)
- 상세: target 은 "원안 B(`PASSWORD_NOT_SET` 신설)를 채택했다면 `INVALID_PASSWORD` 가 지금
  겪는 wire/audit 동명 충돌을 재생산했을 것"이라 주장한다. `auth.service.ts:330` 을 직접 읽어
  확인한 결과 정확하다 — `failureReason: 'PASSWORD_NOT_SET'` 이 이미 로그인 실패 감사값으로
  발행되고 있다. 신설을 기각한 target 의 판단은 근거가 실측과 일치한다.
- 제안: 없음 — 이미 회피됐다. (참고로 이 근거는 target 자신이 이전 `--spec` naming_collision
  라운드의 INFO#5 로부터 얻었다고 명시하고 있으며, 이번 검토로 그 인용이 정확함을 재확인했다.)

### [INFO] 발행처 확장(`PASSWORD_REQUIRED`/`PASSWORD_INVALID` → `changePassword` 추가)은 스코프 충돌 없음

- target 신규 식별자: 없음(기존 코드 재사용) — 다만 **발행 스코프**가
  `AuthService.verifyPasswordForUser` 전용에서 `UsersService.changePassword` 로 확장된다.
- 기존 사용처: `spec/5-system/3-error-handling.md:66-67`(§1.2.1 표),
  `spec/5-system/1-auth.md:521`(민감 동작 재확인 note) — 둘 다 현재 "`verifyPasswordForUser`
  전용" 으로 좁게 서술.
- 상세: 코드베이스 전수 grep 결과 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 는 현재
  `verifyPasswordForUser`(+`SessionsService.verifyReauth` 의 `PASSWORD_INVALID` 형제 발행)
  외의 다른 의미로 쓰이는 곳이 없다(frontend 0건, 등록/로그인 플로우의 별도 "비밀번호 필수"
  검증과도 무관 — 그쪽은 `VALIDATION_ERROR`/`LOGIN_FAILED` 를 쓴다). 발행처를
  `changePassword` 로 넓히는 것은 §1(의미 기반 명명 — "구현 세부·전이적 맥락을 이름에 박지
  않는다")과 정합하며, 변경안 #0·#2·#5·#6 이 관련 서술을 모두 동반 갱신 대상으로 잡고 있어
  일부 서술만 갱신되고 다른 서술이 뒤처지는 상태(stale scope 서술)가 될 위험도 낮다.
- 제안: 없음 — 이대로 진행 가능.

### [INFO] `INVALID_PASSWORD` 감사값(login) 과 changePassword wire 코드는 **완전히 무관한 두 기능**이 우연히 공유하는 문자열 — target 의 "레이어 다름" 캐비엇은 정확하나 인접 오독 소지가 있다

- 기존 사용처 A: `codebase/backend/src/modules/auth/auth.service.ts:347` — **`login()`**
  메서드에서 로그인 시 비밀번호 불일치일 때 `login_history.failure_reason = 'INVALID_PASSWORD'`
  기록(wire 응답 코드는 `LOGIN_FAILED`).
- 기존 사용처 B: `codebase/backend/src/modules/users/users.service.ts:284,292` — **`changePassword()`**
  가 던지는 `UnauthorizedException({ code: 'INVALID_PASSWORD' })` (미설정·불일치 두 조건 모두).
- 상세: `changePassword` 는 `login_history` 에 **아무것도 기록하지 않는다**(실측 —
  `users.service.ts changePassword` 본문에 `loginHistory` 호출 없음). 즉 사용처 A 의 감사값은
  changePassword 이벤트의 감사 흔적이 **아니라**, 완전히 별개인 로그인 실패 이벤트의 사유값이다
  — 두 기능이 우연히 같은 문자열을 쓸 뿐 인과관계가 없다. target 의 문구(결정②:
  "`login_history.failure_reason` 의 감사 사유값으로 계속 살아 있다", item 11b: "같은 문자열이
  다른 레이어에 남을 수 있다")는 **"레이어가 다르다"** 는 표현으로 이미 이 무관함을 정확히
  전제하고 있고, `1-auth.md:339` 의 기존 서술도 "별개 wire 코드다" 로 명시해 둔다 — 즉
  target 은 오독을 유발하는 방향으로 새로 서술하지 않는다.
- 다만 다음 사람이 "구 코드 `INVALID_PASSWORD` 은퇴 후 감사값은 changePassword 감사 이력의
  화석" 이라는 인상을 받을 여지가 §5 신규 행의 짧은 caveat 문구만으로는 남을 수 있다 — 실제로는
  **`login()` 이벤트의 화석**이다.
- 제안: §5 신규 행 또는 item 11b 문구에 "이 감사값은 `changePassword` 가 아니라 **로그인 실패
  감사 트레일**(`AuthService.login`)에서 발행된다" 한 구절을 추가하면, 나중에 "감사값도
  changePassword 관련이니 함께 정리하자"는 오판을 원천 차단할 수 있다. 등급은 정보 보완
  수준(INFO) — 현재 caveat 도 "레이어가 다르다"로 이미 잘못된 소급 정리를 막고 있어 실질
  위험은 낮다.

### 확인했으나 충돌 없음 (참고)

- 요구사항 ID: target 은 새 요구사항 ID를 부여하지 않는다(버그·정합 정정 draft).
- 엔티티/DTO/인터페이스명: 신규 타입 없음.
- API endpoint: 신규 endpoint 없음 — 기존 `POST /users/me/change-password` 재사용.
- 이벤트/메시지명: webhook·queue·SSE 이벤트 신설 없음.
- 환경변수·설정키: 신규 ENV/config key 없음.
- 파일 경로: 신규 spec 파일 없음 — 기존 4개 파일(`1-auth.md`·`3-error-handling.md`·
  `error-codes.md`·`9-user-profile.md`) 수정 및 기존 plan 파일(`auth-change-password-oauth-only-code-split.md`)
  갱신뿐. `error-codes.md §5` 표에 추가되는 신규 행(`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/
  `PASSWORD_INVALID`)의 "구 코드" 값도 표 내 기존 4행(`LLM_CONFIG_NOT_FOUND`·`LLM_CONFIG_INVALID`·
  `INVALID_INPUT`·`WORKSPACE_REQUIRED`)과 중복되지 않는다.
- line 앵커 정합성: target 이 인용하는 `1-auth.md:337/339/521/750`,
  `3-error-handling.md:50/66/67/70`, `9-user-profile.md:147` 를 전부 직접 열어 대조한 결과
  전부 target 서술과 정확히 일치한다(오프-바이-원 없음).

## 요약

target 문서는 새 식별자를 만들지 않는 것이 결정 그 자체이며(형제 코드 재사용), 원안이었던
`PASSWORD_NOT_SET` 신설을 스스로 기각한 근거(`login_history.failure_reason` 감사값으로 이미
존재)도 실측 대조 결과 정확했다. 발행 스코프 확장(`PASSWORD_REQUIRED`/`PASSWORD_INVALID` →
`changePassword` 추가)은 기존 스코프 서술과 명시적으로 동반 갱신되며 다른 의미로 쓰이는 곳도
없다. 유일하게 보완할 점은 §5 신규 행·item 11b 의 "감사값 존속" caveat 가 그 감사값이
**changePassword 가 아니라 로그인 실패 이벤트**에서 나온다는 사실까지는 명시하지 않아, 향후
"감사값도 changePassword 소관이니 함께 정리"라는 오판 여지를 남긴다는 것 — 다만 이는 CRITICAL/
WARNING 급 충돌이 아니라 서술 보완(INFO) 수준이다. 신규 요구사항 ID·엔티티·endpoint·이벤트·
환경변수·파일 경로 충돌은 전무하다.

## 위험도

NONE
