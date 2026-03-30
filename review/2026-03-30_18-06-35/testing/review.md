## 발견사항

### [WARNING] `WebsocketService` 이벤트 호출 검증 누락
- **위치**: `execution-engine.service.spec.ts`
- **상세**: `WebsocketService` mock이 추가되었으나, 실행 흐름에서 실제로 `emitExecutionEvent`/`emitNodeEvent`가 올바른 인자로 호출되는지 검증하는 테스트가 없음. mock이 주입되었는지만 확인할 뿐, 실제 동작 검증 없음.
- **제안**:
```typescript
it('should emit EXECUTION_STARTED and EXECUTION_COMPLETED events', async () => {
  const wsService = module.get<WebsocketService>(WebsocketService);
  await service.execute(workflowId, { data: 'test' });
  expect(wsService.emitExecutionEvent).toHaveBeenCalledWith(
    executionId,
    ExecutionEventType.EXECUTION_STARTED,
    { status: ExecutionStatus.RUNNING },
  );
  expect(wsService.emitExecutionEvent).toHaveBeenCalledWith(
    executionId,
    ExecutionEventType.EXECUTION_COMPLETED,
    { status: ExecutionStatus.COMPLETED },
  );
});

it('should emit EXECUTION_FAILED event on error', async () => {
  mockWorkflowRepo.findOneBy.mockResolvedValue(null);
  const wsService = module.get<WebsocketService>(WebsocketService);
  await expect(service.execute(workflowId)).rejects.toThrow();
  // FAILED event should NOT be emitted if workflow not found (pre-run error)
  expect(wsService.emitExecutionEvent).not.toHaveBeenCalled();
});
```

---

### [WARNING] Node 이벤트(emitNodeEvent) 검증 누락
- **위치**: `execution-engine.service.spec.ts`
- **상세**: 노드 실행 중 `NODE_STARTED`, `NODE_COMPLETED`, `NODE_SKIPPED`, `NODE_FAILED` 이벤트 방출 여부를 검증하는 테스트가 전혀 없음. 특히 `NODE_SKIPPED`(비활성 노드)와 `NODE_FAILED`(에러 노드) 경로는 현재 커버되지 않음.
- **제안**: 각 노드 상태 전환별 WebSocket 이벤트 방출 검증 테스트 추가

---

### [WARNING] `saveCanvas` 서비스 테스트 미존재
- **위치**: `workflows.service.spec.ts`
- **상세**: `saveCanvas` 메서드가 `workflows.service.ts`에 추가되었으나 테스트가 전혀 없음. `dataSource.transaction`을 사용하는 복잡한 upsert 로직(노드 생성/수정/삭제, 엣지 재생성)임에도 커버리지 없음.
- **제안**:
```typescript
describe('saveCanvas', () => {
  it('should create new nodes and edges in a transaction', async () => { ... });
  it('should delete nodes not in submitted list', async () => { ... });
  it('should update existing nodes', async () => { ... });
  it('should recreate all edges on each save', async () => { ... });
  it('should increment workflow version', async () => { ... });
  it('should throw NotFoundException if workflow not found', async () => { ... });
});
```

---

### [WARNING] `create` 시 triggerNode 자동 생성 검증 누락
- **위치**: `workflows.service.spec.ts`
- **상세**: `create` 테스트는 `workflow` 반환 여부만 확인하고, 변경사항인 `manual_trigger` 노드 자동 생성(`mockNodeRepository.save` 호출 여부)을 검증하지 않음.
- **제안**:
```typescript
it('should auto-create a manual_trigger node on workflow creation', async () => {
  await service.create('ws-uuid-1', 'user-uuid-1', { name: 'New Workflow' });
  expect(mockNodeRepository.save).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'manual_trigger',
      category: NodeCategory.TRIGGER,
    }),
  );
});
```

---

### [WARNING] `ManualTriggerHandler` 단위 테스트 없음
- **위치**: `backend/src/modules/execution-engine/handlers/trigger/manual-trigger.handler.ts`
- **상세**: 신규 핸들러 파일에 대한 테스트 파일이 없음. 로직이 단순(pass-through)하더라도 인터페이스 계약 준수 검증 필요.
- **제안**: `manual-trigger.handler.spec.ts` 파일 생성
```typescript
describe('ManualTriggerHandler', () => {
  it('should pass input through as output', async () => {
    const handler = new ManualTriggerHandler();
    const input = { key: 'value' };
    const result = await handler.execute(input, {}, {} as ExecutionContext);
    expect(result).toBe(input);
  });
  it('should always return valid from validate', () => {
    const handler = new ManualTriggerHandler();
    expect(handler.validate({})).toEqual({ valid: true, errors: [] });
  });
});
```

---

### [WARNING] `execute` 컨트롤러 엔드포인트 테스트 없음
- **위치**: `workflows.controller.ts`
- **상세**: `POST /:id/execute`, `POST /:id/save` 두 엔드포인트가 추가되었으나 컨트롤러 단위 테스트(`workflows.controller.spec.ts`)가 존재하지 않거나 커버되지 않음. 워크스페이스 소유권 검증 로직 누락 케이스도 테스트 필요.
- **제안**: 컨트롤러 spec 파일에 아래 케이스 추가
  - 정상 실행 → `executionId` 반환
  - 다른 워크스페이스의 워크플로우 접근 시 `NotFoundException`

---

### [INFO] `mockDataSource.transaction` mock이 실제 트랜잭션 롤백을 시뮬레이션하지 않음
- **위치**: `workflows.service.spec.ts`
- **상세**: `mockDataSource.transaction`의 `EntityManager` mock이 `find`, `save`, `remove`, `create`를 기본 구현으로만 제공하며, 트랜잭션 실패(예외 발생) 시 롤백 동작은 테스트되지 않음.
- **제안**: 트랜잭션 내부에서 예외 발생 시 전체 작업이 실패하고 외부에서 에러가 전파되는지 검증하는 케이스 추가

---

### [INFO] `throwLastError` 개선(`?? new Error(...)`)에 대한 회귀 테스트 부재
- **위치**: `execution-engine.service.ts` line ~463, `execution-engine.service.spec.ts`
- **상세**: `throw lastError ?? new Error('All retry attempts exhausted')` 변경에 대한 테스트가 없음. `lastError`가 `undefined`인 경로(재시도 후 에러가 없는 경우)를 검증하는 테스트가 필요.

---

## 요약

이번 변경은 WebSocket 실시간 이벤트, 캔버스 저장, 워크플로우 실행 엔드포인트, Manual Trigger 노드 등 여러 핵심 기능을 추가했다. `execution-engine.service.spec.ts`에 `WebsocketService` mock이 주입된 것은 올바르지만, 추가된 이벤트 방출 로직에 대한 실질적인 검증(호출 여부·인자·순서)이 전혀 없다. 특히 `saveCanvas` 서비스 메서드, `ManualTriggerHandler`, `execute` 컨트롤러 엔드포인트에 대한 테스트가 완전히 누락되어 있으며, 이는 가장 복잡하고 부작용이 큰 로직들임에도 불구하고 테스트 없이 배포되는 상황이다. `workflows.service.spec.ts`의 `create` 테스트도 트리거 노드 자동 생성이라는 새로운 부작용을 검증하지 않는다. 전반적으로 mock은 잘 설정되었으나 실제 동작 검증(assertion)이 크게 부족하다.

## 위험도

**HIGH**