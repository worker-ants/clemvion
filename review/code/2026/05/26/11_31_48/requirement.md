# 요구사항(Requirement) 리뷰 결과

리뷰 대상: docs-mobile-sidebar (DocsMobileSidebar 신규 컴포넌트, SlideDrawer side prop 확장, layout.tsx 수정, i18n 키 추가)

---

## 발견사항

### [CRITICAL] spec/2-navigation/13-user-guide.md §10 본문과 구현 불일치 — spec fidelity
- 위치: `spec/2-navigation/13-user-guide.md` §10 "접근·표시" 표
- 상세: §10 표에는 "검색: 현재는 미포함. 콘텐츠 증가 시 별도 추가"라고 명시돼 있다. 구현은 이미 `DocsSearch` 를 데스크탑 사이드바와 모바일 drawer 양쪽에 노출하고 있어 spec 본문과 line-level 로 불일치한다. 또한 §10 에 "모바일 진입" 항목이 아예 없는데 본 PR 로 `DocsMobileSidebar`(모바일 토글 + 좌측 SlideDrawer)가 추가됐다. 후속 plan `spec-update-user-guide-mobile.md`가 존재하고 의도적 drift 임을 plan 이 인정하고 있으나, spec 본문 요구사항 ID·행위 명세와 코드 구현이 다르므로 spec fidelity 관점 CRITICAL 로 분류한다. spec 수정 권한은 project-planner 에게 있으므로 본 reviewer 는 수정하지 않는다.
- 제안: `spec-update-user-guide-mobile.md` plan 의 §10 표 갱신(검색 행 + 모바일 진입 행) 을 조속히 project-planner 가 수행해야 한다. `spec/2-navigation/13-user-guide.md` frontmatter 에 `pending_plans: [spec-update-user-guide-mobile]` 를 등록해 spec-pending-plan-existence.test.ts 가드가 추적할 수 있도록 해야 한다.

---

### [WARNING] "usePathname 변경 시 자동 close" 동작이 미구현 — 의도와 구현 간 괴리
- 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` 전체; `plan/in-progress/docs-mobile-sidebar.md` 작업 체크리스트 항목 "usePathname 변경 시 setOpen(false) 자동 close"
- 상세: JSDoc 주석과 plan 체크리스트 모두 "`usePathname` 변경 시 자동 close (페이지 이동 후 drawer 가 남는 회귀 방지)"를 명시하고 있다. 그러나 실제 구현에는 `pathname` 을 의존성으로 받는 `useEffect` 가 존재하지 않는다. 구현이 택한 방식은 `onClickCapture`에서 `<a>` 태그 클릭을 감지하는 것이다. 이 방식은 (1) `<Link>` 클릭 — 동작함, (2) 브라우저 뒤로/앞으로 이동 — 미동작, (3) `router.push()` 등 프로그래밍적 내비게이션 — 미동작, (4) 외부 검색 결과 클릭으로 `<a>` 가 아닌 방식으로 라우팅되는 경우 — 미동작 등의 케이스에서 drawer 가 열린 채로 잔존할 수 있다. 컴포넌트 내부 주석은 "react-compiler 의 setState-in-effect 규약 위반" 때문에 click capture 로 대체했다고 설명하지만, `useEffect(() => { setOpen(false); }, [pathname])` 패턴이 실제로 react-compiler 규약을 위반하는지에 대한 근거가 코드베이스 어디에도 문서화돼 있지 않다. 단순 히 `pathname` 변경 감지 후 `setOpen(false)` 를 호출하는 `useEffect` 는 표준 React 패턴이며, "이전 상태를 읽지 않는 단순 reset" 형태라 react-compiler 위반으로 보기 어렵다.
- 제안: `useEffect(() => { setOpen(false); }, [pathname])` 을 스크롤 effect 와 별개로 추가하거나, click capture 방식이 충분하다면 JSDoc 주석과 plan 체크리스트의 "usePathname 변경 시 자동 close" 표현을 "drawer 안 링크 클릭 시 자동 close"로 수정하여 의도와 구현을 일치시켜야 한다. react-compiler 제약이 진짜 이유라면 `spec/conventions/` 또는 코드 주석에 그 근거를 명시해야 한다.

---

### [WARNING] "pathname 변경 → 자동 close" 테스트 케이스 누락
- 위치: `codebase/frontend/src/components/docs/__tests__/docs-mobile-sidebar.test.tsx`; `plan/in-progress/docs-mobile-sidebar.md` TDD 체크리스트 항목 "열림 → pathname 변경 → 자동 close"
- 상세: plan TDD 체크리스트에 "열림 → pathname 변경 → 자동 close" 테스트가 명시돼 있으나, 테스트 파일에 해당 시나리오가 존재하지 않는다. `currentPathname` 을 mutable 변수로 설정해 테스트 내에서 바꿀 수 있는 준비는 돼 있지만, 실제로 pathname 을 바꾼 후 drawer 상태를 확인하는 테스트가 없다. 앞의 WARNING(pathname 미감지) 과 연동된 문제다 — 구현이 pathname 변경을 감지하지 않으므로 테스트를 작성했더라도 통과하지 못했을 것이다.
- 제안: 위의 pathname auto-close 구현이 확정된 후 해당 테스트를 추가해야 한다. 테스트가 없는 상태로 머지될 경우 plan 체크리스트와 실제 커버리지 사이에 거짓 완료 표시가 남는다.

---

### [WARNING] 토글 버튼이 열린 상태에서도 onClick 으로 재오픈만 가능 — 닫기 방법 부재
- 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` L76-100; 버튼 `onClick={() => setOpen(true)}`
- 상세: 토글 버튼의 `onClick` 은 항상 `setOpen(true)` 만 호출한다. 사용자가 drawer 가 열린 상태에서 토글 버튼을 다시 누르면 아무 동작도 일어나지 않는다(이미 true → true). drawer 를 닫으려면 오버레이 클릭, X 버튼, Escape 키만 가능하다. `aria-expanded` 속성이 `open` 값으로 올바르게 반영되는 점은 문제 없으나, 사용자가 동일 버튼으로 토글하려는 UX 기대와 어긋난다. 이 동작이 의도적인지 spec/plan 에 명시되지 않았다.
- 제안: `onClick={() => setOpen((prev) => !prev)}` 로 변경하거나, 의도적으로 토글이 아닌 열기 전용이라면 `aria-expanded` 를 제거하거나 주석으로 의도를 명시해야 한다. `aria-expanded` 가 있으면 스크린 리더 사용자는 재클릭으로 닫힐 것으로 기대한다.

---

### [INFO] 섹션·페이지 매칭 실패 시 토글 버튼 표시 — 엣지 케이스 처리
- 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` L59-68, L85-99
- 상세: `sections` 가 빈 배열이거나 `pathname` 이 어떤 페이지와도 매칭되지 않을 때 `sectionLabel` 과 `pageTitle` 이 모두 빈 문자열로 남는다. 이 경우 화살표와 breadcrumb 영역이 렌더되지 않아 토글 버튼에는 `toggleLabel` 텍스트("가이드 목차")만 표시된다. 이는 허용 가능한 폴백 동작이다. `sections` 가 빈 배열인 경우 drawer 안에도 아무 링크가 없으므로 추가 방어 코드는 불필요하다.
- 제안: 조치 불필요. 엣지 케이스 처리가 적절하다.

---

### [INFO] spec/2-navigation/13-user-guide.md §10 "사이드바 표시: 모든 로그인 사용자" — 인증 게이트 미포함
- 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx`; `spec/2-navigation/13-user-guide.md §10`
- 상세: §10 은 "현재는 로그인 필수(`(main)` 그룹이 보호됨)"이라고 명시한다. `DocsMobileSidebar` 자체에는 인증 게이트가 없지만, `(main)` 라우트 그룹 레벨에서 이미 보호되므로 컴포넌트 내부에 별도 인증 로직이 없어도 spec 을 충족한다.
- 제안: 조치 불필요.

---

### [INFO] DocsSection.label 필드가 테스트 픽스처에 정의됐지만 컴포넌트에서 미사용
- 위치: `codebase/frontend/src/components/docs/__tests__/docs-mobile-sidebar.test.tsx` L12; `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` L63-65
- 상세: 테스트 픽스처의 `DocsSection` 객체에 `label: "노드 가이드"` 필드가 있으나, 컴포넌트는 섹션 라벨을 `localizedSectionLabel(section.key, locale)` 로 계산해 `DocsSection.label` 을 직접 참조하지 않는다. 테스트의 `expect(toggle.textContent).toContain("노드 가이드")` 검증은 `localizedSectionLabel("02-nodes", "ko")` 의 반환값인 "노드 가이드"가 `locale.ts` 의 `SECTION_LABELS_BY_LOCALE.ko` 에서 나오는 것이므로 실제로 픽스처의 `label` 값이 아닌 locale 테이블에 의존한다. 이는 테스트 의도를 독자가 오해할 수 있다.
- 제안: 심각도 낮음. 테스트 픽스처에서 `label` 필드 주석 또는 제거를 고려할 수 있지만, `DocsSection` 타입에 `label: string` 이 필수이므로 픽스처가 타입 충족을 위해 값을 넣은 것이다. 현 상태 허용 가능.

---

## 요약

본 변경은 모바일 사이드바 진입점 추가라는 기능적 목적을 대체로 충족한다. SlideDrawer `side` prop 확장, DocsMobileSidebar 신규 컴포넌트, layout.tsx 수정, i18n 키 ko/en 동시 추가가 plan 체크리스트 항목과 대부분 일치한다. 그러나 두 가지 중요한 문제가 있다. 첫째, plan 과 JSDoc 이 약속한 "usePathname 변경 시 자동 close" 동작이 실제로 구현되지 않았고 이에 대한 테스트도 없어 의도와 구현 간 괴리가 명확하다. 둘째, 토글 버튼이 `aria-expanded` 를 노출하면서도 클릭 시 열기만 가능해 WAI-ARIA 사용자 기대와 어긋난다. spec fidelity 면에서는 `spec/2-navigation/13-user-guide.md §10` 이 검색 미포함·모바일 진입 미정의 상태로 구현보다 한참 뒤처져 있으며 이는 CRITICAL 로 분류된다(수정은 project-planner 위임).

---

## 위험도

MEDIUM
