## 리뷰 결과: 유지보수성 (Maintainability)

---

### 발견사항

- **[INFO]** `backEdgeMap` 빌드 로직이 `runExecution` 내 인라인으로 작성됨
  - 위치: `execution-engine.service.ts` step 7 이후 (~270라인)
  - 상세: back-edge 맵 구축이 `identifyBackEdges` 호출과 묶여 있으나, 별도 함수 `buildBackEdgeMap(backEdges, sortedNodeIds)`로 분리하면 `runExecution`의 책임 범위가 명확해짐
  - 제안: 추출 검토 (현재 수준에서 필수는 아님)

- **[INFO]** `runExecution` 메서드가 여전히 장대한 단일 메서드
  - 위치: `execution-engine.service.ts:runExecution`
  - 상세: back-edge 지원 추가로 메서드가 더 길어졌으나, 이는 이번 변경이 아닌 기존 구조의 문제이며 이번 변경은 해당 구조를 유지하는 선에서 최소 침습적으로 기능을 추가함
  - 제안: 기존 리팩터링 이슈 유지 (이번 범위 초과)

- **[INFO]** 테스트에서 `service['configService']` private 프로퍼티 직접 접근
  - 위치: `execution-engine.service.spec.ts` ~873, ~951라인
  - 상세: `configService.get.mockImplementation(...)` 재정의를 위해 private 필드에 접근. Jest의 module 재생성보다는 편리하지만 리팩터링 시 취약점이 될 수 있음
  - 제안: 테스트별로 `ConfigService` provider를 다르게 구성하거나, 별도 `beforeEach` 블록에서 모듈을 재생성하는 방식이 더 안전. 현재 구조에서는 `as unknown as` 캐스팅과 함께 허용 범위 내이나 향후 필드명 변경 시 런타임에만 오류가 발생할 수 있음

- **[INFO]** `back-edge-identifier.ts`의 `adjacency` 맵이 노드 집합에 없는 엣지를 조용히 무시
  - 위치: `back-edge-identifier.ts:34-38`
  - 상세: `nodeIds`에 없는 소스/타겟은 skip되지만, 이 엣지들은 `forwardEdges`에 포함됨(마지막 분류 루프에서). 스펙과 일치하며 테스트로 커버되어 있으나, 로직 흐름이 두 단계로 분리되어 추적이 약간 어려움
  - 제안: 주석 한 줄 추가로 충분 (`// edges referencing unknown nodes are treated as forward edges`)

- **[INFO]** `findActivatedBackEdge` 첫 번째 활성화된 back-edge만 반환
  - 위치: `execution-engine.service.ts:findActivatedBackEdge`
  - 상세: 동일 소스에서 여러 back-edge가 활성화될 수 있는 경우(예: `_selectedPort` 없음 + 다중 back-edge), 첫 번째만 처리됨. 현재 사용 시나리오에서는 문제없지만 동작이 문서화되지 않음
  - 제안: JSDoc에 "첫 번째 매칭된 back-edge를 반환" 명시 추가

---

### 요약

이번 변경은 사이클 감지(cycle-detector)를 back-edge 식별(back-edge-identifier)로 교체하여 순환 참조 워크플로우를 지원하는 핵심 기능을 추가한다. `back-edge-identifier.ts`는 DFS 기반 알고리즘이 명확하게 분리된 단일 책임 모듈로 잘 구현되어 있으며, 테스트 커버리지도 다양한 엣지 케이스를 충분히 포함한다. `execution-engine.service.ts`의 변경은 기존 `for`루프를 `while + pointer` 패턴으로 전환하는 것으로, 논리적 흐름은 주석과 스텝 번호로 잘 추적되나 메서드 전체 길이 증가는 기존 기술 부채를 심화시킨다. 테스트 코드에서 `service['configService']` private 접근은 취약하지만 현재 테스트 구조상 실용적인 선택이다. 전반적으로 기존 코드베이스 스타일과 일관성을 유지하며 최소 침습적으로 기능을 추가한 수준 높은 변경이다.

### 위험도

**LOW**