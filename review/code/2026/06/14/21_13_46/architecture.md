### 발견사항

- **[INFO]** execution-engine → chat-channel 레이어 의존 역전 (W-3, DEFERRED-BACKLOG 유지)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `import { extractFormFields, validateFormSubmission } from '../chat-channel/shared/form-mode'`
  - 상세: 이전 두 리뷰 라운드(20_22_14, 20_57_57)에서 모두 WARNING으로 기록된 사항이다. `execution-engine`(플랫폼 하위 레이어)이 `chat-channel`(채널 상위 레이어)의 shared 경로를 직접 참조하는 의존 방향 역전이 현 diff에서 해소되지 않았다. RESOLUTION.md에 DEFERRED-BACKLOG로 명확히 기록되어 있으며 별도 plan 태스크로 위임 예정이다. 현재 diff 내에서 새로운 조치는 없고 기존 상태 그대로다.
  - 제안: 별도 plan 태스크에서 `extractFormFields`/`validateFormSubmission`을 `shared/form/` 또는 `nodes/core/form-validation/` 채널 중립 경로로 승격 처리. 현 PR 범위 외.

- **[INFO]** ExecutionEngineService SRP 압박 — form 검증 로직 internal 내장 (W-4, DEFERRED-BACKLOG 유지)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid`, `coerceFormSubmission`, `coerceFormValue` (3개 private 메서드)
  - 상세: 이전 두 라운드에서 모두 WARNING으로 기록된 사항. `ExecutionEngineService`에 form 검증·타입 강제 변환 로직 69줄이 private 메서드로 내장되어 단일 책임 원칙이 압박된다. DEFERRED-BACKLOG 상태 유지. 현 diff에서 새로운 변화 없음.
  - 제안: DEFERRED-BACKLOG 유지. W-3 해소(채널 중립 경로 승격) 시 함께 추출.

- **[INFO]** `ValidationDetail` 타입 정의 단일 SoT 확보 — 이전 라운드 WARNING 해소됨
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (export `ValidationDetail` 인터페이스), `codebase/backend/src/modules/external-interaction/interaction.service.ts` (import 참조로 전환)
  - 상세: 라운드 2(20_57_57)에서 WARNING으로 지적된 `ValidationDetail` 타입 중복 정의가 커밋 ef019726에서 해소되었다. `workflow-errors.ts`가 단일 SoT로 `ValidationDetail`을 export하고, `interaction.service.ts`의 로컬 중복 선언이 제거되어 import 참조로 전환됐다. 타입 단일 SoT 원칙 충족.
  - 제안: 없음.

- **[INFO]** `FormValidationError.toHttpDetails()` — HTTP 전송 관심사 혼재
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `toHttpDetails()` 메서드
  - 상세: 도메인 에러 클래스가 HTTP 응답 body 형태를 직접 반환하는 것은 레이어 책임 분리 관점에서 경계에 있다. 두 진입점 간 일관성 보장이라는 단기 이득(W-6 해소)이 더 크므로 현 단계에서는 허용 가능 설계다. gRPC/GraphQL 등 추가 전송 계층이 필요해지면 재검토가 필요하다.
  - 제안: 현행 유지. 중장기 `ExecutionErrorMapper`/`ExceptionFilter` 중앙화 태스크에서 함께 검토.

- **[INFO]** exception 매핑 이중화 — 두 진입점 각자 catch 블록 (I-4, 기존 인지)
  - 위치: `executions.controller.ts` FormValidationError catch 블록 / `interaction.service.ts` `dispatchContinuation` catch 블록
  - 상세: `FormValidationError → BadRequestException` 변환이 두 진입점에 별도로 구현되어 있다. `toHttpDetails()`로 `'INVALID_FIELD'` 리터럴 중복은 해소되었으나 변환 패턴(instanceof 가드 + BadRequestException 생성) 자체는 두 곳에 존재한다. 이전 라운드부터 인지된 중장기 태스크다.
  - 제안: `ExceptionFilter` 또는 `ExecutionErrorMapper` 유틸로 중앙화(별도 plan 태스크).

- **[INFO]** `'INVALID_FIELD'` 리터럴 enum 미통합
  - 위치: `workflow-errors.ts` `toHttpDetails()` 내 `code: 'INVALID_FIELD'`
  - 상세: `VALIDATION_ERROR`는 `ErrorCode` enum으로 통일되었으나 `INVALID_FIELD`는 여전히 `toHttpDetails()` 내 하드코딩 리터럴이다. 현재 단일 사용처이므로 즉각적 위험은 낮다.
  - 제안: INFO 수준. `ErrorCode.INVALID_FIELD = 'INVALID_FIELD'` 추가 또는 클래스 내 상수화 고려.

- **[INFO]** `assertFormSubmissionValid` DB 쿼리 2회 순차 발생 (W-11, DEFERRED-BACKLOG 유지)
  - 위치: `execution-engine.service.ts` `assertFormSubmissionValid` — `nodeExecutionRepository.findOne` + `nodeRepository.findOneBy` 순차 호출
  - 상세: 라운드 1에서 DEFERRED-BACKLOG로 기록된 성능 최적화 사항. 단일 JOIN 쿼리로 병합 가능하나 기능 정확성에는 영향 없음. 현 diff에서 새로운 변화 없음.
  - 제안: DEFERRED-BACKLOG 유지. 별도 성능 최적화 태스크에서 처리.

- **[INFO]** `ErrorCode` enum 위치 (`nodes/core/error-codes.ts`) — 기존 패턴 일관성 유지
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` — `VALIDATION_ERROR` 추가
  - 상세: form validation 관련 에러코드가 `nodes/core` 하위에 추가된 것은 기존 패턴(MessageTooLong, RetryLastTurn 등)과 일관적이다. `nodes/core`가 execution-engine, executions, external-interaction 세 모듈에서 공통 참조되므로 cross-cutting 위치로 적절하다.
  - 제안: 없음.

### 요약

이번 변경(3차 리뷰 라운드 기준)은 `submit_form` publisher 측 동기 field 검증을 추가하고 두 HTTP 진입점에 일관되게 매핑하는 단일 목적 구현이다. 이전 두 리뷰 라운드에서 제기된 WARNING 사항 중 `ValidationDetail` 타입 중복 정의(라운드 2 WARNING)는 커밋 ef019726에서 `workflow-errors.ts` 단일 SoT export로 해소되었고, `FormValidationError` 직접 단위 테스트(라운드 2 WARNING)도 `workflow-errors.spec.ts`에 추가되어 해소되었다. 잔존하는 구조적 문제는 `execution-engine → chat-channel` 레이어 의존 역전(원 W-3)과 `ExecutionEngineService` SRP 압박(원 W-4)이나, 두 항목 모두 DEFERRED-BACKLOG로 명확히 기록되어 있으며 현 PR 범위 외 별도 태스크로 위임 예정이다. `FormValidationError.toHttpDetails()`의 HTTP 관심사 혼재와 exception 매핑 이중화는 단기 일관성 이득이 크고 이미 인지된 중장기 태스크다. 현재 diff에서 새로 도입된 즉시 조치 필요 아키텍처 결함은 없다.

### 위험도

MEDIUM

(레이어 의존 역전 W-3과 SRP 압박 W-4가 DEFERRED 상태로 잔존하므로 MEDIUM 유지. 이전 라운드 신규 WARNING 2건은 해소됨. 현재 diff 내에서 새로운 CRITICAL/WARNING 미조치 항목 없음.)

STATUS=success ISSUES=0
