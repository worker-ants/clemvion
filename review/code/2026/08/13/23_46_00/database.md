# 데이터베이스(Database) 코드 리뷰

## 리뷰 범위

이번 diff(`origin/main...HEAD`)의 실질 코드 변경은 **TypeORM 0.3.31 + pg 드라이버가 `UPDATE`/`DELETE ... RETURNING` 에 대해 행 배열이 아니라 `[rows, rowCount]` 튜플을 반환한다**는 실측 결함을 공유 헬퍼 `updateReturningRows()`로 통일 수정한 것이다. 대상 소비 지점 8곳:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `admitExecutionOrDefer`(admission gate UPDATE), `updateExecutionStatus`(짝 전이 guarded UPDATE)
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — `reExtractAll`/`reEmbedAll` CAS 락 2곳, embedding/graph 재큐 UPDATE 2곳, `reEmbedAll` reset UPDATE 1곳
- `codebase/backend/src/modules/auth/auth-oauth.service.ts` — OAuth state 소비 `DELETE ... RETURNING`
- 신규 `codebase/backend/src/common/utils/update-returning-rows.ts` (+ `.spec.ts`)

나머지 파일(`plan/**`, `review/code/**`, `review/consistency/**`)은 이 결함의 소급 기록·리뷰 산출물이며 DB 코드 자체는 없다.

## 발견사항

- **[INFO]** 잠재해 있던 CAS 락·admission gate 무력화 버그의 정당한 수정 — 신규 결함 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `admitExecutionOrDefer`(약 2913-2944행), `updateExecutionStatus`(약 8507-8548행); `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` `reExtractAll`(약 336-352행), `reEmbedAll`(약 719-756행), `requeueDocuments`(약 533-586행)
  - 상세: 수정 전에는 `UPDATE ... RETURNING` 의 실제 반환값(튜플, `.length` 가 항상 `2`)을 행 배열로 오인해 `rows.length === 1`(admission 게이트), `acquired.length === 0`(KB CAS 락 거절), `reset.length === 0`(빈 KB idle 복귀) 판정이 전부 고정된 값으로 평가됐다. 이는 동시성 가드가 조용히 무력화된 DB 정합성 결함이었다(admission cap 이 실질적으로 매 실행마다 우회 재구동 경로로 새고, KB 재추출/재임베딩 CAS 락이 한 번도 거절하지 않아 동시 요청이 통과, 빈 KB 가 `in_progress` 상태로 영구 좌초). 이번 diff 는 신규 헬퍼로 튜플을 올바르게 언랩해 각 가드를 실제로 작동시킨다. 모든 소비 지점이 `it.each` 기반 판별 테스트(튜플 `[[{id}],1]` vs `[[],0]`)와 뮤테이션 검증(RESOLUTION 기록상 5/5, 8/8 사살)으로 뒷받침돼 있다.
  - 제안: 조치 불요 — 정상적인 버그 수정.

- **[INFO]** 배포 시 관측 가능한 동시성 동작 변화(신규 결함 아님, 운영 관측 필요).
  - 위치: 위와 동일 소비 지점 전체
  - 상세: CAS 락·admission cap 이 배포 직후 처음으로 "실제로" 거절/승인하기 시작한다 — KB 재추출/재임베딩 동시 요청은 이제 409(`KB_REEXTRACT_IN_PROGRESS`/`KB_REEMBED_IN_PROGRESS`)를 받고, workspace/workflow 동시 실행 cap 은 실제로 defer 를 발동시킨다. DB 자체의 데이터 정합성은 개선되는 방향이지만(잠금이 실제로 걸림), 이전에는 한 번도 거절되지 않던 요청 패턴에 의존하던 클라이언트가 있다면 이번 배포에서 처음 체감할 수 있다. `plan/in-progress/update-returning-tuple-shape.md` §후속에 배포 후 관측 항목으로 이미 등재돼 있다.
  - 제안: 조치 불요 — 이미 plan 에 관측 계획이 기록됨. DB 관점에서 추가로 덧붙일 것은, 이 변화가 잠금 경합을 늘리는 스키마/인덱스 문제가 아니라 애플리케이션 레벨 판정 로직 수정이므로 별도 인덱스 튜닝은 불필요하다는 점뿐이다.

- **[INFO]** `updateReturningRows` 의 튜플/행-배열 판별 휴리스틱은 드라이버 shape 가정에 의존한다(문서화된 한계, 신규 결함 아님).
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:44-56` (`Array.isArray(result[0])` 로 튜플 여부 판정)
  - 상세: `[rows, rowCount]` 튜플과 순수 행 배열을 구분하는 유일한 신호가 "첫 원소가 배열인가"이다. pg/TypeORM 이 행을 항상 평평한 객체(`{col: value}`)로 반환하는 현재 실측 동작에서는 안전하지만, 드라이버/TypeORM 메이저 업그레이드로 반환 shape 이 다시 바뀌면(예: 세 번째 shape 도입) 이 휴리스틱이 조용히 오분류할 수 있다. JSDoc 이 이미 "드라이버/버전에 따라 달라질 수 있다"고 명시하고 있어 인지된 트레이드오프다.
  - 제안: 조치 불요 — 다만 TypeORM/pg 메이저 버전 업그레이드 시 `update-returning-rows.spec.ts` 의 판별 테스트를 실제 드라이버로 재실측하는 절차를 업그레이드 체크리스트에 남겨두면 좋다.

- **[INFO]** SQL 인젝션 없음 — 확인.
  - 위치: 8개 소비 지점의 모든 raw query(`this.dataSource.query`/`manager.query`/`this.executionRepository.query`)
  - 상세: 전부 `$1, $2, ...` 파라미터 바인딩만 사용하고(예: `execution-engine.service.ts` admission UPDATE 의 `[executionId, workspaceId, wsCap, execution.workflowId, wfCap]`, `knowledge-base.service.ts` CAS UPDATE 의 `[id, workspaceId]`, `auth-oauth.service.ts` 의 `[state]`), 사용자 입력을 SQL 문자열에 직접 결합하는 지점은 없다. 이번 diff 는 반환값 파싱 로직만 바꿨을 뿐 쿼리 문자열 자체는 무변경.
  - 제안: 없음.

- **[INFO]** 대량 데이터/N+1/트랜잭션/마이그레이션/인덱스/커넥션 관리 — 이번 diff 범위에서 해당 관점의 신규 변경 없음.
  - 상세: (N+1) 신규 반복문 내 개별 쿼리 없음 — 기존 `CHUNK_SIZE` 단위 `addBulk` 배치 큐잉 로직은 그대로 유지되고 이번 diff 는 그 입력(`rows.map(...)` → `rowsOut.map(...)`)만 올바르게 고쳤다. (트랜잭션) `admitExecutionOrDefer`는 여전히 `manager.transaction()` 안에서 실행되고, shape 이 어긋나면 `updateReturningRows` 가 던져 트랜잭션을 롤백하는 기존 안전장치(구 `assertRowArray`와 동일 계약)를 그대로 보존한다. `reEmbedAll` 의 CAS UPDATE 와 이후 document reset UPDATE 가 단일 트랜잭션으로 묶여 있지 않은 점은 origin/main 시점부터 존재하던 기존 설계이며 이번 diff 가 손대지 않았다(비교 확인 완료) — 이번 리뷰의 신규 발견 대상이 아니다. (마이그레이션/스키마) 스키마 변경·마이그레이션 파일 없음. (인덱스) 변경된 WHERE 절 없음(모두 `id`/`workspace_id`/`state`/`status` 조건으로 기존 쿼리와 동일). (커넥션 관리) 기존 `DataSource`/`EntityManager` 사용 패턴 그대로, 신규 커넥션 개설·해제 로직 없음.
  - 제안: 없음.

## 요약

이번 변경은 신규 DB 위험을 도입하는 것이 아니라, TypeORM raw `UPDATE`/`DELETE ... RETURNING` 이 튜플을 반환한다는 실측 사실을 무시하고 있던 기존 결함(admission cap 우회, KB CAS 락 무력화, 빈 KB 좌초, OAuth state 소비 오판정)을 8개 소비 지점에서 일괄 수정한 correctness/concurrency 패치다. 모든 raw query 는 파라미터 바인딩을 유지하고, 트랜잭션 경계·롤백 시맨틱은 손대지 않았으며, 배치 큐잉(CHUNK_SIZE) 구조도 보존된다. 유일하게 짚을 만한 것은 이 수정으로 인해 배포 후 CAS 락·admission cap 이 "처음으로 실제 작동"하면서 이전에는 관측되지 않던 거절/지연 동작이 나타날 수 있다는 점인데, 이는 코드 결함이 아니라 이미 plan 문서에 관측 항목으로 기록된 예상된 동작 변화다. DB 관점에서 CRITICAL/WARNING 급 신규 결함은 발견되지 않았다.

## 위험도

LOW
