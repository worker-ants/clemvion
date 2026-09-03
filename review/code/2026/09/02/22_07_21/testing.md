# 테스트(Testing) 리뷰 — `PASSWORD_VERIFY_CODES` 정렬 (change-password / verifyPasswordForUser / verifyReauth)

## 발견사항

- **[WARNING]** `sessions.service.ts` 의 변경 분기가 `sessions.service.spec.ts` 에서 코드값 단언 없이 클래스만 검증됨 — 이 PR 이 직접 문서화한 drift 재발 패턴과 동일
  - 위치: `codebase/backend/src/modules/auth/sessions.service.ts:270` (`code: PASSWORD_VERIFY_CODES.INVALID,`) / 테스트는 `codebase/backend/src/modules/auth/sessions.service.spec.ts:170` (`it('rejects with 401 on wrong password', ...)`)
  - 상세: `sessions.service.ts` 의 `verifyReauth`(비밀번호 불일치 분기)가 리터럴 `'PASSWORD_INVALID'` 대신 공유 상수 `PASSWORD_VERIFY_CODES.INVALID` 를 쓰도록 이번 diff 에서 바뀌었다. 그런데 이를 검증하는 유일한 테스트(`rejects with 401 on wrong password`, 이번 diff 로 손대지 않은 기존 테스트)는 `.rejects.toThrow(UnauthorizedException)` 로 **예외 클래스만** 단언하고 응답의 `code` 필드는 전혀 확인하지 않는다(`grep`으로 파일 전체에서 `code`/`getResponse` 단언 0건 확인). 바로 이 PR 이 `users.service.spec.ts` 에 새로 추가한 주석이 정확히 이 패턴을 지목한다 — *"종전 테스트는 예외 클래스만 단언했는데 두 분기가 같은 클래스라 통과했고, 그래서 drift 가 보이지 않았다"*. `PASSWORD_VERIFY_CODES` 는 이제 3개 소비처(`auth.service.ts`, `sessions.service.ts`, `users.service.ts`)를 갖는데, 리터럴로 코드값을 직접 핀 고정하는 곳은 `auth.service.spec.ts`(`verifyPasswordForUser` — REQUIRED/INVALID 둘 다)와 `users.service.spec.ts`(이번 diff, REQUIRED/INVALID 둘 다) 뿐이다. `sessions.service.spec.ts` 만 여전히 코드값 회귀에 무방비 — 예컨대 `PASSWORD_VERIFY_CODES.INVALID` 값이 실수로 바뀌거나 이 호출부에서만 상수 대신 오타 리터럴로 되돌아가도 이 테스트는 그대로 통과한다.
  - 제안: `sessions.service.spec.ts` 의 `rejects with 401 on wrong password` 테스트(또는 인접 신규 테스트)에 `err.getResponse()` 로 `{ code: 'PASSWORD_INVALID' }` 를 **리터럴로** 단언하는 줄을 추가한다(상수 재참조 금지 — 이 PR 자신의 원칙).

- **[WARNING]** OAuth-only 계정의 `PASSWORD_REQUIRED` wire 동작 변경에 대한 e2e(HTTP 계약) 커버리지 부재
  - 위치: `codebase/backend/test/users-change-password.e2e-spec.ts` (새 `it()` 없음 — 기존 `it('rejects wrong current password → 401 PASSWORD_INVALID...')` 블록만 리터럴 갱신, `:94-95` 주석에 "미설정(OAuth-only)은 형제 코드 PASSWORD_REQUIRED 로 갈린다" 라고만 언급); 관련 열린 항목은 `plan/in-progress/auth-change-password-oauth-only-code-split.md` "할 일" 마지막 미체크 줄(`developer 턴 — ... 단위/e2e ...`)
  - 상세: 이번 PR 의 핵심은 `POST /users/me/change-password` 가 OAuth-only 계정에 대해 응답 코드를 `INVALID_PASSWORD`(구) → `PASSWORD_REQUIRED`(신) 로 바꾸는 **wire 계약 변경**이다. `users.service.spec.ts` 의 유닛 테스트는 이를 잘 잡지만, 실제 HTTP 응답 바디(`res.body.error.code`)까지 검증하는 e2e 테스트는 추가되지 않았다 — 정확히 이 계약을 검증하던 자매 케이스("wrong password → PASSWORD_INVALID")는 e2e 로 있는데 "OAuth-only → PASSWORD_REQUIRED" 는 e2e 가 없어 두 형제 분기의 커버리지 계층이 비대칭이다. e2e 에서 OAuth-only 사용자를 만드는 패턴은 `test/auth-oauth-callback.e2e-spec.ts` 에 이미 존재해 기술적으로 어렵지 않다. `plan/in-progress/auth-change-password-oauth-only-code-split.md` 자신도 "단위/e2e" 를 묶어 아직 미체크(`- [ ]`)로 남겨 두어, 이 갭이 저자에게도 인지된 상태로 보인다 — 다만 완료로 착각하고 넘어가지 않도록 리뷰에서 명시한다.
  - 제안: `users-change-password.e2e-spec.ts` 에 OAuth-only 계정(DB 직접 INSERT 로 `password_hash IS NULL`, 또는 `auth-oauth-callback.e2e-spec.ts` 헬퍼 재사용)으로 change-password 호출 → `401` + `res.body.error.code === 'PASSWORD_REQUIRED'` 를 검증하는 `it()` 을 추가한다.

- **[INFO]** `PASSWORD_VERIFY_CODES` 상수 자체(SoT)를 직접 pin 하는 단위 테스트가 `password.util.spec.ts` 에 없음
  - 위치: `codebase/backend/src/common/utils/password.util.spec.ts` (신규 `describe('PASSWORD_VERIFY_CODES', ...)` 부재), 정의부는 `codebase/backend/src/common/utils/password.util.ts:23-28`
  - 상세: 현재는 소비처(`auth.service.spec.ts`, `users.service.spec.ts`)가 리터럴로 간접 pin 하고 있어 실질 위험은 낮다. 다만 상수 정의 파일 자체에 `PASSWORD_VERIFY_CODES.REQUIRED` === `'PASSWORD_REQUIRED'`, `.INVALID` === `'PASSWORD_INVALID'` 를 리터럴로 확인하는 짧은 테스트가 있으면, 정의 자체의 오탈자 회귀를 정의 파일 안에서 바로 잡아 "SoT 는 어디서 검증되는가" 가 한곳으로 모인다.
  - 제안: 선택적. 소비처 3곳 중 2곳이 이미 커버하므로 필수는 아님 — 위 WARNING(sessions.service.spec.ts) 을 고치면 3/3 소비처가 코드값을 핀 하게 돼 이 INFO 의 실효성은 더 낮아진다.

## 회귀·설계 관점에서 확인된 양호 사항 (참고)

- `users.service.spec.ts` 의 신규 테스트들은 이 프로젝트가 반복 지적해 온 "vacuous assertion" 함정을 잘 피했다: `codeOf()` 헬퍼가 resolve 되면 명시적으로 `throw`, 두 분기가 **서로 다른 값**을 내는지 보는 대조군 테스트(`[대조군] 두 실패 분기가 서로 다른 코드를 낸다`)까지 별도로 두어 "같은 값으로 우연히 통과" 를 막는다.
- 코드 단언은 공유 상수가 아니라 **리터럴 문자열**로 쓰도록 스스로 명시(주석 포함) — 테스트가 소스와 같은 상수를 참조해 함께 깨지는 결합을 피한 점이 정확하다. (단, 이 원칙이 `sessions.service.spec.ts` 에는 아직 미적용 — 위 WARNING.)
- `S3Service` 를 조용한 no-op 대신 "호출되면 시끄럽게 실패" 하는 stub 으로 준 것은 이 저장소가 이전에 겪은 "조용한 mock 이 회귀를 가린다" 문제에 대한 적절한 방어다.
- `oauthOnlyUser()` 캐스트는 `User.passwordHash` 타입이 엔티티 실제 nullable 컬럼보다 좁다는 근본 원인을 주석으로 정확히 짚고, 캐스트 지점을 한 곳(factory)으로 모아 이전의 산발적 캐스트보다 테스트 용이성을 개선했다. plan 문서에 별도 후속 작업(타입을 `string | null` 로 넓히기)으로 명시적으로 이월돼 있어 은폐된 기술부채가 아니다.
- `users.controller.spec.ts` 의 mock 리터럴 갱신(`INVALID_PASSWORD` → `PASSWORD_INVALID`)은 해당 테스트가 `code` 값 자체를 단언하지 않으므로(예외 미전파/미회전만 검증) 회귀 위험 없이 정확히 신 코드 체계에 맞춰졌다.
- e2e 스펙(`users-change-password.e2e-spec.ts`)의 "wrong password" 케이스는 HTTP 응답 바디의 `error.code` 를 리터럴로 단언하도록 이미 유지되고 있어, 계약 수준 검증의 틀 자체는 건재하다(OAuth-only 쪽에 같은 틀이 아직 안 씌워진 것이 위 WARNING).

## 요약

이번 diff 는 `INVALID_PASSWORD` drift 버그를 고치며 공유 상수 `PASSWORD_VERIFY_CODES` 를 도입하고, `users.service.spec.ts` 에 리터럴 기반·대조군 테스트를 정교하게 추가해 원 결함의 재발을 막는 테스트 설계를 보여준다. 다만 그 교훈(클래스만 단언하면 코드값 drift 가 안 보인다)이 상수의 세 번째 소비처인 `sessions.service.spec.ts` 에는 아직 적용되지 않아 같은 클래스의 결함이 그 파일에서는 여전히 무방비이고, 이번 PR 의 핵심 wire 계약 변경(OAuth-only → `PASSWORD_REQUIRED`)에 대한 e2e(HTTP) 커버리지도 비어 있어 유닛 계층에서만 검증되는 비대칭이 있다. 두 WARNING 모두 코드 수정이 아니라 테스트 추가로 해소 가능한 국지적 갭이며, 나머지 변경(상수 추출, 기존 테스트 리터럴 갱신, mdx 문서)은 회귀 위험이 낮다.

## 위험도

MEDIUM
