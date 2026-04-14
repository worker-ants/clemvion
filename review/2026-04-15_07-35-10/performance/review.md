## 발견사항

### [INFO] `timeoutMs === 0` 조건부 `Promise.race` 최적화
- **위치**: `execution-engine.service.ts` - `executeSubWorkflow`
- **상세**: `timeoutMs > 0`일 때만 `Promise` 객체와 타이머를 생성하도록 변경. 타임아웃이 없는 경우 불필요한 Promise 할당을 방지.
- **평가**: 올바른 최적화. 기존 코드는 `timeoutMs === 0`이어도 무조건 `new Promise<never>(...)`를 생성했음.

---

### [WARNING] `pendingContinuations` Map의 무한 성장 가능성
- **위치**: `execution-engine.service.ts` - `waitForButtonInteraction`, `waitForFormSubmit`, `waitForAiConversation`
- **상세**: 기존 코드는 타임아웃 콜백이 `pendingContinuations.delete(executionId)`를 담보했지만, 변경 후엔 **사용자가 명시적으로 취소하지 않는 한 항목이 영구 보존**됨. 사용자가 브라우저를 닫거나 실행을 abandon한 경우 `{ nodeId, resolve, reject }` 클로저가 Map에 잔류하여 참조된 스코프 전체가 GC 대상에서 제외됨.

  ```ts
  // 이 항목은 외부 cancel이 없으면 서버 재시작 전까지 해제되지 않음
  this.pendingContinuations.set(executionId, {
    nodeId: node.id,
    resolve,
    reject,
  });
  ```

  고부하 환경에서 다수의 실행이 `waiting_for_input` 상태로 방치될 경우 누적 메모리 압박이 발생함.
- **제안**: 스펙 수준에서 "외부 cancel만이 탈출구"임을 선택했다면, 상위 레이어(예: 스케줄러 기반 stale execution 정리 크론 또는 WebSocket disconnect 이벤트 핸들러)에서 orphaned pending continuation을 정리하는 메커니즘이 있는지 확인할 것. 없다면 추가 필요.

---

### [INFO] React 카운트다운 타이머 제거 → 렌더링 성능 개선
- **위치**: `frontend/src/components/editor/run-results/button-bar.tsx`
- **상세**: 기존 `setInterval(..., 1000)` 기반 카운트다운이 제거됨. 버튼 대기 상태에서 매초 `setState` → 리렌더링이 발생하던 구조가 사라져 불필요한 DOM 업데이트가 근절됨. `useEffect`, `Clock` 임포트 제거로 번들 사이즈도 소폭 감소.
- **평가**: 긍정적 변경.

---

### [INFO] `turnTimer` 즉시 clear 패턴 제거
- **위치**: `execution-engine.service.ts` - `waitForAiConversation`
- **상세**: 기존 코드는 `turnTimer`를 설정하고 await 직후 `clearTimeout(turnTimer)`로 즉시 해제하는 패턴을 반복했음. 변경 후 이 오버헤드가 전면 제거됨.
- **평가**: 긍정적 변경.

---

### [INFO] `clearTimeout(timeoutHandle!)` non-null assertion 제거
- **위치**: `execution-engine.service.ts` - `finally` 블록
- **상세**: `timeoutHandle`이 `undefined`일 때 `clearTimeout(undefined)`는 no-op이지만, 명시적 조건부 호출로 의도가 명확해졌고 불필요한 함수 호출도 방지됨.
- **평가**: 미미한 긍정적 변경.

---

## 요약

이번 변경은 타임아웃 로직 제거를 핵심으로 하며 성능 관점에서는 전반적으로 긍정적이다. 가장 효과가 큰 부분은 프론트엔드의 `setInterval` 기반 카운트다운 제거로, 버튼 대기 중 매초 발생하던 불필요한 리렌더링이 사라졌다. 백엔드에서는 타이머 객체 생성·해제 오버헤드가 줄고, `timeoutMs === 0` 최적화로 불필요한 Promise 할당도 방지된다. 다만 `pendingContinuations` Map의 항목이 timeout 없이 무한 보존될 수 있다는 점은 주목할 필요가 있다. 이는 의도적 설계 결정이지만, 상위 레이어(stale execution 정리 메커니즘, WebSocket disconnect 처리 등)가 보완되어 있지 않다면 장기 운영 중 메모리 누수로 이어질 수 있다.

## 위험도

**LOW**