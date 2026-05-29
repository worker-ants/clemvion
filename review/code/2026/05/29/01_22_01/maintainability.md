# 유지보수성(Maintainability) 리뷰

## 발견사항

### execution-engine.service.ts

- **[WARNING]** error 코드 추출 로직 인라인 중복
  - 위치: diff hunk `@@ -1347` 및 `@@ -2542` (각각 `savedExecution.error` 설정 블록)
  - 상세: `typeof (error as { code?: unknown }).code === 'string' ? { code: ... } : {}` 패턴이 두 곳에 동일하게 복사돼 있다. 이 패턴은 `runExecution`의 top-level catch가 두 개의 독립적 경로(main run / inline run)로 분기돼 있기 때문에 발생한 것으로 보이나, 향후 세 번째 경로가 생기거나 추출 로직이 변경될 경우 한쪽만 수정하는 회귀가 발생하기 쉽다.
  - 제안: `extractErrorCode(err: unknown): string | undefined` 와 같은 private helper로 추출. `ErrorPortFallbackError`의 `readonly code` 필드도 같이 처리하면 타입 단언 없이 다룰 수 있다.

- **[WARNING]** `executeNode` 함수 내 error-port 처리 블록이 지나치게 길어짐
  - 위치: diff hunk `@@ -4509` 이후 추가된 ~64줄 블록
  - 상세: `executeNode`는 이미 대형 함수이며, 이번 변경으로 error-port 감지 → NodeExecution FAILED 설정 → 이벤트 발사 → fallback 판정을 모두 인라인으로 처리하는 64줄 블록이 추가됐다. 이 블록 자체는 논리적으로 응집돼 있지만, 같은 흐름에서 COMPLETED 처리 블록(`else if (!isBlocking)`)과 대칭되지 않는 크기 차이가 생겼다.
  - 제안: `handleErrorPortRouting(node, nodeExecution, finalOutput, context, outgoingEdgeMap, executionId)` 형태의 private 메서드로 추출하면 `executeNode` 본체의 가독성이 향상된다. `errorPortFallbackMessage` 를 반환값으로 받아도 되고, 직접 throw 후 finally-rethrow 패턴을 유지해도 된다.

- **[INFO]** `isErrorPortRouted` / `hasConnectedErrorEdge` private 메서드 위치
  - 위치: diff hunk `@@ -4808` ~ `@@ -4831`
  - 상세: 두 메서드는 모두 `executeNode`만 호출하는 작은 술어(predicate)이며 JSDoc이 잘 작성돼 있다. 다만 `execution-engine.service.ts` 가 이미 대용량 파일임을 감안할 때, 장기적으로 `error-port.utils.ts` 같은 별도 모듈로 분리할 여지가 있다. 현재 PR 범위에서는 큰 문제가 아니며 INFO로 기록.

- **[INFO]** `outgoingEdgeMap` optional 파라미터의 의미 모호성
  - 위치: 함수 시그니처 `executeNode(..., outgoingEdgeMap?: Map<string, GraphEdge[]>)`
  - 상세: JSDoc에 "생략 시 fallback 판정을 건너뛴다"고 설명돼 있어 의도는 명확하다. 그러나 `undefined`가 "기능 비활성화"를 의미하는 optional 파라미터는 나중에 `outgoingEdgeMap`을 실수로 전달하지 않아도 타입 에러가 발생하지 않아 회귀가 숨어들 수 있다. 호출부 3곳 전부 이미 `outgoingEdgeMap`을 전달 중이므로 현 시점엔 문제없으나, 문서화된 약속(optional = skip)이 미래 호출부에 혼동을 줄 수 있다.
  - 제안: 현 PR 범위 유지라면 JSDoc의 설명으로 충분. 향후 리팩터링 시 `required`로 변경하거나 별도 옵션 객체로 묶는 것을 고려.

- **[INFO]** `errorPortFallbackMessage` 변수를 `null`로 초기화 후 마지막에 throw
  - 위치: `let errorPortFallbackMessage: string | null = null;` → `if (errorPortFallbackMessage !== null) { throw ... }`
  - 상세: 이 패턴은 "finally 블록 실행 후 throw"를 보장하기 위한 의도적인 설계이며 JSDoc에도 명시돼 있다. 가독성 측면에서 sentinel null 변수보다 early-return 또는 deferred-throw 패턴이 더 직관적이나, `finally` 블록(`unregisterInFlight`) 선실행이 강제 요건이므로 현 구현이 합리적이다. 코멘트가 충분히 설명하고 있다.

---

### integrations.service.ts

- **[INFO]** `testEmailTransport` 의 `_authType` 파라미터 미사용
  - 위치: `private async testEmailTransport(_authType: string, ...)`
  - 상세: `TransportTester` 인터페이스 시그니처(`authType, credentials`)를 맞추기 위해 `_authType`을 받는다. 현재 SMTP는 authType 분기가 없어 실제로 사용하지 않으며, 앞에 `_` prefix를 붙여 의도를 표시했다. 이 패턴은 기존 `testMcpTransport`에서는 `authType`을 실제 사용하므로 일관성이 있다. 추후 email이 여러 authType을 지원하면 자연스럽게 사용하게 된다. 현 상태로 수용 가능.

- **[INFO]** 타임아웃 상수 하드코딩
  - 위치: `connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000`
  - 상세: 세 개의 타임아웃이 모두 `10_000`으로 동일하다. 동일한 값이 세 번 반복되며 상수명 없이 인라인으로 박혀 있다. 현재는 숫자 구분자(`_`) 덕분에 읽기 어렵지 않으나, 값이 다른 환경 설정으로 바뀌어야 할 경우 세 곳을 개별적으로 수정해야 한다.
  - 제안: `const SMTP_CONNECT_TIMEOUT_MS = 10_000;` 상수를 모듈 레벨이나 클래스 static 상수로 선언하여 세 곳에서 공유. 혹은 `ConfigService`를 통해 환경 변수로 주입.

---

### execution-engine.service.spec.ts

- **[WARNING]** 테스트 내 노드 정의 객체 반복
  - 위치: `describe('error port routing (§3.2)')` 내 세 `it` 블록 (lines 57, 118, 160)
  - 상세: 첫 번째 `it`과 두 번째 `it` 모두 `id: 'n-err'` 노드 객체를 거의 동일하게 (`workflowId`, `type: 'err_node'`, `category`, `label: 'Mailer'`, `config: {}`, `isDisabled: false`) 인라인으로 정의한다. 유일한 차이는 첫 번째에 다운스트림 `n-handle` 노드와 엣지가 추가된다는 점이다.
  - 제안: `n-err` 노드 객체를 `describe` 스코프 상단의 상수(`const errNode: Partial<Node> = { ... }`)로 추출하면 중복 제거와 함께 "이 두 테스트는 동일한 노드를 쓴다"는 의미가 명확해진다.

- **[INFO]** `lastNodeExecSave` 헬퍼 함수 스코프
  - 위치: `describe('error port routing (§3.2)')` 블록 내 `const lastNodeExecSave = ...`
  - 상세: `lastNodeExecSave`가 `describe` 블록 내부에 정의돼 있어 해당 describe에서만 사용 가능하다. 다른 describe 블록에서도 "특정 nodeId의 마지막 save 호출을 찾는" 패턴이 나타날 가능성이 있다. 현 PR 범위에서는 지역 범위가 적절하다.

- **[INFO]** `errHandler` 팩토리 함수
  - 위치: `const errHandler = (): NodeHandler => ({ ... })`
  - 상세: `errHandler()`를 두 번 호출하는데(`it` 블록 91번 라인과 132번 라인), 각 호출이 독립적인 `jest.fn()`을 생성한다. 이는 의도적으로 보이며(`beforeEach` 없이도 mock 격리), 명확하게 팩토리 패턴임을 보여준다. 문제없음.

---

### integrations.service.spec.ts

- **[INFO]** `makeEmailIntegration` 헬퍼 중복 여부
  - 위치: `describe('testConnection — email(SMTP)')` 내 `function makeEmailIntegration()`
  - 상세: 세 `it` 블록 중 두 곳에서 사용되고 세 번째는 일부러 다른 credentials를 만들어 `makeIntegration`을 직접 호출한다. 헬퍼 함수로 의미가 명확히 구분돼 있다. 적절한 구조.

- **[INFO]** 테스트 코드의 한국어 주석 일관성
  - 위치: `integrations.service.spec.ts` 전반 및 새로 추가된 블록
  - 상세: 기존 파일은 한국어 주석과 영어 주석이 혼재하는 패턴이며, 신규 추가 코드도 이 관례를 동일하게 따르고 있다. 파일 내 일관성이 유지된다.

---

## 요약

이번 변경은 error-port 라우팅 누락 버그와 SMTP 연결 테스트 미구현이라는 두 가지 실질적 결함을 수정하는 내용으로, 전반적으로 의도가 명확하고 주석·JSDoc이 충실하다. 주된 유지보수성 우려는 `executeNode` 내 error-port 처리 블록의 인라인 길이와, top-level catch 두 곳에 복제된 error code 추출 패턴이다. 두 위치 모두 현 상태에서도 이해 가능하지만, 서비스 파일이 이미 대용량임을 감안할 때 helper 추출이 장기 유지보수성을 높인다. SMTP 타임아웃 상수 세 개의 하드코딩은 현재 값이 동일해 즉각적 문제는 없으나 환경별 조정 가능성을 위해 상수화가 권고된다. 테스트 파일에서의 노드 객체 중복은 소규모이며 즉시 리팩터링이 필요한 수준은 아니다.

## 위험도

LOW
