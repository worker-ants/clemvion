---
worktree: docs-mobile-sidebar
started: 2026-05-26
owner: developer
---

# 사용자 가이드 (`/docs`) 모바일 사이드바 진입 추가

## 배경

`codebase/frontend/src/app/(main)/docs/layout.tsx` L25 의 `<aside className="hidden w-60 shrink-0 lg:block">` 때문에 Tailwind `lg` (≥1024px) 미만에서 사이드바 전체(가이드 트리 + 검색)가 통째로 숨겨진다. 모바일/일반 태블릿 사용자는 가이드 내부 다른 페이지로 이동하거나 검색할 진입점이 본문 링크 외에 존재하지 않는다.

## 범위

본 PR 의 범위는 **UI 보강 + 신규 i18n 키 + SlideDrawer side 옵션 확장** 까지. spec 본문 정정은 별도 후속 plan (`plan/in-progress/spec-update-user-guide-mobile.md`).

## 채택안 — 안 A (모바일 토글 + Drawer, 데스크탑 무변경)

데스크탑 사이드바는 그대로 두고, `lg:hidden` 모바일 토글 버튼 + 왼쪽 슬라이드 drawer 안에 동일한 `DocsSidebar` + `DocsSearch` 를 노출.

비교했던 다른 안:
- 안 B (article 위 collapsible 박스): 본문을 매번 밀어내고 검색 자리가 애매해 채택 안 함.
- 안 C (bottom sheet): 다른 floating 컨트롤과 자리 충돌 위험.

## 작업 체크리스트

- [ ] `SlideDrawer` 에 `side?: "left" | "right"` (default `"right"`) prop 추가, CSS 분기 (`left-0` ↔ `right-0`, `-translate-x-full` ↔ `translate-x-full`, `border-r` ↔ `border-l`) 분기.
- [ ] 기존 SlideDrawer 호출처 2곳(`authentication/page.tsx`, `trigger-detail-drawer.tsx`) 동작 무변경 단위 테스트로 회귀 보장.
- [ ] 신규 client 컴포넌트 `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx`:
  - 상단 sticky bar (햄버거 아이콘 + 현재 섹션·페이지 라벨)
  - 토글 시 `SlideDrawer side="left"` 안에 `DocsSearch` + `DocsSidebar` 표시
  - drawer 안 현재 활성 페이지로 `scrollIntoView({ block: "center" })` (열림 시·drawer 안 ref)
  - `usePathname` 변경 시 `setOpen(false)` 자동 close
  - 사용자 가시 문자열은 `t("docs.mobileSidebarToggle")` / `t("docs.mobileSidebarTitle")` 경유 (TSX 하드코딩 금지)
- [ ] `codebase/frontend/src/app/(main)/docs/layout.tsx`:
  - 기존 `<aside className="hidden ... lg:block">` 유지 (데스크탑 동작 무변경)
  - 그 위 또는 article 안에 `<DocsMobileSidebar sections=... entriesByLocale=... />` 를 `lg:hidden` 으로 추가
- [ ] i18n KO/EN 양쪽 동시 추가 (parity):
  - `dict/ko/docs.ts`: `mobileSidebarToggle: "가이드 목차"`, `mobileSidebarTitle: "사용자 가이드"`
  - `dict/en/docs.ts`: `mobileSidebarToggle: "Guide contents"`, `mobileSidebarTitle: "User Guide"`
- [ ] TDD: 단위 테스트 선작성
  - SlideDrawer side="left" 시 left-0 / -translate-x-full 클래스 적용
  - SlideDrawer 기본값(=right) 동작 회귀 없음
  - DocsMobileSidebar 토글 라벨에 현재 섹션·페이지 라벨이 나타남
  - 열림 → pathname 변경 → 자동 close
  - 활성 항목 scrollIntoView 호출 (mock)
- [ ] TEST WORKFLOW: lint → unit → build → e2e (e2e: 본 변경은 UI 진입만, e2e 보호 영역은 가이드 라우팅 — 화이트리스트 후보 검토)
- [ ] /ai-review 통과 + 필요 시 resolution-applier 처리

## 사전 일관성 검토 (BLOCK: NO)

`review/consistency/2026/05/26/11_04_31/` 의 5 checker 결과 — Critical 0, WARNING 3건 (모두 본 PR 차단 아님). 핵심 WARNING:

1. `_layout.md §2.4` (글로벌 사이드바 < 1280px) 와 docs 내부 breakpoint (< lg=1024px) 가 분리된 근거가 spec 에 미문서화 — 후속 spec-update plan 으로.
2. spec/2-navigation/13-user-guide.md §10 "검색 미포함" drift 가 본 변경으로 더 확대 (모바일 진입까지 추가) — 같은 후속 plan 으로.
3. SlideDrawer side prop 확장 시 기존 호출처 회귀 주의 — 단위 테스트로 보장.

## Drift 후속 처리 — `plan/in-progress/spec-update-user-guide-mobile.md`

본 PR 머지 후 또는 동시에 project-planner 가 spec 본문 정정. 본 task 의 책임은 후속 plan 노트 작성까지.

## Side-effect 검토

- 글로벌 앱 사이드바 (`components/layout/sidebar.tsx`) 는 SlideDrawer 미사용 → 영향 0.
- SlideDrawer side prop optional + default "right" → 기존 호출처 2곳 동작 불변.
- `aria-modal` / focus trap / body scroll lock 은 SlideDrawer 가 이미 처리 → 신규 컴포넌트가 별도 a11y 처리 불필요.

## PR 본문 메모 (review 시 참고)

- breakpoint 분리 의도: `/docs` 내부 사이드바는 lg=1024px, 글로벌 사이드바는 1280px — 별도 컨텍스트로 의도적 분리. 후속 spec-update plan 으로 §10 정식 문서화 예정.
