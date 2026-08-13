# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** 이 PR 은 새로운 취약점이 아니라 기존 취약점(OAuth state anti-replay 검증 무력화)을 바로잡는 수정이다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` (`handleCallback`, `consumed = updateReturningRows<AuthOAuthStateRow>(...)` 및 뒤이은 `consumed.length === 0`/`record.provider !== provider` 검사)
  - 상세: 수정 전에는 `DELETE FROM auth_oauth_state ... RETURNING *` 가 TypeORM 0.3.31+pg 에서 돌려주는 실제 shape(`[rows, rowCount]` 튜플)을 행 배열로 오인해, `consumed.length === 0` 판정이 항상 거짓(만료·재사용 state 도 "존재"로 오판)이고 `consumed[0]`(행 배열 자체)의 `provider` 필드가 항상 `undefined` 였다. 후자의 부작용으로 `record.provider !== provider` 비교가 언제나 참이 되어 결과적으로 정상/재사용/만료 콜백을 가리지 않고 전부 거절(`OAUTH_STATE_MISMATCH`)하는 fail-closed 상태였다 — 즉 이 버그로 인해 실질적인 CSRF/state 재사용 우회가 발생하지는 않았다(소셜 로그인 자체가 상시 실패). 이번 수정으로 state 의 단일 소비(consume-once)·provider 일치·만료 검사가 의도대로 정상 작동하도록 복원됐다. `auth-oauth.service.spec.ts` 의 신규 테스트(0행 거절, provider 불일치, 재사용 거절)와 신설 e2e `codebase/backend/test/auth-oauth-callback.e2e-spec.ts` (재사용·만료·provider 불일치·미존재 state 각각 거절 검증)가 이 anti-replay 동작을 실 드라이버 위에서 회귀 고정한다.
  - 제안: 조치 불요. 배포 후 "state 재사용/만료 거절" 이 실제 트래픽에서 발동하는지 로그로 한 차례 확인하면 좋다.

- **[INFO]** 신규/변경된 raw SQL 은 모두 파라미터 바인딩(`$1`, `$2`, …)을 유지하며 문자열 결합으로 바뀐 곳이 없다 — SQL 인젝션 신규 표면 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (admission UPDATE 약 2916행 부근, `updateExecutionStatus` guarded UPDATE 약 8506행 부근), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (CAS 락 2곳, 재큐 2곳, reset 1곳), `codebase/backend/src/modules/auth/auth-oauth.service.ts` (`handleCallback` 의 `DELETE ... WHERE state = $1`), `codebase/backend/test/auth-oauth-callback.e2e-spec.ts` (`seedState` 의 `INSERT ... VALUES ($1, $2, ...)`)
  - 상세: 이번 diff 는 각 지점에서 raw query **결과의 shape 해석**만 `assertRowArray`/직접 소비 → 공용 헬퍼 `updateReturningRows`(`codebase/backend/src/common/utils/update-returning-rows.ts`)로 교체했을 뿐, 쿼리 텍스트·바인딩 파라미터 구성은 그대로다. 신설 e2e 테스트의 `seedState` 도 `state`/`provider`/`rememberMe`/TTL 을 전부 파라미터로 바인딩하며, `NOW() + ($3::text || ' milliseconds')::interval` 형태로 SQL 리터럴에 사용자 입력을 직접 연결하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `updateReturningRows(result, detail)` 가 던지는 에러 메시지에 실리는 `detail` 컨텍스트 문자열(예: `` `admission UPDATE, execution ${executionId} — 트랜잭션을 롤백한다` ``, `` `KB re-extract CAS 락, kb ${id}` ``)은 자유 형식 사용자 입력이 아니라 서버 내부에서 생성/조회된 execution·KB·workspace ID, 화이트리스트 검증을 거친 `provider` 값만 포함한다 — 로그·에러 메시지 인젝션 표면으로 보기 어렵다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts` (`throw new Error(...)`), `codebase/backend/src/modules/auth/auth-oauth.service.ts:151` 부근(`provider` 는 `this.assertProvider(provider)` 로 `AUTH_OAUTH_PROVIDERS` 화이트리스트 대조 후에만 사용)
  - 상세: 이 에러 경로는 드라이버가 배열이 아닌 값을 반환하는, 정상 흐름에서는 도달하지 않는 내부 불변식 위반 시에만 트리거되며 공격자가 직접 트리거할 수 있는 입력 경로가 아니다.
  - 제안: 조치 불요.

- **[INFO]** 소셜 로그인의 "로그인 유지"(remember me) 처리가 raw `.query()` 결과의 컬럼명 대소문자 불일치(`remember_me` vs entity 매핑 `rememberMe`)로 인해 항상 무시되던 별개의 결함도 이 PR 에서 함께 수정됐다 — 인증 우회나 세션 탈취류는 아니고, refresh 토큰 만료 기간(7일 vs 30일)만 항상 짧게 적용되던 가용성/UX 성격의 문제였다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` (`AuthOAuthStateRow` 타입 도입 + `const rememberMe = record.remember_me === true;`)
  - 상세: 오히려 항상 짧은 만료로 처리되던 방향이라 보안적으로 더 보수적인(공격 표면을 넓히지 않는) 결함이었고, 수정 후에도 `remember_me` 값이 DB 저장 시점(`beginAuth`)의 신뢰 값이라 사용자 입력이 직접 반영되는 경로는 없다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿·자격증명·API 키 없음.
  - 위치: 이번 세션 변경 파일 전체(`codebase/backend/src/common/**`, `codebase/backend/src/modules/auth/**`, `codebase/backend/src/modules/execution-engine/**`, `codebase/backend/src/modules/knowledge-base/**`, `codebase/backend/test/auth-oauth-callback.e2e-spec.ts`, `plan/**`, `review/**`) grep 스캔(password/secret/api key/token literal/PEM 헤더 등)
  - 상세: OAuth client secret 은 기존과 동일하게 `this.requireEnv('${provider}_CLIENT_SECRET')` 로 환경변수에서만 읽는다(변경 범위 밖). 신설 e2e 는 `crypto.randomBytes(24).toString('hex')` 로 state 를 생성하고 `stub-code` 같은 고정 문자열은 OAuth stub 모드(dev/test 전용, `isOAuthStubModeAllowed()` 가드)에서만 의미를 갖는 테스트 픽스처다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/**`, `plan/**` 하위 신규/수정 마크다운 파일들은 과거 리뷰 라운드의 RESOLUTION·SUMMARY·meta.json 아카이브이며 실행되는 코드가 아니다. 내용상으로도 시크릿·자격증명·내부망 주소 노출은 없다.
  - 위치: `review/code/2026/08/13/**`, `review/consistency/2026/08/13/**`, `plan/in-progress/*.md`
  - 상세: 신규 e2e 의 `BASE_URL` 기본값(`http://backend-e2e:3011`)은 docker-compose 네트워크 내부 호스트명으로, 기존 e2e 관행과 동일한 패턴이다.
  - 제안: 조치 불요.

## 요약

이번 diff 의 핵심은 TypeORM 0.3.31+pg 가 `UPDATE`/`DELETE ... RETURNING` 에 대해 행 배열이 아닌 `[rows, rowCount]` 튜플을 반환한다는 사실을 8개 소비 지점(`auth-oauth.service.ts` 1곳, `execution-engine.service.ts` 2곳, `knowledge-base.service.ts` 5곳)이 오인해 왔던 결함을 공용 헬퍼 `updateReturningRows`로 봉합한 버그 수정이며, 신규 취약점을 도입하지 않고 오히려 하나의 기존 결함(OAuth state anti-replay 검증이 사실상 무력화돼 있던 상태 — 다만 그 결과가 fail-closed 였기에 실질적 우회로 이어지지는 않았다)을 바로잡는다. 모든 raw SQL 은 변경 전후로 파라미터 바인딩을 유지하며 문자열 결합으로 바뀐 지점이 없어 SQL 인젝션 신규 표면이 없고, 에러 메시지에 실리는 `detail` 컨텍스트도 사용자 자유 입력이 아닌 내부 ID/화이트리스트 검증된 provider 값뿐이다. 하드코딩된 시크릿·자격증명도 발견되지 않았다. 함께 수정된 `remember_me` 컬럼명 불일치 버그는 만료 기간이 항상 더 짧게(7일) 적용되던 보수적 방향의 결함이라 보안 영향은 없다. 전반적으로 이 PR 은 보안 관점에서 순수 개선(버그 수정)이며 CRITICAL/WARNING 급 발견사항은 없다.

## 위험도

NONE
