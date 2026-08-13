# 데이터베이스(Database) 리뷰 결과

## 검토 범위

핵심 DB 관련 변경은 아래 4개 소스 파일이다 (나머지는 plan 문서·이전 리뷰 세션 산출물로 DB 관점 신규 코드 없음).

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규 헬퍼)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`

배경: TypeORM 0.3.31 + pg 드라이버가 `UPDATE`/`DELETE ... RETURNING` 에 대해서만 `[rows, rowCount]`
튜플을 돌려주는데(SELECT/INSERT 는 행 배열), 8개 소비 지점이 이를 행 배열로 오인해 `.length`/`.map`
을 직접 적용해 왔다. 이번 diff 는 신규 헬퍼 `updateReturningRows()` 로 이 shape 판별을 일원화한다.

## 발견사항

- **[INFO]** `reEmbedAll` 의 CAS 락 UPDATE → 문서 reset UPDATE → (0행 시) idle 복귀 UPDATE 세 단계가 단일 트랜잭션으로 묶여 있지 않다 (기존 구조, 이번 diff 는 shape 처리만 교체).
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` `reEmbedAll` 함수 — CAS 락 UPDATE(`reembed_status = 'in_progress'`), 이어지는 `document` reset UPDATE, 조건부 idle 복귀 UPDATE 가 각각 별도의 `this.dataSource.query(...)` 호출이다.
  - 상세: 같은 파일의 `reExtractAll` 은 CAS 락 UPDATE 를 `this.dataSource.transaction(...)` 안에서 실행하도록 이미 감싸져 있는데(이번 diff 로 shape 처리만 바뀌고 트랜잭션 경계는 유지), `reEmbedAll` 은 세 쓰기가 각자 독립 커넥션/스테이트먼트다. CAS 락으로 `reembed_status='in_progress'` 를 커밋한 직후 프로세스가 죽거나 reset UPDATE 가 실패하면, 그 KB 는 문서 하나도 재큐되지 않은 채 `in_progress` 로 좌초할 수 있다 — 이번 diff 가 정확히 고친 "빈 KB 가 `in_progress` 로 영구 좌초" 버그와 같은 증상을, 트랜잭션 경계 밖의 실패로도 만들 수 있는 여지가 남아 있다는 뜻이다. 다만 이는 이번 diff 가 새로 만든 문제가 아니라 기존 구조이고, 헬퍼 JSDoc 이 참조하는 `stuck-document-recovery` 서비스가 이런 좌초 상태를 애플리케이션 레벨에서 복구하는 것으로 보인다.
  - 제안: 조치 불요(스코프 밖) — 다만 `reEmbedAll` 의 CAS 락 + reset 두 UPDATE 를 `reExtractAll` 과 동일하게 `dataSource.transaction()` 으로 묶으면 이 경로도 원자성을 얻는다. 별도 항목으로 다룰 가치가 있다.

## DB 관점 나머지 항목 평가

- **인덱스**: 이번 diff 는 WHERE 절·쿼리 자체를 바꾸지 않고 반환값 해석만 교체했다. `id`(PK)/`workspace_id`/status 컬럼 조건은 기존 그대로라 신규 인덱스 이슈 없음.
- **N+1**: 전부 단일 batch `UPDATE ... RETURNING` 문이며 반복문 내 개별 쿼리 실행 없음. 해당 없음.
- **트랜잭션**: `admitExecutionOrDefer` 의 advisory lock + 조건부 UPDATE 는 `executionRepository.manager.transaction(...)` 안에서 그대로 유지되고, `updateReturningRows` 가 비정상 shape 에 throw 하면 트랜잭션이 롤백돼 부분 적용을 막는다(주석에 의도 명시) — 올바르다. `reExtractAll` 도 트랜잭션 경계 유지. `reEmbedAll` 은 위 INFO 참고.
- **마이그레이션 안전성**: 스키마 변경 없음(`git diff --stat` 상 migration 파일 0건).
- **스키마 설계**: 테이블 구조 변경 없음.
- **커넥션 관리**: TypeORM `DataSource.query`/`transaction`/`EntityManager.query` 표준 경로만 사용, 수동 커넥션 획득/해제 없음. 변경 없음.
- **SQL 인젝션**: 모든 쿼리가 `$1`, `$2` 파라미터 바인딩을 사용한다(`auth-oauth.service.ts` DELETE, execution-engine UPDATE, knowledge-base UPDATE 전부). 문자열 결합 없음 — 문제 없음.
- **대량 데이터**: KB 재큐 로직은 `RETURNING id` 로 전체 대상 id 를 한 번에 메모리에 올린 뒤 `CHUNK_SIZE` 단위로 큐 적재하는 기존 패턴을 그대로 유지한다(이번 diff 는 그 배열을 얻는 shape 해석만 교체) — 신규 회귀 없음.

## 헬퍼(`updateReturningRows`) 자체 검증

`Array.isArray(result[0])` 로 "튜플인가"를 판별하는 휴리스틱은 Postgres RETURNING 이 항상 행을
객체로 반환한다는 전제(행 자체가 배열일 수 없음) 위에서 안전하다. JSDoc 에 드라이버 실측 근거
(`[[{id}],1]` / `[[],0]` / `[{id}]`)가 남아 있고, RESOLUTION 문서 기준 KB 5개 지점 전수 뮤테이션
(5/5 사살) 및 execution-engine 판별 테스트로 검증됐다. 소비 지점 재발 방지용 구조적 회귀 가드
(`update-returning-rows.spec.ts` 의 `it.each(EXPECTED)`)도 정규식 기반이지만 신규 미가드 지점
추가를 잡아내도록 설계돼 있다.

## 요약

이번 변경은 새로운 DB 리스크를 도입하는 것이 아니라, TypeORM/pg 드라이버의 `UPDATE`/`DELETE
... RETURNING` 반환 shape 오인으로 인해 **실제로 죽어 있던 DB 레벨 동시성 제어**(admission
cap 조건부 UPDATE, execution 짝 전이 guarded UPDATE, KB CAS 락 2곳, auth-oauth state 소비
확인)를 정상 작동시키는 수정이다. 모든 쿼리는 파라미터화돼 있고, 트랜잭션 경계(advisory lock
admission gate, KB reExtractAll)는 그대로 유지되며 헬퍼가 throw 하면 올바르게 롤백된다.
유일하게 눈에 띄는 잔여 사항은 `reEmbedAll` 의 CAS 락 UPDATE 와 문서 reset UPDATE 가 단일
트랜잭션으로 묶여 있지 않다는 점(기존 구조, 이번 diff 범위 밖)으로, 프로세스 중단 시 좌초
가능성이 이론상 남아 있으나 새로 생긴 결함은 아니고 별도 복구 메커니즘이 이미 존재하는 것으로
보인다. CRITICAL/WARNING 급 DB 결함 없음.

## 위험도

LOW
