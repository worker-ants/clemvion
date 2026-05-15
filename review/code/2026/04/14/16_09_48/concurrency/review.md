### 발견사항

- **[WARNING]** 공유 `ExecutionContext` 객체에 대한 save/restore 패턴의 경쟁 조건 가능성
  - 위치: `execution-engine.service.ts` — `executeInline` 내 `context.parentNodeExecutionId` 변경 블록
  - 상세: 변경된 코드는 `context` 객체에 저장 후 복원하는 패턴을 사용합니다.
    ```typescript
    const prevParentNodeExecutionId = context.parentNodeExecutionId;
    if (parentNodeExecutionId) {
      context.parentNodeExecutionId = parentNodeExecutionId;
    }
    // ... (await 포함 비동기 실행) ...
    } finally {
      context.parentNodeExecutionId = prevParentNodeExecutionId;
    }
    ```
    이 `context` 객체는 레퍼런스로 전달되어 같은 실행 내 모든 노드가 공유합니다. 실행 그래프에 병렬 분기(fork → 두 경로 → join)가 존재하고, 양쪽 경로에 각각 Sub-Workflow 노드가 있다면 `Promise.all`류 병렬 실행 시 두 `executeInline` 호출이 동시에 같은 `context.parentNodeExecutionId`를 mutate할 수 있습니다. 이 경우 Branch A의 저장값이 Branch B의 실행 도중 오염되어 잘못된 `parentNodeExecutionId`가 NodeExecution에 기록될 수 있습니다.
  - 제안: 기존 `recursionDepth`에도 동일 패턴이 이미 존재하므로 이 변경 단독의 신규 위험은 아닙니다. 그러나 병렬 분기 실행이 가능한 구조라면 `context`를 shallow-clone하여 각 분기에 독립된 사본을 전달하는 방식을 장기적으로 검토해야 합니다.

- **[INFO]** `_executedNodes: Set<string>` 공유 상태와의 일관성
  - 위치: `execution-engine.service.ts`, `workflow-executor.interface.ts`
  - 상세: `executedNodes`는 동일한 `Set` 인스턴스를 병렬 분기가 공유합니다. 이번 변경이 이 문제를 도입하진 않지만, `parentNodeExecutionId`의 save/restore 패턴과 함께 공유 컨텍스트 뮤테이션이 누적되고 있습니다. Node.js의 단일 스레드 이벤트 루프 내 순수 순차 `await` 체인에서는 안전하지만, 병렬 실행(`Promise.all`) 시에는 `Set`의 쓰기와 `parentNodeExecutionId` 읽기 사이에 중간 상태가 노출될 수 있습니다.
  - 제안: 현재 구조 유지 시 인라인 실행 경로가 항상 순차적임을 명시적으로 보장하는 주석 또는 assertion 추가를 권장합니다.

- **[INFO]** Frontend 드래그 핸들러의 `useRef` 동시성 — 안전
  - 위치: `run-results-drawer.tsx` — `isDraggingWidth`, `startX`, `currentWidthRef`
  - 상세: 브라우저 단일 스레드 환경에서 `useRef`로 관리되는 드래그 상태는 이벤트 핸들러 간 순차 실행이 보장되므로 경쟁 조건 없음.
  - 제안: 없음.

---

### 요약

이번 변경의 핵심 동시성 리스크는 `ExecutionContext` 공유 객체에 대한 `parentNodeExecutionId` save/restore 패턴입니다. Node.js 단일 스레드 특성상 순수 순차 `await` 체인에서는 안전하지만, 실행 그래프의 병렬 분기에서 `Promise.all`로 복수의 Sub-Workflow 노드가 동시에 `executeInline`을 호출하는 경로가 존재할 경우 잘못된 `parentNodeExecutionId`가 기록될 수 있습니다. 이 패턴은 기존 `recursionDepth` 처리에도 동일하게 존재하므로 이 PR 단독의 신규 결함은 아니나, 공유 컨텍스트 뮤테이션의 누적이 향후 병렬 실행 기능 도입 시 버그로 발현될 잠재적 취약점입니다.

### 위험도

**LOW**