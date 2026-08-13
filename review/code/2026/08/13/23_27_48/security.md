# 보안(Security) 코드 리뷰

## 리뷰 범위

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규)
- `codebase/backend/src/common/utils/assert-row-array.spec.ts` (카운트 갱신)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts` / `.spec.ts` (소셜 로그인 콜백 — CSRF state 검증)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` / `.spec.ts` (admission CAS·상태 전이 가드)
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` / `.spec.ts` (CAS 락 2곳, 재큐 2곳, reset 1곳)
- `plan/in-progress/{ie-resume-turn-boundary-cancel,retry-turn-terminal-guard,update-returning-tuple-shape}.md`
- `review/code/2026/08/13/{20_36_35,22_45_24,23_07_11}/**`, `review/consistency/2026/08/13/{20_36_36,22_45_25,23_07_12}/**` (직전 라운드 산출물, 신규 파일로 커밋)

이번 diff(`origin/main...HEAD`, 코드 9개 + plan 3개 + 이전 리뷰/일관성 세션 산출물)는 TypeORM 0.3.31 + pg 가 `UPDATE`/`DELETE ... RETURNING` 에 대해 행 배열이 아니라 `[rows, rowCount]` 튜플을 돌려준다는 실측을 반영해, 이를 행 배열로 오인해 있던 8개 지점(admission 게이트, 상태 전이 가드, KB CAS 락 2곳, KB 재큐 2곳, KB reset, **OAuth state 소비 1곳**)을 `updateReturningRows()` 헬퍼로 일원화하는 correctness/concurrency 버그 수정이다. `git diff --stat origin/main...HEAD -- codebase plan` 실측 결과 12개 파일이 리뷰 대상과 정확히 일치했다.

이 코드 변경은 이미 동일 세션 내 3차례 보안 리뷰(`20_36_35`→`22_45_24`→`23_07_11`, 매 라운드 위험도 NONE)를 거쳤다. 이번 라운드는 그 누적 diff 위에 마지막 커밋(`76203ad63`, W1 stale 제네릭 최종 정정)까지 포함한 재검증이다. 아래는 실제 소스 파일(`Read`/`grep`)을 직접 열어 대조한 결과다.

## 발견사항

발견된 취약점 없음(CRITICAL/WARNING 없음). 아래는 확인 절차와 INFO 성격의 관찰이다.

- **[INFO]** OAuth CSRF state 검증이 이번 수정으로 정상 복구됐다 — 확인.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` `handleCallback` (146~165행 부근, `updateReturningRows` 도입 지점)
  - 상세: 수정 전에는 `DELETE FROM auth_oauth_state ... RETURNING *` 의 반환값이 실제로는 `[rows, rowCount]` 튜플인데 행 배열로 취급해 `consumed.length === 0`(만료·재사용 state 거절)이 영원히 거짓이었고, `consumed[0]`(실제 provider 검증 대상)이 행이 아니라 행 배열이라 `record.provider`가 `undefined`가 되어 provider mismatch 체크도 무력화돼 있었다 — 결과적으로 CSRF state 검증이 사실상 통째로 죽어 있었고, 부수 효과로 모든 정상 콜백이 `OAUTH_STATE_MISMATCH` 로 실패했다(가용성 장애로 드러났을 뿐, 방어가 죽어 있던 근본 성격은 인증 우회 위험). 현재 코드는 `updateReturningRows<AuthOAuthState>(...)` 로 튜플에서 실제 행 배열을 정확히 꺼내며, `consumed.length === 0`(0행 → 거절)·`record.provider !== provider`(provider mismatch → 거절) 두 방어가 실제로 평가된다. `expires_at > NOW()` 필터가 SQL 레벨에서 만료 state를 원천 배제하는 것도 그대로 유지된다.
  - 제안: 없음(정상 방어 복원). `auth-oauth.service.spec.ts` 에 실측 shape([rows,count])의 정상 콜백/0행 거절 양방향 테스트가 추가돼 회귀도 막혀 있다.

- **[INFO]** SQL 인젝션 없음 — 전 지점 확인.
  - 위치: `knowledge-base.service.ts` 의 CAS UPDATE(`reExtractAll`:336행 부근, `reEmbedAll`:719행 부근), 재큐 UPDATE(embedding:533행 부근, graph:569행 부근), reset UPDATE(751행 부근), graph 실패 rollback(`ANY($1::uuid[])`); `execution-engine.service.ts` 의 admission UPDATE(`$1..$5`)와 `updateExecutionStatus` guarded UPDATE; `auth-oauth.service.ts` 의 `DELETE ... WHERE state = $1`.
  - 상세: 모든 원시 SQL이 `$1, $2, ...` 파라미터 바인딩을 쓰며, 사용자 입력(문서 ID·KB ID·workspaceId·oauth state)을 문자열 결합 없이 값 배열로 전달한다. `updateReturningRows` 자체는 SQL을 만들지 않고 이미 실행된 쿼리 결과의 shape만 판별하므로 이 헬퍼가 인젝션 표면을 새로 만들 여지도 없다.

- **[INFO]** 하드코딩된 시크릿 없음 — 재확인.
  - 위치: 리뷰 대상 코드 파일 전체 + 신규로 커밋되는 `review/**` 산출물(RESOLUTION.md, meta.json, 각 리뷰 md).
  - 상세: `grep -niE "(api[_-]?key|password|secret|token|bearer)['\"]?\s*[:=]\s*['\"][A-Za-z0-9/+_=-]{8,}"` 로 프롬프트 전체를 재스캔한 결과 실제 자격증명 리터럴은 없다. 유일한 근접 매치는 `auth-oauth.service.spec.ts` 신규 테스트의 `accessToken: 'access-token'`/`refreshToken: 'refresh-token'` 같은 플레이스홀더 fixture 값과, 이전 라운드에 이미 확인된 `execution-engine.service.spec.ts` 의 redaction 회귀 테스트 fixture(`postgres://user:secret@db.internal:5432/app`, `sanitizeErrorMessage` 가 `[REDACTED_URI]` 로 마스킹하는지 검증하는 용도)뿐이다.

- **[INFO]** 에러 메시지에 민감 정보 노출 없음 — 확인.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts` (throw 블록)
  - 상세: `throw new Error(\`UPDATE/DELETE RETURNING 결과가 배열이 아님 (typeof=${typeof result}) — ${detail}\`)` — 노출되는 것은 `typeof` 와 호출부가 스스로 넘긴 문맥 문자열(예: `admission UPDATE, execution ${executionId}`, `OAuth state 소비, provider ${provider}`)뿐이다. `detail` 인자에 SQL 문·바인딩 파라미터 원문·행 데이터가 실리는 지점은 없다 — 전 호출부(`auth-oauth`, `execution-engine` 2곳, `knowledge-base` 5곳)를 확인했다.

- **[INFO]** 인가(authorization) 경계 변경 없음 — 확인.
  - 위치: `knowledge-base.service.ts` 각 CAS/재큐 함수 진입부의 `findById(id, workspaceId)` 선행 호출(변경 없음), `auth-oauth.service.ts` 의 provider/이메일 기반 사용자 매칭 로직(변경 없음)
  - 상세: 이번 diff는 UPDATE/DELETE 결과의 shape 파싱만 바꿀 뿐, workspace 경계 검증이나 OAuth 사용자 매칭·계정 링크 로직 자체는 손대지 않았다. `resolveUser`의 "provider가 없는 계정만 조건부 링크"(`WHERE id = :id AND oauth_provider IS NULL`) 방어도 그대로다.

- **[INFO]** 이번 변경은 신규 취약점이 아니라 기존 보안-인접 방어(CAS 동시성 락·CSRF state 검증)를 복구하는 방향 — 재확인.
  - 위치: `knowledge-base.service.ts` 의 두 CAS 락, `execution-engine.service.ts` 의 admission 게이트·`updateExecutionStatus` 가드, `auth-oauth.service.ts` 의 state 소비
  - 상세: 세 지점 모두 "튜플 length가 항상 2라서 거절 분기가 사문화돼 있었다"는 동일 근본 원인이며, 수정 후 각 방어(락 거절, 종결 이벤트 중복 방지, CSRF state 거절)가 실제로 평가되게 된다. 방어가 강화되는 방향이므로 CRITICAL/WARNING으로 분류할 신규 리스크는 없다.

- **[INFO]** 신규로 커밋되는 이전 라운드 리뷰 산출물(`review/code/**`, `review/consistency/**`)에 코드 변경은 없다.
  - 위치: 파일 13~71 (RESOLUTION.md, meta.json, 각 관점 md, `_retry_state.json`)
  - 상세: 전부 문서/메타데이터이며 실행되는 코드가 아니다. 절대경로가 다수 노출되지만(`/Volumes/project/private/clemvion/...`) 로컬 워크트리 경로일 뿐 자격증명이나 원격 접근 정보가 아니다.

## 요약

원시 SQL은 전 지점(신규 8번째 지점인 `auth-oauth.service.ts` 포함)에서 파라미터 바인딩을 사용해 인젝션 위험이 없고, 하드코딩된 시크릿도 없으며, 에러 메시지는 호출부가 넘긴 문맥 문자열과 `typeof`만 노출한다. 가장 주목할 부분은 이번 수정이 실질적으로 **CSRF state 검증(OAuth)과 CAS 동시성 락(KB)이 튜플 shape 오인식으로 인해 사실상 무력화돼 있던 것을 복구**한다는 점이다 — `handleCallback`의 provider mismatch·만료/재사용 state 거절이 이번에 처음으로 실제 평가되므로, 방어 관점에서는 순수하게 강화 방향이다. 인가 경계(workspace 검증, OAuth 계정 링크 조건)는 이번 diff에서 변경되지 않았다. 실제 소스 파일(`auth-oauth.service.ts`, `knowledge-base.service.ts`, `execution-engine.service.ts` 관련 구간)을 직접 열어 대조했으며, 이전 3차례 라운드(`20_36_35`/`22_45_24`/`23_07_11`)의 NONE 판정과 결론이 일치한다.

## 위험도

NONE
