# Cross-Spec 일관성 검토 결과

- 검토 대상: `plan/in-progress/spec-update-user-guide-mobile.md`
- 검토 모드: `--spec`
- 검토 일시: 2026-05-26

---

## 발견사항

### [WARNING] `13-user-guide.md §10` 검색 행 현황 vs. `_product-overview.md` NAV-UG-07 상태 불일치
- target 위치: plan §정정 후보 — "검색" 행, 정정안 "DocsSearch 로 제공"
- 충돌 대상: `spec/2-navigation/_product-overview.md` 행 NAV-UG-07 (`문서 내 검색 기능 | 권장 | ✅`)
- 상세: `_product-overview.md` NAV-UG-07 은 이미 `✅` 로 구현 완료를 표기하고 있다. 그런데 `13-user-guide.md §10` 의 "검색: 현재는 미포함. 콘텐츠 증가 시 별도 추가" 는 NAV-UG-07 의 `✅` 상태와 정면으로 모순된다. target plan 은 §10 본문만 수정하고 있으며 `_product-overview.md` NAV-UG-07 행은 건드리지 않는다. 그러나 두 문서가 이미 불일치 상태이므로, plan 이 §10 을 수정하면 NAV-UG-07 과의 일관성은 자동으로 회복된다.
- 제안: plan 의 체크리스트에 `_product-overview.md NAV-UG-07 상태 열 확인 (이미 ✅ — 별도 수정 불필요)` 항목을 INFO 로 추가해 명시한다. 추가 수정 없이 §10 정정만으로 두 문서가 정합이 된다.

---

### [WARNING] `13-user-guide.md` frontmatter `status` 전이 미언급 — `spec-impl-evidence` 컨벤션 의무 충족 필요
- target 위치: plan §정정 후보 — "frontmatter `pending_plans` 등록"
- 충돌 대상: `spec/conventions/spec-impl-evidence.md §3` — `partial` 상태 시 `pending_plans:` 의무; 가드 `spec-pending-plan-existence.test.ts` / `spec-status-lifecycle.test.ts`
- 상세: 현재 `13-user-guide.md` 의 frontmatter 는 `status: spec-only, code: []` 다. plan 은 `pending_plans: [spec-update-user-guide-mobile]` 등록만 언급하지만, `pending_plans:` 는 `status: partial` 일 때만 의무이고 `spec-only` 상태에서는 가드가 이 키를 검증하지 않는다. 반대로 `spec-only` 에 `pending_plans:` 를 등록하면 `spec-pending-plan-existence.test.ts` 가 해당 path 의 `plan/in-progress/` 실존을 검사하므로, plan 파일이 머지 후 `plan/complete/` 로 이동되면 가드 실패가 발생한다.
  - 한편 §10 에 모바일 진입 + 검색 행이 추가되면 이미 `DocsSearch` + `DocsMobileSidebar` 코드가 구현돼 있으므로 `status` 를 `implemented` 로 전이하고 `code:` 를 채워야 `spec-status-lifecycle.test.ts` 의 `spec-only TTL 90일` + `code: []` 가드 누적을 피할 수 있다.
  - plan 에는 `status` 전이 및 `code:` 갱신이 명시적으로 언급되어 있지 않다.
- 제안: plan 체크리스트에 두 항목을 추가한다. (1) 머지 시 `status: spec-only → implemented` 로 승격하고 `code:` 에 `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx`, `codebase/frontend/src/components/docs/docs-search.tsx`, `codebase/frontend/src/app/(main)/docs/layout.tsx` 경로를 등록한다. (2) `pending_plans:` 는 `status: partial` 이 아닌 경우 불필요하므로 등록을 생략하거나, 만약 등록한다면 `status: partial` 로 먼저 전이한 뒤 plan 완료 후 `implemented` 로 승격하는 2단계 절차를 명시한다.

---

### [WARNING] `_layout.md §2.4` 반응형 표와 신규 breakpoint 이분법 사이의 암묵적 충돌 가능성
- target 위치: plan §정정 후보 — 모바일 진입 "< lg(1024px) 에서 article 상단의 토글 버튼"; 신규 Rationale R-x
- 충돌 대상: `spec/2-navigation/_layout.md §2.4` — 글로벌 사이드바 반응형 표 (`≥ 1440px`, `1280px~1439px`, `< 1280px`)
- 상세: `_layout.md §2.4` 의 글로벌 사이드바 breakpoint(< 1280px 햄버거) 와 `/docs` 내부 사이드바 breakpoint(< lg = < 1024px 모바일 토글) 는 서로 다르다. plan 의 신규 Rationale R-x 가 이 차이를 "별 컨텍스트(전역 vs 페이지 내부)"로 설명하고 있어 _의도적_ 차이임을 인지하고 있다. 그러나 실제 구현(`docs/layout.tsx` + `docs-mobile-sidebar.tsx` 의 `lg:hidden`, `lg:block`) 을 보면 Tailwind 기본 `lg` = 1024px 을 그대로 사용하고 있어 plan 의 정정안과 일치한다. 충돌 자체는 없으나, `_layout.md §2.4` 표가 `/docs` 경로를 특수 취급한다는 주석이 없어 독자가 오해할 수 있다.
- 제안: plan 의 Rationale R-x 를 `13-user-guide.md` 에 추가하는 것 외에, `_layout.md §2.4` 표 하단에 "단, `/docs` 내부 사이드바(DocsSidebar)는 page-internal 네비 특성상 별도 breakpoint(lg = 1024px)를 사용 — 상세는 [`13-user-guide.md §10 Rationale`](./13-user-guide.md)" 형태의 각주를 추가하면 교차 참조 단절을 막을 수 있다. 이는 필수는 아니지만 동기화 권장 수준.

---

### [INFO] `spec/0-overview.md §3.5` 최소 해상도 1280px vs. `/docs` 1024px 모바일 지원
- target 위치: plan §정정 후보 — "< lg(1024px) 에서 article 상단의 토글 버튼"
- 충돌 대상: `spec/0-overview.md §3.5` — "최소 해상도: 1280x720"
- 상세: `0-overview.md §3.5` 는 제품 최소 지원 해상도를 1280x720 으로 명시한다. 그런데 `/docs` 의 모바일 토글은 `< lg` = `< 1024px` 범위에서 동작하며, 이는 1280px 미만 구간에 해당한다. 엄밀히는 `/docs` 가 1280px 미만 사용자에게 기능을 제공하는 것이 `§3.5` 의 "최소 해상도 1280x720" 선언과 상충한다. 다만 `§3.5` 의 주석을 보면 "에디터는 데스크탑 전용 (모바일에서는 뷰어 모드만 제공)"이 있어, 에디터만 1280px 이상 전용이고 `/docs` 같은 열람형 페이지는 그 아래에서도 지원할 수 있음이 맥락적으로 암시된다. 하지만 명문화되어 있지는 않다.
- 제안: plan 에서 Rationale R-x 를 작성할 때 `0-overview.md §3.5` 와의 관계를 짧게 언급하거나, `0-overview.md §3.5` 에 "/docs 와 같은 비에디터 페이지는 1024px 이하에서도 최소 열람 기능을 제공한다" 취지의 단서를 추가한다. 현재 상태로 머지해도 기능 충돌은 없으나 스펙 독자에게 혼동을 줄 수 있다.

---

### [INFO] `R-x` 식별자 미정 — `13-user-guide.md` 기존 Rationale 항 없음, 충돌 없음
- target 위치: plan §정정 후보 — "신규 Rationale `R-x` 추가"
- 충돌 대상: `spec/2-navigation/13-user-guide.md` (Rationale 섹션 없음)
- 상세: `13-user-guide.md` 에는 현재 `## Rationale` 섹션이 없고, 다른 2-navigation 파일들의 Rationale R-N 식별자(`_layout.md: R-1, R-2`, `2-trigger-list.md: R-1~R-13`, `10-auth-flow.md: R-1, R-2` 등)는 각 파일 내 로컬 번호이므로 cross-file 충돌이 없다. `R-x` 를 `R-1` 로 확정하면 된다.
- 제안: plan 의 "R-x" 를 "R-1" 로 확정한다.

---

## 요약

target plan (`spec-update-user-guide-mobile`) 은 `spec/2-navigation/13-user-guide.md §10` 의 검색·모바일 진입 기술 누락을 정정하고 breakpoint 차이에 대한 Rationale 을 추가하는 내용이다. 데이터 모델, API 계약, RBAC 충돌은 없으며, 상태 전이·엔티티 정의와도 직접 모순이 없다. 다만 두 가지 WARNING 이 발견되었다. 첫째, `_product-overview.md` NAV-UG-07 이 이미 `✅` 를 표기하고 있어 §10 의 "미포함" 표기가 PRD 와 어긋나 있는데, plan 의 §10 정정으로 이것이 해소되므로 추가 수정은 불필요하다. 둘째, `spec-impl-evidence` 컨벤션에 따라 spec 머지 시 `status: spec-only → implemented` 전이와 `code:` 경로 갱신이 필요하나 plan 체크리스트에 명시되어 있지 않으며, `pending_plans:` 등록 방식도 `partial` 전이 절차와의 정합 확인이 필요하다. INFO 수준으로 `_layout.md §2.4` 와 `0-overview.md §3.5` 에 교차 참조 보완 및 열람형 페이지 해상도 예외 단서 추가를 권장한다. 전체적으로 기능 차단 수준의 모순은 없고, frontmatter/가드 준수 절차 누락이 주요 리스크다.

---

## 위험도

LOW
