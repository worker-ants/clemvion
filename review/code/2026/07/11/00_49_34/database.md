# 데이터베이스(Database) 리뷰

검토 대상: `resolveWaitingNodeExecutionId` (`codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5187-5244`) 의 2왕복(`find` + `nodeRepository.findOne`) → 단일 `createQueryBuilder` JOIN 재작성. 직전 리뷰(`review/code/2026/07/11/00_03_25`)의 WARNING(`output_data` 컬럼 전체 select + 순차 2왕복)에 대한 후속 수정.

비교를 위해 재작성 전 코드(commit `9ba336453`)와 현재 코드(commit `2244539a9`)를 `git show`로 직접 대조했고, FK 제약(`migrations/V001__initial_schema.sql`), 인덱스 정의(`migrations/V095__node_execution_exec_status_active_index.sql`), 단위/e2e 테스트(`execution-engine.service.spec.ts:2108-2121`, `test/execution-park-resume.e2e-spec.ts:356-424`)를 함께 확인했다.

## 발견사항

- **[INFO] (a) JSONB path 투영이 실제로 `output_data` 컬럼 전체를 싣지 않음 — 확인됨**
  - 위치: `execution-engine.service.ts:5193-5210`
  - 상세: `createQueryBuilder('ne').select('ne.id','id')...` 로 기본 `ne.*` select 를 명시적으로 override 하고, `addSelect`로 `ne.id` / `ne.node_id` / `n.type` / `COALESCE(ne.output_data -> 'meta' ->> 'interactionType', ne.output_data ->> 'interactionType')` 네 개 표현식만 나열한다. 생성되는 SQL 은 `SELECT "ne"."id", "ne"."node_id", "n"."type", COALESCE(...) FROM node_execution ne INNER JOIN node n ON ... WHERE ...` 형태로, 재작성 전 코드(`find({select:{... outputData: true}})`)가 컬럼 전체를 가져오던 것과 달리 텍스트 값 하나만 전송한다. 회귀 테스트(`execution-engine.service.spec.ts:2110-2121`)도 `selected` 목록에 `'ne.output_data'` 단독 호출이 없는지 명시적으로 가드한다.
  - 참고(순수 정보, 조치 불필요): Postgres 는 `->>` 로 JSONB 내부 key 를 추출할 때도 서버 측에서는 TOAST 압축 값을 detoast 해야 하므로(현재 Postgres 버전은 JSONB 경로 추출에 대한 부분 detoast 를 지원하지 않는다), storage I/O 관점의 절감 효과는 제한적일 수 있다. 다만 이번 수정이 실제로 겨냥한 비용 — **네트워크 전송량**과 **Node.js 측 `JSON.parse`/GC 비용**(대화 turn 이 누적될수록 커지는 blob 을 매 hot-path 호출마다 파싱하던 부분) — 은 확실히 제거된다. 기능적으로 문제 없음.

- **[WARNING] (a) 부속 — SQL `COALESCE` 투영이 `readPersistedInteractionType`(SoT)의 타입 가드를 완전히 미러링하지 않음**
  - 위치: `execution-engine.service.ts:5199-5204` vs `waiting-surface-guard.ts:394-407` (`readPersistedInteractionType`)
  - 상세: JS 쪽 SoT 는 `typeof metaType === 'string'` 을 명시적으로 검사해, `meta.interactionType` 이 문자열이 아니면(숫자·불리언·객체 등) legacy flat root(`out.interactionType`)로 폴백한다 — `waiting-surface-guard.spec.ts`의 `readPersistedInteractionType({ meta: { interactionType: 7 } })` → `undefined` 테스트가 이 계약을 명시적으로 고정한다. 반면 SQL `COALESCE(ne.output_data -> 'meta' ->> 'interactionType', ne.output_data ->> 'interactionType')` 는 `->>` 연산자가 JSON 값이 `null` 이 아닌 한(숫자·불리언 포함) 항상 텍스트로 캐스팅해 반환하므로, `meta.interactionType` 이 예컨대 `7` 처럼 비-문자열이면 COALESCE 는 첫 피연산자(`'7'`)를 즉시 채택하고 **legacy root fallback 을 시도하지 않는다** — JS 쪽과 분기 결과가 달라진다.
  - 실무 영향: 정상 엔진 코드는 `meta.interactionType` 에 항상 문자열만 기록하므로 이 분기는 사실상 도달 불가한 손상 데이터 케이스에 한정된다. 도달하더라도 `resolveWaitingSurface` 는 `'7'` 같은 값을 알려진 표면 문자열(`'buttons'`/`'ai_conversation'`/`'ai_form_render'`)과 매칭시키지 못해 결국 `undefined` → fail-closed `INVALID_EXECUTION_STATE` 거부로 귀결되므로, **데이터 훼손이나 오처리로 이어지지는 않는다**(안전한 방향의 divergence). 다만 JSDoc(`execution-engine.service.ts:5199` 주석 "`readPersistedInteractionType` 와 동일 규칙을 SQL 로 표현한다")이 주장하는 완전 동치는 이 edge case 에서는 사실이 아니다.
  - 제안: 우선순위는 낮음(INFO 로 낮춰도 무방). 정확한 동치가 필요하면 `COALESCE(NULLIF(jsonb_typeof(ne.output_data->'meta'->'interactionType'), 'string') IS NULL ...)` 류로 타입 체크를 SQL에 추가하거나, 주석에서 "타입 비검사 edge case 는 fail-closed 로 수렴"이라는 단서를 덧붙이는 정도로 충분.

- **[INFO] (b) `innerJoin('ne.node','n')`이 노드 정의 부재 행을 0건으로 만드는 것은 안전 — FK `ON DELETE CASCADE` 로 보장됨**
  - 위치: `execution-engine.service.ts:5195` (innerJoin) vs `node-execution.entity.ts:50-55`, `migrations/V001__initial_schema.sql:237`(`node_id UUID NOT NULL REFERENCES node(id) ON DELETE CASCADE`)
  - 상세: 재작성 전 코드는 `assertCommandMatchesWaitingSurface` 내부에서 별도 `nodeRepository.findOne({where:{id: row.nodeId}})` 로 명시적 null-check 후 `waiting node ${row.nodeId} not found` 라는 구체적 경고를 남기고 거부했다. 재작성 후에는 `innerJoin`이 매칭 실패 행을 결과셋에서 제외하므로, 그 케이스는 `rows.length === 0` 분기(일반 "WAITING_FOR_INPUT NodeExecution 없음", `debug` 레벨)로 흡수된다. 그러나 `node_id` 컬럼이 `NOT NULL` + FK `ON DELETE CASCADE`(DB 레벨로 실제 적용됨, TypeORM 데코레이터뿐 아니라 마이그레이션 DDL 에도 존재)이므로, `node` 행이 삭제되면 그 `node`를 참조하는 `node_execution` 행도 같은 트랜잭션에서 cascade 삭제된다 — "node_execution 은 남아있는데 참조하는 node 만 사라진" 상태는 커밋된 데이터에서 구조적으로 존재할 수 없다. 따라서 innerJoin 이 이 케이스를 조용히 0건으로 만드는 것은 **실질적으로 도달 불가능한 경로에 대한 것이며 기능적으로 안전**하다.
  - 유일한 실손실: 그 이론적 케이스에 대한 진단 로그의 구체성(`warn` + "node=... 부재" 메시지 → `debug` + 일반 "없음" 메시지)이 낮아졌다. FK 무결성이 항상 보장되는 한 실무 영향은 없다.
  - 제안: 조치 불필요. 다만 향후 raw SQL로 FK 를 우회하는 데이터 마이그레이션/백필 스크립트가 생기면 이 가정이 깨질 수 있음을 유념(현재 diff 범위 밖).

- **[INFO] (c) 인덱스 활용 — WHERE 절 불변, partial composite index 그대로 적중**
  - 위치: `execution-engine.service.ts:5205-5208` (`WHERE ne.execution_id = :executionId AND ne.status = :status`) vs `migrations/V095__node_execution_exec_status_active_index.sql` (`idx_node_execution_exec_status_active ON node_execution (execution_id, status) WHERE status IN ('waiting_for_input','running')`)
  - 상세: 필터 조건은 재작성 전후로 `execution_id = $1 AND status = 'waiting_for_input'` 그대로다 — select 목록 확장(JSONB 투영, `node` JOIN)이나 정렬(`ORDER BY ne.started_at DESC`, 기존과 동일)은 WHERE 절에 관여하지 않으므로 partial composite index 스캔에 영향 없다. `INNER JOIN node n ON n.id = ne.node_id`는 `node.id`(PK) 단일 행 lookup이라 사실상 무시 가능한 추가 비용이다. 정상 케이스는 `node_execution` 쪽에서 1행만 반환되므로 JOIN 이후 행 폭증도 없다.
  - 제안: 조치 불필요.

- **[INFO] (d) SQL Injection — 파라미터 바인딩 정상**
  - 위치: `execution-engine.service.ts:5205-5208`, `5202`
  - 상세: `.where('ne.execution_id = :executionId', { executionId })` / `.andWhere('ne.status = :status', { status: NodeExecutionStatus.WAITING_FOR_INPUT })` 모두 TypeORM named parameter 로 바인딩되며 문자열 결합 없음. 새로 추가된 `COALESCE(...)` 표현식은 외부 입력이 전혀 섞이지 않는 정적 리터럴(컬럼명/JSON key 이름만 하드코딩)이라 injection 표면이 아니다. 안전.

- **[INFO] 부수 효과 — 이전 리뷰가 지적한 "2왕복이 레이스 윈도우를 넓힌다"는 우려도 이번 재작성으로 함께 해소됨**
  - 위치: `execution-engine.service.ts:5266-5293` (`assertCommandMatchesWaitingSurface`, 이제 `async` 아님)
  - 상세: 재작성 전에는 `assertCommandMatchesWaitingSurface` 내부에서 별도 `nodeRepository.findOne` await 이 있어 `resolveWaitingNodeExecutionId` 호출부터 실제 publish 까지 두 번째 DB 왕복만큼 시점이 늦춰졌다(직전 아키텍처 리뷰가 "레이스 윈도우 폭 확대"로 지적). 이번 단일 JOIN 재작성으로 `assertCommandMatchesWaitingSurface`가 순수 동기 함수가 되어 그 추가 왕복 자체가 사라졌다 — 성능 개선이 동시성 관점의 부작용도 함께 되돌린 것으로 판단된다. 별도 조치 불필요.

- **트랜잭션/커넥션 관리**: 이번 diff 는 read-only SELECT 한 건으로 구성되며 트랜잭션 경계나 커넥션 풀 사용 방식에 변화가 없다(TypeORM repository 기본 풀 경유, 명시적 커넥션 획득/해제 없음 — 기존과 동일). 대기 상태 전이(RUNNING 등)는 이 publisher 경로가 아니라 별도 BullMQ worker 가 처리하는 기존 설계 그대로이며 이 diff 범위 밖.
- **마이그레이션/스키마**: 이번 변경에 신규 마이그레이션·엔티티·컬럼 변경 없음(`git diff --stat` 확인). 기존 `node_execution.output_data` nullable jsonb 컬럼과 `node.id` PK 조회만 재사용.
- **N+1**: 반복문 내 개별 쿼리 패턴 없음 — 단일 명령당 단일 쿼리(이전의 2쿼리에서 1쿼리로 축소).
- **대량 데이터/페이지네이션**: `execution_id`로 좁힌 뒤 partial index 로 소수 행만 스캔하는 점 lookup 성격이라 대용량 페이지네이션 이슈 해당 없음.

## 요약

`resolveWaitingNodeExecutionId`의 단일 JOIN QueryBuilder 재작성은 직전 리뷰가 지적한 두 문제(①`output_data` JSONB 컬럼 전체 select, ②순차 2왕복)를 실제로 해소한다 — 생성 SQL 을 직접 추적한 결과 `output_data` 컬럼 자체는 select 목록에 없고 `COALESCE(...->>'interactionType')` 텍스트 값 하나만 투영되며, `node.type`은 별도 `findOne` 대신 같은 쿼리의 `innerJoin`으로 가져와 왕복이 1회로 줄었다(부수적으로 이전 아키텍처 리뷰가 지적한 레이스 윈도우 확대 우려도 함께 되돌아갔다). `WHERE execution_id=$1 AND status='waiting_for_input'` 필터는 그대로라 V095 partial composite index 를 계속 적중하고, 파라미터는 전부 TypeORM named binding 이라 SQL 인젝션 우려도 없다. `innerJoin`이 노드 정의 부재 행을 결과에서 제외하는 동작은 `node_id`가 `NOT NULL` + `ON DELETE CASCADE` FK 로 DB 레벨까지 보장되므로 실질적으로 도달 불가능한 케이스에 대한 것이라 안전하며, 이전의 구체적 진단 로그 하나가 일반화된 정도의 부수적 손실만 있다. 유일하게 정밀 검토가 필요한 지점은 SQL `COALESCE`가 `readPersistedInteractionType`(SoT)의 "비-문자열 값은 legacy root로 폴백" 타입 가드를 완전히 미러링하지 않는다는 점인데, 이는 정상 엔진 코드가 절대 생성하지 않는 손상 데이터에서만 드러나고 그 경우도 안전한 방향(fail-closed 거부)으로 수렴해 실질 위험은 낮다. 스키마·마이그레이션·트랜잭션·커넥션 관리 관점에서는 이번 diff 에 변화가 없다.

## 위험도

LOW
