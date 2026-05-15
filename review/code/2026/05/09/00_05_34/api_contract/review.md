### 발견사항

- **[WARNING]** `executionPath` 목록 조회 응답 항상 빈 배열로 변경
  - 위치: `executions.service.ts` — `toExecutionDto()`, line `executionPath: []`
  - 상세: 이전 구현에서 `findByWorkflow` 목록 응답의 `executionPath` 필드는 `execution.executionPath ?? []`로 실제 데이터를 반환했다. 변경 후 N+1 방지를 이유로 항상 `[]`를 반환한다. 명시적 N+1 방지 정책이지만, 기존 클라이언트가 목록 응답에서 `executionPath`를 읽고 있다면 조용한 기능 회귀(silent regression)가 된다. 코드 주석으로만 이 결정이 기록돼 있고, 별도 API 버전 변경이나 changelog 없이 동일 엔드포인트에서 동작이 바뀐다.
  - 제안: `ExecutionDto` 스펙 또는 OpenAPI 스키마에 "목록 응답에서 `executionPath`는 항상 빈 배열이며 단건 조회 `GET /executions/:id`를 사용해야 한다"고 명시하거나, 목록 DTO에서 `executionPath` 필드 자체를 제거해 잘못된 사용을 컴파일 타임에 차단하는 것이 안전하다.

- **[WARNING]** `continueExecution` 등 continuation 메서드의 에러 계약 제거
  - 위치: `execution-engine.service.ts` — `continueExecution`, `cancelWaitingExecution`, `continueButtonClick`, `endAiConversation`
  - 상세: 이전 계약은 pending continuation이 없으면 `Error('No pending continuation for execution: ...')` throw였다. 변경 후 항상 `bus.publish()` 후 반환 — 예외 없음. 이 메서드를 호출하는 WS gateway/controller가 예외 catch 블록으로 클라이언트에 에러 응답을 보내던 경우, 이제 해당 경로가 발동하지 않는다. 분산 환경에서는 올바른 설계이지만, **publisher 측(controller/WS gateway)이 WAITING_FOR_INPUT 상태 사전 검증을 수행한다는 계약**이 실제로 구현되어 있는지 이번 변경사항에서 확인되지 않는다.
  - 제안: WS gateway 또는 continuation endpoint에서 `execution.status === WAITING_FOR_INPUT` 검증 로직이 존재하는지 확인하고, 없다면 추가해야 한다. 누락 시 클라이언트는 이미 완료된 실행에 continuation 요청을 보내도 무응답(Redis publish만 되고 아무것도 발생하지 않음)을 받게 된다.

- **[INFO]** `findById` 응답의 `executionPath` — 하위 호환성 유지됨
  - 위치: `executions.service.ts` — `findById()`, `ExecutionDetailWithTrigger` 타입
  - 상세: `Execution` 엔티티에서 `executionPath` 컬럼이 제거됐지만, `ExecutionDetailWithTrigger`에 `executionPath: string[]`를 별도 필드로 추가하고 `execution_node_log` 조회로 채운다. 단건 조회의 외부 응답 시그니처는 동일하게 유지되며, 데이터 순서도 BIGSERIAL 기준 결정론적이다. 하위 호환성 관점에서 적절한 처리다.

- **[INFO]** `FakeExec` 테스트 픽스처에 삭제된 `executionPath` 필드 잔존
  - 위치: `executions.service.spec.ts` — `FakeExec` 타입, `baseFake()` 기본값
  - 상세: `FakeExec.executionPath: string[]` 및 `baseFake`의 `executionPath: []` 기본값이 그대로 남아 있다. 런타임에 영향은 없지만, 엔티티에 존재하지 않는 필드를 픽스처가 계속 정의해 테스트 코드와 실제 모델 간 불일치가 생긴다.
  - 제안: `FakeExec`에서 `executionPath` 필드 제거.

- **[INFO]** `ContinuationBusService` — `acquireLock`이 public 메서드로 노출
  - 위치: `continuation-bus.service.ts` — `acquireLock(key, ttlSeconds)`
  - 상세: Redis SET NX 분산 락이 범용 public API로 노출된다. 현재는 `recoverStuckExecutions` 한 곳에서만 호출되지만, 서비스 간 의존성이 생기면 락 키 네이밍 충돌이나 TTL 오용 위험이 있다. 내부 인프라 오퍼레이션을 public으로 두는 것은 서비스 API 경계 관점에서 불명확하다.
  - 제안: 강제 사항은 아니나, `recoverStuckExecutions` 전용 시맨틱이라면 `ExecutionEngineService` 내부로 이동하거나, 용도를 제한하는 주석을 추가하는 것이 적절하다.

---

### 요약

이번 변경의 핵심 API 계약 위험은 두 가지다. 첫째, `findByWorkflow` 목록 응답에서 `executionPath`가 항상 빈 배열로 반환되는 묵시적 계약 변경 — 단건 조회로 유도하는 정책 전환이지만 기존 클라이언트 코드에 조용히 데이터 손실처럼 보일 수 있다. 둘째, continuation 메서드들이 더 이상 예외를 throw하지 않으므로, WS gateway/controller 단에서 WAITING_FOR_INPUT 상태 사전 검증이 반드시 보완되어야 한다. `findById`의 외부 응답 시그니처는 새 소스(execution_node_log)에서 동일하게 채워져 하위 호환성이 유지된다.

### 위험도
**MEDIUM**