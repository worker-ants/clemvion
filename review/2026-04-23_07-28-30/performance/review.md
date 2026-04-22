### 발견사항

---

**[INFO] `outgoingPortsByNode` 구성 시 중복 `Map.set()` 호출**
- 위치: `review-workflow.ts` — `collectDanglingOutputPorts` 내 edge 인덱싱 루프
- 상세: `?? new Set<string>()` 패턴은 키가 이미 존재할 때 기존 Set을 반환하고 `set.add()`로 뮤테이션하지만, 이후 `.set(edge.sourceNodeId, set)`이 동일한 참조를 Map에 다시 쓰는 무의미한 쓰기를 수행한다. `byNode` 그룹핑 블록도 동일한 패턴.
  ```ts
  // 현재 — 키 존재 시 redundant write
  const set = outgoingPortsByNode.get(edge.sourceNodeId) ?? new Set<string>();
  set.add(edge.sourcePort);
  outgoingPortsByNode.set(edge.sourceNodeId, set); // 키 있으면 no-op write

  // 개선
  let set = outgoingPortsByNode.get(edge.sourceNodeId);
  if (!set) { set = new Set<string>(); outgoingPortsByNode.set(edge.sourceNodeId, set); }
  set.add(edge.sourcePort);
  ```
  edge·node 수가 수십 개 수준이라 실측 영향은 무시 가능. 코드 의도 명확성 개선 효과.

---

**[INFO] `new Map(nodeDefs.map(...))` 중간 배열 생성**
- 위치: `review-workflow.ts` — `collectDanglingOutputPorts` 첫 줄
- 상세: `nodeDefs.map((d) => [d.metadata.type, d])` 가 `Map` 생성 직전에 소비되고 버려지는 중간 배열을 할당한다. 등록된 노드 타입이 수십~수백 개 수준이므로 실측 영향은 미미하지만 `new Map<K,V>(); for (const d of nodeDefs) map.set(d.metadata.type, d)` 로 할당을 줄일 수 있다.

---

**[INFO] `hadSuccessfulEditThisRound`의 O(n×m) 탐색 — 부분 개선됨**
- 위치: `workflow-assistant-stream.service.ts` — `shouldContinueLoop` 직전 블록
- 상세: `!planPending && pendingResultsForLlm.some(r => pendingToolCalls.find(p => p.id === r.id))` 패턴에서 plan-only 경로(`planPending=true`)는 이번 diff가 `!planPending &&` 단락을 추가해 배열 탐색 자체를 건너뛰도록 개선했다. 그러나 일반 실행 턴에서는 여전히 O(n×m) 이중 탐색이 발생한다. `pendingToolCalls`를 `Map<id, record>` 로 보조 인덱싱하면 O(n) 으로 개선 가능.
  ```ts
  // while 루프 상단에서 한 번
  const pendingById = new Map(pendingToolCalls.map(c => [c.id, c]));
  // 이후 .find() 대신 .get()
  pendingResultsForLlm.some(r => {
    const found = pendingById.get(r.id);
    return found?.kind === 'edit' && (found.result as { ok?: boolean })?.ok === true;
  });
  ```
  tool-call budget 상한이 200이므로 현재 최악도 O(200×200)=40,000 연산 — 성능 병목이 아니나, Map 인덱싱은 코드 명확성도 개선한다.

---

**[INFO] `this.nodeRegistry.listDefinitions()` 매 review 호출마다 실행**
- 위치: `workflow-assistant-stream.service.ts` — `evaluateReviewGuard` 내 `nodeDefs` 주입
- 상세: `listDefinitions()` 가 내부적으로 레지스트리 전체를 순회하거나 배열을 새로 생성한다면, finish마다 호출된다. 레지스트리는 서비스 생명주기 내 정적이므로(새 노드 타입이 런타임에 추가되지 않음) `streamMessage` 스코프 바깥 클래스 멤버로 캐싱하거나 `@Memoize` 처리하면 불필요한 반복 계산을 없앨 수 있다.
  ```ts
  private readonly cachedNodeDefs = this.nodeRegistry.listDefinitions();
  // evaluateReviewGuard 호출 시
  nodeDefs: this.cachedNodeDefs,
  ```
  레지스트리 구현이 이미 배열을 캐싱한다면 무관.

---

**[GOOD] `planPending` 단락으로 plan-only 경로 배열 탐색 제거**
- 위치: `workflow-assistant-stream.service.ts` — `hadSuccessfulEditThisRound` 선언
- 상세: `!planPending && pendingResultsForLlm.some(...)` 패턴이 gemini-3-flash 패턴(plan-only 턴)에서 O(n×m) 탐색을 완전히 건너뜀. 올바른 lazy evaluation 적용.

---

**[GOOD] `collectDanglingOutputPorts`의 자료구조 선택**
- 위치: `review-workflow.ts` — `collectDanglingOutputPorts`
- 상세: 노드별 outgoing port를 `Map<nodeId, Set<portId>>` 로 O(E) 전처리 후 O(1) 조회하는 구조가 올바르다. 코멘트에도 "O(E) 조회를 O(1) 로" 명시. 포트 수 × 노드 수 전체 검사가 O(N×P) (N=노드 수, P=평균 포트 수)로 효율적.

---

### 요약

이번 변경의 성능 핵심은 **LLM API round-trip 50회→1회 차단**이다. 이것만으로도 실제 비용·레이턴시 관점의 성능 개선 효과는 압도적이다. 코드 레벨에서는 `hadSuccessfulEditThisRound`의 `!planPending` 단락 추가가 plan-only 경로에서 O(n×m) 탐색을 올바르게 제거했고, `outgoingPortsByNode` Map 인덱싱으로 포트 연결 검사가 O(1)이다. 개선 여지는 ① 일반 실행 턴의 O(n×m) `pendingToolCalls.find()` → Map 전처리, ② `listDefinitions()` 결과 캐싱, ③ Map 삽입 시 중복 `.set()` 제거로 모두 마이크로 최적화 수준이며 현재 데이터 규모(tool-budget ≤200, 노드 ≤50)에서 실측 병목이 될 가능성은 없다.

### 위험도
**LOW**