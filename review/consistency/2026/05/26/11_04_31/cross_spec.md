# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상 spec: `spec/2-navigation/13-user-guide.md`, `spec/2-navigation/_layout.md`
변경 의도: docs 모바일 사이드바 진입 (DocsMobileSidebar + SlideDrawer side prop 확장 + i18n 2키)
검토 일시: 2026-05-26

---

## 발견사항

### [WARNING] /docs 내부 사이드바 breakpoint (lg=1024px)와 앱 글로벌 사이드바 breakpoint (<1280px) 불일치 — 차단 사항 아님, 의도적 이중 breakpoint

- **target 위치**: `codebase/frontend/src/app/(main)/docs/layout.tsx` L25 (`hidden w-60 shrink-0 lg:block` — Tailwind `lg` = 1024px)
- **충돌 대상**: `spec/2-navigation/_layout.md §2.4` — "< 1280px: 사이드바 숨김, 햄버거 메뉴로 토글"
- **상세**: spec `_layout.md §2.4` 는 *앱 글로벌 사이드바* 의 반응형 규칙(< 1280px = hamburger)을 정의한다. 이를 `/docs` 내부 사이드바 영역에도 동일하게 적용해야 하는지는 spec 에 명시가 없다. 현재 구현은 `lg=1024px` 을 기준으로 docs 내부 사이드바를 숨기며, 본 task 는 이 breakpoint 위에 모바일 토글 버튼을 추가하는 방식이다.
  - 글로벌 사이드바: `max-width: 1279px` (코드: `sidebar.tsx:168` `useMediaQuery("(max-width: 1279px)")`) → spec §2.4 와 일치
  - docs 내부 사이드바: `lg:hidden / lg:block` (Tailwind lg = 1024px) → spec 에 별도 규정 없음
  - 두 breakpoint(1024px vs 1280px)가 공존하는 화면(1024~1279px)에서: 앱 글로벌 사이드바는 숨겨지고 docs 내부 사이드바는 표시되는 이중 상태가 발생한다.
- **판단**: spec `_layout.md §2.4` 는 앱 글로벌 사이드바에만 적용되는 규칙으로 독해가 자연스럽다. docs 내부 사이드바에 별도 breakpoint 를 두는 것은 규칙상 금지되지 않으며 현 구현 상태이기도 하다. 본 task 의 차단 사항이 아니다.
- **제안**: 추후 `spec/2-navigation/13-user-guide.md §10` 업데이트(후속 plan `spec-update-user-guide-mobile.md`) 시 "/docs 내부 사이드바 breakpoint = lg(1024px), 앱 글로벌 사이드바와 독립" 을 명시해 drift 를 해소할 것.

---

### [INFO] spec/2-navigation/13-user-guide.md §10 "검색 미포함" drift — 실제 구현과 불일치, 본 task scope 밖

- **target 위치**: `spec/2-navigation/13-user-guide.md §10` — "검색: 현재는 미포함"
- **충돌 대상**: `codebase/frontend/src/app/(main)/docs/layout.tsx` L30 (`<DocsSearch entriesByLocale={searchEntriesByLocale} />`), `codebase/frontend/src/components/docs/docs-search.tsx`
- **상세**: spec §10 은 "검색: 현재는 미포함" 으로 기술되어 있으나 실제 docs 레이아웃에는 `DocsSearch` 컴포넌트가 이미 구현·적용되어 있다. 기존 drift 이며 본 task 가 직접 도입하는 것은 아니다.
- **제안**: 후속 spec 업데이트(`plan/in-progress/spec-update-user-guide-mobile.md`) 에서 §10 검색 항목을 "검색: DocsSearch 구현됨 (빌드타임 index 기반 클라이언트 검색)" 으로 정정할 것.

---

### [INFO] spec/2-navigation/13-user-guide.md §10 모바일 진입 미정의 drift — 본 task scope 밖

- **target 위치**: `spec/2-navigation/13-user-guide.md §10` 접근·표시 테이블 — 모바일 토글 진입 언급 없음
- **충돌 대상**: 본 task 가 추가하는 `codebase/frontend/src/app/(main)/docs/layout.tsx` 의 모바일 토글 버튼 + `docs-mobile-sidebar.tsx`
- **상세**: spec §10 은 모바일에서 docs 사이드바 접근 방법을 기술하지 않는다. 본 task 는 spec 수정 없이 구현을 추가하므로 spec-impl 간 drift 가 새로 생긴다.
- **판단**: 기획서에서 후속 `spec-update-user-guide-mobile.md` 로 분리한다고 명시했으므로 본 task 의 차단 사항이 아니다.
- **제안**: 후속 plan 에서 §10 에 "모바일 진입: < lg(1024px) 에서 상단 고정 토글 버튼 → SlideDrawer 로 DocsSidebar + DocsSearch 제공" 행 추가.

---

### [INFO] ko/en parity — i18n 키 2개 양쪽 추가로 충족, 기존 패턴과 일치

- **target 위치**: `codebase/frontend/src/lib/i18n/dict/{ko,en}/docs.ts` — `mobileSidebarToggle`, `mobileSidebarTitle` 키 신규 추가 예정
- **충돌 대상**: 기존 `ko/docs.ts`, `en/docs.ts` 키 목록
- **상세**: 기존 `docs` namespace 에 `mobileSidebarToggle` / `mobileSidebarTitle` 키는 존재하지 않는다. 두 파일 모두 동시에 추가하면 ko/en parity 가 만족된다. `en/docs.ts` 는 `Dict["docs"]` 타입을 명시적으로 사용하므로 TypeScript 컴파일러가 누락된 키를 빌드 오류로 잡는다. 기존 naming 패턴(`sectionGettingStarted`, `onThisPage` 등 camelCase) 과 일치.
- **제안**: 특별한 조치 불필요. 두 파일에 동시 추가 후 TypeScript 컴파일로 검증하면 충분.

---

### [INFO] naming collision 없음 — DocsMobileSidebar / mobileSidebarToggle / mobileSidebarTitle

- **target 위치**: 신규 `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` 컴포넌트명 및 i18n 키
- **충돌 대상**: 기존 `codebase/frontend/src/components/docs/` 파일 목록, 기존 i18n `docs` namespace 키
- **상세**: 기존 docs 컴포넌트 디렉터리에 `docs-mobile-sidebar.tsx` 는 없다. `mobileSidebarToggle` / `mobileSidebarTitle` 키도 기존 ko/en 사전에 없다. spec 전체(`spec/` grep) 에서도 동일 식별자 사용처 없음.
- **제안**: 특별한 조치 불필요.

---

### [INFO] SlideDrawer `side` prop 확장 — 기존 사용처(글로벌 사이드바)는 SlideDrawer 미사용, 기존 3개 소비자 모두 `side` prop 없이 안전

- **target 위치**: `codebase/frontend/src/components/ui/slide-drawer.tsx` — `side?: "left" | "right"` (default "right") prop 추가 예정
- **충돌 대상**: 기존 SlideDrawer 소비자 3곳 — `app/(main)/authentication/page.tsx`, `components/triggers/trigger-detail-drawer.tsx`, `app/(main)/integrations/_shared/service-picker-modal.tsx` (단 service-picker-modal 은 주석 참조만, 직접 import 아님)
- **상세**: 현재 `SlideDrawer` props 인터페이스에 `side` 는 없다. 패널은 `fixed right-0` + `translate-x-full` 로 하드코딩 되어 있다. `side` 를 optional prop (default `"right"`) 으로 추가하면 기존 소비자가 `side` 를 전달하지 않아도 동작이 변하지 않는다.
  - 앱 글로벌 사이드바(`components/layout/sidebar.tsx`)는 SlideDrawer 를 사용하지 않는다 — 자체 `fixed left-0` / `translate-x-[-100%]` 구현. SlideDrawer side prop 확장은 글로벌 사이드바 동작에 영향 없다.
- **제안**: 특별한 조치 불필요. default `"right"` 보장으로 하위 호환성 유지.

---

### [INFO] spec/0-overview.md §3.5 "최소 해상도: 1280x720" — docs 모바일 진입이 이 범위 밖을 지원하는 것은 additive

- **target 위치**: 신규 모바일 토글 (<lg, 즉 <1024px 에서 사용 가능)
- **충돌 대상**: `spec/0-overview.md §3.5` — "최소 해상도: 1280x720. 에디터는 데스크탑 전용"
- **상세**: §3.5 의 "최소 해상도 1280x720" 규정은 에디터(캔버스) 맥락이 강하다. `/docs` 는 에디터와 별개 화면이며, 모바일 진입 기능 추가는 최소 지원 해상도를 낮추는 것이 아니라 더 낮은 해상도에서도 읽기 가능하도록 additive 하게 확장하는 것이다. "에디터는 데스크탑 전용" 규정과도 충돌하지 않는다.
- **제안**: spec §3.5 에 "/docs 는 반응형 (< lg 모바일 진입 지원)" 표기를 추가하는 것이 명확하나 필수는 아님. 후속 spec 업데이트에서 함께 처리 가능.

---

## 요약

Cross-Spec 일관성 관점에서 본 task(docs 모바일 사이드바 진입)는 CRITICAL 또는 WARNING 차단 사항이 없다. 발견된 주요 이슈는 두 가지 breakpoint 공존(앱 글로벌 1280px vs docs 내부 1024px)인데, `spec/2-navigation/_layout.md §2.4` 는 앱 글로벌 사이드바 규칙으로 한정 독해가 자연스럽고 docs 내부 breakpoint 에 대한 별도 제약이 없어 차단 근거가 없다. SlideDrawer `side` prop 확장은 optional + default "right" 방식으로 기존 소비자 3곳의 동작을 변경하지 않는다. i18n 키 2개(mobileSidebarToggle, mobileSidebarTitle) 는 naming collision 없이 기존 패턴을 따른다. 누적된 spec drift(§10 검색 미포함 기재, 모바일 진입 미정의)는 계획된 후속 plan으로 처리되어 있어 본 task scope 에서 수용 가능하다.

## 위험도

LOW

STATUS: OK
