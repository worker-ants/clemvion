### 발견사항

---

**[WARNING] `containerId` 조작을 통한 사이클 감지 우회**
- 위치: `shadow-workflow.ts` — `isContainerAncestor()`, `addEdge()` (~line 252–268)
- 상세: `ShadowWorkflow`는 생성자에서 받은 `ShadowSnapshot`의 `containerId` 값을 신뢰한다. `currentWorkflow` 페이로드(spec §5.2)는 클라이언트가 직접 제출하는 요청 본문이다. 악의적 사용자가 `containerId`를 조작해 A가 B의 자식인 것처럼 보이는 스냅샷을 전송하면, `add_edge(source=A, target=B)` 호출 시 `isContainerAncestor(A, B)` 가 `true`를 반환해 사이클 검사가 완전히 스킵된다.
  ```typescript
  // 서버가 containerId 관계를 독립적으로 검증하지 않으면
  // 클라이언트가 조작한 스냅샷으로 이 분기를 무조건 통과할 수 있다
  if (!this.isContainerAncestor(sourceId, targetId)) {
    if (this.wouldCreateCycle(sourceId, targetId)) { ... }
  }
  ```
- 제안: 백엔드에서 `currentWorkflow`를 수신할 때, DB에 저장된 실제 워크플로우의 `containerId` 관계와 교차 검증하거나, shadow 레이어 진입 전 서버 측에서 `containerId` 관계의 정합성을 별도로 검증한다.

---

**[WARNING] 포트 미검증 — back-edge 예외가 `emit` 포트에 한정되지 않음**
- 위치: `shadow-workflow.ts` — `addEdge()` (line 252–268), 테스트 케이스 전반
- 상세: 스펙(§4.4)은 "자식 → 조상 컨테이너의 `emit` 포트로 되돌아가는 에지"만 iteration back-edge로 허용한다고 명시한다. 그러나 구현은 `targetPort` 값에 관계없이 `isContainerAncestor(sourceId, targetId)` 가 참이면 사이클 검사를 건너뛴다. `child → container.in` 또는 `child → container.body` 같은 비iteration 경로도 사이클 검사를 우회할 수 있다. 실행 엔진이 `emit` 외의 포트로 들어오는 back-edge를 올바르게 처리하지 않으면 실행 시점 무한 루프가 발생할 수 있다.
  ```typescript
  // target_port 검사 없음 — 'emit'이 아닌 모든 포트도 예외 처리됨
  if (!this.isContainerAncestor(sourceId, targetId)) { ... }
  ```
- 제안: 예외 조건에 `targetPort === 'emit'` (또는 스펙이 허용하는 iteration 포트 목록) 확인을 추가한다.
  ```typescript
  const ITERATION_PORTS = new Set(['emit']);
  if (!this.isContainerAncestor(sourceId, targetId) || !ITERATION_PORTS.has(targetPort)) {
    if (this.wouldCreateCycle(sourceId, targetId)) { ... }
  }
  ```

---

**[INFO] `wouldCreateCycle` 내 back-edge 제외로 인한 도달성 계산 불완전 가능성**
- 위치: `shadow-workflow.ts` — `wouldCreateCycle()` (line 331–342)
- 상세: 기존 back-edge(`child → ancestor`)를 도달성 계산에서 제외하는 것은 의도된 설계이나, 향후 그래프 구조가 복잡해지면 back-edge를 통한 경유 경로를 포함하는 실제 사이클을 놓칠 수 있다. 현재 로직에서는 `container → child` 방향의 순방향 에지는 제외되지 않으므로 당장의 위험은 제한적이다.
- 제안: 추후 복잡한 중첩 컨테이너 시나리오를 커버하는 통합 테스트를 추가해 회귀를 방지한다.

---

**[INFO] `containerId` 체인 깊이 무제한**
- 위치: `shadow-workflow.ts` — `isContainerAncestor()` (line 356–366)
- 상세: `visited` 집합으로 무한 루프는 방어하지만, 체인 길이에 대한 명시적 상한이 없다. 손상된 데이터에서 매우 긴 체인이 입력되면 반복 횟수가 늘어날 수 있다. DoS 수준의 위협은 아니나, 방어적 하드캡 추가가 바람직하다.
- 제안: 순회 횟수 상한(`MAX_CONTAINER_DEPTH = 50` 수준)을 두고 초과 시 `false`를 반환한다.

---

### 요약

변경된 코드는 컨테이너 기반 iteration back-edge를 사이클 검사에서 제외하는 논리적으로 타당한 기능을 구현한다. 하드코딩된 시크릿, SQL 인젝션, XSS 등 즉각적인 취약점은 없다. 그러나 두 가지 구조적 보안 우려가 있다: (1) `currentWorkflow.containerId`가 클라이언트 조작 가능한 입력이므로, 서버 측 교차 검증 없이는 사이클 검사를 의도적으로 우회할 수 있고, (2) back-edge 예외가 `emit` 포트로 한정되지 않아 실행 엔진이 기대하지 않는 경로가 허용될 수 있다. `ShadowWorkflow`가 영구 저장 전 검증 레이어임을 고려하면 실제 피해 반경은 제한적이지만, 클라이언트 입력 신뢰를 줄이고 포트 검증을 추가해야 한다.

### 위험도

**MEDIUM**