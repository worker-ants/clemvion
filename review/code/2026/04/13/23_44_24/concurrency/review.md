## 발견사항

### **[WARNING]** 비동기 로딩의 경쟁 조건 (Race Condition)
- **위치**: `editor-loader.tsx` — `useEffect` 내 `load()` 함수
- **상세**: `workflowId`가 변경되면 이전 `load()` 실행이 취소되지 않은 채 계속 진행됩니다. 이전 로딩이 새로운 로딩보다 늦게 완료되면 오래된 워크플로우 데이터로 `setWorkflow`가 호출되어 더 최신 상태를 덮어씁니다. `useEffect` 클린업 함수가 없어 stale 클로저 문제가 발생합니다.
- **제안**: 취소 플래그 또는 AbortController를 사용하세요.
```typescript
useEffect(() => {
  let cancelled = false;
  async function load() {
    try {
      const [...] = await Promise.all([...]);
      if (cancelled) return;
      setWorkflow(workflowId, ...);
    } catch (err) {
      if (!cancelled) setError(...);
    } finally {
      if (!cancelled) setLoading(false);
    }
  }
  void load();
  return () => { cancelled = true; };
}, [workflowId, setWorkflow]);
```

---

### **[WARNING]** `nodeRectsSelector`의 항상-새-참조 문제
- **위치**: `custom-edge.tsx` — `nodeRectsSelector` 함수, `useStore(nodeRectsSelector)` 호출
- **상세**: `nodeRectsSelector`가 매 호출마다 `.map()`으로 새 배열을 생성합니다. `useStore`는 기본적으로 참조 동일성(`Object.is`)으로 비교하므로, 노드와 무관한 스토어 업데이트(예: `hoveredNodeId` 변경)에도 **모든 엣지 컴포넌트**가 재렌더링됩니다. React 18 Concurrent 모드에서 다수의 엣지가 서로 다른 렌더링 시점에 경로를 계산하여 시각적 불일치(tearing)가 발생할 수 있습니다.
- **제안**: `shallow` 비교 함수를 사용하세요.
```typescript
import { shallow } from 'zustand/shallow';
const nodeRects = useStore(nodeRectsSelector, shallow);
```

---

### **[INFO]** Zustand `get()`/`set()` 분리 패턴의 비원자성
- **위치**: `editor-store.ts` — `onConnect` 핸들러
- **상세**: `detectContainerConflict(get().nodes, ...)` 호출과 이후 `set(state => {...})` 사이에 별도의 `get().pushUndo()` 호출이 존재합니다. JavaScript는 단일 스레드이므로 동기 코드에서는 안전하지만, React 18의 자동 배칭(automatic batching) 환경에서는 `pushUndo`와 실제 `set` 사이에 중간 렌더링이 발생하여 undo 스택과 실제 상태가 불일치할 수 있습니다.
- **제안**: `onConnect`의 전체 로직을 단일 `set()` 내부로 통합하는 것이 이상적입니다.

---

### **[INFO]** `isFocusActive`의 중복 의존성
- **위치**: `use-edge-highlighting.ts` — `enhancedEdges` useMemo 의존성 배열 `[edges, highlightedEdgeIds, isFocusActive]`
- **상세**: `isFocusActive`는 `highlightedEdgeIds`에서 파생된 값인데 둘 다 deps에 포함됩니다. `highlightedEdgeIds`가 변경될 때마다 `isFocusActive`도 동시에 변경되므로 실질적으로 중복 트리거가 발생합니다. 심각한 버그는 아니지만 `highlightedEdgeIds`만 deps에 남기고 `isFocusActive`는 memo 내부에서 파생하는 것이 논리적으로 명확합니다.

---

## 요약

변경된 코드는 React/JavaScript 싱글 스레드 환경에서 동작하므로 전통적인 멀티스레드 동시성 문제(데드락, 뮤텍스 등)는 해당하지 않습니다. 그러나 React의 비동기 렌더링 특성에서 발생하는 동시성 문제가 존재합니다. 가장 중요한 이슈는 **workflow 로딩 시 취소 로직 부재**로, `workflowId`가 빠르게 변경되는 시나리오(예: 사용자가 다른 워크플로우로 빠르게 전환)에서 오래된 데이터가 최신 상태를 덮어쓸 수 있습니다. 두 번째로 `nodeRectsSelector`의 참조 불안정성은 모든 엣지의 불필요한 재렌더링을 유발하여 React 18 concurrent 렌더링 환경에서 시각적 글리치의 원인이 됩니다.

## 위험도
**MEDIUM**