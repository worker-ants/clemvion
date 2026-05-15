## 발견사항

### [INFO] `execute` 메서드의 `async` 제거 — 동시성 관점 무영향
- 위치: `carousel.handler.ts`, `execute` 메서드
- 상세: `async execute()`를 `execute()`로 변경 후 `Promise.resolve()`로 래핑. 내부에 `await`가 없었으므로 실질적으로 항상 동기 실행이었음. 변경 전후 이벤트 루프 블로킹 여부가 동일하며, 문제없음.
- 제안: 현 구조 유지 적절.

### [WARNING] `presentation-configs.tsx` — 스테일 클로저(Stale Closure) 위험
- 위치: `CarouselConfig`, `addItem` / `removeItem` / `updateItem` 콜백
- 상세: 세 함수 모두 렌더 시점에 캡처된 `items` (= `config.items`)를 기반으로 새 배열을 계산한 뒤 `onChange`를 호출한다. 부모가 React `useState`를 사용하면서 함수형 업데이트(`setState(prev => ...)`)가 아닌 직접 값 업데이트(`setState(newVal)`)를 쓰는 경우, 사용자가 "Add Item"을 빠르게 연속 클릭하거나 React 18 Concurrent Mode에서 렌더링이 지연되면 이전 `items` 스냅샷을 기반으로 덮어쓰기가 발생해 추가된 아이템이 소실될 수 있다.
  ```tsx
  // 현재
  const addItem = () =>
    onChange({ ...config, items: [...items, { title: "", ... }] });
  // 여기서 items는 렌더 시점에 고정된 값
  ```
  단, `config`가 prop으로 내려오므로 부모의 상태 관리 방식에 의존적이다. 이 컴포넌트 단독으로는 수정 불가.
- 제안: 부모 컴포넌트에서 `config` 상태를 `useState`로 관리할 때 함수형 업데이트를 사용하도록 권고. 또는 `onChange`에 updater 패턴(`(prev) => newConfig`)을 지원하는 타입으로 변경.

### [INFO] 테스트 파일 변경 — 동시성 관점 무영향
- 위치: `execution-engine.service.spec.ts`
- 상세: ESLint 주석 정리만 이루어짐. `flushPromises()`를 통한 비동기 실행 플러시 패턴은 적절하며, 테스트 격리도 `beforeEach`로 보장됨.

---

## 요약

변경된 코드 전반은 동시성 측면에서 대체로 안전하다. `CarouselHandler.execute()`는 순수 동기 연산으로 공유 상태가 없고, 테스트 변경은 ESLint 주석 조정에 불과하다. 유일한 주의 사항은 `CarouselConfig` React 컴포넌트의 배열 업데이트 콜백이 렌더 클로저에 캡처된 `items`를 사용한다는 점으로, 부모가 직접값 방식의 `setState`를 쓸 경우 연속 클릭 시 갱신 누락이 발생할 수 있다. 그러나 이는 이 컴포넌트 자체의 결함이 아닌 부모 계약의 문제이므로, 현재 변경 범위에서의 위험도는 낮다.

### 위험도
**LOW**