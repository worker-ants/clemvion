# 보안(Security) 코드 리뷰

## 리뷰 범위

`change-password` / 비밀번호 재확인 실패 코드를 단일 코드(`INVALID_PASSWORD`)에서
조건별 두 코드(`PASSWORD_REQUIRED` — OAuth-only/비밀번호 미설정, `PASSWORD_INVALID` — 불일치)로
분리하는 변경. 신설 SoT `PASSWORD_VERIFY_CODES` (`codebase/backend/src/common/utils/password.util.ts`)를
`AuthService.verifyPasswordForUser`, `UsersService.changePassword`,
`SessionsService.verifyReauth` 세 발행 지점이 공유한다. 실제 애플리케이션 코드는
`codebase/backend/src/common/utils/password.util.ts` · `auth.service.ts` ·
`sessions.service.ts` · `users.service.ts` 4개(+대응 테스트 4개, mdx 문서 2개)뿐이고,
나머지 대상 파일 목록(30여 개)은 `plan/**`·`spec 관련 draft`·이전 라운드
`review/code/**`·`review/consistency/**` 산출물로, 보안 관점의 "코드"가 아니라 실제 코드
diff 관점에서는 제외했다(내용은 확인 — 시크릿·주입 패턴 없음).

이 changeset 은 이미 2차례 코드 리뷰(`review/code/2026/09/02/22_07_21/`,
`review/code/2026/09/03/10_45_22/`)를 거쳤고 두 라운드 모두 security reviewer 가
위험도 **NONE** 으로 판정했다. 이번 라운드에서는 최종 상태(`93146d2f2`)를 기준으로 인가
경계·타이밍·감사값 분리·시크릿 여부를 독립적으로 재확인했다.

## 발견사항

- **[INFO]** 실패 사유 문구 차등화로 "계정에 비밀번호가 설정돼 있는지" 가 명시적 신호가 됨 — 열거(enumeration) 벡터 아님을 재확인
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (`changePassword`, 게이트 286~303, `PASSWORD_REQUIRED` 분기 286~294 / `PASSWORD_INVALID` 분기 297~303)
  - 상세: 변경 전에는 두 분기 모두 동일 코드·메시지였는데, 이번 변경으로 코드·메시지가 갈린다. 컨트롤러(`codebase/backend/src/modules/users/users.controller.ts:217-228`)를 직접 열어 확인한 결과 `changePassword` 는 `@CurrentUser() payload: JwtPayload` 의 `payload.sub` 만을 대상 사용자로 쓴다 — body/param 으로 타인 ID 를 주입할 표면이 없다. `AuthService.verifyPasswordForUser` 호출부(`auth.controller.ts:342`, `webauthn.controller.ts:372`)와 `SessionsService.verifyReauth` 호출부도 동일하게 JWT 본인 스코프다. 즉 이 신호는 항상 **호출자 자신의 계정 상태**에 대한 것이라 계정 열거 벡터로 이어지지 않는다. JWT 탈취 후 공격자가 피해자의 "비밀번호 설정 여부" 를 알 수 있게 되는 부차적 노출은 있으나, 이미 JWT 를 탈취한 이후 시나리오라 위험 증분은 낮다.
  - 제안: 현재 설계로 충분(자기 계정 한정). 이 코드/상수를 향후 미인증·타인-대상 엔드포인트로 재사용할 계획이 생기면 그때 다시 열거 가능성을 검토할 것.

- **[INFO]** OAuth-only 분기가 bcrypt 비교 이전에 조기 반환 — 잠재적 타이밍 차이(선재 동작, 이번 diff 로 신설되지 않음)
  - 위치: `codebase/backend/src/modules/users/users.service.ts:287-294`(`if (!user.passwordHash) { throw … }`, `comparePassword` 호출은 298) / `codebase/backend/src/modules/auth/auth.service.ts:73-78`(`verifyPasswordForUser`) / `codebase/backend/src/modules/auth/sessions.service.ts` `verifyReauth`(`!user.passwordHash` 계열 조기 분기)
  - 상세: `passwordHash` 가 없으면 bcrypt(cost 12) 비교를 아예 호출하지 않고 즉시 예외를 던지는 구조 자체는 diff 이전부터 있던 것(코드값만 리터럴 → `PASSWORD_VERIFY_CODES` 상수로 교체)이라 이번 변경이 만든 회귀가 아니다. 세 경로 모두 인증 후(self-scoped) 이므로 익명 사용자가 이 타이밍으로 임의 이메일의 OAuth-only 여부를 알아내는 데는 쓸 수 없다.
  - 제안: 조치 불필요(스코프 밖). 향후 이 헬퍼를 미인증 경로(예: 로그인)에 재사용할 계획이 있다면 상수시간 처리를 재검토.

- **[INFO]** `INVALID_PASSWORD` wire 코드 은퇴가 감사(audit) 레이어의 동명 값과 의도적으로 공존
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` (`login_history.failure_reason: 'INVALID_PASSWORD'`, 로그인 실패 감사 사유값 — 이번 diff 대상 아님, `grep` 으로 잔존 확인)
  - 상세: wire 401 코드는 이번 변경으로 `PASSWORD_INVALID`/`PASSWORD_REQUIRED` 로 전량 치환됐고(`src/`·`test/` 전수 grep — 잔존 wire 사용 0건), `login_history.failure_reason` 의 `'INVALID_PASSWORD'` 만 레이어가 달라 그대로 남는다. `spec/conventions/error-codes.md §5` 은퇴 기록에 이 레이어 분리가 명시돼 있고 `CHANGELOG.md` 신규 항목도 이를 disclose 한다. 보안 취약점은 아니며 내부 감사 필드와 외부 wire 응답 코드가 분리돼 있다는 점은 오히려 정보 노출 표면을 좁힌다.
  - 제안: 없음.

- **[INFO]** 신규 회귀 테스트가 코드 값을 리터럴로 검증 — drift 재발 방지 설계, 보안적으로 긍정적
  - 위치: `codebase/backend/src/modules/users/users.service.spec.ts` (`codeOf`/`rejectionOf` 헬퍼 + `[대조군]` 테스트, changePassword describe 블록), `codebase/backend/src/modules/auth/sessions.service.spec.ts:192-214` (`PASSWORD_INVALID` 리터럴 단언), `codebase/backend/test/users-change-password.e2e-spec.ts:96-124` (OAuth-only → `PASSWORD_REQUIRED` HTTP e2e)
  - 상세: 세 소비처(`auth.service`·`users.service`·`sessions.service`) 모두 코드 값을 상수가 아닌 리터럴 문자열로 단언해, 두 실패 조건이 실제로 다른 코드를 내는지 대조군까지 확인한다. 이는 과거 결함(두 조건이 같은 `INVALID_PASSWORD` 를 발행해 OAuth-only 사용자에게 "비밀번호가 틀렸다" 고 오인시킨 것)의 재발 방지 조치다. e2e 는 `UPDATE "user" SET password_hash = NULL WHERE id = $1` 파라미터 바인딩(`$1`)을 사용해 SQL 인젝션 표면도 없다.
  - 제안: 없음(참고용 기재).

**점검 관점 전수 확인(해당 없음으로 판정)**

1. **인젝션** — SQL(TypeORM `repo.update`/`findOne`, e2e 의 파라미터 바인딩 raw query), XSS(해당 응답이 JSON API, HTML 렌더링 경로 없음), 커맨드/LDAP 인젝션, 경로 탐색 — 이번 diff 에 신설된 인젝션 표면 없음.
2. **하드코딩된 시크릿** — 변경분 전체(`git diff origin/main...HEAD -- codebase/`)에서 API 키/토큰/인증서 패턴 grep — 매치 없음. 테스트 파일의 `'N3wP@ssw0rd!'`·`'OldP@ssw0rd1'`·`'wrong'` 등은 unit/e2e 전용 리터럴 픽스처로, 실제 시스템 자격 증명이 아니며 이 저장소의 기존 테스트 관행과 일치한다.
3. **인증/인가** — 인증/인가 로직 자체는 변경되지 않았다. `changePassword`/`verifyPasswordForUser`/`verifyReauth` 전 경로가 `@CurrentUser()`(JWT `sub`) 로만 대상 사용자를 특정함을 컨트롤러 직접 확인으로 재검증했다(호출부: `users.controller.ts:217-228`, `auth.controller.ts:342`, `webauthn.controller.ts:372`, `sessions.controller.ts` 재인증 경로).
4. **입력 검증** — `ChangePasswordDto` 등 요청 검증 로직은 이번 diff 로 변경되지 않음(에러 코드만 변경).
5. **OWASP Top 10** — A01(접근 통제 실패) 해당 없음(self-scope 유지), A07(식별/인증 실패) 관련 신호 노출은 위 INFO 로 다뤘고 enumeration 로 이어지지 않음.
6. **암호화** — `bcrypt`(`BCRYPT_ROUNDS = 12`) 사용은 이번 diff 로 변경되지 않음. 평문 비밀번호 전송/저장 없음.
7. **에러 처리** — 신규 메시지(`'비밀번호가 설정되지 않은 계정이에요…'`, `'현재 비밀번호가 일치하지 않아요.'`)는 스택트레이스·내부 경로·DB 에러를 노출하지 않고, `GlobalExceptionFilter` 봉투(`{ error: { code, message, requestId } }`) 구조도 불변.
8. **의존성 보안** — 이번 diff 로 신규 의존성 추가/버전 변경 없음.

## 요약

`INVALID_PASSWORD` 단일 코드가 "비밀번호 미설정(OAuth-only)"과 "현재 비밀번호 불일치"라는
서로 다른 두 조건을 뭉뚱그리던 것을, 형제 흐름이 이미 쓰던 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`
로 정렬하고 발행 지점 3곳을 `PASSWORD_VERIFY_CODES` 단일 상수로 통합한 순수 리팩터다. 새로
드러나는 "비밀번호 설정 여부" 신호는 모든 호출부가 JWT 기반 자기 자신(self) 대상으로만
동작함을 컨트롤러·서비스 코드를 직접 열어 재확인했으므로 계정 열거(user enumeration)로
이어지지 않는다. bcrypt 조기 반환에 따른 잠재적 타이밍 차이도 인증 후 self-scope 안에
갇혀 있어 실질 위험이 없고, 이 구조 자체는 이번 diff 가 신설한 것이 아니다. 신규 인젝션·
하드코딩 시크릿·인가 우회·암호화 약화·민감정보 노출 에러 메시지·취약 의존성은 발견되지
않았고, 회귀 테스트가 코드 값을 리터럴로 대조군까지 검증하도록 보강되어 향후 동일 클래스의
drift(조건 병합으로 인한 오정보 안내)가 재발할 가능성도 낮췄다. Critical/Warning 없음.

## 위험도

NONE
