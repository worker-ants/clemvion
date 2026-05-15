이제 충분한 정보를 수집했습니다. 성능 리뷰를 작성합니다.

---

## 성능 코드 리뷰 — execution-engine

---

### 발견사항

---

#### `execution-engine.service.ts`

- **[CRITICAL]** `gatherNodeInput`의 O(N×M) 엣지 스캔
  - 위치: `service.ts:2645` — `edges.filter((e) => e.targetNodeId === nodeId)`
  - 상세: 메인 실행 루프에서 노드마다 `gatherNodeInput`을 호출하며, 내부에서 전체 `edges` 배열을 선형 탐색한다. 노드 N개, 엣지 M개일 때 전체 복잡도는 O(N×M). `outgoingEdgeMap`은 이미 사전에 구축해 두었으나 **incomingEdgeMap**은 없다. `executeContainerBody`·`executeInline` 모두 동일 패턴이므로 컨테이너 내 반복 실행 시 누적 비용이 배가된다.
  - 제안: `runExecution`, `executeInline`, `executeContainerBody` 시작 시점에 `Map<string, GraphEdge[]>` 형태의 `incomingEdgeMap`을 한 번만 구축하고 `gatherNodeInput`에 주입한다. 이미 `outgoingEdgeMap`을 동일 방식으로 구축하고 있으므로 패턴을 그대로 적용하면 된다.

- **[WARNING]** `appendExecutionPath`의 노드당 2회 DB 왕복
  - 위치: `service.ts:1317-1339`
  - 상세: 노드 실행 완료마다 `findOneBy(executionId)` + `save(execution)` 두 번의 DB I/O가 발생한다. 10노드 워크플로에서 20회, ParallelExecutor 사용 시 동시 발화로 직렬화 체인(`executionPathChain`)이 길어질수록 tail latency가 증가한다. 현재 구조는 executionPath가 텍스트/JSON 컬럼이라 매번 전체 경로를 읽고 덮어쓴다.
  - 제안: TypeORM의 `query()` 또는 PostgreSQL `array_append` Native 쿼리로 단일 `UPDATE ... SET execution_path = array_append(execution_path, $1)` 로 교체해 N+1 패턴을 제거한다. 불가능하다면 메모리에서 배열을 누적하다가 실행 종료 시 1회만 flush하는 방식도 유효하다(단, 크래시 시 경로 유실 허용 필요).

- **[WARNING]** `recoverStuckExecutions`의 순차적 DB 저장
  - 위치: `service.ts:347-358`
  - 상세: 서버 재시작 시 `WAITING_FOR_INPUT` 상태 실행 건을 `for...of` 루프에서 하나씩 `save()`하므로 N건이면 N번의 DB 왕복이 발생한다. 애플리케이션 시작 시간을 늘리는 요인이다.
  - 제안: `executionRepository.save(stuck)` 처럼 엔티티 배열을 직접 전달하거나 `createQueryBuilder().update().set(...).whereInIds(ids).execute()` 로 단일 UPDATE 쿼리로 일괄 처리한다.

- **[WARNING]** `planContainerBody` 내 다중 선형 엣지 스캔
  - 위치: `service.ts:2974-3083`
  - 상세: `allEdges.filter(...)` 호출이 최소 3회(`bodyEntryNodeIds`, `emitEdges`, `orphanEmitEdges`, `internalEdges`) 있으며, 각각 O(M). 이 함수는 ForEach/Loop/Map 노드 실행마다(`runContainer` → `planContainerBody`) 호출되고, 내부에서 `assertNoContainerCycle`도 `allNodes` 전체를 재순회한다. 10,000 아이템 ForEach라면 planContainerBody는 1회지만 `executeContainerBody`가 매 반복 `nodeMap`을 재생성한다(아래 INFO 참조).
  - 제안: `planContainerBody` 결과를 `runContainer` 시작에서 한 번 계산하고 모든 반복에 재사용한다. `allEdges` 스캔을 단일 패스로 합산(sourceNodeId, targetNodeId 기준 분류 map)하고, `assertNoContainerCycle`은 별도로 1회 호출한다.

- **[WARNING]** `executeNode`의 연속 3회 context 객체 스프레드
  - 위치: `service.ts:2315`, `2325`, `2334`
  - 상세: 단일 노드 실행당 `{ ...context }` 스프레드가 3회 발생하며, 각각 새 객체를 힙에 할당한다. `expressionContext`, `rawConfig`, `nodeId/nodeExecutionId` 세 필드를 세 번에 나눠 스프레드한다.
  - 제안: 세 스프레드를 단일 스프레드로 병합한다.
  ```ts
  nodeContext = {
    ...context,
    expressionContext: exprContext,
    rawConfig: Object.freeze({ ...(node.config ?? {}) }),
    nodeId: node.id,
    nodeExecutionId: nodeExecution.id,
  };
  ```

- **[INFO]** `executeContainerBody` 매 호출마다 `nodeMap` 재생성
  - 위치: `service.ts:2856`
  - 상세: `new Map(allNodes.map((n) => [n.id, n]))` 이 컨테이너 바디 반복마다 재실행된다. ForEach 1,000 아이템이면 같은 노드 배열로 1,000회 Map을 생성한다.
  - 제안: `planContainerBody`의 반환값에 `nodeMap`을 포함시키거나 `executeContainerBody` 호출부에서 한 번 생성해 전달한다.

- **[INFO]** `executeInline` 내 디버그 로그의 O(N) 레이블 계산
  - 위치: `service.ts:687-692`
  - 상세: 노드 실행마다 `[...subNodeMap.entries()].filter(...).map(...)` 으로 실행된 노드 레이블 전체를 문자열로 조합한다. 노드 수가 많을수록 낭비이며, 프로덕션에서도 실행된다.
  - 제안: `this.logger.debug(...)` 레벨로 낮추거나 `NODE_ENV !== 'production'` 가드를 추가한다. Logger의 현재 로그 레벨이 DEBUG 이상일 때만 계산되도록 지연 평가 패턴(`() => ...`)을 활용한다.

- **[INFO]** `scheduleBackgroundBody`의 추가 DB 조회
  - 위치: `service.ts:3112-3115`
  - 상세: Background 노드 처리 시 `nodeExecutionRepository.findOne`을 추가로 호출해 `parentNodeExecutionId`를 조회한다. `executeNode`에서 이미 생성된 `nodeExecution.id`를 반환값으로 활용하면 이 조회를 피할 수 있다.
  - 제안: `executeNode`가 생성한 `nodeExecution`을 반환하거나, `nodeExecution.id`를 context에 이미 스탬프하므로(`nodeContext.nodeExecutionId`) 해당 값을 그대로 읽는다.

- **[INFO]** AI 컨버세이션 루프에서 반복되는 `buildConversationMetaFromResumeState` / `buildConversationConfigFromOutput` 호출
  - 위치: `service.ts:1794`, `1745`
  - 상세: 매 turn마다 두 헬퍼 함수를 호출하며, 각각 메시지 배열 전체를 순회(`filter`)한다. 대화가 길어질수록(수십 turn) 비용이 증가한다. 현재 규모에서는 허용 수준이지만, 대화 이력이 수백 메시지에 달하면 주목할 부분이다.
  - 제안: 즉각 수정 불필요. turn 수 증가에 따른 프로파일링 시 최우선 확인 대상으로 인식한다.

---

#### `execution-engine.service.spec.ts`

- **[INFO]** `beforeEach`마다 전체 NestJS DI 모듈 컴파일
  - 위치: `spec.ts:195` — `Test.createTestingModule(...).compile()`
  - 상세: 각 `it`마다 전체 모듈을 컴파일하므로 테스트 스위트 크기가 커질수록 총 실행 시간이 선형 증가한다. 현재 파일 규모에서는 허용 수준.
  - 제안: 독립성이 충분히 보장되는 테스트 그룹은 `beforeAll`로 모듈을 한 번만 컴파일하고, mock 상태만 `beforeEach`에서 초기화한다.

---

#### `node-handler.interface.ts`

성능 관련 이슈 없음. 순수 타입 정의 파일이며 런타임 비용 없음.

---

### 요약

실행 엔진에서 가장 긴급한 성능 문제는 **`gatherNodeInput`의 O(N×M) 선형 엣지 스캔**이다. `outgoingEdgeMap`과 동일한 방식의 `incomingEdgeMap`을 사전 구축하면 핵심 실행 루프 복잡도가 O(M)으로 줄어든다. 두 번째로 중요한 문제는 **노드당 2회 DB 왕복으로 `executionPath`를 기록하는 `appendExecutionPath` 패턴**으로, 일괄 업데이트 또는 종료 시 단일 flush로 전환해야 한다. `executeNode`의 3중 context 스프레드와 `executeContainerBody`의 반복 `nodeMap` 생성은 비교적 낮은 비용이나 쉽게 제거 가능하다. 전반적으로 단일 노드 실행에 필요한 DB I/O 횟수가 과도하며(생성 1회 + 완료 저장 1회 + 경로 append 2회 = 노드당 최소 4회 DB 왕복), 이를 줄이는 것이 처리량 개선의 핵심이다.

### 위험도

**HIGH**