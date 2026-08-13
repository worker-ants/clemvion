# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** 이 diff 는 `auth-oauth.service.ts` 의 OAuth `state` 재사용/만료 방지(anti-replay, CSRF 방어) 검사가 무력화돼 있던 결함을 **바로잡는다** — 새로운 취약점이 아니라 기존 취약점의 수정임을 확인.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:137`(`assertProvider(provider)`), `:146`(`updateReturningRows` 적용), `:153`(`consumed.length === 0` 검사), `:160`(`record.provider !== provider` 검사)
  - 상세: 수정 전 코드는 `DELETE … RETURNING *` 의 실제 반환 shape(TypeORM 0.3.31+pg 의 `[rows, rowCount]` 튜플)을 행 배열로 오인했다. 그 결과 (1) `consumed.length === 0` 판정이 항상 거짓이라 **만료되었거나 이미 소비된 state 토큰도 "없음"으로 거절되지 못했고**, (2) `consumed[0]`이 실제 행이 아니라 행 배열 자체를 가리켜 `record.provider`가 항상 `undefined`였다. (2)의 부작용으로 `record.provider !== provider` 비교가 언제나 참이 되어 **모든 콜백(정상·재사용·만료 불문)이 `OAUTH_STATE_MISMATCH`로 거절**되는 상태였다 — 즉 실서비스에서는 "fail-closed"(전원 거절)였기 때문에 실질적인 CSRF/재사용 우회가 발생하지는 않았던 것으로 보인다(소셜 로그인 자체가 상시 실패). 이번 수정(`updateReturningRows` 도입)으로 (1)(2) 모두 바로잡혀, state 토큰의 단일 사용(consume-once) 검사와 provider 일치 검사가 의도대로 다시 작동한다. `codebase/backend/src/modules/auth/auth-oauth.service.spec.ts:247`(`실측 shape 에서 0행(만료·재사용)은 여전히 거절돼야 한다`)이 이 회귀를 테스트로 고정했다.
  - 제안: 조치 불요(이미 올바르게 수정됨). 참고로 남기는 긍정적 발견 — 배포 후 "state 재사용/만료 거절"이 실제로 발동하는지 관측 로그를 짧게 확인해 두면 이 인증 경로의 정합성을 재확인할 수 있다.

- **[INFO]** `updateReturningRows`의 `detail` 컨텍스트 문자열에 사용되는 `provider` 값은 화이트리스트 검증을 거친 뒤에만 사용돼, 로그 인젝션·문자열 조작 여지가 없다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:137`, `:151`
  - 상세: `handleCallback`은 `provider`를 사용하기 전 `this.assertProvider(provider)`를 호출하며, 이는 `AUTH_OAUTH_PROVIDERS = ['google', 'github']` 화이트리스트 대조다(변경 범위 밖, 기존 코드). 따라서 `` `OAuth state 소비, provider ${provider}` `` 문자열에 임의 사용자 입력이 그대로 삽입될 수 없다. `updateReturningRows`가 던지는 `Error`(`update-returning-rows.ts:47`)는 드라이버가 배열이 아닌 값을 반환하는, 정상적으로는 도달 불가능한 내부 불변식 위반 경로에서만 발생하며 공격자가 트리거할 수 있는 입력 경로가 아니다.
  - 제안: 조치 불요.

- **[INFO]** 신규/변경된 모든 raw SQL(`update-returning-rows.ts` 소비 지점: `execution-engine.service.ts`, `knowledge-base.service.ts`, `auth-oauth.service.ts`)이 파라미터 바인딩(`$1`, `$2`, …)을 그대로 유지하며 문자열 결합으로 바뀐 곳이 없다 — SQL 인젝션 신규 표면 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (admission UPDATE·`updateExecutionStatus` UPDATE), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (CAS 락 2곳·재큐 2곳·reset 1곳), `codebase/backend/src/modules/auth/auth-oauth.service.ts:147-149`
  - 상세: 이번 변경은 각 지점에서 raw query 결과의 **shape 해석**만 `assertRowArray`/직접 소비 → `updateReturningRows` 헬퍼로 교체했을 뿐, 쿼리 텍스트·바인딩 파라미터 구성은 그대로다. `git diff` 로 각 SQL 문자열을 직접 대조한 결과 파라미터화가 깨지거나 사용자 입력이 쿼리 문자열에 직접 삽입되는 지점은 없다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음.
  - 위치: 변경된 전체 파일 (`codebase/**`, `plan/**`, `review/**`) grep 스캔
  - 상세: `password|secret|api[_-]?key|token|private[_-]?key|Authorization:|Bearer ` 패턴으로 diff 전체를 스캔한 결과, 발견된 유일한 매치는 `auth-oauth.service.spec.ts`의 `accessToken: 'access-token'` / `refreshToken: 'refresh-token'`으로, 같은 스위트의 기존(변경 안 된) 테스트가 이미 쓰던 동일한 placeholder mock 값이며 실제 자격증명이 아니다. `review/**` 산출물에 등장하는 `postgres://user:secret@db.internal:5432/app`도 이전 라운드부터 존재하던 redaction 검증용 fixture 문자열에 대한 **서술**일 뿐 이번 diff 의 신규 코드가 아니다.
  - 제안: 조치 불요.

## 요약

이번 변경(TypeORM `UPDATE`/`DELETE … RETURNING` 튜플 shape 오인 버그를 `updateReturningRows` 헬퍼로 통일 수정)은 보안 관점에서 새로운 취약점을 도입하지 않으며, 오히려 `auth-oauth.service.ts`의 OAuth `state` 재사용/만료 거절 검사(CSRF/replay 방어)가 실질적으로 무력화돼 있던 기존 결함을 바로잡는다. 프로덕션에서는 그 무력화가 "정상 콜백까지 전부 거절"하는 fail-closed 형태로 상쇄돼 실제 우회가 관측되지는 않았을 것으로 보이지만, 방어 로직 자체가 죽어 있었다는 점은 짚어둘 값어치가 있다. 모든 SQL은 계속 파라미터 바인딩을 사용하며(SQL 인젝션 신규 표면 없음), `provider` 등 사용자 입력은 헬퍼 호출 이전에 화이트리스트 검증을 거친다. 하드코딩된 시크릿·인증/인가 우회·안전하지 않은 암호화·민감정보 노출 에러 처리·취약 의존성 추가 등은 발견되지 않았다.

## 위험도

NONE
