# 보안(Security) 코드 리뷰

## 리뷰 범위

핵심 코드 변경 9개 파일(783줄) — TypeORM 0.3.31 + pg 드라이버가 `UPDATE`/`DELETE ... RETURNING`
에서 `[rows, rowCount]` 튜플을 돌려주는데 8개 소비 지점이 이를 행 배열로 오인해 왔던 결함을
공유 헬퍼 `updateReturningRows()` 로 통일 수정한다.

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규 헬퍼)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규, 구조적 회귀 가드)
- `codebase/backend/src/common/utils/assert-row-array.spec.ts` (가드 수치 갱신)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts` / `.spec.ts` (OAuth state 소비 지점)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` / `.spec.ts`
  (admission gate, `updateExecutionStatus` 종결 가드)
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` / `.spec.ts`
  (CAS 락 2곳, 재큐 2곳, reset 1곳)
- `plan/in-progress/*.md` 3건 (소급 정정 문서, 코드 아님)

`git diff --stat origin/main...HEAD -- codebase plan` 결과가 프롬프트 대상과 정확히 일치함을
직접 확인했다. 나머지(review/code/**, review/consistency/**)는 동일 작업의 이전 라운드
리뷰/일관성검토 산출물이며 코드가 아니다.

## 발견사항

CRITICAL/WARNING 없음. 아래는 확인 절차와 INFO 성격 관찰이다.

- **[INFO]** 이번 변경은 취약점을 만들지 않고, 오히려 이전에 무력화돼 있던 보안 인접 방어
  (동시성 CAS 락, OAuth state 소비 검증)를 정상 동작으로 복원한다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` 함수
    `reExtractAll`(CAS 락 판정부, `updateReturningRows(acquired, ...).length === 0`) /
    `reEmbedAll`(동일 패턴) — `codebase/backend/src/modules/auth/auth-oauth.service.ts` 함수
    `handleCallback` (state 소비 판정부, `consumed.length === 0` / `record.provider !== provider`)
    — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 함수
    `admitExecutionOrDefer`(admission UPDATE 판정) / `updateExecutionStatus`(짝 전이 guarded UPDATE)
  - 상세: 수정 전에는 `UPDATE/DELETE ... RETURNING` 결과가 실제로는 `[rows, rowCount]` 튜플인데
    `.length`/`[0]`을 행 배열처럼 취급해 KB CAS 락은 한 번도 거절하지 않았고(동시 재추출/재임베딩
    잠금 없이 통과), execution admission 판정은 항상 실패, `updateExecutionStatus` 의 동시 cancel
    선점 분기는 항상 미탐지였다. **OAuth 콜백 쪽은 방향이 반대다** — 튜플 오인으로
    `consumed.length === 0` 판정이 항상 거짓이라 만료/재사용 state 도 즉시 거절되지는 않았지만,
    바로 뒤 `record.provider`(행이 아니라 행 배열이라 `undefined`)가 `provider`(문자열)와 항상
    불일치해 **모든 콜백(정상 포함)이 `OAUTH_STATE_MISMATCH` 로 즉시 거절**됐다. 즉 두 체크가
    체이닝돼 있어 만료/재사용 state 가 통과(bypass)한 적은 없다 — fail-closed 였고 소셜 로그인이
    상시 불가능했을 뿐 인증 우회는 발생하지 않았다. 수정 후에는 두 체크 모두 설계대로 동작해
    (a) 만료/재사용 state 는 `consumed.length === 0` 으로 정상 거절, (b) 정상 콜백은 통과하도록
    올바르게 복원된다.
  - 제안: 없음(정상 동작 복원, 기능 회귀 수정이자 방어 강화). 이미 판별 테스트(튜플 shape
    `[[…],n]` vs `[[],0]`)와 뮤테이션 검증(RESOLUTION.md 기록)이 갖춰져 있다.

- **[INFO]** SQL 인젝션 없음 — 확인.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:148`
    (`'DELETE FROM auth_oauth_state WHERE state = $1 AND expires_at > NOW() RETURNING *'`, `[state]`),
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 함수
    `admitExecutionOrDefer`(`UPDATE execution SET ... WHERE id = $1 AND ... RETURNING id`,
    파라미터 배열)와 `updateExecutionStatus`(guarded UPDATE, `$1..`), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`
    의 CAS UPDATE(`reExtractAll`/`reEmbedAll`)·재큐 UPDATE(embedding/graph)·reset UPDATE 전부.
  - 상세: 신규/변경된 raw SQL 전부 `$1, $2, ...` 파라미터 바인딩만 사용하고, 사용자 입력(state,
    executionId, workspaceId, kb id, document id)을 문자열 결합으로 SQL 에 직접 삽입하지 않는다.
    변경분은 오직 **결과 shape 해석**(`updateReturningRows` 도입) 만 건드리며 SQL 문자열·바인딩
    방식 자체는 그대로다.

- **[INFO]** 하드코딩된 시크릿 없음 — 확인.
  - 위치: 리뷰 대상 9개 코드 파일 전체.
  - 상세: `grep -niE "(api[_-]?key|password|secret|token|bearer)\s*[:=]\s*['\"]"` 스캔 결과
    실제 자격증명 리터럴 없음. `auth-oauth.service.spec.ts` 신규 테스트 2건은 mock 반환값
    (`[[validState], 1]`, `[[], 0]`)만 다루고 실제 토큰 값을 담지 않는다.

- **[INFO]** 에러 메시지의 정보 노출 없음 — 확인.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts` 함수
    `updateReturningRows` (`throw new Error(...typeof=${typeof result}...)`)
  - 상세: 노출값은 `typeof` 와 호출부가 넘긴 `detail` 문맥 문자열(예: `` `OAuth state 소비, provider ${provider}` ``, `` `KB re-extract CAS 락, kb ${id}` ``) 뿐이며 SQL 문·바인딩 값·행 데이터를
    포함하지 않는다. 이 함수가 던지는 것은 일반 `Error`(NestJS `HttpException` 아님)이므로
    `codebase/backend/src/common/filters/http-exception.filter.ts` 의 `GlobalExceptionFilter`
    가 매핑 안 된 내부 예외로 분류해 `logger.error` 로만 원문·스택을 남기고 클라이언트에는
    고정 문구(`UNHANDLED_ERROR_MESSAGE`, CWE-209 방지 주석 명시)만 반환한다 — 직접 실행해
    확인한 것은 아니고 필터 코드 정독으로 확인. 클라이언트 응답 경로로 내부 정보가 새지 않는다.

- **[INFO]** 인증/인가 로직 자체(라우팅, 가드, RBAC, 토큰 발급/검증)는 변경되지 않았다 — 확인.
  - 위치: `auth-oauth.service.ts` 변경분은 `handleCallback` 내부 state 소비 shape 해석에
    한정되며, `assertProvider`·`exchangeCodeForToken`·`fetchProfile`·`resolveUser`·
    `authService.issueTokensForOauthUser` 등 실제 인증/토큰 발급 로직은 diff 밖이다.
  - 제안: 없음.

- **[INFO]** 신규 `detail` 진단 인자(로그/에러 문맥)에 담기는 값은 execution id·kb id·
  document id·provider 등 식별자뿐이며, 사용자 PII·자격증명·토큰 값을 포함하지 않는다 — 확인.
  - 위치: 8개 호출부 전수(`auth-oauth.service.ts:151`, `execution-engine.service.ts` 2곳,
    `knowledge-base.service.ts` 5곳).

## 요약

이번 변경은 신규 취약점을 도입하지 않는 순수 correctness/concurrency 버그 수정이다. 모든 raw SQL 은 기존과 동일하게 파라미터 바인딩을 유지하며 문자열 결합이 없어 인젝션 표면이 없고, 하드코딩된 시크릿도 없다. 신규 헬퍼(`updateReturningRows`)가 던지는 에러는 `typeof`와 호출부 문맥 식별자만 담아 민감정보를 노출하지 않으며, `HttpException`이 아니므로 `GlobalExceptionFilter`가 클라이언트에는 일반화된 메시지만 전달하고 원문은 서버 로그로만 격리한다(CWE-209 기존 방어 유지). 오히려 이 수정은 이전에 튜플 shape 오인으로 무력화돼 있던 두 보안 인접 방어 — KB CAS 락(동시 재추출/재임베딩 잠금)과 execution admission 판정 — 을 정상화하고, OAuth state 소비 검증도 (기존에 인증 우회 없이 fail-closed 였던 상태에서) 설계대로 정상 콜백을 통과시키도록 복원한다. 인증/인가 핵심 로직(가드·RBAC·토큰 발급) 자체는 변경 범위 밖이다. CRITICAL/WARNING 급 보안 결함 없음.

## 위험도

NONE
