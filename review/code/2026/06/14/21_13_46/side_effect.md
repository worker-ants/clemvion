# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `ErrorCode` const 객체에 `VALIDATION_ERROR` 키 추가
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` — `ErrorCode` 객체 끝
  - 상세: `as const` 객체이므로 런타임 참조가 늘어나는 것은 additive 변경이다. 기존 키는 변경되지 않아 기존 코드가 `ErrorCode.X` 를 참조하는 모든 위치는 영향을 받지 않는다. `ErrorCodeValue` union type 은 자동으로 확장되며 기존 좁힌 타입 검사(`switch`/`exhaustive check`)에서 누락 케이스 경고가 발생할 수 있으나, 이는 컴파일 타임에 명확히 드러나므로 의도치 않은 런타임 부작용은 없다.
  - 제안: 기존 `switch (errorCode)` 분기를 완전 열거하는 곳이 있다면 컴파일 타임 누락 경고를 확인할 것. 실제 부작용 없음.

- **[INFO]** `workflow-errors.ts` 에 `ValidationDetail` interface 와 `FormValidationError` 클래스가 신규 export 됨
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts`
  - 상세: 신규 named export 추가는 모듈의 공개 API 를 확장한다. 기존 import 문(`import { ExecutionError, ... } from './workflow-errors'`)은 구조적으로 영향을 받지 않는다. 단, 모듈 barrel 이나 `* as` 형태로 re-export 하는 곳이 있다면 해당 네임스페이스에 두 심볼이 추가로 노출된다.
  - 제안: 프로젝트에 `export * from './workflow-errors'` 형태의 barrel 파일이 있는지 확인. 없으면 영향 없음.

- **[INFO]** `badRequest()` 함수 시그니처 변경 (`interaction.service.ts` 내부 private 함수)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` 하단 `badRequest()` 함수
  - 상세: `details?: ReadonlyArray<ValidationDetail>` 파라미터가 optional 로 추가됐다. 기존 호출부 두 곳(`badRequest('INVALID_COMMAND', ...)`, `badRequest('MESSAGE_TOO_LONG', ...)`)은 두 인자만 전달하므로 undefined default 로 처리되어 기존 응답 shape(`{ error: { code, message } }`) 가 그대로 유지된다. 응답 body 에 `details` 키가 조건부(`details ? { details } : {}`) 로만 추가되므로 기존 클라이언트에게 unexpected 필드가 삽입되는 일은 없다.
  - 제안: 이 함수는 파일 내부 private helper(`function badRequest(...)`)이므로 외부 호출자에 대한 breaking change 는 없다. 현재 구현 안전.

- **[INFO]** `assertFormSubmissionValid` 가 `continueExecution` 경로에서 2회 추가 DB 쿼리를 실행
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` 메서드
  - 상세: `nodeExecutionRepository.findOne` + `nodeRepository.findOneBy` 의 2회 DB 조회가 기존에 없던 I/O 부작용으로 추가된다. 검증 대상이 없으면 즉시 return 하므로 worst-case 는 2회 SELECT. 외부 서비스 호출 없이 동일 DB 내 읽기 전용 쿼리이며 `execution.status` 등 공유 상태를 변경하지 않는다.
  - 제안: 기능·정확성에는 문제 없음. 성능 최적화(1회 JOIN 쿼리로 축소)는 RESOLUTION.md 의 W-11 backlog 로 이미 추적됨.

- **[INFO]** `continueExecution` 에서 `assertFormSubmissionValid` 가 `publish` 이전에 위치
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `continueExecution` 메서드 내 순서
  - 상세: 검증 실패 시 `throw FormValidationError` 로 종료하고 `continuationBus.publish` 가 호출되지 않으므로, 기존 `publish`-only 경로에 대한 부작용(BullMQ job 삽입) 은 없다. execution 상태가 `waiting_for_input` 으로 유지되는 것은 의도된 동작이며 DB 행이 수정되지 않는다.
  - 제안: 순서 배치가 올바름. 부작용 없음.

- **[INFO]** `ExecutionEngineService` 가 `chat-channel/shared/form-mode` 를 import
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 상단 import
  - 상세: 레이어 의존 방향 문제(architecture.md W-3)는 별도 논의됐으며, 부작용 관점에서는 해당 모듈이 순수 함수(`extractFormFields`, `validateFormSubmission`)만 제공하고 전역 상태나 singleton을 노출하지 않는 한 런타임 부작용은 없다. 모듈 초기화 시 `form-mode` 가 side-effectful 코드를 실행하는지는 해당 파일을 직접 확인해야 하나, NestJS shared util 관례상 순수 함수 모음으로 작성되므로 위험 낮음.
  - 제안: `form-mode.ts` 에 top-level 실행 코드(전역 상태 초기화·환경 변수 읽기 등)가 없는지 추가 확인 권장.

- **[INFO]** e2e 테스트가 `node` / `execution` / `node_execution` 테이블에 raw INSERT 수행
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` — G 시나리오
  - 상세: 테스트 실행 후 테이블에 삽입된 레코드가 정리되지 않으면 다른 테스트에 공유 상태가 누적된다. 기존 e2e 패턴과 동일하므로 이 변경이 신규 부작용을 도입하는 것은 아니다. DB 트랜잭션 롤백 또는 `afterEach` truncate 로 격리하는지 확인이 필요하다.
  - 제안: 기존 e2e 정리 패턴(rollback / truncate)이 이 케이스에도 적용되는지 확인. 기존 패턴과 동일하면 추가 조치 불필요.

## 요약

이번 변경은 `continueExecution` publisher 경로에 동기 form field 검증을 삽입하고 `FormValidationError` / `ValidationDetail` 를 신규 export 로 추가하며, 두 HTTP 진입점에서 400 응답으로 매핑한다. 의도치 않은 상태 변경·전역 변수 도입·파일시스템 부작용·환경 변수 조작·네트워크 외부 호출은 발견되지 않는다. 기존 함수 시그니처 중 외부에서 사용되는 공개 API(`continueExecution`, `ExecutionEngineService` 공개 메서드, `ErrorCode` 객체)는 additive 방식으로만 변경되어 호출자에 대한 breaking change 가 없다. 추가된 DB 조회(2회 SELECT)는 의도된 읽기 전용 I/O 이며 공유 상태를 변경하지 않는다. `badRequest()` 내부 helper 의 optional parameter 추가는 기존 호출부 동작에 영향을 주지 않는다. 전반적으로 부작용 위험은 낮다.

## 위험도

NONE
