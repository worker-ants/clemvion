# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** `ExecutionEngineService`(도메인 서비스)가 `chat-channel/shared/form-mode`(채널 어댑터 공유 레이어)를 직접 import — 레이어 방향 위반
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L33-35 (`import { extractFormFields, validateFormSubmission } from '../chat-channel/shared/form-mode'`)
  - 상세: `execution-engine` 모듈은 핵심 도메인 레이어다. `chat-channel/shared/form-mode`는 채널 어댑터 계층 내 공유 유틸이다. 레이어 의존 방향은 외부 어댑터(chat-channel) → 도메인(execution-engine)이어야 하는데, 이 import는 역방향이다. `extractFormFields`·`validateFormSubmission`은 채널-specific context 없이 순수 함수이지만, 파일 위치(`chat-channel/shared`)가 소속을 채널 어댑터 레이어로 선언하고 있어 아키텍처 경계가 흐려진다. side-effect 리뷰에서도 동일 항목(architecture.md W-3)이 언급됐으나 이전 사이클에 "별도 논의"로 defer 처리됐다.
  - 제안: `extractFormFields`·`validateFormSubmission`·`FormModalField` 타입과 관련 순수 유틸을 `codebase/backend/src/shared/form-validation/` 또는 `codebase/backend/src/modules/execution-engine/form-validation.ts` 같은 중립 공유 레이어로 이동한다. 이를 통해 execution-engine → chat-channel 의 역방향 의존이 제거되고 양쪽이 동일 중립 레이어에서 가져오는 구조가 된다. 단기 조치로 현 위치를 유지하되 해당 함수에 "도메인 중립 순수 유틸 — chat-channel context 없음" 주석을 명시하고 별도 plan 태스크로 추적한다(testing.md W-4 BACKLOG와 연동).

- **[WARNING]** `assertFormSubmissionValid` 내 2회 DB 조회 — `continueExecution` 흐름에서 `resolveWaitingNodeExecutionId`가 이미 수행한 NodeExecution 조회를 독립 재조회
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L4326-4331 (`assertFormSubmissionValid`)
  - 상세: `continueExecution`은 (1) `resolveWaitingNodeExecutionId(executionId)` → `nodeExecutionId` 반환, (2) `assertFormSubmissionValid(nodeExecutionId, formData)` 내부에서 다시 `nodeExecutionRepository.findOne({ where: { id: nodeExecutionId } })` 를 실행한다. 호출 체인 상단에서 이미 확보된 데이터를 하위에서 재조회하는 것은 인터페이스 설계 문제다 — `assertFormSubmissionValid`가 `nodeExecutionId`를 파라미터로 받으면서도 내부에서 동일 row를 다시 조회한다. 이는 메서드 경계의 불명확성이며 레이어 응집도를 낮춘다.
  - 제안: (단기) `resolveWaitingNodeExecutionId`가 `{ nodeExecutionId, nodeId }` 를 함께 반환하거나, `assertFormSubmissionValid(nodeId: string, formData)`로 시그니처를 변경해 이미 조회된 `nodeId`를 재사용한다. (중기) TypeORM `findOne({ relations: { node: true } })`로 단일 JOIN 쿼리화. performance.md W-11 BACKLOG에서도 동일 항목이 등록되어 있으나 아키텍처 인터페이스 설계 관점에서도 별도로 처리가 필요하다.

- **[INFO]** `FormValidationError.toHttpDetails()` — 응답 shape SoT 단일화는 적절하나 두 진입점의 변환 코드가 분산
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L269-277 (`FormValidationError.toHttpDetails`) 및 `executions.controller.ts` L182-190, `interaction.service.ts` L308-313
  - 상세: `toHttpDetails()`로 details 배열 shape를 일원화한 것은 올바른 설계다. 그러나 두 진입점(executions.controller, interaction.service)이 각각 `instanceof FormValidationError` 분기와 `BadRequestException` 생성 코드를 독립적으로 보유한다. `toHttpDetails()`로 shape SoT는 확보했지만 "FormValidationError → 400 BadRequestException" 변환 자체의 SoT는 여전히 두 곳에 있다. 향후 변환 규칙(status 코드 변경, 헤더 추가)이 바뀌면 양쪽을 동시 수정해야 한다.
  - 제안: 중기적으로 공통 NestJS `ExceptionFilter` 도입해 `FormValidationError → 400` 변환을 단일 지점에서 처리하면 두 진입점 중복이 제거된다. 현 단계(2개 진입점)에서는 INFO 수준으로 허용.

- **[INFO]** `coerceFormSubmission`·`coerceFormValue`가 `ExecutionEngineService` 내 `private static` — 단일 책임 분리 기회
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L4350-4386
  - 상세: `coerceFormSubmission`·`coerceFormValue`는 순수 변환 함수(I/O 없음, 상태 불변)로 `ExecutionEngineService` 인스턴스 상태에 의존하지 않는다. 거대 서비스 클래스 내 `private static`으로 존재하는 것은 SRP 위반의 신호다 — 서비스가 form 데이터 타입 정규화 책임까지 안게 된다. 테스트 코드에서 `(ExecutionEngineService as unknown as SvcClass).coerceFormValue(v)` 캐스트 hack이 필요한 점이 이 구조 문제를 드러낸다.
  - 제안: `coerceFormSubmission`·`coerceFormValue`를 `execution-engine/form-validation.ts` 또는 chat-channel 의존 이전 시 통합할 중립 공유 레이어로 추출하면 (1) SRP 준수, (2) 테스트 cast hack 제거, (3) chat-channel/shared/form-mode 의존 이전 시 함께 통합 가능. testing.md W-4 BACKLOG와 연동.

- **[INFO]** `dispatchContinuation`(interaction.service) 의 catch 분기 증가 — OCP 관점 확장성
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` L289-317 (`dispatchContinuation`)
  - 상세: `dispatchContinuation`의 catch 블록이 현재 `InvalidExecutionStateError`, `MessageTooLongError`, `FormValidationError` 3가지 instanceof 분기를 보유한다. 새 커맨드 타입이 추가될 때마다 이 블록에 분기가 늘어나는 구조로, 개방-폐쇄 원칙(OCP) 관점에서 확장에 닫혀있다.
  - 제안: 중기적으로 `ExecutionError` 계층에 `toInteractionResponse()` 추상 메서드 또는 공통 exception filter를 도입해 각 오류 클래스가 자신의 HTTP 변환을 캡슐화하면 OCP 준수. 현 단계(3개 분기)에서는 INFO 수준.

- **[INFO]** `FormValidationError extends ExecutionError` 계층 편입 기준 — 명시적 문서 없음
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L250, L178-186 (`ExecutionTimeLimitError` 설계 경계 주석)
  - 상세: `FormValidationError`는 `ExecutionError`를 상속해 WS continuation ack에 `code`/`message`가 직접 surface된다. 반면 `ExecutionTimeLimitError`는 dispatch loop sentinel 역할이어서 의도적으로 `ExecutionError` 계층 밖에 두었다. 두 오류의 계층 편입 기준이 "publisher 측 동기 검증 경로에 도달하는가"(spec §7.5.2)로 일관되어 있어 현 설계는 적절하다. 그러나 이 기준이 코드 상에 명시되어 있지 않아 향후 오류 클래스 추가 시 잘못된 계층에 편입될 위험이 있다.
  - 제안: `workflow-errors.ts` 상단 `ExecutionError` JSDoc에 "계층 편입 기준: publisher 측 동기 검증 경로(continuation ack / publisher 동기 응답)에 도달하는 에러만" 을 한 줄 추가하면 향후 오류 클래스 추가 시 가이드가 된다.

## 요약

이번 변경은 `continueExecution` publisher chokepoint에 form field 검증을 삽입하고 `FormValidationError`/`ValidationDetail`를 `ExecutionError` 계층에 추가한다. `toHttpDetails()`를 통한 응답 shape 단일화, `ExecutionError` 계층 편입 기준의 일관성(spec §7.5.2), 기존 인증/인가 체인 하위 배치 등 주요 아키텍처 결정은 적절하다. 그러나 두 가지 레이어 관점 WARNING이 존재한다. 첫째, `execution-engine` 도메인 서비스가 `chat-channel/shared/form-mode` 채널 어댑터 레이어를 역방향으로 import하는 것은 레이어 책임 분리 원칙 위반으로, 해당 순수 함수들을 중립 공유 레이어로 이동하는 리팩터링이 필요하다. 둘째, `assertFormSubmissionValid`가 호출 체인 상단에서 이미 확보된 `NodeExecution` 데이터를 독립 재조회하는 것은 인터페이스 설계 문제이며 레이어 응집도를 낮춘다. `coerceFormSubmission`/`coerceFormValue`의 `private static` 배치와 두 진입점 변환 코드 분산은 SRP·OCP 관점의 INFO 수준 개선 기회다.

## 위험도

MEDIUM

STATUS=success ISSUES=2
