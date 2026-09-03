# 보안(Security) 코드 리뷰

## 리뷰 범위

`change-password` / 비밀번호 재확인 실패 코드를 `INVALID_PASSWORD`(단일 코드) 에서
`PASSWORD_REQUIRED`(OAuth-only, 비밀번호 미설정) / `PASSWORD_INVALID`(불일치) 두 코드로
분리하는 리팩터. 신설 SoT `PASSWORD_VERIFY_CODES` (`codebase/backend/src/common/utils/password.util.ts`)
를 `AuthService.verifyPasswordForUser`, `UsersService.changePassword`,
`SessionsService.verifyReauth` 세 발행 지점이 공유한다. 나머지는 테스트·문서(mdx)·spec·plan
갱신.

## 발견사항

- **[INFO]** 실패 사유 문구 차등화로 "계정에 비밀번호가 설정돼 있는지" 가 명시적 신호가 됨
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (`changePassword`, 게이트 286~303) — diff 상 `PASSWORD_REQUIRED` 분기(286~294)와 `PASSWORD_INVALID` 분기(297~303)
  - 상세: 변경 전에는 두 분기 모두 동일 코드(`INVALID_PASSWORD`)·동일 메시지(`'Current password is incorrect'`)였는데, 이번 변경으로 코드·메시지가 뚜렷이 갈린다(`PASSWORD_REQUIRED` + "비밀번호가 설정되지 않은 계정이에요…" vs `PASSWORD_INVALID` + "현재 비밀번호가 일치하지 않아요."). `AuthService.verifyPasswordForUser`(`auth.controller.ts:342`, `webauthn.controller.ts:372`)와 `SessionsService.verifyReauth`(session revoke 경로) 호출부를 추적한 결과, `userId`/`user` 는 전부 `@CurrentUser() payload.sub`(JWT의 본인) 로만 채워지고 body/param 으로 타인 ID 를 주입할 경로가 없다 — 즉 이 신호는 항상 **호출자 자신의 계정 상태**에 대한 것이라 계정 열거(user enumeration) 벡터로 이어지지 않는다. 다만 세션 하이재킹(JWT 탈취) 시나리오에서는 공격자가 피해자의 "비밀번호 설정 여부" 를 이 신호로 알 수 있게 되는데, 이는 이미 JWT 를 탈취한 이후의 부차적 정보라 위험 증분은 낮다.
  - 제안: 현재 설계로 충분(자기 계정 한정). 향후 이 상수/코드를 다른 미인증·타인-대상 엔드포인트로 재사용할 계획이 생기면 그때 다시 열거 가능성을 검토할 것.

- **[INFO]** OAuth-only 분기가 bcrypt 비교 이전에 조기 반환 — 잠재적 타이밍 차이(기존 동작, 이번 diff 로 신설되지 않음)
  - 위치: `codebase/backend/src/modules/users/users.service.ts:286`(`if (!user.passwordHash) { throw … }`, bcrypt `comparePassword` 호출은 297) / `codebase/backend/src/modules/auth/auth.service.ts:73`(`verifyPasswordForUser`) / `codebase/backend/src/modules/auth/sessions.service.ts:265`(`verifyReauth`)
  - 상세: `passwordHash` 가 없으면 `comparePassword`(bcrypt, cost 12) 를 아예 호출하지 않고 즉시 예외를 던진다. 이 분기 순서 자체는 diff 이전부터 있던 구조(코드만 바뀜)라 이번 변경이 만든 회귀는 아니다. 이 경로가 전부 인증 후(self-scoped) 라 익명 사용자가 이 타이밍으로 임의 이메일의 OAuth-only 여부를 알아내는 데는 쓸 수 없다.
  - 제안: 조치 불필요(스코프 밖). 다만 향후 이 헬퍼를 미인증 경로(예: 로그인)에 재사용할 계획이 있다면 상수시간 처리를 재검토.

- **[INFO]** `INVALID_PASSWORD` wire 코드 은퇴가 감사(audit) 레이어의 동명 값과 의도적으로 공존
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts:348` (`failureReason: 'INVALID_PASSWORD'`, `login_history` 감사 사유값)
  - 상세: wire 401 코드는 이번 변경으로 `PASSWORD_INVALID`/`PASSWORD_REQUIRED` 로 전량 치환됐고(`grep` 확인 — `src/`·`test/` 어디에도 잔존 wire 사용 없음), `login_history.failure_reason` 의 `'INVALID_PASSWORD'` 만 남았다. `spec/conventions/error-codes.md §5` 은퇴 기록에 이 레이어 분리가 명시돼 있어(diff 상 plan 문서에도 반영) 의도된 설계다. 보안 취약점은 아니며, 로그·감사값이 wire 계약과 분리돼 있다는 점은 오히려 정보 노출 표면을 좁힌다(내부 감사 필드 vs 외부 응답 코드).
  - 제안: 없음.

- **[INFO]** 신규 회귀 테스트가 코드 값 리터럴로 검증 — drift 재발 방지 설계 확인
  - 위치: `codebase/backend/src/modules/users/users.service.spec.ts` (`codeOf` 헬퍼, 게이트 149~157; `[대조군]` 테스트, 게이트 193~203)
  - 상세: 두 실패 분기가 서로 다른 코드를 내는지 대조군 테스트로 명시적으로 확인하고, 상수가 아니라 리터럴 문자열로 단언해 상수 자체가 잘못 바뀌는 회귀도 잡도록 설계됨. 이는 과거 `INVALID_PASSWORD` drift(두 조건이 같은 코드를 발행해 OAuth-only 사용자에게 "비밀번호가 틀렸다" 고 잘못 안내)의 재발 방지 조치로, 보안 관점에서 긍정적.
  - 제안: 없음(참고용 기재).

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인가 우회, 안전하지 않은 암호화, 에러 메시지의 민감정보(스택트레이스·내부 경로·DB 오류 등) 노출, 취약 의존성 도입 — 해당 없음. `bcrypt`(cost 12) 사용은 diff 로 변경되지 않았고 기존 관행을 그대로 유지한다. `changePassword`/`revokeSession`/`revokeOtherSessions`/`verifyPasswordForUser` 전 경로가 `@CurrentUser()`(JWT `sub`) 로만 대상 사용자를 특정하며, body/param 으로 타인 ID 를 주입할 표면이 없음을 호출부 전수 추적으로 확인했다(`auth.controller.ts:342`, `webauthn.controller.ts:372`, `users.controller.ts:217~224`, `sessions.controller.ts:99~152`).

## 요약

이번 변경은 비밀번호 재확인 실패에 대해 이전에는 동일 코드/메시지로 뭉뚱그려졌던 "OAuth-only(비밀번호 미설정)" 와 "비밀번호 불일치" 두 조건을 별도 코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)로 분리하는 순수 리팩터로, 신규 인젝션·인가 우회·시크릿 노출·암호화 약화는 발견되지 않았다. 새로 드러나는 "비밀번호 설정 여부" 신호는 모든 호출부가 JWT 기반 자기 자신(self) 대상으로만 동작함을 코드 추적으로 확인했으므로 계정 열거(user enumeration) 로 이어지지 않는다. bcrypt 호출 순서(조기 반환)에 따른 잠재적 타이밍 차이도 동일하게 인증 후 self-scope 안에 갇혀 있어 실질 위험이 없다. 테스트가 코드 값 drift 를 리터럴 대조군으로 잡도록 보강된 점도 긍정적이다.

## 위험도

NONE
