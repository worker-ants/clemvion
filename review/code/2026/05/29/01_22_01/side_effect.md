# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `executeNode` 시그니처에 선택적 매개변수 `outgoingEdgeMap` 추가
- 위치: `execution-engine.service.ts` — `executeNode` 함수 정의 (라인 ~4308–4314) 및 호출부 5곳
- 상세: `outgoingEdgeMap?: Map<string, GraphEdge[]>` 가 `optional` 파라미터로 추가됨. 기존 호출부가 인수를 생략해도 `undefined` 로 처리되어 `outgoingEdgeMap` 전달 여부 판정(`if (outgoingEdgeMap !== undefined)`)이 분기를 건너뜀. 기존 호출자는 시그니처 변경 영향을 받지 않는다. 컨테이너 실행자(ForEachExecutor, LoopExecutor, ParallelExecutor)는 자체적으로 `executeNode` 를 직접 호출하지 않고 상위 메서드를 경유하므로, 해당 경로가 `outgoingEdgeMap`을 전달하는지 확인이 필요하다. `plan.outgoingEdgeMap` 을 통해 `executeNode` 에 전달하는 경로(라인 ~5733)와 직접 `outgoingEdgeMap` 을 전달하는 경로(라인 ~5186)가 존재하므로, 컨테이너 내부에서 `executeNode` 를 호출하는 별도 경로가 있다면 `outgoingEdgeMap` 이 누락될 수 있다.
- 제안: `ForEachExecutor`, `LoopExecutor`, `ParallelExecutor` 의 `executeNode` 호출 경로를 확인해 `outgoingEdgeMap` 이 올바르게 전달되는지 검증.

### [INFO] `ExecutionContext` 에 `outgoingEdgeMap` 전달 — 컨텍스트 공유 상태 변경 없음
- 위치: `execution-engine.service.ts` — `createContext` 호출 후 `context` 객체 활용 경로
- 상세: `outgoingEdgeMap` 은 `ExecutionContext` 필드가 아니라 `executeNode` 의 지역 매개변수로만 전달된다. 공유 `context` 객체나 전역 상태에 기록되지 않으며, `errorPortFallbackMessage` 지역 변수도 `executeNode` 스택 프레임 안에서만 존재한다. 의도치 않은 상태 오염 없음.
- 제안: 없음.

### [INFO] `ErrorPortFallbackError` — 새 모듈-레벨 클래스 도입 (전역 변수 아님)
- 위치: `execution-engine.service.ts` 라인 ~222–232
- 상세: `class ErrorPortFallbackError` 가 모듈 스코프에 추가되었다. `ExecutionCancelledError` 와 동일한 패턴이며 `export` 되지 않아 외부 노출 없음. `readonly code = 'ERROR_PORT_FALLBACK'` 인스턴스 필드는 객체 생성 시마다 복사되어 공유 상태가 되지 않는다. 전역 변수 도입이나 기존 상태 변경 없음.
- 제안: 없음.

### [WARNING] `savedExecution.error` 구조 변경 — 기존 `{ message }` → 선택적 `{ message, code }` 확장
- 위치: `execution-engine.service.ts` 라인 ~1347–1670, ~2542–2701 (top-level catch 두 곳)
- 상세: 기존 코드는 `savedExecution.error = { message: errMessage }` 로 항상 `message` 단일 키를 저장했다. 변경 후 `ErrorPortFallbackError` 처럼 `code` 속성을 가진 에러가 catch 될 때 `{ message, code }` 형태로 저장된다. Execution 엔티티의 `error` 컬럼이 JSONB 라면 스키마 변경 없이 수용되지만, `error.code` 를 읽는 API 응답 직렬화·프론트엔드·다른 쿼리가 이전에 `code` 가 존재하지 않는다고 가정했다면 예상치 못한 필드가 추가된다. `ErrorPortFallbackError` 외에 `code` 속성을 우연히 가진 일반 `Error` 서브클래스(예: Node.js `SystemError`)도 `code` 를 보존하게 된다.
- 제안: `instanceof ErrorPortFallbackError` 체크로 narrowing 을 명시하거나, `code` 를 보존할 에러 클래스 목록을 화이트리스트 방식으로 제한하는 것을 고려.

### [INFO] `testEmailTransport` — 실제 외부 네트워크 호출 발생 (의도된 부작용)
- 위치: `integrations.service.ts` — `testEmailTransport` 메서드 (라인 ~1256–1258)
- 상세: `nodemailer.createTransport().verify()` 는 실제 SMTP 서버로 TCP 소켓을 열고 인증 핸드셰이크를 수행한다. 이것은 이 변경의 핵심 목적(Fix 2)이므로 의도된 동작이다. `connectionTimeout: 10_000`, `greetingTimeout: 10_000`, `socketTimeout: 10_000` 을 설정해 hang 을 방지하고 있으며, `finally` 블록에서 `transporter.close()` 를 호출해 소켓 누수를 방지하고 있다. 실패 시 에러를 throw 하지 않고 `{ success: false, ... }` 를 반환해 호출 스택에 예외가 전파되지 않는다.
- 제안: 없음. 다만 `rotate()` 경로의 `dispatchTest` → `testEmailTransport` 호출은 자격증명 저장 전에 SMTP 연결을 시도하므로, 저장 없이 외부 서버 연결이 발생하는 점을 팀이 인지하고 있어야 한다(의도된 동작으로 보임).

### [INFO] `transportTesters` 맵에 `email` 항목 추가 — 서비스 수준 동작 변경
- 위치: `integrations.service.ts` 생성자 (라인 ~253–255)
- 상세: 기존에 `email` 서비스 타입은 `transportTesters` 에 등록되지 않아 `dispatchTest` 가 구조 검증만 하고 `{ success: true }` 를 반환했다. 이제 `testEmailTransport` 가 등록되어 `previewTest`, `testConnection`, `rotate` 경로에서 모두 실제 SMTP 연결 시도로 행동이 바뀐다. 특히 `rotate()` 는 자격증명 저장 전에 `dispatchTest` 를 호출하므로, 이전에 구조 검증만 통과하면 저장됐던 email 자격증명이 이제 SMTP 연결도 통과해야 저장된다. 이는 의도된 breaking change 이며 plan.md 에 명시되어 있다.
- 제안: 없음. plan.md 의 "연결 테스트 동작이 실제 검증으로 바뀌었으나 user-guide claim 은 그대로 정확" 설명이 올바른지 확인.

### [INFO] 테스트 파일의 `handlerRegistry.register` 공유 상태 — 기존 패턴과 동일
- 위치: `execution-engine.service.spec.ts` — `error port routing` describe 블록 (라인 ~40–188)
- 상세: `errHandler()` 는 호출마다 새 객체를 생성하는 팩토리 함수이므로, 첫 번째·두 번째 테스트가 각각 `handlerRegistry.register('err_node', errHandler())` 를 호출해도 서로 다른 mock 인스턴스를 등록한다. `beforeEach` 에서 `Test.createTestingModule` 로 새 모듈을 생성하므로 레지스트리 상태가 테스트 간에 격리된다. 부작용 없음.
- 제안: 없음.

### [INFO] `jest.mock('nodemailer', ...)` 모듈 수준 mock — 다른 테스트 격리 확인 필요
- 위치: `integrations.service.spec.ts` 라인 ~1978–1980
- 상세: `jest.mock('nodemailer', () => ({ createTransport: jest.fn() }))` 는 파일 스코프에서 모듈 전체를 mock 으로 교체한다. 동일 Jest worker 프로세스에서 이 파일과 함께 실행되는 다른 테스트가 `nodemailer` 를 import 한다면 mock 이 적용될 수 있으나, Jest 의 모듈 레지스트리는 파일 단위로 격리되므로 실제로는 문제가 없다. `beforeEach(() => mockedCreateTransport.mockReset())` 로 각 테스트마다 호출 기록을 초기화하고 있다.
- 제안: 없음.

## 요약

이번 변경의 부작용 리스크는 전반적으로 낮다. Fix 1(엔진 error-port 처리)은 `executeNode` 에 선택적 매개변수를 추가하고 지역 변수로만 상태를 관리해 공유 상태 오염이 없다. 주목할 점은 top-level catch 블록의 `savedExecution.error` 에 `code` 필드가 선택적으로 추가되는 것인데, `Error` 서브클래스가 `code` 속성을 우연히 갖는 경우에도 적용되므로 의도하지 않은 코드가 Execution 에 기록될 수 있다. Fix 2(SMTP transport tester)는 `email` 서비스의 `previewTest` / `testConnection` / `rotate` 경로에서 실제 외부 네트워크 연결이 발생하도록 바꾸는 명시적 동작 변경이며, 타임아웃·소켓 정리가 올바르게 구현되어 있다. 컨테이너 실행자 경로(ForEachExecutor 등)에서 `executeNode` 를 직접 호출하는 경우 `outgoingEdgeMap` 이 전달되지 않을 수 있으나, 이 경우 fallback 판정을 건너뛰므로 기능 누락은 있어도 오동작은 발생하지 않는다.

## 위험도

LOW
