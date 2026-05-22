# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: `codebase/frontend/src/app/(main)/triggers/page.tsx`

- **[INFO]** `onOpenFullDetail` 콜백에 인라인 closure 중간 변수 추출
  - 위치: 라인 746–754 (`TriggerHistoryDialog` 마운트 블록)
  - 상세: `historyTarget` 가 truthy 일 때만 콜백을 생성하는 패턴은 정확하다. 단, `onOpenFullDetail` prop 에 할당되는 삼항 표현식 내부에서 `const id = historyTarget.id` 를 별도 변수로 추출한 이유가 클로저 캡처 시점 안전성을 확보하기 위한 것임을 주석 없이 코드만으로 파악하기 어렵다. 짧은 인라인 주석(예: `// capture id before clearing historyTarget`)이 있으면 가독성이 높아진다.
  - 제안: 해당 라인에 한 줄 주석 추가 또는 콜백을 `useCallback` 으로 명시적 분리.

- **[INFO]** `historyTarget` 상태 타입을 인라인 익명 객체로 선언
  - 위치: 라인 89–92 (`useState` 선언부)
  - 상세: `deleteTarget` 은 `TriggerDeleteTarget` 이라는 export 된 인터페이스를 재사용하는 반면, `historyTarget` 은 `{ id: string; name: string }` 을 인라인 객체 타입으로 선언한다. `trigger-history-dialog.tsx` 의 `Props` 에서 이미 같은 필드 구조가 존재하므로, 별도 타입(`TriggerHistoryTarget`)을 export 하거나 `TriggerHistoryDialog` 의 Props 를 재활용하면 타입 선언이 한 곳에 모인다.
  - 제안: `trigger-history-dialog.tsx` 에서 `export interface TriggerHistoryTarget { id: string; name: string }` 을 추출하고 `page.tsx` 에서 import.

- **[INFO]** 인라인 "Create Webhook Dialog" 가 page 컴포넌트 크기를 크게 늘림
  - 위치: 라인 394–499 (전체 컨텍스트 기준 `{showDialog && ...}` 블록)
  - 상세: 이 변경의 직접 범위가 아니나 컴포넌트 전체 유지보수성에 영향을 준다. `TriggerDeleteDialog`, `TriggerHistoryDialog` 는 별도 파일로 분리됐는데, Create Webhook Dialog 는 page 내부 JSX 로 남아 있다. 일관성 차원에서 언급.
  - 제안: 현 PR 범위는 아니므로 별도 리팩터링 이슈로 추적 권장.

---

### 파일 2: `codebase/frontend/src/components/triggers/trigger-history-dialog.tsx`

- **[INFO]** 매직 넘버 `10` (limit)
  - 위치: 라인 63 (`params: { limit: 10 }`)
  - 상세: API 호출 limit 값이 숫자 리터럴로 직접 기재된다. 테스트(`trigger-history-dialog.test.tsx` 라인 1075)도 `10` 을 그대로 단언하므로 두 곳에 값이 흩어진다. 컴포넌트 상단에 `const HISTORY_LIMIT = 10` 상수로 추출하면 변경 시 한 곳만 수정하면 된다.
  - 제안: `const HISTORY_LIMIT = 10` 을 컴포넌트 파일 상단(또는 Props 정의 위)에 선언하고 props 기본값 또는 인라인 상수로 참조.

- **[INFO]** `status` 분기에 `"error"` 와 `"failed"` 두 값 처리
  - 위치: 라인 110–113 (Badge variant 결정 삼항식)
  - 상세: 백엔드가 반환할 수 있는 status 문자열 집합이 `TriggerHistoryEntry.status: string` 으로 느슨하게 타이핑되어 있어, 허용 값이 `"success" | "error" | "failed" | ...` 임을 알기 어렵다. 두 값(`"error"`, `"failed"`)이 병렬로 처리되는 이유(레거시 또는 백엔드 불일치)를 알 수 없다.
  - 제안: `status` 를 union type(`"success" | "error" | "failed" | "running"` 등)으로 좁히거나, 인터페이스 주석에 허용값을 명시.

- **[INFO]** 복합 삼항식 중첩 (isLoading / isError / empty / list)
  - 위치: 라인 86–122 (content 영역 삼항식 4단 체인)
  - 상세: `isLoading ? ... : isError ? ... : history.length === 0 ? ... : (list)` 의 4단 삼항식은 기능적으로 문제없지만 새로운 상태(예: partial error)가 추가될 때 수정이 어렵다. `trigger-delete-dialog.tsx` 는 이른 return 패턴을 사용하고 있으나 이 컴포넌트는 삼항 체인을 택해 파일 내 일관성이 약간 어긋난다.
  - 제안: 상태별 early return 또는 별도 `renderContent()` 헬퍼 함수로 분리. 현 규모에서는 허용 수준이나 복잡도가 늘면 리팩터링 우선.

---

### 파일 3: `codebase/frontend/src/components/triggers/__tests__/trigger-history-dialog.test.tsx`

- **[INFO]** `onOpenFullDetail` 조건부 노출 테스트에서 `QueryClient` 를 두 번 인스턴스화
  - 위치: 라인 1084–1065 (`rerender` 전후 `new QueryClient(...)` 반복)
  - 상세: `rerender` 를 사용할 때 `QueryClientProvider` 에 새 `QueryClient` 인스턴스를 넘기면 캐시가 리셋돼 동작은 맞지만, 이 패턴이 의도적인지 아닌지 파악하기 어렵다. 다른 테스트는 `renderDialog()` 헬퍼를 통해 일관되게 래핑하는 반면 이 케이스만 수동 `render`/`rerender` 를 사용해 코드 일관성이 낮다.
  - 제안: `renderDialog` 헬퍼에 `{ rerenderWithProps }` 반환 값을 추가하거나, 테스트 케이스 상단에 `// rerender 테스트는 수동 render 사용(헬퍼와 QueryClient 공유 불가)` 주석으로 이유를 명시.

- **[INFO]** DOM 선택자 직접 사용 (`document.querySelector`)
  - 위치: 라인 971 (`document.querySelector(".animate-spin")`)
  - 상세: `animate-spin` 클래스를 직접 쿼리하면 Tailwind 클래스 이름이 바뀌거나 로딩 구현이 변경될 때 테스트가 거짓 실패한다. Testing Library 의 역할 기반 쿼리(`getByRole("status")` 등)나 `aria-label` 을 사용하는 편이 더 내구성 있다.
  - 제안: `Loader2` 에 `aria-label="loading"` 또는 `role="status"` 를 추가하고 `screen.getByRole("status")` 로 교체.

---

## 요약

이번 변경은 `page.tsx` 에 최소한의 상태(`historyTarget`)와 Dialog 마운트만 추가하고, 비즈니스 로직을 `trigger-history-dialog.tsx` 로 적절히 위임한 구조다. 기존 `TriggerDeleteDialog` 패턴을 충실히 따랐고, i18n/queryKey 분리·JSDoc 주석 등 유지보수 배려도 갖추고 있다. 발견된 사항은 모두 INFO 수준으로, limit 매직 넘버 추출, `historyTarget` 타입 정의 공유, 테스트의 DOM selector 방식 개선 세 항목이 유지보수성을 실질적으로 높일 여지가 있다. 전반적으로 기존 코드베이스 스타일 및 패턴 일관성이 잘 유지된 변경이다.

## 위험도

LOW
