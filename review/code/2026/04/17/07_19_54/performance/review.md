## 발견사항

### **[CRITICAL]** `appendExecutionPath` — 노드당 DB Read-Modify-Write + 직렬 체인

- **위치**: `execution-engine.service.ts` — `appendExecutionPath` 메서드
- **상세**: 노드 하나가 완료될 때마다 `findOneBy` → 배열 스프레드 → `save` 를 실행합니다. 병렬 분기에서는 이 작업들이 `executionPathChain`으로 직렬화되므로, 브랜치 2개 × 노드 10개만 되어도 20회 순차 DB 왕복이 발생합니다. 병렬 실행의 처리량 이점이 실행 경로 기록 단계에서 상쇄됩니다.
  ```typescript
  // 현재: 노드 N개 = N번의 findOneBy + N번의 save
  const execution = await this.executionRepository.findOneBy({ id: executionId });
  execution.executionPath = [...execution.executionPath, nodeId]; // 매번 새 배열 생성
  await this.executionRepository.save(execution);
  ```
- **제안**: 실행 중에는 `nodeOutputCache`처럼 메모리에 경로 배열을 누적하고, 실행 완료 시 1회 bulk 업데이트. 또는 PostgreSQL의 `array_append` 쿼리를 사용해 read 없이 append:
  ```sql
  UPDATE execution SET execution_path = array_append(execution_path, $1) WHERE id = $2
  ```

---

### **[WARNING]** BFS에서 `queue.shift()` 사용 — O(N²) 복잡도

- **위치**: `execution-engine.service.ts` — `planParallelBody` 메서드 내 BFS 루프
- **상세**: `Array.shift()`는 O(N) 연산입니다 (남은 원소 전체를 앞으로 이동). 브랜치당 BFS를 수행하므로 총 복잡도는 O(branches × V²). 현재 V < 100 수준의 워크플로우에서는 체감되지 않지만 안티패턴입니다.
  ```typescript
  const queue = [...branchEntries[i]];
  while (queue.length > 0) {
    const nodeId = queue.shift(); // ← O(N) per call
  ```
- **제안**: 인덱스 포인터를 사용하거나 링크드 큐 대신 순방향 순회로 변경:
  ```typescript
  let head = 0;
  while (head < queue.length) {
    const nodeId = queue[head++]; // O(1)
  ```

---

### **[WARNING]** `configService.get` — 노드 루프 내 반복 호출

- **위치**: `execution-engine.service.ts` — 메인 실행 루프 내 병렬 디스패치 분기
- **상세**: `PARALLEL_ENGINE` 설정값이 모든 노드 순회 시마다 조회됩니다. `ConfigService.get`이 단순 맵 조회라도, 실행마다 수십~수백 번 반복됩니다.
  ```typescript
  if (
    node.type === 'parallel' &&
    this.configService.get<string>('PARALLEL_ENGINE', 'off') === 'v1' // ← 매 노드마다 호출
  )
  ```
- **제안**: 실행 시작 시 `OnModuleInit` 또는 `execute()` 진입부에서 한 번 캐시:
  ```typescript
  private parallelEngineVersion: string;
  onModuleInit() {
    this.parallelEngineVersion = this.configService.get('PARALLEL_ENGINE', 'off');
  }
  ```

---

### **[WARNING]** `forwardAdj` 맵 — `planParallelBody` 호출마다 재구성

- **위치**: `execution-engine.service.ts` — `planParallelBody` 메서드 상단
- **상세**: `forwardEdges`에서 인접 리스트를 매번 새로 빌드합니다. 같은 `forwardEdges`를 `runParallel` 호출자도 이미 가지고 있으며, 실행 중에 변하지 않습니다.
  ```typescript
  const forwardAdj = new Map<string, GraphEdge[]>(); // ← 매 호출마다 O(E) 재구성
  for (const edge of forwardEdges) { ... }
  ```
- **제안**: 호출자 (`runParallel`)에서 `forwardAdj`를 미리 구성해 파라미터로 전달하거나, `planParallelBody` 결과를 실행 ID 키로 캐시.

---

### **[WARNING]** `internalEdges` 필터 — 브랜치당 O(E) 반복

- **위치**: `execution-engine.service.ts` — `planParallelBody` 브랜치 루프 내
- **상세**: 각 브랜치마다 전체 `forwardEdges`를 순회해 해당 브랜치의 내부 엣지를 필터링합니다. 브랜치 16개 × 엣지 E개 = O(16E).
  ```typescript
  const internalEdges = forwardEdges.filter(
    (e) => bodyNodeIds.has(e.sourceNodeId) && bodyNodeIds.has(e.targetNodeId),
  );
  ```
- **제안**: `forwardAdj` 순회 시 각 노드의 소속 브랜치를 한 번에 분류해 엣지를 브랜치별로 버킷팅.

---

### **[INFO]** `nodeExecutionRepository.findOne` — 병렬 노드당 추가 DB 쿼리

- **위치**: `execution-engine.service.ts` — `runParallel` 내 `parentNodeExecution` 조회
- **상세**: 병렬 노드 실행 시 타임라인 그룹핑을 위해 `findOne`을 추가 호출합니다. `executeNode`가 이미 NodeExecution을 생성하므로 반환값을 활용할 수 있습니다.
- **제안**: `executeNode`가 생성한 `NodeExecution.id`를 반환하도록 시그니처 변경, 또는 `context`에 최근 `nodeExecutionId`를 저장.

---

### **[INFO]** `parallelBranchPorts` — 렌더 사이클마다 새 배열 생성 (프론트엔드)

- **위치**: `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts`
- **상세**: `branchCount`가 변하지 않아도 호출마다 `Array.from`으로 새 배열을 생성합니다. React 렌더링에서 참조 동일성 비교 실패로 불필요한 리렌더 유발 가능.
- **제안**: 호출자 컴포넌트에서 `useMemo` 적용, 또는 `branchCount`를 키로 하는 모듈 수준 캐시 맵.

---

## 요약

핵심 성능 위험은 `appendExecutionPath`의 **노드당 DB Read-Modify-Write**입니다. 병렬 실행의 목적(동시성)이 이 직렬 체인에 의해 상쇄되며, 브랜치 수 × 노드 수만큼 순차 DB 왕복이 발생합니다. `planParallelBody`의 BFS `shift()` 패턴과 `forwardAdj` 재구성은 현재 규모에서는 큰 문제가 아니지만 확장 시 병목이 됩니다. `configService.get`의 루프 내 반복 호출은 즉시 수정 가능한 낮은 비용의 개선입니다. `ParallelExecutor` 자체의 설계(`p-limit` + `Promise.allSettled`)는 적절합니다.

## 위험도

**HIGH** — `appendExecutionPath` DB 병목이 고분기 워크플로우에서 실행 시간을 선형적으로 증가시킵니다.