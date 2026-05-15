### 발견사항

- **[INFO]** 외부 패키지 추가 없음
  - 위치: 전체 diff
  - 상세: 이번 변경에서 새로운 npm 패키지나 외부 라이브러리 추가는 없음. `@xyflow/react`, `@/lib/stores/execution-store`, `@/lib/node-definitions` 등 기존 의존성만 사용.

- **[WARNING]** `getNodeDefinition` 의존성 우회로 인한 단일 진실 공급원(SSOT) 분리
  - 위치: `custom-node.tsx:53-62` (condPorts.length === 0 분기)
  - 상세: 변경 전에는 조건이 0개일 때 `getNodeDefinition(data.type)?.outputs ?? []`를 호출하여 node-definitions를 단일 진실 공급원으로 활용했음. 변경 후에는 `user_ended`, `max_turns`, `error`, `out` 포트가 컴포넌트 내부에 하드코딩되어, `node-definitions` 파일의 `ai_agent` 기본 출력 정의와 이 컴포넌트가 독립적으로 drift할 위험이 생김.
  - 제안: `node-definitions`에서 `ai_agent`의 기본 outputs 정의를 제거하거나, 또는 이 로직을 `node-definitions` 혹은 별도 헬퍼(`getAiAgentOutputs(mode, conditions)`)로 이동하여 단일 진실 공급원을 유지할 것.

- **[INFO]** 테스트의 내부 모듈 mock 구조는 변경사항과 일관됨
  - 위치: `custom-node.test.tsx` mock 섹션 (vi.mock 블록들)
  - 상세: `@xyflow/react`, `@/lib/stores/execution-store`, `../node-icon`, `@/components/ui/tooltip` mock이 변경 전후 동일하게 유지됨. 변경된 포트 로직은 mock 경계 안에서 올바르게 테스트됨.

- **[INFO]** `getNodeDefinition` import는 여전히 존재하나 `ai_agent` 조건 없음 경로에서 미사용
  - 위치: `custom-node.tsx:7` (`import { getNodeDefinition, CATEGORY_COLORS }`)
  - 상세: `getNodeDefinition`은 `ai_agent` 이외 노드 타입의 outputs와 `definition.inputs`, `definition.isContainer` 등에서 계속 사용되므로 불필요한 import는 아님. 단, `ai_agent` 전용 출력 결정 로직이 이 함수를 더 이상 거치지 않는다는 점에서 내부 의존 관계가 변경됨.

---

### 요약

이번 변경은 외부 의존성 추가가 전혀 없으며, 기존 패키지(`@xyflow/react`, `@/lib/node-definitions`, 내부 store/util 모듈) 사용 방식도 그대로 유지된다. 의존성 관점에서 주요 리스크는 내부 모듈 간의 것으로, `ai_agent` 노드의 기본 출력 포트 정의가 `node-definitions`에서 `custom-node.tsx` 컴포넌트로 이동하면서 두 곳이 독립적으로 관리될 위험이 생겼다. 이 로직을 단일 위치(node-definitions 또는 전용 헬퍼)에서 관리하도록 리팩토링하면 향후 유지보수 부담을 줄일 수 있다.

### 위험도

**LOW**