### 발견사항

- **[INFO]** 모듈 수준 `carouselItemId` 가변 카운터
  - 위치: `presentation-configs.tsx` — `let carouselItemId = 0;`
  - 상세: 모듈 싱글턴 변수로, 여러 `CarouselConfig` 인스턴스가 동시에 마운트될 경우 ID가 공유됩니다. JavaScript 단일 스레드 특성상 실제 경쟁 조건은 없지만, 여러 인스턴스 간 ID 충돌이 발생할 수 있습니다. 단, 이 ID는 React key로만 사용되므로 실제 기능 버그로 이어지지는 않습니다.
  - 제안: `useRef`로 인스턴스별 카운터를 유지하거나, `crypto.randomUUID()` 또는 `Date.now()` 기반으로 교체

- **[INFO]** `handleScroll`의 DOM 직접 조작 (동기)
  - 위치: `expression-input.tsx` — `handleScroll` 콜백
  - 상세: 스크롤 이벤트 핸들러에서 `highlightRef.current`의 `scrollTop/scrollLeft`를 동기적으로 직접 조작합니다. React의 렌더 사이클 밖에서 DOM을 직접 변경하는 방식으로, 잦은 스크롤 이벤트 발생 시 레이아웃 스래싱(layout thrashing)이 일어날 수 있습니다.
  - 제안: `requestAnimationFrame`으로 감싸 레이아웃 스래싱 완화를 고려할 수 있으나, 스크롤 동기화 특성상 오히려 지연이 생길 수 있으므로 현재 구현도 허용 가능한 트레이드오프입니다.

---

### 요약

변경된 코드는 순수 UI 레이어(React 컴포넌트, 유틸 함수)로, JavaScript 단일 스레드 환경에서 실행됩니다. 실질적인 경쟁 조건, 데드락, 비동기 오용 등의 동시성 문제는 없습니다. 모듈 수준 `carouselItemId` 카운터는 인스턴스 격리 측면에서 개선 여지가 있으나 기능 버그 수준은 아니며, `handleScroll`의 직접 DOM 조작도 의도된 패턴(스크롤 오버레이 동기화)으로 동시성 위험은 없습니다.

### 위험도
**NONE**