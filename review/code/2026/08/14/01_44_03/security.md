# 보안(Security) 리뷰 결과

## 사전 확인

이 diff 는 `UPDATE`/`DELETE … RETURNING` 이 TypeORM 0.3.31 + pg 에서 `[rows, rowCount]`
튜플을 돌려주는데 8개 소비 지점(`auth-oauth.service.ts` 1, `execution-engine.service.ts` 2,
`knowledge-base.service.ts` 5)이 이를 행 배열로 오인해 왔던 결함을 공용 헬퍼
`updateReturningRows()` 로 일괄 수정한 것이다. 나머지 대부분의 프롬프트 첨부 파일은
`review/code/**`·`review/consistency/**`·`plan/**` 아래의 **이전 리뷰 라운드 산출물**(RESOLUTION.md,
meta.json, 과거 라운드 security.md 등)이며 신규 실행 코드가 아니다 — 이 산출물들에 시크릿·자격증명이
섞여 있는지만 별도로 grep 스캔했다(결과 없음).

핵심 실행 코드는 `codebase/backend/src/{common/utils,modules/auth,modules/execution-engine,
modules/knowledge-base}` + 신규 e2e(`codebase/backend/test/auth-oauth-callback.e2e-spec.ts`) 이며,
아래는 그 코드에 대한 분석이다.

## 발견사항

- **[INFO]** 이 diff 는 `auth-oauth.service.ts` 의 OAuth `state` anti-replay/CSRF 방어가 실질적으로
  무력화돼 있던 결함을 바로잡는다 — 새로운 취약점이 아니라 기존 취약점의 수정.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:170`(`updateReturningRows` 적용),
    `:177`(`consumed.length === 0` 거절), `:184`(`record.provider !== provider` 거절),
    `:192`(`record.remember_me` 언랩)
  - 상세: 수정 전 코드는 `DELETE … RETURNING *` 결과를 행 배열로 오인해 (1) `consumed.length === 0`
    판정이 항상 거짓이라 만료·재사용 state 를 "없음"으로 거절하지 못했고, (2) `consumed[0]` 이 실제
    행이 아니라 행 배열 자체를 가리켜 `record.provider` 가 항상 `undefined` 였다. (2)의 부작용으로
    `record.provider !== provider` 비교가 항상 참이 되어 **모든 콜백(정상·재사용·만료 불문)이
    `OAUTH_STATE_MISMATCH` 로 거절**되는 fail-closed 상태였다 — 즉 실서비스에서는 소셜 로그인 자체가
    상시 실패했을 뿐 재사용/CSRF 우회로 실제 악용될 수는 없었던 것으로 보인다. 이번 수정으로 state
    단일 사용(consume-once) 검사와 provider 일치 검사가 의도대로 다시 작동한다.
    `codebase/backend/src/modules/auth/auth-oauth.service.spec.ts` 의 신규 테스트(`실측 shape 에서
    0행(만료·재사용)은 "0행" 분기가 거절해야 한다` 등)와 신규 e2e
    `codebase/backend/test/auth-oauth-callback.e2e-spec.ts`(재사용·만료·provider 불일치 4개 거절
    시나리오)가 이 회귀를 테스트로 고정했다.
  - 제안: 조치 불요(이미 올바르게 수정됨).

- **[INFO]** KB 재추출/재임베딩 CAS 락(동시성 가드)이 실질적으로 무력화돼 있던 결함도 같은 diff 로
  바로잡힌다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:346`
    (`reExtractAll` CAS 락), `:730`(`reEmbedAll` CAS 락)
  - 상세: 수정 전에는 `UPDATE … WHERE reextract_status = 'idle' RETURNING id` 결과의 `.length`가
    튜플이라 항상 2 로 평가돼 `acquired.length === 0` 분기(409 `KB_REEXTRACT_IN_PROGRESS` /
    `KB_REEMBED_IN_PROGRESS` 거절)가 한 번도 타지 않았다 — 즉 동시 재추출/재임베딩 요청이 CAS 락을
    거치지 않고 전부 통과해 동시에 여러 재처리 파이프라인이 겹쳐 돌 수 있었다(리소스 소모/일관성
    측면의 잠재 위험). 이번 수정으로 락이 처음으로 실제 작동한다.
  - 제안: 조치 불요(이미 올바르게 수정됨).

- **[INFO]** 신규 헬퍼 `updateReturningRows`가 던지는 예외가 클라이언트로 내부 정보를 노출하지 않음을
  확인.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:65-69`(비-배열 결과 시
    `detail` 문자열을 포함한 일반 `Error` throw), `codebase/backend/src/common/filters/http-exception.filter.ts:84-96`
    (HttpException 이 아닌 `Error`는 `UNHANDLED_ERROR_MESSAGE` 일반 문구로 마스킹, 원본 메시지는
    `logger.error` 로만 서버 로그에 남김 — CWE-209 대응 기존 패턴)
  - 상세: `updateReturningRows`/`assertRowArray` 모두 NestJS `HttpException` 이 아닌 평범한 `Error`
    를 던지므로, 이 예외가 실제로 발생하더라도(드라이버가 배열이 아닌 값을 반환하는, 정상 경로에서는
    도달 불가능한 상황) `GlobalExceptionFilter` 가 500 + 일반 문구로 마스킹한다. `detail` 인자에
    실행 ID·KB ID 등 내부 식별자를 실어도 클라이언트에는 노출되지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 신규/변경된 모든 raw SQL이 파라미터 바인딩(`$1`, `$2`, …)을 유지하며 문자열 결합으로
  바뀐 곳이 없음 — SQL 인젝션 신규 표면 없음.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:172-173`,
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(admission UPDATE·
    `updateExecutionStatus` UPDATE, 각각 `updateReturningRows` 도입부 인근),
    `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:337-341, 534-538,
    571-575, 720-724, 740-744`(CAS 락 2곳·재큐 2곳·reset 1곳)
  - 상세: 이번 변경은 각 지점에서 raw query **결과의 shape 해석**만 교체했을 뿐 쿼리 텍스트·바인딩
    파라미터 구성은 그대로다.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e(`codebase/backend/test/auth-oauth-callback.e2e-spec.ts`)의 state 값은
  `crypto.randomBytes(24).toString('hex')`로 생성되고, `code: 'stub-code'`는
  `OAUTH_STUB_MODE`(dev/test 전용 가드, `isOAuthStubEnabled()`)로만 도달 가능한 스텁 값이다. 실
  자격증명·API 키·비밀번호 등 하드코딩된 시크릿은 발견되지 않음.
  - 위치: `codebase/backend/test/auth-oauth-callback.e2e-spec.ts:19-30`(`seedState`), `:44`
    (`code: 'stub-code'`)
  - 제안: 조치 불요.

- **[INFO]** `tsconfig.build.json`의 `**/__testing__/**` exclude 추가로 신규 테스트 전용 헬퍼
  (`source-scan.ts`)가 프로덕션 dist 번들에서 제외된다 — 불필요한 코드가 배포 아티팩트에 섞이지
  않도록 하는 방향으로, 공격 표면을 늘리지 않는다.
  - 위치: `codebase/backend/tsconfig.build.json:7`
  - 제안: 조치 불요.

- **[INFO]** `codebase/**`, `plan/**`, `review/**` 전체에 대해 하드코딩된 시크릿/자격증명 패턴
  (`password`, `secret`, `api[_-]?key`, `Bearer `, AWS 키 형식, PEM 헤더 등)을 grep 스캔했으나
  실제 시크릿 값은 발견되지 않았다. `review/**`에 새로 추가된 이전 라운드 리뷰 산출물(RESOLUTION.md
  등)도 코드 스니펫 인용뿐이며 자격증명을 포함하지 않는다.

## 요약

이번 diff 는 신규 취약점을 도입하지 않는다. 오히려 TypeORM `UPDATE`/`DELETE … RETURNING` 튜플
shape 오인으로 무력화돼 있던 두 개의 보안 관련 방어 — OAuth state 단일 사용/만료/provider 일치
검사(anti-replay/CSRF 성격)와 KB 재추출·재임베딩 동시성 CAS 락 — 을 복구하는 수정이다. 수정 전
상태는 재사용·CSRF 우회를 허용하는 방향이 아니라 fail-closed(전원 거절)로 작동해 왔던 것으로
분석되어 과거 노출 위험은 낮았던 것으로 보이나, 검증되지 않은 값이 로그로만 남고 클라이언트로
새어나가지 않는 에러 마스킹 패턴(`GlobalExceptionFilter`)도 그대로 유지된다. 모든 SQL은 파라미터
바인딩을 유지하며, 신규 e2e/테스트에도 실제 자격증명이나 시크릿 하드코딩이 없다.

## 위험도

NONE
