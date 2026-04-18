### 발견사항

- **[WARNING]** 모듈 레벨 전역(`g` 플래그) 정규식의 공유 상태
  - 위치: `validate-scope.ts` — `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE` (모듈 상수)
  - 상세: 세 정규식이 `g` 플래그와 함께 모듈 싱글턴으로 선언되어 있어 `.test()` 호출마다 `lastIndex`가 변경됩니다. 현재 코드는 각 `.test()` 직후 `lastIndex = 0` 리셋을 수행하므로 동작은 올바르지만, 향후 `return` 경로 추가·리팩토링 시 리셋 누락으로 다음 호출에서 매치 실패가 발생할 수 있습니다. JavaScript는 싱글스레드이므로 진짜 경쟁 조건은 아니지만, 전역 가변 상태를 공유하는 취약한 패턴입니다.
  - 제안: 정규식을 함수 내부에서 매 호출마다 생성하거나(`/pattern/g` 리터럴을 함수 스코프로 이동), `EXPR_BLOCK_RE`·`NODE_REF_RE`처럼 `matchAll`로 대체하면 `lastIndex` 관리 부담이 없어집니다. 최소한 `hasLoop === false` 분기만 진입하는 경우도 안전한지 확인이 필요합니다(현재는 `lastIndex = 0` 리셋이 항상 실행되므로 안전하나, 명시적 의도가 불명확).

- **[INFO]** `setTimeout` 내부 다중 `setState` 호출
  - 위치: `expression-input.tsx` — `useEffect` 내 `setSyntaxError` + `setScopeErrors` 순차 호출
  - 상세: React 18 미만 환경에서는 이벤트 핸들러 외부(setTimeout)의 복수 `setState`가 각각 별도 렌더를 유발해 `syntaxError`가 갱신된 상태와 이전 `scopeErrors`가 동시에 보일 수 있습니다. React 18은 자동 배치로 안전하지만, 런타임 버전이 보장되지 않으면 일시적 UI 불일치가 발생합니다.
  - 제안: `{ syntaxError, scopeErrors }` 를 하나의 상태 객체로 합치거나 `useReducer`를 사용해 단일 dispatch로 원자적으로 갱신하세요.

- **[INFO]** `expressionData` 객체 참조 안정성에 의존하는 디바운스
  - 위치: `expression-input.tsx` — `useEffect([value, expressionData])`
  - 상세: `expressionData`가 렌더마다 새 참조를 반환하면 디바운스가 매 렌더 시 리셋됩니다. `useMemo`로 안정화되어 있어 현재는 안전하지만, `allNodeKeys`(Set 객체) 등의 내용이 동일해도 참조가 바뀌면 불필요한 검증이 트리거됩니다.
  - 제안: 특별한 조치 불필요, 단 `useMemo` 의존성 배열이 올바르게 관리되고 있는지 주기적으로 확인하세요.

---

### 요약

이 변경 코드는 순수 동기 계산(그래프 순회, 정규식 매칭)과 React 훅 기반 상태 관리로 구성되어 있으며, JavaScript 싱글스레드 특성상 실제 경쟁 조건·데드락·스레드 안전성 문제는 존재하지 않습니다. 유일한 실질적 위험은 `validate-scope.ts`의 모듈 레벨 전역 정규식으로, 현재 `lastIndex` 리셋이 올바르게 처리되어 있지만 향후 코드 변경 시 리셋 누락으로 인한 버그 도입 가능성이 있는 취약한 패턴입니다.

### 위험도
**LOW**