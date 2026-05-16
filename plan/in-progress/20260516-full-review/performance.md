# 성능(Performance) 리뷰 — Full-Project Audit (main bbd838ef)

## 발견사항

- **[CRITICAL]** `sanitizePayloadForWs` 가 모든 WS 이벤트 emit 경로에서 재귀 순회 실행
  - 위치: `backend/src/modules/websocket/websocket.service.ts:92-107`, `emitExecutionEvent`, `emitNodeEvent`, `emitKbEvent`, `emitBackgroundRunEvent` 호출마다
  - 상세: `sanitizePayloadForWs` 는 깊이 10까지 재귀하며 모든 키를 정규식(`CREDENTIAL_KEY_PATTERN`) 으로 검사한다. `execution.ai_message` 이벤트의 `messages` 배열은 수십 개 LLM turn을 포함할 수 있고, 각 노드 완료(NODE_COMPLETED) 이벤트의 `output` 도 대형 JSON일 수 있다. 워크플로 하나에 100개 노드가 있고 각 ForEach가 50 iteration 돌면 5000+ emit 이 동기적으로 sanitize를 거친다. 더불어 정규식 객체(`CREDENTIAL_KEY_PATTERN`)는 모듈 레벨 상수라 컴파일 비용은 없으나, 오브젝트 키 전체를 순회하는 비용 자체가 무시할 수 없다. 실측 데이터 없이도 대형 payload에서 O(n·d) (n=키 수, d=깊이) 의 CPU 소비가 발생한다.
  - 제안: (1) 소형 deny-list(`CREDENTIAL_KEY_PATTERN`)를 payload 전체가 아닌 설정 레이어(핸들러 출력 직후)에서 한 번만 적용하고 WS emit 시 재검사를 생략한다. (2) 특히 `messages` 배열처럼 이미 백엔드 내부에서 조합된 필드는 sanitize skip 하도록 allowlist 방식으로 전환한다. (3) 캡을 MAX_SANITIZE_DEPTH=5로 낮추는 임시 조치도 가능하다.

- **[CRITICAL]** ForEach 내부에서 `allNodes.find()` O(N) 선형 탐색이 매 iteration 반복
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts:3679`
  - 상세: `orphanEmitEdges` 에서 source 노드 레이블을 얻기 위해 `allNodes.find((n) => n.id === e.sourceNodeId)` 를 호출한다. 이 코드는 에러 케이스에서만 실행되므로 직접 hot path는 아니지만, `runContainerInner`→`scheduleBackgroundBody`→동일 패턴이 여러 곳에서 반복된다. 보다 근본적으로, `planContainerBody` 내에서 `children.find()`, `allNodes.find()`, `allEdges.filter()` 가 컨테이너 노드 준비 단계마다 O(N²) 에 가까운 선형 탐색을 수행한다. ForEach 1000 iteration, 노드 500개 시 플래닝 단계에서만 500×1000=500,000회 비교가 발생할 수 있다.
  - 제안: `ContainerBodyPlan` 에 이미 `nodeMap: Map<string, Node>` 필드가 캐시되어 있다(line 109). 동일한 패턴으로 노드 조회 코드를 `nodeMap.get(id)` 로 전환하여 O(1) 조회를 보장한다.

- **[WARNING]** `getSummary` 에서 `workflowId` 필터 시 동일 쿼리를 두 번 실행
  - 위치: `backend/src/modules/statistics/statistics.service.ts:80-123`
  - 상세: `workflowId` 파라미터가 있을 때 먼저 전체 집계 쿼리를 실행(`getRawOne`)하고, 이후 `workflowId` 필터를 추가한 동일 집계를 재실행하여 반환한다. 첫 번째 쿼리 결과를 완전히 버린다. 불필요한 DB 왕복 1회 (30-90일 집계 범위면 대형 sequential scan).
  - 제안: `workflowId` 유무를 먼저 확인 후 단일 쿼리를 구성하거나, 첫 번째 쿼리에 조건부 `andWhere` 를 추가해 분기를 제거한다.

- **[WARNING]** `executionPath` 조회 — `ExecutionNodeLog` findAll 후 전체 nodeId 배열을 메모리에 적재
  - 위치: `backend/src/modules/executions/executions.service.ts:123-127`
  - 상세: `findById` 내부에서 `manager.find(ExecutionNodeLog, { where: { executionId } })` 로 실행 경로 전체를 로드한다. 장기 실행 워크플로(Loop 1000회)는 수천 행을 메모리에 올린 후 `nodeId` 배열만 추출하고 나머지 컬럼을 버린다. `select: { nodeId: true }` 가 이미 적용되어 있어 컬럼 크기는 최소화됐으나, 행 수 자체에는 상한이 없다.
  - 제안: 페이지네이션 없이 전체 경로를 노출하는 현재 API 계약을 유지해야 한다면, `MAX_PATH_ROWS` 상한 + `LIMIT` SQL 절을 추가해 메모리 폭발을 방어한다.

- **[WARNING]** `deriveContainerAssignments` 가 에디터에서 모든 엣지 변경마다 최대 16 패스 순회
  - 위치: `frontend/src/lib/stores/editor-store.ts:281-304`
  - 상세: 엣지 하나를 추가/삭제할 때마다 `for (let pass = 0; pass < 16; pass++)` 내부에서 모든 엣지를 순회(`for (const e of edges)`)하며 `propagateContainerOnConnect` 를 호출한다. 노드 500개, 엣지 800개 규모의 대형 워크플로에서는 최악 16×800=12,800회 호출이 동기 렌더 사이클 안에서 일어난다. `onEdgesChange` 와 `onNodesChange` 모두 이 경로를 거친다.
  - 제안: containerId 를 엣지 데이터에 직접 embed 하거나(엣지가 source of truth), 파생 로직을 변경된 엣지만 처리하는 증분 방식으로 전환한다. 단기 대안: `pass < 16` 상한을 실제 필요한 체인 깊이(보통 5 이하)로 줄인다.

- **[WARNING]** `appendExecutionPath` 가 노드 실행 시마다 개별 `INSERT` DB 쓰기 수행
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts:1554-1567`
  - 상세: `executeNode` 완료마다 `execution_node_log` 에 개별 `INSERT` 를 수행한다. 100노드 워크플로 × ForEach 50 iteration = 5000 INSERT 요청이 순차 발생한다. 각 INSERT 는 별도 네트워크 왕복이므로 집적 시 지연이 크다. BIGSERIAL 단조증가 보장을 위해 배치 INSERT 가 어렵다는 설계적 이유가 있으나, 워크플로 완료 시 일괄 처리나 BullMQ 별도 큐 위임을 고려할 수 있다.
  - 제안: 실행 중에는 메모리 버퍼에 nodeId 를 누적하고 실행 완료(COMPLETED/FAILED) 시점에 배치 INSERT 한다. 순서는 append 순번 컬럼(배열 index)으로 보장한다.

- **[WARNING]** `sanitizePayloadForWs` 의 재귀 순회에서 빈 `result` 객체를 매번 새로 생성
  - 위치: `backend/src/modules/websocket/websocket.service.ts:98`
  - 상세: 재귀 호출마다 `const result: Record<string, unknown> = {}` 를 새로 할당하고 모든 키를 복사한다. 대형 payload에서 불필요한 GC pressure 를 유발한다. 민감 키가 없는 경우에도 전체 객체를 복사한다.
  - 제안: 먼저 민감 키 존재 여부를 예비 체크하고, 없으면 원본 참조를 그대로 반환한다.

- **[WARNING]** `resolveString` 에서 `EXPRESSION_PATTERN` / `FULL_EXPRESSION_PATTERN` 정규식이 캐시 없이 매번 실행
  - 위치: `backend/src/modules/execution-engine/expression/expression-resolver.service.ts:12-13, 239-245`
  - 상세: `EXPRESSION_PATTERN = /\{\{/` 와 `FULL_EXPRESSION_PATTERN` 는 모듈 상수이므로 컴파일 비용은 없다. 그러나 `resolveString` 은 모든 노드의 모든 config 문자열 필드마다 호출된다. `evaluate(value, ctx)` 후 `FULL_EXPRESSION_PATTERN.test(value)` 를 재실행하는데, 이미 `evaluate` 가 파싱을 완료한 시점에서 text 분류를 위해 중복 정규식 매칭을 수행한다.
  - 제안: `evaluate` 함수 반환값에 "단일 표현식 여부" 플래그를 포함시키거나, `EXPRESSION_PATTERN.test` 통과 후 바로 `FULL_EXPRESSION_PATTERN.exec` 로 그룹 캡처해서 단일 패스로 처리한다.

- **[WARNING]** `execution-engine.service.ts` 파일 자체가 73,000+ 토큰 — 단일 서비스에 과도한 책임 집중
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` 전체
  - 상세: 코드 자체가 ~4200줄이며, 그래프 순회, 노드 dispatch, 상태 머신, WS emit, 컨테이너 실행, sub-workflow recursion 등을 한 클래스에서 처리한다. 파일 크기가 크면 IDE 인덱싱 지연, hot reload 느림, 코드 리뷰 어려움 외에 의존성 변경 시 전체 재컴파일이 발생한다(Nest.js DI는 파일 단위 변경 감지). 주석(PR-H/I) 에서도 "점진적 책임 분해 예정" 을 명시한다.
  - 제안: `ContainerExecutor`, `BlockingInteractionManager`, `GraphTraversal` 등으로 책임 분해. 즉각 적용보다는 계획 수립 후 점진 분리가 현실적이다.

- **[WARNING]** `execution.snapshot` 을 조회하는 `emitExecutionSnapshot` 에서 `REPEATABLE READ` 트랜잭션 + `findById` 전체 조회 실행
  - 위치: `backend/src/modules/websocket/websocket.gateway.ts:258-284`
  - 상세: WS 채널 첫 subscribe 시마다 `executionsService.findById` 를 호출하는데, 이 함수는 `REPEATABLE READ` 트랜잭션, `NodeExecution` 전체 조회(relations: ['node']), `ExecutionNodeLog` 조회, `loadParentWorkflowNames` 등 여러 DB 쿼리를 실행한다. 동시에 많은 사용자가 같은 실행을 구독하는 시나리오(팀 공유 실행 모니터링)에서 반복 heavy 조회가 발생한다.
  - 제안: 단기: 완료된 실행의 snapshot 은 Redis에 캐시하여 반복 조회를 방어한다. 장기: snapshot 전용 경량 쿼리(필요한 컬럼만)를 별도로 작성한다.

- **[INFO]** `statistics.service.ts` — `TO_CHAR(…, 'YYYY-MM-DD')` 를 GROUP BY 기준으로 사용
  - 위치: `backend/src/modules/statistics/statistics.service.ts:135-154`
  - 상세: PostgreSQL 은 `TO_CHAR` 가 인덱스를 타지 않는다. `started_at` 컬럼에 btree 인덱스가 있더라도 `TO_CHAR` 래핑으로 인해 index range scan 이 불가하고 sequential scan 후 계산이 일어날 수 있다. 90일 집계 구간에서 수백만 행이면 느릴 수 있다.
  - 제안: `DATE_TRUNC('day', e.started_at AT TIME ZONE 'UTC')` 를 사용하면 함수 기반 인덱스를 활용할 수 있고, 결과를 ISO 형식으로 변환하는 것도 더 명확하다.

- **[INFO]** `Evaluator` 클래스가 `new` 로 매 expression 마다 인스턴스 생성
  - 위치: `packages/expression-engine/src/evaluator.ts:59-77`
  - 상세: `evaluate()` 최상위 함수(index.ts)는 표현식마다 `new Evaluator(context, options)` 를 생성한다. `startTime`/`depth` 는 인스턴스 상태이므로 재사용이 불가하나, 표현식 엔진이 hot path(모든 노드 config 필드마다 호출)인 점을 고려하면 GC pressure가 축적된다.
  - 제안: 상태를 함수 매개변수로 넘기는 방식(클로저 또는 파라미터)으로 전환하면 클래스 인스턴스 heap 할당을 제거할 수 있다. 또는 오브젝트 풀링 패턴을 적용한다.

- **[INFO]** `sortByStartedAt` 가 매 WS 이벤트마다 `nodeResults` 전체를 정렬
  - 위치: `frontend/src/lib/stores/execution-store.ts:208-215`
  - 상세: `addNodeResult` 가 호출될 때마다(NODE_STARTED, NODE_COMPLETED, …) 전체 `nodeResults` 배열을 `sort` 한다. 100개 노드, 각 3회 이벤트면 300회 정렬(평균 O(n log n))이 발생한다. 대형 실행에서 UI 응답성에 영향을 줄 수 있다.
  - 제안: `addNodeResult` 시 이진 탐색(bisect) 을 사용한 삽입 정렬로 전환하여 O(log n) 삽입을 보장한다. 또는 정렬을 렌더 직전의 selector 에서만 수행한다(Zustand selector memoization 활용).

- **[INFO]** `deriveContainerAssignments` 의 fixed-point 루프 상한이 16으로 고정
  - 위치: `frontend/src/lib/stores/editor-store.ts:287`
  - 상세: 실제 컨테이너 체인 깊이가 2-3인 워크플로에서도 최대 16패스를 허용한다. 변경 없는 패스에서도 모든 엣지를 순회하는 비용이 발생한다(다행히 `changed=false` 시 break가 존재함). 수렴 조건이 있으므로 실제로는 대부분 2-3 패스에서 종료될 가능성이 높지만, 최악의 경우 보장이 없다.
  - 제안: 상한을 `Math.min(16, edges.length)` 로 두거나, 실제 컨테이너 계층 깊이 제한(spec에서 지정)을 기반으로 설정한다.

- **[INFO]** Cafe24 rate-limit 재시도 시 `sleepImpl` 이 Node.js 이벤트 루프를 블로킹
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1016-1019`
  - 상세: `await this.sleepImpl(sleepMs)` 는 `setTimeout` Promise 래퍼이므로 이벤트 루프를 블로킹하지 않는다(비동기 sleep이 맞다). 다만 동일 Integration 의 요청이 `withIntegrationLock` 으로 직렬화되므로 429 발생 시 최대 2×(rate-limit 초)만큼 해당 Integration 의 모든 요청이 대기한다. 다중 요청이 동시에 같은 Integration 을 사용하면 큐가 길어진다.
  - 제안: 주요 설계 결정이므로 spec에 명시된 per-pod 직렬화 정책이 맞다면 현재 동작은 의도된 것이다. 단, 타임아웃 상한(429 + MAX_RETRIES × 최대 재시도 대기)을 문서화하고 모니터링 알림을 추가할 것을 권고한다.

---

## 요약

코드베이스 전반적으로 성능에 관한 의식은 높다 — `llmDefaultConfigCache` 싱글 플라이트, `ContainerBodyPlan.nodeMap` 캐시, `EXPRESSION_PATTERN` 모듈 상수, `retryWithBackoff`, 배치 임베딩 INSERT, `REPEATABLE READ` 스냅샷, `MAX_SANITIZE_DEPTH` 가드 등 다수의 최적화가 이미 적용되어 있다. 그러나 가장 심각한 두 가지 이슈가 남아있다: (1) 모든 WS emit 경로에서 재귀 페이로드 순회 `sanitizePayloadForWs` 가 대형 LLM 응답이나 대규모 ForEach 실행 시 CPU 병목이 될 수 있고, (2) `deriveContainerAssignments` 가 프론트엔드 에디터에서 엣지 변경마다 동기 fixed-point 순회를 반복해 대형 워크플로 편집 시 UI 렉을 유발할 수 있다. Statistics 서비스의 이중 쿼리 패턴과 `appendExecutionPath` 의 per-node INSERT 도 운영 부하 증가 시 가시화될 가능성이 높다. 패키지 번들 크기나 ReDoS 위험은 각각 `MAX_REGEX_LENGTH` 가드와 transform/filter handler 의 캐싱으로 이미 방어되어 있다.

## 위험도

HIGH
