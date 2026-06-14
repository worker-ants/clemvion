### 발견사항

- **[WARNING]** execution-engine → chat-channel 레이어 의존 역전 (W-3, 이미 DEFERRED)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `import { extractFormFields, validateFormSubmission } from '../chat-channel/shared/form-mode'`
  - 상세: `execution-engine` 모듈은 플랫폼 레벨 실행 엔진으로, 채널 레이어(`chat-channel`)보다 하위 계층이어야 한다. 현재 하위 레이어가 상위 채널 레이어의 내부 shared 경로를 직접 참조하고 있어 의존 방향이 역전되어 있다. 향후 `chat-channel` 모듈 재구성 시 `execution-engine`까지 영향이 전파되는 결합도 문제가 된다.
  - 제안: `extractFormFields` / `validateFormSubmission`을 `shared/form/` 또는 `nodes/core/form-validation/` 같은 채널 중립 경로로 승격. `chat-channel`과 `execution-engine` 모두 공유 위치를 참조하도록 역전. 이전 RESOLUTION에서 DEFERRED-BACKLOG로 정확히 기록됨 — 현재 diff에서도 해소되지 않았음을 재확인.

- **[WARNING]** ExecutionEngineService SRP 압박 — form 검증 로직 69줄 직접 내장 (W-4, 이미 DEFERRED)
  - 위치: `execution-engine.service.ts` — `assertFormSubmissionValid`, `coerceFormSubmission`, `coerceFormValue` (3개 private 메서드)
  - 상세: `ExecutionEngineService`는 이미 실행 생명주기 전반을 관장하는 대형 클래스다. form 검증 책임(`coerceFormSubmission`/`coerceFormValue`는 순수 데이터 변환 함수)을 서비스 내부에 private static으로 내장하면 단일 책임 원칙을 더 압박한다. 특히 `coerceFormValue`를 테스트에서 `(ExecutionEngineService as unknown as SvcClass).coerceFormValue(v)` 패턴으로 접근해야 하는 것은 해당 함수가 클래스 내부가 아닌 독립 모듈에 있어야 함을 보여주는 신호다.
  - 제안: `execution-engine/form-validation.ts`(또는 W-3 해소 시 `shared/form/`)로 추출. `ExecutionEngineService`는 `assertFormSubmissionValid` 위임 호출만 유지. 이 경우 private cast 없이 공개 함수로 단위 테스트 가능.

- **[INFO]** `FormValidationError.toHttpDetails()` — HTTP 전송 관심사가 도메인 에러 클래스에 혼재
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `toHttpDetails()` 메서드
  - 상세: `toHttpDetails()`는 HTTP 응답 body 형태(field, message, code 객체 배열)를 직접 반환한다. 도메인 에러 클래스가 HTTP 전송 형식을 알고 있는 것은 레이어 책임 분리 관점에서 경계선에 있다. 현재 규모에서는 두 진입점 간 일관성 유지 이득(W-6 해소)이 더 크므로 허용 가능하나, 진입점이 늘어나거나 gRPC/GraphQL 응답 형식이 추가되면 오염 범위가 커진다.
  - 제안: 현행 유지 가능. 중장기적으로는 `ExecutionErrorMapper` 유틸 또는 `ExceptionFilter`에서 에러 타입별 변환 로직을 집중 관리하는 방향으로 리팩터 시 함께 검토.

- **[INFO]** exception 매핑 이중화 — `executions.controller.ts`와 `interaction.service.ts` 각자 catch 블록 (I-4, 기존 인지)
  - 위치: `executions.controller.ts` catch 블록 / `interaction.service.ts` `dispatchContinuation` catch 블록
  - 상세: `FormValidationError → BadRequestException` 변환이 두 진입점에 별도 구현되어 있다. `toHttpDetails()` 도입으로 `'INVALID_FIELD'` 리터럴 중복은 해소되었으나, 변환 로직 자체(instanceof 가드 + BadRequestException 생성)는 여전히 두 곳에 존재한다. 진입점이 WS 게이트웨이 등으로 확장될수록 반복된다.
  - 제안: `ExceptionFilter` 또는 `ExecutionErrorMapper` 유틸로 중앙화(중장기 태스크로 기존 RESOLUTION에 이미 기록됨).

- **[INFO]** `assertFormSubmissionValid` 방어적 통과 설계와 암묵적 전제 미문서화
  - 위치: `execution-engine.service.ts` `assertFormSubmissionValid` — `if (!nodeExec) return`, `if (!node) return`, `if (fields.length === 0) return`
  - 상세: node 또는 nodeExecution 미존재 시 검증을 무조건 통과시키는 방어적 설계는 `resolveWaitingNodeExecutionId`가 선검증한다는 전제 하에 안전하다. 그러나 이 전제가 문서화되지 않으면 미래 호출 순서 변경 시 암묵적 보안 의존이 깨질 수 있다.
  - 제안: `assertFormSubmissionValid` JSDoc 또는 인라인 주석에 "nodeExec null은 `resolveWaitingNodeExecutionId` 선검증으로 실제 도달 경우가 없음(방어적 가드)" 명시. 현행 동작 변경 불필요.

- **[INFO]** `ErrorCode` enum 위치 — `nodes/core/error-codes.ts`에 form-validation 관련 코드 추가
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts`
  - 상세: `VALIDATION_ERROR`가 `nodes/core` 하위 enum에 추가된 것은 기존 패턴(MessageTooLong, RetryLastTurn 등)과 일관적이다. 그러나 `nodes/core`는 노드 실행 관련 에러코드의 자연스러운 위치이고, form validation은 presentation 노드에 국한된 기능임을 고려할 때 enum 위치가 적절한지 장기적으로 검토 여지가 있다. 현재 규모에서는 단일 SoT 유지 이득이 크므로 현행 유지.

### 요약

이번 변경은 `submit_form` 서버 측 field 검증을 publisher 레벨에 추가하는 단일 목적 구현으로, CHANGELOG·에러코드 enum·도메인 에러 클래스·두 진입점 컨트롤러/서비스·WS 게이트웨이 테스트까지 일관되게 반영되어 있다. 핵심 아키텍처 문제는 `execution-engine` 모듈이 상위 채널 레이어(`chat-channel/shared/form-mode`)에 직접 의존하는 레이어 역전(W-3)과, 순수 데이터 변환 함수(`coerceFormSubmission`/`coerceFormValue`)가 이미 책임이 많은 `ExecutionEngineService` 내부에 private static으로 내장된 SRP 압박(W-4)이며, 두 항목 모두 DEFERRED-BACKLOG로 이전 RESOLUTION에 정확히 기록되어 있다. `FormValidationError.toHttpDetails()`가 두 진입점 간 일관성을 보장하고 `ErrorCode` enum이 단일 SoT를 유지하는 등 단기 완화 조치는 적절히 적용되었다. 레이어 의존 해소와 form 검증 로직 추출은 별도 계획 태스크에서 처리 예정이며, 현재 변경 범위에서 새로운 CRITICAL/WARNING 미조치 항목은 없다.

### 위험도

MEDIUM

(레이어 의존 역전 W-3과 SRP 압박 W-4가 DEFERRED 상태로 잔존하므로 MEDIUM 유지. 현재 diff 내에서 새로 도입된 즉시 조치 필요 아키텍처 결함은 없음.)
