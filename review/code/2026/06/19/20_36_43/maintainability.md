# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `CoreEngineDriver`와 `ReentryStateDriver`가 독립 인터페이스로 분리되어 `EngineDriver` 합집합에 수렴하는 계층 구조
- 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` 전체
- 상세: `CoreEngineDriver` → `InteractionEngineDriver`, `AiTurnEngineDriver`, `RetryEngineDriver`의 4계층 구조가 단일 파일 안에 정의되어 있다. `ReentryStateDriver`가 `AiTurnEngineDriver`와 `RetryEngineDriver` 양쪽에 혼합 상속되는 다이아몬드 형태지만, TypeScript 인터페이스 특성상 충돌 없이 동작한다. 인터페이스 이름들은 각 소비자와 역할을 잘 반영한다.
- 제안: 현 구조 유지가 적절하다. 파일 길이가 증가했지만 인터페이스가 모두 관련 계약이며, 파일 분리보다 단일 파일 유지가 네비게이션 비용을 낮춘다.

### [INFO] `execution-engine.service.ts` — `retryLastTurn`·`applyRetryLastTurn` thin delegator 제거로 코드 단순화
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` diff `@@ -3888`~`-3985` 구간 (약 100라인 삭제)
- 상세: 두 delegator 메서드와 그 JSDoc(60여 라인)이 제거됨으로써 엔진 서비스의 공개 표면이 줄었다. delegator 메서드는 단순 위임이었으므로, 호출 경로가 명확해져 가독성이 향상된다. 이전 `retryTurnService` 필드 주입(`forwardRef`)도 제거되어 생성자가 간결해졌다.
- 제안: 현 방향이 바람직하다.

### [INFO] `WebsocketGateway` 생성자에 `retryTurnService` 필드 추가 — `forwardRef` 사용
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `@@ -97~+405` 구간
- 상세: `@Inject(forwardRef(() => RetryTurnService))` 패턴이 추가됐다. 게이트웨이가 이미 `ExecutionEngineService`, `ExecutionsService`, `BackgroundRunsService` 등 여러 `forwardRef` 의존성을 갖는 패턴과 일관된다. 단, 게이트웨이 생성자 인자가 6개 이상으로 늘어나는 추세는 장기적으로 god-class 전조일 수 있다.
- 제안: 현재는 허용 범위 내이나, 게이트웨이에 직접 묶인 서비스 호출이 계속 증가하면 게이트웨이 내부 핸들러를 별도 커맨드 핸들러로 추출하는 것을 고려한다.

### [INFO] `ExecutionEventEmitter` 생성자에 `forwardRef` 추가 — 회피책이지만 의도 문서화 양호
- 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
- 상세: `WebsocketService` 주입에 `@Inject(forwardRef(() => WebsocketService))`가 추가됐다. 생성자 주석에 ES-module 순환 발생 배경과 동작 불변성이 명시되어 있어 미래 유지보수자가 이유를 파악하기 쉽다. thin facade 구조는 그대로 유지된다.
- 제안: 주석 품질이 충분하다. 순환 의존성의 근원이 장기적으로 해소 가능하다면 그쪽이 이상적이지만, 현재 범위에서는 적절한 처리다.

### [INFO] `ContinuationExecutionProcessor` 테스트 — `retry` 변수명이 짧으나 테스트 스코프에서 허용
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.spec.ts` 라인 349
- 상세: 테스트 파일에서 `let retry: jest.Mocked<Pick<RetryTurnService, 'applyRetryLastTurn'>>` 로 선언했다. `retry`는 축약형이지만 단일 파일 스코프에서 선언 바로 위 주석이 의도를 설명하므로 읽기에 무리가 없다. 프로덕션 코드(`retryTurnService`)와 네이밍 스타일이 다르지만 테스트용 목 변수로서 관례 범위 내다.
- 제안: 일관성을 원하면 `retryService` 또는 `retryTurnService`로 통일할 수 있으나, 현 `retry`도 허용 범위다.

### [INFO] `engine-driver.interface.ts` JSDoc 내 `(12 멤버)` 하드코딩 숫자
- 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` (EngineDriver 통합 인터페이스 JSDoc)
- 상세: "12 멤버"라는 숫자가 JSDoc에 하드코딩되어 있다. 멤버가 추가/제거될 때 이 숫자가 stale될 수 있다.
- 제안: "12 멤버" 언급을 제거하거나, "소비자별 부분 인터페이스의 합집합" 설명만 남겨도 의도 전달에 충분하다. 멤버 수 주석은 유지보수 부채가 된다.

### [INFO] `retry`/`reentry`/`resume` 세 용어 혼용 — 구분 명시 필요
- 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` (ReentryStateDriver 및 buildRetryReentryState 주변)
- 상세: 파일 내에서 "retry"(상위 트리거), "reentry"(multi-turn loop 재진입), "resume"(durable checkpoint 재수화)의 세 용어가 사용된다. 메서드명 `buildRetryReentryState`에 두 용어가 함께 등장하는 등, 미묘한 개념 경계가 명시되지 않으면 향후 혼동 여지가 있다.
- 제안: `ReentryStateDriver` JSDoc 또는 파일 상단에 세 용어의 구분을 1~2줄로 명시한다.

### [INFO] `execution-engine.service.spec.ts` — `retryTurnService` 변수를 통한 호출 검증 방식이 통합 테스트 의도와 일치
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` diff `@@ -104`, `@@ -557` 구간
- 상세: `module.get<RetryTurnService>(RetryTurnService)`로 실 인스턴스를 취득해 `applyRetryLastTurn`을 직접 호출하는 방식은 엔진 내부 협력을 통합적으로 exercising한다. 파일명과 테스트 대상 서비스가 다르지만, 상단 주석이 이 의도를 설명한다.
- 제안: 현 패턴 유지가 적절하다.

## 요약

이번 변경의 핵심인 ISP 적용과 engine→Retry 순환 DI 제거는 유지보수성 관점에서 긍정적이다. 단일 대형 `EngineDriver`를 소비자별 부분 인터페이스로 분해함으로써 각 서비스가 실제로 필요한 표면만 의존하게 됐고, thin delegator 제거로 엔진 서비스 코드가 단순화됐다. 네이밍은 전반적으로 역할을 잘 반영하며, 주석이 리팩터링 맥락과 설계 의도를 충분히 설명한다. 경미한 개선 여지는 JSDoc 내 "12 멤버" 하드코딩 숫자 제거, retry/reentry/resume 세 용어 구분 명시, 그리고 `WebsocketGateway` 생성자 의존성 증가 추세 모니터링이며, 모두 구조적 문제가 아닌 문서·관례 수준의 사항이다. Critical 및 Warning 없음.

## 위험도

NONE
