## 리뷰 결과: 아키텍처 (Architecture)

---

### 발견사항

---

**[WARNING]** `ExecutionEngineService`의 단일 책임 위반 심화

- 위치: `execution-engine.service.ts` — `runExecution()` 메서드 (전체 약 200+ 라인)
- 상세: 이번 변경으로 `runExecution()`이 그래프 분석(back-edge 식별), 위상 정렬, 포인터 기반 반복 제어, 노드 실행 오케스트레이션, 폼/버튼 대기까지 모두 처리하게 됐다. 특히 back-edge 점프 로직이 노드 실행 루프 내부에 직접 내장되어 있어 이 메서드의 인지 복잡도가 급격히 상승했다.
- 제안: 포인터 기반 실행 루프를 `GraphExecutionCursor` 또는 `WorkflowExecutionPlanner` 같은 별도 클래스로 분리. back-edge 활성화 여부 판단 및 포인터 조작 로직을 캡슐화하여 `runExecution()`은 고수준 오케스트레이션만 담당하도록 리팩터링.

---

**[WARNING]** `backEdgeMap`의 `targetIndex`가 토폴로지 정렬 결과에 강하게 결합

- 위치: `execution-engine.service.ts:267-278`
  ```ts
  for (const edge of backEdges) {
    const targetIndex = sortedNodeIds.indexOf(edge.targetNodeId);
    ...
  }
  ```
- 상세: `targetIndex`는 `sortedNodeIds` 배열의 인덱스에 의존한다. `sortedNodeIds`가 변경되거나 back-edge가 `sortedNodeIds`에 없는 노드를 가리킬 때 `indexOf`가 `-1`을 반환하여 `pointer = -1`이 되고 무한 루프 또는 잘못된 실행이 발생한다. 현재 이 케이스에 대한 방어 코드가 없다.
- 제안:
  ```ts
  const targetIndex = sortedNodeIds.indexOf(edge.targetNodeId);
  if (targetIndex === -1) {
    this.logger.warn(`Back-edge target "${edge.targetNodeId}" not in sorted nodes, skipping`);
    continue;
  }
  ```

---

**[WARNING]** `findActivatedBackEdge`의 back-edge 활성화 로직이 edge 방향성과 역방향으로 동작할 수 있음

- 위치: `execution-engine.service.ts:1234-1258` (`findActivatedBackEdge` 메서드)
- 상세: `_selectedPort`가 없는 경우 back-edge가 **항상** 활성화되는 로직은, 단순 패스스루 노드(분기 없음)가 back-edge의 소스인 경우 의도치 않은 루프백을 유발한다. 예를 들어 A → B → A에서 B가 분기 없는 transform 노드라면 B가 실행될 때마다 무조건 A로 돌아간다.
- 제안: back-edge 소스 노드의 출력에 `_selectedPort`가 없을 때의 활성화 정책을 스펙에서 더 명확히 정의하고, 필요하다면 back-edge에 명시적인 `isDefault` 플래그 또는 활성화 조건을 요구하도록 설계 변경 검토.

---

**[INFO]** `configService.get`에 대한 private 필드 직접 접근 패턴이 테스트에서 반복됨

- 위치: `execution-engine.service.spec.ts:856-862, 910-916`
  ```ts
  const configService = service['configService'] as unknown as { get: jest.Mock };
  configService.get.mockImplementation(...);
  ```
- 상세: TypeScript `private` 필드를 `['fieldName']`으로 접근하는 것은 캡슐화 위반이며, 추후 리팩터링 시 테스트가 조용히 깨질 수 있다. 특히 여러 테스트 케이스에서 같은 패턴이 반복되면 유지보수 부담이 커진다.
- 제안: `ConfigService` mock을 `beforeEach`의 provider 수준에서 교체 가능하도록 `mockConfigService` 변수로 추출하거나, `useValue`의 `get` mock을 `jest.fn().mockReturnValue(100)`으로 선언 후 각 테스트에서 `mockConfigService.get.mockReturnValue(3)`으로 오버라이드.

---

**[INFO]** `identifyBackEdges`에서 노드 집합 외부 엣지 처리 불일치

- 위치: `back-edge-identifier.ts:27-31`
  ```ts
  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      continue; // adjacency에 추가 안 됨
    }
  ```
  vs. 최종 분류:
  ```ts
  for (const edge of edges) {
    if (backEdgeSet.has(edge)) { ... } else { forwardEdges.push(edge); }
  }
  ```
- 상세: 노드 집합 외부를 가리키는 엣지는 adjacency에서 제외되어 back-edge가 될 수 없으므로 최종적으로 `forwardEdges`로 분류된다. 스펙과 테스트("preserve edges not belonging to the node set")는 이 동작을 의도적으로 허용하지만, 함수 시그니처와 JSDoc에 이 사이드 이펙트가 문서화되어 있지 않다.
- 제안: JSDoc에 "Edges where either endpoint is not in the node set are treated as forward-edges." 명시 추가.

---

**[INFO]** `ExecutionEngineModule`에서 `ConfigModule` 등록 방식

- 위치: `execution-engine.module.ts:20`
- 상세: `ConfigModule`을 feature 모듈에서 직접 import하는 것은 NestJS에서 허용되지만, 일반적으로 `AppModule`에서 `ConfigModule.forRoot()`로 전역 등록 후 `isGlobal: true`를 설정하면 하위 모듈에서 별도 import 없이 `ConfigService`를 주입받을 수 있다. 현재 방식은 각 모듈에 중복 등록될 위험이 있다.
- 제안: `AppModule`에서 `ConfigModule.forRoot({ isGlobal: true })`로 등록되어 있는지 확인. 이미 전역 등록이라면 `ExecutionEngineModule`에서의 `ConfigModule` import는 제거 가능.

---

### 요약

이번 변경은 기존의 단순한 사이클 거부(cycle detection → throw) 방식을 back-edge 분리 + 포인터 기반 루프 실행으로 대체하는 기능적으로 의미 있는 아키텍처 확장이다. `back-edge-identifier.ts`가 독립 모듈로 잘 분리된 점, 테스트 커버리지가 충분한 점은 긍정적이다. 그러나 `runExecution()`의 책임 범위가 지나치게 커져 단일 책임 원칙 위반이 심화되고 있으며, `targetIndex`에 대한 방어 코드 누락은 런타임 오류를 유발할 잠재적 위험이 있다. 특히 back-edge가 존재하면서 동시에 포트 라우팅 스킵 상태 초기화(`portRoutingSkipped` 리셋)까지 동일 루프 내에서 관리하는 구조는 추후 새로운 흐름 제어 기능(예: 조건부 skip, 병렬 실행)이 추가될 때 변경 비용이 크므로 실행 커서 추상화를 통한 분리를 권장한다.

### 위험도

**MEDIUM**