## 발견사항

### [WARNING] memory/execution-engine-analysis.md 내용이 stale 상태

- **위치**: `memory/execution-engine-analysis.md` 전체
- **상세**: 파일의 "현재 방식" 섹션이 이번 PR에서 제거된 `portRoutingSkipped` 기반 구현을 설명하고 있습니다. 특히 다음 항목들이 삭제된 코드를 가리킵니다:
  - `skip 판단: execution-engine.service.ts:789-831` — 해당 블록 삭제됨
  - `portRoutingSkipped 세트로 수행` — `reachable` Set으로 교체됨
  - "문제점" 섹션이 설명하는 버그 — 이번 변경으로 수정됨
- **제안**: 파일을 새로운 `reachable` 기반 방식으로 갱신하거나, 문제가 해결됨을 명시하고 새 아키텍처를 기술할 것

---

### [INFO] executeInline 메서드 내 오래된 용어 사용

- **위치**: `execution-engine.service.ts` — `executeInline` 메서드의 `_selectedPort` strip 주석
- **상세**: 주석이 `"it would cause all downstream nodes to be port-routing-skipped"` 라고 표현하는데, 이는 제거된 `portRoutingSkipped` 메커니즘의 용어입니다. 기능적 의미는 동일하지만 코드베이스와 용어가 불일치합니다.
- **제안**:
  ```typescript
  // Strip _selectedPort from input — this is parent execution metadata
  // that must not leak into the sub-workflow (it would incorrectly block
  // downstream nodes from being marked reachable).
  ```

---

### [INFO] propagateReachability JSDoc에 disabled 노드 동작 누락

- **위치**: `execution-engine.service.ts:2083-2110` — `propagateReachability` 메서드
- **상세**: JSDoc에 "If the node has no _selectedPort, all outgoing edges are activated"라고 명시되어 있으나, disabled 노드는 이 메서드를 호출하지 않는다는 사실(caller의 책임)이 문서화되어 있지 않습니다. `propagateReachability`를 단독으로 읽는 독자는 disabled 노드의 하위 노드가 어떻게 처리되는지 파악하기 어렵습니다.
- **제안**: JSDoc에 다음을 추가:
  ```typescript
  * Note: disabled nodes must NOT call this method — their downstream nodes
  * should remain unreachable (caller responsibility).
  ```

---

### [INFO] reachable 초기화 로직 중복 — 주석 없음

- **위치**: `runExecution`, `executeInline` 두 곳에 동일한 초기화 패턴 반복
- **상세**: `reachable` Set 초기화 코드(루트 노드 추가 로직)가 두 메서드에 동일하게 복사되어 있습니다. 두 곳 모두 주석이 있어 이해를 돕지만, 왜 "incoming edge가 없는 노드"를 초기 reachable로 설정하는지(= 루트 노드 = 시작 노드)에 대한 설명이 없습니다.
- **제안**: 주석에 의도 추가:
  ```typescript
  // Seed reachability with root nodes (nodes with no incoming forward-edges).
  // These are the workflow entry points; all other nodes must be activated
  // transitively via propagateReachability after each node executes.
  ```

---

## 요약

이번 변경의 핵심인 `portRoutingSkipped → reachable` 리팩터링은 `propagateReachability` 메서드에 적절한 JSDoc과 인라인 주석이 동반되어 있어 코드 자체의 문서화 수준은 양호합니다. 다만 `memory/execution-engine-analysis.md`가 삭제된 구현을 "현재 방식"으로 설명하는 상태로 방치되어 있어, 향후 컨텍스트 로딩 시 혼란을 야기할 수 있습니다. `executeInline` 내 `port-routing-skipped` 용어 잔존과 `propagateReachability` JSDoc의 caller 책임 미명시는 경미한 수준입니다. 테스트 파일의 시나리오 주석(ASCII 다이어그램)은 충분히 명확합니다.

## 위험도

**LOW**