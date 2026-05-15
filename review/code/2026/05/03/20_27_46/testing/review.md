### 발견사항

- **[WARNING]** `graph-3d-renderer.tsx`에 대한 테스트가 전혀 없음
  - 위치: `graph-3d-renderer.tsx` 전체
  - 상세: `onNodeClick`의 카메라 거리 계산 수식(`distRatio = 1 + distance / radius`), `zoomToFit` 1200ms 타이머, `nodeThreeObject` sprite 생성 등 핵심 로직이 완전히 커버되지 않음. `Graph3DRenderer`는 `dynamic()`으로 lazy-load되어 부모 테스트에서 mock으로 대체되므로 이 컴포넌트의 내부 동작은 테스트 스위트 어디서도 실행되지 않음
  - 제안: `graph-3d-renderer.test.tsx`를 별도 생성해 `vi.useFakeTimers()`로 타이머를 제어하고, `fgRef.current.zoomToFit`·`cameraPosition`이 호출되는지 검증. three.js 객체 생성은 `SpriteText`를 mock해 테스트 가능

- **[WARNING]** `beforeEach`에서 교체한 전역 `ResizeObserver`를 `afterEach`에서 복원하지 않음
  - 위치: `graph-visualization.test.tsx:31-56`
  - 상세: `globalThis.ResizeObserver`를 mock으로 덮어쓴 뒤 원본을 저장·복원하지 않아 같은 process에서 이후 실행되는 다른 테스트 파일에 mock이 누출될 수 있음
  - 제안:
    ```ts
    let originalResizeObserver: typeof ResizeObserver;
    beforeEach(() => {
      originalResizeObserver = globalThis.ResizeObserver;
      globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    });
    afterEach(() => {
      globalThis.ResizeObserver = originalResizeObserver;
    });
    ```

- **[WARNING]** API 에러 상태(reject)에 대한 테스트 누락
  - 위치: `graph-visualization.test.tsx` - 테스트 케이스 부재
  - 상세: `getGraphVisualization`이 reject될 때 컴포넌트 렌더링 결과가 검증되지 않음. `QueryClient`의 `retry: false` 설정으로 즉시 에러 상태로 전이되지만, 그 상태의 UI가 어떻게 보여야 하는지(빈 상태인지, 에러 메시지인지)에 대한 의도 기록이 없음
  - 제안: `apiMock.getGraphVisualization.mockRejectedValue(new Error("500"))` 케이스 추가

- **[WARNING]** limit 변경 인터랙션 테스트 누락
  - 위치: `graph-visualization.tsx:44-48` (NativeSelect onChange), 테스트 없음
  - 상세: 사용자가 limit을 20→100으로 변경하면 `queryKey`가 바뀌어 새 API 호출이 발생함. 이 사용자 플로우가 전혀 검증되지 않음
  - 제안: `userEvent.selectOptions`로 NativeSelect 값을 변경 후 `getGraphVisualization`이 새 limit로 재호출됐는지 확인하는 테스트 추가

- **[INFO]** `width === 0` 구간의 null 렌더 동작이 명시적으로 테스트되지 않음
  - 위치: `graph-visualization.tsx:112` (`width > 0 ? ... : null`)
  - 상세: 데이터가 로드됐으나 ResizeObserver가 아직 width를 보고하지 않은 구간(`width === 0`)에서 그래프 영역이 `null`을 렌더함. "shows loader" 테스트가 간접적으로 이를 커버하지만, 데이터 준비 완료 + width=0 조합의 의도적 검증은 없음

- **[INFO]** `zoomToFit` 1200ms 타이머가 테스트 환경에서 검증 불가
  - 위치: `graph-3d-renderer.tsx:97-103`
  - 상세: 실제 `Graph3DRenderer`가 마운트됐을 때 `zoomToFit`이 올바르게 호출되는지 현재 테스트 체계에서 확인할 방법이 없음. 1200ms는 실제 timer이므로 `vi.useFakeTimers()` 없이는 검증 불가

- **[INFO]** `next/dynamic` mock 신뢰성
  - 위치: `graph-visualization.test.tsx:7-28` 주석 참조
  - 상세: 테스트 주석에서 "vitest 기본 동작상 즉시 resolve 된다"고 기술하고 있으나, 이는 vitest 버전 및 설정에 따라 달라질 수 있는 비공식적인 동작. `next/dynamic`이 업데이트될 경우 이 가정이 깨질 수 있음. 명시적으로 `next/dynamic`을 mock해두는 것이 더 안정적

---

### 요약

`graph-visualization.tsx`에 대한 테스트는 loading/empty/data/truncated 등 핵심 상태를 잘 커버하며, WebGL 환경 제약을 `vi.mock` + `ResizeObserver` mock으로 깔끔하게 우회한 설계는 적절하다. 단, 실제 3D 렌더링 로직을 담은 `graph-3d-renderer.tsx`가 테스트 밖에 있어 카메라 이동 수식·타이머 로직 등 버그 발생 시 자동 감지가 불가능한 사각지대가 존재한다. 전역 mock 복원 누락은 테스트 격리를 위협하는 실질적 위험이며, API 에러와 limit 변경 플로우의 테스트 누락도 보완이 필요하다.

### 위험도

**MEDIUM**