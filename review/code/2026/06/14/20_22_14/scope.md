# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 1: execution-engine.service.spec.ts

- **[INFO]** `mockNodeRepo`에 `findOneBy` mock 추가
  - 위치: diff +35~+38 (lines 306~309)
  - 상세: `assertFormSubmissionValid`가 `nodeRepository.findOneBy`를 호출하므로, 기존 mock에 없던 메서드를 추가한 것. 기본값 `null`로 form 검증 무관 테스트의 기존 동작(form field 검증 skip)을 유지하는 방어적 처리. 범위 내 필수 변경.
  - 제안: 없음.

---

### 파일 2: execution-engine.service.ts

- **[INFO]** `FormValidationError`, `extractFormFields`, `validateFormSubmission` 임포트 추가
  - 위치: diff +7~+11
  - 상세: 새로 추가된 `assertFormSubmissionValid`에서 직접 사용되는 임포트. 범위 내 필수 변경.
  - 제안: 없음.

- **[INFO]** `assertFormSubmissionValid`, `coerceFormSubmission`, `coerceFormValue` 메서드 추가
  - 위치: diff +4300~+4380
  - 상세: form 제출 publisher 측 동기 검증 기능 핵심 구현. 범위 내 신규 기능. `coerceFormSubmission`/`coerceFormValue`는 `validateFormSubmission`의 입력 타입(`Record<string,string>`) 정규화를 위한 보조 메서드로, `assertFormSubmissionValid` 없이는 호출되지 않는다. 분리는 적절하며 over-engineering 아님.
  - 제안: 없음.

---

### 파일 3: workflow-errors.ts

- **[INFO]** `FormValidationError` 클래스 추가
  - 위치: diff +224~+248
  - 상세: `ExecutionError` 계층에 속하는 typed error. 이 파일의 기존 다른 클래스(`MessageTooLongError` 등)와 일관된 패턴. 범위 내 필수 변경.
  - 제안: 없음.

---

### 파일 4: executions.controller.ts

- **[INFO]** `BadRequestException`, `FormValidationError` 임포트 추가 및 `continueExecution` 핸들러에 검증 오류 처리 추가
  - 위치: diff +9, +39~+42, +172~+190
  - 상세: 기존 REST 엔드포인트(`POST /executions/:id/continue`)에서 `FormValidationError`를 400으로 매핑하는 처리. EIA 경로(`interaction.service.ts`)와 대칭적 처리로 범위 내 필수 변경.
  - 제안: 없음.

---

### 파일 5: interaction.controller.ts

- **[INFO]** `@ApiBadRequestResponse` description 문자열 수정 (`VALIDATION_FAILED` → `VALIDATION_ERROR`)
  - 위치: diff +67
  - 상세: 기존 문자열 `VALIDATION_FAILED`는 실제 error code(`VALIDATION_ERROR`)와 불일치했다. 이번 구현으로 `VALIDATION_ERROR`가 확정 코드가 되었으므로 Swagger 설명을 일치시킨 것. 의미 있는 정합성 수정이며 순수 문서 수정에 해당.
  - 제안: 없음.

---

### 파일 6: interaction.service.spec.ts

- **[INFO]** `FormValidationError` 임포트 추가 및 `submit_form: engine FormValidationError → 400 VALIDATION_ERROR` 테스트 케이스 추가
  - 위치: diff +15~+18, +187~+222
  - 상세: 신규 오류 경로에 대응하는 단위 테스트. 범위 내 필수 변경. 기존 테스트들과 시나리오 중복 없음.
  - 제안: 없음.

---

### 파일 7: interaction.service.ts

- **[INFO]** `FormValidationError` 임포트 추가, `dispatchContinuation`에 처리 추가, `badRequest` 함수 시그니처 확장
  - 위치: diff +16~+18, +294~+306, +309~+316
  - 상세: `badRequest`에 `details?: unknown` 파라미터를 추가해 `FormValidationError` 응답의 `details[]` 배열을 구성. 기존 호출부(`MESSAGE_TOO_LONG` 처리)는 `details` 인자 없이 호출하므로 기존 동작 동일. 함수 시그니처 확장은 현재 작업의 직접적 필요에 의한 최소 변경.
  - 제안: 없음.

---

### 파일 8: external-interaction.e2e-spec.ts

- **[INFO]** 케이스 G (submit_form 필수 field 누락 → 400 VALIDATION_ERROR) e2e 테스트 추가
  - 위치: diff +248~+293
  - 상세: form node + node_execution row를 DB에 직접 삽입해 publisher 측 동기 검증 경로 전체를 end-to-end로 검증. 기존 케이스 F(MESSAGE_TOO_LONG e2e)와 구조적으로 일치하는 패턴. 범위 내 필수 추가.
  - 제안: 없음.

---

## 요약

8개 파일의 변경 모두 `submit_form` 제출 시 publisher 측 동기 form field 검증(`assertFormSubmissionValid`) 기능 구현 단일 목적으로 집중되어 있다. 신규 `FormValidationError` 에러 타입 추가, 엔진 서비스에 검증 로직 추가, 두 HTTP 진입점(EIA `InteractionService` + 기존 `ExecutionsController`)에서 해당 에러를 400으로 매핑, Swagger 설명 정합 수정, 단위·e2e 테스트 추가로 구성된다. 의도된 범위를 벗어나는 수정(무관한 리팩토링, 불필요한 기능 확장, 포맷팅 혼입)은 발견되지 않았다. `badRequest` 함수 시그니처 확장과 `coerceFormSubmission`/`coerceFormValue` 보조 메서드 분리는 현재 작업의 직접 요구에 의한 최소 변경이며 over-engineering이 아니다.

## 위험도

NONE
