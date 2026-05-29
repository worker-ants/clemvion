# 아키텍처(Architecture) 리뷰 — fix-mail-send-status

## 발견사항

### Fix 1: ExecutionEngineService — error-port 라우팅 처리

- **[WARNING]** `executeNode` 메서드의 단일 책임 과부하
  - 위치: `execution-engine.service.ts` — `executeNode` 메서드 (diff 기준 `@@ -4334` 영역)
  - 상세: `executeNode` 는 기존에도 노드 실행 오케스트레이션 + 상태 저장 + 이벤트 발행을 담당했는데, 이번 변경으로 error-port 라우팅 판정 + fallback sentinel 축적이 추가됐다. `isErrorPortRouted`, `hasConnectedErrorEdge`, `errorPortFallbackMessage` 변수 흐름이 모두 단일 메서드 안에 혼재하며, 메서드 길이가 더 증가했다. SRP 위반이 심화되는 방향이다.
  - 제안: 단기적으로는 현재 구조를 유지하더라도, 중기적으로 `executeNode` 내부의 "출력 후처리 → 상태 전이" 로직을 별도 `NodeResultProcessor` 클래스로 추출하는 것을 고려한다. `isErrorPortRouted`·`hasConnectedErrorEdge` 는 이미 private 메서드로 분리됐으므로 그 방향성은 올바르다.

- **[INFO]** `outgoingEdgeMap` 을 optional 파라미터로 넘기는 설계 — 암묵적 분기
  - 위치: `execution-engine.service.ts` `executeNode` 시그니처 변경 (`outgoingEdgeMap?: Map<string, GraphEdge[]>`)
  - 상세: 파라미터 미전달 시 "error-port fallback 판정 건너뜀" 이라는 분기가 옵셔널 인수 하나에 숨겨져 있다. 현재 5개 호출부 중 3개는 전달하고, `executeInline` 내부 경로는 미전달 상태를 허용하는 것으로 보인다. 이는 동일 인터페이스가 호출 경로에 따라 다른 의미론을 갖는 상황(flag argument 안티패턴 변형)이다.
  - 제안: `outgoingEdgeMap` 의 "미전달 = 폴백 판정 없음" 의도를 코드 주석이 설명하고 있어 현 단계에서는 수용 가능하다. 다만 장기적으로는 `executeNode` 를 두 개의 오버로드로 분리하거나, 파라미터 객체 패턴으로 묶어 호출부 의도를 명시하는 것이 낫다.

- **[INFO]** `ErrorPortFallbackError` sentinel 클래스 — 레이어 위치 적절
  - 위치: `execution-engine.service.ts` — `ExecutionCancelledError` 이후 새 클래스 정의
  - 상세: `ErrorPortFallbackError` 는 엔진 내부 흐름 제어용 sentinel 로, `workflow-errors.ts` 에 존재하는 `WorkflowNotFoundError`·`SubWorkflowTimeoutError` 와 동일한 성격이다. 현재 `execution-engine.service.ts` 파일 안에 인라인으로 정의됐는데, 같은 이유로 `workflow-errors.ts` 로 이동하면 cohesion 이 높아지고 테스트에서 직접 import 가능해진다.
  - 제안: `ErrorPortFallbackError` 를 `/Volumes/project/private/clemvion/codebase/backend/src/modules/execution-engine/workflow-errors.ts` 로 이동. 현재 규모에서는 낮은 우선순위이나 이미 같은 파일에 2개의 private sentinel 클래스(`ExecutionCancelledError`, `ErrorPortFallbackError`)가 정의돼 있어 향후 관리 부담이 증가한다.

- **[INFO]** `finally` 이후 throw 패턴 — 명확하나 드물어 주의 필요
  - 위치: `executeNode` 마지막 블록 (`if (errorPortFallbackMessage !== null) { throw ... }`)
  - 상세: `try/finally` 블록 종료 후 함수 바닥에서 조건부 throw 하는 패턴은 `unregisterInFlight` 보장을 위해 선택됐고 주석도 명시돼 있다. 패턴 자체는 정당하나, `errorPortFallbackMessage` 변수가 finally 블록을 건너뛰어 살아남는다는 점이 코드 독자에게 처음에는 비직관적이다.
  - 제안: 주석 수준에서 이미 설명됐으므로 현 상태 수용 가능. 추가 설명이 필요하다면 `errorPortFallbackMessage` 변수에 `// set inside the try-block; thrown after finally runs` 한 줄을 추가하면 충분하다.

### Fix 2: IntegrationsService — email SMTP transport tester

- **[INFO]** 개방-폐쇄 원칙 준수 확인
  - 위치: `integrations.service.ts` — `transportTesters` Map + `testEmailTransport` private 메서드
  - 상세: `dispatchTest` 는 `transportTesters` Map 을 조회해 위임하며, email tester 추가가 `dispatchTest` 코드를 전혀 수정하지 않았다. OCP(개방-폐쇄 원칙)를 잘 따른 확장이다. 기존 Map 기반 전략 패턴이 새 서비스 추가 시에도 유효함을 입증한다.

- **[INFO]** `nodemailer` 직접 import — 레이어 결합도 고려
  - 위치: `integrations.service.ts` 상단 `import { createTransport } from 'nodemailer'`
  - 상세: `IntegrationsService` 는 비즈니스 레이어 서비스인데, transport 라이브러리(`nodemailer`)를 직접 import 한다. `MCP` 는 `McpTestConnectionService` 라는 별도 인프라 어댑터를 통해 간접화돼 있어 일관성이 다소 깨진다. 단, email 연결 테스트가 이 서비스의 유일한 nodemailer 사용 지점이고 `EmailTransportTester` 를 별도 클래스로 뽑기에는 코드 줄이 너무 적다는 점에서, 현 규모에서는 실용적 선택이다.
  - 제안: 지금 당장 분리할 필요는 없다. 향후 send-email 핸들러의 `resolveTransport` 재사용·pool 공유가 필요해지는 시점에 `EmailTransportService` 인프라 레이어로 추출을 고려한다.

- **[INFO]** `_authType` 미사용 파라미터
  - 위치: `testEmailTransport(_authType, credentials)` — 첫 파라미터
  - 상세: `TransportTester` 인터페이스가 `(authType, credentials)` 시그니처를 강제하므로 미사용 파라미터가 생겼다. 현재 SMTP 는 authType 이 하나(`smtp`)뿐이므로 문제는 없다.
  - 제안: 현 상태 수용 가능. 미래에 authType 별 분기가 필요해지면 인터페이스 확장이나 별도 tester 등록으로 대응한다.

### 순환 의존성 검토

- **[INFO]** 순환 참조 없음 확인
  - 이번 변경은 `execution-engine.service.ts` → `GraphEdge` (같은 모듈 내 `graph/graph-builder`) 참조와, `integrations.service.ts` → `nodemailer` 추가에 그친다. 새로운 모듈 간 순환 참조는 도입되지 않았다.

### 테스트 파일 아키텍처

- **[INFO]** 테스트 모듈 조립 — 실제 구현체 혼용 주의
  - 위치: `execution-engine.service.spec.ts` `beforeEach` — `ConversationThreadService` 실제 구현체 포함
  - 상세: 대부분의 의존성은 mock 이나 `ConversationThreadService` 만 실제 구현체를 쓴다. 이는 "side-effect 없는 stateless 서비스이므로 실제 구현을 써도 안전" 이라는 의도가 주석으로 명시돼 있다. 그러나 `ConversationThreadService` 가 향후 DB 의존성을 추가하게 되면 이 결정이 테스트 안정성에 영향을 미칠 수 있다.
  - 제안: 현재 주석으로 의도가 충분히 표현됐으므로 수용 가능. 다만 `ConversationThreadService` 인터페이스 변경 시 이 테스트도 같이 검토되도록 코드 주석에 경고를 추가하는 것이 유익하다.

---

## 요약

이번 변경은 두 개의 독립된 버그 수정으로 구성된다. Fix 1(엔진 error-port 처리)은 기존 `executeNode` 의 단일 책임 과부하를 더 심화시키는 방향이나, `isErrorPortRouted`·`hasConnectedErrorEdge` 를 private 메서드로 분리하고 `outgoingEdgeMap` 을 명시적 파라미터로 전달함으로써 모듈 경계와 테스트 가능성은 유지됐다. `ErrorPortFallbackError` 의 위치(`workflow-errors.ts` 이동 미적용)와 옵셔널 파라미터를 통한 분기가 소규모 구조 채무를 남긴다. Fix 2(email transport tester)는 기존 전략 패턴(Map 기반 `transportTesters`)을 올바르게 확장해 OCP 를 준수했다. `nodemailer` 직접 임포트는 `McpTestConnectionService` 와의 일관성 차이를 만들지만 현재 규모에서는 실용적 선택으로 허용 범위 안이다. 전체적으로 심각한 아키텍처 결함은 없으며 구조 채무는 낮은 수준이다.

## 위험도

LOW
