### 발견사항

---

**[WARNING] Three.js SpriteText 객체 미해제 → WebGL 메모리 누수 가능**
- 위치: `graph-3d-renderer.tsx` – `nodeThreeObject` 콜백
- 상세: `nodeThreeObject`는 그래프가 갱신될 때마다 `new SpriteText(…)`를 호출한다. Three.js의 텍스처·머테리얼·지오메트리는 GC 대상이 아니라 `dispose()`를 명시 호출해야 GPU 메모리를 회수한다. `react-force-graph-3d`가 내부적으로 이전 three object를 dispose하는지 공식 문서에 명시되어 있지 않아, 데이터가 자주 교체되는 시나리오(limit 변경 등)에서 WebGL 컨텍스트 메모리가 누적될 수 있다.
- 제안: `nodeThreeObject` 결과를 캐시하거나, 컴포넌트 언마운트 시 `fgRef.current` 에서 접근 가능한 Three.js `renderer.dispose()` 호출을 `useEffect` cleanup에 추가한다.

---

**[WARNING] `@xyflow/react` CSS import 제거 — 다른 React Flow 사용처 영향 가능**
- 위치: `graph-visualization.tsx` diff (제거된 줄: `import "@xyflow/react/dist/style.css"`)
- 상세: `@xyflow/react`는 여전히 `package.json` 의존성에 남아 있고 워크플로우 캔버스 등 다른 곳에서 사용 중일 가능성이 높다. 만약 이 파일이 해당 CSS의 유일한 진입점이었다면, 다른 React Flow 컴포넌트의 스타일이 깨진다. 단, 통상적으로 워크플로우 에디터 컴포넌트 자체에 해당 import가 별도로 있을 것이므로 실제 영향은 낮을 것으로 추정된다.
- 제안: `@xyflow/react` 를 사용하는 다른 컴포넌트(워크플로우 에디터)에 CSS import가 존재하는지 확인 후, 없다면 글로벌 layout이나 해당 컴포넌트에 추가한다.

---

**[INFO] `width === 0` 구간에서 3D 그래프 미렌더 — 짧은 빈 화면 플래시**
- 위치: `graph-visualization.tsx:69–71` (`width > 0 ? <Graph3DRenderer …> : null`)
- 상세: 마운트 직후 `ResizeObserver` 콜백이 비동기(마이크로태스크)로 실행되므로, 데이터가 캐시에서 즉시 반환될 경우 로딩 스피너도 없고 그래프도 없는 빈 화면이 한 프레임 존재한다. 기능적으로 문제는 아니지만 UX 플릭이 있다.
- 제안: `width === 0` 일 때도 `dynamic` loading placeholder가 표시되도록 `null` 대신 `<Graph3DRenderer loading />` 혹은 별도 스켈레톤 처리를 고려한다.

---

**[INFO] `TYPE_COLOR` 이중 정의 — 두 파일 간 동기화 위험**
- 위치: `graph-visualization.tsx:15–22`, `graph-3d-renderer.tsx:17–24`
- 상세: 동일한 legend 색상 맵이 두 파일에 복사되어 있다. 한쪽만 수정할 경우 legend 색상과 실제 노드 색상이 어긋난다.
- 제안: 공통 상수 파일(`constants/entity-colors.ts`)로 추출하거나, `graph-3d-renderer`에서 export해 `graph-visualization`이 import하도록 단일화한다.

---

**[INFO] `@babel/runtime`, `js-tokens`, `loose-envify`, `prop-types`, `object-assign` — `dev: true` 플래그 제거**
- 위치: `package-lock.json` diff (여러 패키지)
- 상세: `polished` (← `three-render-objects` ← `react-force-graph-3d`) 가 `@babel/runtime`을 production 의존성으로 요구해 npm이 기존 dev-only 항목을 production으로 격상했다. 번들 크기에 미미한 영향이 있지만, 의도된 자동 해결이다.
- 제안: 별도 조치 불필요.

---

**[INFO] `@tweenjs/tween.js` 두 버전 공존 (25.0.0 / 23.1.3)**
- 위치: `package-lock.json` — `node_modules/@tweenjs/tween.js` vs `node_modules/@types/three/node_modules/@tweenjs/tween.js`
- 상세: `three-render-objects`는 `18 - 25` 범위로 25.0.0을 설치하고, `@types/three`는 타입 정의 목적으로 23.1.3을 별도 중첩 설치한다. 런타임에는 25.0.0만 사용되므로 기능 문제는 없다.
- 제안: 별도 조치 불필요.

---

### 요약

이번 변경의 핵심은 React Flow 2D 그래프를 `react-force-graph-3d`/Three.js 기반 3D로 교체한 것이다. SSR 안전 처리(`next/dynamic + ssr: false`), ResizeObserver 정리, zoomToFit 타이머 cleanup 등 주요 사이드 이펙트 경로는 대부분 올바르게 처리되어 있다. 가장 주목할 점은 `nodeThreeObject`에서 생성되는 SpriteText의 미해제로 인한 잠재적 WebGL 메모리 누수이며, `@xyflow/react` CSS 제거가 다른 React Flow 사용처에 영향을 주는지 확인이 필요하다. 나머지는 번들 증가(dynamic import로 완화) 및 유지보수 우려 수준이다.

### 위험도

**LOW**