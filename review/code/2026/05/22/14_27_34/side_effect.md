# 부작용(Side Effect) 리뷰

대상 커밋: `244d3862639ea6a463a512786b17794cfc1ba47c`
리뷰 일시: 2026-05-22

---

## 발견사항

- **[INFO]** `historyTarget` 로컬 상태 추가 — 의도된 상태 변경
  - 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` L89–92
  - 상세: `useState<{ id: string; name: string } | null>(null)` 가 페이지 컴포넌트 지역 상태로 추가됨. 전역·공유 상태(Zustand, Redux 등)를 건드리지 않으며, `TriggersPage` 인스턴스에만 귀속됨. 의도된 변경이다.
  - 제안: 없음.

- **[INFO]** `viewHistory` 메뉴 항목 `onSelect` 변경 — 기존 drawer 대신 dialog 로 라우팅
  - 위치: `page.tsx` L511 (변경 전 `setSelectedTriggerId`, 변경 후 `setHistoryTarget`)
  - 상세: 이전에는 "호출 이력" 클릭 시 `setSelectedTriggerId` 를 호출해 `TriggerDetailDrawer` 가 열렸다. 이제 `setHistoryTarget` 을 호출해 `TriggerHistoryDialog` 가 열린다. **기존 행(row) 클릭(`onClick`)은 여전히 `setSelectedTriggerId` 를 사용하므로** drawer 진입 경로는 유지된다. "상세 보기" 메뉴 항목도 `setSelectedTriggerId` 를 사용하므로 보존됨.
  - 제안: 없음.

- **[INFO]** `onOpenFullDetail` 콜백에서 두 상태를 순서대로 갱신
  - 위치: `page.tsx` L596–133 (렌더 트리 내 JSX)
  - 상세: `setHistoryTarget(null)` → `setSelectedTriggerId(id)` 순으로 두 상태 업데이트가 연속 호출된다. React 18 automatic batching 덕분에 단일 리렌더로 처리되어 두 상태 모두 올바르게 커밋된다. `id` 를 로컬 변수(`const id = historyTarget.id`)에 캡처한 후 `setHistoryTarget(null)` 을 호출하기 때문에 null 참조 오류 위험이 없다.
  - 제안: 없음.

- **[INFO]** `queryKey ["trigger-history-dialog", id]` 가 drawer 캐시(`["trigger-detail", id]`)와 분리됨
  - 위치: `trigger-history-dialog.tsx` L60
  - 상세: drawer 의 Recent Calls 쿼리 키와 다른 prefix 를 사용하므로 캐시 충돌 없음. `enabled: !!triggerId && open` 조건으로 dialog 가 닫혀 있거나 triggerId 가 null 이면 네트워크 호출이 발생하지 않는다.
  - 제안: 없음.

- **[INFO]** 테스트 파일에서 모듈 수준 `vi.mock` 과 `beforeEach` 에 `cleanup()` 호출 혼용
  - 위치: `trigger-history-dialog.test.tsx` L867–870
  - 상세: `@testing-library/react` 의 `cleanup()` 은 일반적으로 `afterEach` hook 에서 자동 실행된다. `beforeEach` 에서 명시적으로 호출하는 것은 기능적으로 동등하며(이전 테스트의 DOM 을 다음 테스트 시작 전에 정리) 부작용을 유발하지 않는다. 단, 일반 관행과 달리 앞선 테스트의 cleanup 이 `beforeEach` 타이밍에 일어나므로 `afterEach` 에 다른 teardown 로직이 있을 경우 순서 의존성이 생길 수 있다. 이 파일에는 `afterEach` 가 없으므로 문제없다.
  - 제안: 없음 (기능 문제 없음). 스타일 일관성을 위해 `afterEach(() => cleanup())` 으로 변경하는 것도 고려할 수 있으나 필수는 아님.

- **[INFO]** 테스트에서 `useLocaleStore.setState` 로 전역 Zustand 스토어를 직접 수정
  - 위치: `trigger-history-dialog.test.tsx` L870
  - 상세: `useLocaleStore.setState({ locale: "en" })` 는 전역 스토어를 `beforeEach` 마다 재설정한다. `vi.clearAllMocks()` 과 함께 사용하므로 테스트 간 격리가 의도적으로 설계된 것이다. 이 패턴은 기존 다른 테스트 파일들과 동일한 방식이다(프로젝트 규약 내).
  - 제안: 없음.

---

## 요약

이번 변경은 `TriggersPage` 의 로컬 UI 상태(`historyTarget`)를 하나 추가하고, "호출 이력" 메뉴 항목의 동작을 기존 `TriggerDetailDrawer` 에서 신규 `TriggerHistoryDialog` 로 분기하는 내용이다. 전역 변수, Zustand 전역 스토어, 환경 변수, 파일시스템, 네트워크 호출 경로 어디에도 의도치 않은 부작용이 없다. `TriggerHistoryDialog` 는 `enabled: !!triggerId && open` 조건으로 불필요한 API 호출을 방지하고, `queryKey` 분리로 drawer 캐시와의 충돌도 없다. `onOpenFullDetail` 콜백에서의 이중 상태 업데이트는 React 18 batching 으로 안전하게 처리된다. 기존 `setSelectedTriggerId` / `TriggerDetailDrawer` 인터페이스는 변경되지 않아 하위 호환성이 유지된다. 테스트 파일의 `cleanup()` / `useLocaleStore.setState` 패턴은 기존 프로젝트 규약과 일치한다.

---

## 위험도

NONE
