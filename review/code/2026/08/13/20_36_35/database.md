# Database 리뷰 — update-returning-tuple-shape

## 개요

TypeORM 0.3.31 + pg 조합에서 `UPDATE`/`DELETE ... RETURNING` raw 쿼리가 `[rows, rowCount]`
튜플을 돌려주는데(반면 `SELECT`/`INSERT` 는 행 배열을 그대로 돌려줌), 이를 행 배열로 오인해
`.length`/`[0]`/`.map` 을 직접 쓰던 7개 지점을 `updateReturningRows()` 헬퍼로 통일한 변경.
`execution-engine.service.ts` 2곳, `knowledge-base.service.ts` 5곳 + 회귀 방지 구조적 가드
테스트(`update-returning-rows.spec.ts`) 추가.

## 발견사항

- **[INFO]** 기존 CAS 락·admission 가드가 실제로는 항상 통과/항상 실패하던 CRITICAL 급 동시성 결함을 이 diff 가 교정함 (참고용, 새로 도입된 문제 아님)
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:345`, `:719` (CAS 락) / `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2944` (admission 가드)
  - 상세: 수정 전 `acquired.length === 0`/`rows.length === 1` 은 튜플의 `.length`(항상 2)를 보고 있었다. 그 결과 `reExtractAll`/`reEmbedAll` 의 "idle→in_progress" CAS 락이 **한 번도 거절하지 못했다**(동시 재추출/재임베딩 요청이 겹쳐 들어와도 둘 다 통과 → `entity`/`chunk_entity` 삭제와 재큐잉이 중복 실행될 수 있었던 실제 데이터 정합성 결함). admission 가드도 `rows.length === 1` 이 영원히 거짓이라 매 실행 2초 지연 + `EXECUTION_STARTED` emit 사문화가 있었다(plan 문서에 실측 근거 기재). 이번 diff 는 `updateReturningRows()` 로 튜플 첫 원소를 언랩해 두 가드를 실제로 동작하게 만든다.
  - 제안: (조치 불요, 이미 이번 diff 의 목적) — 다만 `reExtractAll`/`reEmbedAll` 의 실제 프로덕션 동작 변화(이전에는 조용히 통과하던 동시 요청이 이제 409 로 거절됨)를 배포 노트/모니터링에 반영할 가치가 있다.

- **[INFO]** `manager.query<T>()`/`dataSource.query<T>()` 의 제네릭 타입 인자가 실제 런타임 shape(튜플)와 여전히 불일치
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:336`(`manager.query<{ id: string }[]>(...UPDATE...RETURNING)`), `:530`, `:563`, `:712`, `:728` 등 / `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2918`
  - 상세: `updateReturningRows(result: unknown)` 가 런타임 값은 올바르게 언랩하지만, 호출부의 `.query<{id:string}[]>()` 타입 인자 자체는 여전히 "행 배열"이라고 거짓 주장한다(실제로는 `[rows, rowCount]` 튜플). 컴파일러는 이 타입을 신뢰하므로, 향후 새 호출부가 헬퍼를 거치지 않고 `acquired[0].id` 처럼 튜플 첫 원소(배열)를 직접 행처럼 다뤄도 타입 에러가 나지 않는다. 재발 방지는 지금은 `update-returning-rows.spec.ts` 의 grep 기반 구조적 가드(개수 대조)에만 의존한다 — 이 가드는 `let`·구조분해·체이닝 형태를 놓친다고 스스로 명시한 사각지대가 있다.
  - 제안: 우선순위는 낮음(구조적 가드가 이미 기능함, 후속 plan 에도 "AST 로 넓혀야 한다"는 인지가 있음). 여력이 되면 `.query<T>()` 대신 `.query<UpdateReturningTuple<T>>()` 류의 별도 타입으로 튜플 shape 을 명시해, 컴파일러가 `.length`/`[0]` 오용을 잡을 수 있게 하는 것도 고려할 만하다.

- **[INFO]** `KnowledgeBaseService.reEmbedAll` 의 CAS 락 UPDATE 와 후속 reset UPDATE 가 여전히 트랜잭션 밖의 별도 두 문장 (diff 로 도입된 것 아님, 기존 구조)
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:711`(CAS 락 `dataSource.query`), `:728`(reset `dataSource.query`)
  - 상세: `reExtractAll` 은 CAS 락+DELETE+reset 을 `dataSource.transaction()` 한 트랜잭션으로 묶는 반면(파일 컨텍스트 334행), `reEmbedAll` 은 CAS 락(711행)과 reset(728행)이 별개의 non-transactional 문장이다. 이번 diff 가 건드린 것은 각 UPDATE 결과의 shape 해석뿐이라 새로 생긴 문제는 아니지만, CAS 락 성공 직후~reset UPDATE 사이 크래시 시 KB 가 `reembed_status='in_progress'` 로 남고 문서 status 는 리셋되지 않는 좁은 창이 여전히 존재한다.
  - 제안: 이번 PR 범위 밖. plan 문서의 후속 ②(`updateExecutionStatus` 트랜잭션화)와 별개로, `reEmbedAll` CAS+reset 원자화도 후속 검토 후보로 기록해 둘 만하다(강제는 아님).

- **[INFO]** `assertRowArray` 대체로 오류 메시지의 실행 컨텍스트(실행 ID·롤백 안내)가 사라짐
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2944`, `:8541`
  - 상세: 수정 전 `assertRowArray(rows, "admission UPDATE ... RETURNING, execution ${executionId}. 트랜잭션을 롤백한다(부분 적용 방지).")` 는 실패 시 실행 ID 와 "왜 위험한지"를 담은 메시지를 던졌다. `updateReturningRows()` 는 `UPDATE/DELETE RETURNING 결과가 배열이 아님 (typeof=${typeof result})` 이라는 범용 메시지만 던진다 — 여전히 트랜잭션 롤백(admission 경로)이나 에러 표면화(둘 다) 자체는 동일하게 일어나므로 기능적 손실은 없지만, 실제로 이 경로가 트리거될 경우(드라이버 응답이 배열이 아닌 극단 상황) 로그만으로 어느 실행/어느 호출부인지 특정하기 더 어려워진다.
  - 제안: 필요 시 `updateReturningRows` 에 선택적 `detail` 파라미터를 추가해 `assertRowArray` 처럼 호출부가 컨텍스트를 실어 보낼 수 있게 하는 것도 고려할 만하나, 발생 가능성이 사실상 0에 가까운 방어적 코드라 우선순위는 낮다.

- **SQL 인젝션**: 이번 diff 가 건드린 모든 raw 쿼리는 기존과 동일하게 파라미터 바인딩($1, $2, `ANY($1::uuid[])`)을 사용한다. 신규 SQL 텍스트 변경 없음 — 결과 해석 로직만 교체됐다. 인젝션 리스크 없음.
- **N+1 / 대량 데이터**: 이번 diff 는 반복문 내부의 쿼리 실행 방식을 바꾸지 않는다(`enqueueEmbedChunked`/graph 재큐 루프의 CHUNK_SIZE 분할은 BullMQ `addBulk` 대상이지 DB 쿼리가 아님). 기존 페이지네이션·청크 전략 그대로 유지.
- **커넥션 관리**: `dataSource.query`/`manager.query` 호출 패턴 자체는 변경 없음 — 트랜잭션 매니저 생명주기도 그대로.
- **마이그레이션/스키마**: 이번 diff 에 스키마 변경 없음. 해당 없음.
- **테스트 정합성 확인**: `update-returning-rows.spec.ts` 의 지점 수 카운트(execution-engine 2, knowledge-base 5)를 실제 소스에서 grep 으로 재확인 — `updateReturningRows(` 호출이 각각 정확히 2회/5회 존재하고, 남아있는 유일한 `.query()` 소비 지점(execution-engine.service.ts:8209, `SELECT ... FOR UPDATE`)은 SELECT 라 튜플 문제와 무관해 `assertRowArray` 유지가 올바르다. 헬퍼 누락 지점은 발견되지 않았다.

## 요약

DB 특화 관점에서 이 변경은 새로운 위험을 도입하기보다 **기존에 조용히 깨져 있던 CAS 락/admission 가드(사실상 항상-통과 또는 항상-실패)를 바로잡는 수정**이다. 모든 raw 쿼리가 파라미터화돼 있고 SQL 텍스트 자체는 손대지 않았으며, 트랜잭션 경계·청크 분할·재시도 보상 로직도 그대로 보존된다. `updateReturningRows` 헬퍼 + grep 기반 구조적 가드 테스트로 재발 방지 장치까지 마련했고, 실제 소스에서 지점 수를 재검증한 결과 헬퍼 누락 지점은 없었다. 남은 지적은 모두 INFO 수준(타입 인자가 여전히 튜플 shape 을 반영하지 않음, `reEmbedAll` 의 비-원자적 CAS+reset 은 이 diff 이전부터의 구조, 에러 메시지 컨텍스트 축소)으로 즉시 조치가 필요한 항목은 없다.

## 위험도

LOW
