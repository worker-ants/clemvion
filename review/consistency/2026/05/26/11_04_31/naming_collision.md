# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep`
대상 변경 의도: docs 레이아웃 모바일 사이드바 추가
검토 일시: 2026-05-26

---

## 발견사항

### 1. [INFO] `DocsMobileSidebar` 컴포넌트명 — 기존 충돌 없음

- target 신규 식별자: `DocsMobileSidebar` (컴포넌트명), `docs-mobile-sidebar.tsx` (파일 경로)
- 기존 사용처: `codebase/frontend/src/components/docs/` 에 `docs-sidebar.tsx`, `docs-search.tsx`, `doc-body-notice.tsx`, `doc-header.tsx` 등 존재하나, `docs-mobile-sidebar.tsx` 또는 `DocsMobileSidebar` 식별자는 전혀 사용되지 않음.
- 상세: `docs-` prefix + `mobile-sidebar` suffix 조합은 기존 네이밍 컨벤션(파일명 kebab-case, 컴포넌트명 PascalCase)과 일치. 충돌 없음.
- 제안: 없음. 기존 패턴과 일관됨.

---

### 2. [INFO] `mobileSidebarToggle` / `mobileSidebarTitle` i18n 키 — 기존 충돌 없음

- target 신규 식별자: `docs.mobileSidebarToggle`, `docs.mobileSidebarTitle` (ko/en 양쪽)
- 기존 사용처:
  - `codebase/frontend/src/lib/i18n/dict/ko/docs.ts` 에 존재하는 키: `title`, `titleSuffix`, `search`, `noResults`, `onThisPage`, `previous`, `next`, `sectionGettingStarted`, `sectionNodes`, `sectionExpression`, `sectionRunAndDebug`, `sectionIntegrationsConfig`, `sectionFaq`, `bodyKoreanNotice`, `fieldTable.*`, `callout.*`.
  - `codebase/frontend/src/lib/i18n/dict/ko/sidebar.ts` 에 `collapse`, `aria.*` 등 사이드바 관련 키 있으나 `mobileSidebar*` 형태는 없음.
- 상세: `mobileSidebarToggle` · `mobileSidebarTitle` 두 키는 `docs` 네임스페이스 내에 없는 신규 식별자. `sidebar.ts` 의 기존 키(`collapse`, `aria.mainNav` 등)와 의미·네임스페이스 모두 다름. ko/en 양쪽 동시 추가로 parity 충족 가능.
- 제안: 없음. 충돌 없음.

---

### 3. [WARNING] `SlideDrawerProps` 에 `side` prop 추가 — 기존 3개 호출처 영향 주의

- target 신규 식별자: `side?: "left" | "right"` prop (기본값 `"right"`)
- 기존 사용처:
  - `codebase/frontend/src/app/(main)/authentication/page.tsx` (line 442): `<SlideDrawer open=... onClose=... title=...>` — `side` prop 없이 호출.
  - `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` (line 116): `<SlideDrawer open=... onClose=... title=...>` — `side` prop 없이 호출.
  - `codebase/frontend/src/app/(main)/integrations/_shared/service-picker-modal.tsx`: `SlideDrawer` 를 직접 사용하지 않고 주석에서만 참조 (패턴 언급 용도).
- 상세: 기존 호출처 2곳은 모두 `side` prop 을 전달하지 않으며, 기본값 `"right"` 로 폴백하면 현재 동작(우측 슬라이드)이 그대로 유지된다. 현재 `slide-drawer.tsx` 구현에서 패널 위치가 `fixed right-0` 과 `translate-x-full` 로 하드코딩되어 있으므로, `side="left"` 동작은 신규 구현에서 `fixed left-0` + `translate-x-full → -translate-x-full` 로 분기해야 한다. 기본값 `"right"` 가 누락 시 폴백임을 SlideDrawerProps 에 명시하면 기존 사용처 동작이 안전하게 보존된다.
- 제안: `side` prop 의 TypeScript 시그니처에 `default "right"` 를 주석 또는 JSDoc 으로 명시하고, 기존 호출처 2곳을 `side` 생략 상태로 유지해 회귀를 방지. 해당 prop 추가 자체는 비파괴적(optional + 기본값)이므로 호출처 수정 불필요.

---

### 4. [INFO] 파일 경로 — 기존 명명 컨벤션 준수

- target 신규 식별자: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx`
- 기존 사용처: `codebase/frontend/src/components/docs/` 내 파일들은 `docs-` prefix kebab-case 컨벤션을 따름 (`docs-sidebar.tsx`, `docs-search.tsx`, `docs-locale-url-sync.tsx`).
- 상세: 신규 파일 경로가 기존 컨벤션과 일치. 기존 파일과 이름 충돌 없음.
- 제안: 없음.

---

### 5. [INFO] breakpoint 불일치 — 식별자 충돌 아닌 설계 갭 (참고 정보)

본 검토는 식별자 충돌 관점이므로 결정적 사항이 아니나, 확인 요청 항목이므로 기록한다.

- `spec/2-navigation/_layout.md §2.4` : 글로벌 사이드바의 모바일 햄버거 breakpoint = `< 1280px` (`max-width: 1279px`, `codebase/frontend/src/components/layout/sidebar.tsx` line 168: `useMediaQuery("(max-width: 1279px)")`).
- `/docs` 레이아웃의 문서 사이드바 숨김 breakpoint = `< lg` = `< 1024px` (`codebase/frontend/src/app/(main)/docs/layout.tsx` line 25: `hidden ... lg:block`).
- 두 breakpoint 가 다른 것은 식별자 충돌이 아니며, 이미 현재 코드에 존재하는 설계 상태다. 본 task 의 신규 식별자(`DocsMobileSidebar`, `mobileSidebarToggle` 등)는 이 차이를 악화시키지 않는다. **차단 사항이 아님.**

---

## 요약

본 task 가 도입하는 4개의 신규 식별자(`DocsMobileSidebar` 컴포넌트, `docs-mobile-sidebar.tsx` 파일 경로, `docs.mobileSidebarToggle` i18n 키, `docs.mobileSidebarTitle` i18n 키) 모두 기존 코드베이스에 존재하지 않으며 의미 충돌이 없다. `SlideDrawer` 에 추가되는 `side?` prop 은 optional + 기본값 `"right"` 이므로 기존 2개 호출처의 동작을 파괴하지 않는다. 단, `side` prop 구현 시 기존의 `fixed right-0` 하드코딩을 `left/right` 분기로 올바르게 처리해야 회귀가 없다. 식별자 충돌 관점에서는 차단 사항 없음.

---

## 위험도

LOW
