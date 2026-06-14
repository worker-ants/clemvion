# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] FormValidationError JSDoc — 클래스 레벨 문서 충실
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (추가된 FormValidationError 클래스)
- 상세: `FormValidationError` 클래스에 동작 계약(FIRST 오류, client-safe message), 오류 surface 경로(EIA 400, WS ack), 보안 정책(필드 값 미포함)이 JSDoc 블록에 명확히 기술되어 있다. `field` 프로퍼티에도 인라인 JSDoc(`/** 오류가 발생한 field 명 — EIA details[].field. */`)이 있다.
- 제안: 현재 수준으로 적절. 추가 개선 불필요.

### [INFO] assertFormSubmissionValid / coerceFormSubmission / coerceFormValue — private 메서드 문서
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (신규 추가 private 메서드 3종)
- 상세: 세 private 메서드 모두 JSDoc 블록을 보유한다.
  - `assertFormSubmissionValid`: spec 참조(form §4·§6.2 / EIA §5.1), 동작(FIRST 오류 throw), 방어적 통과 조건(노드/field 미존재) 기술.
  - `coerceFormSubmission`: 정규화 대상 타입(number/boolean/배열/null)과 변환 규칙 기술.
  - `coerceFormValue`: 단일 값 변환, 객체 JSON 직렬화 이유(no-base-to-string) 명시.
- 제안: private 메서드임을 감안하면 충분한 수준. `coerceFormValue`의 경우 배열 콤마 join이 `validateFormSubmission` 측의 파싱 가정과 일치하는지에 대한 언급이 있으면 향후 유지보수 시 혼동을 줄일 수 있다(INFO 수준, 강제 사항 아님).

### [WARNING] dispatchContinuation JSDoc — FormValidationError 매핑 미반영
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `dispatchContinuation` 메서드 JSDoc 블록
- 상세: `dispatchContinuation`의 JSDoc 블록은 `InvalidExecutionStateError → 409 STATE_MISMATCH`, `MessageTooLongError → 400 MESSAGE_TOO_LONG`을 명시하고 있으나, 이번 변경으로 추가된 `FormValidationError → 400 VALIDATION_ERROR` 매핑이 JSDoc 본문에 반영되지 않았다. 메서드 본문 내 인라인 주석은 존재하지만 공식 JSDoc 블록과 실제 동작 사이에 불일치가 생겼다. 이 메서드는 에러 매핑 계약을 열거하는 공식 문서 지점으로 기능하므로 불완전한 목록은 유지보수 시 혼동을 유발한다.
- 제안: JSDoc의 에러 매핑 기술 단락에 다음을 추가한다.
  ```
   * FormValidationError (spec form §4·§6.2 / EIA §5.1): submit_form field 검증 실패 →
   * 400 VALIDATION_ERROR + details[{field, message, code:'INVALID_FIELD'}].
  ```

### [WARNING] executions.controller.ts continueExecution — @ApiBadRequestResponse 데코레이터 누락
- 위치: `codebase/backend/src/modules/executions/executions.controller.ts` `continueExecution` 엔드포인트 (`POST :id/continue`)
- 상세: `FormValidationError` 처리(400 VALIDATION_ERROR) 분기가 추가되었으나, Swagger 데코레이터 `@ApiBadRequestResponse`가 없다. 현재 데코레이터는 `@ApiUnprocessableEntityResponse`(422 INVALID_STATE)만 있다. Swagger UI 및 자동 생성 OpenAPI spec에 400 응답이 노출되지 않아 API 소비자가 이 응답 형식을 문서에서 인지하지 못한다. `ApiBadRequestResponse`는 이미 파일 상단에서 임포트되어 있으므로 추가 임포트 없이 적용 가능하다.
- 제안: 엔드포인트에 다음을 추가한다.
  ```typescript
  @ApiBadRequestResponse({
    description: 'VALIDATION_ERROR (form field 검증 실패 — details[{field,message,code}])',
  })
  ```

### [INFO] interaction.controller.ts @ApiBadRequestResponse — 에러 코드 업데이트 완료
- 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` `@ApiBadRequestResponse` 데코레이터
- 상세: 기존 `'VALIDATION_FAILED (form field)'`에서 `'VALIDATION_ERROR (form field — details[]) / INVALID_COMMAND (필수 필드 누락).'`으로 변경되었다. `VALIDATION_ERROR`는 `FormValidationError.code`와 정확히 일치하고 `details[]`도 명시된다. 정상적인 문서 동기화로 볼 수 있다.
- 제안: 현재 변경은 올바른 동기화. 단, `details[]` 내부 구조(`{field, message, code:'INVALID_FIELD'}`)를 description에 더 명시적으로 기술하면 API 소비자가 파싱 코드 작성 시 참조 가치가 높아진다(INFO 수준 제안).

### [INFO] 테스트 파일 인라인 주석 — 의도 기술 수준 적절
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` mockNodeRepo.findOneBy 추가 부분, `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` 신규 테스트 케이스
- 상세:
  - spec 파일의 `mockNodeRepo.findOneBy` 추가 부분은 목적(form 검증 skip 기본값, override 패턴)을 주석으로 명확히 설명한다.
  - `interaction.service.spec.ts`의 신규 테스트 케이스는 test description이 검증 대상(`engine FormValidationError → 400 VALIDATION_ERROR + details[{field,message,code}]`)을 충분히 담고 있다.
- 제안: 현재 수준으로 적절.

### [INFO] e2e 테스트 — describe 레벨 JSDoc 커버 범위 미반영
- 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` describe 블록 상단 JSDoc
- 상세: 신규 e2e 케이스 G에 설명 주석("publisher 측 동기 검증이 node lookup 후 발생하므로 node_execution(WAITING) row가 필요하다")이 포함되어 있어 왜 DB 직접 삽입이 필요한지 이해를 돕는다. 그러나 describe 블록 레벨 JSDoc의 커버 범위 목록에 케이스 G(form validation)가 반영되지 않았다.
- 제안: describe 블록 레벨 JSDoc의 커버 범위 목록에 "5. form field 검증 실패 시 publisher 측 동기 400 VALIDATION_ERROR (케이스 G)" 항목 추가를 검토한다(INFO, 강제 사항 아님).

### [INFO] CHANGELOG 업데이트 필요성 — 프로젝트에 CHANGELOG.md 존재 확인됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/CHANGELOG.md`
- 상세: 이번 변경은 EIA의 `submit_form` 명령에 서버 측 field 검증을 추가하고 새 에러 코드(`VALIDATION_ERROR`)와 응답 구조(`details[]`)를 도입한다. 이는 API 계약 변경으로 외부 통합자가 응답 처리 코드를 갱신해야 할 수 있다. 프로젝트 루트에 `CHANGELOG.md`가 존재하는 것이 확인되었으므로 해당 항목의 추가를 검토해야 한다.
- 제안: "EIA submit_form: 서버 측 form field 검증 추가(필수 필드 / type / length / 선택지), 실패 시 `400 VALIDATION_ERROR` + `details[{field, message, code:'INVALID_FIELD'}]` 반환. execution은 waiting_for_input 유지(재제출 가능)." 항목을 CHANGELOG에 기록한다.

### [INFO] 환경변수·설정 변경 없음
- 상세: 이번 변경은 새 환경변수나 설정 옵션을 도입하지 않는다. `extractFormFields`, `validateFormSubmission`은 기존 `chat-channel/shared/form-mode` 모듈 재사용이므로 별도 설정 문서화 불필요.

### [INFO] Swagger 응답 body 스키마 미선언 — details 배열 타입
- 위치: `codebase/backend/src/modules/executions/executions.controller.ts`, `codebase/backend/src/modules/external-interaction/interaction.controller.ts`
- 상세: 두 컨트롤러 모두 `@ApiBadRequestResponse`의 `description`만 제공하고, `details[]` 배열의 타입을 Swagger DTO로 선언하지 않아 OpenAPI spec에서 응답 body 스키마를 자동 생성할 수 없다. API 소비자는 description 텍스트를 통해서만 구조를 파악해야 한다.
- 제안: 장기적으로 `ValidationErrorDetailsDto` 등의 Swagger DTO를 정의해 `@ApiProperty`로 타입 힌트를 제공하는 것이 권장되나, 현 단계에서 강제 사항은 아니다.

---

## 요약

전반적인 문서화 수준은 양호하다. `FormValidationError` 클래스와 신규 private 메서드(`assertFormSubmissionValid`, `coerceFormSubmission`, `coerceFormValue`)는 JSDoc이 적절히 작성되어 있고, 테스트 파일의 인라인 주석도 의도를 충분히 설명한다. 주의가 필요한 지점은 두 가지다. 첫째, `executions.controller.ts`의 `continueExecution` 엔드포인트에 `@ApiBadRequestResponse` 데코레이터가 누락되어 Swagger 문서에 400 VALIDATION_ERROR 응답이 표시되지 않는다. 둘째, `interaction.service.ts`의 `dispatchContinuation` JSDoc 블록이 새로 추가된 `FormValidationError` 매핑을 반영하지 않아 메서드의 공식 에러 계약 기술이 불완전하다. 두 항목 모두 기능적 동작에는 영향 없으나 API 소비자와 유지보수 개발자 경험에 직결되는 문서 갭이다. 그 외 CHANGELOG 갱신, e2e describe 커버 범위 업데이트, Swagger 응답 body 스키마 선언은 선택적 개선 사항이다.

## 위험도

LOW
