### 발견사항

- **[WARNING]** `POST /executions/:id/continue` 엔드포인트에 인증/인가 검증 부재
  - 위치: `executions.controller.ts` - `continueExecution()` 메서드
  - 상세: 다른 엔드포인트들은 글로벌 JwtAuthGuard가 적용되어 있으나, 해당 엔드포인트에서 특정 executionId를 소유한 사용자인지 확인하는 인가 로직이 없음. 임의의 인증된 사용자가 타인의 실행을 재개할 수 있는 IDOR(Insecure Direct Object Reference) 위험 존재
  - 제안: ExecutionsService에서 실행 소유자 확인 로직 추가 또는 `continueExecution` 내에서 실행 소유권 검증

- **[WARNING]** `POST /executions/:id/continue` 응답이 에러 케이스를 적절히 처리하지 않음
  - 위치: `executions.controller.ts:45-52`
  - 상세: `executionEngineService.continueExecution()`이 "No pending continuation" 에러를 throw할 때 NestJS가 500 Internal Server Error로 처리함. 이는 클라이언트 오류(대기 중인 실행 없음)이므로 404 또는 409가 적절
  - 제안: `try/catch`로 감싸거나, `ExecutionEngineService`에서 `NotFoundException`/`ConflictException`을 throw하도록 변경

```typescript
// 개선 예시
@Post(':id/continue')
@HttpCode(HttpStatus.OK)
continueExecution(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() body?: { formData?: unknown },
) {
  try {
    this.executionEngineService.continueExecution(id, body?.formData);
    return { success: true };
  } catch (e) {
    throw new NotFoundException({ code: 'NO_PENDING_CONTINUATION', message: e.message });
  }
}
```

- **[WARNING]** WebSocket `execution.submit_form` 이벤트와 REST `POST /executions/:id/continue` 간 이중 채널로 인한 계약 불일치
  - 위치: `websocket.gateway.ts:156-182`, `executions.controller.ts:40-52`
  - 상세: Form 제출을 위한 채널이 두 개(WebSocket 이벤트, REST API) 존재함. WebSocket 이벤트는 `{ executionId, formData }` 구조를, REST는 URL 파라미터 + `{ formData }` 바디를 사용. 클라이언트(프론트엔드)는 현재 WebSocket만 사용하지만(`run-results-drawer.tsx`), REST 엔드포인트가 문서화 없이 존재하여 API 계약 혼란 야기
  - 제안: 두 채널의 사용 목적을 명확히 문서화하거나, 하나의 채널로 통일

- **[INFO]** `POST /executions/:id/continue` 요청 바디에 대한 DTO 및 유효성 검증 부재
  - 위치: `executions.controller.ts:48`
  - 상세: `body?: { formData?: unknown }` 타입이 any에 가까우며, `ValidationPipe`와 연동되는 DTO 클래스가 없음. `formData`의 구조 검증이 전혀 이루어지지 않음
  - 제안: `ContinueExecutionDto` 클래스 생성 및 `class-validator` 적용

- **[INFO]** `ExecutionData.status`에 `waiting_for_input` 추가가 하위 호환성에 영향
  - 위치: `frontend/src/lib/api/executions.ts:20`
  - 상세: 프론트엔드 타입 정의에 새 status 값이 추가됨. 이는 additive change이므로 breaking change는 아니나, 이 값을 처리하지 않는 기존 클라이언트 코드(switch/exhaustive checks)가 있다면 런타임 오류 가능
  - 제안: 현재 코드는 `use-execution-events.ts`에서 `waiting_for_input`을 적절히 처리하고 있어 문제없음. 단, 향후 status 추가 시에도 동일하게 처리할 것

- **[INFO]** `cancelWaitingExecution`에 대한 REST 엔드포인트 미제공
  - 위치: `execution-engine.service.ts:407-413`
  - 상세: `cancelWaitingExecution` 메서드가 구현되어 있으나 REST나 WebSocket으로 외부에 노출되지 않음. 기존 `POST /executions/:id/stop`이 `WAITING_FOR_INPUT` 상태를 처리하도록 `executions.service.ts`에서 수정되어 있으나, 실제 `pendingContinuations` Promise를 reject하지 않아 메모리 누수 및 실행이 영구 hang될 가능성 존재
  - 제안: `ExecutionsService.stop()`에서 `WAITING_FOR_INPUT` 상태일 때 `executionEngineService.cancelWaitingExecution(id)`도 함께 호출하도록 연동

### 요약

이번 변경은 Form 노드의 blocking 실행을 위한 새로운 API 계약(`POST /executions/:id/continue`, WebSocket `execution.submit_form`)과 `waiting_for_input` 상태를 전반적으로 추가한 것으로, 전체적인 설계 방향은 스펙과 일치하고 하위 호환성을 유지하고 있다. 그러나 `continueExecution` REST 엔드포인트에서 발생하는 비즈니스 예외가 500으로 노출되는 문제, IDOR 위험을 야기하는 인가 부재, 요청 바디 유효성 검증 미흡이 핵심 이슈다. 또한 `stop` API가 `WAITING_FOR_INPUT` 상태를 허용하도록 수정되었으나 실제 pending Promise를 정리하는 경로가 연결되어 있지 않아 실행이 영구적으로 hung 상태에 빠질 수 있는 잠재적 위험이 존재한다.

### 위험도
**MEDIUM**