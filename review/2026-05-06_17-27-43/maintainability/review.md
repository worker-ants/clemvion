이제 세 파일을 모두 충분히 파악했습니다. 유지보수성 관점에서 분석합니다.

---

## 발견사항

### `execution-engine.service.ts`

---

- **[CRITICAL]** `runExecution`과 `executeInline` 간 실행 루프 코드 대규모 중복
  - 위치: `runExecution` (line 915~1309), `executeInline` (line 426~773)
  - 상세: 두 메서드가 아래 로직을 거의 동일하게 구현한다.
    - `backEdgeMap` / `outgoingEdgeMap` 구축
    - `reachable` 집합 초기화 (trigger/no-incoming-edge 폴백)
    - `while(pointer < sortedNodeIds.length)` 본체 전체 (disabled 노드 스킵, 반복 한도 체크, 컨테이너 디스패치, blocking 노드 대기, back-edge 점프)
    - 컨테이너 타입 체크: `node.type === 'foreach' || 'loop' || 'map'`
    - blocking 분기: `waitForFormSubmission` / `waitForButtonInteraction` / `waitForAiConversation` 호출
  - **두 경로 중 하나에만 버그 수정이 반영되는 실수가 발생할 구조적 위험이 매우 높다.**
  - 제안: 그래프 실행 본체를 `executeGraph(graphContext, options)` 같은 private 메서드로 추출하고, `runExecution`과 `executeInline`이 각자의 DB 세팅만 담당하도록 분리.

---

- **[CRITICAL]** God Class — 단일 서비스가 너무 많은 책임을 가짐 (~2800+ 줄)
  - 위치: 파일 전체
  - 상세: `ExecutionEngineService` 하나가 담당하는 영역:
    - 워크플로 실행 오케스트레이션
    - Form/Button/AI 대화 대기·재개 (3개 blocking 메서드, 각 ~250-300줄)
    - 에러 정책·재시도
    - 실행 경로 직렬화 (`appendExecutionPath`)
    - 표현식 해석 (`executeNode` 내 인라인)
    - 포트 라우팅·컨트롤 필드 스트립
    - LLM provider 검증 필터 (`filterAiNoLlmProviderError`)
  - 생성자 의존성이 18개로, 이것 자체가 책임 과부하의 지표다.
  - 제안: `FormInteractionHandler`, `AiConversationHandler`, `ButtonInteractionHandler` 등 별도 클래스로 blocking 로직을 추출. 단기적으로는 `waitFor*` 3개 메서드를 별도 파일로 이동.

---

- **[WARNING]** `waitForAiConversation`이 ~280줄의 단일 메서드로, 다중 책임 보유
  - 위치: line 1573~1901
  - 상세: 이 메서드 안에서 ① 실행 상태 전이, ② DB 저장, ③ WS 이벤트 발행, ④ multi-turn 루프, ⑤ `waiting_for_input`/terminal 분기, ⑥ 구조화 출력 캐시 업데이트를 모두 처리한다. Cyclomatic Complexity가 매우 높다.
  - 제안: `emitWaitingForInput`, `handleAiMessage`, `handleAiEndConversation`, `finalizeAiNode` 등으로 분해.

---

- **[WARNING]** `executeNode`에서 `nodeContext`를 세 번 연속 spread로 재구성
  - 위치: line 2279~2338
  - 상세:
    ```ts
    nodeContext = { ...context, expressionContext: exprContext }; // 1차
    nodeContext = { ...nodeContext, rawConfig: Object.freeze(...) }; // 2차
    nodeContext = { ...nodeContext, nodeId: ..., nodeExecutionId: ... }; // 3차
    ```
    매번 새 객체를 생성하며 직전 스프레드를 덮어쓴다. 의도는 명확하지만 한 번에 조합할 수 있다.
  - 제안:
    ```ts
    nodeContext = {
      ...(nodeMap ? { ...context, expressionContext: exprContext } : context),
      rawConfig: Object.freeze({ ...(node.config ?? {}) }),
      nodeId: node.id,
      nodeExecutionId: nodeExecution.id,
    };
    ```

---

- **[WARNING]** `executeNode`의 에러 정책 switch에서 동일 패턴 4회 반복
  - 위치: line 2415~2506
  - 상세: `skip`, `use_default`, `route_error`, `stop` 네 케이스가 모두 `finishedAt = new Date()`, `durationMs = finishedAt - startedAt`, `save(nodeExecution)` 를 반복한다.
  - 제안:
    ```ts
    private finalizeNodeExecution(ne: NodeExecution, status: NodeExecutionStatus) {
      ne.status = status;
      ne.finishedAt = new Date();
      ne.durationMs = ne.finishedAt.getTime() - ne.startedAt.getTime();
    }
    ```

---

- **[WARNING]** 매직 스트링이 두 실행 경로에 흩어져 있음
  - 위치: `runExecution` / `executeInline` 내 여러 곳
  - 상세: `'foreach'`, `'loop'`, `'map'`, `'parallel'`, `'manual_trigger'`, `'form'`, `'waiting_for_input'`, `'ai_message'`, `'ai_end_conversation'`, `'button_click'`, `'button_continue'` 등이 리터럴로 반복된다.
  - 제안: `NODE_TYPES`, `INTERACTION_TYPES` 같은 상수 객체나 `enum`으로 관리.

---

- **[WARNING]** `gatherNodeInput`이 매 노드마다 전체 엣지 배열을 `filter()`로 스캔
  - 위치: line 2637~2684
  - 상세: `incomingEdges = edges.filter(e => e.targetNodeId === nodeId)` — 노드 수 N, 엣지 수 E이면 O(N×E). `outgoingEdgeMap`처럼 `incomingEdgeMap`을 사전 구축하면 O(E) 전처리 후 O(1) 조회.
  - 제안: `runExecution`/`executeInline` 그래프 준비 단계에서 `incomingEdgeMap`도 함께 구축하고 `gatherNodeInput`에 전달.

---

- **[INFO]** `_graphEdges` 미사용 파라미터가 `waitForButtonInteraction` 시그니처에 노출
  - 위치: line 1914
  - 상세: `_graphEdges: GraphEdge[]`는 밑줄 프리픽스로 unused임을 표시했지만 인터페이스 상 파라미터로 존재한다. 호출부도 `graphEdges`를 넘기며 이 인수가 필요한지 혼란을 준다.
  - 제안: 실제로 불필요하다면 파라미터 자체를 제거.

---

### `execution-engine.service.spec.ts`

---

- **[WARNING]** `(service as any)['contextService']` 패턴으로 private 접근 — 2회
  - 위치: line 295, 1239, 1306
  - 상세: private 멤버에 `as any` 캐스트로 접근하면 리팩토링(멤버명 변경, 추출) 시 타입 에러 없이 테스트가 조용히 깨진다.
  - 제안: `ExecutionContextService`를 `provide`/`inject` 체계로 직접 주입받거나, 테스트 전용 팩토리 메서드를 서비스에 추가.

---

- **[WARNING]** `Partial<Node>` 픽스처 정의가 각 `describe` 블록마다 반복
  - 위치: line 65~99, 744~781, 956~967, 1159~1186, 1596~1630 외
  - 상세: 8개 이상의 필드를 가진 노드 객체 리터럴이 각 시나리오마다 다시 정의된다. `containerId: undefined`, `toolOwnerId: undefined`, `isDisabled: false` 같은 기본값이 반복된다.
  - 제안:
    ```ts
    function makeNode(overrides: Partial<Node>): Partial<Node> {
      return {
        workflowId,
        category: NodeCategory.LOGIC,
        config: {},
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
        ...overrides,
      };
    }
    ```

---

- **[WARNING]** `makeAiAgentHandler` 팩토리 패턴이 AI 시나리오에만 적용됨 — 일관성 부족
  - 위치: line 971~1003 (있음), Form/Button 시나리오 (없음)
  - 상세: AI Agent 핸들러는 `makeAiAgentHandler`로 깔끔하게 추상화되었지만, Form/Button 핸들러는 여전히 인라인으로 정의한다. 팩토리 패턴이 파일 전체에 일관되게 적용되지 않는다.
  - 제안: `makeFormHandler`, `makePassthroughHandler` 등 파일 상단에 정의하고 일관 적용.

---

- **[INFO]** `mockConfigService` 변수가 선언·할당되지만 테스트 어설션에서 미사용
  - 위치: line 53, 279
  - 상세: `let mockConfigService: { get: jest.Mock }` 이후 `module.get(ConfigService)`로 값을 얻지만, 이후 어떤 테스트도 이 변수를 검증에 사용하지 않는다.
  - 제안: 실제로 필요 없다면 제거하여 노이즈 제거.

---

### `node-handler.interface.ts`

---

- **[WARNING]** `NodeHandler.execute`의 반환 타입이 `Promise<NodeHandlerOutput> | Promise<unknown>`으로 사실상 타입 안전성이 없음
  - 위치: line 119~123
  - 상세: `| Promise<unknown>`이 있으면 TypeScript가 반환값을 `NodeHandlerOutput`으로 좁히지 않는다. 엔진 내부에서 `adaptHandlerReturn`으로 정규화하는 것이 이 관대한 타입의 존재 이유로 보이지만, 인터페이스 수준에서는 잘못된 핸들러 구현을 컴파일 타임에 잡지 못한다.
  - 제안: `Promise<NodeHandlerOutput | unknown>` → `Promise<NodeHandlerOutput>` 으로 좁히고, 레거시 핸들러는 별도 `LegacyNodeHandler` 인터페이스로 분리하거나 어댑터에서 처리.

---

- **[INFO]** `ExecutionContext` 필드 수가 14개, 다수가 optional — 구조적 응집도 저하
  - 위치: line 1~61
  - 상세: `loopContext`, `itemContext`, `recursionDepth`, `parentNodeExecutionId` 같은 컨테이너/서브워크플로 전용 필드가 공통 컨텍스트에 모두 모여 있다. 기본 컨텍스트에 `undefined`가 산재한다.
  - 제안: 단기적으로 현 구조 유지가 합리적이나, 향후 `LoopExecutionContext extends ExecutionContext` 같은 서브타입으로 컨텍스트를 세분화하면 핸들러가 자신이 필요한 필드만 선언할 수 있다.

---

## 요약

`node-handler.interface.ts`는 문서화가 충실하고 구조도 간결하나 `execute` 반환 타입이 타입 안전성을 약화시킨다. `execution-engine.service.spec.ts`는 전반적으로 읽기 쉽지만, `(service as any)` 접근과 노드 픽스처 중복이 리팩토링 취약점이다. **가장 심각한 문제는 `execution-engine.service.ts`**로, `runExecution`과 `executeInline` 사이에 수백 줄의 실행 루프가 중복되어 있어 버그 수정이 반드시 두 곳에 동시에 이루어져야 하는 구조적 위험이 있으며, 18개 의존성을 가진 God Class에 280~300줄짜리 blocking 메서드들이 함께 존재해 유지보수 부담이 집중된다.

## 위험도

**HIGH**