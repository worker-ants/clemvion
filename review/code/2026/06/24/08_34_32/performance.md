# 성능(Performance) 코드 리뷰

**리뷰 대상**: M-3 2단계 — finish/review 가드를 AssistantFinishGuard 로 분리 (commit 1c17795c)
**리뷰 일시**: 2026-06-24

---

## 발견사항

### **[INFO]** `collectPendingUserConfig` 내부에서 매 호출마다 `shadow.snapshot()` 재호출
- **위치**: `codebase/backend/src/modules/workflow-assistant/tools/collect-pending-user-config.ts` L7 (`shadow.snapshot().nodes.find(...)`)
- **상세**: `collectPendingUserConfig` 는 `evaluateReviewGuard` 내 `snapshot.nodes.map(...)` 루프에서 각 노드마다 호출된다(L623-626). 그런데 함수 내부에서 `shadow.snapshot()` 을 다시 호출한다. `shadow.snapshot()` 이 shallow clone 을 수행한다는 주석을 고려하면 N 개 노드에 대해 snapshot 이 N+1 회 생성된다. `evaluateReviewGuard` 진입부(L599)에서 이미 찍어 둔 `snapshot` 을 `collectPendingUserConfig` 에 전달하지 않고 내부에서 재호출하는 구조다.
- **제안**: `collectPendingUserConfig` 시그니처를 `(nodes: ShadowNode[], nodeId: string, nodeRegistry: NodeComponentRegistry)` 또는 `(snapshot: ShadowSnapshot, nodeId: string, nodeRegistry: NodeComponentRegistry)` 로 변경해 호출부에서 이미 찍은 `snapshot` 을 재사용하도록 한다. 이 경우 `evaluateReviewGuard` 의 detectOnly 루프에서 `shadow` 대신 `snapshot` 을 전달하면 snapshot 생성이 1회로 고정된다.

---

### **[INFO]** `findActivePlanContext` 가 `evaluateReviewGuard` 와 `evaluateFinishGuard` 에서 각각 독립 호출됨 (잠재적 중복 계산)
- **위치**: `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.ts` L597-609 (`evaluateReviewGuard`) 및 L797-802 (`evaluateFinishGuard`)
- **상세**: 현재 코드 흐름상 `evaluateFinishGuard` 가 통과한 이후에만 `evaluateReviewGuard` 가 호출되므로 두 메서드가 같은 턴 내에서 둘 다 `findActivePlanContext` 를 실행하는 경우가 있다. `findActivePlanContext` 가 history 배열을 순회해 메시지를 탐색하는 O(N) 연산이라면, 큰 history 에서 두 번 반복된다. 현재 규모(MAX_HISTORY_TURNS=30)에서는 실측 영향이 미미하나, 호출 구조가 명시적이지 않아 추후 컨텍스트 증가 시 latency 가 누적될 수 있다.
- **제안**: 호출부(`streamMessage`)에서 `findActivePlanContext` 결과를 한 번 계산해 두 가드에 공유 인수로 넘기거나, 가드 내부에서 결과를 반환값 일부로 포함시켜 재사용 여지를 명시하는 것을 고려한다. 단, 현행 MAX_HISTORY_TURNS=30 규모에서는 즉각적 수정 우선순위는 낮다.

---

### **[INFO]** `z.toJSONSchema(component.configSchema)` 를 노드 타입별로 매번 재계산
- **위치**: `codebase/backend/src/modules/workflow-assistant/tools/collect-pending-user-config.ts` L14 (`z.toJSONSchema(component.configSchema)`)
- **상세**: `collectPendingUserConfig` 는 `evaluateReviewGuard` 루프에서 노드 수만큼 호출된다. 동일 `node.type` 의 노드가 여러 개 있을 경우 `z.toJSONSchema` 가 같은 스키마에 대해 반복 실행된다. `z.toJSONSchema` 는 zod AST 를 JSON Schema 객체로 변환하는 비자명 연산이므로, 동일 타입에 대한 결과를 메모이제이션(예: `Map<nodeType, JSONSchema>`)하면 중복 변환을 제거할 수 있다.
- **제안**: `evaluateReviewGuard` 진입부에서 `snapshot.nodes` 의 고유 타입 집합에 대해 JSON Schema 를 선행 계산한 `Map<string, JSONSchema>` 을 만들고, `collectPendingUserConfig` 에 주입하거나 로컬 캐시 Map 을 공유한다. 혹은 `NodeComponentRegistry` 수준에서 JSON Schema 변환 결과를 캐시하는 것도 적절한 위치다.

---

### **[INFO]** `pendingToolCalls.some(...)` 패턴이 `evaluateFinishGuard` 와 `shouldSkipReview` 에서 중복 실행
- **위치**: `assistant-finish-guard.service.ts` L790-794 (`evaluateFinishGuard` 내 `editThisTurn`) 및 L734-738 (`shouldSkipReview` 내 `hadSuccessfulEdit`)
- **상세**: 두 판정 모두 `pendingToolCalls.some(tc => tc.kind === 'edit' && tc.result?.ok === true)` 를 독립적으로 실행한다. 같은 턴의 같은 배열에 대해 동일한 선형 탐색이 두 번 수행된다. 배열 크기가 클 경우(장시간 턴에서 수십 개 tool call 축적) 미미하지만 불필요한 중복이다.
- **제안**: 두 가드가 같은 호출 체인 내에 있으므로, 호출부 또는 공통 진입부에서 `hasSuccessfulEdit` 를 한 번 계산해 두 메서드에 파라미터로 전달하거나, 유틸리티 함수로 추출해 명시적으로 공유한다. 현재 규모에서 우선순위는 낮다.

---

## 요약

이번 변경(M-3 2단계)은 `WorkflowAssistantStreamService` 에 인라인되어 있던 finish/review 가드 로직을 `AssistantFinishGuard` 무상태 collaborator 로 추출하는 리팩터링이다. 알고리즘 복잡도나 N+1 DB 쿼리 같은 구조적 성능 문제는 도입되지 않았다. 단, `collectPendingUserConfig` 가 호출될 때마다 `shadow.snapshot()` 을 내부에서 재호출하는 구조는 N 노드에 대해 snapshot 을 N+1 회 생성하며, `z.toJSONSchema` 도 동일 타입에 대해 반복 수행된다. 두 이슈 모두 현행 워크플로우 규모(수십 노드 이하, MAX_HISTORY_TURNS=30)에서는 실측 영향이 미미하고, `Promise.all` 로 병렬화된 `fillCandidates` 및 review W-2 최적화(pending 없는 노드 fast-path)가 이미 적용되어 있어 실제 DB 쿼리 최소화가 이루어져 있다. 성능 위험도가 높은 신규 도입 패턴은 없으므로 전반적으로 양호한 수준이다.

## 위험도

LOW
