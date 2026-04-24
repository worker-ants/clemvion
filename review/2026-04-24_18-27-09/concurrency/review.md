### 발견사항

- **[INFO]** 모듈 스코프 가변 캐시 (`expressionReferenceCache`)
  - 위치: `system-prompt.ts` — `let expressionReferenceCache: string | null = null`
  - 상세: 모듈 수명 동안 공유되는 단일 가변 변수. Node.js 기본 단일 스레드 모델에서는 동기 초기화(`getExpressionReferenceSection()`)가 이벤트 루프 중간에 선점되지 않으므로 실질적 경쟁 조건은 없음. 단, Worker Threads 도입 시 복수 워커가 동일 모듈 인스턴스를 공유하는 구조라면 write-after-read 경쟁이 발생할 수 있음.
  - 제안: 현 Node.js/NestJS 단일 스레드 환경에서는 조치 불필요. Worker Threads 확장을 고려한다면 `Atomics`나 per-worker 초기화 패턴으로 격리할 것.

- **[INFO]** `labelLookalikeHint` 의 O(n) 선형 탐색
  - 위치: `shadow-workflow.ts:660-690` — `for (const node of this.nodes.values())`
  - 상세: `updateNode`, `removeNode`, `add_edge` 실패 경로에서 매번 전체 노드 맵을 순회. 동시성 문제가 아닌 단일 스레드 내 순차 실행이므로 안전하나, 워크플로우가 수백 노드 규모로 커질 경우 이벤트 루프 점유 시간이 증가할 수 있음.
  - 제안: 현 규모(수십 노드)에서는 문제없음. 노드 수가 수백 이상으로 확장될 가능성이 있다면 `label → id` 역방향 Map을 별도 유지하는 것을 검토.

- **[INFO]** `recentFailedAddNodeLabels` 배열 공유 변이
  - 위치: `shadow-workflow.ts` — `recordFailedAddNode`, `forgetFailedAddNode`, `addEdge`
  - 상세: 동일 `ShadowWorkflow` 인스턴스가 단일 요청(턴) 수명을 갖는다면 직렬 접근이 보장됨. 인스턴스 공유 범위가 요청 간으로 확대되는 설계 변경이 생기면 경쟁 조건 지점이 됨.
  - 제안: 인스턴스 생성 위치에서 요청 스코프 바인딩이 유지되는지 확인하면 충분.

---

### 요약

변경 코드 전체가 동기 연산으로만 구성된 Node.js 단일 스레드 모델 위에서 동작하며, 새로 추가된 `labelLookalikeHint` 메서드와 `addEdge` fallback 경로는 모두 순차 실행이다. 신규 비동기 패턴, 락, 공유 가변 상태 확장이 없으므로 현재 아키텍처에서 경쟁 조건·데드락·동기화 누락은 발생하지 않는다. 유일한 주의 지점은 모듈 스코프의 `expressionReferenceCache`이나, 이는 테스트 격리 목적의 리셋 함수가 존재하고 동기 초기화 경로를 유지하는 한 안전하다.

### 위험도
**LOW**