### 발견사항

---

- **[WARNING]** `evaluateReviewGuard`에서 finish 호출마다 모든 노드에 대해 병렬 DB 쿼리 실행
  - 위치: `workflow-assistant-stream.service.ts:1301-1312` (`pendingByNode` 사전 조회 블록)
  - 상세: 이제 `finish`마다 스냅샷의 모든 비-트리거 노드에 대해 `collectPendingUserConfigWithCandidates`를 `Promise.all`로 병렬 호출한다. 각 호출은 내부에서 최대 4종의 DB 쿼리를 분기한다. 이 `finish` 경로는 `WORKFLOW_REVIEW_REQUIRED`가 반복 발동되면 한 턴에 여러 번 실행된다. 예를 들어 이메일 노드 3개가 있는 워크플로에서는 같은 `workspaceId`·같은 `serviceType=email` 필터로 Integrations 테이블을 3번 별도 조회한다 — 쿼리 내용이 동일하지만 노드 단위로 쪼개져 있어 배치가 안 된다.
  - 제안: 쿼리 중복 제거. `evaluateReviewGuard` 진입 시 `pending.length > 0`인 노드 목록을 먼저 동기로 수집하고, widget 타입별로 그룹화한 뒤 widget당 1회씩만 `lookup*` 메서드를 호출해 결과를 각 노드에 재분배한다. 현재 구조에서는 `CandidateLookupService`에 `fillCandidatesBatch(workspaceId, wfId, allPendingFields: PendingUserConfigField[])` 형태의 오버로드를 추가해 동일 widget 유형의 중복 쿼리를 흡수하는 것이 최소 침습 방법이다.

---

- **[WARNING]** 동기였던 `evaluateReviewGuard`가 async로 전환되어 매 `finish`에 DB 레이턴시가 추가됨
  - 위치: `workflow-assistant-stream.service.ts:1283`
  - 상세: 기존에는 순수 인메모리 연산이었던 review guard가 이제 DB I/O를 대기한다. LLM 스트리밍 루프 안에서 `await evaluateReviewGuard(...)` 를 호출하므로, 매 `finish` 이벤트 처리 시 DB 왕복 레이턴시가 전체 스트리밍 응답 완결 시간에 포함된다. `WORKFLOW_REVIEW_REQUIRED`로 재시도되는 경우 레이턴시가 누적된다.
  - 제안: `finish` 직전이 아닌 `add_node`/`update_node` tool_result 단계에서 이미 `candidates`가 채워진 pending 목록을 `shadowResult` 와 함께 side-table에 보관해 두고, review guard는 그 캐시를 읽도록 분리한다. 즉, 후보 조회는 노드가 추가/수정될 때 1회만 수행하고 guard에서는 재사용한다.

---

- **[WARNING]** `CandidatePickers` 컴포넌트가 전체 `nodes` 배열을 구독해 불필요한 리렌더 유발
  - 위치: `assistant-message.tsx:238`
  - 상세: `useEditorStore((s) => s.nodes)`는 캔버스의 임의 노드 위치·config 변경(드래그 포함)마다 `CandidatePickers`를 리렌더한다. picker entries는 `toolCalls`가 바뀌지 않으면 고정이나, 노드 배열 전체를 구독하므로 무관한 변경에도 반응한다.
  - 제안: `entries`에서 필요한 `nodeId` 목록을 뽑아 `useEditorStore((s) => entries.map(e => s.nodes.find(n => n.id === e.nodeId)))` 형태로 특정 노드만 선택하거나, Zustand selector로 `Map<id, config>` 형태로 좁힌다. `nodes.find` 자체도 O(N)이 반복되므로 `useMemo`로 `new Map(nodes.map(n => [n.id, n]))` 를 만들어 O(1) 조회로 전환한다.

---

- **[INFO]** `lookup*` 메서드에서 DB `limit` 설정 후 결과에 추가로 `.slice(0, MAX_CANDIDATES)` 이중 적용
  - 위치: `candidate-lookup.service.ts:92, 108, 127, 142`
  - 상세: 모든 `lookup*` 메서드가 쿼리 파라미터에 `limit: MAX_CANDIDATES`를 전달해 DB에서 이미 최대 20건만 반환받는데, 반환 후 `.slice(0, MAX_CANDIDATES)`를 다시 실행한다. 20건 이내 배열에 slice를 추가로 수행하므로 실질적 효과는 없지만 불필요한 배열 할당이 발생한다.
  - 제안: DB 쿼리에 `limit`이 보장된다면 `.slice()` 제거. 확신할 수 없다면 주석으로 의도를 명시하고 `slice`를 하나로 통합.

---

- **[INFO]** `lookupWorkflows`에서 `filter` → `slice` → `map` 세 번의 이터레이션
  - 위치: `candidate-lookup.service.ts:145-157`
  - 상세: `extractWorkflowItems`가 `filter`로 중간 배열을 생성하고, `lookupWorkflows`에서 `slice` 후 `map`을 다시 실행한다. 최대 20개 항목이라 영향은 무시할 수준이나, `listWorkflows`가 이미 `limit`과 `excludeId`를 처리하므로 `items` 자체에 slice 불필요.
  - 제안: `extractWorkflowItems` 결과는 이미 필터됨·DB 상한 적용됨으로 간주해 중간 `slice` 제거.

---

### 요약

가장 중요한 성능 위험은 `evaluateReviewGuard`의 async 전환에서 발생한다. 기존에 동기 인메모리 연산이었던 review guard가 이제 모든 `finish` 이벤트에서 워크플로 내 노드 수에 비례하는 병렬 DB 쿼리를 실행하며, 동일 widget 유형의 중복 쿼리가 dedup 없이 반복된다. `WORKFLOW_REVIEW_REQUIRED`로 여러 라운드가 돌아가는 경우 이 비용이 곱절 증가한다. 프런트엔드에서는 `CandidatePickers`가 전체 `nodes` 배열을 구독하고 내부 `find`가 O(N) 반복하는 구조가 대규모 캔버스에서 불필요한 리렌더를 유발한다. 나머지 이슈들(이중 slice, 3회 이터레이션)은 MAX=20 상한으로 무시할 수준이다.

### 위험도

**MEDIUM**