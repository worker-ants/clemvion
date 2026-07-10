# 신규 식별자 충돌 검토 — `plan/in-progress/catalog-residual-codes.md`

## 검토 방법
target 이 신규 도입하는 3개 에러 코드(`NOT_A_MEMBER` · `INVALID_PASSWORD` · `PASSWORD_REQUIRED`)와 참조 코드(`PASSWORD_INVALID` · `REAUTH_REQUIRED` · `ALREADY_A_MEMBER` · `WORKSPACE_TYPE_MISMATCH`)를 `spec/`·`plan/in-progress/`·`codebase/backend/src` 전체에서 grep 하고, 각 발행처(`auth.service.ts`·`users.service.ts`·`workspaces.service.ts`)의 실제 throw 지점 코드를 읽어 의미 일치 여부를 확인했다.

## 발견사항

### [INFO] `INVALID_PASSWORD` 동명값의 cross-link 이 단방향
- target 신규 식별자: `INVALID_PASSWORD` (spec/5-system/3-error-handling.md §1.2, `POST /users/me/change-password` API 코드로 신규 등재)
- 기존 사용처: `spec/1-data-model.md:705` (`LoginHistory.failure_reason` enum 값) · `spec/data-flow/2-auth.md:76` (로그인 비밀번호 불일치 시 `event=login_failed reason=INVALID_PASSWORD` 감사 기록)
- 상세: 동일 문자열 `INVALID_PASSWORD` 가 (a) target 이 신규 등재하는 `changePassword` 의 wire 에러 코드와 (b) 로그인 실패 감사값(`login_history.failure_reason`)이라는 **두 개의 독립된 의미**로 이미 쓰이고 있다. 이 중복은 target 이전부터 존재했고(`3-error-handling.md:67` 기존 각주가 이미 "동명값" 주의를 언급), target 의 2a 행 설명("`login_history.failure_reason` 동명값과 별개")도 명시적으로 disambiguate 한다. 다만 이 disambiguation 은 `3-error-handling.md` 쪽에만 있고, 값의 원 정의처인 `1-data-model.md:705`·`data-flow/2-auth.md:76` 에는 역참조가 없다 — 카탈로그 등재로 `INVALID_PASSWORD` 의 가시성이 높아지는 시점이라 반대 방향 참조 부재가 더 눈에 띄게 된다.
- 제안: (본 plan 의 필수 차단 사항은 아님) 후속으로 `1-data-model.md` failure_reason 행 또는 `data-flow/2-auth.md` 다이어그램 주석에 "changePassword API 코드 `INVALID_PASSWORD`(3-error-handling §1.2)와 동명이나 별개 wire 코드" 1줄을 추가하면 충돌 여지가 완전히 닫힌다.

### [INFO] `NOT_A_MEMBER` 는 이미 코드 3곳에서 통일된 의미로 발행 중 — 신규 정의 아님 확인
- target 신규 식별자: `NOT_A_MEMBER` (spec/5-system/3-error-handling.md §1.2, 신규 등재)
- 기존 사용처: `codebase/backend/src/modules/auth/auth.service.ts:1134`(workspace switch) · `codebase/backend/src/modules/workspaces/workspaces.service.ts:553`(leave) · `:729`(assertMembership) · `spec/5-system/1-auth.md:485` · `spec/data-flow/12-workspace.md:113,123`
- 상세: 3개 발행처 모두 `ForbiddenException({ code: 'NOT_A_MEMBER', message: '워크스페이스 멤버가 아닙니다.' })` 로 완전히 동일한 의미(대상 워크스페이스 비멤버)를 사용한다. target 의 §1.2 행 설명("전환 ... 탈퇴 · 멤버십 확인 경로")이 3곳 모두를 정확히 포괄해 의미 충돌이 없다. 순수 정보성 확인.
- 제안: 없음 (그대로 진행 가능).

### [INFO] `PASSWORD_REQUIRED` — 코드·spec 전역에 유일한 발행처, 충돌 없음
- target 신규 식별자: `PASSWORD_REQUIRED` (spec/5-system/1-auth.md §5 note + spec/5-system/3-error-handling.md §1.2.1, 신규)
- 기존 사용처: 없음 — `codebase/backend/src/modules/auth/auth.service.ts:74`(`verifyPasswordForUser`) 단일 발행처, 다른 spec/backend 어디에도 이 식별자가 다른 의미로 쓰이지 않음(grep 전수 확인).
- 상세: `PASSWORD_INVALID`(mismatch) · `REAUTH_REQUIRED`(재인증 missing, 400) · `INVALID_PASSWORD`(변경) 와의 4중 근접명명 구분도 target 이 §1.2.1 신규 행과 배경 섹션에서 명시적으로 disambiguate 하고 있어 문제 없음.
- 제안: 없음.

### [INFO] 신규 API endpoint · ENV var · 파일 경로 없음
- target 은 새 endpoint, 새 config key/ENV var, 새 spec 파일을 도입하지 않는다 — 기존 두 파일(`1-auth.md`·`3-error-handling.md`)의 기존 섹션(§1.2, §1.2.1, §5)에 행·note 를 추가할 뿐이다. 참조하는 endpoint(`/api/auth/workspaces/:id/switch`·`/users/me/change-password`·`/api/auth/2fa/disable`·`/api/auth/2fa/webauthn/recovery-codes/regenerate`)는 모두 기존 spec 에 이미 정의된 endpoint 를 재사용하는 서술이라 endpoint 충돌 해당 없음.
- 상세/제안: 해당 없음.

### [INFO] 범위 제외 코드(`ALREADY_A_MEMBER`·`WORKSPACE_TYPE_MISMATCH`)와의 경계 명확
- target 의 "범위 밖" 절이 `ALREADY_A_MEMBER`·`WORKSPACE_TYPE_MISMATCH`(UPPER_SNAKE, `workspaces.service.ts` 직접-추가 경로)를 명시적으로 제외한다. 이 두 코드는 이미 `spec/conventions/error-codes.md:67`·`spec/data-flow/12-workspace.md:179-182` 에 그 lowercase 자매코드(`already_a_member`·`workspace_type_mismatch`, 초대 흐름)와의 "동일 의미·별개 wire 코드, 의도적 분리" 구분이 문서화돼 있다. target 이 이 영역을 건드리지 않아 새 충돌 표면이 생기지 않는다.
- 상세/제안: 해당 없음.

## 요약
target 이 신규 도입하는 3개 식별자(`NOT_A_MEMBER`·`INVALID_PASSWORD`·`PASSWORD_REQUIRED`) 는 모두 코드베이스 실제 발행처와 1:1 로 정확히 대응하며, 기존 spec/코드 어디에도 다른 의미로 쓰이는 곳이 없다(`NOT_A_MEMBER`·`PASSWORD_REQUIRED`는 코드상 단일 의미로 이미 통일, `PASSWORD_REQUIRED`는 완전 신규). 유일한 잔여 사항은 `INVALID_PASSWORD` 가 `login_history.failure_reason` 감사값과 동명(pre-existing, target 이전부터 존재)이라는 점인데, target 자신의 §1.2 행 설명이 이를 이미 명시적으로 disambiguate 하고 있어 실질적 위험은 낮다(단방향 cross-link 미비만 잔존, INFO). 신규 endpoint·ENV·config key·파일 경로 도입이 없어 그 축의 충돌 가능성도 없다. CRITICAL/WARNING 급 신규 식별자 충돌은 발견되지 않았다.

## 위험도
LOW
