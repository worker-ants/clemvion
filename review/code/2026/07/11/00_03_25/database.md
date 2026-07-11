# 데이터베이스(Database) 코드 리뷰

## 리뷰 대상 요약

`resolveWaitingNodeExecutionId` (execution-engine.service.ts) 에 신규 `assertCommandMatchesWaitingSurface` 표면 매트릭스 가드가 추가되며, 인터랙션 명령 처리(hot path: `continueExecution` / `continueButtonClick` / `continueAiConversation` / `endAiConversation`)마다 실행되는 DB 접근 패턴이 다음과 같이 바뀐다.

- 기존: `nodeExecutionRepository.find({ where: { executionId, status: WAITING_FOR_INPUT }, select: { id, nodeId, startedAt }, order: { startedAt: 'DESC' } })` — 쿼리 1회.
- 변경 후: 위 `find` 의 `select` 에 `outputData` 추가 + 그 결과로 얻은 `nodeId` 로 `nodeRepository.findOne({ where: { id: row.nodeId }, select: { id, type } })` PK 조회 1회 순차 추가 — 쿼리 2회.

스키마/엔티티/마이그레이션 변경은 이번 diff 에 없음(`node_execution.output_data` 는 기존 nullable jsonb 컬럼 재사용, `node.id` PK 조회).

## 발견사항

- **[WARNING]** `outputData` (JSONB, 크기 가변) 를 hot-path 쿼리 select 에 추가 — 표면 판정에는 문자열 1개만 필요
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `resolveWaitingNodeExecutionId` (select 확장), `assertCommandMatchesWaitingSurface` → `readPersistedInteractionType(row.outputData)` (`waiting-surface-guard.ts`)
  - 상세: `readPersistedInteractionType` 이 실제로 필요로 하는 값은 `outputData.meta.interactionType` (또는 legacy flat `outputData.interactionType`) 문자열 하나뿐이다. 그런데 select 는 `outputData` 컬럼 전체를 가져온다. AI 대화(`ai_conversation`/`ai_form_render`) 표면은 매 turn 마다 `outputData` 에 누적되는 `result.messages`, `meta.turnDebug`(LLM 호출 trace, `llmCalls` 배열), `meta.ragSources`/`ragDiagnostics` 등을 포함하므로(`ai-conversation-helpers.ts` `buildConversationMetaFromResumeState`/`buildConversationConfigFromOutput` 참조) 대화가 길어질수록(`maxTurns` 기본 20, `0`=무제한 — spec/4-nodes/3-ai/1-ai-agent.md §config) 이 blob 크기가 선형으로 커진다. 이 쿼리는 사용자가 메시지를 보낼 때마다(`continueAiConversation`), 버튼을 클릭할 때마다 등 **채팅형 인터랙션의 모든 턴에서 호출**되므로, turn 이 진행될수록 매번 점점 더 큰 JSONB 를 네트워크로 실어와 Node.js 에서 JSON.parse 해야 한다 — n턴 대화의 누적 비용이 O(n²) 성격을 띤다. Postgres 관점에서도 `output_data` 는 TOAST 대상이 될 수 있는 컬럼이라, 인덱스(`idx_node_execution_exec_status_active`, V095)로 행을 찾더라도 이 컬럼을 select 하면 별도 TOAST 테이블 detoast I/O 가 추가된다(인덱스 자체에는 영향 없음 — filter 컬럼은 `execution_id`/`status` 뿐).
  - 제안: 필요한 필드만 SQL 레벨에서 추출해 전송량을 줄인다. 예: TypeORM `select` object 대신 QueryBuilder 로
    ```ts
    .select(['ne.id', 'ne.nodeId', 'ne.startedAt'])
    .addSelect(`ne.output_data->'meta'->>'interactionType'`, 'metaInteractionType')
    .addSelect(`ne.output_data->>'interactionType'`, 'legacyInteractionType')
    ```
    처럼 JSONB 경로 연산자로 두 개의 짧은 문자열만 select 하면, 서버가 detoast/파싱은 하되(그 비용은 인덱스로 줄일 수 없음) 네트워크 전송량과 Node.js 측 JSON.parse/메모리 비용은 제거된다. 더 근본적으로는 park 시점에 `waiting_interaction_type` 같은 얕은 컬럼(또는 이미 있다면 재사용)을 함께 기록해 이 hot-path 쿼리가 JSONB 를 전혀 건드리지 않게 하는 편이 장기적으로 가장 저렴하다 — 다만 이는 스키마 변경(마이그레이션)이 필요한 더 큰 작업이라 이번 PR 범위를 넘어설 수 있음. 최소한 QueryBuilder 프로젝션 전환은 스키마 변경 없이 적용 가능.

- **[WARNING]** 신규 `nodeRepository.findOne` PK 조회가 기존 1왕복 쿼리를 hot path 마다 2왕복으로 늘림 — JOIN 으로 병합 가능
  - 위치: `assertCommandMatchesWaitingSurface` 내 `this.nodeRepository.findOne({ where: { id: row.nodeId }, select: { id: true, type: true } })`
  - 상세: 개별 쿼리 자체는 PK(uuid) 조회라 인덱스 비용은 무시할 만하지만, 인터랙션 명령 처리마다 순차 라운드트립이 1회 늘어난다(`find` → 결과의 `nodeId` 를 기다렸다가 `findOne`). 인터랙션 명령은 사용자 입력(채팅 메시지, 버튼 클릭)마다 발화하는 latency-sensitive 경로라, DB RTT 가 큰 배포 환경(예: 리전 분리된 RDS)에서는 매 턴 왕복 지연이 누적된다.
  - 제안: `NodeExecution` 엔티티에 이미 `node: Node` ManyToOne relation 이 정의되어 있으므로(`node-execution.entity.ts`), 최초 `find` 호출에 `relations: ['node']` (또는 QueryBuilder `leftJoinAndSelect`) 를 추가해 `node.type` 을 같은 쿼리에서 함께 가져오면 라운드트립을 1회로 되돌릴 수 있다. select 축소(`select: { id, nodeId, startedAt, outputData, node: { id, type } }`)와 병행하면 쿼리 수·전송량 둘 다 개선된다. CRITICAL 은 아님 — PK lookup 자체는 저렴하고, 기능 정확성에는 영향 없음.

- **[INFO]** 기존 인덱스가 이번 쿼리 패턴을 이미 커버
  - 위치: `node_execution` 엔티티 `@Index(['executionId', 'status'])` + `migrations/V095__node_execution_exec_status_active_index.sql` (`WHERE status IN ('waiting_for_input','running')` partial index)
  - 상세: `resolveWaitingNodeExecutionId` 의 `WHERE execution_id=$1 AND status='waiting_for_input'` 은 이 partial composite index 로 인덱스 스캔된다. `outputData` select 확장은 필터 조건에 관여하지 않으므로 인덱스 사용 여부 자체에는 영향 없음(위 WARNING 은 순수 heap/TOAST fetch·전송 비용 문제).

- **[INFO]** SQL 인젝션 위험 없음
  - 위치: 신규 `nodeRepository.findOne` 포함 모든 쿼리
  - 상세: TypeORM repository API(`where`/`select` object) 로만 구성되어 파라미터화된다. 문자열 조합 raw SQL 없음.

- **[INFO]** 트랜잭션/정합성 영향 없음
  - 위치: `resolveWaitingNodeExecutionId` → `assertCommandMatchesWaitingSurface`
  - 상세: 두 쿼리 모두 read-only 이고, 이후 실제 상태 전이는 별도의 `continuationBus.publish` 경로(기존 아키텍처, 이번 diff 무관)가 처리한다. 신규 가드는 publish 이전에 동기 거부만 하므로 새로운 트랜잭션 경계나 락 요구사항을 만들지 않는다. `find` 와 신규 `findOne` 사이의 시간 창에서 이론상 대상 노드/타입이 바뀔 가능성은 극히 낮고(노드 정의는 워크플로 편집 시에만 바뀌며 삭제 시 CASCADE 로 NodeExecution 도 함께 삭제되는 관계라 orphan 조회는 `null` 처리로 이미 fail-closed 되어 있음) 실질적 레이스 리스크는 낮다.

- **[INFO]** 대량 데이터/페이지네이션 해당 없음
  - 상세: `find` 는 실행당 최대 1건(정상)·2건 이상이면 invariant 위반으로 즉시 거부하는 기존 로직 그대로이며, 페이지네이션이 필요한 목록 조회가 아니다. 문제의 초점은 "행 수"가 아니라 "단일 행의 JSONB 크기"임(위 WARNING 참조).

- **[INFO]** 마이그레이션 없음 — 스키마 변경 없이 기존 컬럼 재사용
  - 상세: 이번 diff 는 엔티티/마이그레이션 파일을 포함하지 않는다. select 확장·신규 findOne 모두 기존 컬럼/테이블 대상이라 무중단 배포 관점의 lock/데이터 손실 리스크 없음.

## 요약

이번 변경은 스키마·마이그레이션·SQL 인젝션·트랜잭션 관점에서는 위험이 없고, 필터링에 쓰이는 인덱스(V095 partial composite index)도 그대로 유효하다. 다만 인터랙션 명령 hot path 에 두 가지 비용이 새로 추가됐다: (1) 표면 판정에 필요한 것은 `outputData.meta.interactionType` 문자열 하나뿐인데 `outputData` JSONB 컬럼 전체를 select 하게 되어, AI 대화처럼 turn 마다 누적되는(메시지/RAG/LLM trace 등) 큰 blob 을 매 턴 반복해서 네트워크로 옮기고 JS 로 파싱하는 비용이 대화 길이에 비례해 커진다 — SQL 레벨 JSONB 경로 프로젝션(`->>'interactionType'`)으로 필요한 값만 select 하거나, 장기적으로 얕은 전용 컬럼으로 옮기는 것이 저렴한 대안이다. (2) 신규 `nodeRepository.findOne` PK 조회가 기존 1쿼리를 순차 2쿼리로 늘려 hot path 마다 라운드트립이 추가됐는데, 이미 정의된 `node` relation 을 이용한 JOIN(단일 쿼리)으로 되돌릴 수 있다. 둘 다 기능적 정확성에는 문제가 없는 성능 최적화 여지이며 지금 당장 장애를 일으키는 수준은 아니라고 판단해 WARNING 으로 표기한다.

## 위험도

MEDIUM
