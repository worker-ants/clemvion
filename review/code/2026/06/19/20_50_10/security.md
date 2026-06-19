# 보안(Security) 리뷰 결과

리뷰 대상: C-1 후속 ④ — EngineDriver ISP 분할 + engine→Retry 순환 DI 제거 (파일 17개 + 리뷰 문서 7개)

---

## 발견사항

### [INFO] 특이사항 없음 — 하드코딩된 시크릿
- 위치: 전체 변경 파일
- 상세: API 키, 비밀번호, 토큰, 인증서 등의 시크릿이 코드에 직접 포함된 케이스 없음. 테스트 픽스처에 사용된 `'wf-orch'`, `'exec-orch'`, `'exec-1'`, `'ne-1'` 등은 단순 식별 ID로 민감 정보가 아님.
- 제안: 해당 없음.

### [INFO] forwardRef 순환 참조 구조 — DI 계층 보안 관찰
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`, `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
- 상세: `WebsocketGateway`가 `forwardRef(() => RetryTurnService)`로 `RetryTurnService`를 주입받고, `ExecutionEventEmitter`가 `forwardRef(() => WebsocketService)`를 사용해 순환 DI를 처리함. NestJS의 `forwardRef`는 런타임에 프록시 객체를 통해 해소되는 메커니즘으로, 동작 자체는 안전하나 순환 참조가 남아 있으면 의존성 트리가 복잡해져 미래의 인가(authorization) 로직 삽입 시 적용 누락 위험이 있음. 현재 변경은 순환을 오히려 줄이는 방향(engine→Retry 역방향 제거)이므로 보안적으로는 개선.
- 제안: 현재 방향 유지. 향후 `WebsocketGateway` 진입점에 인가 검증 추가 시 `handleRetryLastTurn` 핸들러에도 동일하게 적용되는지 확인 필요.

### [INFO] payload 필드의 unknown 타입 캐스팅 — 입력 검증 관찰
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` (switch 분기 내 payload 캐스팅)
- 상세: BullMQ 큐 job의 `payload` 필드를 `(payload as { buttonId?: string } | undefined)?.buttonId`, `(payload as { message?: string } | undefined)?.message`, `(payload as { spawnedNodeExecutionId?: string } | undefined)?.spawnedNodeExecutionId` 패턴으로 캐스팅하여 접근함. 타입 캐스팅은 컴파일 타임 안전 장치일 뿐 런타임에 실제 shape 검증이 없음. 그러나 이 패턴은 이번 변경에서 신규 도입된 것이 아니며, BullMQ 큐 데이터는 내부 서비스가 publish하므로 외부 사용자 입력이 직접 도달하지 않음. 내부 처리 경로이므로 실질 위험도 낮음.
- 제안: 중기적으로 `ContinuationJob` 타입에서 `payload` 필드를 discriminated union으로 구체화하여 런타임 캐스팅 없이 안전하게 접근하는 것을 고려. 현 변경 범위에서는 수정 불필요.

### [INFO] 에러 메시지에서 민감 정보 노출 검토
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` `onFailed` 메서드
- 상세: `err?.message ?? err`를 로그에 직접 기록함. 에러 객체의 `message`에 내부 상태가 포함될 수 있으나, 이는 서버사이드 로그(NestJS Logger)이며 클라이언트 응답에 포함되지 않음. `job.data?.executionId`도 로그에 포함되나 이는 내부 추적 ID로 민감 개인정보가 아님. 이번 변경(diff)에서 신규 도입된 위험 없음.
- 제안: 해당 없음.

### [INFO] WebSocket 이벤트 핸들러 인가 경계 확인
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `handleRetryLastTurn` 핸들러
- 상세: 이번 변경에서 `this.executionEngineService.retryLastTurn(...)` 호출을 `this.retryTurnService.retryLastTurn(...)`으로 교체. `retryLastTurn`은 executionId + nodeExecutionId로 ownership 검증을 수행하는 서비스 레이어 메서드임. 호출 대상 서비스가 바뀌었을 뿐 검증 로직 자체가 변경되지 않았으므로 인가 우회 위험 없음. 검증 단계(validate + atomic consume + spawn)는 `RetryTurnService.retryLastTurn` 내부에 그대로 보존됨.
- 제안: 해당 없음.

---

## 요약

이번 변경은 `EngineDriver` 단일 인터페이스를 소비자별 ISP 부분 인터페이스(`CoreEngineDriver`, `InteractionEngineDriver`, `ReentryStateDriver`, `AiTurnEngineDriver`, `RetryEngineDriver`)로 분해하고, engine→RetryTurnService 역방향 DI 순환을 제거하는 순수 아키텍처 리팩토링이다. 보안 관점에서 신규 취약점은 도입되지 않았다. 하드코딩된 시크릿, 인젝션 취약점, 인증/인가 우회, 암호화 알고리즘 변경, 외부 입력 검증 누락 등 OWASP Top 10 관련 이슈는 발견되지 않았다. `forwardRef` 순환 DI 처리 및 BullMQ payload 타입 캐스팅은 관찰 가능한 패턴이나 이번 변경 이전부터 존재하던 구조이며, 실질적인 공격 벡터가 되기 어려운 내부 서비스 경로이다. 전반적으로 보안 위험 없는 안전한 리팩토링 변경이다.

---

## 위험도

NONE
