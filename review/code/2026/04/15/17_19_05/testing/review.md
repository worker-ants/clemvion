### 발견사항

---

**[WARNING] `emitExecutionSnapshot` 메서드에 대한 직접 테스트가 없음**
- 위치: `websocket.gateway.spec.ts`
- 상세: `handleSubscribe` → `emitExecutionSnapshot` 흐름에 대한 통합 테스트가 없음. mock의 `findById`는 `mockRejectedValue`로 실패 케이스만 기본 설정되어 있으나, 성공 시 `client.emit('execution.snapshot', ...)` 호출 여부를 검증하는 테스트가 없음
- 제안:
  ```ts
  it('should emit execution.snapshot after subscribing to execution channel', async () => {
    const { socket, emit } = createMockSocket({ id: 'client-1' });
    getSubscriptions().set('client-1', new Set());
    
    const mockExecService = module.get(ExecutionsService);
    (mockExecService.findById as jest.Mock).mockResolvedValue({ id: 'exec-123', status: 'running' });
    
    gateway.handleSubscribe({ channel: 'execution:exec-123' }, socket);
    await new Promise(resolve => setTimeout(resolve, 0)); // flush async
    
    expect(emit).toHaveBeenCalledWith('execution.snapshot', expect.objectContaining({
      executionId: 'exec-123',
    }));
  });
  ```

---

**[WARNING] `execution-engine.service.ts`의 새 필드 전달 경로에 대한 테스트 미존재**
- 위치: `execution-engine.service.ts` diff 전체
- 상세: `createNodeExecution`에 `inputData` 파라미터를 추가하고, 각 `emitNodeEvent` 호출에 `input`, `finishedAt`, `interactionData`를 추가했지만, 이 필드들이 실제로 WebSocket 페이로드에 포함되는지 검증하는 테스트가 없음. `execution-engine.service.spec.ts`가 존재한다면 해당 케이스가 빠진 것
- 제안: `emitNodeEvent`의 mock capture를 통해 `input` 필드가 포함된 payload를 검증하는 단위 테스트 추가

---

**[WARNING] snapshot 핸들러가 `running` 상태를 수신할 때의 케이스 미검증**
- 위치: `use-execution-events.test.ts`
- 상세: `handleSnapshot`은 `running` 상태 + 이전 상태가 `waiting_for_input`이 **아닌** 경우(즉, 일반 진행 중인 실행의 snapshot 수신)에 아무런 상태 전환도 하지 않는데, 이 경로에 대한 명시적 테스트가 없음. node 상태 reconcile만 되고 execution status는 변하지 않아야 함을 검증해야 함
- 제안:
  ```ts
  it('does not change execution status when snapshot is for a running execution', () => {
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));
    
    emitSnapshot(createMockExecution({ status: "running" }));
    
    expect(useExecutionStore.getState().status).toBe("running");
  });
  ```

---

**[WARNING] snapshot에서 `ai_conversation` 대기 상태 rehydration 테스트 누락**
- 위치: `use-execution-events.test.ts`
- 상세: `form`과 `buttons` 대기 상태는 테스트가 있으나, `waiting_for_input` + `interactionType === "ai_conversation"` 분기를 커버하는 테스트가 없음. 해당 분기는 `handleSnapshot` 내부에 코드가 존재함
- 제안: `interactionType: "ai_conversation"` 인 `outputData`를 가진 snapshot으로 `pauseForConversation` 호출 여부 검증 테스트 추가

---

**[WARNING] `running` + 이전 상태 `waiting_for_input` 조합에서 각 interaction type별 resume 분기 미검증**
- 위치: `use-execution-events.test.ts`
- 상세: snapshot에서 `execution.status === "running" && prevStatus === "waiting_for_input"` 분기 내 `ai_conversation`, `buttons` resume 경로가 테스트되지 않음. `form` resume은 기존 WS 이벤트 테스트에서 간접 커버되나, snapshot 경유 케이스는 별도 필요
- 제안: `waitingInteractionType`을 `"buttons"`, `"ai_conversation"`으로 사전 세팅 후 running snapshot을 emit하여 각 resume 함수 호출 검증

---

**[INFO] `websocket.gateway.spec.ts` mock의 `findById` 기본값이 실패로 설정됨**
- 위치: `websocket.gateway.spec.ts:53`
- 상세: `findById: jest.fn().mockRejectedValue(new Error('not found'))`를 기본값으로 설정했는데, 이는 스냅샷 emit이 기본적으로 실패함을 의미. 기존 `handleSubscribe` 성공 테스트(`should accept valid execution channel`)에서 비동기 snapshot 실패가 조용히 삼켜지므로 테스트는 통과하지만, 향후 성공 케이스 테스트 추가 시 `beforeEach`에서 mock 재설정이 필요함을 명시해두면 좋음
- 제안: 주석으로 의도 문서화 (`// Default: snapshot fetch fails (tests that need success must override)`)

---

**[INFO] `ExecutionEventType.EXECUTION_SNAPSHOT` 열거형 추가에 대한 테스트 불필요**
- 위치: `websocket.service.ts`
- 상세: enum 값 추가 자체는 테스트 불필요하나, `emitExecutionSnapshot`이 이 enum 값을 사용하지 않고 직접 문자열 `'execution.snapshot'`을 emit하는 점은 일관성 이슈. 런타임 버그는 아니나 enum 도입 의도와 불일치

---

**[INFO] `getHandler` / `emitSnapshot` 헬퍼 함수의 타입 안전성**
- 위치: `use-execution-events.test.ts:49-54`
- 상세: `getHandler`의 반환 타입이 `(data: unknown) => void`이고 undefined일 때 런타임 에러가 발생할 수 있음. 테스트 코드 내 오류이나 `expect(handler).toBeDefined()` 선행 검증 없이 바로 호출하는 패턴이 일부 있음
- 제안: `emitSnapshot` 내에서 `handler`가 undefined이면 테스트 실패 메시지와 함께 throw하거나, `getHandler` 반환 타입을 `(data: unknown) => void | undefined`로 명시하고 assertion 추가

---

### 요약

REST 폴링을 WebSocket 스냅샷으로 교체하는 아키텍처 변경은 전반적으로 잘 테스트되어 있으며, 기존 폴링 테스트를 동기적 스냅샷 emit 방식으로 올바르게 전환했습니다. `emitSnapshot` / `getHandler` 헬퍼 도입으로 테스트 가독성도 향상되었습니다. 다만, 백엔드 `emitExecutionSnapshot` 메서드의 성공 경로 테스트 누락, `ai_conversation` 대기 상태의 snapshot rehydration 미검증, `running` 상태 snapshot 수신 시 무변경 경로 미검증이 주요 커버리지 갭으로 남아 있습니다. `execution-engine.service.ts`의 새 이벤트 필드(`input`, `finishedAt`, `interactionData`) 전달 경로도 단위 테스트 커버가 필요합니다.

### 위험도

**MEDIUM**