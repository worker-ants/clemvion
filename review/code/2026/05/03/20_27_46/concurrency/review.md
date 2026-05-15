### 발견사항

- **[INFO]** `graph-3d-renderer.tsx` — `fgRef.current` 를 effect 실행 시점에 캡처
  - 위치: `graph-3d-renderer.tsx:100-108`
  - 상세: `useEffect` 내에서 `const fg = fgRef.current` 로 캡처 후 1200ms 타이머 안에서 사용한다. 타이머가 실행되기 전에 `ForceGraph3D` 가 내부 ref 를 교체하면(라이브러리 내부 재마운트 등) `fg` 가 stale 해진다. cleanup 에서 `clearTimeout` 으로 이전 타이머를 취소하고, `graphData` 가 의존성이므로 데이터 변경 시 재실행되어 실질적 위험은 낮지만, 라이브러리 내부 구현에 암묵적으로 의존하는 패턴이다.
  - 제안: 타이머 콜백 내에서 `fgRef.current` 를 직접 읽도록 변경하면 stale 참조 가능성을 완전히 제거할 수 있다.
    ```tsx
    const timer = window.setTimeout(() => {
      fgRef.current?.zoomToFit(400, 60);
    }, 1200);
    ```

- **[INFO]** `graph-visualization.tsx` — ResizeObserver 콜백과 React 상태 업데이트 경계
  - 위치: `graph-visualization.tsx:55-64`
  - 상세: `ResizeObserver` 콜백에서 `setWidth` 를 호출한다. cleanup(`ro.disconnect()`) 이 실행된 직후 이미 큐에 들어간 콜백이 처리될 경우 언마운트된 컴포넌트에 state update 가 발생할 수 있다. React 18 에서는 이를 자동으로 무시하므로 실질적 버그는 없으나, 구형 React 버전 포팅 시 경고가 생길 수 있다.
  - 제안: React 18 환경이 보장되므로 현재 코드는 안전하다. 추가 방어가 필요하다면 `let active = true` 플래그를 cleanup 에서 `false` 로 설정하고 콜백 안에서 확인하는 패턴을 적용할 수 있다.

- **[INFO]** `graph-visualization.tsx` — `width === 0` 일 때 Graph3DRenderer 미마운트
  - 위치: `graph-visualization.tsx:113`
  - 상세: `width > 0` 조건으로 렌더를 막는 설계는 올바르다. ResizeObserver 가 항상 비동기(`queueMicrotask` 또는 브라우저 paint 후)이므로 첫 렌더 사이클에는 그래프가 표시되지 않는 짧은 공백이 존재하지만, 이것은 의도된 동작이며 3D 라이브러리에 0px 캔버스를 넘기는 것보다 안전하다.

---

### 요약

이번 변경은 순수 브라우저 단일 스레드 환경에서 동작하는 React 컴포넌트 추가이며, 실질적인 동시성 위험은 낮다. ResizeObserver 와 `window.setTimeout` 두 비동기 패턴 모두 cleanup 에서 각각 `ro.disconnect()` 와 `clearTimeout` 으로 적절히 해제되어 있다. 유일한 주의점은 `fgRef.current` 를 effect 시점에 캡처해 1200ms 후 사용하는 stale closure 패턴으로, 타이머 콜백 내에서 직접 ref 를 읽도록 수정하면 완전히 해소된다.

### 위험도
LOW