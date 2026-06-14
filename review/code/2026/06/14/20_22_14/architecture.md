# Architecture Review

## 발견사항

### **[WARNING]** `ExecutionEngineService` 의 cross-module 의존 (`chat-channel/shared/form-mode`)
- 위치: `execution-engine.service.ts` — `import { extractFormFields, validateFormSubmission } from '../chat-channel/shared/form-mode'`
- 상세: `execution-engine` 모듈이 `chat-channel` 모듈의 shared 유틸리티에 직접 의존한다. `execution-engine` 은 플랫폼 레벨 실행 엔진으로 채널 종속 로직에 의존하면 안 된다. 현재 `form-mode` 가 `shared/` 하위에 있어 의도적으로 공유를 염두에 뒀음을 추정할 수 있으나, 모듈 경계 관점에서는 `execution-engine` 이 `chat-channel` 네임스페이스에 위치한 코드에 종속됨으로써 레이어 순서가 역전된다(`execution-engine` → `chat-channel`). 채널 채팅은 엔진 위의 상위 레이어이므로 이 방향은 의존성 역전 원칙(DIP) 위반 가능성이 있다.
- 제안: `extractFormFields` / `validateFormSubmission` 을 `shared/form/` 또는 `nodes/presentation/form/` 하위로 이동하여 채널 중립적 공유 경로로 승격하거나, `execution-engine/form/` 내부에 해당 로직 사본을 두어 레이어 의존 방향을 명확히 한다. `chat-channel` 이 오히려 공유 위치를 참조해야 한다.

### **[WARNING]** `ExecutionEngineService` 에 form 검증 책임 추가 — SRP 압박
- 위치: `execution-engine.service.ts` — `assertFormSubmissionValid`, `coerceFormSubmission`, `coerceFormValue`
- 상세: `ExecutionEngineService` 는 이미 실행 생명주기(park/resume/cancel/recovery) 전반을 담당하는 대형 서비스다. 여기에 form field 검증 및 타입 강제 변환 로직 69줄을 직접 추가하면 단일 책임 원칙(SRP) 위반이 심화된다. `coerceFormSubmission` / `coerceFormValue` 는 순수 데이터 변환 함수로 별도 유틸 레이어에 속하며, `assertFormSubmissionValid` 는 도메인 검증 책임이다.
- 제안: 세 함수를 `execution-engine/form-validation.ts` 또는 `shared/form/` 으로 추출해 단일 책임을 복원한다. `ExecutionEngineService` 는 `formValidationService.assertValid(nodeExecutionId, formData)` 호출만 유지한다.

### **[WARNING]** 오류 코드 `'VALIDATION_ERROR'` 문자열 리터럴 중복 정의
- 위치: `workflow-errors.ts` (`readonly code = 'VALIDATION_ERROR' as const`), `executions.controller.ts` (`code: 'VALIDATION_ERROR'`), `interaction.service.ts` (`badRequest('VALIDATION_ERROR', ...)`)
- 상세: 동일 코드 문자열이 세 파일에 분산 하드코딩된다. `ErrorCode` enum 은 이미 중앙 관리 패턴(`ErrorCode.EXECUTION_MESSAGE_TOO_LONG` 등)으로 사용 중인데, `VALIDATION_ERROR` 만 누락됐다. `MessageTooLongError` 와 `RetryLastTurnError` 가 `ErrorCode` 를 참조하는 방식과 일관성이 없다.
- 제안: `ErrorCode` enum 에 `VALIDATION_ERROR = 'VALIDATION_ERROR'` 를 추가하고, `FormValidationError.code` 및 컨트롤러/서비스의 하드코딩을 enum 참조로 교체한다.

### **[INFO]** `executions.controller.ts` 와 `interaction.service.ts` 의 오류 매핑 로직 이중화
- 위치: `executions.controller.ts` 의 FormValidationError catch 블록, `interaction.service.ts` 의 dispatchContinuation catch 블록
- 상세: `FormValidationError` → `400 VALIDATION_ERROR + details[{field, message, code:'INVALID_FIELD'}]` 변환 로직이 두 진입점에 동일하게 복제된다. `InvalidExecutionStateError` / `MessageTooLongError` 도 동일 패턴으로 양쪽에서 처리되고 있다. 향후 진입점 추가 시 동일 패턴이 반복될 위험이 있다.
- 제안: exception mapping 을 `ExecutionErrorMapper` 유틸(또는 NestJS `ExceptionFilter`) 로 중앙화해 공통 변환을 단일 위치에서 관리한다.

### **[INFO]** `assertFormSubmissionValid` 가 `nodeExecutionId` 를 통해 Node 를 2-hop 조회
- 위치: `execution-engine.service.ts` — `assertFormSubmissionValid` 내부
- 상세: `nodeExecutionRepository.findOne({id: nodeExecutionId})` → `nodeRepository.findOneBy({id: nodeExec.nodeId})` 의 2회 DB 조회가 발생한다. `continueExecution` 이 이미 `resolveWaitingNodeExecutionId` 에서 `NodeExecution` 을 조회했으므로 결과를 인자로 전달하면 1회를 절감할 수 있다.
- 제안: `resolveWaitingNodeExecutionId` 가 `nodeId` 를 함께 반환하도록 시그니처를 확장하거나, `assertFormSubmissionValid(nodeId, formData)` 로 변경해 호출 체인에서 이미 알고 있는 `nodeId` 를 재사용한다.

### **[INFO]** e2e 테스트에서 인프라 계층 직접 조작 (DB INSERT)
- 위치: `external-interaction.e2e-spec.ts` — G 시나리오
- 상세: e2e 테스트가 `node`, `execution`, `node_execution` 테이블에 raw SQL INSERT 로 상태를 구성한다. 이는 기존 e2e 테스트(F 시나리오 등)와 동일한 패턴이므로 이 변경 자체의 신규 도입은 아니나, 레이어 경계 측면에서 e2e 가 스키마 세부 사항에 직접 의존하면 DB 마이그레이션 시 테스트가 무성으로 깨진다.
- 제안: 기존 패턴을 따른 점에서 이 변경을 blocking 으로 보지 않는다. 중장기적으로 e2e fixture helper 로 추상화를 권장한다.

## 요약

이번 변경은 `continueExecution` publisher 경로에 form field 동기 검증을 추가하고, 결과를 두 진입점(REST `executions`, EIA `external-interaction`)에 올바르게 매핑한다. 레이어 책임 분리와 오류 계층(`ExecutionError` 상속)은 전반적으로 기존 패턴을 따르고 있다. 그러나 두 가지 아키텍처 우려가 주목할 만하다: (1) `execution-engine` 이 상위 레이어인 `chat-channel/shared` 에 의존함으로써 모듈 경계 방향이 역전되고, (2) `ExecutionEngineService` 가 이미 과중한 책임을 가진 상태에서 form 검증·타입 강제 변환 로직이 내부에 직접 누적된다. 오류 코드 문자열 리터럴 분산과 진입점별 exception 매핑 이중화는 향후 유지보수성을 저해할 소지가 있다.

## 위험도

MEDIUM
