# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `EngineDriver` 단일 인터페이스 → 4개 부분 인터페이스 분해 (공개 API 변경)
- 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- 상세: `EngineDriver` 인터페이스가 `CoreEngineDriver`, `InteractionEngineDriver`, `ReentryStateDriver`, `AiTurnEngineDriver`, `RetryEngineDriver` 로 분해됐다. 최종 `EngineDriver extends AiTurnEngineDriver, RetryEngineDriver` 유니온이 보존돼, `implements EngineDriver` 를 선언한 `ExecutionEngineService` 는 전체 12 멤버를 그대로 구현한다. 런타임 DI 바인딩(`provide: ENGINE_DRIVER, useExisting: ExecutionEngineService`)과 실제 메서드 시그니처는 변경 없음 — 컴파일 타임 가시성만 좁힌 ISP 리팩터링이다. `EngineDriver` 를 직접 `import type` 하던 소비자 4개(AiTurnOrchestrator, ButtonInteractionService, FormInteractionService, RetryTurnService)가 동일 PR 내에서 각자의 부분 인터페이스로 교체됐으므로 현재 범위에서는 문제 없음.
- 제안: PR 범위 외부에 `EngineDriver` 타입을 직접 참조하는 코드가 있는지 ripgrep으로 확인하면 충분.

### [INFO] `ExecutionEngineService.retryLastTurn` / `applyRetryLastTurn` thin delegator 삭제 (public 메서드 제거)
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 상세: 두 public 메서드가 완전히 삭제됐다. 기존 호출자인 `WebsocketGateway`(retryLastTurn)와 `ContinuationExecutionProcessor`(applyRetryLastTurn) 모두 동일 PR 내에서 `RetryTurnService`를 직접 호출하도록 재배선됐고, `ExecutionEngineModule.exports`에 `RetryTurnService`가 추가돼 DI 가용성이 확보됐다. 변경 범위 내 참조는 모두 교체됐으나, 범위 외 호출자가 있다면 컴파일 오류가 발생한다.
- 제안: 병합 전 `retryLastTurn\|applyRetryLastTurn` 참조 잔류 여부를 전체 codebase grep으로 확인할 것.

### [INFO] `forwardRef(() => RetryTurnService)` — `WebsocketGateway` 생성자 신규 주입 (DI 순서 변경)
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
- 상세: `WebsocketGateway` 에 `RetryTurnService` DI 주입이 추가됐다. `WebsocketModule`이 `ExecutionEngineModule`를 `forwardRef`로 import하고, `ExecutionEngineModule.exports`에 `RetryTurnService`가 추가됐으므로 DI 해석에 문제가 없다. 동작 불변.
- 제안: 문제 없음.

### [INFO] `ExecutionEventEmitter` — `forwardRef(() => WebsocketService)` 신규 도입 (DI 초기화 순서 방어)
- 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
- 상세: 기존 단순 생성자 주입이 `@Inject(forwardRef(() => WebsocketService))` 형태로 변경됐다. 주석대로 `retry-turn.service`의 import 위치 이동으로 ES-module 순환이 더 짧은 경로로 노출돼 NestJS 데코레이터 메타데이터 eval 순서가 불안정해질 수 있는 것을 방어한다. 동작 불변.
- 제안: 문제 없음.

### [INFO] `node_modules` 심볼릭 링크 diff 포함
- 위치: diff 파일 14 (`node_modules -> /Volumes/project/private/clemvion/node_modules`)
- 상세: worktree 루트에 `node_modules` 심볼릭 링크가 새로 생성돼 git diff에 포함됐다. 런타임 동작 변경이 아닌 빌드 환경 아티팩트이나, `.gitignore` 미포함 시 커밋에 들어갈 수 있다.
- 제안: 커밋 전 `.gitignore`에 `node_modules` 심링크가 포함돼 있는지 확인 후 커밋 대상에서 제외할 것.

## 요약

이번 변경은 `EngineDriver` 단일 인터페이스를 ISP에 따라 소비자별 부분 인터페이스로 분해하고, `engine→Retry` 역방향 DI 순환을 제거해 `RetryTurnService` 를 외부 진입점에서 직접 호출하도록 재배선한 구조 리팩터링이다. 전역 변수 수정, 파일시스템 부작용, 환경 변수 변경, 네트워크 호출, 이벤트 발행 방식의 의도치 않은 변경은 없다. 모든 변경은 런타임 동작을 그대로 보존하면서 컴파일 타임 가시성과 DI 그래프 단방향성을 개선한다. 주목할 부작용은 `ExecutionEngineService.retryLastTurn` / `applyRetryLastTurn` 두 public 메서드 삭제이며, 변경 범위 내 호출자는 모두 교체됐으나 범위 외 잠재적 참조자 여부를 병합 전 grep으로 확인하는 것이 권장된다. `forwardRef` 도입 2건(WebsocketGateway, ExecutionEventEmitter)은 모두 DI 순환 방어 목적의 의도적 추가이며 동작 불변이다.

## 위험도

LOW
