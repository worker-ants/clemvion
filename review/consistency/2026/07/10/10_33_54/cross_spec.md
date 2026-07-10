# Cross-Spec 일관성 검토 — auth-reauth-spec-accuracy

## 검증 방법
target(`plan/in-progress/auth-reauth-spec-accuracy.md`)의 코드 검증 표(REAUTH_REQUIRED=400·PASSWORD_INVALID=401·TOTP_INVALID=401·REAUTH_NOT_AVAILABLE=403 및 발행처)를 `sessions.service.ts`(`verifyReauth`, L244-291)·`auth.service.ts`(`verifyPasswordForUser` L58-84, 로그인 2FA L420-455, 로그인 실패 L287/318/333/350)·`users.service.ts`(`changePassword` L61-84)·`webauthn.controller.ts`(L372)·`auth.controller.ts`(L342) 원본과 대조. 전부 일치 확인. `spec/2-navigation/9-user-profile.md`(L112/333/341/342)·`spec/data-flow/2-auth.md`(L193-248)는 이미 "비밀번호 또는 TOTP" 로 정합해, target 이 주장하는 "§2.3 만 outlier" 진단도 확인됨. 아래는 이 검증 과정에서 발견된 target 자체의 잔여 부정합.

## 발견사항

### [WARNING] 신규 §1.2.1 주석(변경 2b)이 `login_history` 의 `event` 값과 `failure_reason` 값을 혼동 + `INVALID_PASSWORD` 를 두 개의 다른 소스로 무구분 병기
- target 위치: "변경 2 — `spec/5-system/3-error-handling.md`" § 2b (§1.2.1 하단 주석 교체) — "실패 사유는 `login_history.failure_reason`(`INVALID_PASSWORD`·`totp_failed` 등, §4.3) 이벤트 문자열로 감사 기록된다."
- 충돌 대상: `spec/1-data-model.md` §2.18.2 LoginHistory (line 705) `failure_reason | String? | INVALID_PASSWORD / ACCOUNT_LOCKED / TOTP_INVALID / WEBAUTHN_INVALID / WEBAUTHN_COUNTER_REGRESSION 등` + 코드 `codebase/backend/src/modules/auth/auth.service.ts:445-451`(`event: 'totp_failed', failureReason: 'TOTP_INVALID'`)
- 상세: 코드·데이터 모델 모두 `totp_failed` 는 `login_history.event` 컬럼 값이고, 로그인 TOTP 실패의 `failure_reason` 값은 `TOTP_INVALID` 이다(`totp_failed` 가 아님). target 의 2b 교체문은 이 둘을 같은 괄호 안에 "`failure_reason`(`INVALID_PASSWORD`·`totp_failed` 등)" 으로 병기해 `totp_failed` 를 마치 `failure_reason` 값처럼 서술한다. 흥미롭게도 **현재(수정 전) `3-error-handling.md:64` 는 이를 "`login_history` 이벤트값 `totp_failed`" 로 정확히 "이벤트값" 이라 명시**하고 있어, target 의 교체는 기존에 맞던 표현을 부정확하게 바꾸는 **회귀**다.
  - 부가로 같은 문단 안에서 `INVALID_PASSWORD` 문자열이 두 가지 다른 출처를 가리키며 구분 없이 등장한다: (a) 로그인 실패 시 `login_history.failure_reason='INVALID_PASSWORD'`(`auth.service.ts:347`, 로그인 엔드포인트는 클라이언트에는 `LOGIN_FAILED` 만 반환), (b) `changePassword` 가 반환하는 실제 API 에러 `code: 'INVALID_PASSWORD'`(`users.service.ts:76,84`, OAuth-only 차단 및 현재 비밀번호 불일치 공용). target 이 이미 "근접 명명 주의" 로 `PASSWORD_INVALID` vs `INVALID_PASSWORD` 를 구분해 놓고도, 같은 문단에서 `INVALID_PASSWORD` 자체가 로그인 감사값과 changePassword API 코드라는 서로 다른 두 이벤트를 가리키는 동음이의라는 점은 별도로 구분하지 않는다.
- 제안: 2b 교체문에서 "로그인 실패 사유" 문장을 이벤트 값과 failure_reason 값으로 분리 — 예: "…실패 사유는 `login_history` 이벤트 `login_failed`(`failure_reason=INVALID_PASSWORD`) 또는 `totp_failed`(`failure_reason=TOTP_INVALID`) 로 §4.3 에 감사 기록된다." 형태로 정정하고, 필요하면 `INVALID_PASSWORD` 가 changePassword API 코드와 동일 문자열을 공유(로그인 failure_reason ≠ changePassword 에러코드, 별개 출처)한다는 점도 한 문장으로 명시.

### [INFO] §2.3 신규 행·Rationale 2.3.D 가 "WebAuthn step-up 일반화는 `refactor-auth-reverify-unify` 영역" 서술을 확산 — 해당 완료 plan 의 실제 범위와 불일치 우려
- target 위치: "변경 1a" 신규 §2.3 표 행 — "challenge/response step-up 일반화는 Rationale 1.1.B-4·2.3.D(`refactor-auth-reverify-unify` 영역)"; "변경 1e" 신규 Rationale §2.3.D 서술
- 충돌 대상: `plan/complete/refactor-auth-reverify-unify.md` (전체 본문)
- 상세: 이 문구는 기존 Rationale 1.1.B-4(`1-auth.md:516`, 미변경 유지)에 이미 있던 것을 target 이 새 위치(§2.3 표 행)에 그대로 반복 인용한다. 그러나 `plan/complete/refactor-auth-reverify-unify.md` 를 실측하면 그 작업 범위는 "webauthn/sessions raw bcrypt → `comparePassword` 헬퍼 통합"(behavior-preserving) + spec 문서화 백로그일 뿐, "WebAuthn step-up 재인증 일반화"를 다루거나 계획한 흔적이 전혀 없다(§"범위 밖 / 후속" 목록에도 없음). 게다가 이 plan 은 **이미 complete 로 종결**돼 있어, 향후 "WebAuthn step-up 구현" 담당자가 이 pointer 를 따라가면 이미 닫힌·무관한 plan 에 도달하는 dead-end 가 된다. target 은 이 인용을 새 위치(§2.3 표)에 전파하기 전에 실제 소유 plan/작업을 재확인하지 않았다(pre-existing 오귀속을 검증 없이 복제).
- 제안: 본 작업 범위는 아니므로 즉시 fix 강제는 아니나, 후속 결정 필요 — (a) WebAuthn step-up 재인증 구현을 담당할 **신규 plan** 이 없다면 "refactor-auth-reverify-unify 영역" 표현을 "미착수(신규 plan 필요)" 로 완화하거나, (b) 실제로 그 plan 범위에 포함할 의도라면 `refactor-auth-reverify-unify.md` 를 재오픈하거나 후속 plan 을 만들어 pointer 를 갱신. 최소한 target 이 이 서술을 새 위치에 반복하기 전에 plan 실체를 1회 확인했다는 점을 Rationale 에 남기는 것을 권고.

## 요약
target 의 핵심 diagnosis(§2.3 "강제 종료 재인증" 행이 WebAuthn/이메일 OTP 를 언급하는 것은 구현·`9-user-profile.md`·`data-flow/2-auth.md`·Rationale 1.1.B-4 와 어긋나는 outlier)와 코드 검증 표(REAUTH_REQUIRED=400·PASSWORD_INVALID=401·TOTP_INVALID=401·REAUTH_NOT_AVAILABLE=403 및 각 발행처)는 `sessions.service.ts`/`auth.service.ts`/`users.service.ts`/`webauthn.controller.ts`/`auth.controller.ts` 원본과 전부 일치하며, 이미 이 진단에 맞춰 정렬돼 있는 `9-user-profile.md`·`data-flow/2-auth.md` 와도 충돌이 없다. 다만 target 이 새로 쓰는 §1.2.1 주석(변경 2b)이 `login_history.event`(`totp_failed`)와 `failure_reason`(`TOTP_INVALID`)을 혼동해 `spec/1-data-model.md` LoginHistory 정의와 새로 어긋나는 문서 정확도 회귀가 있고(WARNING), §2.3 신규 행이 반복 인용하는 "WebAuthn step-up 은 `refactor-auth-reverify-unify` 영역" 서술은 그 완료 plan 의 실제 범위와 맞지 않아 향후 pointer 가 dead-end 될 소지가 있다(INFO, pre-existing 확산). 두 건 모두 스펙 간 직접 모순으로 기능이 깨지는 수준은 아니며 문서 정확도 보정 성격이다.

## 위험도
LOW
