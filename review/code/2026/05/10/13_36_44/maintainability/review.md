### 발견사항

---

**[CRITICAL]** spec §5.3 예시의 `output.error.code` 값이 실제 코드와 불일치
- 위치: `spec/4-nodes/2-flow/1-workflow.md` §5.3, 라인 ~208
- 상세: spec 예시 JSON은 "Workflow not found" 메시지에 대해 `"code": "SUB_WORKFLOW_FAILED"`를 보여주지만, `mapSubWorkflowError`는 이 메시지를 `SUB_WORKFLOW_NOT_FOUND`로 매핑한다. 예시를 읽는 사람이 잘못된 코드 값을 참조할 위험이 있다.
- 제안: spec §5.3 예시의 code 값을 `"SUB_WORKFLOW_NOT_FOUND"`로 정정한다.

---

**[WARNING]** `mapSubWorkflowError`가 executor 에러 메시지 문자열에 fragile하게 의존
- 위치: `workflow.handler.ts:196–218`
- 상세: executor가 던지는 `Error.message` 문자열을 `toLowerCase().includes()` 패턴 매칭으로 분류한다. executor가 메시지를 변경하면 분류가 조용히 틀어지며 컴파일 오류도 없다. JSDoc에 "until the executor exposes a structured error type"이라 인정하고 있으나, 그 시점이 명시되지 않아 임시 코드가 영구화될 위험이 있다.
- 제안: TODO 주석에 "executor가 구조화 에러를 노출하면 이 함수를 제거" 조건을 구체적으로 명시하거나, executor 측에 `instanceof` 판별 가능한 에러 클래스(`WorkflowNotFoundError` 등)를 도입하는 추적 이슈를 남긴다.

---

**[WARNING]** 테스트 이름과 코드 주석에 작업 식별자(D-1, A-2, A-3) 잔류
- 위치: `workflow.handler.spec.ts` 라인 ~127, 225, 391 / `workflow.handler.ts` 라인 ~136
- 상세: `"(D-1)"`, `"(A-2)"`, `"A-3 code mapping"`, `"// D-1 —"` 등이 테스트 설명과 코드 주석에 포함되어 있다. 이 식별자들은 plan 문서 내부 추적 코드로, 해당 plan이 `complete/`로 이동하거나 몇 달이 지나면 외부 컨텍스트 없이 의미를 파악할 수 없다.
- 제안: 식별자 대신 동작 설명으로 대체한다. 예: `"wraps sync output under output.result for uniform downstream access"`.

---

**[WARNING]** `workflowNodeOutputSchema`에 더 이상 방출되지 않는 `meta.status` 필드 잔류
- 위치: `workflow.schema.ts` `workflowNodeOutputSchema` 정의
- 상세: 핸들러가 `meta.status: 'started'` 대신 top-level `status: 'started'`를 방출하도록 변경되었지만, 스키마의 `meta` 오브젝트에 `status: z.string().optional()`이 여전히 남아 있다. 스키마만 읽는 개발자는 `meta.status`를 유효한 출력 필드로 오해할 수 있다.
- 제안: `workflowNodeOutputSchema`의 `meta` 정의에서 `status` 필드를 제거하거나, 제거 이유를 주석으로 명시한다.

---

**[WARNING]** 크로스파일 참조 주석이 함수 이동 시 stale해질 위험
- 위치: `error-codes.ts` 라인 ~40: `// See \`workflow.handler.ts#mapSubWorkflowError\`.`
- 상세: 파일명과 함수명을 문자열로 참조하는 주석은 함수가 이동·rename될 때 자동으로 갱신되지 않는다.
- 제안: 주석을 기능 설명 중심으로 바꾼다. 예: `// Code is selected by mapSubWorkflowError() based on the executor's thrown message.`

---

**[INFO]** `mapSubWorkflowError`를 테스트 목적으로 export — 설계 냄새
- 위치: `workflow.handler.ts` 말미, JSDoc
- 상세: 함수가 `private buildSubWorkflowError`의 내부 로직에서 파생된 것임에도 테스트를 위해 모듈 공개 인터페이스에 노출된다. JSDoc에 "Exported for unit testing"이라 명시하고 있으나, 이 패턴은 `WorkflowHandler` 클래스의 public surface를 오염시킨다.
- 제안: 파급 효과가 크지 않다면 `error-mapping.ts` 등 별도 파일로 분리하거나, 클래스 외부에 두되 `/* @internal */` JSDoc 태그로 비공개 의도를 표시한다.

---

**[INFO]** 테스트 파일 내 역사적 주석 잔류
- 위치: `workflow.handler.spec.ts` 라인 ~234: `"// The previous \`meta.status: 'started'\` is no longer emitted."`
- 상세: 구현이 안정화된 이후에는 이 주석이 "과거에 어떤 버그가 있었다"는 노이즈로 전락한다. 현재 상태를 검증하는 단언(assertion)만으로 충분하다.
- 제안: 주석을 제거하고 `expect(...meta).toBeUndefined()`로 의미를 자체 설명하게 둔다.

---

**[INFO]** error-codes.spec.ts의 위상 참조 주석
- 위치: `error-codes.spec.ts` 라인 ~28: `// Sub-workflow specific codes added in Phase 1 A-3.`
- 상세: plan 단계 참조 주석. Phase 1이 완료로 이동하면 의미가 없어진다.
- 제안: 제거하거나 `// Required by workflow node error mapping (see workflow.handler.ts)`로 대체한다.

---

### 요약

이번 변경은 전반적으로 명확한 목적(에러 코드 세분화, output 구조 표준화, 스키마 키 통일)을 가지고 있으며, 함수 분리·타입 강화·테스트 커버리지 확장 모두 양호하다. 가장 주의할 문제는 spec §5.3 예시가 `SUB_WORKFLOW_FAILED`를 표시하지만 코드는 `SUB_WORKFLOW_NOT_FOUND`를 반환하는 실제 불일치(CRITICAL)이며, 그 외 `mapSubWorkflowError`의 문자열 패턴 의존성과 작업 식별자(D-1, A-2, A-3) 주석 잔류는 장기 유지보수 시 혼선을 야기할 수 있는 WARNING 수준 항목이다.

### 위험도

**MEDIUM** — 기능 동작 자체는 안정적이나, spec 예시 오류와 fragile 문자열 패턴 매칭이 방치될 경우 향후 디버깅 비용이 높아질 수 있다.