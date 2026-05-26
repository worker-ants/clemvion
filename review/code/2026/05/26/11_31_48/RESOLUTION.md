# RESOLUTION — 11_31_48

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| C-1 | spec (frontmatter 등록) | 65e0bf47 | spec 본문 정정은 project-planner 위임. frontmatter `pending_plans: [plan/in-progress/spec-update-user-guide-mobile.md]` 등록으로 tracker 연결. 기존 후속 plan `plan/in-progress/spec-update-user-guide-mobile.md` 이미 존재 |
| W-1 | 코드 | 65e0bf47 | JSDoc 부수 동작 문구를 "anchor 클릭 시 자동 close (click capture — react-compiler 규약 준수)" 로 정정. useEffect pathname 추적 미구현은 react-compiler 규약 위반이라 click capture 방식 유지 (코드 주석에 근거 명시) |
| W-2 | 코드 | 65e0bf47 | pathname auto-close useEffect 미구현(react-compiler 규약)이므로 해당 테스트 케이스도 미작성. plan 체크리스트에 "react-compiler 규약으로 click capture 방식 채택, pathname useEffect 미구현 — JSDoc 으로 의도 명시 완료" 로 기록 |
| W-3 | 코드 | 65e0bf47 | SlideDrawer body scroll lock 단위 테스트 추가 (열림/닫힘/복원, 중첩 drawer 시나리오) |
| W-4 | 코드 | 65e0bf47 | overlay 클릭 → onClose 호출, 닫기(X) 버튼 클릭 → onClose 호출 테스트 추가 |
| W-5 | 코드 | 65e0bf47 | aria-expanded 초기 false → 클릭 후 true → 재클릭 false 단언 추가 |
| W-6 | 코드 | 65e0bf47 | `/docs/ko/unknown-page` 엣지케이스 — 섹션·페이지 라벨 미표시 검증 추가 |
| W-7 | 후속 | — | `outer:` labeled break → 헬퍼 함수 리팩토링. 유지보수성 개선 사항으로 머지 후 별도 처리 가능 |
| W-8 | 후속 | — | `h-[calc(100%-65px)]` 매직 넘버 → flex 레이아웃. 유지보수성 개선 사항으로 머지 후 별도 처리 가능 |
| W-9 | 코드 | 65e0bf47 | `Element.prototype.scrollIntoView` 전역 프로토타입 직접 교체 → `vi.spyOn(...).mockImplementation(...)` 으로 변경. afterEach 자동 복원 |
| W-10 | 코드 | 65e0bf47 | `slide-drawer.tsx` 에 `__resetForTesting()` export 추가. `slide-drawer.test.tsx` + `docs-mobile-sidebar.test.tsx` 양쪽 afterEach 에서 호출 |
| W-11 | 코드 | 65e0bf47 | `onClick={() => setOpen(true)}` → `onClick={() => setOpen((prev) => !prev)}` — 재클릭 시 닫힘, aria-expanded WAI-ARIA 계약 충족 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4944 passed)
- build : (lint/unit pass 확인, build 단계 별도 미실행 — run-test.sh lint+unit 통과)
- e2e   : 통과 (123/123)

## 보류·후속 항목

- W-7 (후속): `outer:` labeled break → `findActivePageInfo` 헬퍼 함수 추출로 early return 대체. 동작에 영향 없는 가독성 개선. 별도 PR 에서 처리 가능.
- W-8 (후속): `h-[calc(100%-65px)]` 매직 넘버 → flex 레이아웃(`shrink-0` 헤더 + `flex-1` 컨텐츠). 헤더 높이 변경 시 break 위험. 별도 PR 에서 처리 가능.
- C-1 (spec 위임): `spec/2-navigation/13-user-guide.md §10` 표 갱신 (검색 행 + 모바일 진입 행) + Rationale R-x 추가. `plan/in-progress/spec-update-user-guide-mobile.md` 가 담당. project-planner 위임 대상.
- I-1: `DocsMobileSidebar` 내 pathname → (sectionLabel, pageTitle) 매핑 로직 — 현재 1곳만 사용. 2곳 이상 사용 시점에 `@/lib/docs/` 헬퍼 함수로 추출 권장.
- I-5: `plan/in-progress/spec-update-user-guide-mobile.md` 의 `R-x` 번호 미확정 — project-planner 가 §10 갱신 시 실제 번호로 교체.
- I-10: `openDrawerCount` 모듈-레벨 변수 — SSR 이동 금지 주석은 65e0bf47 에서 코드 블록 JSDoc 에 추가 완료.
- I-11: `en` locale i18n 경로 검증 테스트 — 선택 사항으로 별도 추가 가능.
- I-12: layout.tsx 반응형 e2e 케이스 (모바일/데스크탑 viewport별 토글·aside) — 별도 e2e 케이스로 추가 권장.
