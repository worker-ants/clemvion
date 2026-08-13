# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** 이 diff 는 `auth-oauth.service.ts` 의 OAuth `state` 재사용/만료 방지(anti-replay, CSRF 방어) 검사가 무력화돼 있던 결함을 **바로잡는다** — 신규 취약점이 아니라 기존 취약점의 수정.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` `handleCallback` (`this.assertProvider(provider)` 직후 `updateReturningRows` 적용 → `consumed.length === 0` 검사 → `record.provider !== provider` 검사)
  - 상세: 수정 전 코드는 `DELETE … RETURNING *` 의 실제 반환 shape(TypeORM 0.3.31+pg 의 `[rows, rowCount]` 튜플)을 행 배열로 오인했다. 그 결과 (1) `consumed.length === 0` 판정이 항상 거짓이라 만료·재사용 state 토큰도 "없음"으로 거절되지 못했고, (2) `consumed[0]`이 행이 아니라 행 배열 자체를 가리켜 `record.provider`가 항상 `undefined`였다. (2)의 부작용으로 provider 일치 검사가 언제나 참(불일치)이 되어 실제로는 모든 콜백이 `OAUTH_STATE_MISMATCH`로 거절되는 fail-closed 상태였다(소셜 로그인 상시 실패) — 즉 이 버그 자체로 실질적 CSRF/재사용 우회가 발생하지는 않았던 것으로 보인다. 이번 수정(`updateReturningRows` 도입)으로 state 단일 사용(consume-once) 검사와 provider 일치 검사가 의도대로 복원됐고, `auth-oauth.service.spec.ts`(`실측 shape 에서 0행(만료·재사용)은 "0행" 분기가 거절해야 한다`)와 신규 `codebase/backend/test/auth-oauth-callback.e2e-spec.ts`(재사용/만료/미존재/provider 불일치 4가지를 실 Postgres 위에서 거절 확인)가 이 회귀를 테스트로 고정했다.
  - 제안: 조치 불요(이미 올바르게 수정되고 실 드라이버 e2e 로 고정됨). 배포 후 "state 재사용/만료 거절"이 실제로 발동하는지 짧게 로그 확인해 두면 이 인증 경로의 정합성을 한 번 더 재확인할 수 있다(이미 plan 후속 관측 항목으로 등재됨).

- **[INFO]** 같은 계열의 동시성 가드(CAS 락) 두 곳도 이번 수정으로 함께 복원된다 — 직접적인 인젝션/인증 취약점은 아니나 자원 남용/레이스 방지 관점에서 언급.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (`reExtractAll`의 `reextract_status='in_progress'` CAS UPDATE, `reEmbedAll`의 `reembed_status='in_progress'` CAS UPDATE), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `admitExecutionOrDefer` (workspace/workflow 동시 실행 cap UPDATE)
  - 상세: 같은 튜플 오인 버그로 `acquired.length === 0`/`rows.length === 1` 판정이 항상 실제와 다른 값을 냈다. KB CAS 락은 "이미 진행 중" 거절이 한 번도 발동하지 않아 동시 재추출/재임베딩이 걸러지지 않았고, execution admission cap 은 판정이 우연히 다른 경로(§7.5 stalled 재배달)로 결과만 맞아떨어졌다. 이번 수정으로 두 가드 모두 설계된 동시성 제한이 실제로 작동한다. 쿼리는 모두 파라미터 바인딩(`$1`, `$2`)을 유지하며 문자열 결합으로 바뀐 곳이 없다.
  - 제안: 조치 불요. 이미 배포 후 실제 409/cap 발동 관측이 plan(`update-returning-tuple-shape.md` §후속)에 등재돼 있다.

- **[INFO]** 신규/변경된 raw SQL(`update-returning-rows.ts` 소비 지점 8곳: execution-engine 2 · knowledge-base 5 · auth-oauth 1)이 전부 파라미터 바인딩(`$1`, `$2`, …)을 유지하며 문자열 결합으로 바뀐 곳이 없다 — SQL 인젝션 신규 표면 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(admission UPDATE·`updateExecutionStatus` UPDATE), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`(CAS 락 2곳·재큐 2곳·reset 1곳), `codebase/backend/src/modules/auth/auth-oauth.service.ts`(`DELETE … WHERE state = $1 … RETURNING *`)
  - 상세: 이번 변경은 각 지점에서 raw query 결과의 **shape 해석**만 `assertRowArray`/직접 소비 → `updateReturningRows` 헬퍼로 교체했을 뿐, 쿼리 텍스트·바인딩 파라미터 구성은 그대로다. `git diff`로 각 SQL 문자열을 직접 대조한 결과 사용자 입력이 쿼리 문자열에 직접 삽입되는 지점은 없다.
  - 제안: 조치 불요.

- **[INFO]** `updateReturningRows`의 `detail` 컨텍스트 문자열에 실리는 값들(예: `provider`, `execution ${executionId}`, `kb ${id}`)은 화이트리스트 검증을 거쳤거나 시스템 생성 ID라 로그 인젝션·정보 노출 여지가 없다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts`(`assertProvider(provider)` 이후 `provider` 사용), `codebase/backend/src/common/utils/update-returning-rows.ts`(에러 메시지 `... — ${detail}`)
  - 상세: `handleCallback`은 `provider`를 사용하기 전 `this.assertProvider(provider)`로 `AUTH_OAUTH_PROVIDERS = ['google', 'github']` 화이트리스트 대조를 거치므로(변경 범위 밖, 기존 코드) 임의 사용자 입력이 `detail` 문자열에 그대로 삽입될 수 없다. `updateReturningRows`가 던지는 `Error`는 드라이버가 배열이 아닌 값을 반환하는, 정상적으로는 도달 불가능한 내부 불변식 위반 경로에서만 발생하며 공격자가 트리거할 수 있는 입력 경로가 아니다. 에러 메시지도 클라이언트로 그대로 전파되지 않고 내부 예외로 처리된다(handleCallback 은 `BadRequestException`으로 별도 감싸 반환).
  - 제안: 조치 불요.

- **[INFO]** `auth-oauth-callback.e2e-spec.ts`의 state 생성은 `crypto.randomBytes(24)` 기반이라 예측 불가능하며, 하드코딩된 자격증명 없음.
  - 위치: `codebase/backend/test/auth-oauth-callback.e2e-spec.ts` `seedState`
  - 상세: 테스트가 사용하는 `stub-code`는 `isOAuthStubEnabled()`(dev/test 전용 W-74 가드, 변경 범위 밖)로만 활성화되는 OAuth 스텁 모드 경로를 타므로 실제 토큰 교환을 우회하지 않는다. `accessToken: 'access-token'` / `refreshToken: 'refresh-token'` 등은 같은 스위트가 기존부터 쓰던 placeholder mock 값이며 실제 자격증명이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음(diff 전체 재스캔).
  - 위치: 변경된 전체 파일(`codebase/**`, `plan/**`, `review/**`, `CHANGELOG.md`) grep 스캔
  - 상세: `(api[_-]?key|password|secret|token|bearer|private[_-]?key)\s*[:=]\s*['"]` 계열 패턴으로 diff 전체를 재스캔한 결과, 매치는 전부 (a) 테스트 mock placeholder(`access-token`/`refresh-token`), (b) `review/**` 산출물에 등장하는 `postgres://user:secret@db.internal:5432/app` — 이는 실제 자격증명이 아니라 이전 라운드(다른 리뷰어의 로그 redaction 검증 fixture)부터 존재하던 문자열에 대한 **서술**일 뿐 이번 신규 코드가 아니다. 신규 실제 시크릿·API 키·인증서는 없다.
  - 제안: 조치 불요.

- **[INFO]** `tsconfig.build.json`의 `exclude`에 `**/__testing__/**` 추가는 테스트 전용 정적 분석 헬퍼(`source-scan.ts`)가 프로덕션 `dist` 번들에 실리지 않도록 하는 보안상 바람직한 변경 — 공격 표면을 늘리지 않고 오히려 줄인다.
  - 위치: `codebase/backend/tsconfig.build.json`
  - 제안: 조치 불요.

## 요약

이번 diff의 핵심은 TypeORM 0.3.31+pg 가 `UPDATE`/`DELETE … RETURNING`에 대해 행 배열이 아니라 `[rows, rowCount]` 튜플을 반환한다는 사실을 8개 소비 지점(execution-engine 2 · knowledge-base 5 · auth-oauth 1)이 오인해 왔던 결함을 공유 헬퍼(`updateReturningRows`)로 일원화해 바로잡는 수정이다. 보안 관점에서 가장 중요한 지점은 `auth-oauth.service.ts`의 OAuth state 소비 로직으로, 수정 전에는 만료/재사용 state 거절 및 provider 일치 검사가 무력화돼 있었으나(다만 부작용으로 모든 콜백이 fail-closed 되어 실질적 우회로 이어지지는 않았던 것으로 보임) 이번 수정으로 anti-replay/CSRF 방어가 정상 복원되고 실 드라이버 e2e로 고정됐다. `knowledge-base.service.ts`의 CAS 락 2곳과 `execution-engine.service.ts`의 admission cap 도 같은 이유로 사문화됐던 동시성 가드가 복원된다. 모든 raw SQL 은 파라미터 바인딩을 그대로 유지해 신규 SQL 인젝션 표면이 없고, 하드코딩된 시크릿·자격증명도 발견되지 않았다. 신규 테스트 유틸(`source-scan.ts`)은 프로덕션 빌드에서 제외되도록 `tsconfig.build.json`이 갱신됐다. 전반적으로 이 변경은 보안 결함을 새로 만드는 것이 아니라 기존에 조용히 무력화돼 있던 인증/동시성 방어 로직을 복구하는 성격이며, 실측 뮤테이션·e2e 검증까지 갖춰 CRITICAL/WARNING 급 보안 이슈는 발견되지 않았다.

## 위험도

NONE
