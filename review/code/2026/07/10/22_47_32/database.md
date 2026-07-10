# DB 리뷰 — EIA `getStatus()` 2단계 projection 전환

대상: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()`
(diff base: `origin/main`)

## 발견사항

- **[INFO]** `select` 배열 — 엔티티 프로퍼티명 전수 일치, 오기 없음
  - 위치: `interaction.service.ts:253-260` (1단계), `:284` (2단계)
  - 상세: `Execution` 엔티티(`execution.entity.ts`)와 대조한 결과 `'id'`, `'status'`, `'workflowId'`(→`workflow_id`), `'startedAt'`(→`started_at`), `'finishedAt'`(→`finished_at`), `'outputData'`(→`output_data`), `'conversationThread'`(→`conversation_thread`) 전부 TypeORM 엔티티 프로퍼티명(camelCase)이며 `@Column({name:...})` 매핑과 정확히 대응한다. 동일 파일의 기존 3개 호출부(`interact:154-157`, `refreshToken:207-210`, `loadAndAssertAlive:384-387`)가 이미 `select: ['id','status']` 패턴을 쓰고 있어 컨벤션과도 일치.
  - 결론: snake_case 오기·존재하지 않는 프로퍼티명 등 함정 없음.

- **[INFO]** partial entity 필드 접근 전수 확인 — 누락 없음 (침묵 회귀 없음)
  - 위치: `interaction.service.ts:353-379` (응답 조립부), `execution.*` 전체
  - 상세: `execution.id`(353), `execution.workflowId`(354), `execution.status`(276/355/361/368), `execution.outputData`(362/369, result/error), `execution.finishedAt`(376), `execution.startedAt`(377) — 응답 조립에서 참조되는 `execution.*` 필드는 모두 1단계 `select` 목록에 포함된다. `grep`으로 `execution.error`/`execution.inputData`/`execution.userVariables` 등 미선택 컬럼에 대한 접근이 없음을 확인. 리뷰 포커스에서 우려한 "`finishedAt ?? startedAt ?? new Date()` fallback 침묵 회귀" 케이스는 두 컬럼 모두 projection 에 포함돼 있어 실제로는 발생하지 않는다.
  - 테스트: `interaction.service.spec.ts` 신규 스위트가 이 정확한 회귀 패턴(`updatedAt` 실값 단언, `typeof==='string'`만으론 못 잡는 케이스)을 명시적으로 가드한다 — 방어가 코드와 테스트 양쪽에 이중으로 걸려 있어 안전.

- **[INFO]** 2단계 쿼리 `select: ['id', 'conversationThread']` 의 `id` 포함
  - 위치: `interaction.service.ts:282-285`
  - 상세: `where: { id: ctx.executionId }` 로 이미 PK 가 고정돼 있고 `threadRow.id` 는 코드에서 참조되지 않아 엄밀히는 불필요하지만, 같은 파일의 다른 얇은 조회들과 동일 관례(PK 를 명시적으로 select 목록에 포함)를 따른 것으로 해롭지 않다.

- **[LOW/WARNING]** waiting_for_input 경로에서 DB 왕복 쿼리 수가 2 → 3 으로 증가
  - 위치: `interaction.service.ts:281-294`
  - 상세: 기존 코드는 "풀 row 조회(1) + nodeExec 조회(1)" = 순차 2 쿼리였다. 신규 코드는 "얇은 row 조회(1) + [threadRow 조회, nodeExec 조회] 병렬(2)" = 총 3 쿼리(depth 는 여전히 2단계, `Promise.all` 로 지연시간 증가는 상쇄). `conversation_thread` 를 별도 SELECT 로 분리한 근본 이유상 단일 쿼리로 합칠 수 없다(첫 쿼리 시점엔 `status` 를 아직 모르므로 조건부 select 불가) — 즉 2단계 자체는 불가피한 설계다. 다만 `nodeExecutionRepository` 조회는 원래도 별도 테이블이라 병합 불가능했으므로, 이번 변경의 실질 비용은 "PK 단건 조회 쿼리 1개 추가"(latency 는 병렬화로 사실상 무시 가능, connection pool 순간 점유 1슬롯 증가) 뿐이다. `waiting_for_input` 은 폴링 빈도가 낮은(사용자 입력 대기) 상태라 트래픽 비중도 낮다. 위험도는 낮지만, 완전한 무비용은 아니므로 WARNING 으로 기록.
  - 제안: 현 상태로 충분히 안전. 굳이 더 줄이려면 `nodeExecutionRepository.findOne` 쪽에 `conversationThread` 를 얹을 수 없으므로(다른 테이블) 추가 최적화 여지는 크지 않다. 액션 불필요.

- **[INFO]** `Promise.all` 동시 쿼리와 커넥션 풀
  - 위치: `interaction.service.ts:281-294`
  - 상세: 두 `Repository.findOne` 호출은 동일 `QueryRunner`/트랜잭션에 묶여 있지 않고 각각 default manager 를 통해 풀에서 독립적으로 커넥션을 획득/반환한다. 단일 pg 커넥션에 동시 쿼리를 밀어 넣는(=직렬화 필요) 위험한 패턴이 아니며, TypeORM 트랜잭션(`QueryRunner` 명시 획득) 컨텍스트도 아니다. 안전.

- **[INFO]** TOCTOU (1단계↔2단계 사이 row 변화)
  - 위치: `interaction.service.ts:279-301`, JSDoc 233-244/277-280
  - 상세: 두 조회 사이 execution 상태가 바뀌거나(예: 재개돼 waiting 을 벗어남) row 자체가 사라지는 경우 모두 graceful 처리된다 — `threadRow`가 `null`이면 `threadRow?.conversationThread`이 `undefined`로 흘러 "durable thread 없음" 과 동일한 키 생략 경로로 수렴한다(신규 테스트 `'2단계 재조회가 null(조회 간 row 소멸)이면 conversationThread 키 미동봉'` 로 커버). 이 엔드포인트는 원래도 폴링성 스냅샷 응답(§5.3)이라 read skew 에 대한 강한 정합성 요구가 없고, 기존 `nodeExec` 조회도 동일한 race 특성을 이미 가지고 있었다(신규 도입 위험 아님). 문제 없음.

- **[INFO]** jsonb TOAST 관점의 실질 이득
  - 위치: `interaction.service.ts:246-261`
  - 상세: `conversation_thread` 는 최대 500 turn × turn당 4000자(≈2MB) 까지 자랄 수 있는 jsonb 로, Postgres TOAST(out-of-line 압축 저장, 통상 ~2KB 초과 시 적용) 대상이다. 종전 코드는 `waiting_for_input` 여부와 무관하게 매 폴링마다 이 컬럼을 SELECT * 로 싣고 있었다 — 즉 `running`/`pending`(폴링 빈도가 가장 높은 상태) 과 `completed`/`failed`(종료 후에도 한동안 조회 가능) 에서 불필요한 TOAST de-TOAST I/O + 네트워크 전송 + JS 역직렬화/GC 비용이 매번 발생했다. 이번 변경으로 해당 비용이 실제 필요 시점(`waiting_for_input` 응답 동봉)으로 좁혀진다 — 정당한 최적화.

- **[INFO]** 인덱스 — 신규/누락 인덱스 이슈 없음
  - 상세: 모든 조회가 PK(`execution.id`) 단건 조회이거나 기존 병행 조회(`NodeExecution`, `(executionId, status)` 복합 인덱스 `@Index(['executionId','status'])` 기존 존재, `node-execution.entity.ts:37`)로 이번 diff 로 스키마·인덱스 변경은 없다.

- **[INFO]** 마이그레이션 / 스키마 변경 없음
  - 상세: 이번 변경은 순수 쿼리(SELECT projection) 최적화이며 컬럼 추가/삭제/타입 변경이 없다. 무중단 배포 관점 위험 없음.

- **[INFO]** SQL 인젝션 — 해당 없음
  - 상세: 모든 조회가 TypeORM `Repository.findOne({ where: { id }, select: [...] })` 파라미터화 API 를 사용하며 raw SQL 조립이 없다.

- **[INFO]** 대량 데이터 / 페이지네이션 — 해당 없음
  - 상세: 단일 execution PK 조회로, 대용량 테이블 스캔·페이지네이션과 무관하다.

## 요약

`getStatus()` 를 "얇은 status projection 1단계 + `waiting_for_input` 한정 `conversation_thread` 재조회 2단계"로 나눈 리팩터링은 DB 관점에서 견고하다. `select` 배열은 `Execution` 엔티티의 camelCase 프로퍼티명과 전수 일치하며 스네이크케이스 오기가 없고, 응답 조립에 쓰이는 모든 `execution.*` 필드(특히 `updatedAt` fallback 의 `finishedAt`/`startedAt`)가 1단계 projection 에 포함돼 있어 리뷰 포커스에서 우려한 "선택 누락 → undefined → 침묵 fallback" 회귀는 실제로 발생하지 않는다(코드 확인 + 신규 유닛테스트 양쪽으로 가드됨). `waiting_for_input` 경로에서 DB 왕복 쿼리 수가 2→3 으로 소폭 늘지만 `Promise.all` 병렬화로 latency depth 는 그대로이고, PK 단건 조회라 커넥션 풀 부담도 미미해 실질 리스크는 낮다. 두 쿼리는 트랜잭션/QueryRunner 를 공유하지 않으므로 동시 실행이 안전하며, 1·2단계 사이 TOCTOU 는 기존에도 존재하던 스냅샷-응답 특성으로 이미 graceful 하게 흡수된다. jsonb TOAST 회피로 얻는 이득(대다수 폴링 상태에서 최대 ~2MB 컬럼을 매번 안 실어옴)은 실질적이고 근거가 명확하다. 스키마/마이그레이션/인덱스/SQL 인젝션/대량 데이터 관점에서는 해당 사항이 없거나 기존 상태 그대로다.

## 위험도

LOW
