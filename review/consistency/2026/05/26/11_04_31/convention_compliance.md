# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep`
검토 대상 spec: `spec/2-navigation/13-user-guide.md`, `spec/2-navigation/_layout.md`
변경 의도 요약: `/docs` 레이아웃에 모바일 토글 추가, `DocsMobileSidebar` 신규 컴포넌트, `SlideDrawer` side prop 확장, i18n docs 키 2개 추가

---

## 발견사항

### [INFO] `spec/2-navigation/_layout.md` frontmatter 누락 — 제외 대상이므로 위반 아님
- target 위치: `spec/2-navigation/_layout.md` 파일 최상단
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1`
- 상세: `_layout.md` 는 `_` prefix 파일로 §1 "제외" 목록에 명시적으로 포함됨(`_*.md` 및 `spec/<영역>/_*.md` 는 frontmatter 의무 제외). frontmatter 없는 현 상태가 정상이다. 확인 차원에서만 언급.
- 제안: 조치 불필요.

---

### [WARNING] `spec/2-navigation/_layout.md §2.4` 반응형 breakpoint 와 `/docs` 레이아웃의 `lg` breakpoint 불일치 — 구현 착수 전 확인 필요
- target 위치: `spec/2-navigation/_layout.md §2.4 반응형` — "< 1280px: 사이드바 숨김, 햄버거 메뉴로 토글"
- 위반 규약: `spec/2-navigation/_layout.md §2.4` (레이아웃 반응형 정의가 단일 진실)
- 상세: §2.4 는 글로벌 앱 사이드바에 대해 `< 1280px`(xl 미만)에서 햄버거 토글을 정의한다. 반면 `codebase/frontend/src/app/(main)/docs/layout.tsx` 의 `<aside className="hidden w-60 shrink-0 lg:block">` 는 `lg(1024px)` 이상에서만 사이드바를 노출하며, 이번 task 에서 추가하려는 모바일 토글도 `lg:hidden`(1024px 미만 노출) 기준이다. 즉 같은 앱 내에서 글로벌 사이드바는 1280px, docs 내부 사이드바는 1024px 기준으로 서로 다른 breakpoint 가 혼용된다.
  - `spec/2-navigation/_layout.md §2.4` 는 *글로벌 사이드바*를 명시하고 있어 `/docs` 내부의 별도 사이드바에 직접 적용되지 않을 수 있으나, 현재 spec 에는 `/docs` 내부 사이드바의 반응형 breakpoint 가 별도로 정의돼 있지 않아 drift 로 판단된다.
  - `spec/2-navigation/13-user-guide.md §10` 은 모바일 접근 자체를 정의하지 않고, 이 drift 가 누적되어 있음이 plan 에서도 인지됨(`plan/in-progress/spec-update-user-guide-mobile.md`로 후속 예정).
- 제안: 본 task 차단 사항은 아니다. 단 `codebase/frontend/src/app/(main)/docs/layout.tsx` 에 lg:hidden 모바일 토글을 추가하는 것은 §2.4 를 위반하는 것이 아니라 `/docs` 전용 breakpoint 를 사실상 코드로 선언하는 것임을 인지하고, 후속 spec 갱신(`spec/2-navigation/13-user-guide.md §10` 또는 `_layout.md` §2.4 하위 주석) 이 필요하다. 현 task 에서 `spec/` 를 건드리지 않는다면 drift 메모를 PR 본문에 명시하는 것이 충분하다.

---

### [WARNING] `SlideDrawer` 의 `side` prop 기본값(default "right") — 기존 3개 사용처와의 하위 호환성
- target 위치: `codebase/frontend/src/components/ui/slide-drawer.tsx` (기존 파일)
- 위반 규약: `spec/conventions/i18n-userguide.md` 직접 위반은 아니나, `SlideDrawer` 를 사용하는 기존 3개 사용처(`authentication/page.tsx`, `trigger-detail-drawer.tsx`, `service-picker-modal.tsx` 의 주석 참조)의 동작 가정과 관련
- 상세: 현재 `SlideDrawer` 는 항상 오른쪽(`right-0`, `translate-x-full`) 방향으로만 슬라이드된다. `side?: "left" | "right"` prop 을 추가하면서 `default "right"` 를 적용하면 기존 3개 사용처는 동작 변화 없이 통과한다. `service-picker-modal.tsx` 는 `SlideDrawer` 를 직접 사용하지 않고 동일 패턴을 복사한 독립 컴포넌트이므로 영향 없음. `authentication/page.tsx`, `trigger-detail-drawer.tsx` 는 `SlideDrawer` 를 직접 import — `default "right"` 이 보장되면 영향 없음.
  - CSS 클래스 변경 시 `right-0` / `translate-x-full` 이 조건부(`side === "right"`)로 바뀌고 `left-0` / `-translate-x-full` 이 side === "left" 분기로 추가돼야 한다. 기존 사용처 3곳에 `side` prop 미전달 시 default "right" 가 보장되는지는 구현 레벨 확인 필요.
- 제안: 기존 사용처 3곳(특히 `authentication/page.tsx:442`, `trigger-detail-drawer.tsx:116`) 에 `side` prop 추가 없이 동작이 동일한지 구현 시 단위 테스트로 보장하라.

---

### [WARNING] i18n 신규 키 `mobileSidebarToggle`, `mobileSidebarTitle` — ko/en 동시 추가 의무
- target 위치: `codebase/frontend/src/lib/i18n/dict/ko/docs.ts` 및 `codebase/frontend/src/lib/i18n/dict/en/docs.ts`
- 위반 규약: `spec/conventions/i18n-userguide.md §Principle 2` ("ko/en 사전 leaf key parity — 한쪽 사전에만 키가 존재하는 상태로 commit 금지") + 자동 가드: `i18n.test.ts` 의 `dict parity (ko ↔ en)` (hard fail)
- 상세: 변경 의도에 "ko/en 양쪽에 키 2개 추가" 가 명시돼 있으므로 parity 의도는 맞다. 현재 `dict/ko/docs.ts` 와 `dict/en/docs.ts` 의 키 집합이 일치하고 있으며, 두 파일에 동시 추가한다면 parity 가드를 통과한다.
  - 다만 `mobileSidebarToggle`(`docs.mobileSidebarToggle`)과 `mobileSidebarTitle`(`docs.mobileSidebarTitle`) 이라는 키 이름이 기존 `docs.*` 네임스페이스에 없는 신규 식별자임을 확인함 — naming collision 없음.
  - `spec/conventions/i18n-userguide.md §Principle 1` 에 따라 신규 컴포넌트(`docs-mobile-sidebar.tsx`) 안 버튼/aria-label 등 사용자 가시 문자열은 반드시 이 dict 키를 통해 노출해야 하며, TSX 내부에 한국어/영어 문자열을 직접 박으면 위반이다.
- 제안: 양쪽 동시 추가 + `DocsMobileSidebar` 컴포넌트 안 문자열을 `t("docs.mobileSidebarToggle")` / `t("docs.mobileSidebarTitle")` 경유로 사용하면 규약 충족. ko 값 예: `"메뉴"` / `"사용자 가이드"`, en 값 예: `"Menu"` / `"User Guide"` (번역 미확정이면 영문 동일 값으로 양쪽 커밋 후 후속 번역 가능 — §Principle 2 허용 패턴).

---

### [INFO] `DocsMobileSidebar` 컴포넌트 파일명 명명 — 기존 컨벤션 일치 여부
- target 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` (신규 예정)
- 위반 규약: 명시적 파일명 컨벤션 규약은 `spec/conventions/` 에 별도 문서화되어 있지 않음 (INFO 수준)
- 상세: 기존 docs 컴포넌트 파일명 패턴은 `docs-sidebar.tsx`, `docs-search.tsx`, `doc-header.tsx`, `doc-body-notice.tsx` 이다. `docs-` prefix 와 `doc-` prefix 가 혼용되고 있으나, 복수 기능 컴포넌트(사이드바, 검색)는 `docs-` prefix 를 쓰고 단일 문서 요소(헤더, 본문 알림)는 `doc-` prefix 를 쓰는 경향이 관찰된다. 모바일 사이드바는 사이드바 기능의 변형이므로 `docs-mobile-sidebar.tsx` 가 자연스럽다. 기존 `DocsMobileSidebar` 식별자와 충돌 없음 (grep 결과 0건).
- 제안: 현재 제안된 이름(`docs-mobile-sidebar.tsx`) 이 기존 패턴과 일치. 조치 불필요.

---

### [INFO] `spec/2-navigation/13-user-guide.md §10` 의 drift 인식 — 후속 plan 위치 적절성
- target 위치: `spec/2-navigation/13-user-guide.md §10` ("접근·표시" 표) 및 `plan/in-progress/spec-update-user-guide-mobile.md` (후속 예정)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: spec-only` 인 spec 은 TTL 90일 내 구현 의도 확인 의무. `spec/2-navigation/13-user-guide.md` 의 현 `status: spec-only` 가 90일 이내인지 가드가 검증함.
- 상세: 변경 의도에서 `spec/` 를 건드리지 않고 drift(검색 미포함, 모바일 진입 미정의)를 후속 plan 으로 미루는 전략을 취하고 있다. `spec/conventions/spec-impl-evidence.md` 는 `status: spec-only` 의 TTL 90일 가드를 두고 있으나, `13-user-guide.md` 는 `status: spec-only`로 설정돼 있으며 spec-status-lifecycle.test.ts 가 TTL 초과 여부를 검증한다. TTL 이 만료되지 않은 상태라면 본 task 에서 spec 미수정은 정상이다.
- 제안: 후속 plan `spec-update-user-guide-mobile.md` 를 `plan/in-progress/` 에 실제 생성하고, `13-user-guide.md` frontmatter 에 `pending_plans:` 로 등록해 두면 `spec-pending-plan-existence.test.ts` 가드가 추적한다. 이 연결이 없으면 후속 plan 이 생성됐는지 가드가 알 수 없다. 본 task 차단 사항은 아니나 향후 TTL 도래 시 대응 부담이 있다.

---

## 확인 요청 답변

1. **`spec/2-navigation/_layout.md §2.4` breakpoint 차단 여부**: 차단 사항 아님. §2.4 는 글로벌 앱 사이드바 기준이고, `/docs` 내부 사이드바는 별도 정의 없이 코드로 `lg(1024px)` 를 사용 중이다. spec 의 명시적 breakpoint 가 없으므로 CRITICAL 위반이 아니다. 단 drift 메모를 PR 에 남기고 후속 spec 갱신(`13-user-guide.md §10` 또는 `_layout.md` 주석)을 연결하면 충분하다.

2. **ko/en parity 만족 여부**: `mobileSidebarToggle`, `mobileSidebarTitle` 양쪽 동시 추가이면 `i18n-userguide.md §Principle 2` 자동 가드(`dict parity`) 통과. naming collision 없음.

3. **SlideDrawer side prop 기존 사용처 영향**: 기존 3개 사용처 (`authentication/page.tsx`, `trigger-detail-drawer.tsx`, 주석 참고의 `service-picker-modal.tsx`) 중 실제 `SlideDrawer` import 사용처는 2곳이며, `default "right"` 적용 시 동작 변화 없다. CSS 조건 분기 구현에서 기존 className 이 그대로 유지되는 것을 단위 테스트로 보장하면 된다.

4. **Naming collision**: `DocsMobileSidebar`, `mobileSidebarToggle`, `mobileSidebarTitle` 모두 기존 식별자와 충돌 없음 (grep 결과 0건).

---

## 요약

본 task 의 변경 의도(`docs/layout.tsx` 모바일 토글, `DocsMobileSidebar` 신규, `SlideDrawer` side prop, i18n 키 2개 추가)는 정식 규약 관점에서 채택 가능한 범위다. 가장 주의할 지점은 두 가지: (1) `i18n-userguide.md §Principle 2` 의 ko/en parity — 반드시 양쪽 동시 추가, (2) `SlideDrawer` side prop 추가 시 기존 사용처 2곳에서 default "right" 가 CSS 조건 분기 후에도 보장되는지 확인. spec 문서 자체는 본 task scope 에서 수정하지 않으므로 spec frontmatter 관련 가드(`spec-impl-evidence`) 는 영향 없다. `_layout.md §2.4` 와 `/docs` lg breakpoint 간 불일치는 WARNING 수준의 drift 이나 차단 사유는 아니다.

---

## 위험도

MEDIUM
