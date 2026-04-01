### 발견사항

**[INFO]** `act` import이 unused
- 위치: `use-execution-events.test.ts` line 2
- 상세: `act`가 import되어 있으나 테스트에서 사용되지 않음
- 제안: import에서 `act` 제거

**[INFO]** `executionsApi.getById` 누락 테스트 (`executions.ts`)
- 위치: `executions.ts` — `getById` 함수
- 상세: API 모듈 자체에 대한 단위 테스트가 없음. 현재는 `use-execution-events` 테스트 내에서 간접적으로만 검증됨
- 제안: `apiClient.get`이 올바른 URL(`/executions/${id}`)로 호출되는지 검증하는 단위 테스트 추가 (`src/lib/api/__tests__/executions.test.ts`)

**[WARNING]** `cancelled` 상태 처리 — 테스트와 실제 의미의 불일치
- 위치: `use-execution-events.test.ts` lines 186–202
- 상세: 테스트에서 `cancelled` poll 결과를 store의 `status === "failed"`로 검증. `cancelled`는 `failed`와 별개의 의미인데, 스토어가 이를 구분하지 않는다면 사용자에게 잘못된 에러 표시 가능. 의도적 처리인지 확인 필요
- 제안: 이 동작이 의도적이라면 테스트 주석에 이유 명시. 스토어가 `cancelled` 상태를 지원해야 한다면 별도 처리 추가

**[INFO]** WebSocket 이벤트 핸들러 페이로드 처리 미검증
- 위치: `use-execution-events.test.ts` — `binds all event handlers` 테스트 (line 64)
- 상세: 이벤트 핸들러가 등록되었는지만 확인하고, 실제로 각 이벤트 페이로드를 수신했을 때 스토어 상태가 올바르게 업데이트되는지 테스트 없음 (`execution.started`, `execution.node.started` 등)
- 제안: 주요 이벤트 핸들러 호출 시 store mutation을 검증하는 테스트 추가

```typescript
it("updates store on execution.started event", () => {
  renderHook(() => useExecutionEvents({ executionId: "exec-1" }));
  const handler = (mockClient.on as Mock).mock.calls
    .find((c) => c[0] === "execution.started")?.[1];
  act(() => handler?.({ executionId: "exec-1" }));
  expect(useExecutionStore.getState().status).toBe("running");
});
```

**[INFO]** `waitForConnect` timeout 시나리오 미테스트
- 위치: `ws-client.test.ts` — `waitForConnect` describe 블록
- 상세: 연결이 끝내 이루어지지 않을 경우(timeout) `waitForConnect`의 동작이 테스트되지 않음. 현재 구현이 timeout을 지원하지 않더라도, 무한 대기 가능성 문서화 필요
- 제안: timeout 동작 또는 무한 대기 허용 여부를 명시하는 테스트 또는 주석 추가

**[INFO]** `on`/`off` 핸들러 매핑 대칭성 미검증
- 위치: `use-execution-events.test.ts` — cleanup 테스트 (line 146)
- 상세: cleanup 시 `mockClient.off`가 호출되었는지만 확인하고, 등록된 것과 동일한 핸들러 참조로 `off`가 호출되는지 검증하지 않음. 잘못된 핸들러를 `off`해도 테스트 통과
- 제안:

```typescript
const onCalls = (mockClient.on as Mock).mock.calls;
const offCalls = (mockClient.off as Mock).mock.calls;
onCalls.forEach(([event, handler]) => {
  expect(offCalls).toContainEqual([event, handler]);
});
```

**[INFO]** `skips connect if already connected` 테스트의 소켓 재생성 케이스 누락
- 위치: `ws-client.test.ts` line 57
- 상세: 소켓이 있지만 `connected === false`인 경우(연결 끊김 후 재연결 시도) 동작이 테스트되지 않음
- 제안: 소켓이 있지만 disconnected 상태일 때 재연결 동작 검증 테스트 추가

---

### 요약

전반적으로 테스트 구조가 잘 갖춰져 있고, singleton 패턴, cleanup, poll 실패 처리 등 핵심 동작이 커버됨. 다만 WebSocket 이벤트 핸들러의 **페이로드 처리(store mutation)**가 검증되지 않아 실제 실행 흐름에서 silent bug가 발생할 수 있는 가장 큰 갭이 존재함. `cancelled → failed` 매핑은 의도 불명확으로 설명이 필요하고, `executionsApi` 자체 단위 테스트가 없어 URL 구성 오류 등을 조기에 발견하기 어려움. cleanup 핸들러 대칭성 검증도 보강하면 회귀 안전성이 높아짐.

### 위험도
**MEDIUM**