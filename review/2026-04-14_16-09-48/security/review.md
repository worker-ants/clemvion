### 발견사항

---

**[WARNING]** WebSocket 페이로드의 `parentNodeExecutionId` 런타임 검증 부재
- 위치: `frontend/src/lib/websocket/use-execution-events.ts`, 304~440번 라인
- 상세: 서버에서 수신한 WebSocket 이벤트 페이로드를 TypeScript 타입 단언(`as { parentNodeExecutionId?: string; ... }`)으로만 처리하고 있습니다. 이는 컴파일 타임 검사이며 런타임에는 아무런 보호도 하지 않습니다. WebSocket 채널에 비정상적인 값(예: 매우 긴 문자열, 비 UUID 형식 값)이 유입되면 아무런 필터 없이 상태 저장소에 그대로 저장되어 React 키로 사용됩니다.
  ```ts
  // 런타임 타입 검증 없이 페이로드를 직접 사용
  const payload = data as {
    parentNodeExecutionId?: string;  // 어떤 값이든 허용
    ...
  };
  addNodeResult({ parentNodeExecutionId: payload.parentNodeExecutionId, ... });
  ```
- 제안: UUID 형식 검증 함수를 추가하여 `parentNodeExecutionId`가 UUID v4 형식인지 확인 후 사용하세요.
  ```ts
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const parentId = typeof payload.parentNodeExecutionId === 'string'
    && UUID_RE.test(payload.parentNodeExecutionId)
    ? payload.parentNodeExecutionId
    : undefined;
  ```

---

**[WARNING]** `countDescendants` / `sumDescendantDurations` 무제한 재귀 — 클라이언트 측 DoS 위험
- 위치: `frontend/src/components/editor/run-results/timeline-tree.ts`, 57~72번 라인
- 상세: 두 함수 모두 순수 재귀로 구현되어 있고 깊이 제한이 없습니다. 악의적이거나 비정상적인 서버 응답으로 인해 수십~수백 단계 깊이의 중첩 트리가 형성될 경우, 브라우저 자바스크립트 엔진의 콜스택을 초과하여 `RangeError: Maximum call stack size exceeded`가 발생합니다. 이는 UI 전체를 중단시키는 DoS 효과를 냅니다.
  ```ts
  export function countDescendants(tnode: TimelineTreeNode): number {
    let total = 0;
    for (const c of tnode.children) {
      total += 1 + countDescendants(c); // 깊이 제한 없음
    }
    return total;
  }
  ```
- 제안: 반복(iterative) 방식으로 구현하거나, 깊이 제한을 추가하세요.
  ```ts
  export function countDescendants(tnode: TimelineTreeNode, maxDepth = 20): number {
    if (maxDepth <= 0) return 0;
    let total = 0;
    for (const c of tnode.children) {
      total += 1 + countDescendants(c, maxDepth - 1);
    }
    return total;
  }
  ```

---

**[INFO]** `parentNodeExecutionId`의 API 응답 노출과 권한 검증 의존성
- 위치: `frontend/src/lib/api/executions.ts`, `NodeExecutionData` 인터페이스
- 상세: `parentNodeExecutionId`가 API 응답에 포함됨으로써, 해당 값이 다른 실행 레코드의 ID를 참조합니다. 만약 실행 조회 API에 실행 소유자(사용자/워크스페이스) 기반 권한 필터링이 없다면, 공개된 `parentNodeExecutionId`를 이용해 다른 사용자의 실행 ID를 추측하고 직접 조회할 수 있는 IDOR(Insecure Direct Object Reference) 가능성이 있습니다. 이번 변경 범위에서는 해당 API 레이어 구현을 확인할 수 없으나, UUID는 추측이 어려우므로 실질 위험은 낮습니다.
- 제안: 실행 조회 API에서 현재 인증된 사용자가 요청한 `executionId`에 접근 권한이 있는지 반드시 검증하고 있는지 확인하세요.

---

**[INFO]** `buildTimelineTree`의 순환 참조 방어 — 프론트엔드 안전
- 위치: `frontend/src/components/editor/run-results/timeline-tree.ts`, 28~55번 라인
- 상세: 서버가 순환 참조 데이터(A→B→A)를 반환하더라도, `buildTimelineTree`의 현재 구현은 `byKey` 맵에서 부모를 순차적으로 조회하므로, 입력이 시간 순으로 정렬되어 있다면 실제 순환 그래프가 형성되기 어렵습니다. 그러나 이는 암묵적 보호이며, 서버 측 순환 참조 방지가 없다면 정렬 순서가 다를 때 문제가 발생할 수 있습니다.
- 제안: 현재는 프론트엔드 레이어에서는 별도 조치가 불필요하지만, 백엔드에서 `parentNodeExecutionId` 설정 시 순환 참조 방지 로직(이전 리뷰에서 이미 WARNING으로 식별됨)이 구현되어야 합니다.

---

**[INFO]** `context.parentNodeExecutionId` 뮤테이션과 예외 안전성
- 위치: `backend/src/modules/execution-engine/execution-engine.service.ts`, 363~582번 라인
- 상세: `context` 객체를 직접 변경하고 `finally` 블록에서 복원하는 패턴을 사용합니다. `finally`가 항상 실행되므로 예외 상황에서도 복원은 보장되지만, 동일한 `context` 인스턴스를 공유하는 비동기 병렬 실행이 있을 경우 상태 오염 가능성이 있습니다. 현재 코드 흐름상 인라인 실행은 직렬로 처리되므로 즉각적인 위험은 없습니다.
- 제안: 장기적으로 `context`를 불변(immutable)으로 유지하고 인라인 실행 시 새 컨텍스트 객체를 생성하는 방식이 더 안전합니다.

---

### 요약

이번 변경에서 전통적인 보안 취약점(SQL 인젝션, XSS, 하드코딩된 시크릿, 인증 우회 등)은 발견되지 않았습니다. `parentNodeExecutionId`가 UUID 타입으로 DB FK 제약 하에 관리되고, 서버 측에서만 생성/설정되는 구조는 적절합니다. 다만 두 가지 실질적 위험이 있습니다: WebSocket 페이로드에 대한 런타임 UUID 검증 부재로 인한 비정상 값 유입 가능성, 그리고 무제한 재귀 트리 연산으로 인한 클라이언트 측 DoS 가능성입니다. 두 문제 모두 적은 비용의 방어 코드로 완화할 수 있으며, 특히 재귀 깊이 제한은 백엔드의 `MAX_RECURSION_DEPTH` 제한(10)과 일치하도록 프론트엔드에도 동일한 경계값을 적용하는 것을 권장합니다.

### 위험도

**LOW**