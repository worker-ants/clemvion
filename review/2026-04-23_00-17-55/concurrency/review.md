### 발견사항

- **[INFO]** `ShadowWorkflow` 클래스 내 다중 단계 뮤테이션의 암묵적 원자성 의존
  - 위치: `shadow-workflow.ts` — `recordFailedAddNode`, `addNode` 내 `labelConflictCounts` read-modify-write
  - 상세: 아래 패턴들이 Node.js 단일 스레드 보장에 암묵적으로 의존한다.
    ```typescript
    const prev = this.labelConflictCounts.get(label) ?? 0;
    const next = prev + 1;
    this.labelConflictCounts.set(label, next); // get~set 사이 await 없음 → 안전
    ```
    ```typescript
    // recordFailedAddNode 도 동일: indexOf → splice → push 사이 await 없음
    ```
    현재 구현상 `apply()`가 호출되는 루프 안에 `await`가 없으므로 안전하다. 단, 향후 `apply()`에 비동기 작업이 추가되거나 Worker Threads로 이관될 경우 race condition 발생 가능.
  - 제안: 지금 당장 변경이 필요하진 않지만, 클래스 수준 JSDoc에 "단일 async 컨텍스트에서만 사용 가능, 멀티스레드 이관 금지" 제약을 명시해두면 향후 사고를 예방한다.

- **[INFO]** `schemaCache` check-then-act 패턴에 `await` 게재
  - 위치: `workflow-assistant-stream.service.ts` — `get_node_schema` 처리 블록
  - 상세: `schemaCache.get(typeArg)` → miss → `await this.handleExploreCall(...)` → `schemaCache.set(...)` 사이에 `await`가 존재한다. 멀티스레드 환경이라면 두 호출이 동시에 cache miss를 내고 각자 DB를 조회한 뒤 덮어쓰는 TOCTOU 문제가 생길 수 있다.
  - 상세 (현재): `schemaCache`는 `streamMessage` 호출마다 새로 생성되는 지역 변수이고, 내부 처리 루프는 async iterator를 순차적으로 소비하므로 실제 동시 접근은 불가능하다. 위험도 없음.
  - 제안: 변경 불필요. 단, 캐시를 인스턴스 변수나 외부 저장소로 올릴 계획이 생기면 즉시 동기화 로직을 추가해야 한다.

---

### 요약

변경된 코드 전체는 Node.js 단일 이벤트 루프 모델에 맞게 설계되어 있다. `ShadowWorkflow`의 가변 상태(`labelConflictCounts`, `recentFailedAddNodeLabels`)와 서비스의 `schemaCache`·`guardState`는 모두 턴 범위 지역 변수 또는 동일 async 컨텍스트 내 순차 뮤테이션으로 구현되어 있어, `await` 경계 사이에 공유 자원에 대한 동시 접근이 발생하지 않는다. `review-workflow.ts`는 완전히 순수 함수형 모듈로 공유 상태가 전혀 없다. 현재 아키텍처에서 실질적인 동시성 위험은 존재하지 않는다.

### 위험도

**LOW**