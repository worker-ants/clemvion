---

## 동시성 코드 리뷰 — Concurrency

### 발견사항

- **[INFO]** `useMemo` 의존성 배열에 객체 참조 포함
  - 위치: `use-expression-suggestions.ts:234`, `use-expression-context.ts:169`
  - 상세: `useMemo`의 의존성으로 `expressionData` (객체), `nodes`, `edges`, `nodeResults` (배열)가 사용되고 있음. React의 렌더 사이클에서 이 참조들이 매 렌더마다 새 객체로 생성되면 memoization이 무력화되어 불필요한 재계산이 발생할 수 있음. 단, 이는 동시성 버그가 아닌 성능 저하 가능성이며, Zustand 스토어에서 selector로 슬라이스를 가져오므로 실제 참조 안정성은 스토어 구현에 의존함.
  - 제안: Zustand selector에서 `shallow` 비교(`useShallow`)를 사용하거나, `nodeResults`와 같이 배열을 반환하는 selector에 안정적인 참조를 보장할 것.

- **[INFO]** `FUNCTION_NAMES` 모듈 레벨 상수 초기화
  - 위치: `use-expression-context.ts:8`
  - 상세: `const FUNCTION_NAMES = getAllFunctionNames()`가 모듈 로드 시점에 한 번 실행됨. 단일 스레드 JS 환경에서는 문제없으나, 만약 `getAllFunctionNames()`가 외부 상태를 변이하거나 싱글턴 레지스트리를 수정한다면 테스트 간 상태 누출이 발생할 수 있음. 현재 코드만으로는 내부 구현을 알 수 없음.
  - 제안: `getAllFunctionNames()`가 순수 함수임을 확인하거나, 테스트 환경에서 모듈 리셋이 필요한 경우를 고려할 것.

- **[INFO]** `NestedFieldItem`의 `useState(expanded)` 다중 인스턴스 상태
  - 위치: `variable-picker.tsx:107`
  - 상세: 재귀적으로 렌더링되는 `NestedFieldItem` 각각이 독립적인 `expanded` 상태를 가짐. 이는 React의 설계에 부합하지만, `expressionData`가 외부에서 변경되어 트리가 리렌더링될 때 기존 `expanded` 상태가 보존됨. 동시성 문제라기보다는 UX 일관성 이슈이나, React 18의 Concurrent Mode에서 인터럽트된 렌더 중 상태가 불일치할 수 있는 상황은 없음 (각 컴포넌트 상태는 독립적).
  - 제안: 해당 없음. 현재 구조 적절함.

---

### 요약

이 코드는 React hooks(`useMemo`, `useState`)와 Zustand 스토어를 기반으로 한 순수 클라이언트 사이드 UI 로직이다. 비동기 작업(`async/await`), 공유 변이 상태, 락/세마포어, 멀티스레드 접근 등 전통적인 동시성 위험 요소는 존재하지 않는다. JavaScript 싱글 스레드 환경 특성상 경쟁 조건이나 데드락 가능성도 없다. 다만 `useMemo` 의존성으로 사용되는 Zustand 배열 참조의 안정성이 보장되지 않으면 불필요한 재계산이 반복될 수 있으며, 이는 동시성 버그가 아닌 렌더링 효율 문제에 해당한다.

### 위험도
**LOW**