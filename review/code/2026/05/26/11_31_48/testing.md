# 테스트(Testing) 코드 리뷰

리뷰 대상: docs-mobile-sidebar PR (DocsMobileSidebar 신규, SlideDrawer side prop, i18n 2키, layout 변경)

---

## 발견사항

### [WARNING] plan 명시 "pathname 변경 → 자동 close" 테스트 미구현
- 위치: `codebase/frontend/src/components/docs/__tests__/docs-mobile-sidebar.test.tsx` — 해당 케이스 없음
- 상세: `plan/in-progress/docs-mobile-sidebar.md` 체크리스트 L45 에 "열림 → pathname 변경 → 자동 close" 테스트가 명시되어 있으나, 실제 테스트 파일에는 해당 케이스가 작성되지 않았다. 더불어 소스 컴포넌트(`docs-mobile-sidebar.tsx`)의 JSDoc 도 "usePathname 변경 시 자동 close" 를 동작으로 선언한다. 그러나 실제 구현에서 pathname 기반 close 는 `useEffect([pathname])` 가 아니라 `onClickCapture` 를 통한 anchor 클릭 감지로만 동작한다. 즉 Next.js router 의 programmatic navigation(`router.push`) 이나 브라우저 뒤로가기처럼 anchor click 을 거치지 않는 경우에는 drawer 가 자동 close 되지 않는다. 테스트 미구현이 이 갭을 숨기고 있다.
- 제안: (1) `currentPathname` 변수를 변경한 뒤 `rerender` 를 호출하는 테스트를 추가해 pathname 변경 시 drawer 가 닫히는지 검증한다. (2) 또는 현재 구현이 anchor 클릭에만 반응함을 명시하고 JSDoc 과 plan 설명을 "anchor 클릭 시 자동 close" 로 정정해 기대 동작과 구현을 일치시킨다.

---

### [WARNING] SlideDrawer 모듈 수준 `openDrawerCount` 변수로 인한 테스트 격리 위험
- 위치: `codebase/frontend/src/components/ui/slide-drawer.tsx` L28 (`let openDrawerCount = 0;`)
- 상세: `openDrawerCount` 는 모듈 최상단의 변경 가능한 전역 변수다. Vitest 는 기본적으로 테스트 파일 간 모듈 캐시를 공유하므로, 한 테스트에서 drawer 를 열었다가 제대로 닫지 않으면 `openDrawerCount` 가 1 이상인 채로 다음 테스트가 시작된다. 현재 `slide-drawer.test.tsx` 의 `afterEach` 는 `document.body.style.overflow = ""` 만 초기화할 뿐 `openDrawerCount` 를 리셋하지 않는다. `docs-mobile-sidebar.test.tsx` 도 동일하다. 현재 테스트 내용 자체는 `open=true` 로 마운트한 후 정리(cleanup)하므로 `unlockBodyScroll` 이 effect cleanup 에서 호출되겠지만, 테스트가 중간에 실패하거나 비정상 종료되면 카운터가 누출된다.
- 제안: `afterEach` 에서 `vi.resetModules()` 또는 `openDrawerCount` 리셋을 위한 별도 export 헬퍼를 통해 격리를 보장하거나, `openDrawerCount` 를 React ref/context 기반으로 이동해 모듈 수준 전역 상태를 제거한다.

---

### [WARNING] SlideDrawer 신규 동작(body scroll lock)에 대한 테스트 미작성
- 위치: `codebase/frontend/src/components/ui/__tests__/slide-drawer.test.tsx` — body scroll lock 검증 없음
- 상세: `slide-drawer.tsx` 는 `lockBodyScroll` / `unlockBodyScroll` 을 통해 열림 시 `document.body.style.overflow = "hidden"` 을 설정하고 닫힘 시 복원한다. 특히 두 drawer 가 동시에 열릴 때 카운터가 올바르게 동작하는지(중첩 drawer race 방지)가 핵심 로직이다. 그러나 현재 테스트 파일에는 이 동작에 대한 단언이 단 하나도 없다. `afterEach` 에서 `document.body.style.overflow = ""` 를 수동으로 초기화하는 것은 테스트 오염 방지 목적이지 동작 검증이 아니다.
- 제안: 다음 케이스를 추가한다.
  1. drawer `open=true` 시 `document.body.style.overflow === "hidden"` 확인
  2. `open=false` 로 닫힌 후 `overflow === ""` 복원 확인
  3. (선택) 두 SlideDrawer 인스턴스를 순차 열고 하나만 닫을 때 overflow 가 "hidden" 유지되는지 확인

---

### [WARNING] SlideDrawer overlay 클릭 / 닫기 버튼 클릭 onClose 호출 테스트 미작성
- 위치: `codebase/frontend/src/components/ui/__tests__/slide-drawer.test.tsx`
- 상세: `slide-drawer.tsx` 에는 세 가지 close 트리거가 있다. (1) Escape 키(`keyDown` — 테스트됨), (2) 오버레이 `div` 클릭(`onClick={onClose}`), (3) 헤더 닫기 버튼 클릭. 현재 테스트는 Escape 케이스만 검증하고 오버레이 클릭과 닫기 버튼 클릭은 누락되었다.
- 제안: 오버레이(`fixed inset-0 z-40`) 클릭 및 `aria-label` 이 `common.close` 인 버튼 클릭 시 `onClose` 가 호출되는지 테스트를 추가한다.

---

### [WARNING] DocsMobileSidebar — 매칭 페이지 없을 때(섹션·페이지 라벨 미표시) 엣지 케이스 테스트 미작성
- 위치: `codebase/frontend/src/components/docs/__tests__/docs-mobile-sidebar.test.tsx`
- 상세: 현재 테스트는 `currentPathname = "/docs/ko/02-nodes/ai"` 가 sections 데이터에서 매칭되는 경우만 검증한다. pathname 이 sections 에 존재하지 않는 경우(예: docs 외 경로, 신규 페이지가 index 에 아직 없는 경우)에는 `sectionLabel = ""` 이고 `pageTitle = ""` 이 되어 토글 버튼에 chevron + 라벨 영역이 렌더되지 않아야 한다. 이 분기가 정상 동작하는지 검증하는 테스트가 없다.
- 제안: `currentPathname = "/docs/ko/unknown-page"` 와 같이 매칭 안 되는 경로로 설정한 뒤, 토글 버튼에 ChevronRight 와 섹션/페이지 텍스트가 없음을 단언하는 케이스를 추가한다.

---

### [WARNING] DocsMobileSidebar — `aria-expanded` 상태 변화 테스트 미작성
- 위치: `codebase/frontend/src/components/docs/__tests__/docs-mobile-sidebar.test.tsx`
- 상세: 토글 버튼에 `aria-expanded={open}` 속성이 있다. 초기 상태(`false`) 와 클릭 후(`true`) 값이 올바르게 반영되는지 검증하는 테스트가 없다. 접근성 속성 테스트는 ARIA 계약의 일부다.
- 제안: 초기 렌더 시 `aria-expanded="false"` 이고 클릭 후 `aria-expanded="true"` 임을 단언하는 테스트를 추가한다.

---

### [INFO] DocsMobileSidebar — 영어(en) locale 시 토글 라벨 테스트 미작성
- 위치: `codebase/frontend/src/components/docs/__tests__/docs-mobile-sidebar.test.tsx`
- 상세: 모든 테스트가 `ko` locale 고정이다. `useLocaleStore.setState({ locale: "en" })` 으로 영어 locale 을 설정했을 때 토글 라벨이 `"Guide contents"` 로 바뀌는지 i18n 경로가 검증되지 않는다. `en` locale 에서 `localizedDocsHref` / `localizedSectionLabel` / `localizedTitle` 도 다른 결과를 반환할 수 있다.
- 제안: `en` locale 에서 최소 토글 라벨(`"Guide contents"` 포함 여부) 을 확인하는 케이스를 추가하면 i18n 파이프라인 연결을 검증할 수 있다. 필수는 아니나 추가하면 커버리지 신뢰도가 높아진다.

---

### [INFO] `Element.prototype.scrollIntoView` spy 가 afterEach 에서 복원되지 않음
- 위치: `codebase/frontend/src/components/docs/__tests__/docs-mobile-sidebar.test.tsx` L168
- 상세: `Element.prototype.scrollIntoView = scrollSpy` 로 프로토타입을 직접 교체하고, 테스트 종료 후 원래 값으로 복원하지 않는다. Vitest 가 각 테스트 파일을 별도 worker 에서 실행하면 문제가 없지만, 같은 worker 내 후속 테스트에서 `scrollIntoView` 동작에 의존한다면 예상치 못한 결과가 나올 수 있다.
- 제안: 테스트 시작 전 원본을 저장하고(`const original = Element.prototype.scrollIntoView`) afterEach 에서 복원(`Element.prototype.scrollIntoView = original`)하거나, `vi.spyOn(Element.prototype, "scrollIntoView")` 를 사용해 Vitest 가 자동 복원하도록 변경한다.

---

### [INFO] `docs/layout.tsx` 변경에 대한 직접 단위 테스트 없음
- 위치: `codebase/frontend/src/app/(main)/docs/layout.tsx`
- 상세: `layout.tsx` 는 서버 컴포넌트이며 Next.js App Router 특성상 단위 테스트 작성이 어렵다. `DocsMobileSidebar` 에 `sections` 와 `entriesByLocale` 를 올바르게 전달하는지는 `DocsMobileSidebar` 자체 테스트에서 검증되므로 큰 문제는 아니다. 다만 레이아웃 렌더 시 flex 방향 변경(`flex-col` → `lg:flex-row`) 이 실제로 반응형으로 작동하는지는 e2e 또는 시각적 회귀 테스트로만 보장 가능하다.
- 제안: e2e 테스트에서 모바일 viewport(< 1024px) 와 데스크탑 viewport 에서 각각 토글 버튼 표시/숨김 및 aside 표시/숨김을 검증하는 케이스를 추가하는 것을 권장한다.

---

## 요약

SlideDrawer 와 DocsMobileSidebar 에 대해 신규 테스트가 작성된 점은 긍정적이다. SlideDrawer 의 `side` prop CSS 분기(5개 케이스)와 Escape 키 close 는 잘 커버되어 있고, DocsMobileSidebar 의 토글 오픈/닫힘 흐름과 scrollIntoView spy 도 검증된다. 그러나 핵심 갭이 두 곳 존재한다. 첫째, plan 에 명시된 "pathname 변경 → auto close" 테스트가 누락되어 있으며, 실제 구현이 anchor 클릭 감지 방식(onClickCapture)만 사용하기 때문에 programmatic navigation 은 close 되지 않는 동작 불일치 가능성이 테스트로 포착되지 않는다. 둘째, SlideDrawer 의 body scroll lock 로직(모듈 수준 카운터 기반)이 전혀 검증되지 않아 중첩 drawer 시나리오에서의 안전성이 테스트로 보장되지 않는다. 또한 모듈 수준 `openDrawerCount` 변수가 테스트 격리에 잠재적 위험을 만들고, overlay/닫기 버튼 close 경로, 미매칭 경로 엣지 케이스, `aria-expanded` 변화 검증도 빠져 있다.

---

## 위험도

MEDIUM

STATUS: OK
