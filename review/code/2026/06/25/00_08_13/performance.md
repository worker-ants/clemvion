# 성능(Performance) 리뷰 결과

## 발견사항

### **[INFO]** `getStatus` — Execution 전체 컬럼 로드 (불필요한 컬럼 SELECT)
- 위치: `interaction.service.ts` L214 — `this.executionRepository.findOne({ where: { id: ctx.executionId } })`
- 상세: `select` 절 없이 Execution 전체 컬럼을 로드한다. `outputData` 가 대용량 JSON 일 경우, 이후 `status !== WAITING_FOR_INPUT` 인 경우(completed/failed/running)에도 항상 전체를 DB에서 가져온다. `loadAndAssertAlive`(select: ['id', 'status']) 와 대조적으로 일관성이 없다.
- 제안: `select: ['id', 'workflowId', 'status', 'outputData', 'startedAt', 'finishedAt']` 명시적으로 제한. `outputData` 는 COMPLETED/FAILED 일 때만 필요하므로, 상태 선조회 후 조건부 재조회로 분리하거나 최소한 필요한 컬럼을 명시한다.

### **[INFO]** `getStatus` — 직렬 2회 DB 조회 (순차 awaiting, 병렬화 기회 없음이지만 구조적 이해 필요)
- 위치: `interaction.service.ts` L214, L230
- 상세: `executionRepository.findOne` 후 상태가 `WAITING_FOR_INPUT` 이면 `nodeExecutionRepository.findOne` 을 순차 실행한다. 두 쿼리 간 의존성(전자의 status 결과에 따라 후자 실행 여부 결정)이 있으므로 병렬화는 불가하다. 현재 구조는 정당하다.
- 제안: 해결책 없음. 단, `WAITING_FOR_INPUT` 이 아닌 경우 두 번째 쿼리는 완전히 건너뛰므로 이 경로의 성능에 문제는 없다. 추후 `status` 만 SELECT 후 분기하는 방식으로 리팩터링 시 `outputData` 조회를 lazy 하게 분리할 수 있다(INFO 수준).

### **[INFO]** `getStatus` — `relations: ['node']` JOIN 으로 node 전체 컬럼 로드
- 위치: `interaction.service.ts` L236 — `relations: ['node']`
- 상세: `nodeExec.node.type` 만 필요하지만 `relations: ['node']` 는 Node 엔티티 전체를 JOIN 으로 가져온다. Node 에 대규모 JSON 컬럼(예: definition, config)이 있다면 불필요한 데이터를 네트워크·메모리에 전송한다.
- 제안: TypeORM `loadRelationIds` 대신 `QueryBuilder` 로 `node.type` 만 SELECT 하거나, `select: { node: { type: true } }` 와 `relations: ['node']` 조합을 사용한다. 또는 `nodeId` 기반으로 별도의 경량 쿼리를 사용한다.

### **[INFO]** `seedWaitingFromStatus` — start/restore 경로마다 항상 getStatus HTTP 호출 추가
- 위치: `use-widget.ts` L249, L296 — `await seedWaitingFromStatus(client, session)`
- 상세: 세션 시작·복원 시 무조건 `getStatus` HTTP 호출이 선행된다. execution 이 아직 `running`(waiting 아님)이거나 SSE replay 가 충분한 경우에도 항상 추가 왕복이 발생한다. 특히 복원 경로(`applyConfig`)에서는 이미 실행 중인 세션에 대해서도 매번 수행된다.
- 제안: 이 패턴은 race 조건 해소를 위한 의도적 설계(spec §R6 보강)이며 soft 실패(catch/warn 처리)이므로 기능 정확성에는 문제없다. 다만 대부분의 경우(execution 이 running 이거나 이미 SSE replay 로 충분) getStatus 응답이 `status !== waiting_for_input` 이어서 무의미한 왕복이 된다. 향후 최적화 포인트로 기록: SSE 연결 후 일정 시간(예: 500ms) 내 `waiting_for_input` 이벤트가 없을 때만 getStatus 시드를 호출하는 lazy fallback 구조.

### **[INFO]** `useCallback` dependency array 빈 배열 — `seedWaitingFromStatus` 메모이제이션
- 위치: `use-widget.ts` L207 — `useCallback(async (...) => { ... }, [])`
- 상세: 의존성 배열이 `[]` 이므로 함수는 마운트 시 한 번만 생성된다. `dispatch` 가 React의 `useReducer` dispatch 이므로 안정적(참조 불변)이라 정확하다. 단, 향후 내부에서 외부 state·ref 를 참조하는 코드가 추가되면 stale closure 문제가 생길 수 있다. 현재는 문제없음.
- 제안: 현상 유지. `dispatch`, `parseWaitingForInput`, `threadToMessages` 가 모두 안정적 참조이므로 빈 배열은 정당하다.

## 요약

이번 변경의 성능 영향은 전반적으로 낮다. 핵심 변경인 `getStatus` 의 NodeExecution 조회는 `WAITING_FOR_INPUT` 상태에서만 실행되는 조건부 쿼리로, 대부분의 호출 경로에는 추가 비용이 없다. 주요 개선 기회는 세 가지다: (1) Execution 조회 시 `select` 절 부재로 인한 전체 컬럼 로드, (2) Node 관계 JOIN 시 필요 컬럼(`type`)만 선택하지 않는 점, (3) 세션 시작/복원마다 무조건 실행되는 `getStatus` HTTP 왕복. 이 모두 INFO 수준으로, 기능 정확성·현재 규모에서 실질적 병목을 일으킬 가능성은 낮으나 트래픽이 증가하거나 Node 엔티티가 대형 JSON 컬럼을 포함하는 경우에 대비해 기록한다.

## 위험도

LOW
