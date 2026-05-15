### 발견사항

**[INFO] `executionsApi.getById` — 캐싱 전략 부재**
- 위치: `executions.ts` — `getById`
- 상세: 동일 `executionId`에 대해 폴링이 반복 호출될 때마다 매번 HTTP 요청을 발생시킴. `running` 상태의 실행 결과는 자주 변하지만, `completed`/`failed`/`cancelled` 상태는 불변이므로 중복 요청이 낭비됨.
- 제안: 완료 상태 응답에 대해 메모이제이션 또는 단기 캐시(e.g., React Query / SWR의 `staleTime`) 적용 고려.

---

**[INFO] 테스트 내 `useExecutionStore.setState` 전체 교체**
- 위치: `use-execution-events.test.ts` — `beforeEach` 블록
- 상세: `nodeStatuses: new Map()`을 매 테스트마다 새로 생성함. 테스트 수가 많아질 경우 미미하지만, Zustand의 `setState`는 partial merge를 지원하므로 전체 교체는 의도적 선택임. 현재 규모에서는 문제 없음.
- 제안: 현 구조 유지 가능. 다만 `new Map()` 생성 비용을 줄이려면 `resetStore()` 액션을 스토어에 두는 것도 패턴상 명확함.

---

**[INFO] `mockSocket.once` 내 `setTimeout` 사용**
- 위치: `ws-client.test.ts` — `waits for connect event if not yet connected`
- 상세: `setTimeout(() => callback(), 10)` 은 실제 타이머 의존성으로 인해 테스트 실행 시간을 불필요하게 증가시킴. `vi.useFakeTimers()`를 사용하지 않아 실제 10ms를 기다림.
- 제안:
  ```ts
  vi.useFakeTimers();
  mockSocket.once.mockImplementation((event, cb) => {
    if (event === "connect") setTimeout(cb, 10);
  });
  vi.runAllTimers();
  ```

---

**[INFO] `act` import 미사용**
- 위치: `use-execution-events.test.ts` — line 2
- 상세: `act`가 import되어 있으나 어떤 테스트에서도 사용되지 않음. 번들 크기 영향은 없지만(테스트 파일이므로) 불필요한 심볼.
- 제안: import에서 `act` 제거.

---

### 요약

세 파일 모두 성능 임계 경로에 직접 영향을 미치는 심각한 문제는 없습니다. `executions.ts`는 단순 API wrapper로 구조 자체에 비효율이 없으며, 두 테스트 파일도 mock 기반으로 실제 I/O 비용이 없습니다. 다만 폴링 기반 구현에서 완료 상태 응답에 대한 캐싱이 없고, `ws-client.test.ts`의 실제 타이머 의존이 테스트 스위트 누적 시간을 늘릴 수 있으며, 미사용 `act` import가 존재합니다. 전반적으로 성능 위험도는 낮습니다.

### 위험도

**LOW**