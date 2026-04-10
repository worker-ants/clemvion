### 발견사항

---

**[WARNING] 병렬 브랜치 격리 테스트에서 Q 노드 입력 미검증**
- 위치: `execution-engine.service.spec.ts` — `should isolate parallel branches through port routing`
- 상세: P 노드 입력(`calls[0][0]`)은 `{ branch: 2 }`로 검증하지만 Q 노드(`calls[1][0]`)의 입력은 검증하지 않음. Q가 P의 출력을 올바르게 받는지 확인되지 않아 data propagation 버그를 놓칠 수 있음.
- 제안:
  ```typescript
  expect(calls[1][0]).toEqual({ done: true, input: { branch: 2 } }); // Q receives P's output
  ```

---

**[WARNING] unreachable 노드에 대한 NodeExecution 레코드 및 NODE_SKIPPED 이벤트 미검증**
- 위치: `execution-engine.service.spec.ts` — `Reachability-based execution` describe 블록 전체
- 상세: 새 `reachable` 방식은 unreachable 노드에 대해 어떤 레코드도 생성하지 않는 행동 변경을 도입했으나, 이를 검증하거나 명시하는 테스트가 없음. 기존 `portRoutingSkipped` 방식에서는 SKIPPED 레코드와 이벤트가 생성되었으므로 의도적 변경임을 테스트로 명시해야 함.
- 제안:
  ```typescript
  // C는 unreachable이므로 NodeExecution 레코드가 생성되지 않아야 함
  expect(mockNodeExecutionRepo.create).not.toHaveBeenCalledWith(
    expect.objectContaining({ nodeId: 'node-c' })
  );
  // NODE_SKIPPED 이벤트도 발행되지 않아야 함
  expect(mockWebsocketService.emitNodeEvent).not.toHaveBeenCalledWith(
    executionId, 'node-c', expect.anything(), expect.anything()
  );
  ```

---

**[WARNING] disabled 노드의 downstream이 대체 경로로 도달 가능한 fan-in 케이스 누락**
- 위치: `execution-engine.service.spec.ts` — `should not execute nodes downstream of a disabled node`
- 상세: A→B(disabled)→C 단순 체인만 검증. A→C 직접 엣지가 있는 경우(B bypass)나 D→C 별도 경로가 있을 때 C가 reachable한지 여부가 테스트되지 않음. `propagateReachability`의 fan-in 동작을 검증하지 못함.
- 제안:
  ```typescript
  // A→B(disabled), A→C: C는 A에서 직접 도달 가능하므로 실행되어야 함
  it('should execute node reachable via alternative path despite disabled upstream', ...)
  ```

---

**[WARNING] executeInline 경로의 reachability 독립 테스트 없음**
- 위치: `execution-engine.service.ts` — `executeInline` 메서드
- 상세: 새 `Reachability-based execution` 테스트들은 모두 `runExecution` 경로(`service.execute()`)만 검증함. `executeInline`은 동일한 `reachable` 초기화/전파 로직을 독립적으로 가지고 있으나, 해당 경로에서 포트 라우팅 격리가 올바르게 동작하는지 검증하는 테스트가 없음. 두 복사본 중 하나가 조용히 diverge할 수 있음.
- 제안: 서브워크플로 실행(`WorkflowHandler` → `executeInline`)을 통해 포트 라우팅 분기 격리를 검증하는 통합 테스트 추가.

---

**[INFO] 백-엣지 + 포트 라우터 복합 시나리오 테스트 없음**
- 위치: `execution-engine.service.spec.ts` — `Cyclic workflow execution` describe 블록
- 상세: 백-엣지 활성화 시 `reachable` 범위 초기화 후 재전파하는 새 로직을 명시적으로 검증하지 않음. 루프 내에 포트 라우터가 포함된 경우(1차 순환에서 port1 선택, 2차 순환에서 port2 선택) 이전 패스의 reachability 오염 여부가 확인되지 않음.
- 제안: 루프 내 분기 조건이 변경되는 시나리오 테스트 추가.

---

**[INFO] 테스트 노드 객체 보일러플레이트 중복**
- 위치: `execution-engine.service.spec.ts` — `Reachability-based execution` describe 블록
- 상세: `containerId: undefined as unknown as string`, `toolOwnerId: undefined as unknown as string` 패턴이 15회 이상 반복됨. 가독성을 저해하며, 스펙 변경 시 수정 범위가 넓어짐.
- 제안: describe 블록 상단에 팩토리 함수 정의:
  ```typescript
  const makeNode = (id: string, type: string, label: string, overrides: Partial<Node> = {}): Partial<Node> => ({
    id, workflowId, type, category: NodeCategory.LOGIC, label, config: {},
    isDisabled: false, containerId: undefined as unknown as string,
    toolOwnerId: undefined as unknown as string, ...overrides,
  });
  ```

---

**[INFO] text-classifier.handler.spec.ts 변경은 테스트 동작에 영향 없음**
- 위치: `text-classifier.handler.spec.ts` 전체 diff
- 상세: `result.errors!.length` → `result.errors.length` 수정은 `ValidationResult.errors`가 `string[]`(non-optional)임을 명시하는 올바른 타입 정합성 개선. 나머지 8개 hunk는 긴 타입 캐스팅 표현식의 포맷팅 변경으로 동작 변경 없음. 테스트 위험 없음.

---

### 요약

핵심 변경인 `portRoutingSkipped → reachable` 전환에 대응하는 3개의 통합 테스트는 기본 시나리오(포트 라우팅 격리, disabled 노드 downstream 차단, 병렬 브랜치 격리)를 적절히 커버하고 있다. 그러나 이번 변경이 도입한 **행동 변화(unreachable 노드의 NodeExecution 레코드 및 NODE_SKIPPED 이벤트 미발행)에 대한 명시적 검증이 없어**, 의도적 변경인지 부수 효과인지 테스트 코드만으로는 판단할 수 없다. 또한 `executeInline` 경로의 reachability 로직이 `runExecution`과 독립적으로 복제되어 있음에도 별도 테스트가 없고, fan-in 시나리오와 사이클+분기 복합 케이스도 누락되어 있다. `text-classifier` 관련 변경은 테스트 관점에서 위험 없음.

### 위험도
**MEDIUM**