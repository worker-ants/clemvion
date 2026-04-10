### 발견사항

---

**[WARNING] unreachable 노드에 대한 실행 이력 및 WebSocket 이벤트 완전 누락**
- 위치: `execution-engine.service.ts` — `runExecution` 및 `executeInline`의 `reachable` 체크 블록
- 상세: 구 `portRoutingSkipped` 방식에서는 건너뛴 노드에 대해 `NodeExecutionStatus.SKIPPED` DB 레코드 생성과 `NODE_SKIPPED` WebSocket 이벤트 발행이 보장되었습니다. 새 방식에서는 `pointer++`만 수행하여 완전히 무시합니다. 동일 파일 내 `node.isDisabled` 처리와도 일관성이 없습니다 — disabled 노드는 SKIPPED 레코드와 이벤트를 생성하는 반면 unreachable 노드는 아무것도 생성하지 않습니다. 이 행동 변화가 의도된 스펙 변경인지 부수 효과인지 코드 어디에도 명시되어 있지 않습니다.
- 제안: disabled 노드와 동일하게 unreachable 노드에도 `createNodeExecution(..., SKIPPED)` 및 `emitNodeEvent(..., NODE_SKIPPED)` 호출을 추가하거나, 의도적 생략이라면 스펙 문서에 "포트 라우팅으로 비활성화된 노드는 실행 이력에 기록하지 않는다"는 명시 필요

---

**[WARNING] fan-in 노드의 reachability 요구사항 미정의 및 미검증**
- 위치: `execution-engine.service.spec.ts` — `Reachability-based execution` describe 블록
- 상세: `port1 → X, port2 → X` 구조에서 router가 port1을 선택하면 X는 reachable해야 합니다. 현재 `propagateReachability`는 edge 단위로 `reachable.add(edge.targetNodeId)`를 호출하므로 구현상 올바르게 동작할 가능성이 높으나, 이 핵심 케이스에 대한 테스트가 없어 요구사항이 검증되지 않았습니다. 포트 라우팅의 핵심 요구사항인 "비활성 브랜치 격리"에 바로 인접한 케이스입니다.
- 제안: `port1 → X, port2 → X` 구조에서 선택된 포트의 경우 X가 실행됨을, 미선택 포트만 있는 경우 X가 실행되지 않음을 검증하는 테스트 추가

---

**[WARNING] 병렬 브랜치 테스트에서 Q 노드 입력 데이터 미검증**
- 위치: `execution-engine.service.spec.ts:294` — `should isolate parallel branches through port routing`
- 상세: 테스트가 `branchHandler.execute`가 2회 호출됨(P, Q)을 확인하고 P의 입력(`calls[0][0]`)을 검증하지만, Q가 P의 출력을 올바르게 수신했는지는 검증하지 않습니다. Q가 실행되었다는 사실만 확인하고 데이터 전달 정확성은 누락되어 있습니다. 포트 라우팅 이후 데이터 흐름의 정확성을 보장하는 것이 요구사항의 핵심입니다.
- 제안: `expect(calls[1][0]).toEqual(expect.objectContaining({ done: true, input: { branch: 2 } }))` 추가

---

**[WARNING] executeInline 경로의 reachability 독립 검증 없음**
- 위치: `execution-engine.service.ts` — `executeInline` 메서드 (reachability 초기화 및 루프 로직)
- 상세: 새로운 reachability 테스트 3개는 모두 `service.execute()` → `runExecution` 경로를 검증합니다. `executeInline`은 서브워크플로우 실행에 사용되며 동일한 reachability 로직이 복사되어 있으나, 이 경로의 포트 라우팅 격리 동작은 전혀 검증되지 않습니다. 두 경로의 로직이 독립적으로 복사되어 있으므로 한쪽의 버그가 다른 쪽에 반영되지 않을 수 있습니다.
- 제안: 서브워크플로우(WorkflowHandler)를 통한 인라인 실행에서도 포트 라우팅 격리가 동작함을 검증하는 통합 테스트 추가

---

**[INFO] trigger 노드의 `_selectedPort` 누출 위험 미검증**
- 위치: `execution-engine.service.ts` — `runExecution`의 trigger 노드 처리 경로
- 상세: `executeInline`은 trigger 노드(`manual_trigger`)를 특별 분기하여 `propagateReachability`를 명시적으로 호출합니다. `runExecution`은 trigger 노드도 `executeNode`를 통해 실행한 후 `propagateReachability`를 호출합니다. 만약 `ManualTriggerHandler.execute()`가 `_selectedPort`를 포함한 출력을 반환할 경우 `isPortFiltered`가 예기치 않게 동작할 수 있습니다. `ManualTriggerHandler`의 반환값이 `_selectedPort`를 절대 포함하지 않는다는 보장이 테스트나 코드 어디에도 명시되어 있지 않습니다.
- 제안: `ManualTriggerHandler.execute()`의 반환값에 `_selectedPort`가 없음을 검증하는 테스트 추가, 또는 코드 주석으로 보장 명시

---

**[INFO] `memory/execution-engine-analysis.md` 구현과 불일치**
- 위치: `memory/execution-engine-analysis.md` 전체
- 상세: 파일이 `portRoutingSkipped` 방식을 "현재 방식"으로, 해당 방식의 문제점을 "현재 문제"로 기술하고 있으나 이번 변경으로 완전히 교체되었습니다. `핵심 파일/라인` 섹션의 라인 번호들도 삭제된 코드를 가리킵니다.
- 제안: `reachable` 기반 아키텍처와 새 핵심 파일/라인 번호로 전면 갱신

---

**[INFO] unreachable 노드에 대한 NodeExecution 레코드 미생성을 테스트가 명시적으로 검증하지 않음**
- 위치: `execution-engine.service.spec.ts` — `Reachability-based execution` describe 블록
- 상세: 구 방식에서 SKIPPED 레코드를 생성하던 동작이 사라졌음에도, 새 테스트들은 `mockNodeExecutionRepo.create`가 unreachable 노드 ID(예: 'node-c', 'x', 'y')로 호출되지 않았다는 사실을 검증하지 않습니다. 행동 변화가 의도적인지 확인할 수단이 없습니다.
- 제안: `expect(mockNodeExecutionRepo.create).not.toHaveBeenCalledWith(expect.objectContaining({ nodeId: 'node-c' }))` 등의 검증 추가 또는 SKIPPED 레코드를 복원하여 기존 계약 유지

---

### 요약

이번 변경의 핵심 로직(`portRoutingSkipped` → `reachable` 기반 전파)은 비결정성 문제를 올바르게 해결하는 방향입니다. 그러나 요구사항 관점의 가장 중요한 공백은 **포트 라우팅으로 비활성화된 노드의 실행 이력 가시성 제거**입니다 — 기존 스펙(disabled 노드와의 일관성, 프론트엔드 UI 상태 표시)과 충돌하며 어떤 스펙 문서에도 이 행동 변화가 정의되어 있지 않습니다. 추가로 fan-in 케이스, `executeInline` 경로, Q 노드 입력 검증 등 핵심 요구사항에 해당하는 테스트 공백이 다수 존재하며, `memory/execution-engine-analysis.md`가 구현과 완전히 불일치한 상태입니다.

### 위험도
**MEDIUM**