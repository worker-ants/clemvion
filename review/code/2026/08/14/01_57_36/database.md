# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `KnowledgeBaseService.reEmbedAll` 의 CAS 락 UPDATE 와 후속 reset UPDATE 가 여전히 트랜잭션 밖의 별도 두 문장이다 (이번 diff 로 도입된 문제 아님, 기존 구조 — 이전 라운드(`20_36_35`/`22_45_24`/`23_07_11` database.md)에서도 반복 지적됨)
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — `reEmbedAll` 내부 CAS 락 `this.dataSource.query(...)`(약 720행)와 그 아래 reset `this.dataSource.query(...)`(약 740행) 사이에 `dataSource.transaction()` 래핑이 없다. 대조군: 같은 파일의 `reExtractAll`(약 334행)은 CAS 락+DELETE+reset+SELECT 를 `dataSource.transaction(async (manager) => {...})` 하나로 묶는다.
  - 상세: 이번 diff 가 건드린 것은 각 UPDATE 결과의 shape 해석(`updateReturningRows` 도입)뿐이고 트랜잭션 경계 자체는 변경하지 않았다. CAS 락 UPDATE 가 `reembed_status='in_progress'` 로 성공 커밋된 직후 ~ 문서 reset UPDATE 사이에 프로세스가 죽으면, KB 는 `reembed_status='in_progress'` 로 남고 문서의 `embedding_status`/`embedding_retry_count`/`embedding_error_message` 는 리셋되지 않은 채 남는 좁은 창이 여전히 존재한다. `reExtractAll` 은 이미 이 문제를 트랜잭션으로 닫았는데 `reEmbedAll` 만 비대칭이다.
  - 제안: 이번 PR 범위 밖(diff 가 만든 회귀가 아님)이나, `reExtractAll` 과 동일하게 `dataSource.transaction()` 으로 CAS 락+reset 을 묶는 후속 정리를 고려할 만하다. 현재는 크래시 시 `reembed_status='in_progress'` 로 좌초하는 KB 를 사람이 수동 개입해야 회복 가능하다는 점만 인지하고 있으면 됨(즉시 데이터 손상은 아님).

- **[INFO]** `manager.query()`/`this.dataSource.query()` 호출부 대부분이 이제 `unknown` 타입으로 결과를 받아, 이전에 있던 (실제로는 검증되지 않던) 제네릭 타입 표기를 제거했다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`admitExecutionOrDefer` 약 2918행, `updateExecutionStatus` 약 8504행), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (`reExtractAll`/`reEmbedAll`/`retryFailedDocuments` 각 UPDATE 호출부)
  - 상세: 이는 개선이지 결함이 아니다 — `EntityManager.query`/`DataSource.query` 의 선언 타입이 원래 `Promise<any>` 라 예전 제네릭(`m.query<{ id: string }[]>(...)`)은 컴파일러가 검증해 주지 못하는 "주장"이었고, 실제로 그 주장이 UPDATE/DELETE RETURNING 에서 틀렸다(TypeORM 0.3.31 + pg 는 `[rows, rowCount]` 튜플을 반환). `unknown` + `updateReturningRows()`/`assertRowArray()` 런타임 판별로 대체한 것은 타입 안전성이 실제 계약을 반영하도록 고친 것으로 평가한다.

## 요약

이번 diff 는 TypeORM `0.3.31` + `pg` 드라이버가 raw `.query()` 로 실행한 `UPDATE`/`DELETE ... RETURNING` 에 대해 행 배열이 아니라 `[rows, rowCount]` 튜플을 반환한다는 사실을, 8개 소비 지점(`execution-engine.service.ts` 2곳 — admission CAS·`updateExecutionStatus`; `knowledge-base.service.ts` 5곳 — CAS 락 2·재큐 2·reset 1; `auth-oauth.service.ts` 1곳 — OAuth state 소비)이 행 배열로 오독해 왔던 실제 CRITICAL 결함을 바로잡는다. 영향은 심각했다 — 소셜 로그인 상시 실패(모든 정상 콜백이 `OAUTH_STATE_MISMATCH`), execution admission 동시성 cap 사문화, KB 재추출/재임베딩 CAS 락이 한 번도 거절하지 못해 동시 요청 시 `entity`/`chunk_entity` 삭제·문서 재큐가 중복 실행될 수 있었던 데이터 정합성 결함. 수정은 `updateReturningRows()`(신규) / `assertRowArray()`(기존, SELECT 전용으로 역할 재규정)로 튜플·행배열 두 shape 을 안전하게 판별하는 단일 헬퍼로 일원화했고, 8개 지점 전수 적용을 grep 기반 구조적 회귀 가드(`assert-row-array.spec.ts`, `update-returning-rows.spec.ts`)로 고정했다. 원래 SQL 텍스트·파라미터 바인딩(`$1, $2, ...`)은 변경되지 않아 SQL 인젝션 리스크 없음, 트랜잭션 경계(예: admission CAS 의 `manager.transaction` 롤백, `reExtractAll` 의 단일 트랜잭션)도 보존되거나 오히려 실제로 작동하게 됐다. 뮤테이션 테스트(8곳 전수 사살 확인, RESOLUTION.md 기록)와 실 드라이버 위 e2e(`auth-oauth-callback.e2e-spec.ts` 신규, `pg.Client` 로 실제 시드/조회)까지 갖춰 검증 수준이 높다. 남은 지적은 모두 INFO 수준(이번 diff 이전부터 있던 `reEmbedAll` 의 비-원자적 CAS+reset, 그리고 `unknown` 전환은 개선으로 평가)이며 즉시 조치가 필요한 CRITICAL/WARNING 급 DB 결함은 없다.

## 위험도

NONE
