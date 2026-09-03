# 보안(Security) 코드 리뷰

## 리뷰 범위

`change-password` / 비밀번호 재확인 실패 코드를 단일 `INVALID_PASSWORD` 에서 조건별
`PASSWORD_REQUIRED`(비밀번호 미설정 — OAuth-only) / `PASSWORD_INVALID`(불일치) 로 분리하는
리팩터. 신설 SoT 상수 `PASSWORD_VERIFY_CODES`(`codebase/backend/src/common/utils/password.util.ts`)
를 `AuthService.verifyPasswordForUser`, `UsersService.changePassword`,
`SessionsService.verifyReauth` 세 발행 지점이 공유한다. 그 외 파일은 테스트(unit/e2e)·
CHANGELOG·사용자 가이드(mdx, ko/en)·spec 3종·plan 문서·이전 라운드 code-review·
consistency-check 산출물(신규 커밋 대상)이다.

핵심 소스(`password.util.ts`·`auth.service.ts`·`sessions.service.ts`·`users.service.ts`,
`users.controller.ts`)를 직접 열어 diff 와 대조했고, `@CurrentUser()` 호출 체인·
`@UseGuards(JwtAuthGuard)`·`@Throttle` 데코레이터 실장 여부를 저장소에서 직접 확인했다.
새로 추가된 `review/**`·`plan/**` 산출물에 대해서는 시크릿 패턴 grep 을 수행했다(0건).

## 발견사항

- **[INFO]** 비밀번호 재확인 실패 코드 분리로 "계정에 비밀번호가 설정돼 있는지" 신호가 명시화됨 — 열거(enumeration) 벡터 아님, self-scope 로 한정 확인
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (`changePassword`, 게이트 286~303)
  - 상세: 변경 전에는 OAuth-only 분기와 불일치 분기가 같은 코드/메시지였는데, 이제 `PASSWORD_REQUIRED`(비밀번호 미설정)와 `PASSWORD_INVALID`(불일치)로 갈린다. 호출 경로(`users.controller.ts:222` `payload.sub`, `auth.controller.ts`/`webauthn.controller.ts` 의 `AuthService.verifyPasswordForUser` 호출부, `sessions.controller.ts` 의 `SessionsService.verifyReauth` 호출부)를 직접 추적한 결과 대상 `userId`/`user` 는 전부 `@CurrentUser() payload.sub`(요청자 본인의 JWT `sub`) 로만 채워지고, `users.controller.ts` 는 클래스 레벨에 `@UseGuards(JwtAuthGuard)` 가 걸려 있다 — body/param 으로 타인 계정을 지정할 표면이 없다. 따라서 이 신호는 항상 "호출자 자기 자신의 계정 상태"에 한정되어 계정 열거(user enumeration)로 이어지지 않는다.
  - 제안: 현재 설계로 충분. 이 코드값/상수를 향후 미인증 또는 타인-대상 엔드포인트에 재사용할 계획이 생기면 그 시점에 다시 검토할 것.

- **[INFO]** `changePassword` 엔드포인트에 rate limiting(`@Throttle`)이 없음 — 이 diff 로 신설된 문제는 아니나 이 PR 이 "현재 비밀번호 확인" 분기를 직접 다룸
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` — `changePassword` 핸들러(`@Post('me/change-password')`, 게이트 202~217 인근). 같은 파일의 인접 엔드포인트(예: 게이트 259, 336 인근)에는 `@Throttle({ default: { ttl: 60_000, limit: 5 } })` 가 있으나 `changePassword` 자체에는 없다(직접 확인).
  - 상세: 이 diff 는 이 데코레이터를 추가/제거하지 않으므로 이번 PR 이 만든 회귀는 아니다. 다만 인증된 세션(JWT 탈취 등) 상태에서 현재 비밀번호를 무제한으로 시도할 수 있는 표면이라는 점은 이번 변경으로 "현재 비밀번호 검증" 로직이 더 명확히 두 분기로 나뉜 것과 맞물려 참고할 가치가 있다. bcrypt(cost 12)의 계산 비용이 자연스러운 지연을 주기는 하나 전용 rate limit 은 아니다.
  - 제안: 이번 PR 스코프 밖 — 별도 항목으로 `@Throttle` 추가를 검토 권장(blocking 아님).

- **[INFO]** `login_history.failure_reason` 감사값과 wire 에러 코드가 같은 문자열 `'INVALID_PASSWORD'` 를 레이어를 달리하여 유지 — 의도된 분리, 정보 노출 확대 아님
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` (`login` 흐름의 `failureReason: 'INVALID_PASSWORD'`, 이번 diff 대상 밖 — 참고용 코드 위치)
  - 상세: 이번 diff 로 wire 401 코드는 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 전량 치환됐고(`grep -rn "'INVALID_PASSWORD'"` 로 `src/`·`test/` 에 wire 응답용 잔존 없음을 확인), `login_history.failure_reason` 만 별도 감사값으로 남는다. 두 값이 우연히 동일 문자열을 쓰지만 소비 레이어(외부 API 응답 vs 내부 감사 로그)가 분리되어 있어 정보 노출 표면이 넓어지지 않는다.
  - 제안: 없음(확인용 기재).

- **[INFO]** 신규 파일(`CHANGELOG.md`·mdx 문서·`review/**`·`plan/**` 신규/이동 산출물)에 시크릿·자격증명 하드코딩 없음
  - 위치: 이번 changeset 전체(46+ 파일)
  - 상세: `git diff` 대상 신규 텍스트에 대해 API 키/토큰/비밀번호 리터럴/PEM 헤더 패턴을 grep 했고, `PASSWORD_REQUIRED`/`PASSWORD_INVALID`/`INVALID_PASSWORD`(에러 코드 문자열, 시크릿 아님) 외에는 매치가 없었다. e2e 테스트의 `'anything!9'`/`'An0therP@ss!7'`/`'WrongPass!9'` 등은 테스트 픽스처용 임의 문자열이며 실제 자격증명이 아니다.
  - 제안: 없음.

## 확인했으나 취약점 아님 (참고용)

- **인젝션**: `codebase/backend/test/users-change-password.e2e-spec.ts` 의 신규 e2e 케이스가 `UPDATE "user" SET password_hash = NULL WHERE id = $1` 를 파라미터 바인딩(`$1`)으로 실행한다 — 문자열 결합 없음, SQL 인젝션 표면 아님.
- **암호화**: `comparePassword`/`hashPassword`(bcrypt, `BCRYPT_ROUNDS = 12`)는 이번 diff 로 변경되지 않았다. 새 코드 경로도 전부 기존 `comparePassword` 헬퍼를 그대로 재사용한다.
- **인증/인가**: `changePassword`·`verifyPasswordForUser`·`verifyReauth` 세 호출부 모두 `@CurrentUser()`(JWT `sub`) 기반 self-scope 이고, `UsersController` 는 클래스 레벨 `@UseGuards(JwtAuthGuard)` 로 보호된다. 이번 diff 는 가드·인가 로직을 건드리지 않는다.
- **에러 처리**: 새 예외 메시지(`'비밀번호가 설정되지 않은 계정이에요. 비밀번호 재설정으로 먼저 설정해 주세요.'`, `'현재 비밀번호가 일치하지 않아요.'`)에 스택트레이스·내부 경로·DB 오류·시크릿 등 민감 정보 없음. FE 가 서버 `message` 를 그대로 노출하는 패턴(`axiosMessage`)은 이번 diff 이전부터 있던 기존 동작이라 회귀가 아니다.
- **의존성**: 이번 diff 는 `package.json`/lockfile 을 건드리지 않는다. 신규 서드파티 의존성 도입 없음.
- **타이밍**: `passwordHash` 부재 시 `comparePassword` 호출 없이 조기 반환하는 분기 순서는 diff 이전부터 있던 구조(코드 값만 바뀜)이고, 모든 경로가 인증 후 self-scope 라 익명 사용자가 이 타이밍차로 임의 계정의 OAuth-only 여부를 알아낼 수 있는 표면이 아니다.

## 저장소 상태 관측 (내 뮤테이션 아님)

리뷰 중 `git status --short` 를 반복 확인하는 과정에서, 이 저장소 파일 자체는 건드리지 않았음에도
`codebase/backend/src/modules/users/users.service.ts.bak` 신규 파일과
`codebase/backend/src/modules/auth/sessions.service.ts` 의 일시적 diff(`if (ok) return;` →
`return; // MUTATION: never throw, always succeed`)가 관측됐다 — 다른 병렬 reviewer 의 뮤테이션
테스트 중간 상태로 보인다(동시 fan-out 리뷰 규약에 명시된 시나리오). 두 관측 모두 후속 폴링에서
사라졌고 `git status --short` 는 이 세션 산출물(`review/code/2026/09/03/**`,
`review/consistency/2026/09/03/**`) 외에는 clean 함을 최종 확인했다. 내가 직접 만든 잔여물은 없다.

## 요약

이번 변경은 비밀번호 재확인 실패에 대해 이전에는 동일 코드/메시지로 뭉뚱그려졌던 "OAuth-only(비밀번호 미설정)"와 "비밀번호 불일치" 두 조건을 형제 흐름이 이미 쓰던 코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)로 정렬하는 순수 리팩터다. 신규 인젝션·하드코딩 시크릿·인가 우회·안전하지 않은 암호화·민감정보 노출 에러 처리·취약 의존성 도입 어느 것도 발견되지 않았다. 새로 명시화되는 "비밀번호 설정 여부" 신호는 모든 호출부가 JWT 기반 self-scope 로만 동작함을 컨트롤러 가드·`@CurrentUser()` 체인 직접 추적으로 확인했으므로 계정 열거로 이어지지 않는다. 유일하게 참고할 점은 `changePassword` 엔드포인트에 여전히 rate limiting 이 없다는 것(이번 diff 이전부터의 기존 상태, 스코프 밖)뿐이다.

## 위험도

NONE
