# 요구사항(Requirement) 리뷰

## 발견사항

### **[WARNING]** spec §6.2 ValidationRule `min`/`max`/`pattern` 검증 미구현 — 부분적 spec 미충족
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `extractFormFields` / `validateFormSubmission` / `FormModalField` 타입
- 상세: spec form §6.2 는 `validation.minLength`/`maxLength`/`min`/`max`/`pattern` 위반 모두를 "클라이언트 에러 응답 → 폼 재표시" 처리 대상으로 명시한다. 그런데 `extractFormFields`(`form-mode.ts:88-104`)는 `validation` 객체에서 `minLength`·`maxLength`만 추출하고 `min`·`max`·`pattern`은 추출하지 않는다. `FormModalField` 타입(`chat-channel/types.ts:231-242`)에도 `min`/`max`/`pattern` 필드가 없다. 결과적으로 `number` 타입 필드에 `validation.min`/`max` 가 설정돼 있어도, 또는 임의 필드에 `pattern` 이 설정돼 있어도 서버 측 검증이 전혀 이루어지지 않는다. 해당 값이 범위를 벗어나거나 패턴을 위반해도 `VALIDATION_ERROR` 없이 그대로 통과해 `waiting_for_input` 이 재개된다.
- 제안: `extractFormFields`에서 `validation.min`·`validation.max`·`validation.pattern`을 추출하고, `FormModalField` 타입에 필드를 추가한 뒤 `validateFormSubmission` 에서 `number` 타입의 범위 제한과 `pattern` 정규식 검증 분기를 추가한다. 단, 이 변경은 `chat-channel/shared/form-mode.ts` 파일 자체의 수정이므로 현 PR 범위 외 파일에 영향을 주며, 별도 plan 태스크로 추적할 수도 있다. 최소한 plan 항목에 "min/max/pattern 미구현" 을 미완성 항목으로 명시해야 한다.

### **[INFO]** spec §6.2 `type:'file'` MIME/크기/개수 검증 — 명시적 미구현(Planned), plan 추적 완료
- 위치: `execution-engine.service.ts` `assertFormSubmissionValid` JSDoc ("file MIME/size/count 검증은 Planned — 본 단계 미적용"), `plan/in-progress/spec-sync-form-gaps.md` 미완성 항목
- 상세: spec §6.2 의 `type:'file'` MIME/크기/개수 초과 조건은 현 PR 에서 의도적으로 미구현으로 남겨두었다 (파일검증 cluster 로 분리). 코드와 plan 에 명시적으로 문서화되어 있으므로 요구사항 누락 버그가 아니라 범위 한정 결정이다. 단, 현재 file 타입 필드가 `required: true` 일 때 빈 배열 `[]`은 `coerceFormValue`에서 `''`(빈 문자열)로 변환되어 required 검증이 동작한다.

### **[INFO]** `validateFormSubmission` 인자 순서 — 올바름 확인
- 위치: `execution-engine.service.ts:4335` — `validateFormSubmission(ExecutionEngineService.coerceFormSubmission(formData), fields)`
- 상세: `form-mode.ts`의 `validateFormSubmission(fields: Record<string, string>, defs: FormModalField[])` 시그니처에서 첫 번째 인자가 제출 데이터 맵, 두 번째가 필드 정의 배열이다. 코드에서 `coerceFormSubmission(formData)` (제출 데이터 맵) → 1번, `extractFormFields(node.config)` 결과인 `fields` (필드 정의 배열) → 2번으로 올바르게 호출된다.

### **[INFO]** `checkbox` 타입 required 검증 동작 — 암묵적 처리, 선택지 검증은 없음
- 위치: `form-mode.ts` `validateFormSubmission` — `checkbox` 타입 분기 없음
- 상세: `checkbox` 타입에 대해 사용자가 아무것도 선택하지 않으면 빈 배열 `[]`이 전달되고 `coerceFormValue`에서 `''`(빈 문자열)이 되므로 `required: true` 검증은 올바르게 동작한다. 그러나 비어있지 않은 `checkbox` 값 배열은 콤마 join 후 `select`/`radio` 선택지 검증 분기를 타지 않아 옵션 외 값도 서버에서 통과된다. spec §6.2에 checkbox 선택지 검증이 명시되어 있지 않고 `form-mode.ts`의 기존 동작이므로 현 PR 범위 밖이다.

### **[INFO]** e2e 테스트 G — body `nodeId`는 guard 확인용이고 실제 field lookup은 node_execution row 경유
- 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` — 케이스 G 주석
- 상세: e2e 주석("I-16: nodeId body는 assertNodeId 유무 검사만 수행 — 실제 field lookup은 node_execution row의 nodeId가 결정한다")이 설계 의도를 올바르게 기술한다. `assertFormSubmissionValid`는 `resolveWaitingNodeExecutionId` → `nodeExec.nodeId`를 통해 form 노드를 찾으므로 body의 `nodeId`가 form 노드와 일치하지 않아도 lookup에 영향이 없다. 이 동작은 의도적이나, spec §5.1의 `submit_form`에서 `nodeId` 필드의 역할이 현재 waiting 노드와의 일치 여부를 검증하는지 명시되어 있지 않아 향후 오해 여지가 있다.

---

## 요약

이번 변경은 `continueExecution` publisher chokepoint에 form 제출 field-level 검증(`FormValidationError`, `assertFormSubmissionValid`, `coerceFormSubmission/Value`)을 추가하고, 두 진입점(EIA REST, WS)에서 일관되게 `400 VALIDATION_ERROR + details[{field,message,code:'INVALID_FIELD'}]`로 변환하는 구조다. plan이 명시한 범위(필수 필드·email 형식·number 형식·minLength/maxLength·select/radio 선택지)는 올바르게 구현되었으며, 검증 실패 시 publish 전에 throw되어 execution이 `waiting_for_input`을 유지(재제출 가능)하는 핵심 요구사항(spec form §4 step5·§6.2 / EIA §5.1 EIA-IN-10 / EIA-RL-03)이 충족된다. 그러나 spec §6.2가 열거하는 `validation.min`/`max`(숫자 범위 제한)·`pattern`(정규식) 위반 검증은 `extractFormFields`·`FormModalField`·`validateFormSubmission` 수준에서 지원되지 않아 해당 규칙이 있는 필드는 서버 측 검증을 우회한다. 이 gap은 plan에 미완성 항목으로 명시되어 있지 않으므로 WARNING으로 분류한다. 나머지 미구현 항목(file MIME/크기/개수 검증, ValidationPreset)은 plan에 명시적으로 남겨둔 범위 외 항목(INFO)이다.

## 위험도

MEDIUM
