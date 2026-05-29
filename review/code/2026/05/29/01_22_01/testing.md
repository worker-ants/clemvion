# Testing Review — fix-mail-send-status

## 발견사항

### [INFO] errHandler 팩토리 함수가 매 테스트 호출 시 새 jest.fn()을 생성
- 위치: `execution-engine.service.spec.ts` L41-49 (`errHandler` 상수)
- 상세: `errHandler`는 `describe` 블록 최상위에 화살표 함수로 선언되어 있으나, 테스트 본문에서 `errHandler()`로 매번 호출해 새 핸들러 인스턴스를 생성한다. 두 번째 테스트에서 `handlerRegistry.register('err_node', errHandler())`가 동일한 nodeType을 덮어쓰는 패턴이고, `errHandler().execute`는 전 테스트의 `jest.fn()`과 다른 레퍼런스이므로 cross-test 오염 가능성은 없다. 그러나 각 테스트 전에 `beforeEach`에서 레지스트리를 초기화하지 않아 `err_node` 등록이 다음 테스트에 남아있을 수 있다.
- 제안: `describe('error port routing')` 내에 `afterEach(() => handlerRegistry.deregister?.('err_node'))` 또는 `beforeEach`에서 레지스트리 정리를 명시하거나, `handlerRegistry`가 `beforeEach`에서 재생성됨을 확인하는 주석 추가.

### [INFO] `lastNodeExecSave` 헬퍼가 `describe` 블록 내부 스코프에 중복 정의
- 위치: `execution-engine.service.spec.ts` L51-55
- 상세: `lastNodeExecSave` 헬퍼는 `error port routing` describe 블록 내에서만 정의되어 있다. 다른 describe 블록에서 유사한 패턴이 필요한 경우 중복 구현될 수 있다. 현재는 로컬 스코프에 한정되어 있어 격리 측면에서는 문제없지만, 테스트 유지 보수 측면에서 상위 스코프나 헬퍼 파일로 승격을 고려할 수 있다.
- 제안: 해당 헬퍼 함수를 상위 describe 또는 `__test__/helpers.ts`로 이동 (INFO 수준, 즉각 조치 필요 없음).

### [WARNING] `error port routing` 테스트: `outgoingEdgeMap` 미전달 경로(컨테이너 내부 executeNode)에 대한 커버리지 갭
- 위치: `execution-engine.service.ts` L4342, L5181-5190
- 상세: 새로운 `executeNode` 시그니처에 `outgoingEdgeMap` 파라미터가 optional로 추가되었다. `outgoingEdgeMap`이 `undefined`일 때 fallback 판정을 건너뛰는 경로(L4560-4565)가 존재하지만, 이 경로를 명시적으로 검증하는 테스트가 없다. 즉 컨테이너 내부에서 error-port로 라우팅된 노드가 `outgoingEdgeMap` 없이 실행될 때 NodeExecution은 FAILED로 마킹되지만 Execution은 계속 진행되는 동작이 테스트로 보장되지 않는다.
- 제안: `outgoingEdgeMap`을 전달하지 않고 `executeNode`를 호출하는 경로(ForEach/Loop 컨테이너 내부 등)에서 error-port 라우팅이 발생했을 때 노드만 FAILED, Execution은 COMPLETED로 끝나는 케이스 테스트 추가.

### [WARNING] `testEmailTransport` — `secure: 'none'` 케이스 미테스트
- 위치: `integrations.service.spec.ts` `testConnection — email(SMTP)` describe 블록
- 상세: 현재 테스트는 `secure: 'starttls'` 케이스(`requireTLS: true`)만 검증한다. `secure: 'tls'`(암묵적 TLS, `secure: true`)와 `secure: 'none'`(`secure: false, requireTLS: false`) 케이스에서 `createTransport`에 올바른 옵션이 전달되는지 확인하지 않는다.
- 제안: 다음 두 케이스 추가:
  1. `secure: 'tls'` → `createTransport` 호출 시 `{ secure: true, requireTLS: false }` 검증
  2. `secure: 'none'` → `createTransport` 호출 시 `{ secure: false, requireTLS: false }` 검증

### [WARNING] `previewTest` — email 서비스 타입에 대한 테스트 부재
- 위치: `integrations.service.spec.ts` L1268-1375 (`previewTest` describe)
- 상세: `previewTest` 테스트는 `http`, `mcp` 서비스 타입만 다루고 있다. `email` 서비스 타입은 `transportTesters`에 새로 등록되었으므로 `previewTest`를 통해 `testEmailTransport`가 호출되는 경로도 커버되어야 한다. 현재는 `testConnection` 경로만 직접 테스트된다.
- 제안: `previewTest describe` 내에 `serviceType: 'email'` 케이스 추가 — SMTP verify 성공 및 실패 모두.

### [INFO] `rotate` 테스트 — email 자격증명 rotate 시 SMTP 검증 호출 여부 미확인
- 위치: `integrations.service.spec.ts` L818-876
- 상세: `rotate` 메서드는 내부적으로 `dispatchTest`를 호출하며, email 서비스 타입이면 이제 `testEmailTransport`를 통해 실제 SMTP 연결을 시도한다. 기존 `rotate` 테스트는 `email` 서비스 타입으로 rotate할 때 nodemailer `verify()`가 호출되는지를 검증하지 않는다.
- 제안: `rotate describe` 내에 email 서비스 타입 케이스 추가 (nodemailer mock 활용).

### [INFO] 새 `isErrorPortRouted` / `hasConnectedErrorEdge` private 메서드에 대한 단위 테스트 없음
- 위치: `execution-engine.service.ts` L4728-4832
- 상세: `isErrorPortRouted`와 `hasConnectedErrorEdge`는 private 메서드로 현재 `executeNode`를 통한 통합 방식으로만 간접 테스트된다. 두 메서드는 로직이 단순해 직접 단위 테스트는 필수 아니지만, 특히 `isErrorPortRouted`의 `_selectedPort === 'error'` (문자열) vs 배열 배제 로직이 의도대로 동작하는지 독립 검증이 없다.
- 제안: `handler-output.adapter.spec.ts` 또는 별도 헬퍼 spec에 `isErrorPortRouted` 경계값 테스트 추가 고려 (배열 `_selectedPort`, `null`, `undefined`, 비문자열 값 등).

### [INFO] `errHandler` mock: error.code 가 없는 경우(code-less error envelope) 미테스트
- 위치: `execution-engine.service.spec.ts` error port routing describe 블록
- 상세: 세 테스트 모두 `{ code: 'EMAIL_SEND_FAILED', message: 'SMTP auth failed' }` 형태의 error envelope를 사용한다. `error.code`가 없거나 `error` 필드 자체가 없는 출력(예: `mockOutput({}, { port: 'error' })`)에서 `errorCode`가 `undefined`로 처리되어 NodeExecution.error에 `code` 필드가 생략되는 경로가 테스트되지 않는다.
- 제안: code 없는 error-port 라우팅 케이스 추가 또는 기존 테스트 중 하나를 해당 케이스로 변형.

### [INFO] `flushPromises` 의존성 — 비동기 타이밍 취약 패턴
- 위치: `execution-engine.service.spec.ts` L94, L135, L179 (`await flushPromises()`)
- 상세: 기존 테스트 전반에서 사용하는 패턴과 일관성은 있으나, `setImmediate` 기반 `flushPromises`는 Promise 체인 깊이에 따라 완전히 플러시되지 않을 수 있다. 새로 추가된 세 테스트 모두 이 패턴에 의존하고 있어, `ErrorPortFallbackError` throw 후 `runExecution` top-level catch가 완료되기 전에 assert가 실행될 위험이 있다. 기존 테스트와 동일한 패턴을 유지하고 있어 회귀 위험은 낮다.
- 제안: 현행 유지, 단 실패 시 `flushPromises` 호출 횟수 증가로 진단 가능함을 주석으로 명시.

## 요약

이번 변경은 `execution-engine.service.spec.ts`에 error-port 라우팅 동작을 검증하는 테스트 3종(연결된 error 포트 → FAILED+계속, 미연결 → Stop Workflow, 정상 → COMPLETED)과 `integrations.service.spec.ts`에 SMTP 연결 테스트 3종(verify 성공, 인증 실패, 구조검증 우선)을 추가했다. 핵심 버그 수정 경로(COMPLETED 오인 방지, `ERROR_PORT_FALLBACK` 전파, nodemailer verify 호출)는 모두 테스트로 커버되어 있으며 Mock 구조도 기존 패턴과 일관성을 유지한다. 다만 `secure: 'tls'`/`'none'` 매핑 검증 누락, `previewTest` email 경로 미커버, `outgoingEdgeMap` 미전달(컨테이너 내부) 경로의 암묵적 동작 미검증 등 WARNING 수준의 커버리지 갭이 존재한다. 이들은 현재 구현의 버그가 아닌 테스트 범위 문제이며, 향후 SMTP TLS 설정 변경이나 컨테이너 내부 error-port 사용 시 회귀 위험을 높일 수 있다.

## 위험도

LOW
