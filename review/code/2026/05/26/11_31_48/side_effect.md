# 부작용(Side Effect) 리뷰 결과

리뷰 대상: docs-mobile-sidebar PR (파일 10종)
분석일: 2026-05-26

---

## 발견사항

### [WARNING] `openDrawerCount` 모듈-레벨 전역 변수 — 테스트 간 오염 가능성
- 위치: `codebase/frontend/src/components/ui/slide-drawer.tsx` L28 (`let openDrawerCount = 0;`)
- 상세: `openDrawerCount` 는 ES 모듈 스코프 전역 변수다. `vitest` 는 기본적으로 모듈을 테스트 파일 단위로 재임포트하므로 파일 경계에서는 초기화된다. 그러나 같은 테스트 파일 내에서 `SlideDrawer` 를 `open=true` 로 렌더한 뒤 `cleanup()` 만 하면 `unlockBodyScroll` 이 호출되어 카운터는 0으로 내려가지만, React strict-mode 또는 예외 발생 등 effect cleanup 이 정상 실행되지 않는 경우 카운터가 양수 상태로 남아 후속 테스트의 `lockBodyScroll` 이 `document.body.style.overflow = "hidden"` 을 다시 설정하지 못한다. 두 테스트 파일(`slide-drawer.test.tsx`, `docs-mobile-sidebar.test.tsx`) 의 `afterEach` 에서 `document.body.style.overflow = ""` 만 리셋하고 `openDrawerCount` 자체는 리셋하지 않는다. vitest 가 모듈을 파일 단위로 격리하면 문제없지만, `--pool=threads` + `vi.mock` 조합에 따라 모듈 캐시가 공유되면 카운터가 초기화되지 않을 수 있다.
- 제안: `afterEach` 에서 `openDrawerCount` 리셋을 추가하거나, `openDrawerCount` 를 `export` 해 테스트에서 직접 초기화할 수 있도록 하거나, 모듈을 `vi.resetModules()` 로 재로드하는 패턴을 적용한다. 가장 간단한 방법은 `unlockBodyScroll` 을 테스트에서 호출 가능한 `resetBodyScrollLock()` 유틸로 별도 export 하는 것이다.

---

### [WARNING] `Element.prototype.scrollIntoView` 전역 프로토타입 변경 — 미복원
- 위치: `codebase/frontend/src/components/docs/__tests__/docs-mobile-sidebar.test.tsx` L168
- 상세: 마지막 테스트(`"drawer 가 열릴 때 활성 페이지 항목에 대해 scrollIntoView 가 호출돼요"`)에서 `Element.prototype.scrollIntoView = scrollSpy;` 로 전역 프로토타입 메서드를 교체한다. `afterEach` 에서 원래 값을 복원하는 코드가 없다. vitest 가 테스트 파일 간에 JSDOM 환경을 재설정하는지 여부(`environment: "jsdom"` + `isolate` 옵션)에 따라, 이 변경이 동일 테스트 프로세스의 후속 테스트에 파급될 수 있다. 특히 다른 테스트 파일에서 `scrollIntoView` 를 정상 동작으로 기대할 때 spy 함수가 호출되어 예상치 못한 실패 또는 오검출이 발생한다.
- 제안: 테스트 코드를 다음과 같이 수정한다.
  ```ts
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = scrollSpy;
  // ... 테스트 로직 ...
  Element.prototype.scrollIntoView = originalScrollIntoView; // afterEach 또는 테스트 내 finally
  ```
  또는 `vi.spyOn(Element.prototype, "scrollIntoView")` 를 사용하면 vitest 가 `vi.restoreAllMocks()` 시 자동 복원한다.

---

### [INFO] `DocsMobileSidebar` — `pathname` 을 읽지만 close effect 로 사용하지 않음 (의도적 패턴, 잠재적 혼동)
- 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` L38, L63
- 상세: `pathname` 은 두 용도로 사용된다: (1) 현재 활성 페이지 매칭(렌더 중 순수 계산), (2) JSDoc 주석에 명시된 "pathname 변경 시 자동 close". 그러나 실제 구현에서 pathname 변경 감지 effect 가 없다. 대신 `onClickCapture` 에서 anchor 클릭 시 `setOpen(false)` 를 즉시 호출하는 방식을 채택했으며, JSDoc 설명과 코드 주석("react-compiler 의 setState-in-effect 규약 위반이라 click capture 로 처리")이 이 의도를 설명한다. 부작용 관점에서 의도하지 않은 상태 변경은 없으나, JSDoc 의 "usePathname 변경 시 자동 close" 문구가 실제 동작(클릭 캡처)과 괴리가 있어 유지보수 시 혼동을 줄 수 있다. 또한 pathname 은 실제로 `open` 상태를 close 하는 trigger 로 사용되지 않으므로, `pathname` 이 변경되어도 (예: 브라우저 back/forward, programmatic navigation via router) drawer 는 자동으로 닫히지 않는다.
- 제안: JSDoc 에서 "usePathname 변경 시 자동 close" 문구를 "anchor 클릭 시 자동 close (click capture)" 로 정정한다. 실제로 pathname 변경으로 drawer 를 닫아야 한다면 별도 effect 가 필요하다 (현재는 의도적으로 생략).

---

### [INFO] `SlideDrawer` interface 변경 — `side?: "left" | "right"` 추가 (optional, 하위 호환)
- 위치: `codebase/frontend/src/components/ui/slide-drawer.tsx` L19, L49
- 상세: `side` prop 은 optional 이고 `default "right"` 가 설정되어 있다. 기존 사용처 2곳 (`authentication/page.tsx:442`, `trigger-detail-drawer.tsx:116`) 모두 `side` 를 전달하지 않으므로 기존 동작 (`right-0`, `translate-x-full`) 이 유지된다. CSS 조건 분기 (`isLeft ? "left-0 border-r" : "right-0 border-l"`) 가 기존 클래스명과 동일한 값을 생성하므로 시각적 회귀 없음. 단위 테스트(`slide-drawer.test.tsx`)에서 `side` prop 없음 + `side="right"` 모두 `right-0`, `border-l` 클래스를 갖는지 검증하고 있다.
- 제안: 조치 불필요. 인터페이스 확장이 하위 호환 방식으로 올바르게 설계되어 있음.

---

### [INFO] `docs/layout.tsx` — 서버 컴포넌트에 `DocsMobileSidebar` (클라이언트 컴포넌트) 추가
- 위치: `codebase/frontend/src/app/(main)/docs/layout.tsx` L34, L46-49
- 상세: `DocsLayout` 은 서버 컴포넌트이며 `DocsMobileSidebar` 는 `"use client"` 를 선언한 클라이언트 컴포넌트다. Next.js App Router 에서 서버 컴포넌트가 클라이언트 컴포넌트를 자식으로 렌더하는 것은 허용된 패턴이다. `sections` 와 `searchEntriesByLocale` 는 서버에서 직렬화 가능한 순수 데이터 (DocsSection[], Record<Locale, DocsSearchEntry[]>) 로 전달된다. 직렬화 불가 값(함수, 클래스 인스턴스 등)은 포함되지 않는다. 부작용 관점에서 의도치 않은 상태 변경은 없다.
- 제안: 조치 불필요.

---

### [INFO] i18n 사전 — 신규 키 `mobileSidebarToggle`, `mobileSidebarTitle` (ko/en 동시 추가)
- 위치: `codebase/frontend/src/lib/i18n/dict/ko/docs.ts`, `codebase/frontend/src/lib/i18n/dict/en/docs.ts`
- 상세: 두 파일에 동일한 키가 동시에 추가되어 `i18n-userguide.md §Principle 2` parity 규약을 충족한다. 기존 키와의 충돌 없음. 사전 객체에 새 키를 추가하는 것은 기존 사용 코드에 영향을 주지 않는 순수 additive 변경이다.
- 제안: 조치 불필요.

---

## 요약

이번 변경은 `SlideDrawer` 에 optional `side` prop 을 추가하고, 신규 `DocsMobileSidebar` 클라이언트 컴포넌트와 해당 테스트를 추가한 것이다. 전역 상태 변경 관점에서 두 가지 주의 지점이 있다: (1) `slide-drawer.tsx` 에 기존부터 존재하는 모듈-레벨 전역 카운터 `openDrawerCount` 가 테스트에서 명시적으로 초기화되지 않아 edge case 에서 테스트 오염 가능성이 있다 (기존 코드의 문제이나 신규 테스트 파일도 동일 패턴을 따름), (2) `docs-mobile-sidebar.test.tsx` 에서 `Element.prototype.scrollIntoView` 를 직접 교체한 후 복원하지 않아 다른 테스트 환경에 파급될 수 있다. 프로덕션 코드 자체에는 의도하지 않은 상태 변경, 환경 변수 접근, 네트워크 호출, 이벤트 리스너 누수 등이 발견되지 않는다.

---

## 위험도

LOW
