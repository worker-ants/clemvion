### 발견사항

---

**[WARNING] `memory/execution-engine-analysis.md` — 전체 내용이 삭제된 구현을 "현재 방식"으로 기술**
- 위치: `memory/execution-engine-analysis.md` 전체
- 상세: 파일의 `### 핵심 흐름` 섹션이 `portRoutingSkipped` 세트 기반 방식을 현재 아키텍처로 설명하고 있으며, `### 문제점` 섹션이 기술하는 버그는 이번 변경으로 해결되었음. `### 핵심 파일/라인` 섹션의 모든 라인 번호(`789-831`, `2049-2064` 등)가 이번 diff에서 삭제된 코드를 가리킴. 이 파일은 향후 컨텍스트 로딩 시 이미 해결된 문제를 현재 문제로 오인하게 만드는 혼란을 유발함.
- 제안: 파일을 새로운 `reachable` 기반 아키텍처로 전면 갱신. 기존 문제점 섹션은 "해결됨"으로 표시하고, 새 핵심 흐름(루트 노드 시딩 → 실행 후 `propagateReachability` 전파 → unreachable 노드 silent skip)과 현행 라인 번호를 기재할 것.

---

**[WARNING] `executeInline` 내 오래된 용어 잔존**
- 위치: `execution-engine.service.ts` — `executeInline`의 `_selectedPort` strip 관련 주석
- 상세: 주석에 `"it would cause all downstream nodes to be port-routing-skipped"`라는 표현이 남아 있음. `portRoutingSkipped` 메커니즘은 이번 변경으로 완전히 제거되었으므로 주석이 현재 구현과 용어 불일치. 코드를 처음 읽는 개발자가 삭제된 메커니즘을 찾으려 할 수 있음.
- 제안:
  ```typescript
  // Strip _selectedPort from input — this is parent execution metadata
  // that must not leak into the sub-workflow; it would incorrectly prevent
  // downstream nodes from being marked reachable.
  ```

---

**[WARNING] `propagateReachability` JSDoc — disabled 노드 처리 책임 미명시**
- 위치: `execution-engine.service.ts` — `propagateReachability` 메서드 JSDoc
- 상세: 현재 JSDoc은 `_selectedPort` 유무에 따른 엣지 활성화 규칙만 설명함. disabled 노드가 이 메서드를 호출하지 않는다는 사실(호출자 책임)이 문서화되어 있지 않아, 메서드를 단독으로 읽는 개발자는 disabled 노드의 downstream이 어떻게 unreachable 상태를 유지하는지 파악할 수 없음.
- 제안:
  ```typescript
  /**
   * After a node executes, propagate reachability to downstream nodes
   * through edges whose sourcePort matches the node's _selectedPort.
   * If the node has no _selectedPort, all outgoing edges are activated.
   *
   * Note: disabled nodes must NOT call this method — their downstream nodes
   * should remain unreachable (caller's responsibility).
   */
  ```

---

**[INFO] `reachable` 초기화 블록 — "왜 incoming edge가 없는 노드인가" 설명 부재**
- 위치: `execution-engine.service.ts` — `runExecution` 및 `executeInline` 내 `reachable` 초기화 블록 (두 곳)
- 상세: 현재 주석은 "Track which nodes are reachable from the trigger through activated edges"로 목적은 설명하나, 초기값이 "incoming forward-edge가 없는 노드들"인 이유(= 워크플로우 진입점인 루트 노드)는 설명되어 있지 않음. 로직 자체는 올바르나 의도를 명확히 전달하지 못함.
- 제안:
  ```typescript
  // Seed reachability with root nodes (nodes with no incoming forward-edges).
  // These are workflow entry points; all other nodes must be activated
  // transitively via propagateReachability after each node executes.
  const reachable = new Set<string>();
  ```

---

**[INFO] back-edge 재실행 구간의 reachability 초기화 — 불변식(invariant) 미문서화**
- 위치: `execution-engine.service.ts` — back-edge 처리 블록 (`reachable.delete` 루프 구간)
- 상세: 재실행 범위 전체를 `reachable`에서 제거 후 진입 노드만 재추가하는 로직은 올바르지만, "범위 내 나머지 노드는 실행이 진행되며 `propagateReachability`를 통해 재활성화된다"는 불변식이 주석으로 명시되어 있지 않음. 이 주석 없이는 의도적인 부분 초기화 패턴이 버그처럼 보일 수 있음.
- 제안:
  ```typescript
  // Re-execution pass: clear reachability for the entire re-run range so
  // branch decisions are re-evaluated from scratch. Only the back-edge
  // target is seeded here; intermediate nodes will be re-activated
  // transitively as they execute via propagateReachability.
  ```

---

**[INFO] 테스트 시나리오 주석(ASCII 다이어그램)의 정확성 — 양호**
- 위치: `execution-engine.service.spec.ts` — `Reachability-based execution` describe 블록 내 각 `it` 설명 주석
- 상세: 각 테스트 앞에 `// A(port router) -> port1 -> B, port2 -> C` 형태의 그래프 구조 주석이 있어 테스트 의도를 명확하게 전달함. 코드와 일치하며 문서화 품질이 좋음.
- 제안: 변경 불필요.

---

### 요약

이번 변경의 핵심인 `portRoutingSkipped → reachable` 리팩터링은 `propagateReachability` 메서드에 JSDoc이 추가되고 인라인 주석도 전반적으로 업데이트되어 코드 자체의 문서화 수준은 양호하다. 그러나 `memory/execution-engine-analysis.md`가 삭제된 구현을 "현재 방식"으로 기술하는 상태로 방치된 점이 가장 심각한 문서화 결함이며, `executeInline` 내 `port-routing-skipped` 용어 잔존과 `propagateReachability` JSDoc의 disabled 노드 caller 책임 미명시, `reachable` 초기화 블록의 의도 미설명은 경미하지만 수정이 권장된다. 테스트 파일의 ASCII 다이어그램 주석은 충분히 명확하게 작성되어 있다.

### 위험도
**LOW**