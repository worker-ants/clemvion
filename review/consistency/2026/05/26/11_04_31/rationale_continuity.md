# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`
대상 변경 의도: docs 모바일 사이드바 진입 추가 (DocsMobileSidebar + SlideDrawer `side` prop + i18n 키)
참조 spec: `spec/2-navigation/13-user-guide.md`, `spec/2-navigation/_layout.md`

---

## 발견사항

- **[WARNING]** docs 내부 사이드바 breakpoint(lg=1024px)와 글로벌 레이아웃 §2.4 기준(< 1280px) 불일치 — 차단 여부 미결
  - target 위치: 변경 의도 — `codebase/frontend/src/app/(main)/docs/layout.tsx` 에 `lg:hidden` 모바일 토글 추가
  - 과거 결정 출처: `spec/2-navigation/_layout.md §2.4` — "< 1280px: 사이드바 숨김, 햄버거 메뉴로 토글"
  - 상세: `_layout.md §2.4`는 글로벌 앱 사이드바에 대해 `< 1280px`에서 햄버거를 쓰도록 정의한다. 현재 docs layout은 `lg:block`(lg=1024px)으로 `< 1024px`에서만 사이드바를 숨기는데, 본 task는 이 `< 1024px` 기준을 그대로 유지하면서 모바일 토글을 추가하려 한다. §2.4의 breakpoint는 글로벌 사이드바에 대한 것이고 docs 내부 사이드바에 명시적으로 적용된 기록이 없으므로 CRITICAL은 아니다. 그러나 동일 `(main)` 레이아웃 그룹 안에서 글로벌 사이드바(1280px 기준)와 docs 내부 사이드바(1024px 기준)가 상이하게 동작하는 근거 Rationale이 spec 어디에도 없다. 향후 `_layout.md §2.4`를 읽는 사람이 "docs도 1280px에서 햄버거로 전환해야 하는가" 혼란을 겪을 수 있다.
  - 제안: `spec/2-navigation/_layout.md §2.4` 비고 또는 `13-user-guide.md §10`에 "docs 내부 사이드바는 독립적인 lg=1024px breakpoint를 사용하며 §2.4 글로벌 기준과 의도적으로 분리한다"는 한 줄 Rationale을 추가한다. 또는 본 task의 plan 문서(후속 spec-update plan)에 이 분리 근거를 명시한다.

- **[WARNING]** `spec/2-navigation/13-user-guide.md §10` "검색 미포함" 기술과 실제 구현(DocsSearch) 간 drift — 모바일 사이드바가 DocsSearch를 재사용하면서 drift 확대
  - target 위치: 변경 의도 — `DocsMobileSidebar`가 `DocsSearch`를 포함하여 재사용
  - 과거 결정 출처: `spec/2-navigation/13-user-guide.md §10` — "검색: 현재는 미포함. 콘텐츠 증가 시 별도 추가"
  - 상세: spec §10은 검색을 "미포함"으로 명시했으나 구현에는 이미 `DocsSearch`가 존재한다. 본 task가 `DocsMobileSidebar`에 `DocsSearch`를 포함시키면, spec 텍스트 "검색 미포함"과 달리 모바일에서도 검색이 제공되는 구현이 된다. 본 task scope 밖의 drift라고 명시했으나, 모바일 사이드바 구현이 이 drift를 더 넓히는 결과를 낳는다. 기각된 결정은 아니지만 합의된 spec 기술과 반대 방향으로 멀어지는 변경이다.
  - 제안: 후속 `plan/in-progress/spec-update-user-guide-mobile.md`에서 §10 "검색" 행을 "DocsSearch 포함 (데스크탑 및 모바일 사이드바 공통 제공)"으로 정정하도록 명시한다. 본 task에서 `DocsMobileSidebar`에 `DocsSearch` 포함 여부를 결정할 때 이 drift 확대를 인지하고 선택한다.

- **[INFO]** `SlideDrawer`에 `side?: "left" | "right"` prop 추가 — 기각된 결정 없음, 기존 사용처 영향 확인 필요
  - target 위치: 변경 의도 — `codebase/frontend/src/components/ui/slide-drawer.tsx`에 `side` prop 추가
  - 과거 결정 출처: 해당 없음 (SlideDrawer에 대한 side 방향 기각 이력 없음)
  - 상세: 기존 `SlideDrawer` 구현은 `right-0`, `translate-x-full`로 오른쪽 고정이다. 현재 사용처는 `trigger-detail-drawer.tsx`, `authentication/page.tsx`, `integrations/_shared/service-picker-modal.tsx` 3곳이며 모두 side prop을 명시하지 않는다. `default "right"` 채택 시 기존 사용처 동작 변경 없음. 기각된 Rationale 없음. 다만 `border-l`(왼쪽 border)도 side에 따라 조건부로 변경해야 일관성을 유지한다는 점은 구현 주의사항.
  - 제안: 구현 시 `border-l`을 `side==="left"` 시 `border-r`로 교체하는 조건부 처리를 누락하지 않도록 주의. Rationale 추가는 불필요.

- **[INFO]** i18n 키 `mobileSidebarToggle` / `mobileSidebarTitle` 추가 — ko/en parity 정책과 합치
  - target 위치: 변경 의도 — `dict/{ko,en}/docs.ts` 양쪽 동시 추가
  - 과거 결정 출처: 해당 없음 (i18n ko/en parity 위반 Rationale 없음)
  - 상세: 두 locale dict에 동시 추가이므로 parity 위반이 아니다. 기존 `docs.ts` 구조와 일관. 충돌 없음.
  - 제안: 없음.

- **[INFO]** `DocsMobileSidebar` 식별자 naming collision 없음 확인
  - target 위치: 변경 의도 — `docs-mobile-sidebar.tsx` 신규 생성
  - 과거 결정 출처: 해당 없음
  - 상세: `grep` 결과 `DocsMobileSidebar`, `docs-mobile-sidebar`, `mobileSidebarToggle`, `mobileSidebarTitle` 모두 기존 codebase에 없음. 충돌 없음.
  - 제안: 없음.

---

## 요약

본 task의 변경 의도는 기존 spec Rationale에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant를 직접 위반하는 요소는 없다. 주요 Rationale 연속성 주의 사항은 두 가지다. 첫째, `_layout.md §2.4`의 글로벌 사이드바 breakpoint(1280px)와 docs 내부 사이드바 breakpoint(lg=1024px)가 다른 근거가 어디에도 문서화되어 있지 않아, 이 분리가 의도적 결정임을 Rationale로 남기지 않으면 향후 혼란을 유발할 수 있다. 둘째, spec §10의 "검색 미포함" 기술은 이미 구현 drift 상태이고, `DocsMobileSidebar`에 `DocsSearch`를 포함시키면 이 drift가 더 넓어지므로 후속 spec 정정 plan(`spec-update-user-guide-mobile.md`)에 §10 검색 행 수정을 포함시켜야 한다. SlideDrawer `side` prop 추가와 i18n 키 추가는 기각된 결정 없이 안전하게 진행 가능하다.

---

## 위험도

MEDIUM
