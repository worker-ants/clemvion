# Database 리뷰 — update-returning-tuple-shape (auth-oauth 소급 반영본)

## 개요

TypeORM 0.3.31 + pg 조합에서 `UPDATE`/`DELETE ... RETURNING` raw 쿼리가 `[rows, rowCount]` 튜플을
돌려주는데(`SELECT`/`INSERT` 는 행 배열 그대로), 이를 행 배열로 오인해 `.length`/`[0]`/`.map` 을
직접 소비하던 8개 지점을 `updateReturningRows()` 헬퍼로 통일한 변경이다. 이전 라운드(`20_36_35`)
database 리뷰가 검토했던 7곳(execution-engine 2곳, knowledge-base 5곳)에 더해, 그 라운드의
requirement 리뷰어가 지적한 CRITICAL(소셜 로그인 콜백이 같은 결함으로 상시 실패)이 이번 diff에
`auth-oauth.service.ts` 수정으로 반영되어 있다. 직접 `Read` 로 각 지점의 현재 소스를 재확인했다.

## 발견사항

- **[INFO]** `auth-oauth.service.ts` 의 OAuth state 소비 CAS 가 실제로 동작하도록 정정됨 (이 diff 의 핵심 수정, 검증 완료)
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:146` (`updateReturningRows` 호출), `:152`(`consumed.length === 0` 판정), `:158`(`consumed[0]`)
  - 상세: `DELETE ... RETURNING *` 결과가 `[rows, rowCount]` 튜플임에도 이전에는 `consumed.length === 0`/`consumed[0]` 을 그대로 써서, (1) 만료·재사용 state 거절 분기가 영원히 안 타고 (2) `consumed[0]` 이 행이 아니라 행 배열이라 `record.provider` 가 `undefined` → 정상 콜백까지 `OAUTH_STATE_MISMATCH` 로 실패했다. `updateReturningRows<AuthOAuthState>(...)` 로 언랩한 뒤 판정하도록 고쳤고, 파라미터 바인딩(`[state]`)도 그대로 유지돼 SQL 인젝션 경로는 없다. `auth-oauth.service.spec.ts` 에 실측 shape(`[[validState], 1]`/`[[], 0]`) 회귀 테스트 2건이 추가돼 재발 시 RED 로 떨어진다.
  - 제안: 없음(수정이 정확함, 재검증 완료).

- **[INFO]** KB CAS 락·admission 게이트가 실제로 동작하도록 정정됨 — 이전 라운드에서 이미 검토된 부분, 재확인만
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:345`(reExtractAll CAS), `:719`(reEmbedAll CAS), `:740`(reset) / `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2946-2951`(admission), `:8549-8553`(updateExecutionStatus)
  - 상세: 직접 `Read` 로 재확인 — 모든 지점이 `updateReturningRows()` 를 정확히 거치고, admission 게이트는 `pg_advisory_xact_lock` + 조건부 UPDATE 를 단일 트랜잭션 안에서 묶어 TOCTOU 를 막는 기존 설계를 그대로 유지한다. 원 SQL 텍스트는 변경 없이 파라미터 바인딩(`$1..$n`)만 그대로 재사용돼 인젝션 리스크 없음.
  - 제안: 없음.

- **[INFO]** `reEmbedAll` 의 CAS 락 UPDATE 와 reset UPDATE 가 여전히 트랜잭션 밖의 별도 두 문장 (이 diff 로 도입된 것 아님, `reExtractAll` 과 대비되는 기존 구조)
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:711`(CAS 락 `dataSource.query`), `:728`(reset `dataSource.query`) — 대조군: `:334`(`reExtractAll` 은 `dataSource.transaction()` 으로 CAS+DELETE+UPDATE+SELECT 를 묶음)
  - 상세: 이번 diff 가 건드린 것은 각 UPDATE 결과의 shape 해석뿐이라 새로 생긴 문제는 아니다. 다만 CAS 락 성공(`in_progress` 진입) 직후 ~ reset UPDATE 사이 프로세스 크래시 시 KB 가 `reembed_status='in_progress'` 로 남고 문서 status 는 리셋되지 않는 좁은 창이 여전히 존재한다 — `reExtractAll` 은 이미 이 문제를 트랜잭션으로 닫았는데 `reEmbedAll` 은 그대로다.
  - 제안: 이번 PR 범위 밖. plan(`plan/in-progress/update-returning-tuple-shape.md`)의 후속 ②(`updateExecutionStatus` 트랜잭션화)와 별개로, `reEmbedAll` CAS+reset 원자화(`dataSource.transaction()` 으로 묶기)도 후속 검토 후보로 남겨둘 만하다.

- **[INFO]** `knowledge-base.service.ts` 5개 수정 지점 중 실측 튜플 shape([[…],N]) 회귀 테스트가 새로 붙은 곳은 `reEmbedAll` CAS 락 1곳뿐 — 나머지 4곳(`reExtractAll` CAS, embedding 재큐, graph 재큐, reset)은 구조적 grep 가드에만 의존
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts:792-799` (신규 실측 shape 테스트, `reEmbedAll` CAS 락만 커버)
  - 상세: 직접 grep 결과, `[[…` 형태(튜플)로 mock 하는 테스트는 이 1건뿐이다. 이전 라운드 requirement 리뷰어가 "5곳 전부에 실측 shape 회귀 테스트가 없다" 고 지적했고 RESOLUTION.md 는 "kb CAS 락에 실측 튜플 shape 테스트 추가" 로 부분 조치했다 — `reEmbedAll` CAS 만 커버되고 `reExtractAll` CAS·재큐 2곳·reset 은 여전히 `[]`/`[{id}]`(행 배열 직접) mock 만 사용한다. `updateReturningRows` 가 두 shape 을 모두 정확히 처리하므로 운영 동작 자체는 안전하지만(직접 소스로 확인), 이 4곳은 향후 누군가 `updateReturningRows` 호출을 실수로 제거해도(구조적 grep 가드가 잡긴 하지만, 언랩 로직 자체가 잘못 바뀌는 경우는 못 잡음) 기존 mock 만으로는 RED 가 되지 않는다.
  - 제안: 우선순위는 낮음(운영 코드는 정확함이 확인됨, 구조적 gard도 병존). 여력이 되면 나머지 4곳에도 `[[{id:'kb-1'}], 1]`/`[[], 0]` shape 의 테스트를 1건씩 추가해 언랩 로직 자체의 회귀도 잡히게 하는 것을 권고.

- **SQL 인젝션**: 이번 diff(모든 파일 포함)가 건드린 raw 쿼리 전부 파라미터 바인딩(`$1`, `$2`, …)을 사용한다. 신규 SQL 텍스트 변경 없음 — 결과 해석 로직 교체만. 리스크 없음.
- **N+1 / 대량 데이터**: 반복문 내 개별 쿼리 실행 패턴 변경 없음. KB embedding/graph 재큐 로직의 `CHUNK_SIZE` 분할은 BullMQ `addBulk` 대상이지 DB 쿼리가 아니며 그대로 유지.
- **인덱스**: 이번 diff 는 WHERE 절 컬럼(예: `auth_oauth_state.state`, `execution.id`, `knowledge_base.id`)을 바꾸지 않았고 새 쿼리도 추가하지 않았다 — 인덱스 영향 없음.
- **커넥션 관리**: `dataSource.query`/`manager.query`/트랜잭션 매니저 생명주기 패턴 자체는 변경 없음.
- **마이그레이션/스키마**: 이번 diff 에 스키마 변경 없음. 해당 없음.
- **문서(plan/review 산출물)**: `plan/in-progress/update-returning-tuple-shape.md`, `plan/in-progress/ie-resume-turn-boundary-cancel.md` 소급 정정 배너, `review/code/.../20_36_35/*`, `review/consistency/.../20_36_36/*` 는 리뷰·plan 산출물로 DB 런타임 동작에 영향 없음.

## 요약

이번 변경(이전 라운드 발견분 + 소급 fix)은 새로운 DB 위험을 도입하기보다, 조용히 무력화돼 있던 CAS
락(KB 재추출·재임베딩)·admission 게이트(execution 동시성 cap)·OAuth state 소비(소셜 로그인)를
`updateReturningRows()` 헬퍼로 바로잡는 정정이다. 직접 소스를 열어 확인한 결과 모든 수정 지점이
헬퍼를 정확히 거치고, 파라미터 바인딩·트랜잭션 경계(advisory lock 포함)도 그대로 보존돼 있다.
남은 지적은 전부 INFO 수준 — (1) `reEmbedAll` 의 CAS+reset 이 여전히 비-원자적(기존 구조, 이 diff
가 도입한 문제 아님), (2) `knowledge-base.service.ts` 5개 지점 중 1곳만 실측 튜플 shape 회귀
테스트를 갖췄다 — 이며 즉시 조치가 필요한 CRITICAL/WARNING 급 DB 결함은 없다.

## 위험도

LOW
