# Plan 정합성 검토 결과

검토 모드: --impl-done (scope=spec/5-system/1-auth.md, diff-base=origin/main)

## 발견사항

### 1. [INFO] `revokeFamily` self-revoke 분기 (currentRefreshToken 5번째 인자) — plan 미추적 개선
- target 위치: `sessions.service.spec.ts` — 새로 추가된 두 테스트 케이스 ("rejects self-revoke (400) when the target family is the current session", "revokes a non-current family even when a current refresh token is present") 및 기존 테스트 호출의 `null` 5번째 인자 일괄 추가.
- 관련 plan: `plan/in-progress/refactor-auth-reverify-unify.md` §변경 항목 3번 ("sessions.service: line 246 `bcrypt.compare`→`comparePassword`") — `revokeFamily` 시그니처 변경(5번째 인자 `currentRefreshToken`) 및 self-revoke 분기 추가는 이 plan 의 변경 목록에 없다.
- 상세: `refactor-auth-reverify-unify.md` 의 변경 3번은 오직 `bcrypt.compare`→`comparePassword` 1줄 교체만 기술하고 있다. 그러나 실제 diff 는 `sessions.service.spec.ts` 에 `revokeFamily` 의 5번째 인자(`currentRefreshToken`, `null` 또는 raw token 값)를 모든 기존 호출에 추가하고, self-revoke 방지 분기를 커버하는 신규 테스트 2건을 포함한다. 이 변경은 `sessions.service.ts` 의 `revokeFamily` 메서드 시그니처 변경(5번째 인자 추가)을 수반하는 것으로 보이며, plan 에서 미언급 범위다. `spec/5-system/1-auth.md` 는 세션 강제 종료(family revoke) 기능을 §2·§4.3 에서 다루나 "self-revoke 방지" 동작이나 `currentRefreshToken` 파라미터는 spec 에 명시되어 있지 않다.
- 제안: `refactor-auth-reverify-unify.md` §변경 3번에 "`revokeFamily` 5번째 인자(`currentRefreshToken`) 추가 + self-revoke(400) 방지 분기 신설" 을 기록. spec 에 self-revoke 방지 동작이 명시되지 않은 경우 INFO 추적 메모 정도이나, spec 에 이 보호가 의도적 설계라면 `spec/5-system/1-auth.md §2` 에 등재가 바람직함(planner 위임).

### 2. [INFO] `webauthn.controller` 생성자 인자 제거(`UsersService`) — `02-architecture.md` C-3 §3 계획과 정합, 별도 누락 없음
- target 위치: `webauthn.controller.ts` — `UsersService` import·생성자 의존 제거, `webauthn.controller.spec.ts` — 생성자에서 `UsersService` 제거.
- 관련 plan: `refactor-auth-reverify-unify.md` §변경 1·2번 — `UsersService` import·생성자 의존 제거를 명시. `refactor/02-architecture.md` C-3 §3 의 "후속(통일 미완): webauthn.controller.ts 의 raw bcrypt 도 같은 메서드로 통일".
- 상세: 정합. 계획된 변경이 정확히 구현됐고 plan 과 상충 없음.
- 제안: 없음.

### 3. [INFO] `refactor-c3-auth-bcrypt-service.md` 완료 상태와 `refactor-auth-reverify-unify.md` 의 관계
- target 위치: `sessions.service.ts` / `webauthn.controller.ts` 변경 전반.
- 관련 plan: `refactor-c3-auth-bcrypt-service.md` ("단일진실 완성(C-3 §3): webauthn.controller.ts:369-386·sessions.service.ts:244-252 의 raw bcrypt → authService.verifyPasswordForUser 통합 — 범위 밖/후속"), `refactor-auth-reverify-unify.md` (이를 수행하는 후속 plan). `refactor/02-architecture.md` C-3 항목 `[~]` 표기("후속(통일 미완)").
- 상세: 두 plan 의 연쇄가 논리적으로 정합하며, 현재 target diff 는 후속 plan(`refactor-auth-reverify-unify.md`)이 적절히 지정한 범위를 구현하고 있다. 단, `refactor-auth-reverify-unify.md` 체크리스트에 `/ai-review`·`/consistency-check --impl-done` 이 아직 미완료(`[ ]`)로 표시돼 있고, 이 검토 자체가 그 일환이다.
- 제안: 없음(현재 프로세스가 계획된 순서대로 진행 중).

### 4. [INFO] `spec/5-system/1-auth.md` 에 self-revoke 동작 미명시 — 후속 spec 보완 후보
- target 위치: `sessions.service.spec.ts` 신규 테스트 주석 "[ai-review C-3 §3 W#2/W#3] self-revoke 방지 분기(currentRefreshToken) 커버리지".
- 관련 plan: `refactor-auth-reverify-unify.md` §범위 밖/후속 — spec 드리프트 항목에 self-revoke 동작은 미포함.
- 상세: `spec/5-system/1-auth.md §2·§4.3` 은 family revoke 기능을 기술하나, "현재 세션의 family 는 self-revoke 불가(400)" 정책은 언급하지 않는다. 이 보호 동작이 구현됐다면 spec 등재 후보다. `refactor-auth-reverify-unify.md` 의 §범위 밖 목록에는 spec 드리프트(data-flow/2-auth.md 갱신 등) 만 있고 이 항목은 없다.
- 제안: `refactor-auth-reverify-unify.md` §범위 밖/후속에 "self-revoke 방지(`currentRefreshToken` 파라미터) 동작을 `spec/5-system/1-auth.md §2` 세션 강제 종료 절에 명시 — planner 위임" 추적 항목 추가.

## 요약

target diff 는 `refactor-auth-reverify-unify.md` 계획과 대체로 정합하다. `webauthn.controller` 의 `verifyPasswordForUser` 위임 및 `sessions.service` 의 `comparePassword` 교체는 plan 이 명시한 변경 1·2·3번에 부합한다. 단, `sessions.service.spec.ts` 에 포함된 `revokeFamily` 5번째 인자(`currentRefreshToken`) 추가 및 self-revoke 방지 테스트 2건은 plan 의 "변경 3번" 기술 범위를 넘으며, 이 동작이 `spec/5-system/1-auth.md` 에 미명시된 점이 INFO 수준 추적 항목이다. 미해결 결정과의 충돌(CRITICAL)이나 선행 plan 미해소(WARNING)는 없다. 발견사항 전부 INFO 등급이고 플로우는 차단 불필요.

## 위험도

LOW
