### 발견사항

- **[WARNING]** `TYPE_COLOR` 상수 중복 정의
  - 위치: `graph-visualization.tsx:14-22`, `graph-3d-renderer.tsx:17-24`
  - 상세: 동일한 entity type → hex color 매핑이 두 파일에 독립적으로 존재한다. legend와 3D 노드 material이 "시각적으로 동일해야 한다"는 불변 조건이 코드상 강제되지 않는다. 새 entity type(`product` 등) 추가 시 두 파일을 모두 수정해야 하며, 한 쪽만 변경되면 legend ↔ 노드 색상 불일치가 무음으로 발생한다.
  - 제안: `@/lib/api/knowledge-bases` 또는 전용 `graph-constants.ts` 파일로 추출하고 두 컴포넌트가 import하도록 단일화.

- **[WARNING]** `width === 0` guard로 인한 빈 프레임 노출
  - 위치: `graph-visualization.tsx:70-74` (`width > 0 ? <Graph3DRenderer … /> : null`)
  - 상세: `ResizeObserver` 콜백이 첫 마이크로태스크 이후에야 실행되므로, 데이터가 이미 도착했어도 width 측정 전까지 컨테이너가 완전히 빈 상태(어두운 배경만)로 표시된다. `dynamic` loading placeholder와 이 blank 상태가 순차적으로 보여 사용자에게 두 번의 상태 전환이 노출된다.
  - 제안: `containerRef`에 `ref callback`을 사용해 마운트 즉시 `getBoundingClientRect().width`로 초기값을 설정하거나, placeholder를 width=0 구간에도 유지해 빈 프레임을 숨긴다.

- **[INFO]** `zoomToFit` 지연 하드코딩 (`1200ms`)
  - 위치: `graph-3d-renderer.tsx:88-95`
  - 상세: physics simulation 수렴 시간에 맞춰 1200ms를 고정 대기한다. 노드가 많거나 저사양 기기에서는 시뮬레이션이 아직 불안정한 상태에서 `zoomToFit`이 호출될 수 있다. 반대로 노드가 적은 경우엔 불필요한 지연이다.
  - 제안: `react-force-graph-3d`의 `onEngineStop` 콜백을 활용해 시뮬레이션 수렴 후 호출하거나, 안정화 콜백이 없다면 `d3AlphaDecay`를 높여 수렴을 앞당기는 방향이 더 결정적이다.

- **[INFO]** `VIEWPORT_HEIGHT = 600` 고정값
  - 위치: `graph-visualization.tsx:45`
  - 상세: width는 `ResizeObserver`로 동적 측정하나 height는 600px로 고정되어 viewport 높이 변화에 반응하지 않는다. 두 축의 반응성이 비대칭이며, 높이도 컨테이너 기반으로 측정하려면 구조 변경이 필요하다. 현재 요구사항 범위에서는 허용 가능한 수준이나 추후 레이아웃 유연성 요구 시 수정 비용이 발생한다.
  - 제안: 요구사항이 고정 높이라면 상수에 명시적인 주석(`// 고정 스펙`) 추가. 반응형이 필요하다면 height도 ResizeObserver로 측정.

- **[INFO]** three.js 번들 크기 (런타임 의존성 분류는 적절)
  - 위치: `package.json` dependencies
  - 상세: `three@0.184.0`은 비압축 약 1.1MB, gzip 약 300KB 규모이다. `next/dynamic({ ssr: false })`로 code-split 되어 Knowledge Base 그래프 화면 진입 시에만 로드되므로 초기 번들 영향은 없다. 다만 three.js 전체가 청크에 포함되므로 트리셰이킹 효과가 제한된다.
  - 제안: 현재 구조로 허용 범위 내. 향후 성능 회귀 발생 시 `three/examples/jsm` 대신 subpath import로 필요한 클래스만 import하는 방향 검토.

---

### 요약

전체 아키텍처는 견고하다. `graph-visualization.tsx`(데이터 패칭·레이아웃 오케스트레이션)와 `graph-3d-renderer.tsx`(three.js 렌더링)의 책임 분리가 명확하며, `next/dynamic ssr:false`를 통한 SSR 회피와 `ResizeObserver`를 통한 반응형 width 전달은 이 종류의 WebGL 컴포넌트에서 올바른 패턴이다. 가장 실질적인 유지보수 위험은 `TYPE_COLOR`의 이중 정의로, 공유 상수 파일 하나로 해결할 수 있다. 나머지 발견사항은 UX 품질이나 엣지 케이스에 관한 것으로 기능 정확성을 위협하지 않는다.

### 위험도

**LOW**