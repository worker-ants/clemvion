# 신규 식별자 충돌 검토 — `spec/5-system/1-auth.md` · `spec/5-system/3-error-handling.md` (impl-done)

## 검토 대상 요약

target 델타는 `change-password`(`UsersService.changePassword`)의 실패 코드를 형제 흐름
(`AuthService.verifyPasswordForUser`)과 정렬하는 변경이다. 새로 도입되는 식별자는 다음
한 가지뿐이다.

- TS 상수 `PASSWORD_VERIFY_CODES` (`codebase/backend/src/common/utils/password.util.ts`) —
  `{ REQUIRED: 'PASSWORD_REQUIRED', INVALID: 'PASSWORD_INVALID' }`

나머지는 "신규 코드 생성" 이 아니라 **기존에 이미 존재하던 wire 코드
(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`, `verifyPasswordForUser` 전용)의 발행 범위를
`changePassword` 로 확장**하고, 종전 `changePassword` 전용 코드였던 `INVALID_PASSWORD` 를
wire 에서 은퇴시키는 구성이다.

## 발견사항

### [INFO] `PASSWORD_VERIFY_CODES` 상수명 — 충돌 없음, 확인 완료

- target 신규 식별자: `PASSWORD_VERIFY_CODES` (export const, `password.util.ts:30`)
- 기존 사용처: 저장소 전수 grep(`PASSWORD_VERIFY_CODES`) 결과 이 파일이 유일한 정의처이고,
  소비처는 `auth.service.ts`·`sessions.service.ts`·`users.service.ts` 세 곳뿐이다(모두 이
  PR 의 diff 안에서 새로 추가된 import). 동명의 다른 상수·타입·DTO 는 없다.
- 상세: 이름 공간(`common/utils`)·명명 규칙(UPPER_SNAKE 값 + PascalCase 상수) 모두 기존
  컨벤션과 정합하며 충돌 후보가 없다.
- 제안: 없음.

### [INFO] `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 발행 범위 확장 — 의도된 통합이며 사전에 충돌 검토됨

- target 신규 식별자(엄밀히는 "신규"가 아니라 "발행처 확장"): `changePassword` 가 이제
  기존 코드 `PASSWORD_REQUIRED`(401, 비밀번호 미설정)·`PASSWORD_INVALID`(401, 불일치)를
  발행한다.
- 기존 사용처: `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 는 이미 `AuthService.verifyPasswordForUser`
  (2FA 비활성화·WebAuthn 복구코드 재발급 재확인, `auth.service.ts:75,82`)와
  `SessionsService.verifyReauth`(`PASSWORD_INVALID` 만, `sessions.service.ts:270`)가 발행 중이었다
  (`spec/5-system/3-error-handling.md` §1.2.1, `spec/conventions/error-codes.md`).
- 상세: 같은 문자열이 여러 호출부에서 같은 의미(비밀번호 미설정/불일치)로 쓰이는 것은
  "충돌"이 아니라 **의도된 코드 공유**다 — `spec/5-system/1-auth.md:339`, `3-error-handling.md`
  §1.2.1 근접 명명 주석, `spec/conventions/error-codes.md` §5 등급 B 은퇴 행이 모두 이
  통합을 명시하고 근거(형제 흐름과의 정합, FE 가 이 코드로 분기하지 않음 — 전수 grep 0건
  실측)를 남긴다. 실제 코드도 문서 주장과 정확히 일치함을 확인했다(`git grep` 재현).
- 제안: 없음 — 문서화·근거·실측이 모두 갖춰진 의도적 통합.

### [INFO] 은퇴된 `INVALID_PASSWORD` 의 잔존 — 레이어가 달라 충돌 아님, 이미 명시됨

- target 신규 식별자: 해당 없음(이번 변경은 `INVALID_PASSWORD` 를 **제거**하는 쪽).
- 기존 사용처: `AuthService.login` 이 로그인 실패 감사값으로
  `failureReason: 'INVALID_PASSWORD'` 를 여전히 발행한다(`auth.service.ts:348`,
  `login_history.failure_reason`, `spec/1-data-model.md:710`).
- 상세: wire 에러 코드(HTTP 응답 `error.code`)로서의 `INVALID_PASSWORD` 는 이 PR 로
  0건이 됐음을 확인했다(전수 grep — 남은 매치는 전부 주석·spec 산문·audit 값·과거 plan
  이력). 감사값으로서의 잔존은 `spec/5-system/3-error-handling.md` §1.2.1 근접 명명
  주석과 `spec/conventions/error-codes.md` §5 해당 행이 "**로그인 실패**가 남기는 것이지
  비밀번호 변경이 아니다" 로 명시적으로 레이어를 분리해 뒀다. 동일 문자열이 서로 다른
  레이어(wire 코드 vs audit 사유값)에 존재하는 것은 이 저장소의 기존 컨벤션
  (`already_a_member`/`ALREADY_A_MEMBER` 등)과 동형이라 새로운 위험이 아니다.
- 제안: 없음.

### [INFO] 기각된 후보 `PASSWORD_NOT_SET` — 이미 이전 라운드에서 충돌 확인 후 회피됨

- target 이 도입하지 않은 식별자이지만, 검토 이력상 언급할 가치가 있다: 계획 문서
  (`plan/in-progress/auth-change-password-oauth-only-code-split.md` §"선택지")는 신규 코드
  `PASSWORD_NOT_SET` 신설안(B)을 검토했다가 기각했다.
- 기존 사용처: `PASSWORD_NOT_SET` 은 이미 `AuthService.login` 의
  `failureReason: 'PASSWORD_NOT_SET'` 로 존재한다(`auth.service.ts:331`, 실측 확인 —
  OAuth-only 계정이 이메일/비밀번호 로그인을 시도할 때의 audit 사유값).
- 상세: 만약 이 후보가 채택돼 wire 코드로 신설됐다면, 지금 은퇴시키는 `INVALID_PASSWORD`
  와 동일한 **wire/audit 동명 충돌**을 새 이름으로 재생산했을 것이다. `error-codes.md`
  §5 해당 행 자체가 "이 판단은 직전 라운드 naming_collision INFO#5 가 알려줬다" 고
  명시한다 — 즉 이번 target 은 그 충돌을 피해 설계됐다.
- 제안: 없음 — 이미 회피된 리스크. 향후 `PASSWORD_NOT_SET` 을 wire 코드로 쓰려는
  시도가 있으면 이 audit 사유값과의 충돌을 다시 상기시킬 것.

## 그 외 점검 관점 (해당 없음)

- **요구사항 ID**: target 델타에 신규 요구사항 ID 부여 없음.
- **엔티티/타입명**: 신규 엔티티·DTO·인터페이스 없음(`PASSWORD_VERIFY_CODES` 는 값 객체
  상수이며 위에서 다룸).
- **API endpoint**: 신규 endpoint 없음. 기존 `POST /api/users/me/change-password` 의
  응답 `body.error.code` 값만 바뀐다(계약 변경이지 endpoint 충돌 아님 — breaking 영향은
  `error-codes.md` §5 등급 B 로 이미 인수·기록됨, 이 checker 의 관점 밖).
- **이벤트/메시지명**: webhook·queue·SSE 이벤트 신설 없음.
- **환경변수·설정키**: 신규 ENV/config 없음.
- **파일 경로**: 신규 spec 파일 없음(기존 `1-auth.md`·`3-error-handling.md` 본문 수정만).

## 요약

이번 target 델타가 새로 도입하는 유일한 식별자(`PASSWORD_VERIFY_CODES` 상수)는 저장소
전체에서 고유하며 충돌이 없다. 나머지는 "신규 식별자"가 아니라 기존 wire 코드
(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)의 발행 범위 확장과, 그로 인한 구 코드
(`INVALID_PASSWORD`)의 wire 은퇴다 — 두 변화 모두 `spec/5-system/1-auth.md`·
`3-error-handling.md`·`spec/conventions/error-codes.md` §5 에 근접 명명·레이어 분리·근거가
상세히 기록돼 있고, 실제 코드(`git grep` 재현)가 그 문서 주장과 정확히 일치함을 확인했다.
특히 검토 이력(`plan/in-progress/auth-change-password-oauth-only-code-split.md`)은 실제로
존재하는 audit 사유값(`PASSWORD_NOT_SET`)과의 wire/audit 동명 충돌 후보를 사전에 식별해
회피한 사례를 담고 있어, 이 관점의 검토가 이미 설계 단계에 반영돼 있었다. 신규 식별자
충돌 관점에서 차단 사유는 없다.

## 위험도

NONE
