# 신규 식별자 충돌 검토 — `spec/5-system/1-auth.md` · `spec/5-system/3-error-handling.md`

## 검토 대상 델타 (실측)

`git diff origin/main...HEAD -- spec/ codebase/` 기준 실제 변경분:

- `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md`, `spec/2-navigation/9-user-profile.md`, `spec/conventions/error-codes.md`
- `codebase/backend/src/common/utils/password.util.ts`(신규 export), `auth.service.ts`, `sessions.service.ts`, `users/users.service.ts` + 대응 spec/e2e 테스트

변경 요지: `POST /users/me/change-password` (`UsersService.changePassword`)가 기존에 미설정(OAuth-only)·불일치 두 조건 모두에 `INVALID_PASSWORD`(401) 단일 코드를 발행하던 것을, 형제 흐름(`AuthService.verifyPasswordForUser`, `SessionsService.verifyReauth`)이 이미 쓰던 `PASSWORD_REQUIRED`(미설정)/`PASSWORD_INVALID`(불일치) 두 코드로 갈랐다. `INVALID_PASSWORD` 는 wire 코드에서 은퇴하고 `login_history.failure_reason` 감사값으로만 남는다.

## 발견사항

이 델타는 **신규 식별자를 도입하지 않는다** — 오히려 기존에 존재하던 근접 명명(`INVALID_PASSWORD` vs `PASSWORD_INVALID`)으로 인한 혼선을 해소하는 방향의 변경이다. 6개 점검 관점을 각각 확인한 결과는 다음과 같다.

- **[INFO]** 코드 재사용은 target 문서가 스스로 근거를 밝히며 수행 — 충돌 아님
  - target 신규 식별자: 없음. `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 는 `changePassword` 호출부에 **새로 도입**된 것이 아니라, `AuthService.verifyPasswordForUser`(기존)·`SessionsService.verifyReauth`(기존)가 이미 발행하던 코드를 **재사용**한 것.
  - 기존 사용처: `codebase/backend/src/modules/auth/auth.service.ts:75,82`(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`, 이미 존재), `codebase/backend/src/modules/auth/sessions.service.ts:270`(`PASSWORD_INVALID`, 이미 존재) · spec 문서로는 `spec/5-system/1-auth.md:521`(민감 동작 재확인 코드, 기존 서술) · `spec/5-system/3-error-handling.md:65-66`(§1.2.1 카탈로그, 기존 등재).
  - 상세: target(`spec/5-system/1-auth.md:339`, `spec/5-system/3-error-handling.md:53,65-66`, `spec/conventions/error-codes.md:175`)은 이 재사용을 "형제 흐름과 동일 코드 공유" 로 명시하고, 새 코드(`PASSWORD_NOT_SET` 등)를 검토했으나 근접 명명을 3종→4종으로 늘리는 데다 그 이름이 `login_history.failure_reason` 감사값과 wire/audit 동명 충돌을 재생산할 것이라 채택하지 않았다고 밝힌다(`error-codes.md:175`). 실제 코드(`password.util.ts`)도 `PASSWORD_VERIFY_CODES` 상수 하나로 두 발행처(`auth.service.ts`·`sessions.service.ts`·`users.service.ts`)를 묶어 재정의를 막았다. 즉 이 검토 관점(요구사항 ID/엔티티/endpoint/이벤트/env/파일경로 충돌)에 해당하는 **새 식별자 자체가 없다** — 충돌 판정 대상이 아니다.
  - 제안: 없음 (현행 유지). 다만 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 코드가 이제 3개 발행처(`verifyPasswordForUser`·`verifyReauth`·`changePassword`)를 공유하게 됐으므로, 프론트엔드가 이 코드로 분기할 계획이 생기면 발행처별 안내 문구(예: `changePassword` 는 OAuth-only 사용자에게 "비밀번호 추가" 경로 안내)가 코드 하나로는 구분되지 않는다는 점을 UX 설계 시 참고할 것.

- **[INFO]** `INVALID_PASSWORD` 문자열의 레이어 분리가 명시적으로 문서화됨 — 잠재적 동명 충돌이 해소된 사례
  - target 신규 식별자: 없음(기존 문자열 `INVALID_PASSWORD` 의 **역할 축소**).
  - 기존 사용처: `codebase/backend/src/modules/auth/auth.service.ts:348`(`failureReason: 'INVALID_PASSWORD'`, `login_history` 감사값) · `spec/1-data-model.md:710`(`failure_reason` enum 값 목록) · `spec/data-flow/2-auth.md:76`(로그인 실패 시퀀스).
  - 상세: 변경 전에는 `INVALID_PASSWORD` 가 (a) `changePassword` 의 wire 에러 코드와 (b) `login_history.failure_reason` 감사값 두 레이어에서 **동시에** 존재해 근접 명명 위험이 있었다. target 은 (a)를 은퇴시켜 (b) 단일 레이어로 좁혔고, `spec/5-system/1-auth.md:339` · `spec/5-system/3-error-handling.md:69` · `spec/conventions/error-codes.md:175` 세 곳 모두에서 "그 값을 남기는 것은 로그인 실패이지 비밀번호 변경이 아니다" 를 명시해 레이어 혼동을 방지했다. `spec/data-flow/2-auth.md:76`(로그인 실패 시퀀스의 `INVALID_PASSWORD`)는 정합적으로 유지된다 — 별도 정정 불필요.
  - 제안: 없음. 검토자 관점에서 이 정리는 신규 충돌이 아니라 **기존 잠재적 충돌의 해소**로 평가된다.

- **[INFO]** 신규 TS 상수 `PASSWORD_VERIFY_CODES` 는 기존 식별자와 겹치지 않음
  - target 신규 식별자: `PASSWORD_VERIFY_CODES`(`codebase/backend/src/common/utils/password.util.ts:30`, `{ REQUIRED: 'PASSWORD_REQUIRED', INVALID: 'PASSWORD_INVALID' }`).
  - 기존 사용처: 저장소 전체(`codebase/`, `spec/`) grep 결과 `PASSWORD_VERIFY_CODES`·`PASSWORD_VERIFY`·`PASSWORD_MIN`·`PASSWORD_POLICY` 등 유사 이름의 기존 정의 없음. env var 목록(`codebase/backend/.env.example`)의 `DB_PASSWORD`·`REDIS_PASSWORD` 와도 이름·의미 모두 무관.
  - 상세: 완전히 새로운 export 이며 charter 범위(auth/sessions/users 3개 발행처) 밖에서 재정의된 동명 상수가 없음을 확인했다. endpoint·엔티티·이벤트·config 키·파일 경로 어느 것도 새로 추가되지 않았다(`POST /users/me/change-password` 는 기존 endpoint 재사용).
  - 제안: 없음.

## 요약

이번 변경은 신규 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·파일 경로를 전혀 새로 도입하지 않는다. 유일한 "새 식별자"는 백엔드의 `PASSWORD_VERIFY_CODES` 상수(기존 미충돌)이며, wire 에러 코드 차원에서는 오히려 기존에 존재하던 근접 명명(`INVALID_PASSWORD` ↔ `PASSWORD_INVALID`)으로 인한 잠재적 혼선을 형제 흐름과의 코드 공유·문자열 은퇴·레이어 분리 명시로 해소하는 방향이다. target 문서(`1-auth.md`, `3-error-handling.md`, `error-codes.md`)는 이 재사용·은퇴 결정과 근거를 각각의 지점에 상세히 기록했고, `spec/data-flow/2-auth.md`·`spec/1-data-model.md` 등 인접 문서와도 정합적이다. 신규 식별자 충돌 관점에서 이 델타는 문제가 없다.

## 위험도

NONE
