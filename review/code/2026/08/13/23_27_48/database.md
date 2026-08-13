# 데이터베이스(Database) 코드 리뷰

## 리뷰 범위

핵심 코드 diff:
- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규 헬퍼)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` / `.spec.ts`
- `codebase/backend/src/common/utils/assert-row-array.spec.ts` (주석·기대값 갱신)

나머지(plan 문서, 이전 리뷰 라운드 산출물 `review/code/2026/08/13/{20_36_35,22_45_24}/**`)는 코드가 아니므로
DB 관점 별도 발견사항 없음(참고 컨텍스트로만 사용).

## 배경

TypeORM 0.3.31 + pg 조합에서 `UPDATE`/`DELETE ... RETURNING` 은 행 배열이 아니라
`[rows, rowCount]` **튜플**을 반환한다(`SELECT`/`INSERT`는 행 배열 그대로). 기존 8개 소비
지점이 이를 행 배열로 오인해 `.length`/`.map`/`[0]` 을 직접 적용해 왔고, 이번 diff 는
`updateReturningRows()` 헬퍼로 이를 통일 수정한다. 이는 데이터베이스 관점에서 **동시성
가드(CAS 락·admission 게이트·terminal 전이 가드)가 실질적으로 무력화돼 있던 correctness
버그의 수정**이다.

## 발견사항

- **[INFO]** `updateReturningRows` 는 순수 shape-판별 유틸이며 실제 SQL 문·트랜잭션 경계는
  건드리지 않는다 — 확인 결과 트랜잭션 정합성은 이 diff 이전과 동일하게 유지된다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:329-372`
    (`reExtractAll` — CAS 락 UPDATE·`DELETE FROM entity`·문서 상태 UPDATE·문서 ID SELECT가
    모두 `this.dataSource.transaction(async (manager) => {...})` 한 트랜잭션 안에서 실행),
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2913-2952`
    (`admitExecutionOrDefer` — `pg_advisory_xact_lock` + 조건부 UPDATE가
    `this.executionRepository.manager.transaction(...)` 안에서 실행, CAS 실패 시 `ConflictException`이
    아니라 `false` 반환이지만 트랜잭션 자체는 정상 커밋되는 기존 설계 그대로).
  - 상세: `updateReturningRows` 도입으로 CAS 락 거절 분기가 이제 실제로 실행되므로, 트랜잭션
    내부에서 `throw`가 일어나면(예: `reExtractAll`의 `ConflictException`) TypeORM이 롤백을
    수행해 부분 적용(엔티티만 삭제되고 상태는 그대로 등)을 막는다 — 정상 동작.
  - 제안: 없음(정상).

- **[INFO]** `reEmbedAll`의 CAS 락 UPDATE와 뒤이은 문서 리셋 UPDATE는 하나의 트랜잭션으로
  묶여 있지 않다 — 다만 이는 이번 diff가 도입한 변경이 아니라 `origin/main`에도 이미 존재하던
  구조이며, 이번 diff는 그 두 쿼리의 반환값 해석 방식만 `updateReturningRows`로 교체했다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:714-731`
    (CAS 락 UPDATE, `this.dataSource.query(...)` — 트랜잭션 밖), `:741-753`
    (문서 리셋 UPDATE, 역시 `this.dataSource.query(...)` — 별개의 non-transactional 호출).
    `reExtractAll`(위 항목)과 대비된다 — 같은 파일 안에서 CAS-lock-then-mutate 패턴이 한쪽은
    트랜잭션으로, 다른 쪽은 두 개의 독립 statement 로 구현돼 있다.
  - 상세: 두 UPDATE 사이에 프로세스가 크래시하면 `knowledge_base.reembed_status='in_progress'`
    로 잠긴 채 `document` 테이블 리셋이 적용되지 않아, KB가 재임베딩 불가 상태로 좌초할 수
    있다. 다만 (a) 이 경로는 diff 범위 밖의 기존 동작이고, (b) `finalizeReembedIfDrained`/
    stuck-recovery 계열 백스톱이 이미 별도로 존재할 가능성이 있어(`stuck-document-recovery.service.ts`
    참조 — 이번 diff가 참조만 하는 파일) 실제 운영 영향은 별도 조사가 필요하다. 이번 PR의
    책임 범위(튜플 shape 오인 수정)를 벗어나므로 CRITICAL/WARNING으로 올리지 않는다.
  - 제안: 이번 diff와 무관하므로 조치 불요. 다만 후속 작업으로 `reEmbedAll`의 두 UPDATE도
    `reExtractAll`처럼 단일 트랜잭션으로 묶는 것을 고려할 가치는 있다(별도 plan 항목 권장).

- **[INFO]** SQL 인젝션 표면 없음 — 확인.
  - 위치: 변경된 모든 raw query 호출부(`update-returning-rows.ts`는 SQL을 직접 다루지 않음;
    `auth-oauth.service.ts:147-150`의 `DELETE ... WHERE state = $1 ...`; `execution-engine.service.ts`
    admission UPDATE(`$1`..`$5`) 및 `updateExecutionStatus`의 guarded UPDATE; `knowledge-base.service.ts`
    의 CAS 락·재큐·reset UPDATE 5곳)가 전부 `$n` 파라미터 바인딩만 사용한다. 이번 diff가
    바꾼 부분은 결과 파싱(`.length`/`[0]`/`.map`)뿐이며 SQL 문자열·바인딩 방식은 그대로다.
  - 제안: 없음.

- **[INFO]** 인덱스·N+1·대량 데이터/페이지네이션 — 이번 diff가 새로 추가한 쿼리는 없다.
  - 상세: 모든 `WHERE` 절(`id = $1 AND workspace_id = $2 AND status = 'idle'` 류)은 diff 이전과
    동일하며, 반복문 안에서 개별 쿼리를 실행하는 패턴도 신규 도입되지 않았다(`knowledge-base.service.ts`
    의 청크 적재는 `CHUNK_SIZE` 배치 `addBulk`로 기존과 동일). `updateReturningRows` 자체는
    순수 JS 배열 판별 함수로 DB 호출을 하지 않는다.
  - 제안: 없음.

- **[INFO]** 마이그레이션·스키마 변경 없음 — 확인.
  - 상세: 리뷰 대상 파일 중 `*.migration.ts`/DDL 은 없다. 컬럼·테이블 구조 변경 없음.
  - 제안: 해당 없음.

- **[INFO]** 커넥션 관리 — 변경 없음.
  - 상세: 모든 쿼리가 기존과 동일하게 `DataSource.query`/`EntityManager.query`/
    `Repository.query`(TypeORM 커넥션 풀 경유)를 통해 실행되며, 수동 커넥션 획득/해제
    코드는 도입되지 않았다.
  - 제안: 없음.

## 요약

이번 변경은 TypeORM 0.3.31 + pg 가 `UPDATE`/`DELETE ... RETURNING` 에서만 `[rows, rowCount]`
튜플을 반환한다는 실측 사실을 근거로, 이를 행 배열로 오인해 왔던 8개 소비 지점(KB CAS 락 2곳,
재큐/리셋 3곳, execution admission 게이트, execution 상태 전이 가드, OAuth state 소비 1곳)을
공유 헬퍼 `updateReturningRows()`로 통일 수정한 **데이터베이스 correctness 버그 수정**이다.
새로 추가되거나 변경된 raw SQL은 모두 파라미터 바인딩을 사용해 인젝션 위험이 없고, 트랜잭션
경계(`reExtractAll`, admission 게이트)는 diff 이전과 동일하게 보존되며 실제로는 CAS 거절
분기가 살아남으로써 부분 적용 방지가 더 정확해졌다. 인덱스·N+1·마이그레이션·커넥션 관리·
대량 데이터 페이지네이션 관점에서 이번 diff가 새로 도입한 위험은 없다. 유일하게 참고할
사항은 `reEmbedAll`의 CAS-lock UPDATE와 문서 리셋 UPDATE가 (diff 이전부터) 단일 트랜잭션이
아니라는 점인데, 이는 이번 PR 범위 밖의 기존 설계라 별도 후속 검토 대상으로만 남긴다.

## 위험도

LOW
