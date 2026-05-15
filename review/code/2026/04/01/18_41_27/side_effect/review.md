## 발견사항

### 백엔드

- **[WARNING]** `continueExecution` 공개 메서드에 인증 없음
  - 위치: `executions.controller.ts` - `POST :id/continue`
  - 상세: 누구든지 임의의 `executionId`로 폼 제출을 트리거할 수 있음. 실행 소유자 검증 없이 `pendingContinuations` Map을 직접 resolve함.
  - 제안: 실행 소유자(userId)를 확인하거나, 최소한 해당 executionId가 요청자 소유인지 검증하는 가드 추가

- **[WARNING]** WebSocket `execution.submit_form` 핸들러에도 인증 없음
  - 위치: `websocket.gateway.ts` - `handleSubmitForm`
  - 상세: 연결된 모든 클라이언트가 타인의 executionId를 전송하여 실행을 resume할 수 있음. WS 핸들러는 소켓의 userId를 검증하지 않음.
  - 제안: `client.userId`와 execution 소유자를 비교하는 검증 추가

- **[WARNING]** `cancelWaitingExecution` 미호출로 인한 `executionId` stop 시 상태 불일치
  - 위치: `executions.service.ts` - `stop()` / `execution-engine.service.ts`
  - 상세: `ExecutionsService.stop()`이 DB에서 상태를 `CANCELLED`로 변경하지만, `pendingContinuations`에 남아있는 Promise를 reject하지 않음. 실행 루프가 여전히 `await waitForFormSubmission()` 에서 블로킹 중이며 영원히 대기함 (메모리 릭).
  - 제안: `ExecutionsService.stop()` 내부에서 `ExecutionEngineService.cancelWaitingExecution(id)` 호출 필요. 또는 `ExecutionEngineModule`을 `ExecutionsModule`에 주입하고 서비스 레이어에서 처리.

- **[WARNING]** `forwardRef` 순환 의존성 — 양방향 모듈 결합
  - 위치: `execution-engine.module.ts` ↔ `websocket.module.ts`
  - 상세: 두 모듈이 서로를 `forwardRef`로 참조함. 기능은 동작하지만 테스트 격리, 모듈 교체, DI 순서 문제 발생 가능. `WebsocketService`는 `ExecutionEngineService`의 상세 구현을 알 필요가 없는데 `WebsocketGateway`가 `ExecutionEngineService`를 직접 사용하는 구조가 순환을 야기함.
  - 제안: `WebsocketGateway`에서 `ExecutionEngineService` 의존을 제거하고, 대신 `ExecutionsModule`에서 WebSocket 이벤트를 발행하거나 별도 이벤트 버스 패턴 도입

- **[INFO]** `waitForFormSubmission`에서 `order: { startedAt: 'DESC' }` 쿼리 옵션
  - 위치: `execution-engine.service.ts:357`
  - 상세: `findOne`에서 `order` 옵션을 사용하는데, TypeORM의 `findOne`은 `order` 옵션을 공식 지원하지 않음 (v0.3+에서 동작은 하나 타입 오류 가능). 
  - 제안: `findOne` 대신 `find({ where, order, take: 1 })` 패턴 사용

- **[INFO]** `ExecutionCancelledError`가 `finally` 블록에서 `pendingContinuations.delete`를 중복 호출
  - 위치: `execution-engine.service.ts` - `cancelWaitingExecution` + `finally`
  - 상세: `cancelWaitingExecution`에서 이미 Map에서 삭제 후 reject, catch에서 `return`하면 finally로 다시 `delete` 호출. 기능상 문제없으나 이미 삭제된 키를 다시 삭제하는 무해한 중복.
  - 제안: 문서화 주석으로 명시하거나 그대로 유지 (무해)

---

### 프론트엔드

- **[WARNING]** `DynamicFormUI` 폼 제출 후 `HistoryEntry` 컴포넌트 상태 불일치
  - 위치: `run-results-drawer.tsx` - `HistoryEntry`, `hasWaitingFormEntry` 조건
  - 상세: Form 제출 후 `resumeFromForm()`을 호출하면 `waitingNodeId`가 null이 되고 `status`가 `running`으로 전환됨. 그런데 실제 제출된 데이터는 백엔드에서 `nodeResults`에 추가되기까지 폴링 지연이 있음. 이 짧은 시간 동안 Form 항목이 UI에서 사라져 빈 화면처럼 보일 수 있음.
  - 제안: `resumeFromForm` 호출을 Form 결과가 `nodeResults`에 들어온 후로 지연하거나, 로컬에서 임시 submitted 항목 유지

- **[WARNING]** `ChartContent`와 `TemplateContent`의 `dangerouslySetInnerHTML`
  - 위치: `run-results-drawer.tsx` - `ChartContent`, `TemplateContent`
  - 상세: 백엔드가 생성한 `data.rendered` HTML을 직접 DOM에 삽입함. 백엔드의 템플릿/차트 렌더러가 사용자 데이터를 적절히 escape하지 않으면 XSS 취약점.
  - 제안: 백엔드에서 HTML sanitization 보장 또는 프론트엔드에서 `DOMPurify` 등 sanitizer 적용

- **[WARNING]** `handleWaitingForInput` — `waitingNodeType !== "form"` 인 경우 무시
  - 위치: `use-execution-events.ts` - `handleWaitingForInput`
  - 상세: 현재 스펙에서 Form만 blocking이지만, 이벤트를 무시할 경우 스토어 상태가 업데이트되지 않아 실행 루프는 server-side에서 blocking 중인데 frontend는 `running` 상태로 남음.
  - 제안: 비-form 타입에도 최소한 로그 경고 추가

- **[INFO]** `addNodeResult` 중복 방지 로직이 폴링과 WS 이벤트 간 race condition에서 올바르게 동작
  - 위치: `execution-store.ts` - `addNodeResult`
  - 상세: WS `node.completed` 이벤트와 폴링이 동시에 같은 nodeId를 처리할 경우 upsert 방식으로 처리됨. 의도된 동작이며 부작용 없음. 긍정적 평가.

- **[INFO]** `WsClient.emit`이 소켓 미연결 시 silently fail
  - 위치: `ws-client.ts` - `emit`
  - 상세: `socket?.emit(event, data)`에서 소켓이 null이면 폼 데이터가 서버에 전달되지 않고 사용자에게 피드백 없음. 백엔드 실행은 계속 blocking 상태.
  - 제안: `emit` 함수가 연결 상태를 확인하고 실패 시 에러를 던지거나 caller에게 boolean 반환

---

## 요약

전반적으로 Form 노드 blocking 기능 구현 자체는 설계가 명확하고 양방향 순환 참조(`forwardRef`)도 의도적으로 처리됨. 그러나 **핵심 보안 부작용**이 존재한다: REST `POST /executions/:id/continue`와 WebSocket `execution.submit_form` 핸들러 모두 인증/인가 검증 없이 임의 실행을 resume할 수 있어 타 사용자 실행 탈취가 가능하다. 기능적으로는 `stop()` 호출 시 `cancelWaitingExecution`이 연동되지 않아 실행 루프가 영원히 blocking되는 메모리 릭 버그가 존재하며, `dangerouslySetInnerHTML` 사용으로 인한 XSS 리스크도 있다.

## 위험도

**HIGH**