### 발견사항

---

**[WARNING] `CardTitle` 시그니처 변경 — 기존 호출자 영향**
- 위치: `src/components/ui/card.tsx`
- 상세: `CardTitle`의 ref 타입이 `HTMLParagraphElement`에서 `HTMLHeadingElement`로 변경됨. 기존에 `ref`를 `HTMLParagraphElement`로 타입 캐스팅해서 사용하는 코드가 있다면 TypeScript 컴파일 에러 발생. 내부 기본 엘리먼트도 `h3`에서 dynamic `As` 컴포넌트로 변경되어 실제 DOM 구조가 다름.
- 제안: 프로젝트 전체에서 `CardTitle`에 `ref`를 직접 사용하는 코드가 있는지 확인 필요.

---

**[WARNING] `@radix-ui/react-focus-scope` devDependencies 배치 — 프로덕션 번들 누락 위험**
- 위치: `package.json` devDependencies, `src/components/ui/slide-drawer.tsx`
- 상세: `@radix-ui/react-focus-scope`가 `devDependencies`에만 선언됨. 그러나 `slide-drawer.tsx`는 프로덕션 컴포넌트이므로 `FocusScope`를 런타임에 요구함. Next.js 빌드 시 dev/prod 분리에 따라 프로덕션 빌드에서 모듈 해석 실패 가능성 있음.
- 제안: `@radix-ui/react-focus-scope`를 `dependencies`로 이동해야 함.

---

**[WARNING] `FocusScope trapped={open}` + `aria-hidden={!open}` 병용 — 닫힌 상태에서 포커스 트랩 잠재 충돌**
- 위치: `src/components/ui/slide-drawer.tsx:58-96`
- 상세: `aria-hidden={!open}` 설정 시 SR은 패널을 무시하지만, `FocusScope`는 `trapped={false}` 상태에서도 DOM에 존재하는 포커스 가능 요소를 여전히 포함함. 드로어가 닫혀있을 때(`open=false`) 패널이 `translate-x-full`로 화면 밖이어도 Tab 포커스가 해당 요소에 도달할 수 있음. Radix `FocusScope`의 `trapped={false}` 는 트랩을 해제하지만 포커스 이동을 막지는 않음.
- 제안: `open=false`일 때 `inert` 속성을 추가하거나 `tabIndex=-1`로 focusable 요소를 비활성화하는 방어 처리 필요.

---

**[WARNING] `schedules/page.tsx` — `title` + `aria-label` 중복 선언**
- 위치: `src/app/(main)/schedules/page.tsx:1064-1077`
- 상세: 수정된 편집/삭제 버튼에 `title`과 `aria-label`이 동일 번역 키로 중복 선언됨. 두 속성이 동시에 존재할 때 일부 스크린 리더가 `aria-label`만 읽지만 tooltip(title)도 함께 표시되는 혼선 가능성.
- 제안: `title` 속성은 제거하고 `aria-label`만 유지하거나 의도적 중복임을 주석으로 명시.

---

**[INFO] `axe-core` 버전 불일치 — 전이 의존성 버전 충돌**
- 위치: `package-lock.json`
- 상세: 최상위 `axe-core`가 `4.11.4`로 업그레이드(`devDependencies`)됐으나, `@axe-core/playwright`의 peerDependency는 `~4.11.4`(틸데 범위). 틸데 범위이므로 패치 업데이트(`4.11.x`)에서는 호환성 유지됨. 직접적인 부작용 없음.
- 제안: 문서화 수준의 체크로 충분.

---

**[INFO] `three` 의존성 범위 `^` → `~` 변경**
- 위치: `package.json`, `package-lock.json`
- 상세: `three`의 버전 범위가 `^0.184.0`(마이너까지 허용)에서 `~0.184.0`(패치만 허용)으로 좁혀짐. 부작용이 아닌 의도적 고정처럼 보이지만, 이 변경이 a11y PR에 포함된 이유가 명확하지 않음.
- 제안: 별도 커밋/PR로 분리하거나 변경 이유를 주석으로 남길 것.

---

**[INFO] `sidebar.tsx` — `<aside>` → `<nav>` 교체**
- 위치: `src/components/layout/sidebar.tsx`
- 상세: `<aside>`(보조 콘텐츠 landmark)가 `<nav>`(내비게이션 landmark)로 교체됨. 기존에 `aside` 랜드마크를 타겟하는 테스트(`getByRole('complementary')`)나 CSS 셀렉터가 있다면 깨질 수 있음.
- 제안: 관련 테스트 및 CSS에서 `aside` → `nav` 의존성 확인.

---

**[INFO] `run-results-drawer.tsx` — `role="status"` 영역에 `statusIcon` 포함**
- 위치: `src/components/editor/run-results/run-results-drawer.tsx`
- 상세: `aria-live="polite"` + `aria-atomic="true"` 컨테이너가 아이콘(`statusIcon`)과 텍스트를 함께 포함. 아이콘에 `aria-hidden`이 설정되지 않았다면 스크린 리더가 아이콘 svg 경로 정보를 포함해 announce할 수 있음. 현재 diff에서 `statusIcon` 정의를 확인할 수 없어 추적 필요.
- 제안: `statusIcon` 컴포넌트에 `aria-hidden="true"` 적용 여부 확인.

---

**[INFO] `smoke.spec.ts` — `webServer` 미설정으로 CI 연동 필요 주의**
- 위치: `frontend/e2e/a11y/smoke.spec.ts`, `playwright.config.ts`
- 상세: 테스트가 외부 dev 서버에 의존하며 `webServer` 자동 기동이 없음. CI 환경에서 서버 미기동 시 전체 e2e 스위트가 connection refused로 실패. 의도된 설계이나 CI 파이프라인에 dev 서버 기동 단계가 누락되면 false negative 발생.
- 제안: CI 워크플로에 `npm run dev &` 또는 `wait-on` 단계 추가 필요. 현재는 운영자 책임으로 문서화되어 있으나 CI 도입 전 반드시 처리.

---

### 요약

이번 변경은 전반적으로 ARIA 속성 추가와 a11y 인프라 구축이 목적으로, 기존 로직을 직접 변경하지 않아 부작용 위험이 낮다. 가장 주의할 점은 `@radix-ui/react-focus-scope`가 `devDependencies`에 배치되어 프로덕션 빌드에서 런타임 에러로 이어질 수 있다는 점이며, `CardTitle`의 ref 타입 변경도 기존 호출자 타입 안전성에 영향을 줄 수 있다. `FocusScope`의 닫힌 상태 포커스 처리, `aside` → `nav` 랜드마크 교체로 인한 테스트 깨짐도 점검이 필요하다.

### 위험도
**MEDIUM** — `@radix-ui/react-focus-scope`의 `devDependencies` 배치가 프로덕션 빌드 실패로 이어질 수 있어 즉시 수정이 필요.