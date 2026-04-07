### 발견사항

---

**[WARNING]** `back-edge`가 없는 노드에서도 `nodeOutputCache` 입력 데이터가 루프 재실행 시 누적될 수 있음
- 위치: `execution-engine.service.ts`, `pointer = activated.targetIndex` 이후 재실행 구간
- 상세: `pointer`를 되감을 때 `executedNodes` Set은 초기화되지 않음. 재실행 구간의 노드들이 `executedNodes`에 이미 포함되어 있어도 `gatherNodeInput`은 캐시에서 이전 출력을 그대로 읽음. `nodeOutputCache`도 초기화되지 않으므로, 루프 재진입 시 노드가 이전 출력값을 입력으로 받는 게 맞는지 스펙에서 명시되지 않음.
- 제안: 재실행 구간(`activated.targetIndex ~ pointer`)의 `nodeOutputCache` 초기화 여부를 스펙에 명시하고, 의도대로라면 해당 범위를 `contextService`에서 클리어하거나 `executedNodes`에서 제거해야 함

---

**[WARNING]** `executedNodes`가 초기화되지 않아 루프 재진입 시 `gatherNodeInput`이 오작동할 수 있음
- 위치: `execution-engine.service.ts:415-440`, `gatherNodeInput` 메서드
- 상세: `gatherNodeInput`은 `executedNodes.has(sourceId)`로 실행 여부를 판단함. 루프 재진입 시 되감기 범위의 노드들이 `executedNodes`에 남아 있으면 첫 실행과 동일하게 이전 캐시 출력을 입력으로 사용. 반면 스타트 노드처럼 `incomingEdges.length === 0`인 경우에는 `workflowInput`을 계속 받음 — 일관성 문제.
- 제안: 루프 되감기 시 `activated.targetIndex ~ pointer` 범위의 nodeId를 `executedNodes`에서 제거해야 함

---

**[WARNING]** `back-edge`가 활성화되는 케이스에서 스타트 노드가 루프 타겟이 될 때 `workflowInput`이 재사용됨
- 위치: `execution-engine.service.ts`, `gatherNodeInput` 메서드 - `incomingEdges.length === 0` 분기
- 상세: back-edge 타겟이 워크플로우의 스타트 노드(incomingEdge 없음)인 경우 매 반복마다 원래 `workflowInput`이 입력으로 사용됨. 실제로는 back-edge를 통해 전달된 데이터를 입력으로 받아야 하는 경우가 있음.
- 제안: back-edge 타겟 노드에 대해 back-edge로부터 입력을 수신하는 로직을 `gatherNodeInput`에 추가하거나, 재실행 시 이전 루프 소스 출력을 입력으로 주입하는 별도 처리가 필요함

---

**[WARNING]** `identifyBackEdges`의 adjacency list에서 노드 집합 외 엣지를 중간에 드랍함
- 위치: `back-edge-identifier.ts:26-30`
- 상세: `sourceNodeId` 또는 `targetNodeId`가 노드 집합에 없는 엣지는 adjacency 구성에서 제외되지만, 최종 분류 시(`forwardEdges`/`backEdges`)에는 포함됨. 따라서 `B->X` 같은 외부 참조 엣지는 항상 `forwardEdges`에 들어감. spec 테스트(`should preserve edges not belonging to the node set`)는 이를 정상 동작으로 정의하고 있으나, 이 동작이 execution에서 의도된 것인지 주석이나 스펙에 명시되어 있지 않음.
- 제안: `back-edge-identifier.ts`에 외부 참조 엣지 처리 의도를 주석으로 명시

---

**[INFO]** `MAX_NODE_ITERATIONS=0`(무제한) 설정 시 무한 루프에 대한 런타임 보호 수단이 없음
- 위치: `execution-engine.service.ts:296-304`
- 상세: 스펙은 `MAX_NODE_ITERATIONS=0`을 "무제한"으로 정의하고 있으며, 테스트도 이를 검증함. 그러나 실제 무한 루프가 발생하면 메모리 소진 또는 실행 타임아웃(스펙 §8: 기본 30분)에 의존해야 함. 실행 타임아웃 강제 종료 로직이 현재 코드에 없으므로, 무제한 설정 시 Worker가 응답 없이 지속될 수 있음.
- 제안: 실행 전체 타임아웃 Guard를 추가하거나, `MAX_NODE_ITERATIONS=0` 사용 시 경고 로그 출력을 권장

---

**[INFO]** `back-edge`가 활성화된 후 `executedNodes`에 남아있는 이유로 port-routing-skip 전파가 누적될 수 있음
- 위치: `execution-engine.service.ts:440` — `portRoutingSkipped` 초기화 범위
- 상세: 루프 되감기 시 `portRoutingSkipped.delete(sortedNodeIds[i])`는 `activated.targetIndex ~ pointer` 범위만 초기화함. 되감기 범위 밖의 이전 실행에서 스킵된 노드가 루프 내 노드에 영향을 주는 케이스는 없지만, `executedNodes`의 잔류 항목과 함께 미묘한 상호작용이 생길 수 있음.
- 제안: 루프 재실행 범위 계산 시 `executedNodes`도 함께 범위 내 노드를 제거하는 것이 명확함

---

**[INFO]** 스펙 §2.1의 back-edge 활성화 조건 중 "소스 노드의 출력에 `_selectedPort`가 없는 경우: 항상 활성화" 동작이 일반 노드(포트 없음)에서도 항상 루프백됨을 의미하므로 DAG 워크플로우에 의도치 않게 적용될 수 있음
- 위치: `execution-engine.service.ts`, `findActivatedBackEdge` 메서드
- 상세: back-edge는 DFS에서 명시적으로 순환을 형성하는 엣지이므로, 사용자가 의도적으로 연결했을 때만 존재함. 그러나 `_selectedPort` 없이 단순 출력을 반환하는 노드가 back-edge 소스라면 무조건 루프백됨 — 이는 의도된 동작이지만, 단순 pass-through 노드가 back-edge 소스가 된 경우 루프를 탈출할 방법이 없음.
- 제안: 스펙에 "back-edge 소스가 port selection 없는 노드인 경우의 탈출 방법"을 명시할 것을 권장

---

### 요약

back-edge 기반 순환 참조 지원 구현은 스펙(`§2.1`)의 핵심 요구사항(DFS 식별, forward-edge DAG 정렬, pointer 되감기, MAX_NODE_ITERATIONS 가드)을 대체로 충족함. `ConfigModule` 추가, `identifyBackEdges` 분리, 테스트 4케이스 추가 모두 스펙과 일치함. 다만 **루프 재진입 시 `executedNodes`와 `nodeOutputCache`가 초기화되지 않아** back-edge 타겟 노드가 이전 출력을 입력으로 받거나 `gatherNodeInput`의 실행 완료 판단이 오염될 수 있는 구조적 문제가 있으며, **back-edge 타겟이 스타트 노드(incoming edge 없음)일 때 루프 데이터 전달이 불가**한 엣지 케이스가 미처리 상태임. 이 두 가지는 순환 워크플로우의 정상 동작을 보장하기 위해 수정이 필요한 WARNING급 이슈임.

### 위험도

**MEDIUM**