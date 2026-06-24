# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `cancelWaitingExecution` 시그니처 변경 — `void` → `Promise<ContinuationPublishResult>`
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (~L3835)
- 상세: 공개 메서드의 반환 타입이 `void` 에서 `Promise<ContinuationPublishResult>` 로 변경됐다. 이 변경은 의도된 C-1 리팩터이며, 알려진 호출부(executions.service.ts, websocket.gateway.spec.ts, execution-engine.service.spec.ts)는 모두 이번 커밋에서 함께 수정됐다. 그러나 `websocket.gateway.spec.ts`(테스트 파일)만 diff 에 포함되어 있고 실제 구현 파일 `websocket.gateway.ts` 의 호출 변경 여부가 diff 에 보이지 않는다. 게이트웨이 구현에서 `cancelWaitingExecution` 을 호출하고 있다면 `await` 없이 fire-and-forget 상태가 유지될 수 있고, `queued:false` 503 표면이 WS 경로에서 동작하지 않게 된다.
- 제안: `websocket.gateway.ts` 에서 `cancelWaitingExecution` 호출 여부를 확인하고, 존재한다면 `await` + `queued:false` 결과 처리가 추가됐는지 검증한다.

### [INFO] `nextSeq` INCR 실패 로그 레벨 변경 — `warn` → `error`
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` `nextSeq` 메서드
- 상세: 기존에는 INCR 실패 시 `try/catch` 의 `catch` 블록에서 `this.logger.warn` 을 호출했다. M-7 리팩터 후 INCR 예외는 catch 없이 `publish` 의 outer `catch` 까지 전파되며, 해당 catch 는 `this.logger.error` 를 호출한다. 결과적으로 INCR 실패가 `warn` 에서 `error` 레벨로 상향된다. 이는 의도된 엄격화이나, 운영 알람/로그 필터가 `warn` 레벨 기준으로 설정되어 있다면 이전에는 조용히 넘어가던 Redis INCR 실패가 이제 `error` 알람을 발생시킨다.
- 제안: 운영 알람 임계값을 점검하거나, PR 설명에 로그 레벨 상향이 의도된 변경임을 명시한다.

### [INFO] `ServiceUnavailableException` 신규 throw — 내부 호출 경로 영향 가능성
- 위치: `codebase/backend/src/modules/executions/executions.service.ts` `stop()` WAITING 분기
- 상세: WAITING 분기에서 `queued:false` 시 `ServiceUnavailableException` 을 throw 한다. NestJS 전역 필터가 이를 503 으로 직렬화하므로 REST 경로에서는 의도대로 동작한다. 단, `ExecutionsService.stop()` 이 REST 컨트롤러 외에 내부 서비스나 배치 처리에서도 호출된다면 예상치 못한 503 예외가 상위 호출 스택으로 전파된다. diff 에서 파악 가능한 호출부는 REST 컨트롤러 단뿐이므로 현재로서는 문제없으나 확인 권장.
- 제안: `ExecutionsService.stop()` 의 내부 호출 경로가 없음을 확인한다.

### [INFO] `ErrorCode` enum 확장 — additive 변경, 공유 패키지 재빌드 필요 가능성
- 위치: `codebase/backend/src/nodes/core/error-codes.ts`
- 상세: `EXECUTION_ENQUEUE_FAILED` 키가 `ErrorCode` `as const` 객체에 추가됐다. additive 변경이므로 기존 exhaustive narrowing 코드를 파괴하지 않는다. 단, 프론트엔드나 `packages/sdk` 등 공유 패키지가 이 파일을 re-export 한다면 타입 변경으로 인한 재빌드가 필요하다.
- 제안: 공유 패키지에서 `ErrorCode` 를 re-export 하는 경우 패키지 버전 관리 정책을 확인한다.

### [INFO] `fakeRedisInstances` 모듈 스코프 배열 — 의도된 공유 상태, 격리 확인됨
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.spec.ts` L116
- 상세: `fakeRedisInstances` 는 모듈 스코프 배열이나, `beforeEach` 에서 `fakeRedisInstances.length = 0` 으로 매번 초기화하므로 테스트 간 상태 누수 없음. 의도된 패턴이며 추가 위험 없음.

## 요약

이번 C-1 + M-7 변경은 `cancelWaitingExecution` 반환 타입 변경(void→Promise)과 `nextSeq` random fallback 제거라는 두 가지 의도된 리팩터로 구성된다. 알려진 모든 호출부는 동일 커밋에서 함께 수정됐으며, `ErrorCode` enum 확장은 additive 변경이다. 의도치 않은 전역 상태 변경, 파일시스템 부작용, 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다. 가장 중요한 검증 사항은 `websocket.gateway.ts` 실제 구현 파일에서 `cancelWaitingExecution` 호출에 `await` 및 `queued:false` 처리가 누락되지 않았는지이며, 이것이 빠졌다면 WS 경로에서 에러 표면이 무력화된다. INCR 실패의 로그 레벨이 `warn` → `error` 로 상향되는 부작용도 운영 관점에서 인지가 필요하다.

## 위험도

LOW
