# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `updateReturningRows` 의 튜플/행-배열 판별이 `Array.isArray(result[0])` 구조 휴리스틱 하나에 의존한다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts` (`updateReturningRows` 함수, `if (Array.isArray(result[0]))` 분기)
  - 상세: 이 헬퍼가 고치는 결함 자체가 "TypeORM 0.3.31 + pg 드라이버의 raw `.query()` 가 `UPDATE`/`DELETE` 에만 `[rows, rowCount]` 튜플을 돌려준다" 는, 코드가 아니라 **드라이버 버전 동작에** 의존하는 사실이었다(plan 문서에 실측으로 잘 고정돼 있음). 헬퍼는 이 실측을 `Array.isArray(result[0])` 라는 구조적 판별 하나로 캡슐화했는데, 이는 pg 드라이버가 향후 `SELECT`/`INSERT` 결과의 첫 행 자체가 배열 형태를 갖는 경우(예: 배열 타입 컬럼만 SELECT 하는 극단적 케이스는 아니지만, row 가 객체가 아니라 배열로 오는 드라이버 변경)에는 오분류할 이론적 여지가 있다. 다만 이번 PR 은 이미 8개 소비 지점 전수에 걸쳐 실측 shape 문자열 테스트 + 뮤테이션 사살(5/5, 8/8)로 검증했고, 헬퍼 자체도 버전이 다시 바뀌면 재발할 수 있음을 JSDoc 에 명시해 뒀다.
  - 제안: 조치 불요 — 이미 문서화·테스트된 트레이드오프다. 다음에 TypeORM/pg 드라이버 메이저 버전을 올릴 때 `update-returning-rows.spec.ts` 의 첫 세 개 단위 테스트(튜플/0행-튜플/행-배열-직접)를 실 드라이버로 재확인하라는 후속 체크리스트 항목만 있으면 충분하다.

- **[INFO] (검증만, 결함 아님)** 이 PR 이 되살린 `KB_REEXTRACT_IN_PROGRESS`/`KB_REEMBED_IN_PROGRESS` CAS 락 거절 분기, `updateExecutionStatus` 의 "동시 cancel 선점" 분기, `admitExecutionOrDefer` 의 concurrency cap 분기는 전부 **프로덕션에서 지금까지 한 번도 발동한 적이 없던 코드**다(튜플 길이가 항상 2 라 조건이 늘 반대로 평가됐음). 배포 직후 이 분기들이 처음 실제로 타면서 `409 KB_REEXTRACT_IN_PROGRESS`/`KB_REEMBED_IN_PROGRESS` 응답, admission 지연 감소, concurrency cap 실집행 등 관측 가능한 행동 변화가 예상된다. 이는 이번 diff 의 버그가 아니라 정상적으로 고쳐진 결과이며, plan(`plan/in-progress/update-returning-tuple-shape.md`) 과 관련 후속 plan 에 배포 후 관측 항목으로 이미 등재돼 있다.

## 점검 관점별 확인

1. **인덱스** — 이번 diff 는 기존 `UPDATE ... WHERE id = $1 AND workspace_id = $2 AND status = 'idle'`, `DELETE FROM auth_oauth_state WHERE state = $1 AND expires_at > NOW()` 등 쿼리문 자체를 변경하지 않는다(반환값 파싱만 수정). 신규 WHERE 절·JOIN 이 없어 인덱스 영향 없음.
2. **N+1** — `reset.map`/`rowsOut.map` 은 이미 조회된 배열에 대한 in-memory map 이며 반복 쿼리가 아니다. `enqueueEmbedChunked`/`addBulk` 기반 청크 처리(`CHUNK_SIZE`)도 이번 diff 로 변경되지 않았다. N+1 신규 도입 없음.
3. **트랜잭션** — `reExtractAll`(CAS 락 + DELETE + UPDATE + SELECT)과 `updateExecutionStatus` 의 linked-node-exec 분기(`FOR UPDATE` 잠금 + save)는 기존과 동일하게 `dataSource.transaction`/`manager` 안에서 원자적으로 처리되며, 이번 diff 는 그 안의 반환값 해석만 `updateReturningRows` 로 교체했다. 오히려 이전에는 CAS 락 거절 분기가 죽어 있어(튜플이라 항상 통과) 트랜잭션의 원자성 보장이 실질적으로 무력화돼 있었는데, 이번 수정으로 CAS 락이 실제로 기능하게 됐다 — 정합성 개선.
4. **마이그레이션 안전성** — 스키마/마이그레이션 변경 없음. 해당 없음.
5. **스키마 설계** — 테이블 구조 변경 없음. 해당 없음.
6. **커넥션 관리** — `this.dataSource.query`/`manager.query` 호출 패턴 자체는 변경되지 않았고, 커넥션 획득/해제 방식에 대한 수정도 없다.
7. **SQL 인젝션** — 모든 쿼리가 `$1`/`$2` 파라미터 바인딩을 그대로 유지한다(`state`, `id`, `workspaceId` 등 사용자 입력은 전부 파라미터화). 문자열 결합으로 값이 삽입되는 곳 없음.
8. **대량 데이터** — `CHUNK_SIZE` 청크 분할·`addBulk` 방식은 이번 diff 로 변경되지 않았으며, KB 문서 대량 재큐/재추출 경로의 페이지네이션·배치 처리 구조는 그대로 유지된다.

## 요약

이번 변경(`8332d9a20` 계열)은 TypeORM 0.3.31 + pg 조합에서 raw `.query()` 가 `UPDATE`/`DELETE ... RETURNING` 에 한해 `[rows, rowCount]` 튜플을 돌려주는데, 8개 소비 지점(execution-engine 2·knowledge-base 5·auth-oauth 1)이 이를 행 배열로 오인해 CAS 락·admission cap·동시 cancel 선점·OAuth state 소비 검증이 사실상 무력화돼 있던 결함을 `updateReturningRows` 단일 헬퍼로 수정한다. 관련 쿼리문·트랜잭션 경계·파라미터 바인딩 방식 자체는 손대지 않고 결과 파싱만 교정했으며, 8개 지점 전수에 실측 shape 테스트 + 뮤테이션 사살(engine/KB 5·auth-oauth 별도)로 회귀를 막는 구조적 가드까지 갖췄다. 인덱스·N+1·마이그레이션·스키마·커넥션·SQL 인젝션·대량 데이터 어느 관점에서도 이번 diff 가 새로 도입한 위험은 발견되지 않았고, 오히려 죽어 있던 정합성 가드(CAS 락·admission cap)가 되살아나는 개선이다.

## 위험도

LOW
