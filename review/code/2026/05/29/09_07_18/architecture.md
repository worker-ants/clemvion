# 아키텍처(Architecture) 리뷰 결과

리뷰 대상: workflow-resumable Phase 3 스테이징 변경 (Phase 2.3 + Phase 3.1)
분석 일시: 2026-05-29

---

## 발견사항

### 1. InvalidExecutionStateError 위치 선정 — 레이어 경계 위반

- **[WARNING]** `InvalidExecutionStateError`가 `execution-engine.service.ts` 내부에 `export`로 선언되고, `executions.controller.ts`, `websocket.gateway.ts`, `interaction.service.ts` 세 모듈이 직접 import하고 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (export 선언), 이를 import하는 세 파일
  - 상세: 에러 클래스는 서비스 구현 파일(service.ts)이 아닌 독립 공유 위치(전용 에러 모듈 또는 도메인 계층의 공개 API 인덱스)에 두는 것이 인터페이스 분리(ISP)와 의존성 방향 측면에서 바람직하다. 현 구조에서는 presentation/infra 레이어(controller, gateway, 외부 연동 service)가 execution-engine 서비스의 내부 구현 파일에 구체적으로 결합된다. 서비스 내부를 리팩토링하면 에러 클래스 경로 변경이 소비자 세 곳에 동시 전파된다.
  - 제안: `execution-engine/errors.ts` 또는 `execution-engine/index.ts`의 공개 re-export로 분리하거나, 최소한 별도 파일로 추출하여 역방향 레이어 결합을 단절한다.

---

### 2. ContinuationDlqMonitorService의 설정 읽기 — 의존성 역전 미적용

- **[WARNING]** `ContinuationDlqMonitorService` 생성자가 `process.env.*`를 직접 읽는다. NestJS 관례인 `ConfigService` 주입 또는 모듈 수준 `provide` 토큰이 사용되지 않았다.
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` (생성자 내 lines 414–427)
  - 상세: 의존성 역전 원칙(DIP) 관점에서 구체적인 환경 읽기(`process.env`)보다 추상화된 설정 인터페이스를 주입받아야 한다. 현재 구현은 테스트 시 `process.env` 임시 조작이 필수적이며(`makeService` 헬퍼가 이를 수행), 설정 읽기 전략 변경 시 서비스 내부를 직접 수정해야 한다. 동일 프로젝트의 `ExecutionEngineModule`에서 이미 `SHUTDOWN_GRACE_MS`를 `useFactory`로 주입하는 패턴이 존재하므로 일관성 측면에서 차이가 발생한다.
  - 제안: `{ provide: 'CONTINUATION_DLQ_CONFIG', useFactory: ... }` 패턴으로 모듈에서 설정을 주입하거나(`SHUTDOWN_GRACE_MS` 방식과 일관), `ConfigService`를 생성자에 주입하여 `process.env` 직접 접근을 제거한다.

---

### 3. InvalidExecutionStateError 처리 중복 — Open/Closed 위반 가능성

- **[WARNING]** `InvalidExecutionStateError` → HTTP/WS 에러 변환 로직이 `websocket.gateway.ts` 4개 핸들러에 각각 독립적인 try/catch 블록으로 중복된다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (handleSubmitForm, handleClickButton, handleSubmitMessage, handleEndConversation 각각의 catch 블록)
  - 상세: `const errorCode = error instanceof InvalidExecutionStateError ? error.code : undefined` 패턴이 4개 핸들러에 복사되어 있다. 새로운 에러 코드가 추가되거나 변환 정책이 바뀌면 4곳을 동시에 수정해야 한다. OCP(개방-폐쇄 원칙) 관점에서 에러 변환을 단일 지점으로 집중시키는 것이 바람직하다. `InteractionService.dispatchContinuation()`이 이 패턴을 올바르게 추출한 사례이나, WS gateway는 동일한 추출이 이루어지지 않았다.
  - 제안: `WebsocketGateway`에 private 헬퍼 메서드(`wrapContinuationAck(event, fn)` 등)를 추출하여 에러 변환 및 ack 반환 로직을 단일화한다.

---

### 4. ContinuationDlqMonitorService의 단일 책임 — 경미한 SRP 우려

- **[INFO]** `ContinuationDlqMonitorService`는 (1) 설정 파싱, (2) 타이머 생명주기 관리, (3) 큐 depth 조회, (4) 알람 cooldown 상태 관리, (5) 알람 로깅의 다섯 가지 책임을 하나의 클래스에서 수행한다.
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts`
  - 상세: 현재 규모(141줄)에서는 허용 가능하다. `checkOnce`가 `now` 파라미터를 주입받아 테스트 가능성을 확보한 점은 좋은 설계다. 향후 알람 전송 채널(외부 웹훅 등)이 추가되거나 cooldown 정책이 복잡해지면 단일 파일의 결합도가 높아질 수 있다.
  - 제안: 당장의 수정은 불필요하나, 알람 발송 로직이 늘어날 경우 `DlqAlarmPolicy` 인터페이스 분리를 고려한다.

---

### 5. resolveWaitingNodeExecutionId — try 외부 let 선언 패턴

- **[INFO]** `resolveWaitingNodeExecutionId`에서 `let rows`를 try 블록 바깥에 선언하고 try 안에서 할당하는 구조가 사용된다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (resolveWaitingNodeExecutionId 메서드)
  - 상세: 이 구조는 기능적으로 정확하고 catch 경로에서 항상 throw하므로 미초기화 접근은 발생하지 않는다. 다만 코드 독자가 제어 흐름을 추론해야 하는 인지 부하가 있다. 아키텍처 차원에서 큰 문제는 아니다.
  - 제안: `const rows`를 try 내부에서 선언하고 catch에서 즉시 re-throw하는 구조가 의도를 더 명시적으로 표현한다. 선택적 개선이다.

---

### 6. 레이어 경계 및 순환 의존성 — 양호

- **[INFO]** `ContinuationDlqMonitorService`는 execution-engine 모듈 내 continuation 서브디렉토리에 적절히 배치되고, `ExecutionEngineModule`에 provider로 등록되어 외부로 export되지 않는다(내부 관심사 적절히 캡슐화). `ContinuationExecutionProcessor.onFailed`는 processor의 실패 이벤트 처리를 담당하는 자연스러운 위치이며, `DLQ depth 추세 관측`과 `개별 실패 로깅`을 각각 별도 서비스(`ContinuationDlqMonitorService`)와 이벤트 핸들러(`onFailed`)로 분리한 구조는 단일 책임 원칙을 잘 적용하고 있다. 순환 의존성은 발견되지 않았다.

---

## 요약

이번 변경의 핵심 두 관심사(Phase 2.3의 `InvalidExecutionStateError` 동기 surface, Phase 3.1의 DLQ 모니터링)는 아키텍처적으로 올바른 방향으로 구현되었다. fallback sentinel 우회 제거는 레이어 책임 명확화(publisher가 동기 검증 담당, worker가 비동기 실패 처리 담당)라는 점에서 긍정적이며, DLQ 모니터와 worker `onFailed` 이벤트 핸들러를 분리한 구조도 관심사 분리 측면에서 적절하다. 주요 개선 여지는 `InvalidExecutionStateError`가 서비스 구현 파일에서 직접 export되어 presentation/infra 레이어 소비자 세 곳이 구현 파일에 직결되는 점(ISP/의존성 방향), WS gateway 4개 핸들러에 에러 변환 로직이 반복되는 점(OCP), `ContinuationDlqMonitorService`가 `process.env`를 직접 읽는 점(DIP)이다. 전체 결합도/응집도, 모듈 경계, 순환 의존성 측면은 양호하다.

---

## 위험도

**LOW**
