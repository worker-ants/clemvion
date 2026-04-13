## 문서화 리뷰 결과

### 발견사항

---

**[INFO]** `WorkflowsController.loadTriggerParameterSchema()` — JSDoc 누락
- 위치: `workflows.controller.ts` (private 메서드)
- 상세: `HooksService`와 `ScheduleRunnerService`에는 동일한 private 메서드에 JSDoc이 있으나, `WorkflowsController`의 `loadTriggerParameterSchema()`에는 없음. 세 곳에 같은 로직이 중복되는데 왜 서비스 레이어로 분리하지 않았는지 설명도 없음.
- 제안: JSDoc 추가 또는 공통 서비스로 추출 후 문서화

---

**[INFO]** `ScheduleRunnerService.resolveLimitedExpression()` — 인라인 주석 부재
- 위치: `schedule-runner.service.ts` `resolveLimitedExpression()`
- 상세: "제한 표현식"이 무엇을 의미하는지, 왜 `$node`, `$input`, `$var`를 금지하는지 이유가 코드 내에 없음. 스펙 문서(4-execution-engine.md)에는 설명이 있지만 코드에는 없어 유지보수 시 제약이 불명확함.
- 제안: 함수 상단에 `// $node/$input/$var are unavailable at schedule time — only $now and $schedule are safe` 형태의 주석 추가

---

**[INFO]** `expression-resolver.service.ts` `$params` 추가 — JSDoc 미반영
- 위치: `expression-resolver.service.ts` `buildExpressionContext()`
- 상세: `$params`가 `$input.parameters`의 alias임을 설명하는 주석이나 JSDoc이 없음. 향후 개발자가 `$params`의 출처를 파악하려면 테스트 코드나 스펙을 봐야 함.
- 제안: 함수 반환 객체 내 `$params` 키에 `// alias for $input.parameters — see spec/4-nodes/7-trigger-nodes.md` 주석 추가

---

**[INFO]** `trigger-configs.tsx` — 한국어 UI 텍스트에 대한 i18n 주석 없음
- 위치: `trigger-configs.tsx` 내 인라인 텍스트
- 상세: `"다운스트림 노드에서..."`, `schedules/page.tsx`의 `"워크플로우의 Manual Trigger 노드 파라미터에 매핑됩니다."` 등 하드코딩된 한국어 문자열이 있으나, i18n 미지원임을 나타내는 주석 없음. 프로젝트 규모가 커질 경우 문제가 될 수 있음.
- 제안: `// TODO: i18n` 또는 프로젝트 표준이 한국어 하드코딩임을 명시하는 주석

---

**[INFO]** `coerce-type.ts` — `CoercibleType` 익스포트 타입 JSDoc 없음
- 위치: `coerce-type.ts` 1~6행
- 상세: `CoercibleType`이 `trigger-parameter.types.ts`에서 임포트되어 공개 계약의 일부가 됨. 허용 값 목록이 명시적이나 "이 타입이 `type` 필드의 허용값이다"라는 설명이 없음.
- 제안: `/** Valid coercible types for trigger parameter schema definitions. */` JSDoc 추가

---

**[WARNING]** `spec/5-system/4-execution-engine.md` 섹션 6.1.1 — 구현과 불일치
- 위치: `spec/5-system/4-execution-engine.md` 추가된 섹션 6.1.1
- 상세: 스펙에는 `resolveTriggerParameters(workflow, rawValues)`로 시그니처를 기술하나, 실제 구현은 `resolveTriggerParameters(schema, rawSource)`임. `workflow` 객체를 받지 않고 이미 추출된 `schema`를 받음. 또한 "워크플로우 그래프에서 `manual_trigger` 노드를 찾아"라고 되어 있으나 실제로는 호출 측(컨트롤러/서비스)이 노드 조회를 담당하고 유틸은 schema만 처리함.
- 제안: 스펙의 `resolveTriggerParameters(workflow, rawValues)` → `resolveTriggerParameters(schema, rawSource)`로 수정, 노드 조회 책임이 호출 측에 있음을 명시

---

**[INFO]** `spec/5-system/4-execution-engine.md` 6.1.1 마지막 문장 오류
- 위치: 추가된 섹션 마지막 줄
- 상세: `"$input.parameters === $params === context.parameters"` — `context.parameters`는 실제 `ExecutionContext` 인터페이스에 없는 필드로 오해를 유발함.
- 제안: `context.parameters` 제거, `$input.parameters === $params` 관계만 명시

---

**[INFO]** `hooks.service.ts` — `WebhookInput` 타입이 익스포트되었으나 `hooks.service.spec.ts`에서 임포트하는데 공개 API 문서화 없음
- 위치: `hooks.service.ts` `WebhookInput` 인터페이스
- 상세: `hooks.service.spec.ts`에서 `import { HooksService, WebhookInput }`으로 사용되는 것으로 보아 공개 타입이지만 JSDoc 없음.
- 제안: `/** Normalized webhook request input passed to handleWebhook(). */` 추가

---

**[INFO]** `V011__schedule_parameter_values.sql` 마이그레이션 주석 — 스펙 참조 정확도
- 위치: `V011__schedule_parameter_values.sql` 2행
- 상세: `spec/1-data-model.md §2.9`를 참조하나, 실제 데이터모델 문서의 Schedule 섹션 번호가 §2.9인지 확인 불가 (섹션 번호 없는 마크다운). 유지보수 시 참조가 깨질 수 있음.
- 제안: 섹션 번호 대신 섹션 제목 기반 참조 사용 또는 앵커 링크 사용: `-- See: spec/1-data-model.md (Schedule 테이블)`

---

### 요약

전체적으로 이번 변경은 스펙 문서(PRD, trigger-nodes.md, execution-engine.md, webhook.md)를 구현에 맞게 업데이트하고 있어 SDD 방법론을 잘 따르고 있다. `ManualTriggerHandler`의 JSDoc, `resolveScheduleParameters()`의 퍼블릭 메서드 JSDoc은 양호하게 작성되어 있다. 다만, `loadTriggerParameterSchema()`가 컨트롤러/서비스/훅 세 곳에 중복 구현되어 있음에도 문서화나 TODO 없이 방치되어 있고, 핵심 스펙 문서(6.1.1)의 시그니처가 실제 구현과 불일치하는 점이 가장 주목할 이슈다. 나머지는 인라인 주석 보강 수준의 경미한 사항이다.

### 위험도

**LOW**