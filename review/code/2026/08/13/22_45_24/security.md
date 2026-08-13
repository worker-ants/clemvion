# 보안(Security) 코드 리뷰

## 리뷰 범위

이 diff 는 두 부분으로 구성된다.

1. **실질 코드 변경** — `codebase/backend/src/common/utils/update-returning-rows.ts`(신규 헬퍼)와
   그 적용 지점 8곳(`execution-engine.service.ts` 2곳, `knowledge-base.service.ts` 5곳,
   `auth-oauth.service.ts` 1곳) + 대응 테스트 4개 파일 + plan 문서 2개
   (`update-returning-tuple-shape.md` 신규, `ie-resume-turn-boundary-cancel.md` 소급 정정).
2. **이전 라운드(`20_36_35`/`20_36_36`) 리뷰 산출물 커밋** — `review/code/2026/08/13/20_36_35/*`,
   `review/consistency/2026/08/13/20_36_36/*`. 이들은 마크다운/JSON 보고서일 뿐 실행되는
   코드가 아니므로 보안 표면(인젝션·인증·시크릿) 자체를 갖지 않는다. 시크릿 하드코딩 여부만
   전수 grep 으로 확인했다.

## 발견사항

- **[INFO]** (긍정 변경) `auth-oauth.service.ts` 소셜 로그인 콜백의 state 검증이 이번 diff 로
  정확히 복구됐다 — 이전 라운드에서 발견된 CRITICAL(상시 로그인 실패)의 실제 코드 수정.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:146-164` (`handleCallback`)
  - 상세: 수정 전 `const consumed = await this.dataSource.query<AuthOAuthState[]>(...)` 는
    `DELETE ... RETURNING *` 의 실제 반환 shape 인 `[rows, rowCount]` 튜플을 행 배열로
    오인했다. `consumed.length === 0` 이 튜플의 `.length`(항상 2)를 보고 있어 **DELETE 가
    0행을 매치해도(즉 존재하지 않거나 만료됐거나 이미 소비된 state 값을 제출해도) 이 분기가
    타지 않았고**, 대신 `record = consumed[0]`(행이 아니라 행 배열 자체)의 `.provider` 가
    `undefined` 가 되어 `record.provider !== provider` 가 항상 참이 되면서 **정상 콜백까지
    포함해 모든 경우가 예외 없이 `OAUTH_STATE_MISMATCH` 로 실패**했다(가용성 결함이지 우회는
    아니었다 — 잘못된 판정이 항상 "거부"로 수렴했기 때문에 인증 우회 방향은 아니었음을 코드
    경로로 직접 확인했다). 이번 수정은 `updateReturningRows<AuthOAuthState>(await this.dataSource.query(...))`
    로 튜플을 올바르게 언랩해 `consumed`가 실제 삭제된 행 배열이 되도록 복구했다 —
    ① 0행 매치(무효/만료/재사용 state)는 이제 정확히 `consumed.length === 0` 으로 거절되고,
    ② 1행 매치 시 `record`는 실제 state 행이라 `provider` 비교가 올바르게 동작한다.
    `handleCallback`은 여전히 `assertProvider`로 provider 화이트리스트를 먼저 검증하고,
    `DELETE ... WHERE state = $1 AND expires_at > NOW()` 는 원자적 단일 SQL 문이라
    "검증 후 소비" 사이의 TOCTOU 창도 없다(동시 콜백 중 한쪽만 행을 획득). 신규 테스트
    2건(`auth-oauth.service.spec.ts:234-253`)이 실측 튜플 shape(`[[validState],1]`,
    `[[],0]`)로 성공/거절 양쪽을 RED→GREEN 으로 검증한다.
  - 제안: 없음(이미 올바르게 수정됨). 참고로 `detail` 인자(헬퍼가 제공하는 진단 문맥)를
    이 호출부는 생략했다 — 방어적 분기(드라이버가 배열조차 아닌 값을 반환하는 극단
    상황)가 터질 경우 로그에서 "OAuth state consume" 인지 식별하기 더 어렵다. 보안
    영향은 없음(가용성/진단 문제일 뿐), 필요하면 `updateReturningRows(result, 'OAuth state consume')` 처럼 문맥을 붙이는 것을 고려할 만하다.

- **[INFO]** SQL 인젝션 없음 — 확인.
  - 위치: 이번 diff 가 건드린 모든 raw 쿼리 — `auth-oauth.service.ts:148`(`DELETE ...
    RETURNING *`), `execution-engine.service.ts` 의 admission UPDATE(파라미터
    `$1`..`$5`, `lockKey` 는 `hashtext($1)` 로만 전달)와 `updateExecutionStatus` guarded
    UPDATE, `knowledge-base.service.ts` 의 CAS 락 2곳·재큐 2곳·reset(모두 `$1`,`$2`
    파라미터 바인딩).
  - 상세: 이번 diff 는 SQL 텍스트를 새로 만들지 않는다 — 기존 쿼리의 **결과 해석**
    로직(`.length`/`[0]`/`.map`)만 `updateReturningRows()` 헬퍼로 교체했다. 모든 쿼리는
    변경 전후 동일하게 파라미터 바인딩(`$1, $2, ...`)을 쓰고, 사용자 입력(state 값,
    document/KB id, workspaceId, executionId)이 문자열 결합으로 SQL 에 섞이는 지점은
    없다. `updateReturningRows` 자체는 DB 드라이버가 반환한 결과 shape 만 다루며 사용자
    입력을 받지 않는다.

- **[INFO]** 하드코딩된 시크릿 없음 — 확인.
  - 위치: 이번 diff 전체 31개 파일.
  - 상세: `git diff origin/main...HEAD -- codebase plan review | grep -niE
    "(api[_-]?key|password|secret|token|bearer|private[_-]?key)\s*[:=]\s*['\"][^'\"]{4,}"`
    실행 결과, 실제 자격증명 리터럴은 없다. `execution-engine.service.spec.ts` 의
    `'connect failed postgres://user:secret@db.internal:5432/app'` 는 이전 라운드
    security.md 가 이미 확인한 대로 `sanitizeErrorMessage` 의 redaction 회귀 테스트
    fixture 이며 이번 diff 가 아니라 이전에 이미 존재한다. `CLIENT_SECRET` 등은
    `process.env[...]` 로만 참조되는 환경변수 키 이름이지 값이 아니다.

- **[INFO]** 인가(authorization)/워크스페이스 경계 변경 없음 — 확인.
  - 위치: `knowledge-base.service.ts` 의 `reExtractAll`/`reEmbedAll`/`retryFailedDocuments`
    (각 함수 진입부의 `findById(id, workspaceId)`), `execution-engine.service.ts` 의
    admission/status 갱신(사전에 `executionId`/`execution.id` 로 스코프된 행만 대상).
  - 상세: 이번 diff 는 UPDATE/DELETE 결과의 **shape 파싱만** 바꿀 뿐, 모든 raw 쿼리의
    `WHERE` 절(workspace/KB/execution 스코핑)은 그대로다. 워크스페이스 경계를 우회하는
    새 경로는 없다.

- **[INFO]** 에러 메시지에 민감 정보 노출 없음 — 확인.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:45-49`
  - 상세: `throw new Error(\`UPDATE/DELETE RETURNING 결과가 배열이 아님
    (typeof=${typeof result})\` + (detail ? \` — ${detail}\` : ''))` — 노출되는 것은
    `typeof` 문자열과 호출부가 명시적으로 넘긴 `detail`(실행 ID 등 내부 식별자)뿐이며
    SQL 문·바인딩 파라미터 값·행 데이터·자격증명은 포함되지 않는다. `auth-oauth.service.ts`
    쪽 클라이언트 대면 에러(`OAUTH_STATE_MISMATCH`, `Invalid, expired, or already
    consumed OAuth state`)도 상태 코드/일반 메시지뿐 내부 구조 노출이 없다.

- **[INFO]** 커밋된 리뷰 산출물(`review/code/**`, `review/consistency/**`)은 실행 코드가
  아니므로 인젝션/인증 표면이 없으며, 시크릿 리터럴도 포함하지 않는다(위 grep 으로 확인).
  이 파일들 안에서 `auth-oauth.service.ts` 의 실제 결함 재현 코드가 마크다운 코드
  블록으로 인용되지만 실제 자격증명이나 프로덕션 값이 아니다.

## 요약

이번 diff 의 핵심은 TypeORM `UPDATE`/`DELETE ... RETURNING` 이 `[rows, rowCount]` 튜플을
반환하는 것을 행 배열로 오인해 왔던 결함을 `updateReturningRows()` 헬퍼로 통일 수정한
것이며, 원시 SQL 은 전 지점에서 파라미터 바인딩을 유지하고(인젝션 위험 없음) 워크스페이스
스코핑도 그대로 보존된다. 이번 라운드의 가장 중요한 보안 관점 변화는 **이전 라운드에서
CRITICAL 로 지적된 `auth-oauth.service.ts` 소셜 로그인 콜백의 state 검증 오동작**(모든
정상 콜백이 `OAUTH_STATE_MISMATCH` 로 실패하던 결함, 인증 우회는 아니고 가용성 결함이었음을
코드 경로로 확인)이 정확히 수정되고 실측 shape 기반 회귀 테스트 2건으로 뒷받침됐다는 점이다.
새로 도입된 헬퍼는 순수 함수이고 하드코딩된 시크릿이나 에러 메시지 정보 노출도 없다. 신규로
커밋된 리뷰 산출물 파일들도 마크다운/JSON 보고서일 뿐 보안 표면을 갖지 않으며 시크릿을
포함하지 않는다.

## 위험도

NONE
