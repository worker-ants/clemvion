# Requirement Review — EIA Form Validation

## 발견사항

### **[INFO]** `validateFormSubmission` 파라미터 순서 확인 완료 (버그 없음)
- 위치: `execution-engine.service.ts` `assertFormSubmissionValid` 내부
- 상세: `validateFormSubmission(coerceFormSubmission(formData), fields)` — 첫 번째 인자가 `Record<string,string>`, 두 번째가 `FormModalField[]` 로, `form-mode.ts` 의 시그니처 `(fields: Record<string, string>, defs: FormModalField[])` 와 일치한다. 버그 없음.

### **[INFO]** 검증 미커버 규칙: `pattern`, `min`/`max`(number), `file` MIME/size/count
- 위치: `form-mode.ts::validateFormSubmission`
- 상세: `validateFormSubmission` 은 `required`, `email` format, `number` format, `select`/`radio` options, `minLength`/`maxLength` 만 검증한다. spec form §6.2 에 나열된 나머지 규칙 (`validation.pattern`, `validation.min`/`max` for number type, file MIME·size·count) 은 현재 `validateFormSubmission` 이 구현하지 않는다. 그러나 `assertFormSubmissionValid` 의 JSDoc 에 "file MIME/size/count 검증은 Planned — 본 단계 미적용" 이라고 명시돼 있어 의도적 scope-out 이다.

### **[INFO]** `coerceFormValue` 빈 배열 처리 — spec form §1.5 과 일치
- 위치: `execution-engine.service.ts::coerceFormValue`
- 상세: `type: 'file'` 필드에서 빈 배열(`[]`)은 `''` 로 변환돼 required 검증에서 "필수 입력 항목입니다." 오류를 발생시킨다. spec form §1.5 에 "field 가 `required: true` 인데 빈 배열이면 §6.2 의 '필수 필드 미입력' 검증 실패 흐름" 이라고 명시되어 있어 동작이 spec 과 일치한다.

### **[INFO]** `assertFormSubmissionValid` 방어적 null 처리 확인
- 위치: `execution-engine.service.ts::assertFormSubmissionValid` (lines ~4468–4488)
- 상세: NodeExecution 이 없으면 `return`(통과), Node 가 없어도 `return`(통과), fields 가 없어도 `return`(통과) 으로 방어적 처리가 잘 되어 있다. 기존 non-form 테스트에서 `findOneBy: jest.fn().mockResolvedValue(null)` 기본값으로 검증 skip 이 유지되는 구조와 정합적이다.

### **[WARNING]** WS 게이트웨이의 `submit_form` 핸들러에 `FormValidationError` 명시적 테스트 케이스 부재
- 위치: `execution-engine.service.spec.ts` / `websocket.gateway.ts`
- 상세: `FormValidationError extends ExecutionError` 이므로 WS gateway 의 `instanceof ExecutionError` 분기에서 `{ errorCode: 'VALIDATION_ERROR', error: <message> }` 로 자동 표면화된다. spec JSDoc ("WS ack 는 평면 `errorCode='VALIDATION_ERROR'` 로 매핑") 이 구조적으로 올바르게 동작한다. 그러나 이번 변경에 WS ack shape 을 직접 assertion 하는 테스트가 없어 향후 `buildContinuationErrorAck` 리팩터 시 silent regression 위험이 있다.
- 제안: `websocket.gateway.spec.ts` 에 `continueExecution → FormValidationError → ack { errorCode: 'VALIDATION_ERROR' }` 케이스 추가 권장 (지금 당장 기능을 깨지 않으므로 WARNING).

### **[WARNING]** 두 진입점에서 `FormValidationError → 400` 매핑 로직 중복
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/executions/executions.controller.ts` (lines ~172–186) 및 `/Volumes/project/private/clemvion/codebase/backend/src/modules/external-interaction/interaction.service.ts` (lines ~295–315)
- 상세: 두 진입점이 각각 독립적으로 `FormValidationError → 400 VALIDATION_ERROR + details[]` 를 변환한다. 현재는 내용이 동일하므로 기능 문제는 없으나, 향후 `details` 스키마 변경 시 하나를 놓칠 위험이 있다.
- 제안: 공통 헬퍼 함수로 추출하거나 `FormValidationError` 에 `toHttpDetails()` 메서드 추가 고려 (현 기능 요구사항 충족에는 영향 없음).

### **[INFO]** spec fidelity — EIA-IN-10 충족 확인
- 위치: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` §3.2 EIA-IN-10 / §5.1
- 상세: EIA-IN-10 는 "`submit_form` 검증 실패는 execution 상태를 바꾸지 않고 `400 VALIDATION_ERROR` + `details[]`(`{field,message,code}` 배열) 반환 (waiting_for_input 유지, 재제출 가능)" 을 요구한다. 구현은 publisher 측 `assertFormSubmissionValid` 가 `continuationBus.publish` 전에 throw 하므로 execution DB 상태가 변경되지 않는다. 응답 shape `{ error: { code: 'VALIDATION_ERROR', message, details: [{ field, message, code: 'INVALID_FIELD' }] } }` 도 spec §5.1 예시와 일치한다.

### **[INFO]** spec fidelity — form spec §4·§6.2 검증 연계 확인
- 위치: `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/4-form.md` §4·§6.2
- 상세: spec form §4 step 5 에서 "서버가 유효성 검증 (필수 / type / validation / file MIME·size·count) — 검증 실패 → 에러 응답 → 폼 재표시 (waiting_for_input 유지, 재제출 가능)" 을 요구한다. 현 구현은 필수/type(email·number)/minLength·maxLength/select·radio options 를 커버하며 file MIME·size·count 는 Planned 로 scope-out 이 JSDoc 에 명시되어 있어 intentional gap 이다. 현재 scope 내 요구사항 충족.

---

## 요약

이번 변경은 Form 노드 제출 경로(EIA REST 및 WS 경로 공통)에 publisher 측 동기 필드 검증(`assertFormSubmissionValid`)을 추가하고, 검증 실패를 `FormValidationError`(코드 `VALIDATION_ERROR`) 로 표면화하는 기능을 구현했다. 핵심 요구사항인 EIA-IN-10 (`400 VALIDATION_ERROR + details[]` 반환, `waiting_for_input` 유지), spec form §6.2 (필수·type 형식 검증 실패 재제출), spec §5.1 에러 응답 shape 가 모두 충족된다. `coerceFormSubmission` 의 배열/null/boolean 정규화, 방어적 null 처리(node/nodeExec 미존재 시 skip), WS gateway 의 `ExecutionError` 계층 자동 처리가 올바르게 동작한다. 단위 테스트(spec.ts 기본값 추가, interaction.service.spec.ts 신규 케이스) 및 e2e 테스트(G)가 주요 경로를 커버한다. 경미한 이슈로는 WS ack 경로 직접 assertion 테스트 부재와 두 진입점의 에러 매핑 중복이 있으나, 현 시점 기능 요구사항에 영향을 주지 않는다.

## 위험도

LOW
