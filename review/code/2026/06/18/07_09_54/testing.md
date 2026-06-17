# Testing Review — RetryTurnService 추출 (C-1 step4, FINAL)

## 발견사항

### [WARNING] `applyRetryLastTurn` 단위 테스트 부재 — RetryTurnService 레벨에서
- 위치: `/codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`
- 상세: `retry-turn.service.spec.ts` 는 `retryLastTurn` 8개 케이스만 직접 검증한다. `applyRetryLastTurn` 의 경비 코드(spawnedRow not found → ack-and-discard, status not RUNNING → discard, `_retryState` missing → zombie FAILED, execution not found → zombie FAILED, node not found → zombie FAILED) 는 모두 `RetryTurnService` 안에 있으나, spec 파일에는 하나도 없다. 커밋 메시지에 "applyRetryLastTurn 통합 테스트는 위임 경유로 엔진 spec 잔류"라고 적혀 있으나, 엔진 spec 의 `applyRetryLastTurn` describe 는 성공 경로·loop-parked 경로를 검증하는 통합 수준이다. 새 서비스로 이관된 경비 조기 반환 브랜치 5개는 어느 쪽에서도 직접 단위 검증되지 않는다.
- 제안: `retry-turn.service.spec.ts` 에 `applyRetryLastTurn (early-exit guards)` describe 를 추가해 spawnedRow not found, status not RUNNING, `_retryState` missing, execution not found, node not found 케이스를 직접 RetryTurnService mock 으로 단위 검증한다. `driver.*` / `aiTurnOrchestrator.*` / `eventEmitter.*` 는 이미 beforeEach 에 mock 이 구성돼 있어 추가 하니스 비용이 낮다.

### [WARNING] `failRetryExecution` — `ExecutionCancelledError` 분기 테스트 없음
- 위치: `/codebase/backend/src/modules/execution-engine/retry-turn.service.ts` L627–653
- 상세: `failRetryExecution` 은 `error instanceof ExecutionCancelledError` 여부로 CANCELLED / FAILED 를 분기한다. 이 메서드는 `private` 이므로 `applyRetryLastTurn` catch 경로를 통해서만 도달 가능한데, 양쪽 스펙 파일 모두 ExecutionCancelledError throw 케이스를 커버하지 않는다. 취소 경로는 `EXECUTION_CANCELLED` emit 을 생성하며, 이것이 엔진 이관 후에도 올바른지 직접 확인되지 않는다.
- 제안: `applyRetryLastTurn` 통합 테스트(엔진 spec 잔류 describe) 또는 RetryTurnService spec 에 `aiTurnOrchestrator.processAiResumeTurn` 이 `ExecutionCancelledError` throw 시 `EXECUTION_CANCELLED` 이벤트가 emit 되는 케이스를 추가한다.

### [WARNING] `resumeGraphAfterRetry` defensive fallback — 테스트 없음
- 위치: `/codebase/backend/src/modules/execution-engine/retry-turn.service.ts` L505–521
- 상세: `nodes.length === 0` 및 `sortedIndexMap.get(completedNode.id) === undefined` 두 fallback 분기는 `completeRetryExecution` 을 직접 호출한다. 이 경로는 RetryTurnService 로 이관 후 어느 spec 에서도 검증되지 않는다. 엔진 spec 의 `resumeGraphAfterRetry` describe 는 엔진 위임 경유이므로 `driver.loadAndBuildGraph` 가 mock 되지 않고 실제 DB 경로를 탄다 — 이 fallback 에 도달시키려면 빈 노드 목록을 반환해야 하며, 통합 테스트 맥락에서 이를 세팅하기 어렵다.
- 제안: RetryTurnService spec 에 `resumeGraphAfterRetry (private via applyRetryLastTurn)` describe 를 추가하고, `driver.loadAndBuildGraph` mock 이 `{ nodes: [], ... }` 를 반환하게 설정해 fallback 분기를 격리 검증한다. `private` 메서드이므로 `applyRetryLastTurn` 를 통해 간접 진입해야 하며, 이에 필요한 `rehydrateContext`, `buildRetryReentryState`, `processAiResumeTurn` mock 은 기존 beforeEach setup 에서 가져올 수 있다.

### [INFO] `dataSource` 를 `(service as unknown as { dataSource: unknown }).dataSource` 로 per-test override — 취약한 패턴
- 위치: `/codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts` L1666
- 상세: `installRetryMocks` 가 서비스의 private `dataSource` 필드를 외부에서 직접 덮어쓰는 방식이다. 이는 TypeScript 타입 시스템을 우회(캐스팅)하며, 클래스 필드 이름 변경 시 런타임 실패가 컴파일 시에 잡히지 않는다. 엔진 spec 에서 이관된 패턴을 그대로 수용했으나 신규 spec 에서 동일한 취약점이 반복된다.
- 제안: 장기적으로 `dataSource` 를 생성자 인자로 주입 받는 현재 구조를 유지하되, 테스트 전용 생성자 오버로드 대신 `DataSource` 를 `{ transaction: jest.fn() }` 으로 mock 하고 생성자에서 넘기는 방식으로 수정하거나, 최소한 `'dataSource' in service` assertion 을 추가해 필드명 드리프트를 조기에 잡는다. 현행 per-test override 는 즉각 리스크는 낮지만 리팩토링 안전망을 깎는다.

### [INFO] `retryAfterSec` 를 `_retryState` 에서 읽는 폴백 경로 — 테스트 없음
- 위치: `/codebase/backend/src/modules/execution-engine/retry-turn.service.ts` L166–170
- 상세: `retryAfterSec` 는 `output.error.details.retryAfterSec` 에 없으면 `retryState.retryAfterSec` 에서 읽는다. 이 폴백 경로를 검증하는 테스트가 없다. 기존 RETRY_TOO_EARLY 케이스는 `output.error.details.retryAfterSec` 경로만 커버한다.
- 제안: `_retryState.retryAfterSec` 폴백으로 RETRY_TOO_EARLY 가 발생하는 케이스를 추가한다.

### [INFO] 테스트 격리 양호 — `RetryTurnService` 직접 생성 패턴
- 위치: `/codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts` L1603–1614
- 상세: NestJS `TestingModule` 을 사용하지 않고 `new RetryTurnService(...)` 로 직접 생성하는 방식은 forwardRef 순환 DI 의 영향 없이 완전 격리된 단위 테스트를 가능하게 한다. `afterEach(() => jest.restoreAllMocks())` 로 spy 정리도 수행한다. 격리 측면에서 적절하다.

### [INFO] 엔진 spec — `RetryTurnService` DI 등록 누락 시 DI 오류 방지 처리 확인됨
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 305–307, 13993–13995, 14701–14703
- 상세: 엔진 spec 의 세 개 `TestingModule` 섹션 모두 `RetryTurnService` 를 providers 에 추가했다. 엔진 생성자가 `forwardRef(() => RetryTurnService)` 로 의존하므로 DI 트리 완결에 필수이며 올바르다. 회귀 없음.

## 요약

`retry-turn.service.spec.ts` 신설로 `retryLastTurn` 의 8개 검증 케이스(TTL 유효·만료·소비됨·동시성 affected=0·not retryable·not FAILED·타 execution 소속·RETRY_TOO_EARLY)가 RetryTurnService 격리 단위 테스트로 올바르게 이관됐고, 엔진 spec 세 곳의 DI 등록도 갱신됐다. 그러나 `applyRetryLastTurn` 의 경비 조기 반환 5개 분기와 `resumeGraphAfterRetry` defensive fallback 2개 분기, `failRetryExecution` 의 ExecutionCancelledError 분기는 새 spec 에 없고 엔진 spec 의 통합 테스트도 이 경로를 직접 도달시키지 않는다. `retryAfterSec` _retryState 폴백 경로도 커버 갭이다. 테스트 격리 자체는 양호하나 커버리지 갭이 중요 오류 처리 경로에 집중돼 있어 주의가 필요하다.

## 위험도

MEDIUM
