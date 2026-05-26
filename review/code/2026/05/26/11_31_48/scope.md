# 변경 범위(Scope) 리뷰 결과

리뷰 대상: docs-mobile-sidebar 작업
리뷰 일시: 2026-05-26

---

## 발견사항

### [INFO] layout.tsx — Tailwind 레이아웃 클래스 변경이 모바일 지원을 위한 필수 수정으로 범위 내
- 위치: `codebase/frontend/src/app/(main)/docs/layout.tsx` diff (outer div className)
- 상세: `"flex w-full gap-6 px-4 py-6 lg:px-8"` → `"flex w-full flex-col gap-3 px-4 py-6 lg:flex-row lg:gap-6 lg:px-8"` 변경은 모바일 환경에서 `DocsMobileSidebar` 토글 버튼과 본문 article 을 수직 스택으로 배치하기 위한 것이다. 모바일 사이드바 추가와 직결된 변경으로 범위를 이탈하지 않는다.
- 제안: 조치 불필요.

---

### [INFO] docs-mobile-sidebar.tsx — 신규 파일 전체가 계획된 범위
- 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` (신규)
- 상세: plan `docs-mobile-sidebar.md` 체크리스트에 명시된 `DocsMobileSidebar` 컴포넌트 그대로다. 구현 내용(sticky 토글 버튼, SlideDrawer side="left", scrollIntoView, click-capture close, usePathname 매칭, i18n 키 사용)이 모두 plan 에서 지정한 항목과 1:1 대응한다.
- 제안: 조치 불필요.

---

### [INFO] docs-mobile-sidebar.test.tsx — 신규 파일 전체가 계획된 범위
- 위치: `codebase/frontend/src/components/docs/__tests__/docs-mobile-sidebar.test.tsx` (신규)
- 상세: plan 체크리스트의 TDD 항목(토글 라벨 노출, drawer 열림/닫힘, 링크 클릭 시 자동 close, scrollIntoView 호출) 을 정확히 커버하는 테스트다. 불필요한 추가 테스트 케이스는 없다.
- 제안: 조치 불필요.

---

### [INFO] slide-drawer.tsx — side prop 추가가 계획된 최소 변경
- 위치: `codebase/frontend/src/components/ui/slide-drawer.tsx` diff
- 상세: 변경은 (1) `SlideDrawerProps` 에 `side?: "left" | "right"` JSDoc 포함 추가, (2) 구현부 `side = "right"` default 파라미터 + `isLeft` 불린 도출, (3) `className` 에서 side 분기 CSS 조건 3줄 — 총 변경 11줄. 기존 로직(Escape 처리, body scroll lock, FocusScope, aria 속성, header/content 구조)은 일절 변경되지 않았다. 범위 최소 원칙에 부합한다.
- 제안: 조치 불필요.

---

### [INFO] slide-drawer.test.tsx — 신규 파일이 side prop 확장 범위를 정확히 커버
- 위치: `codebase/frontend/src/components/ui/__tests__/slide-drawer.test.tsx` (신규)
- 상세: 7개 테스트가 side prop 동작(right default, left 클래스, 숨김 translate 방향, 열림 translate-x-0, Escape onClose) 을 명확히 검증한다. 기존 `SlideDrawer` 의 다른 기능(body scroll lock, FocusScope 동작 등)에 대한 범위 밖 테스트는 포함되어 있지 않아 적절한 수준이다.
- 제안: 조치 불필요.

---

### [INFO] i18n ko/en docs.ts — 2개 키 추가가 계획된 범위
- 위치: `codebase/frontend/src/lib/i18n/dict/ko/docs.ts`, `codebase/frontend/src/lib/i18n/dict/en/docs.ts`
- 상세: plan 체크리스트에 명시된 `mobileSidebarToggle`, `mobileSidebarTitle` 두 키가 ko/en 동시에 추가됐다. 다른 기존 키의 값 수정, 키 삭제, 정렬 변경은 없다.
- 제안: 조치 불필요.

---

### [INFO] plan/in-progress/docs-mobile-sidebar.md — plan 파일 신규 생성은 범위 내
- 위치: `plan/in-progress/docs-mobile-sidebar.md` (신규)
- 상세: CLAUDE.md 규약상 진행 중 작업은 `plan/in-progress/` 에 기록한다. 본 파일은 프로젝트 규약에 따른 필수 산출물이다.
- 제안: 조치 불필요.

---

### [INFO] plan/in-progress/spec-update-user-guide-mobile.md — 후속 plan 노트는 developer 범위 내
- 위치: `plan/in-progress/spec-update-user-guide-mobile.md` (신규)
- 상세: CLAUDE.md 규약에서 developer 는 spec 수정 없이 plan 노트 작성은 허용된다. plan 파일 안에서도 "spec 수정은 project-planner 위임 대상" 임을 명시하고 있으며, spec 파일 자체는 이 PR 에 포함되지 않는다. 범위 이탈이 아니다.
- 제안: 조치 불필요.

---

### [INFO] review/consistency/2026/05/26/11_04_31/ 산출물 — 사전 일관성 검토 결과물로 범위 내
- 위치: `review/consistency/2026/05/26/11_04_31/_retry_state.json`, `convention_compliance.md`, `cross_spec.md` 외 동일 세션 파일
- 상세: CLAUDE.md 규약상 consistency-check 산출물은 `review/consistency/<날짜>/` 에 저장된다. plan 에도 "사전 일관성 검토 (BLOCK: NO)" 절에서 이 디렉토리를 명시적으로 참조하므로 의도된 산출물이다.
- 제안: 조치 불필요.

---

### [WARNING] docs-mobile-sidebar.tsx 내 `usePathname` 으로 pathname 을 읽지만 pathname 변경 시 자동 close effect 가 구현 코드에 부재
- 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` L37, plan 체크리스트 항목 "usePathname 변경 시 setOpen(false) 자동 close"
- 상세: plan 체크리스트에 "usePathname 변경 시 setOpen(false) 자동 close" 가 명시되어 있고, JSDoc 주석에도 "`usePathname` 변경 시 자동 close (페이지 이동 후 drawer 가 남는 회귀 방지)" 라고 기재되어 있다. 그러나 구현 코드에는 `const pathname = usePathname()` 선언만 있을 뿐 pathname 변경에 반응하는 `useEffect(() => { setOpen(false); }, [pathname])` 또는 동등한 로직이 없다. 테스트 파일에도 이 케이스("열림 → pathname 변경 → 자동 close")는 plan 에는 명시됐으나 실제 테스트 케이스로 작성되지 않았다. `pathname` 변수가 현재 페이지 매칭 계산에만 사용되고 있어 close 동작은 실제로 구현되지 않은 상태이다.
  - 코드 주석, plan 설명, 구현 코드 3자 간 불일치.
  - 이는 "범위 초과"가 아닌 "범위 내 누락(under-delivery)" 이지만, 범위 리뷰 관점에서 선언된 범위와 실제 구현 범위의 gap 으로 기록한다.
- 제안: `useEffect(() => { setOpen(false); }, [pathname])` 를 추가하거나, JSDoc/주석/plan 에서 해당 항목을 제거해 일관성을 맞출 것.

---

## 요약

변경 범위(Scope) 관점에서 본 PR 은 plan `docs-mobile-sidebar.md` 에 선언된 작업 체크리스트와 전반적으로 잘 일치한다. 의도하지 않은 리팩토링, 무관한 파일 수정, 불필요한 기능 확장, 포맷팅 혼입은 발견되지 않았다. 한 가지 주의 사항은 plan 과 JSDoc 에 명시된 "pathname 변경 시 자동 close" 동작이 구현 코드에 반영되지 않아 선언된 범위 내 미구현 gap 이 존재한다는 점이다. 이는 범위 초과가 아닌 범위 내 누락으로, 수정 또는 설명 일치가 필요하다.

---

## 위험도

LOW
