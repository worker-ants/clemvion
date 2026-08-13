# 보안(Security) 리뷰 결과

## 검토 범위

실제 코드 변경은 `codebase/backend` 10개 파일(신규 헬퍼 `update-returning-rows.ts`+spec, `auth-oauth.service.ts`+spec, `execution-engine.service.ts`+spec, `knowledge-base.service.ts`+spec, 신규 e2e `auth-oauth-callback.e2e-spec.ts`, `assert-row-array.spec.ts` 갱신)로 국한된다. 나머지(`plan/**`, `review/**`, `CHANGELOG.md`)는 산문 문서·리뷰 산출물이며 코드 실행 경로가 아니므로 보안 관점 실질 검토 대상이 아니다(하드코딩 시크릿 유무만 grep 으로 확인).

이 변경의 본질은 "TypeORM 0.3.31 + pg 가 `UPDATE`/`DELETE … RETURNING` 을 `[rows, rowCount]` 튜플로 반환하는데, 8개 소비 지점이 이를 행 배열로 오인해 왔다"는 결함을 신규 헬퍼 `updateReturningRows()` 로 일원화해 수정하는 fix 다.

## 발견사항

- **[INFO]** 이 PR 은 (수정 전 상태 기준으로) 실질적으로 두 개의 보안 관련 방어 로직을 **되살린다** — 새로 여는 것이 아니라 이미 의도됐던 가드를 정상 작동시키는 것이다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts`(`handleCallback`), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`(`reExtractAll`/`reEmbedAll` 의 CAS 락 두 곳)
  - 상세: (1) OAuth state 소비 — 수정 전에는 `consumed.length === 0`(튜플이라 항상 길이 2)가 영원히 거짓이라 **만료되거나 이미 소비된 state 도 "존재함"으로 간주**됐다(실제로는 후속 버그로 `record.provider` 가 `undefined` 가 되어 모든 콜백이 `OAUTH_STATE_MISMATCH` 로 막혀 있었기 때문에, 결과적으로 replay/expiry 우회가 외부에 노출되지는 않았다 — 로그인 자체가 상시 실패). (2) KB CAS 락 — `acquired.length === 0` 이 같은 이유로 항상 거짓이라 **동시 재추출/재임베딩 요청이 `KB_REEXTRACT_IN_PROGRESS`/`KB_REEMBED_IN_PROGRESS` 로 거절된 적이 한 번도 없었다**(레이스 방어가 사문화). 이 PR 은 `updateReturningRows()` 로 튜플에서 실제 RETURNING 행을 정확히 언랩해 두 가드를 모두 정상 작동시킨다.
  - 제안: 조치 불요 — 이미 이 PR 자체가 처방이다. 배포 후 "state replay 즉시 거절"·"KB CAS 409 최초 관측"을 로그로 확인하는 항목이 `plan/in-progress/update-returning-tuple-shape.md` §후속에 이미 등재돼 있다(그대로 유지 권고).

- **[INFO]** `execution-engine.service.ts` 의 `updateExecutionStatus` 도 같은 패턴으로, 동시 cancel 레이스에서 "이미 terminal 로 전이됐으면 종결 이벤트를 내지 않는다"는 `persisted` 분기가 지금까지 한 번도 타지 않고 있었다(항상 `true`). 이 PR 로 실제 UPDATE 매치 여부가 `persisted` 에 정확히 반영된다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`updateExecutionStatus`)
  - 상세: 무결성 보호(중복 종결 이벤트 방지)의 정확도가 개선되는 방향이며, 새로운 인가/인증 우회 표면은 만들지 않는다. `WHERE status IN (...)` 가드 자체는 수정 전에도 DB 쓰기를 정확히 제한하고 있었으므로 데이터 무결성은 계속 보호돼 있었다 — 바뀐 것은 "앱이 그 사실을 정확히 아는가"이다.
  - 제안: 조치 불요.

- **[INFO]** SQL 인젝션 표면 없음 — 변경된 모든 raw 쿼리(`DELETE FROM auth_oauth_state WHERE state = $1 …`, KB `UPDATE … WHERE id = $1 AND workspace_id = $2 …`, execution `UPDATE … WHERE id = $1 …`)는 전부 파라미터 바인딩(`$1`, `$2`, …)을 유지하며 문자열 결합이 도입되지 않았다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:171-176`(diff 게이트 기준), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` 4개 UPDATE 문, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 2개 UPDATE 문.

- **[INFO]** 에러 메시지에 민감정보 노출 없음 — `OAUTH_STATE_MISMATCH`/`Provider mismatch for OAuth state` 응답은 실제 `state` 값·DB 원인·스택트레이스를 포함하지 않는 일반화된 메시지 그대로 유지된다. `updateReturningRows` 가 던지는 진단 메시지(`— ${detail}`)는 서버 로그/예외 경로에만 실리고 클라이언트 응답 바디를 구성하지 않는다(`BadRequestException` 은 별도 고정 메시지를 던짐).
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` `handleCallback` 내 두 `throw new BadRequestException({...})` 블록.

- **[INFO]** 하드코딩된 시크릿 없음 — 변경된 10개 코드 파일 및 diff 전체에 대해 API 키/비밀번호/토큰 패턴 grep 결과 실 시크릿은 없다. `auth-oauth-callback.e2e-spec.ts` 는 `crypto.randomBytes(24)` 로 테스트 state 를 생성하고 `code: 'stub-code'` 를 쓰지만, 이는 `OAUTH_STUB_MODE=true` + `NODE_ENV∈{test,development}` 로 이중 게이트된 스텁 경로(`oauth-stub-mode.ts`, 이번 diff 밖 기존 코드)를 타는 값이라 운영 시크릿이 아니다.

- **[INFO]** `remember_me`(refresh 쿠키 TTL) 언랩 수정은 인증 표면에 영향을 주지만 방향은 정합성 개선뿐이다 — 수정 전엔 항상 7일(짧은 쪽)로 fallback 됐고, 수정 후 사용자가 명시적으로 선택한 30일이 정확히 반영된다. 공격자가 임의로 TTL 을 늘릴 수 있는 경로는 아니다(값은 서버가 최초 `state` 저장 시점에 세션 생성 요청의 `rememberMe` 로 고정, 콜백에서 재해석만 함).
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` (`AuthOAuthStateRow.remember_me`, `handleCallback` 의 `rememberMe = record.remember_me === true`).

## 요약

이번 diff 는 신규 기능이 아니라 "`UPDATE`/`DELETE … RETURNING` 이 TypeORM+pg 에서 튜플로 온다"는 드라이버 사실을 몰라 8개 소비 지점이 행 배열로 오독하던 결함의 수정이며, 결과적으로 OAuth state 소비(replay/expiry 거절)와 KB CAS 락(동시 재추출/재임베딩 거절)이라는 두 보안·정합성 가드를 정상 작동시킨다. 새로 도입된 raw SQL 은 모두 파라미터 바인딩을 유지하고, 에러 메시지는 민감정보를 노출하지 않으며, 하드코딩된 시크릿도 발견되지 않았다. `AuthOAuthStateRow`(snake_case 명시 타입)와 `updateReturningRows()` 의 `!Array.isArray` fail-closed 가드는 오히려 타입 단언이 검증을 대체할 수 없다는 사실을 코드로 인정하고 런타임 검증으로 보완한 설계라 보안 성숙도를 높이는 방향이다. 신규 취약점이나 인증/인가 우회, 인젝션 표면은 발견되지 않았다.

## 위험도

NONE
