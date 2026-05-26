# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — spec과 구현 간 불일치(CRITICAL 1건), 다수의 테스트 누락 및 유지보수성 경고(WARNING 11건) 존재. 프로덕션 보안·기능 결함은 없으나 pathname auto-close 동작 명세와 구현 간 괴리, labeled break 등의 코드 관용성 문제가 조속한 해소를 요구함.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Spec Fidelity | `spec/2-navigation/13-user-guide.md §10` 표가 구현과 불일치 — "검색: 현재는 미포함" 명시, 모바일 진입 항목 아예 없음. 구현은 이미 DocsSearch 및 DocsMobileSidebar 를 노출 중 | `spec/2-navigation/13-user-guide.md §10` | `spec-update-user-guide-mobile.md` plan 에 따라 project-planner 가 §10 표 갱신(검색 행, 모바일 진입 행) 수행. 즉시 `spec/2-navigation/13-user-guide.md` frontmatter 에 `pending_plans: [spec-update-user-guide-mobile]` 등록 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | Requirement / Scope | plan·JSDoc 이 약속한 "usePathname 변경 시 자동 close" 미구현 — 실제 구현은 anchor click capture 방식만 처리. programmatic navigation / 브라우저 back-forward 시 drawer 미닫힘 | `docs-mobile-sidebar.tsx` 전체; `plan/in-progress/docs-mobile-sidebar.md` | `useEffect(() => { setOpen(false); }, [pathname])` 추가, 또는 JSDoc·plan 체크리스트 문구를 "anchor 클릭 시 자동 close" 로 정정하고 react-compiler 제약 근거 명시 |
| W-2 | Testing | plan 명시 "열림 → pathname 변경 → 자동 close" 테스트 케이스 미작성 | `docs-mobile-sidebar.test.tsx` | pathname auto-close 구현 확정 후 해당 테스트 추가. 미작성 상태로 머지 시 plan 체크리스트에 거짓 완료 표시 잔존 |
| W-3 | Testing | SlideDrawer body scroll lock(`openDrawerCount` 기반) 동작 테스트 전무 — 열림 시 overflow hidden, 닫힘 시 복원, 중첩 drawer 시나리오 모두 미검증 | `slide-drawer.test.tsx` | drawer open/close 전후 `document.body.style.overflow` 값 및 중첩 케이스 단언 추가 |
| W-4 | Testing | SlideDrawer overlay 클릭 / 닫기 버튼 클릭 → onClose 호출 테스트 누락 (Escape 케이스만 커버) | `slide-drawer.test.tsx` | overlay div 클릭, `aria-label="common.close"` 버튼 클릭 시 onClose 호출 테스트 추가 |
| W-5 | Testing | DocsMobileSidebar — `aria-expanded` 상태 변화(초기 false → 클릭 후 true) 테스트 누락 | `docs-mobile-sidebar.test.tsx` | 초기 `aria-expanded="false"` 및 클릭 후 `aria-expanded="true"` 단언 추가 |
| W-6 | Testing | DocsMobileSidebar — 매칭 페이지 없는 경로(엣지 케이스) 테스트 누락 | `docs-mobile-sidebar.test.tsx` | `currentPathname = "/docs/ko/unknown-page"` 설정 후 chevron·섹션·페이지 텍스트 미표시 검증 추가 |
| W-7 | Maintainability | `docs-mobile-sidebar.tsx` `outer:` labeled break 사용 — JS/TS 코드베이스에서 비관용적, 가독성 저하 | `docs-mobile-sidebar.tsx` | `findActivePageInfo(sections, pathname, locale)` 헬퍼 함수로 추출해 early return 으로 대체 |
| W-8 | Maintainability | `slide-drawer.tsx` `h-[calc(100%-65px)]` 매직 넘버 — 헤더 높이 변경 시 silently break 위험 | `slide-drawer.tsx` | CSS 변수 / named constant 추출, 또는 flex 레이아웃(`shrink-0` 헤더 + `flex-1` 컨텐츠)으로 고정값 의존 제거 |
| W-9 | Side Effect / Testing | `Element.prototype.scrollIntoView` 전역 프로토타입 교체 후 `afterEach` 미복원 — 후속 테스트 오염 가능성 | `docs-mobile-sidebar.test.tsx` | 테스트 전 원본 저장 후 afterEach 복원, 또는 `vi.spyOn(Element.prototype, "scrollIntoView")` 로 교체해 자동 복원 |
| W-10 | Architecture / Testing | `openDrawerCount` 모듈-레벨 가변 변수 — 테스트에서 명시적 리셋 없어 edge case 시 카운터 누출 가능성 | `slide-drawer.tsx`; `slide-drawer.test.tsx`, `docs-mobile-sidebar.test.tsx` `afterEach` | `__resetForTesting()` export 후 afterEach 에서 호출, 또는 `vi.resetModules()` 적용 |
| W-11 | Requirement | 토글 버튼 `onClick={() => setOpen(true)}` 가 항상 열기만 — `aria-expanded` 있으나 재클릭 닫기 불가, 스크린 리더 UX 기대 불충족 | `docs-mobile-sidebar.tsx` | `onClick={() => setOpen((prev) => !prev)}` 로 변경, 또는 열기 전용 의도라면 `aria-expanded` 제거 및 주석 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | Architecture | `DocsMobileSidebar` 내 pathname → (sectionLabel, pageTitle) 매핑 로직이 렌더 함수 본문에 직접 포함 — 동일 로직 복수 컴포넌트 확산 시 DRY 위반 위험 | `docs-mobile-sidebar.tsx` | 2곳 이상 사용 시점에 `@/lib/docs/` 헬퍼 함수(`resolveActivePageMeta`)로 추출 |
| I-2 | Documentation | JSDoc "usePathname 변경 시 자동 close" 문구가 실제 구현(click capture)과 불일치 — 유지보수자 혼동 유발 | `docs-mobile-sidebar.tsx` | JSDoc 부수 동작 항목을 "anchor 클릭 시 자동 close (click capture — react-compiler 규약 준수)"로 정정 |
| I-3 | Documentation | `DocsMobileSidebarProps` 인터페이스에 props JSDoc 없음 (`SlideDrawerProps.side` 와 일관성 불일치) | `docs-mobile-sidebar.tsx` | `sections`, `entriesByLocale` 각 필드에 JSDoc 주석 추가 |
| I-4 | Documentation | `plan/in-progress/docs-mobile-sidebar.md` 체크리스트가 모두 `[ ]` 미완료 표시 — 코드 구현 상태와 불일치 | `plan/in-progress/docs-mobile-sidebar.md` | 완료 항목 `[x]` 처리 또는 완료 섹션 이동 |
| I-5 | Documentation | `plan/in-progress/spec-update-user-guide-mobile.md` 에 `R-x` 번호 미확정 | `plan/in-progress/spec-update-user-guide-mobile.md` | 기존 Rationale 번호 조회 후 실제 번호로 교체 |
| I-6 | Documentation | i18n 키 `mobileSidebarToggle`, `mobileSidebarTitle` 에 용도 설명 주석 없음 | `en/docs.ts`, `ko/docs.ts` | 각 키 위에 용도 주석 추가 |
| I-7 | Documentation | `SlideDrawerProps.side` JSDoc 이 특정 경로(`/docs`)를 하드코딩 — 재사용 시 낡은 주석 인상 | `slide-drawer.tsx` | 경로 대신 목적("좌측 패널 보조 네비") 설명으로 교체 |
| I-8 | Maintainability | import 중복 — 동일 모듈에서 type import 두 줄 분리 | `docs-mobile-sidebar.test.tsx` | `import type { DocsSection, DocsSearchEntry } from "@/lib/docs/registry"` 로 합치기 |
| I-9 | Security | `Element.prototype.scrollIntoView` 전역 프로토타입 교체 복원 누락 — 보안 이슈 아닌 테스트 격리 문제 | `docs-mobile-sidebar.test.tsx` | (W-9 와 동일 조치) |
| I-10 | Security | `openDrawerCount` 모듈-레벨 변수 — `"use client"` 유지 조건부 현재 위험 없음, SSR 이동 금지 주석 권장 | `slide-drawer.tsx` | 주석에 "클라이언트 전용 모듈-레벨 변수, SSR 이동 금지" 명시 |
| I-11 | Testing | 모든 테스트가 `ko` locale 고정 — `en` locale 시 토글 라벨 i18n 경로 미검증 | `docs-mobile-sidebar.test.tsx` | `en` locale 설정 후 토글 라벨 검증 케이스 추가(선택) |
| I-12 | Testing | `layout.tsx` 반응형 flex 방향 변경에 대한 e2e 검증 없음 | `layout.tsx` | 모바일/데스크탑 viewport 별 토글 버튼·aside 표시 e2e 케이스 추가 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 위험 없는 순수 UI 변경. 테스트 전역 프로토타입 복원 누락(격리 이슈) |
| architecture | LOW | 서버-클라이언트 경계·OCP·DRY 양호. `openDrawerCount` 테스트 격리 위험 |
| requirement | MEDIUM | spec §10 불일치(CRITICAL), pathname auto-close 미구현, 토글 버튼 aria-expanded UX 불일치 |
| scope | LOW | 범위 내 미구현 gap(pathname auto-close). 범위 초과 없음 |
| side_effect | LOW | 전역 프로토타입 미복원, `openDrawerCount` 테스트 오염 가능성. 프로덕션 부작용 없음 |
| maintainability | MEDIUM | `outer:` labeled break, `calc(100%-65px)` 매직 넘버 주요 유지보수 위험 |
| testing | MEDIUM | pathname auto-close·body scroll lock·overlay close·aria-expanded·엣지케이스 등 다수 테스트 누락 |
| documentation | LOW | spec §10 drift(WARNING), JSDoc 불일치, plan 체크리스트 미완료 표시 |
| user_guide_sync | NONE | i18n parity 충족, 하드코딩 한국어 없음, 동반 갱신 누락 없음 |

---

## 라우터 결정 — 5건 skip

| Reviewer | Skip 이유 |
|---|---|
| performance | UI 렌더 조건부 분기만, I/O·캐시·집계 변경 없음 |
| dependency | package.json / lock 파일 변경 없음 |
| database | DB 쿼리·마이그레이션·ORM 변경 없음 |
| concurrency | async/await, Promise, 락/뮤텍스 코드 변경 없음 |
| api_contract | HTTP route/GraphQL/swagger 변경 없음, 내부 컴포넌트 props 만 추가 |

강제 포함(router_safety): security, requirement, scope, side_effect, maintainability, testing, documentation.

---

## 권장 조치사항

1. **[CRITICAL — 후속 spec-update plan 으로 분리됨]** `spec/2-navigation/13-user-guide.md §10` 표 갱신은 `plan/in-progress/spec-update-user-guide-mobile.md` 가 이미 담당. project-planner 위임 대상.
2. **[머지 전 필수]** "pathname 변경 시 자동 close" 구현 (`useEffect` 사용) 또는 JSDoc·plan 문구를 "anchor 클릭 시 자동 close" 로 정정 — 의도·구현 일관성 확보.
3. **[머지 전 필수]** 토글 버튼 `onClick` 을 `setOpen((prev) => !prev)` 로 변경하거나, `aria-expanded` 제거 — WAI-ARIA 계약 충족.
4. **[머지 전 권장]** `scrollIntoView` mock 을 `vi.spyOn(Element.prototype, "scrollIntoView")` 로 교체해 자동 복원 + plan 의 체크리스트 `[x]` 갱신.
5. **[후속 작업 가능]** `outer:` labeled break → 헬퍼 함수, `h-[calc(100%-65px)]` → flex, scroll lock·overlay·aria-expanded 테스트 추가, 매직 넘버 제거.
