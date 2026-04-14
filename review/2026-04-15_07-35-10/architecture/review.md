## 아키텍처 코드 리뷰

---

### 발견사항

- **[WARNING]** `pendingContinuations` 자기-청소(self-cleanup) 메커니즘 제거
  - 위치: `execution-engine.service.ts` — `waitForButtonInteraction`, `waitForAiConversation`, 폼 대기 구간 전체
  - 상세: 기존에는 `setTimeout` 콜백이 타임아웃 시 `pendingContinuations.delete(executionId)` 를 직접 호출했기 때문에 Map 엔트리가 자동 회수됐다. 변경 후에는 ① 사용자가 직접 인터랙션하거나 ② 외부 cancel 명령이 도착해야만 엔트리가 제거된다. 사용자가 탭을 닫거나 네트워크가 끊기는 등 "암묵적 이탈" 시나리오에서 WebSocket disconnect가 자동으로 `cancelExecution`을 호출해 `reject`를 트리거하지 않는다면, `pendingContinuations` Map은 오랜 시간 동안 누적돼 메모리 압박이 발생한다. 이 위험성은 spec 어디에도 명시되어 있지 않다.
  - 제안: WebSocket `disconnect` 이벤트 핸들러에서 해당 클라이언트가 관찰 중인 executionId의 pending continuation을 `reject(new ExecutionCancelledError())` 로 정리하거나, 최소한 `pendingContinuations.size` 를 지표로 노출해 운영 환경에서 모니터링 가능하도록 한다.

- **[WARNING]** Sub-workflow execution timeout과 내부 인터랙션 무한 대기 간 의미 충돌
  - 위치: `execution-engine.service.ts:617` — `executeSubWorkflow`
  - 상세: Sub-workflow의 상위 타임아웃은 여전히 `options?.timeoutMs ?? 300_000` (5분 기본값)이다. Sub-workflow 내부에 Button/Form/AI 노드가 있으면 그 노드는 명세대로 "무한 대기"를 기대하지만, 5분 후 상위 `Promise.race` 에서 timeout 에러가 발생해 sub-execution 상태가 `FAILED`로 기록된다. 문제는 sub-execution이 FAILED로 전이된 이후에도 해당 노드의 pending continuation이 Map에 살아있어, 뒤늦게 사용자가 버튼을 클릭하면 이미 종료된 실행 위에서 resolve가 호출된다.
  - 제안: `executeSubWorkflow` 에서 timeout이 발생할 때 `pendingContinuations.get(savedExecution.id)` 를 명시적으로 reject 처리하는 정리 코드를 추가한다. 또는 sub-workflow timeout을 0으로 설정할 때의 동작을 WorkflowHandler → executeSubWorkflow 호출 경로 전체에 걸쳐 검증한다.

- **[INFO]** `0 = no timeout` 시맨틱이 레이어 간 일관되게 전파되지 않은 경로 존재
  - 위치: `execution-engine.service.ts:617`, `workflow.handler.ts`, `flow-configs.tsx`
  - 상세: UI와 validation에서는 `timeout = 0`을 "타임아웃 없음"으로 정의했으나, `executeSubWorkflow` 내부의 `options?.timeoutMs ?? 300_000` 기본값 경로가 WorkflowHandler에서 실제로 `0`을 넘겨주는지 코드 추적이 필요하다. WorkflowHandler 전체 컨텍스트에는 `timeout` 필드를 `executionEngine.executeSubWorkflow` 호출 시 어떻게 전달하는지가 포함되어 있지 않아, `0`이 기본값 300s에 의해 덮어써질 가능성을 배제할 수 없다.
  - 제안: WorkflowHandler.execute() 에서 `config.timeout`을 `executeSubWorkflow` options로 전달하는 코드를 확인하고, `timeout === 0` 일 때 `timeoutMs: 0` 이 올바르게 전달되는지 단위 테스트로 커버한다.

- **[INFO]** `ButtonTimeoutError` 제거 후 오류 분류 일관성 확인 필요
  - 위치: `execution-engine.service.ts:1038` — `runExecution` 에러 처리 블록
  - 상세: `ButtonTimeoutError` 브랜치를 제거하면서 `ExecutionCancelledError` 브랜치와 기본 FAILED 브랜치만 남았다. 기존에 타임아웃으로 `CANCELLED` 처리되던 케이스가 이제는 도달할 수 없으므로 누락은 없다. 다만 `ExecutionCancelledError` 핸들러가 유일한 "cancel" 분기이므로, 향후 cancel 이벤트의 출처를 구분해야 하는 요구사항이 생기면 이 단일 분기를 수정해야 한다.
  - 제안: 현재는 문제 없음. 단, cancel 사유를 구분할 필요가 생길 경우 `ExecutionCancelledError` 에 `reason` 필드를 추가하는 방향으로 확장하는 것이 자연스럽다.

- **[INFO]** 프론트엔드 `ButtonBar` 컴포넌트 책임 명확화
  - 위치: `button-bar.tsx`
  - 상세: `useEffect` 타이머 로직 2개가 제거되어 컴포넌트가 순수 프레젠테이션 역할에 더 가까워졌다. 이는 SRP 관점에서 긍정적인 변화다. 변경 전 컴포넌트는 타이머 관리(실행 제어) + UI 렌더링 두 책임을 가졌는데, 이 중 실행 제어 책임이 제거됐다.

---

### 요약

이번 변경은 "인터랙션 타임아웃"이라는 기능을 스펙·백엔드·프론트엔드 전 레이어에 걸쳐 일관되게 제거한 수직적 정리(vertical slice removal)로, 각 계층의 책임이 깔끔하게 단순화됐고 타입 시스템·문서·코드 간 정합성도 유지됐다. 단, 타임아웃이 수행하던 **리소스 정리(resource cleanup)** 역할이 함께 제거된 것이 핵심 아키텍처 리스크다. `pendingContinuations` Map의 엔트리가 이제는 명시적 사용자 인터랙션 또는 외부 cancel에만 의존해 회수되므로, WebSocket disconnect 처리와 sub-workflow 타임아웃 경계에서의 pending continuation 정리 로직이 보완되지 않으면 장기 운영 시 메모리 누수 및 좀비 Promise 축적 위험이 있다.

### 위험도

**MEDIUM**