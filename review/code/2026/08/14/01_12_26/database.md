# Database Review — 2026/08/14 01_12_26

## 발견사항

- **[INFO]** `updateReturningRows` 의 튜플/행-배열 판별 휴리스틱은 TypeORM/pg 드라이버의 비공개(undocumented) 내부 동작(`PostgresQueryRunner.query` 의 `switch (raw.command)`)에 의존한다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:52` (`if (Array.isArray(result[0])) { return result[0] as T[]; }`)
  - 상세: 이번 diff 는 `UPDATE`/`DELETE ... RETURNING` 이 `[rows, rowCount]` 튜플로, `SELECT`/`INSERT ... RETURNING` 은 행 배열로 온다는 실측(4개월간 살아있던 실제 CRITICAL 버그: admission 카운팅 무력화, KB CAS 락 미거절, OAuth state DELETE 오판)을 바탕으로 `Array.isArray(result[0])` 여부로 두 shape 을 구분한다. pg 드라이버가 행을 항상 plain object 로 반환하는 한(현재 사실) 이 구분은 안전하지만, TypeORM/pg 마이너 업그레이드가 이 내부 규약을 바꾸면 같은 결함 클래스가 조용히 재발할 수 있다 — 컴파일 타임에는 전혀 보이지 않는다(`result: unknown` 이므로).
  - 제안: 이미 `test/auth-oauth-callback.e2e-spec.ts` 가 실 드라이버 위에서 shape 을 검증하고 있어 상당 부분 완화된다. TypeORM/pg 버전을 올리는 PR 에서는 이 e2e 스위트(및 `update-returning-rows.spec.ts`)가 반드시 재실행되도록 CI 트리거 경로를 확인해 두면 좋다(신규 액션 요구 아님, 향후 참고용).

- **[INFO]** `reEmbedAll` 의 CAS 락 UPDATE 와 뒤이은 문서 리셋 UPDATE 가 하나의 트랜잭션으로 묶여 있지 않다 (이번 diff 가 만든 구조는 아니며, shape 언랩만 바뀌었다).
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` `reEmbedAll` (CAS 획득 720행대, reset 739행대 — 게이트 없는 전체-파일 컨텍스트 밖이라 함수명으로 기재)
  - 상세: `reExtractAll` 은 CAS 락 UPDATE + entity 삭제 + 문서 재큐를 `this.dataSource.transaction(...)` 으로 묶는 반면, `reEmbedAll` 은 CAS 락 UPDATE 와 document reset UPDATE 를 별도 statement 로 실행한다. 각 statement 자체는 원자적(단일 UPDATE)이라 CAS 의미는 유지되지만, 두 UPDATE 사이에 프로세스가 죽으면 `knowledge_base.reembed_status='in_progress'` 로 남고 문서는 reset 되지 않은 상태로 좌초할 창이 이론상 존재한다. 이번 PR 의 스코프(shape 언랩 버그 수정)와는 무관한 기존 설계라 이번 diff 의 결함으로 잡지는 않는다.
  - 제안: 별도 후속 검토 대상으로만 참고(이번 PR 블로킹 아님).

## 요약

이번 변경의 핵심은 TypeORM 0.3.31 + pg 조합에서 `UPDATE`/`DELETE ... RETURNING` 이 행 배열이 아니라 `[rows, rowCount]` 튜플을 반환한다는 사실을 코드 8곳이 몰라 생긴 실제 프로덕션 결함(소셜 로그인 상시 실패, execution admission 카운팅 무력화, KB re-extract/re-embed CAS 락 미거절, 종결 이벤트 emit 판단 오류)을 `updateReturningRows` 단일 헬퍼로 정정하는 데이터베이스 정합성 버그 픽스다. 모든 쿼리는 기존과 동일하게 파라미터화(`$1, $2, ...`)를 유지해 SQL 인젝션 우려가 없고, CAS 락은 단일 원자 `UPDATE ... WHERE ... RETURNING` 패턴을 그대로 쓰며(admission 은 `pg_advisory_xact_lock` + 트랜잭션 안에서 수행), 스키마·마이그레이션 변경은 전혀 없다. 특히 헬퍼의 튜플 판별 로직에 대해 단위 테스트(`update-returning-rows.spec.ts`)뿐 아니라 실제 DB 드라이버 위에서 shape 을 확정하는 e2e(`auth-oauth-callback.e2e-spec.ts`)를 추가하고, `assertRowArray`/`updateReturningRows` 두 헬퍼의 소비 지점 수를 정적 카운터로 회귀 고정해 향후 신규 UPDATE/DELETE 지점이 헬퍼를 누락하면 테스트가 RED 로 떨어지게 만든 점이 돋보인다. 새로 도입한 위험은 발견되지 않았고, 남은 두 관찰(INFO)은 각각 드라이버 내부 동작 의존성에 대한 향후 주의 사항, 그리고 이번 diff 범위 밖의 기존 트랜잭션 경계 설계로 블로킹 대상이 아니다.

## 위험도
LOW
