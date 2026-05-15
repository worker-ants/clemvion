### 발견사항

- **[WARNING]** 컨테이너 우회 규칙이 두 곳에 분산 적용됨
  - 위치: `shadow-workflow.ts` `addEdge` (~L252–258) 및 `wouldCreateCycle` (~L331–334)
  - 상세: "자식 → 조상 컨테이너 에지는 cycle 검사를 우회한다"는 규칙이 두 가지 다른 메커니즘으로 각각 구현되어 있음. `addEdge`는 `isContainerAncestor` 결과로 사이클 검사를 아예 건너뛰고, `wouldCreateCycle`은 DFS 중 기존 back-edge를 skip함. 우회 조건이 변경될 때(예: emit 포트 한정) 두 곳 모두 일관되게 수정해야 하는 묵시적 결합이 생김.
  - 제안: `shouldBypassCycleCheck(sourceId, targetId, targetPort)` 단일 술어 메서드를 추출해 `addEdge`와 `wouldCreateCycle` 양쪽에서 호출하도록 변경. 규칙의 단일 출처(single source of truth) 확보.

- **[WARNING]** 포트 의미론이 사이클 우회에 반영되지 않음
  - 위치: `shadow-workflow.ts` `isContainerAncestor` / `addEdge`
  - 상세: 스펙(§4.4) 및 테스트는 `emit` 포트로 되돌아오는 경우를 iteration back-edge로 정의하나, `isContainerAncestor`는 포트에 무관하게 작동함. `child.out → container.in`처럼 실행 엔진이 back-edge로 해석하지 않을 연결도 사이클 우회 대상이 됨.
  - 제안: `isContainerAncestor(sourceId, targetId) && LOOPBACK_PORTS.has(targetPort)` 조건을 `addEdge`의 우회 판정에 추가. `wouldCreateCycle` 내 skip 로직에도 동일하게 적용.

- **[INFO]** `wouldCreateCycle` 내부 루프의 복잡도 증가
  - 위치: `shadow-workflow.ts` `wouldCreateCycle` L323–337
  - 상세: DFS 내부에서 매 엣지마다 `isContainerAncestor`(O(D), D = 중첩 깊이)를 호출하므로 전체 복잡도가 O(V·E·D)로 증가함. 일반적인 워크플로우 크기에서는 무시 가능하나, 대형 워크플로우에서 중첩이 깊을 경우 누적 비용이 있음.
  - 제안: DFS 진입 전 sourceId의 조상 집합을 `Set<string>`으로 사전 계산 후 O(1) 조회로 대체.

- **[INFO]** `addEdge`의 outer guard와 `wouldCreateCycle` 내부 skip의 역할 관계가 비명시적
  - 위치: `shadow-workflow.ts` L252–258
  - 상세: `addEdge`의 `!isContainerAncestor` 조건은 조기 탈출 최적화이고, 실제 정합성은 `wouldCreateCycle`의 내부 skip이 담보함(기존 back-edge가 그래프에 이미 존재할 때). 이 레이어링이 주석 없이는 파악하기 어려움.
  - 제안: `addEdge`의 조건 앞에 "early-exit — existing back-edges are also excluded inside wouldCreateCycle" 한 줄 주석 추가.

- **[INFO]** `containerId`가 존재하지 않는 노드를 참조할 때 무음 처리
  - 위치: `shadow-workflow.ts` `isContainerAncestor`
  - 상세: 데이터 정합성 오류로 `containerId`가 삭제된 노드를 가리킬 때 `null`로 조용히 종료함. 방어적으로는 올바르지만, 진단 없이 `false`를 반환해 버그를 은닉할 수 있음.
  - 제안: 현재 동작은 프로덕션 관점에서 수용 가능하나, 동작 이유를 명시하는 주석을 추가해 의도적 선택임을 표기.

---

### 요약

컨테이너 loopback back-edge 허용 로직은 기능적으로 정확하고 테스트 커버리지도 충실하다. 핵심 아키텍처 우려는 "어떤 엣지가 cycle 우회 대상인가"라는 규칙이 `addEdge`와 `wouldCreateCycle` 두 곳에 분산되어 있다는 점이다. 특히 `emit` 포트 한정 등 우회 조건이 정교화될 경우 두 곳 모두를 일관되게 수정해야 하는 결합이 발생한다. 우회 조건을 단일 술어로 추출하고 포트 의미론을 반영하면 규칙의 경계가 명확해지고 유지보수 위험이 줄어든다.

### 위험도
**LOW**