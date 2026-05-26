# 아키텍처(Architecture) 리뷰 결과

리뷰 대상: docs-mobile-sidebar PR (파일 9종 + plan/review 파일)
리뷰 일시: 2026-05-26

---

## 발견사항

### [INFO] DocsLayout 의 서버-클라이언트 경계 분리가 명확하다

- 위치: `codebase/frontend/src/app/(main)/docs/layout.tsx`
- 상세: `DocsLayout` 은 `"use client"` 없이 서버 컴포넌트로 유지되고, `searchEntriesByLocale` 를 빌드/요청 시점에 미리 계산해 props 로 내려준다. 신규 `DocsMobileSidebar` 에 `"use client"` 를 분리 파일로 둔 것은 Next.js 서버-클라이언트 경계를 올바르게 그은 것이다. 레이어 책임(데이터 집계는 서버, 인터랙션 상태는 클라이언트) 분리가 적절하다.
- 제안: 조치 불필요.

---

### [INFO] SlideDrawer 의 개방-폐쇄 원칙(OCP) 준수 — side prop 확장 방식이 적절하다

- 위치: `codebase/frontend/src/components/ui/slide-drawer.tsx`
- 상세: 기존 동작(`side="right"` default)을 변경하지 않고 `side?: "left" | "right"` prop 으로 새 동작을 추가했다. 기존 호출처는 수정 없이 동일하게 동작하며, 신규 `DocsMobileSidebar` 만 `side="left"` 를 선택적으로 사용한다. OCP(기존 코드를 수정하지 않고 확장)를 잘 따르고 있다.
- 제안: 조치 불필요.

---

### [INFO] DocsSidebar/DocsSearch 컴포넌트 재사용 — DRY 및 단일 진실 원칙 준수

- 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` L618-619
- 상세: 데스크탑 `<aside>` 와 모바일 `SlideDrawer` 모두 동일한 `DocsSidebar`, `DocsSearch` 컴포넌트를 재사용한다. 사이드바 트리·검색 로직이 두 곳에 중복 구현되지 않아 DRY 원칙과 단일 진실 원칙이 유지된다.
- 제안: 조치 불필요.

---

### [WARNING] DocsMobileSidebar 내 현재 페이지 매칭 로직의 단일 책임 경계 모호

- 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` L558-568
- 상세: `DocsMobileSidebar` 가 "현재 pathname 에 대응하는 sectionLabel/pageTitle 도출" 로직을 컴포넌트 렌더 함수 본문 안에 직접 보유한다. 이 로직은 `@/lib/docs/` 레이어에 속하는 데이터 질의(도메인 로직)이고, 컴포넌트의 단일 책임(프레젠테이션)을 벗어나는 부분이다. 현재는 규모가 작아 실질 문제가 없으나, 같은 "pathname → (sectionLabel, pageTitle)" 매핑이 다른 컴포넌트에서도 필요해질 경우(예: breadcrumb, page title meta) 중복 구현이 발생할 수 있다.
  - react-compiler 자동 메모이제이션 의존 주석(`// useMemo 를 두지 않는다`) 이 있어 컴파일러 버전 변경 시 잠재적 회귀 위험이 있다. 해당 주석을 코드 내 근거로만 남기는 것은 적절하나, 이 의존성이 없는 순수 함수로 분리했다면 테스트 용이성도 높아진다.
- 제안: 단기에는 현 구조 유지 가능(INFO 수준). 동일 매핑 로직이 2개 이상 컴포넌트에서 필요해지는 시점에 `@/lib/docs/locale.ts` 또는 `@/lib/docs/registry.ts` 에 `resolveActivePageMeta(sections, pathname, locale): { sectionLabel, pageTitle } | null` 형태의 헬퍼 함수로 추출하는 것을 권장한다.

---

### [WARNING] SlideDrawer 의 모듈-수준 가변 상태(openDrawerCount) — 테스트 격리 위험

- 위치: `codebase/frontend/src/components/ui/slide-drawer.tsx` L1070
- 상세: `let openDrawerCount = 0` 이 모듈 스코프 가변 변수로 선언되어 있다. 이 패턴은 중첩 drawer 의 body scroll lock race 를 해결하기 위한 의도적 설계(코드 주석으로도 명시)이며 런타임 기능상으로는 올바르다. 그러나 테스트 환경에서 각 테스트 케이스가 동일 모듈 인스턴스를 공유하기 때문에, 테스트 A 에서 drawer 를 열고 정상 close 없이 cleanup 할 경우 `openDrawerCount` 가 0으로 리셋되지 않아 이후 테스트에서 scroll lock/unlock 동작이 오염될 수 있다.
  - 현재 `slide-drawer.test.tsx` 의 `afterEach` 에서 `document.body.style.overflow = ""` 를 수동 초기화하고 있어 증상이 마스킹되고 있다. 단 `openDrawerCount` 자체가 0으로 돌아오지 않는다면, 한 테스트에서 두 번 열었다가 하나만 닫은 상황에서 카운터가 잘못된 값을 가진 채 다음 테스트로 진입하는 경우가 있다.
- 제안: 테스트 격리를 강화하려면 (1) `openDrawerCount` 를 초기화하는 `__resetForTesting()` 내보내기를 추가하고 `afterEach` 에서 호출하거나, (2) body scroll lock 로직을 React context 또는 커스텀 훅으로 내부화해 인스턴스 스코프로 격리하는 방법을 검토한다. 단 현재 테스트 커버리지가 단순 열림/닫힘 시나리오만 다루고 있어 실제 오염 케이스는 재현되지 않으므로 MEDIUM 이하 우선순위다.

---

### [INFO] onClickCapture 를 통한 anchor 클릭 감지 — 레이어 책임 관점

- 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` L609-616
- 상세: drawer 내 링크 클릭 시 자동 close 처리를 `onClickCapture` + `e.target.closest("a")` DOM 질의로 구현했다. 코드 주석에 react-compiler 의 setState-in-effect 규약 위반을 피하기 위한 선택이라고 명시되어 있어 의도가 명확하다. DOM 기반 감지 방식은 DocsSidebar 의 내부 구현에 결합되지 않으므로 결합도 관점에서는 양호하다.
  - 단, `<a>` 태그 이외의 페이지 전환 방식(예: `router.push` 를 사용하는 `<button>`)이 DocsSidebar 에 추가될 경우 이 감지가 동작하지 않는다. 현재 DocsSidebar 가 `<a>` 기반 링크만 렌더한다는 전제에 암묵적으로 의존한다.
- 제안: 현 상태에서는 INFO 수준. DocsSidebar 가 `router.push` 기반 버튼을 도입할 경우 감지 로직 확장이 필요하다는 사실을 주석에 추가하거나, 그 시점에 `onCloseDrawer` 콜백을 DocsSidebar props 로 전달하는 방식으로 리팩터링을 고려한다.

---

### [INFO] i18n 키 추가 방식 — 레이어 책임 및 응집도 양호

- 위치: `codebase/frontend/src/lib/i18n/dict/ko/docs.ts`, `codebase/frontend/src/lib/i18n/dict/en/docs.ts`
- 상세: 신규 사용자 가시 문자열(`mobileSidebarToggle`, `mobileSidebarTitle`)이 컴포넌트 내 하드코딩 없이 i18n 레이어를 통해서만 노출된다. ko/en 양쪽 동시 추가로 parity 규약을 충족한다. `docs.*` 네임스페이스 응집도가 유지된다.
- 제안: 조치 불필요.

---

### [INFO] 테스트 파일의 모듈 경계 — 외부 의존 최소화

- 위치: `codebase/frontend/src/components/docs/__tests__/docs-mobile-sidebar.test.tsx`
- 상세: `next/navigation` 전체를 모킹하고, `useLocaleStore.setState` 로 전역 상태를 직접 조작한다. 이는 테스트 환경에서의 표준 패턴이지만, `useLocaleStore` 가 전역 싱글턴 상태임을 전제한다. `beforeEach`/`afterEach` 에서 상태를 명시적으로 초기화하고 있어 격리가 적절히 관리된다.
- 제안: 조치 불필요.

---

## 요약

이번 변경은 `DocsLayout` (서버 컴포넌트) → `DocsMobileSidebar` (클라이언트 컴포넌트) → `SlideDrawer` (범용 UI 컴포넌트) 계층이 레이어 책임에 맞게 분리되어 있으며, `DocsSidebar`/`DocsSearch` 재사용을 통해 DRY 원칙을 잘 준수한다. `SlideDrawer` 의 `side` prop 확장은 OCP 를 따르고 하위 호환성이 유지된다. 주요 아키텍처적 관찰 사항은 두 가지다. 첫째, `DocsMobileSidebar` 내 현재 페이지 매칭 로직이 렌더 함수 안에 직접 포함되어 있어 동일 로직이 복수 컴포넌트로 확산될 경우 DRY 위반 위험이 있으나 현 시점에는 단일 사용처이므로 즉시 차단 사유는 아니다. 둘째, `SlideDrawer` 의 모듈-수준 `openDrawerCount` 가변 변수가 테스트 격리를 약화시킬 수 있으나, 현재 `afterEach` 의 수동 overflow 초기화로 증상이 통제되고 있다. 전체적으로 아키텍처 구조가 기존 패턴과 일관되고 확장 지점이 명확하게 설계된 변경이다.

---

## 위험도

LOW
