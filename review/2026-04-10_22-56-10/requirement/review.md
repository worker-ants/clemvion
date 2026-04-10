## 요구사항 리뷰 결과

### 발견사항

---

**[WARNING] 비활성 노드(unreachable)의 실행 이력 및 WebSocket 이벤트 누락**
- 위치: `execution-engine.service.ts` — `runExecution` 및 `executeInline`의 unreachable 처리 블록
- 상세: 구 `portRoutingSkipped` 방식에서는 포트 라우팅으로 skip된 노드에 대해 `NodeExecution` 레코드(SKIPPED 상태)와 `NODE_SKIPPED` WebSocket 이벤트를 명시적으로 생성했습니다. 새 `reachable` 방식에서는 unreachable 노드를 **완전히 무시**(`pointer++`만 수행)합니다. 이로 인해 프론트엔드는 해당 노드가 실행되지 않은 이유를 알 수 없으며, 실행 이력 조회 시 포트 라우팅으로 스킵된 노드가 아예 표시되지 않게 됩니다.
- 제안: disabled 노드 처리와 동일하게 unreachable 노드에도 `NodeExecutionStatus.SKIPPED` 레코드 생성 및 `NODE_SKIPPED` 이벤트 발행 추가, 또는 이 동작 변경이 의도적임을 명시하는 스펙/주석 추가

---

**[WARNING] `propagateReachability`의 trigger 노드 처리 불일치**
- 위치: `execution-engine.service.ts` — `executeInline` vs `runExecution`
- 상세: `executeInline`에서는 `manual_trigger` 타입을 별도로 분기하여 `propagateReachability`를 명시적으로 호출합니다. 반면 `runExecution`에서는 trigger 노드도 일반 `executeNode`를 통해 실행하고 이후 `propagateReachability`를 호출합니다. 만약 `ManualTriggerHandler.execute()`가 내부적으로 `_selectedPort`를 포함한 출력을 반환한다면 의도치 않은 포트 필터링이 발생할 수 있습니다.
- 제안: `ManualTriggerHandler`의 반환값에 `_selectedPort`가 포함되지 않음을 보장하거나, `runExecution`에서도 trigger 노드의 처리를 명시적으로 분리

---

**[WARNING] back-edge 범위 내 다중 경로 노드의 reachability 과도 초기화**
- 위치: `execution-engine.service.ts:843-848` (runExecution), `493-497` (executeInline)
- 상세: back-edge 활성화 시 `activated.targetIndex`부터 `pointer`까지의 모든 노드 reachability를 삭제합니다. 이 범위 내에 루프 외부에서도 도달 가능한 노드(예: 루프 내 노드가 루프 외부 분기에서도 연결된 경우)가 있다면 해당 노드의 reachability가 부당하게 제거됩니다. 루프 재실행으로 복구되지만, 루프 범위 내에 외부에서 도달 가능한 노드가 있는 복잡한 그래프에서 동작이 불확실합니다.
- 제안: 현재 구현의 한계를 주석으로 명시하거나, 범위 내 노드 중 루프 외부 경로로 reachable한 경우를 별도 처리

---

**[INFO] 테스트에서 unreachable 노드의 `NodeExecution` 레코드 미검증**
- 위치: `execution-engine.service.spec.ts` — `Reachability-based execution` describe 블록
- 상세: 새 테스트들은 핸들러 호출 횟수만 검증하고, 실행되지 않은 노드(C, X, Y 등)에 대해 `NodeExecution` 레코드가 생성되지 않는지는 검증하지 않습니다. 구 방식에서는 SKIPPED 레코드가 생성되었으므로, 행동 변화가 의도적인지 테스트로 명확히 해야 합니다.
- 제안: `mockNodeExecutionRepo.create`가 unreachable 노드 ID로 호출되지 않았음을 `expect.not.toHaveBeenCalledWith`로 검증 추가

---

**[INFO] `memory/execution-engine-analysis.md`가 구 방식을 기술**
- 위치: `memory/execution-engine-analysis.md`
- 상세: 파일 내용이 `portRoutingSkipped` 기반의 구 방식과 그 문제점을 설명하고 있으나, 이번 변경으로 해당 문제가 해결된 새 방식(`reachable` 세트)은 기술되지 않았습니다.
- 제안: 새 reachability 기반 방식의 핵심 흐름과 관련 라인 번호로 파일 갱신

---

**[INFO] `text-classifier.handler.ts` 변경은 순수 포맷팅**
- 위치: `text-classifier.handler.ts:78-86`
- 상세: `jsonSchema` 구성 코드의 삼항 연산자 줄바꿈만 변경됨. 동작 변경 없음. `text-classifier.handler.spec.ts`의 `errors!` → `errors` 변경도 `ValidationResult.errors`가 항상 배열임을 고려하면 올바른 수정입니다.

---

### 요약

핵심 변경인 `portRoutingSkipped → reachable` 방식 전환은 비결정적 위상 정렬 순서 의존성을 제거하는 올바른 방향으로, 로직 자체의 정확성은 높습니다. 다만 **실행 이력 가시성** 측면에서 요구사항 공백이 있습니다: 구 방식에서 명시적으로 생성하던 SKIPPED 상태의 `NodeExecution` 레코드와 `NODE_SKIPPED` 이벤트가 사라져 프론트엔드가 "왜 이 노드가 실행되지 않았는가"를 파악할 수 없게 됩니다. 이 행동 변경이 의도된 스펙인지, 아니면 누락인지 명확히 해야 합니다. `text-classifier` 관련 변경은 문제 없습니다.

### 위험도

**MEDIUM**