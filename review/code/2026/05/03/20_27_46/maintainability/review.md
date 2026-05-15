### 발견사항

---

**[WARNING] `TYPE_COLOR` 상수 중복 정의**
- 위치: `graph-visualization.tsx:16-23` / `graph-3d-renderer.tsx:18-26`
- 상세: 두 파일에 동일한 `Record<EntityType, string>` 맵이 복사되어 있고, 주석도 "동일 (graph-3d-renderer.tsx 의 TYPE_COLOR)"이라고 직접 언급함. entity 타입 추가나 색상 변경 시 두 파일을 함께 수정해야 하는 산포(scatter) 발생.
- 제안: `src/components/knowledge-base/graph-constants.ts` 같은 공유 모듈로 추출해 양쪽에서 import.

---

**[WARNING] `"#0b0d12"` 배경색 하드코딩 중복**
- 위치: `graph-visualization.tsx:106` / `graph-3d-renderer.tsx:99` (`backgroundColor="#0b0d12"`)
- 상세: 캔버스 배경색이 두 파일에 각각 inline으로 박혀 있음. 색상을 바꾸려면 두 곳을 동시에 고쳐야 함.
- 제안: 위의 공유 상수 파일에 `GRAPH_BG_COLOR = "#0b0d12"` 로 추출.

---

**[WARNING] 렌더링 파라미터 매직 넘버 다수 (`graph-3d-renderer.tsx`)**
- 위치: `graph-3d-renderer.tsx:94–153`
- 상세: `1200`(zoomToFit 대기), `400`/`60`(zoomToFit 인자), `nodeRelSize=5`, `*2` 배율, `opacity=0.92`, sprite `padding=2`/`borderRadius=3`/`textHeight=4`/Y오프셋 `8`, `linkWidth` 상한 `4`/계수 `0.4`, 카메라 이동 `distance=60`/`1000ms` 등 의미 불명의 숫자가 props에 직접 산재. 특히 sprite Y오프셋 `8`은 `nodeRelSize`, `nodeVal` 배율과 암묵적으로 연동되어 어느 한 쪽을 조정하면 라벨 위치가 어긋나는 숨겨진 결합이 있음.
- 제안: 상단에 named constant 블록으로 묶거나, 최소한 `CAMERA_ZOOM_SETTLE_MS`, `LABEL_Y_OFFSET`, `NODE_BASE_SIZE` 등 의도를 드러내는 이름 부여.

---

**[WARNING] i18n 우회 — 하드코딩된 UI 문자열**
- 위치: `graph-visualization.tsx:30` (`"Loading 3D graph…"`), `graph-visualization.tsx:131` (`"드래그로 회전 · 휠로 줌 · 노드 클릭 시 카메라 이동"`)
- 상세: 같은 컴포넌트 내 다른 모든 문자열은 `t()` 를 사용하는데 두 곳만 raw string으로 고정되어 있음. 다국어 지원 또는 문자열 관리 시점에 누락 위험.
- 제안: i18n 키 추가 (`knowledgeBases.graph3dLoading`, `knowledgeBases.graph3dUsageHint`) 후 `t()` 로 교체.

---

**[WARNING] `fgRef` 타입이 React 관례와 불일치**
- 위치: `graph-3d-renderer.tsx:64` (`useRef<Graph3DMethodsRef | undefined>(undefined)`)
- 상세: React의 `useRef` 관례는 mutable ref에 `null`을 초깃값으로 사용. `undefined`로 초기화하면 이후 `if (!fg)` null-guard가 의미론적으로 `undefined`와 `null`을 동시에 잡고 있어 타입 의도가 흐릿해짐.
- 제안: `useRef<Graph3DMethodsRef | null>(null)` 으로 정렬.

---

**[INFO] 대형 의존성 번들 영향 — `three` (≈600KB)**
- 위치: `package.json` dependencies
- 상세: `three` + `react-force-graph-3d` + `three-spritetext` + 전이 의존성이 production bundle에 들어감. 현재 `next/dynamic ssr:false` 로 초기 페이로드에서 분리되어 있어 최악의 상황은 방지되어 있으나, 3D 뷰가 선택적 기능(P2)임을 고려하면 route 수준 lazy loading이 아닌 component 수준에 머무르는 점은 확인 필요.
- 제안: 현 구조(dynamic import)가 맞음. 단, Next.js bundle analyzer로 chunk 크기 확인 권장.

---

**[INFO] 멀티라인 JSDoc 블록 — 프로젝트 컨벤션 위반**
- 위치: `graph-3d-renderer.tsx:50–62`
- 상세: CLAUDE.md 규약 "multi-line comment blocks 금지 — 한 줄 이내"를 어기는 8줄 블록 주석이 있음. 내용이 코드 구조(dynamic import 이유, 디자인 결정)로 가치 있으나 형식 기준을 초과.
- 제안: 요약 한 줄만 남기고 나머지는 PR description 또는 spec 문서로 이동 (spec은 이미 `5-knowledge-base.md` 에 잘 기술되어 있음).

---

**[INFO] `loading` placeholder 의 i18n 비일관 (dynamic import)**
- 위치: `graph-visualization.tsx:28-34`
- 상세: `next/dynamic` `loading` 옵션은 모듈 스코프에서 선언되어 `t()` hook 호출 불가. 현재 구조에서는 해결이 비자명함.
- 제안: `loading` prop 대신 컴포넌트 내부 Suspense fallback으로 이동하거나, 로딩 문자열을 별도 i18n-safe wrapper 컴포넌트로 분리.

---

### 요약

전반적인 구조는 잘 설계되어 있다 — SSR 안전 처리(dynamic + ssr:false), ResizeObserver 기반 반응형 width, 테스트의 WebGL mock 전략, spec 업데이트 모두 적절하다. 핵심 유지보수 위험은 두 파일에 걸친 `TYPE_COLOR` 중복과 `"#0b0d12"` 배경색 중복으로, 현재는 주석으로 동기화를 경고하고 있지만 이는 코드가 아닌 사람에 의존하는 방식이다. 추가로 렌더링 파라미터 매직 넘버가 10개 이상 흩어져 있어 3D 레이아웃 튜닝 시 숫자 간 암묵적 결합을 추적하기 어렵고, i18n 우회 문자열 2곳이 향후 다국어 작업에서 누락될 가능성이 있다.

### 위험도

**LOW**