### 발견사항

- **[WARNING]** `nodeThreeObject` 콜백이 memoize되지 않아 ResizeObserver 이벤트마다 200개의 SpriteText 텍스처를 재생성
  - 위치: `graph-3d-renderer.tsx`, JSX 내 inline arrow function
  - 상세: `ResizeObserver` → `setWidth()` → `Graph3DRenderer` 리렌더 → `nodeThreeObject` 새 함수 참조 → `react-force-graph-3d` 내부의 kapsule이 prop 변경 감지 → `refreshThreeObjects()` 호출 → 200개 `SpriteText` 인스턴스 및 WebGL 캔버스 텍스처 전부 소각·재생성. 창 리사이즈 드래그 중 수십 회 반복될 수 있으며, GPU 메모리 스파이크와 GC 압력을 유발
  - 제안: `nodeThreeObject`, `nodeColor`, `nodeVal`, `linkColor`, `linkWidth`, `linkLabel`, `linkDirectionalArrowColor` 등 안정적인 모든 콜백을 `useCallback(() => {...}, [])` 으로 감싸거나, 컴포넌트 외부(모듈 스코프)에 상수 함수로 선언

- **[WARNING]** 번들 사이즈 ~600 KB(Three.js 단독) 증가
  - 위치: `package.json` — `three`, `react-force-graph-3d`, `three-spritetext`, `d3-force-3d`, `ngraph.*`, `kapsule`, `lodash-es`, `polished`, `tinycolor2`…
  - 상세: `next/dynamic` + `ssr: false`로 lazy load하므로 초기 HTML/JS 블로킹은 없지만, 사용자가 KB Graph 탭을 처음 열 때 ~600 KB+ 청크를 내려받아야 한다. 네트워크 조건이 나쁜 환경에서 체감 인터랙션 지연이 발생
  - 제안: Next.js route segment 수준으로 코드 스플리팅은 이미 되어 있으므로 추가 조치 불필요하나, `three/examples/jsm` 이하 사용 모듈을 named import로 제한하여 tree-shake를 유도할 수 있음; 현재 `import 'three'` 전체 번들은 ~160 KB gzip

- **[WARNING]** `zoomToFit` 1200 ms 하드코딩 타이머 — 그래프 크기와 무관
  - 위치: `graph-3d-renderer.tsx:93-97`, `useEffect`
  - 상세: force 시뮬레이션 안정화 시간은 노드/엣지 수에 따라 달라진다. 노드 200개 + 엣지 다수인 경우 1200 ms 안에 수렴하지 않아 줌이 잘못된 위치에서 실행될 수 있음; 반대로 노드 10개 미만은 불필요하게 느리다
  - 제안: `ForceGraph3D`의 `onEngineStop` 콜백(시뮬레이션 수렴 이벤트)을 사용하면 정확한 시점에 `zoomToFit` 호출 가능 — `setTimeout` 제거로 타이머 관련 메모리 보유 기간도 줄어듦

- **[INFO]** `TYPE_COLOR` 상수 중복 정의
  - 위치: `graph-visualization.tsx:14-21`, `graph-3d-renderer.tsx:17-24`
  - 상세: 동일 값이 두 파일에 복사되어 있어 sync 이탈 시 legend 색상과 실제 노드 색상이 불일치할 수 있음; 성능 영향은 없으나 불필요한 메모리 이중 점유
  - 제안: 공용 상수 모듈(`@/lib/constants/graph-colors.ts`)로 추출 후 양쪽에서 import

- **[INFO]** `ResizeObserver` 콜백에 debounce 없음
  - 위치: `graph-visualization.tsx:56-64`
  - 상세: `Math.floor(w)`로 소수점 변동은 차단했지만 창 리사이즈 시 `setWidth` 가 requestAnimationFrame 단위로 호출되어 연속 리렌더 발생. 위 WARNING 항목(`nodeThreeObject` 재생성)과 복합 작용
  - 제안: `ResizeObserver` 콜백 내부에 `requestAnimationFrame` 기반 단발성 flush 패턴 적용 — 단, WARNING의 `useCallback` 수정이 선행되면 리렌더 비용이 대폭 줄어 이 항목은 선택 사항

---

### 요약

이번 변경은 2D React Flow를 WebGL 기반 3D force-directed 그래프로 교체한 것으로, 200+ 노드 가독성 문제를 효과적으로 해결한다. 그러나 `nodeThreeObject`를 비롯한 핵심 콜백들이 `useCallback` 없이 인라인 정의되어 있어, ResizeObserver가 발동할 때마다 최대 200개의 WebGL 텍스처가 소각·재생성되는 심각한 GPU 과부하 경로가 열려 있다. Three.js 번들 크기(~600 KB)는 동적 lazy load로 초기 로드 영향은 제한적이나, 저사양 기기 또는 느린 네트워크에서는 탭 진입 시 지연이 체감될 수 있다. `useCallback` 적용과 `onEngineStop` 기반 zoomToFit으로 수정하면 런타임 성능이 크게 개선된다.

### 위험도

**MEDIUM**