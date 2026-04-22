## 발견사항

### **[WARNING]** `recentFailedAddNodeLabels` 필드 일관성 불일치
- **위치**: `shadow-workflow.ts`, `ShadowWorkflow` 클래스 필드 선언부
- **상세**: 같은 목적의 `labelConflictCounts`는 `private readonly`로 선언되어 있지만, `recentFailedAddNodeLabels`는 `readonly`가 없다. 두 필드 모두 생성자 이후 재할당되지 않고 내부 변이만 일어나므로 의미적으로 동등한데 선언이 다르면 리더에게 혼란을 준다.
- **제안**: `private readonly recentFailedAddNodeLabels: string[] = [];`

---

### **[WARNING]** `recordFailedAddNode` 호출 분산 — 신규 에러 케이스 추가 시 누락 위험
- **위치**: `shadow-workflow.ts`, `addNode()` 메서드 내 다섯 개의 조기 return 경로
- **상세**: `UNKNOWN_NODE_TYPE`, `LABEL_CONFLICT`, `NODE_NOT_FOUND`(containerId), `CONTAINER_INVALID_CHILD`, `INVALID_EXPRESSION` 다섯 곳에서 각각 `this.recordFailedAddNode(label)`를 호출한다. 나중에 새 에러 케이스를 추가할 때 이 호출을 빠뜨리면 cascading 힌트가 작동하지 않는다. 인터페이스 수준에서 강제되지 않으므로 maintenance 부채가 쌓인다.
- **제안**: early return 전에 실패를 기록하는 헬퍼로 래핑하거나, `addNode`의 중간에 `let failureResult: ShadowResult | null = null` 로 결과를 모아 단일 exit에서 처리하는 패턴으로 리팩터링.

---

### **[WARNING]** `SCHEMA_LOOKUP_HARD_STOP` 상수 주석과 실제 동작 불일치
- **위치**: `workflow-assistant-stream.service.ts`, 상수 선언부 및 `get_node_schema` 처리 블록
- **상세**: 상수 옆 주석은 "첫 호출 + cache hit 2회까지 관용, **4번째**부터 error 응답"이라고 하지만, 실제 구현은 첫 호출에 `hits:1`을 세팅하고 이후 호출마다 증가시켜 `>= 3`이면 error를 반환한다. 따라서 **3번째** 호출부터 error가 발생한다. 테스트(`thirdResult.ok === false`)와 구현은 일치하지만 주석만 잘못됐다.
- **제안**: 주석을 "3번째(hits===3)부터 error 응답"으로 수정하거나 상수를 `SCHEMA_LOOKUP_MAX_CALLS = 2`로 의미를 명확히 변경.

---

### **[WARNING]** `hasReachableAncestorContainer`에서 루프마다 Map 재생성
- **위치**: `review-workflow.ts`, `collectOrphans()` → `hasReachableAncestorContainer()` 호출 경로
- **상세**: `collectOrphans`는 도달 불가 노드마다 `hasReachableAncestorContainer`를 호출하고, 이 함수 안에서 `new Map(allNodes.map(...))` 으로 전체 노드 Map을 재생성한다. 워크플로우에 N개의 orphan이 있을 경우 O(N×total_nodes)의 Map 생성이 발생한다.
- **제안**: `collectOrphans` 상단에서 `byId` Map을 한 번만 생성하고 `hasReachableAncestorContainer`의 파라미터로 전달.

---

### **[WARNING]** `evaluateReviewGuard` 메서드 길이 (~90줄)
- **위치**: `workflow-assistant-stream.service.ts`, `evaluateReviewGuard` 메서드
- **상세**: 조기 반환 가드 6개 + plan context resolve + trivial 판정 + checklist 실행까지 하나의 메서드에 담겨 있다. 각 가드 조건의 의미가 주석으로 설명되어 읽히긴 하지만, 향후 조건 추가 시 메서드가 계속 길어질 위험이 있다.
- **제안**: `shouldSkipReview(state, pendingToolCalls): { skip: boolean; reason?: string }` 같은 가드 판정 메서드를 분리하면 `evaluateReviewGuard` 본문이 50줄 미만으로 정리된다.

---

### **[INFO]** 테스트 내 매직 UUID 리터럴
- **위치**: `shadow-workflow.spec.ts`, NODE_NOT_FOUND cascading 테스트
- **상세**: `'00000000-0000-0000-0000-dead0000dead'`가 두 테스트에 직접 사용된다. 의도(존재하지 않는 UUID)는 값 자체로 짐작되지만, 상수로 추출하면 의도가 더 명확하다.
- **제안**: `const NONEXISTENT_UUID = '00000000-0000-0000-0000-dead0000dead';`

---

### **[INFO]** `isRecoveredLater`의 미지원 tool name 처리 — 미래 확장 취약점
- **위치**: `review-workflow.ts`, `isRecoveredLater()`
- **상세**: 현재 알려진 5개 tool name 외의 이름은 `false`(비관적 미해결 취급)를 반환한다. 새 edit tool이 추가됐을 때 회복 감지 로직을 업데이트하지 않으면 false-positive가 계속 발생한다. 주석으로 언급되어 있지만 코드 자체에 TODO나 확장 포인트가 없다.
- **제안**: switch-case로 변경하고 default에 `exhaustive check` 또는 명시적 주석을 추가.

---

## 요약

전반적으로 코드는 목적별로 파일이 잘 분리되어 있고, 상수 추출과 메서드 분리도 양호하다. `ShadowWorkflow`의 에러 힌트 강화 로직은 잘 구조화되어 있으며, `review-workflow.ts`의 체크리스트 패턴도 단일 책임을 잘 유지한다. 다만 `addNode` 내의 `recordFailedAddNode` 호출 분산은 향후 에러 케이스가 추가될 때 누락 위험을 내포하며, `hasReachableAncestorContainer`의 루프 내 Map 재생성은 불필요한 성능 부채다. 주석-구현 불일치(`SCHEMA_LOOKUP_HARD_STOP` 설명)는 낮은 위험이지만 코드 리더에게 혼란을 줄 수 있으므로 즉시 수정하는 것이 좋다.

## 위험도

**LOW**