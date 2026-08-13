# 보안(Security) 코드 리뷰

## 리뷰 범위

이 diff 는 두 부분으로 구성된다.

1. **실질 코드 변경** — `codebase/backend/src/common/utils/update-returning-rows.ts`(신규 헬퍼)와
   그 적용 지점 8곳(`execution-engine.service.ts` 2곳, `knowledge-base.service.ts` 5곳,
   `auth-oauth.service.ts` 1곳) + 대응 테스트 4개 파일(`update-returning-rows.spec.ts`,
   `execution-engine.service.spec.ts`, `knowledge-base.service.spec.ts`,
   `auth-oauth.service.spec.ts`) + `assert-row-array.spec.ts` 카운트 갱신 + plan 문서 2개
   (`update-returning-tuple-shape.md` 신규, `ie-resume-turn-boundary-cancel.md` 소급 정정).
2. **이전 두 라운드(`20_36_35`, `22_45_24`)의 리뷰/컨시스턴시 산출물 커밋** —
   `review/code/2026/08/13/{20_36_35,22_45_24}/*`, `review/consistency/2026/08/13/{20_36_36,22_45_25}/*`.
   전부 마크다운/JSON 보고서이며 실행 코드가 아니라 인젝션·인증·시크릿 표면을 갖지 않는다.

TypeORM 0.3.31 + pg 조합에서 `UPDATE`/`DELETE ... RETURNING` raw 쿼리가 행 배열이 아니라
`[rows, rowCount]` 튜플을 반환한다는 실측 사실을 반영해, 이를 행 배열로 오인해 온 8개 지점을
`updateReturningRows()` 헬퍼로 통일 수정한 correctness/concurrency 버그 픽스다.

## 발견사항

발견된 취약점 없음(CRITICAL/WARNING 없음). 직접 `Read`/`Grep` 으로 실제 소스를 열어 확인한
결과와 절차는 아래와 같다.

- **[INFO]** (긍정 변경) `auth-oauth.service.ts` 소셜 로그인 콜백의 OAuth state 소비/검증이
  이번 diff 로 정확히 복구됨 — 인증 우회는 아니었고 가용성 결함이었음을 코드 경로로 직접 확인.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` `handleCallback` (`updateReturningRows` 호출부는 146행 부근, `consumed.length === 0` 판정 152행, `record.provider` 비교 159행 — 실제 파일 Read 로 확인)
  - 상세: 수정 전에는 `DELETE FROM auth_oauth_state ... RETURNING *` 의 반환값을 행 배열로
    오인해 `consumed.length === 0`(튜플이라 항상 `2 === 0` → 거짓)과 `consumed[0]`(행이 아니라
    행 배열 자체)을 그대로 썼다. 그 결과 `record.provider` 가 항상 `undefined` 가 되어
    `record.provider !== provider` 가 항상 참이 되면서 **정상 콜백을 포함한 모든 경우가
    `OAUTH_STATE_MISMATCH` 로 실패**했다 — 판정 오류가 항상 "거부" 로 수렴했으므로 인증
    우회 방향은 아니다(fail-closed). 수정 후에는 `updateReturningRows<AuthOAuthState>(...)` 로
    튜플을 올바르게 언랩해 (1) 0행 매치(무효/만료/재사용 state)는 정확히 거절되고 (2) 1행
    매치 시 `record` 가 실제 state 행이 되어 provider 비교가 올바르게 동작한다.
    `handleCallback` 은 여전히 `assertProvider` 로 provider 화이트리스트를 먼저 검증하고,
    `DELETE ... WHERE state = $1 AND expires_at > NOW()` 는 단일 원자적 SQL 문이라
    "검증 후 소비" 사이의 TOCTOU 창이 없다(동시 콜백 중 하나만 행을 획득 — single-use state
    보장). `state` 값 자체도 `randomBytes(24).toString('hex')` 로 생성되는 것을 `auth-oauth.service.ts` 상단에서 확인했다(diff 밖, 변경 없음). 신규 테스트 2건
    (`auth-oauth.service.spec.ts` `실측 shape([rows,count])로도 정상 콜백이 성공해야 한다` /
    `실측 shape 에서 0행(만료·재사용)은 여전히 거절돼야 한다`)이 실측 튜플 shape
    (`[[validState],1]`, `[[],0]`)로 성공/거절 양쪽을 검증한다.
  - 제안: 없음(수정이 정확함). 이 호출부만 `updateReturningRows` 의 선택적 `detail` 진단
    인자를 생략했다 — 방어적 분기(드라이버가 배열조차 아닌 값을 반환하는 극단 상황)가 터질
    경우 로그에서 "OAuth state consume" 지점 식별이 다소 어려워지나, 보안 영향은 없고
    가용성/진단 편의 문제일 뿐이다.

- **[INFO]** SQL 인젝션 없음 — 실제 소스 재확인.
  - 위치: `auth-oauth.service.ts:148`(`DELETE ... RETURNING *`), `execution-engine.service.ts`
    의 admission UPDATE(파라미터 `$1..$5`, `lockKey` 는 `hashtext($1)` 로만 전달)와
    `updateExecutionStatus` guarded UPDATE, `knowledge-base.service.ts` 의 CAS 락 2곳
    (336행·720행, `Read` 로 직접 확인)·재큐 2곳(533행·569행)·reset(739행)·finalize(693행).
  - 상세: 이번 diff 는 SQL 텍스트를 새로 만들지 않는다 — 기존 쿼리의 **결과 해석 로직**만
    `updateReturningRows()` 로 교체했다. 모든 raw 쿼리가 변경 전후 동일하게 `$1, $2, ...`
    파라미터 바인딩 또는 `ANY($1::uuid[])` 를 사용하며, 사용자 입력(state 값, document/KB
    id, workspaceId, executionId)이 문자열 결합으로 SQL 에 섞이는 지점은 없다.
    `updateReturningRows` 자체는 DB 드라이버가 반환한 결과값만 받고 사용자 입력을 받지
    않으므로 인젝션 표면이 아니다.

- **[INFO]** 하드코딩된 시크릿 없음 — `git diff origin/main...HEAD -- codebase plan review`
  전체에 대해 자격증명 패턴 grep 재실행으로 확인.
  - 상세: 매칭된 문자열은 `execution-engine.service.spec.ts` 의
    `'connect failed postgres://user:secret@db.internal:5432/app'`(이전 라운드부터 존재하는
    `sanitizeErrorMessage` redaction 회귀 테스트 fixture, 이번 diff 신규 아님)와
    `auth-oauth.service.spec.ts` 의 `accessToken: 'access-token'`/`refreshToken: 'refresh-token'`
    같은 목(mock) 리터럴뿐이다. 둘 다 실제 자격증명이 아니라 테스트 fixture 이며, 프로덕션
    시크릿·API 키·인증서는 발견되지 않았다.

- **[INFO]** 인가(authorization)/워크스페이스 경계 변경 없음 — 확인.
  - 위치: `knowledge-base.service.ts` 의 `reExtractAll`/`reEmbedAll`/`retryFailedDocuments`
    (각 함수 진입부의 `findById(id, workspaceId)` 선행 호출), `execution-engine.service.ts`
    의 admission/`updateExecutionStatus`(사전에 `executionId`/`execution.id` 로 스코프된
    행만 대상), `auth-oauth.service.ts` 의 `assertProvider` 화이트리스트.
  - 상세: 이번 diff 는 UPDATE/DELETE 결과의 **shape 파싱만** 바꿀 뿐, 모든 raw 쿼리의
    `WHERE` 절(workspace/KB/execution 스코핑)은 그대로다. 워크스페이스 경계를 우회하는
    새 경로는 도입되지 않았다.

- **[INFO]** 에러 메시지에 민감 정보 노출 없음 — 확인.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts` (throw 구문)
  - 상세: `UPDATE/DELETE RETURNING 결과가 배열이 아님 (typeof=${typeof result})` +
    선택적 `detail`(호출부가 명시적으로 넘긴 execution ID/KB ID 등 내부 식별자) — SQL 문·
    바인딩 파라미터 값·행 데이터·자격증명은 노출되지 않는다. `auth-oauth.service.ts` 의
    클라이언트 대면 에러(`OAUTH_STATE_MISMATCH`, `Invalid, expired, or already consumed
    OAuth state`)도 상태 코드/일반 메시지뿐 내부 구조 노출이 없다.

- **[INFO]** 이 변경은 취약점 도입이 아니라 오히려 기존 동시성 가드(CAS 락, admission cap,
  동시-cancel 종결 이벤트 억제)의 무력화를 교정 — 방어 강화 방향.
  - 위치: `knowledge-base.service.ts` CAS 락(336행·720행), `execution-engine.service.ts`
    admission(약 2946행)·`updateExecutionStatus`(약 8549행)
  - 상세: 수정 전에는 튜플의 `.length`(항상 2)를 행 배열로 오인해 KB 재추출/재임베딩 CAS
    락이 한 번도 거절하지 못했고(동시 요청이 락 없이 통과), 실행 admission 게이트는 항상
    거짓으로 판정되어 우회 경로(§7.5 rehydration)로만 진행됐다. 인증/인가 로직 자체를 건드린
    변경은 아니지만, 자원 소모/데이터 정합성에 인접한 방어를 실제로 동작하게 복원한다는 점에서
    보안 인접 영역의 긍정적 효과다.

- **[INFO]** 커밋된 리뷰/컨시스턴시 산출물(`review/code/**`, `review/consistency/**`)은
  마크다운/JSON 보고서일 뿐 실행되는 코드가 아니므로 인젝션/인증 표면이 없다. 이 파일들 안에
  `auth-oauth.service.ts` 의 결함 재현 코드 스니펫이 인용되지만 실제 자격증명이나 프로덕션
  값은 포함하지 않는다(위 grep 으로 확인).

## 요약

이번 diff 의 핵심은 TypeORM `UPDATE`/`DELETE ... RETURNING` 이 `[rows, rowCount]` 튜플을
반환하는 것을 행 배열로 오인해 왔던 결함을 `updateReturningRows()` 헬퍼로 통일 수정한
것이며, 원시 SQL 은 모든 지점에서 파라미터 바인딩을 그대로 유지해 인젝션 위험이 없고,
워크스페이스/실행 스코핑 등 인가 경계도 손대지 않았다. 하드코딩된 시크릿은 없으며 에러
메시지도 최소 정보만 노출한다. 가장 눈에 띄는 보안 관점 변화는 이전 라운드에서 CRITICAL 로
지적된 `auth-oauth.service.ts` 소셜 로그인 콜백의 OAuth state 검증 오동작(정상 콜백이 항상
`OAUTH_STATE_MISMATCH` 로 실패하던 가용성 결함, 인증 우회 아님을 코드 경로로 확인)이 정확히
수정되고 실측 shape 기반 회귀 테스트로 뒷받침됐다는 점, 그리고 KB CAS 락·실행 admission
cap 등 기존 동시성 방어가 실제로 작동하도록 복원됐다는 점이다. 직접 소스를 열어 재확인한
결과 이전 두 라운드(`20_36_35`, `22_45_24`) 보안 리뷰의 결론과 일치하며, 새로 발견된
CRITICAL/WARNING 급 보안 결함은 없다.

## 위험도

NONE
