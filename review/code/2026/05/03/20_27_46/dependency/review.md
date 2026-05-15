### 발견사항

- **[WARNING]** Three.js `^` semver — 잠재적 breaking change 허용
  - 위치: `frontend/package.json` — `"three": "^0.184.0"`
  - 상세: Three.js는 `0.x` 체계를 사용하지만 minor 버전 간 breaking API 변경이 빈번하다. `^0.184.0`은 `0.185`, `0.186` 등으로 자동 업데이트를 허용하며, `react-force-graph-3d`의 peer dependency 범위(`>=0.179 <1`)와 misalign 될 수 있다.
  - 제안: `"three": "~0.184.0"` 으로 patch 단위만 허용하거나, 또는 세 패키지(`three`, `three-spritetext`, `react-force-graph-3d`)의 three.js 호환 버전을 명시적으로 검증한 뒤 `0.184.x` 범위로 고정.

- **[WARNING]** Preact가 프로덕션 번들에 포함
  - 위치: `node_modules/float-tooltip` → `preact@10.29.1`
  - 상세: `three-render-objects` → `float-tooltip` → `preact`로 이어지는 전이 의존성 체인으로 React 프로젝트에 Preact (~3KB gzip)가 프로덕션 청크에 포함된다. 두 번째 UI 렌더링 런타임이 생기는 구조.
  - 제안: `react-force-graph-3d` 측에서 `float-tooltip`을 교체하거나 별도로 tooltip을 구현하는 것이 이상적이나, 단기적으로는 번들 분석(next-bundle-analyzer)으로 실제 포함 여부 확인 후 필요 시 커스텀 tooltip으로 교체.

- **[INFO]** Three.js 번들 크기 영향
  - 위치: `frontend/package.json` — `react-force-graph-3d`, `three`, `three-spritetext`
  - 상세: Three.js 자체가 ~600KB(minified), ~150KB(gzip) 수준이며, `three-forcegraph`, `three-render-objects`, `d3-force-3d` 등 전이 의존성까지 합산하면 이 기능 전용 청크가 상당히 크다. 다만 `next/dynamic` + `ssr: false`로 코드 분리가 올바르게 적용되어 있어 초기 번들에는 포함되지 않는다.
  - 제안: `next-bundle-analyzer`로 청크 크기를 측정하고, three.js `import *` 대신 필요한 클래스만 직접 import하는 tree-shaking 최적화 검토.

- **[INFO]** `@tweenjs/tween.js` 두 버전 공존
  - 위치: `node_modules/@tweenjs/tween.js@25.0.0` (프로덕션) vs `node_modules/@types/three/node_modules/@tweenjs/tween.js@23.1.3` (dev 중첩)
  - 상세: `@types/three`가 `~23.1.3`을 요구해 중첩 설치된다. `@types/three`는 dev 의존성이므로 프로덕션 빌드에는 v25만 포함되어 실질적 영향은 없다.
  - 제안: 현재 구조 무해. 문서화 목적으로 `package.json`에 `overrides` 추가는 불필요.

- **[INFO]** `lodash-es` 전이 의존성 추가
  - 위치: `kapsule@1.16.3` → `lodash-es@4.18.1`
  - 상세: `kapsule`이 전체 `lodash-es` 패키지를 의존성으로 선언하나 실제 사용량은 일부 유틸리티 함수에 불과하다. Tree-shaking이 가능하지만 번들러 설정에 따라 전체가 포함될 수 있다.
  - 제안: 빌드 결과물에서 lodash-es 포함 범위 확인. 별도 조치 없이 유지 가능.

- **[INFO]** `@babel/runtime`, `js-tokens`, `loose-envify`, `prop-types` — dev→production 재분류
  - 위치: `package-lock.json` 다수 항목의 `"dev": true` 제거
  - 상세: `polished` → `@babel/runtime`, `react-force-graph-3d` → `prop-types` → `loose-envify` → `js-tokens` 체인으로 런타임 의존성이 됨. 분류 변경 자체는 정확하다.
  - 제안: 이상 없음.

- **[INFO]** 라이선스 적합성
  - 신규 의존성 전체: MIT (`react-force-graph-3d`, `three`, `three-spritetext`, `kapsule`, `lodash-es`, `tinycolor2`, `preact`), BSD-3-Clause (`ngraph.*`), ISC (`d3-quadtree`), Apache-2.0 (`@dimforge/rapier3d-compat` — dev only)
  - 모두 permissive 라이선스로 프로젝트와 호환 이상 없음.

---

### 요약

3D 그래프 시각화를 위해 `react-force-graph-3d` + `three` 스택을 도입한 변경이다. 기술적 필요성은 명확하고, SSR 우회를 위한 `next/dynamic` + `ssr: false` 처리가 올바르게 적용되어 초기 번들 오염은 방지된다. 가장 주의할 점은 **Three.js의 `^` semver** — minor 버전 간 breaking change가 잦은 라이브러리이므로 `~0.184.0`으로 제한하거나 lockfile을 팀 전체가 공유해 버전을 통제해야 한다. 부차적으로 `float-tooltip`이 끌어오는 **Preact 의존성**은 구조적으로 이질적이나 크기 영향은 작다. 번들 크기 자체는 lazy chunk 분리로 허용 범위 내이나, 배포 후 chunk analyzer로 실측값을 검증하는 것을 권장한다.

### 위험도

**LOW**