# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `DocsMobileSidebarProps` 인터페이스에 JSDoc 없음
- 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` L17-20
- 상세: `interface DocsMobileSidebarProps` 에 각 prop(`sections`, `entriesByLocale`)에 대한 JSDoc 설명이 없다. 함수 수준 JSDoc 은 충실히 작성되어 있으나 props 타입 인터페이스 자체에는 설명이 없다. `SlideDrawerProps` 의 `side` 필드가 JSDoc 인라인 주석을 갖는 것과 일관성이 맞지 않는다.
- 제안:
  ```ts
  interface DocsMobileSidebarProps {
    /** 사이드바에 표시할 가이드 섹션·페이지 트리. `getDocsIndex()` 결과의 `sections`. */
    sections: DocsSection[];
    /** locale → 검색 엔트리 맵. `buildSearchIndex` 를 locale 별로 사전 계산한 결과. */
    entriesByLocale: Record<Locale, DocsSearchEntry[]>;
  }
  ```

### [INFO] `DocsMobileSidebar` JSDoc 에 `usePathname` 자동 close 동작이 명시되지 않은 점 검토 필요
- 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` L22-32
- 상세: JSDoc 의 "부수 동작" 목록에는 `usePathname 변경 시 자동 close` 가 기재되어 있으나, 실제 구현은 `usePathname` effect 가 아닌 `onClickCapture` 방식으로 처리된다. 주석에서 이미 "react-compiler의 setState-in-effect 규약 위반이라 click capture로 처리" 라고 인라인 설명하고 있지만, 함수 수준 JSDoc에서는 여전히 `usePathname 변경 시 자동 close` 로 표현하고 있어 구현 방식과 사실적 차이가 있다. 단, 외부 동작(pathname이 바뀌면 drawer가 닫힌다)은 동일하므로 오해를 낳지는 않는다. 정확성을 높이려면 아래와 같이 정정하는 것이 바람직하다.
- 제안: JSDoc 부수 동작 첫 항목을 `usePathname 변경 시 자동 close` 대신 `anchor 클릭 시 자동 close (click capture — react-compiler setState-in-effect 규약 준수)` 로 수정.

### [WARNING] `spec/2-navigation/13-user-guide.md §10` 표가 구현 현실과 불일치
- 위치: `/Volumes/project/private/clemvion/spec/2-navigation/13-user-guide.md` L139
- 상세: §10 테이블의 "검색" 행이 여전히 "현재는 미포함. 콘텐츠 증가 시 별도 추가" 로 기재되어 있다. 이미 `DocsSearch` 가 구현되어 있고 본 PR 로 모바일 drawer 에도 노출된다. 또한 "모바일 진입" 항목 자체가 §10 에 존재하지 않는다. 이는 `plan/in-progress/spec-update-user-guide-mobile.md` 에서 후속 project-planner 작업으로 명시적으로 분리 처리 중이지만, spec 이 구현보다 현저히 뒤처진 상태다.
- 제안: `plan/in-progress/spec-update-user-guide-mobile.md` 체크리스트 처리를 통해 §10 표를 갱신 필요. 적어도 `spec/2-navigation/13-user-guide.md` frontmatter 에 `pending_plans: [spec-update-user-guide-mobile]` 을 즉시 등록해 drift 현황을 spec 자체에 명시적으로 표시하는 것을 권장한다.

### [INFO] `SlideDrawerProps.side` JSDoc 에 사용처 예시가 특정 경로(`/docs`)로 하드코딩됨
- 위치: `codebase/frontend/src/components/ui/slide-drawer.tsx` L57-60
- 상세: `"left"` 는 본문 좌측 보조 네비 (`/docs` 모바일 사이드바) 용 이라고 명시되어 있다. 이는 현재 유일한 사용처를 직접 언급하므로 향후 다른 컨텍스트에서 `side="left"` 를 쓸 때 주석이 낡은 것처럼 보인다. 장기적으로는 사용처 나열보다 목적(좌측 패널 UX)을 설명하는 편이 낫다.
- 제안: `"left"` 는 콘텐츠 좌측에서 슬라이드인하는 보조 네비(예: 모바일 가이드 사이드바)에 사용.

### [INFO] 테스트 파일에 모듈 수준 설명 주석 없음
- 위치: `codebase/frontend/src/components/docs/__tests__/docs-mobile-sidebar.test.tsx` 상단 / `codebase/frontend/src/components/ui/__tests__/slide-drawer.test.tsx` 상단
- 상세: 두 테스트 파일 모두 파일 상단에 "이 테스트가 검증하는 것" 을 설명하는 블록 주석이 없다. 단, `slide-drawer.test.tsx` 는 `getPanel()` 헬퍼 위에 왜 `{ hidden: true }` 로 조회하는지 이유를 설명하는 주석이 잘 작성되어 있고, `docs-mobile-sidebar.test.tsx` 도 상단 mock 옆에 핵심 동작 근거가 코멘트되어 있어 가독성이 높다. 의무 사항은 아니나 일관성을 위해 `describe` 블록 위에 한 줄 요약을 추가하면 좋다.
- 제안: 각 파일 상단 또는 `describe` 선언 직전에 테스트 목적 한 줄 주석 추가.

### [INFO] i18n 키 추가에 대한 dict 타입 정의 파일 JSDoc 없음
- 위치: `codebase/frontend/src/lib/i18n/dict/en/docs.ts`, `codebase/frontend/src/lib/i18n/dict/ko/docs.ts`
- 상세: 신규 키 `mobileSidebarToggle`, `mobileSidebarTitle` 가 어떤 UI 컨텍스트(어느 컴포넌트, 어느 위치)에서 사용되는지 설명하는 인라인 주석이 없다. 다른 기존 키들도 주석이 없으므로 이 파일 전체의 문서화 수준과는 일관성이 있다. 하지만 이번에 추가된 두 키는 신규 기능 진입점과 연결된 텍스트로, 특히 `mobileSidebarTitle` 이 `docs.title` 과 동일한 "User Guide" / "사용자 가이드" 값인 점에서 향후 번역자가 두 키의 차이를 구분하기 어렵다.
- 제안:
  ```ts
  /** 모바일 사이드바 토글 버튼의 aria-label 겸 가시 라벨 */
  mobileSidebarToggle: "Guide contents",
  /** 모바일 사이드바 SlideDrawer 헤더 타이틀 */
  mobileSidebarTitle: "User Guide",
  ```

### [INFO] `plan/in-progress/docs-mobile-sidebar.md` 의 체크리스트 항목이 완료 표시 없이 제출됨
- 위치: `plan/in-progress/docs-mobile-sidebar.md` L34-56
- 상세: 모든 체크리스트 항목이 `[ ]` 미완료 상태로 기재되어 있다. 실제 코드 변경을 보면 SlideDrawer side prop 추가, DocsMobileSidebar 구현, layout 통합, i18n 키 추가, TDD 테스트 작성이 모두 완료된 것으로 보인다. plan 문서의 체크리스트가 코드 상태와 불일치하면 작업 진행 현황 파악이 어렵다.
- 제안: 완료된 항목은 `[x]` 로 표시하거나, "모든 구현 체크리스트 완료" 섹션으로 이동해 plan 문서와 코드 현황을 일치시킨다.

### [INFO] `plan/in-progress/spec-update-user-guide-mobile.md` 에 Rationale R-x 번호 미확정
- 위치: `plan/in-progress/spec-update-user-guide-mobile.md` L33
- 상세: `R-x` 라고 표기되어 실제 spec 에 추가될 Rationale 항목 번호가 아직 결정되지 않은 상태다. spec 에 기존 Rationale 번호 체계가 있다면, plan 단계에서 미리 번호를 조회해 구체적으로 기재해 두면 spec 머지 시 충돌을 예방할 수 있다.
- 제안: `spec/2-navigation/13-user-guide.md` 에 기존 Rationale 항목 번호를 확인 후 `R-x` 를 실제 번호로 교체.

---

## 요약

이번 변경은 신규 `DocsMobileSidebar` 컴포넌트와 `SlideDrawer` `side` prop 확장을 중심으로 한다. 핵심 컴포넌트(`docs-mobile-sidebar.tsx`)는 함수 수준 JSDoc, 복잡한 로직에 대한 인라인 주석, react-compiler 제약 해결 방식 설명 등 전반적으로 문서화 품질이 높다. SlideDrawer 의 신규 prop 도 JSDoc 인라인 주석이 추가되었다. 중요한 문서화 갭은 `spec/2-navigation/13-user-guide.md §10` 표가 아직 구현 현실(DocsSearch 구현 완료, 모바일 진입 추가)과 불일치한다는 점이다. 이는 `plan/in-progress/spec-update-user-guide-mobile.md` 에서 명시적으로 후속 처리로 분리되어 있으나, 당장 spec frontmatter 에 `pending_plans` 를 등록해 drift 를 명시적으로 추적하지 않으면 spec 만 읽는 사람이 현재 구현 상태를 잘못 파악할 수 있다. 나머지 발견사항은 인터페이스 props JSDoc 누락, i18n 키 주석 부재, plan 체크리스트 미완료 표시 등 관리적 일관성 개선 사항으로 기능 동작에는 영향이 없다.

## 위험도

LOW
