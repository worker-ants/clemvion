# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 1: CHANGELOG.md

- **[INFO]** 신규 `EIA submit_form 서버 측 field 검증` 섹션 추가
  - 위치: diff +34~+53
  - 상세: 이번 기능 변경에 상응하는 CHANGELOG 항목 추가. 응답 shape, first-error 정책, waiting 상태 유지, WS ack 매핑까지 포함. 범위 내 적합한 변경.
  - 제안: 없음.

---

### 파일 2: execution-engine.service.spec.ts

- **[INFO]** `mockNodeRepo.findOneBy` mock 추가 (기본값 null)
  - 위치: diff +85~+88
  - 상세: `assertFormSubmissionValid`가 `nodeRepository.findOneBy`를 호출하므로 기존 mock에 없던 메서드를 추가한 것. 기본값 `null`로 기존 form 검증 무관 테스트의 동작을 유지하는 방어적 처리. 범위 내 필수 변경.
  - 제안: 없음.

- **[INFO]** `assertFormSubmissionValid / coerceFormValue (W-1)` 단위 테스트 describe 블록 추가
  - 위치: diff +96~+384 (대규모 테스트 추가)
  - 상세: 이전 리뷰 사이클(20_22_14) W-1 RESOLUTION 조치로 필수 추가된 테스트. 검증 로직 핵심 경로(required 누락, email 형식 오류, 유효 입력, null nodeExec, null node, 다양한 coerceFormValue 타입 분기) 커버. 범위 내 필수 변경.
  - 제안: 없음.

---

### 파일 3: execution-engine.service.ts

- **[INFO]** `FormValidationError`, `extractFormFields`, `validateFormSubmission` 임포트 추가
  - 위치: diff +27~+33
  - 상세: 신규 `assertFormSubmissionValid` 메서드에서 직접 사용되는 임포트. 불필요한 임포트 없음.
  - 제안: 없음.

- **[INFO]** `assertFormSubmissionValid`, `coerceFormSubmission`, `coerceFormValue` 메서드 추가 및 `continueExecution` 내 호출 추가
  - 위치: diff +4299~+4379
  - 상세: publisher 측 동기 form field 검증 핵심 구현. `coerceFormSubmission`/`coerceFormValue`는 `validateFormSubmission` 입력 타입 정규화를 위한 보조 메서드로 `assertFormSubmissionValid` 없이는 호출되지 않는다. 범위 내 신규 기능이며 over-engineering 아님.
  - 제안: 없음.

---

### 파일 4: workflow-errors.ts

- **[INFO]** `ValidationDetail` 인터페이스 및 `FormValidationError` 클래스 추가
  - 위치: diff +381~+417
  - 상세: `ExecutionError` 계층과 일관된 패턴으로 신규 typed error 추가. `toHttpDetails()` 메서드로 두 진입점 간 응답 shape SoT 일원화(W-6 RESOLUTION 조치). 범위 내 필수 변경.
  - 제안: 없음.

- **[WARNING]** `FormValidationError` 클래스 설명 JSDoc 블록이 `ValidationDetail` 인터페이스 선언 전에 배치됨 (주석-선언 순서 불일치)
  - 위치: diff +371~+390 (`workflow-errors.ts`)
  - 상세: diff에서 `/** FormValidationError 설명 ... */` JSDoc 블록(+372~+381)이 먼저 나타나고, 그 다음에 `/** ValidationDetail 설명 ... */` JSDoc 블록(+381~+390)과 `ValidationDetail` 인터페이스, 그리고 마지막에 `FormValidationError` 클래스 선언이 온다. 첫 번째 JSDoc 블록은 `ValidationDetail` 인터페이스 직전에 위치하게 되어 IDE/TypeDoc이 해당 블록을 `FormValidationError` 클래스가 아닌 `ValidationDetail` 인터페이스의 문서로 매핑할 수 있다. 기능에는 영향 없으나 문서 도구 오작동 가능성이 있음.
  - 제안: `ValidationDetail` 인터페이스와 그 JSDoc을 `FormValidationError` JSDoc 및 클래스 선언보다 위로 이동하여 JSDoc이 직후 선언에 붙도록 배치 순서를 정리한다.

---

### 파일 5: executions.controller.spec.ts

- **[INFO]** `BadRequestException`, `FormValidationError` 임포트 추가 및 W-2 테스트 케이스 추가
  - 위치: diff +1~+12, +115~+151
  - 상세: 이전 리뷰 사이클 W-2 RESOLUTION 조치. `FormValidationError → 400 BadRequestException + VALIDATION_ERROR + details[]` body 검증. 범위 내 필수 추가.
  - 제안: 없음.

---

### 파일 6: executions.controller.ts

- **[INFO]** `BadRequestException`, `FormValidationError`, `ErrorCode` 임포트 추가, `@ApiBadRequestResponse` 데코레이터 추가, `continueExecution` 핸들러에 오류 매핑 추가
  - 위치: diff +9, +37~+43, +152~+157, +177~+191
  - 상세: `FormValidationError → 400 VALIDATION_ERROR + details[]` 매핑, Swagger 데코레이터 추가(W-10), ErrorCode enum 참조(W-5). 범위 내 필수 변경.
  - 제안: 없음.

---

### 파일 7: interaction.controller.ts

- **[INFO]** `@ApiBadRequestResponse` description 문자열 수정 (`VALIDATION_FAILED` → `VALIDATION_ERROR`)
  - 위치: diff +67
  - 상세: 기존 description이 실제 에러 코드와 불일치했던 것을 정합하는 단일 라인 수정. 범위 내 정합 수정.
  - 제안: 없음.

---

### 파일 8: interaction.service.spec.ts

- **[INFO]** `FormValidationError` 임포트 추가 및 테스트 케이스 1건 추가
  - 위치: diff +15~+18, +188~+222
  - 상세: EIA 경로에서 `FormValidationError → 400 VALIDATION_ERROR + details[{field,message,code}]` 변환 검증. 범위 내 필수 추가.
  - 제안: 없음.

---

### 파일 9: interaction.service.ts

- **[INFO]** `FormValidationError`, `ValidationDetail` 임포트 추가, `dispatchContinuation` 처리 추가, JSDoc 업데이트, `badRequest` 함수 시그니처 확장
  - 위치: diff +16~+20, +279~+285, +302~+307, +328~+334
  - 상세: optional `details` 파라미터 추가(W-7), `FormValidationError` 분기(범위 내 핵심), JSDoc 업데이트(W-9). 기존 호출부 하위 호환 유지. 범위 내 최소 변경.
  - 제안: 없음.

---

### 파일 10: workflow-errors.spec.ts

- **[INFO]** `FormValidationError` describe 블록 추가
  - 위치: diff 전체
  - 상세: `FormValidationError.code`, `field`, `name`, `toHttpDetails()` 반환값 직접 단위 테스트. 이전 리뷰 권고사항(I-15 등) 반영. 범위 내 필수 추가.
  - 제안: 없음.

---

### 파일 11: websocket.gateway.spec.ts

- **[INFO]** W-12 테스트 케이스 추가
  - 위치: diff +742~+773
  - 상세: `FormValidationError → ack { errorCode: VALIDATION_ERROR }` WS 게이트웨이 회귀 가드. `buildContinuationErrorAck` 리팩터 시 silent regression 방지 목적. 범위 내 필수 변경.
  - 제안: 없음.

---

### 파일 12: error-codes.ts

- **[INFO]** `VALIDATION_ERROR` enum 항목 추가
  - 위치: diff +782~+786
  - 상세: W-5 RESOLUTION 조치. 기존 `ErrorCode` enum 단일 SoT 패턴 준수. 범위 내 필수 변경.
  - 제안: 없음.

---

### 파일 13: external-interaction.e2e-spec.ts

- **[INFO]** e2e 테스트 케이스 G 추가 (describe 커버리지 주석 포함)
  - 위치: diff +14~+15, +250~+294
  - 상세: 실 DB 경유 publisher 측 동기 검증 경로를 end-to-end로 커버. 기존 케이스 F와 구조적으로 동일 패턴. nodeId 역할 주석(I-16) 및 describe 커버리지 업데이트(I-13) 포함. 범위 내 필수 추가.
  - 제안: 없음.

---

### 파일 14~36 (plan/ 및 review/ 산출물)

- **[INFO]** plan/in-progress/spec-sync-form-gaps.md 진척 갱신 및 review/code/ 하위 산출물 파일 생성
  - 상세: plan 파일 체크박스 갱신은 구현 완료 상태 반영을 위한 범위 내 변경. review/ 산출물(RESOLUTION.md, SUMMARY.md, 관점별 md, _resolution_log.md 등)은 CLAUDE.md 규약에 따른 정상 프로세스 산출물. 모두 범위 내.
  - 제안: 없음.

---

## 요약

13개 핵심 소스 파일 전체가 `submit_form` publisher 측 동기 form field 검증이라는 단일 목적으로 집중되어 있다. 이전 리뷰 사이클(20_22_14)의 모든 RESOLUTION 조치(W-1, W-2, W-5~W-7, W-9~W-10, W-12, I-12~I-14, I-16)가 충실히 반영되었다. 의도된 범위를 벗어나는 수정(무관한 리팩토링, 불필요한 기능 확장, 포맷팅 혼입, 무관한 파일 수정)은 발견되지 않았다. 단 `workflow-errors.ts`에서 `FormValidationError` 클래스 JSDoc 블록이 `ValidationDetail` 인터페이스 선언 직전에 배치되어 IDE/TypeDoc이 해당 JSDoc을 인터페이스에 잘못 매핑할 수 있는 레이아웃 불일치가 1건 발견되었다 (WARNING — 기능 영향 없음).

## 위험도

LOW

STATUS=success ISSUES=1
