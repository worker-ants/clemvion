### 발견사항

---

- **[WARNING]** API 응답 데이터가 3D 라벨/툴팁에 직접 삽입
  - 위치: `graph-3d-renderer.tsx:88` (`nodeThreeObject`), `:105` (`linkLabel`)
  - 상세: `n.label`, `l.predicate` 등은 Knowledge Base 문서에서 LLM이 추출한 entity/relation 값이다. `nodeThreeObject`의 `SpriteText`는 Canvas 2D API로 렌더하므로 직접적인 DOM XSS는 없다. 그러나 `linkLabel={(l) => l.predicate}`는 `react-force-graph-3d` 내부에서 DOM tooltip(`title` attribute 또는 floating div)으로 렌더될 가능성이 있다 — 라이브러리 버전에 따라 `innerHTML` 경로를 거치는 경우 XSS로 이어질 수 있다.
  - 제안: `l.predicate` 값을 `DOMPurify.sanitize()` (이미 의존성에 포함되어 있음 — `frontend/package.json`에 `dompurify`)로 정제 후 전달. `nodeThreeObject` 라벨도 동일 적용.

---

- **[WARNING]** 대규모 전이 의존성 추가 (supply-chain surface 확대)
  - 위치: `package-lock.json` — 신규 19개 패키지 추가
  - 상세: `three`, `react-force-graph-3d`, `three-spritetext` 세 패키지가 추가되었으나, 전이 의존성으로 `@dimforge/rapier3d-compat` (WASM 바이너리), `ngraph.*` 5개 패키지, `polished`, `preact`, `jerrypick`, `kapsule`, `lodash-es`, `tinycolor2` 등이 함께 설치된다. 특히 `@dimforge/rapier3d-compat`은 Rust로 컴파일된 WebAssembly 바이너리를 포함하며, `@types/three`의 런타임 의존성으로 잘못 분류되어 있다(`dev: true`이지만 실제로는 타입 정의를 위한 목적).
  - 제안: `npm audit`을 CI 파이프라인에 포함시키고, `@types/three`의 WASM 전이 의존성이 프로덕션 번들에 포함되지 않는지 번들 분석(`next build --analyze`)으로 확인.

---

- **[INFO]** `lodash-es` 4.18.1 — prototype pollution 패치 버전 확인 필요
  - 위치: `package-lock.json` (`node_modules/lodash-es`)
  - 상세: `lodash`는 CVE-2019-10744(prototype pollution), CVE-2020-8203(command injection via template) 등이 알려져 있다. `lodash-es` 4.18.1이 해당 패치를 포함하는지 명시적으로 검증이 필요하다. 패키지 매니저가 보고하는 semver만으로는 판단하기 어렵다.
  - 제안: `npm audit`으로 `lodash-es` CVE 여부 확인. 직접 사용 코드가 없으므로(`kapsule`의 전이 의존성) 업스트림 업데이트 대기.

---

- **[INFO]** `TYPE_COLOR` 상수 이중 정의 — 보안 지시자 불일치 가능성
  - 위치: `graph-visualization.tsx:16–23`, `graph-3d-renderer.tsx:16–23`
  - 상세: 두 파일에 완전히 동일한 `TYPE_COLOR` 맵이 각각 정의되어 있다. 현재는 동기화되어 있지만, 한쪽만 수정되면 legend(UI)와 실제 3D 노드 색상이 달라져 사용자가 entity type 판별을 잘못하는 시각적 보안 혼동이 발생한다.
  - 제안: 공통 모듈(`lib/constants/graph.ts`)로 추출하여 단일 진실 소스로 관리.

---

- **[INFO]** WebGL 리소스 명시적 해제(dispose) 없음
  - 위치: `graph-3d-renderer.tsx` — 컴포넌트 unmount 핸들러 없음
  - 상세: THREE.js `Geometry`, `Material`, `Texture` 객체는 GC로 자동 해제되지 않는다. `SpriteText`가 생성하는 canvas texture 및 force-graph 내부 WebGL 버퍼가 컴포넌트 unmount 시 누적되면 GPU 메모리 소진 → 탭/브라우저 크래시로 이어질 수 있다. 악의적인 사용자가 KB graph 탭을 반복 진입/이탈하여 의도적으로 유발하는 자원 고갈 패턴의 가능성이 있다.
  - 제안: `useEffect` cleanup에서 `fgRef.current` 내부 scene object dispose 호출 또는 라이브러리의 공식 dispose API 사용 여부 확인.

---

### 요약

이번 변경은 2D React Flow를 three.js 기반 3D 그래프로 교체한 것으로, 직접적인 고위험 취약점(하드코딩 시크릿, SQL/커맨드 인젝션, 인증 우회)은 없다. 주요 위험은 두 가지다: ① Knowledge Base 문서에서 추출된 사용자 기여 데이터(`predicate`, entity `label`)가 `linkLabel` 등 라이브러리 내부 DOM 경로를 통해 렌더될 경우 XSS가 가능하며, 이미 프로젝트에 포함된 `dompurify`를 활용하면 즉시 완화 가능하다; ② 전이 의존성이 19개 이상 대폭 증가하여 supply-chain 공격 표면이 넓어졌고, 그 중 WASM 바이너리(`rapier3d-compat`)가 dev dep 경로로 포함된 점은 CI `npm audit` 및 번들 분석을 통해 지속 모니터링이 필요하다.

### 위험도

**LOW**