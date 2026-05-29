# Side Effect Review

## 발견사항

### [WARNING] `resolveWaitingNodeExecutionId` — 시그니처/동작 변경이 호출자 전파 영향을 가짐
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `resolveWaitingNodeExecutionId` private 메서드
- 상세: 이전에는 0건/다중 row/infra 에러 모두 `__no_node_exec__` sentinel 문자열을 반환(절대 throw 없음). 변경 후에는 0건·다중 row 시 `InvalidExecutionStateError` throw, DB infra 실패 시 원본 에러 re-throw. 호출 체인(`continueExecution`, `continueButtonClick`, `continueAiConversation`, `endAiConversation`)은 이제 예외를 전파하므로, 체인 위의 모든 진입점(WS gateway, REST controller, EIA interaction.service)이 이 예외를 catch 하지 않으면 처리되지 않은 예외로 전파된다. 변경 범위에서 WS gateway 4개 handler, REST controller, interaction.service 는 모두 catch 를 추가했으므로 의도된 부작용이지만, 해당 메서드를 호출하는 기타 경로가 있는지 주의가 필요하다.
- 제안: `resolveWaitingNodeExecutionId` 의 호출 지점을 전수 확인해 catch 누락 경로가 없는지 검증할 것. private 메서드이므로 현재 파일 내부로 제한되나, 이후 public 으로 승격될 경우 동일 주의 필요.

### [WARNING] `InvalidExecutionStateError` — 새 `export` 클래스 도입으로 공개 API 확장
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `export class InvalidExecutionStateError`
- 상세: `execution-engine.service.ts` 에서 `InvalidExecutionStateError` 를 `export` 로 선언해 모듈 공개 API 에 추가했다. 이 에러 클래스를 이미 세 파일(`executions.controller.ts`, `interaction.service.ts`, `websocket.gateway.ts`)이 import 해 사용하고 있으므로 즉각적인 문제는 없다. 그러나 이 클래스가 service 구현 파일에 직접 선언·export 되어 있어, 향후 서비스 리팩터링 시 이 타입을 참조하는 모든 파일에 연쇄 영향이 생긴다. 별도 errors 파일 분리 없이 service 파일에 묶인 것이 장기적으로 결합도를 높인다.
- 제안: 공개 에러 타입은 별도 `errors.ts` 또는 `types.ts` 파일로 분리하는 것을 고려. 현재 기능 동작에 문제는 없으나 결합도 측면의 WARNING.

### [WARNING] `ContinuationDlqMonitorService` — 생성자에서 `process.env` 직접 읽기 (환경 변수 부작용)
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` — constructor 내 `process.env.*` 4개 읽기
- 상세: 생성자에서 `CONTINUATION_DLQ_ALARM_THRESHOLD`, `CONTINUATION_DLQ_MONITOR_INTERVAL_MS`, `CONTINUATION_DLQ_ALARM_COOLDOWN_MS`, `CONTINUATION_DLQ_MONITOR_ENABLED` 를 `process.env` 에서 직접 읽어 `readonly` 필드에 할당한다. NestJS 의 `ConfigService` 를 거치지 않고 `process.env` 를 직접 읽는 패턴은 동 프로젝트의 `SHUTDOWN_GRACE_MS` 처리 방식과 일치하므로 프로젝트 내 일관성은 있다. 단, 모듈 초기화 순서에 의해 환경변수가 아직 주입되지 않은 시점에 생성자가 호출되면 기본값으로 fallback 된다. 테스트 파일의 `makeService` 함수가 생성자 호출 전·후로 `process.env` 를 직접 설정·복원하는 방식이 이 위험을 인지하고 있음을 보여준다.
- 제안: 동작에 문제는 없으나, 배포 환경에서 `.env` 로딩이 생성자보다 늦게 일어날 수 있는 경우를 검토할 것.

### [INFO] `ContinuationDlqMonitorService.onModuleInit` — `setInterval` 타이머 등록 (전역 부작용)
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` — `onModuleInit` 메서드
- 상세: `setInterval` 로 전역 타이머를 등록한다. `onModuleDestroy` 에서 `clearInterval` 로 해제하고 `.unref()` 를 호출해 graceful shutdown 을 방해하지 않도록 처리했다. 의도된 동작이며 lifecycle hook 쌍이 올바르게 구현돼 있다.
- 제안: 없음. 적절히 처리됨.

### [INFO] `ContinuationDlqMonitorService` — `execution-engine.module.ts` providers 배열에 추가 (모듈 상태 변경)
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts`
- 상세: `ContinuationDlqMonitorService` 가 `providers` 배열에만 추가되고 `exports` 에는 포함되지 않는다. 이는 모듈 내부 서비스로 의도된 것이며, 외부 모듈에 대한 공개 API 변경이 없다. 또한 `BullModule.registerQueue({ name: CONTINUATION_EXECUTION_QUEUE })` 가 이미 imports 에 존재하므로 `@InjectQueue` 가 정상 동작한다.
- 제안: 없음.

### [INFO] `ContinuationExecutionProcessor` — `@OnWorkerEvent('failed')` 이벤트 핸들러 추가
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` — `onFailed` 메서드
- 상세: `@OnWorkerEvent('failed')` 데코레이터로 BullMQ worker 의 `failed` 이벤트에 새 핸들러를 등록한다. 이 핸들러는 `logger.warn` 만 호출하고 추가 상태 변경 없이 반환하므로 부작용이 없다. `job` 인자가 `undefined` 인 경우를 안전하게 처리한다.
- 제안: 없음.

### [INFO] `WebsocketGateway` — ack 응답 타입에 `errorCode?: string` 필드 추가 (인터페이스 변경)
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `handleSubmitForm`, `handleButtonClick`, `handleSubmitMessage`, `handleEndConversation` 의 반환 타입
- 상세: `data` 객체에 `errorCode?: string` 필드가 추가됐다. 선택(optional) 필드이므로 기존 클라이언트가 이 필드를 무시해도 동작에 문제없다(하위 호환). 에러가 없는 성공 경로에서는 `errorCode` 가 포함되지 않는다.
- 제안: 없음. 하위 호환 변경이다.

### [INFO] `ExecutionsController.continueExecution` — 기존 fire-and-forget 에서 `await` 로 변경
- 위치: `codebase/backend/src/modules/executions/executions.controller.ts` — `continueExecution` 핸들러
- 상세: 이전 코드는 `this.executionEngineService.continueExecution(...)` 를 `await` 없이 호출(fire-and-forget)해 응답을 즉시 반환했다. 변경 후 `await` 로 호출하여 engine 처리가 완료될 때까지 응답을 기다린다. 이는 동작 변경이지만 spec §7.5.1 에 명시된 의도(`INVALID_EXECUTION_STATE` 동기 surface)와 일치한다. 다만, engine 처리 시간이 응답 지연에 직접 반영되므로 성능 특성이 달라진다.
- 제안: 기존 fire-and-forget 에서 await 로의 전환이 의도된 것임을 확인. 성능 측면에서 latency 영향을 모니터링할 것.

### [INFO] `interaction.service.ts` — fire-and-forget 에서 `dispatchContinuation` await 로 변경
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `interact` 메서드 내 4개 dispatch
- 상세: 이전에는 `this.executionEngineService.continueExecution(...)` 등을 `await` 없이 호출했다. 변경 후 `await this.dispatchContinuation(...)` 로 비동기를 완전히 기다린다. 이 변경으로 인해 `interact` 호출자는 engine 처리 완료 후 응답을 받게 되고, `InvalidExecutionStateError` 를 409 로 변환하는 경로가 추가된다. REST/EIA 진입점의 응답 지연이 다소 증가할 수 있다.
- 제안: 없음. 의도된 변경.

### [INFO] 테스트 파일의 `process.env` 직접 변경 — 예외 발생 시 환경 오염 위험
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.spec.ts` — `makeService` 함수
- 상세: `makeService` 함수가 `process.env` 를 직접 수정하고 생성자 호출 후 즉시 복원한다. 복원 로직이 `try/finally` 없이 인라인으로 작성돼 있어, 생성자가 예외를 던지면 복원이 이루어지지 않아 이후 테스트에 환경변수가 오염될 수 있다. 현재 `ContinuationDlqMonitorService` 생성자는 예외를 던지지 않으므로 실용적인 위험은 낮지만, 취약한 패턴이다.
- 제안: `makeService` 내 `process.env` 복원 블록을 `try/finally` 로 감쌀 것. 또는 Jest 의 `jest.replaceProperty` 나 별도 환경 격리 패턴 사용을 고려.

## 요약

이번 변경의 핵심 부작용은 `resolveWaitingNodeExecutionId` 의 동작이 "절대 throw 하지 않는 sentinel 반환"에서 "조건에 따라 throw"로 전환된 것이다. 이 변경은 spec §7.5.1 에 의해 의도된 것이며, 호출 체인 위의 모든 진입점(WS gateway, REST controller, EIA interaction.service)이 catch 를 추가해 적절히 처리하고 있다. `ContinuationDlqMonitorService` 신규 도입은 `setInterval` 타이머를 전역에 등록하지만 lifecycle hook 으로 올바르게 해제하며, `process.env` 직접 읽기는 프로젝트 기존 패턴과 일치한다. `continueExecution` 류 메서드가 fire-and-forget 에서 await 로 전환되어 REST/EIA 진입점의 응답 지연이 다소 증가할 수 있으나 spec 규범에 맞는 변경이다. 전반적으로 의도치 않은 부작용은 발견되지 않았으며, 테스트의 `process.env` 복원 패턴만 취약점으로 주의가 필요하다.

## 위험도

LOW
