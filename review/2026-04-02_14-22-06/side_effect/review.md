## 부작용 코드 리뷰 결과

---

### 발견사항

---

#### **[WARNING]** `handleMouseUp`의 stale closure로 인한 잘못된 높이 저장

- **위치**: `run-results-drawer.tsx` — `useEffect` 내 `handleMouseUp`
- **상세**: `handleMouseUp`은 `useEffect([panelHeight])` 의존성 배열에 의해 재등록되지만, 드래그 중 `panelHeight` state는 `setPanelHeight`로 연속 업데이트된다. `handleMouseUp`이 실행되는 시점의 `panelHeight` 값은 드래그 시작 시 캡처된 값일 수 있어 `localStorage`에 올바른 최종 높이가 저장되지 않을 가능성이 있다.
- **제안**: `panelHeight` 대신 ref로 현재 높이를 추적하거나, `setPanelHeight`의 콜백 형태를 사용해 저장:
  ```ts
  const handleMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    setPanelHeight((h) => {
      localStorage.setItem(STORAGE_KEY, String(h));
      return h;
    });
  };
  ```

---

#### **[WARNING]** `document.body.style` 전역 DOM 변경 — cleanup 누락 시나리오

- **위치**: `run-results-drawer.tsx` — `handleMouseDown`, `handleMouseUp`
- **상세**: `document.body.style.cursor`와 `userSelect`를 직접 변경한다. 컴포넌트가 드래그 도중 unmount되면 `handleMouseUp`이 호출되지 않아 body 스타일이 영구적으로 오염된다.
- **제안**: `useEffect` cleanup 함수에서 body 스타일 복원 추가:
  ```ts
  return () => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    // 강제 복원
    if (isDragging.current) {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      isDragging.current = false;
    }
  };
  ```

---

#### **[WARNING]** `NodeResult` 인터페이스 파괴적 변경 — `nodeCategory`, `status` 필드 필수화

- **위치**: `execution-store.ts` — `NodeResult` interface
- **상세**: `nodeCategory: string`과 `status: NodeExecutionStatus`가 필수 필드로 추가되었다. 기존 코드에서 `NodeResult` 객체를 직접 생성하는 곳이 있다면 TypeScript 컴파일 에러가 발생한다. 특히 테스트 파일에서 `makeResult` 헬퍼로 정규화했지만, 다른 모듈에서 직접 `NodeResult`를 생성하는 경우 컴파일 에러가 발생할 수 있다.
- **제안**: 마이그레이션이 완료된 것으로 보이나, 코드베이스 전체에서 `NodeResult` 직접 생성 패턴을 검색하여 누락된 곳이 없는지 확인 필요.

---

#### **[WARNING]** `ResultTimeline`의 `onSelect` 무한 렌더링 위험

- **위치**: `result-timeline.tsx` — 자동 선택 `useEffect`
- **상세**:
  ```ts
  useEffect(() => {
    if (!selectedId && results.length > 0) {
      onSelect(results[0].nodeId);
    }
  }, [selectedId, results, onSelect]);
  ```
  `onSelect`가 `selectResultNode` (store action)이므로 안정적이지만, `results` 배열 참조는 매 렌더링마다 새로 생성될 수 있다. 부모가 `nodeResults`를 selector로 가져오는 경우 zustand가 shallow comparison을 수행하지 않으면 참조가 변경되어 effect가 반복 실행될 수 있다.
- **제안**: `results.length`만 의존성으로 사용하거나, `results[0]?.nodeId`를 의존성에 추가하여 실제 변경 시에만 동작하도록 제한:
  ```ts
  useEffect(() => {
    if (!selectedId && results.length > 0) {
      onSelect(results[0].nodeId);
    }
  }, [selectedId, results.length, onSelect]);
  ```

---

#### **[INFO]** `executions.service.ts` — `relations: ['node']` 추가로 인한 쿼리 성능 변화

- **위치**: `executions.service.ts:37`
- **상세**: `nodeExecutionRepository.find()`에 `relations: ['node']`가 추가되어 JOIN 쿼리가 발생한다. 실행당 노드 수가 많은 경우 N+1이 아닌 단일 JOIN이므로 오히려 효율적이나, `node` relation이 `NodeExecution` 엔티티에 정의되어 있지 않으면 런타임 에러가 발생한다.
- **제안**: `NodeExecution` 엔티티에 `@ManyToOne(() => Node) node: Node` relation이 선언되어 있는지 확인 필요.

---

#### **[INFO]** `execution-engine.service.ts` — WS 이벤트 페이로드 확장

- **위치**: `execution-engine.service.ts:501, 548, 583, 645`
- **상세**: `nodeType`, `nodeLabel`, `output` 필드가 기존 이벤트 페이로드에 추가된다. 기존 클라이언트가 이 필드를 무시하도록 설계되어 있으므로 하위 호환성은 유지된다. 단, `output: nodeExecution.outputData`는 대용량 데이터를 WS로 전송할 수 있어 성능 영향이 있을 수 있다.
- **제안**: `outputData`가 매우 큰 경우(예: 수천 행의 테이블 데이터)를 고려하여 필요 시 크기 제한 또는 요약 전송 방식 검토.

---

#### **[INFO]** `use-execution-events.ts` — `PRESENTATION_TYPES` 집합 제거

- **위치**: `use-execution-events.ts`
- **상세**: 기존 presentation 필터링 로직이 완전히 제거되었다. 이제 모든 노드의 결과가 store에 추가된다. 이는 의도된 변경이나, 대규모 워크플로우(수십 개 노드)에서 store 메모리 사용량이 증가한다.
- **제안**: 현재 스펙의 범위에서는 문제없으나, 향후 페이지네이션 또는 결과 수 제한 로직을 고려할 수 있다.

---

### 요약

이번 변경의 핵심은 Run Results Drawer를 채팅형 히스토리에서 2-column 타임라인 레이아웃으로 전환하고, presentation 노드만 수집하던 방식을 모든 노드로 확장하는 것이다. 전반적으로 설계는 올바르며 명시적인 상태 관리, 이벤트 핸들러 cleanup, localStorage 활용이 적절히 구현되어 있다. 단, **드래그 도중 컴포넌트 unmount 시 `document.body.style` 오염**과 **stale closure로 인한 localStorage 높이 저장 오류** 두 가지는 실제 사용자 경험에 영향을 줄 수 있는 `WARNING` 수준의 부작용이다. `ResultTimeline`의 `useEffect` 의존성도 불필요한 재실행 가능성이 있어 개선이 권장된다.

### 위험도

**LOW ~ MEDIUM**