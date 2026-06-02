# Requirement Review

## 발견사항

### **[WARNING]** Spec 에 "Principle 3-C" 정의가 없음 — 코드가 미정의 spec 에 다수 참조
- 위치: `spec/conventions/i18n-userguide.md` 전체 (현재 Principle 3, 3-B 만 존재)
- 상세: 코드·테스트·plan 전반에서 "i18n Principle 3-C" 를 핵심 근거로 참조하나, `spec/conventions/i18n-userguide.md` 어디에도 "Principle 3-C" 는 정의돼 있지 않다. 현 spec 의 `##errorCode 의 처리 (현재 갭)` 절은 `ERROR_KO` 를 "후속 plan 검토" 사항으로 기술하며, `GRAPH_WARNING_KO` / `translateGraphWarning` / `params` 보간 메커니즘은 spec 본문에 아예 등장하지 않는다. plan `backend-msg-i18n-impl.md` 의 Phase 0 에 "Principle 3-C 승격"이 완료로 표시되어 있으나, 실제 spec 파일에는 해당 내용이 반영되지 않았다. spec 본문이 구현을 정의하지 않은 채 구현이 완료된 상태다.
- 제안: `project-planner` 에게 위임 — `i18n-userguide.md` 에 Principle 3-C 절 추가 (`ERROR_KO` 신설·`GRAPH_WARNING_KO`·`translateBackendError`/`translateGraphWarning`·`params` 계약·P3-C-1/P3-C-2 가드를 spec 요구사항으로 정식화). 본 reviewer 는 spec 직접 수정 금지.

---

### **[WARNING]** `cross-node-warning-rules.md §3` `GraphWarningRuleResult` 타입 정의에 `params` 필드가 없음 — spec vs 구현 불일치
- 위치: `spec/conventions/cross-node-warning-rules.md` L66–72 (`GraphWarningRuleResult` 인터페이스 정의)
- 상세: spec 의 `GraphWarningRuleResult` 타입 블록에는 `ruleId / severity / nodeId / message` 4개 필드만 있고 `params?` 가 없다. 그러나 구현(`types.ts`)은 `params?: Record<string, string | number>` 를 추가했다. 또한 spec §3 의 `GraphWarningRule.evaluate` 반환 시그니처도 `{ message: string } | null` 로 고정되어 있어 구현의 `{ message; params? } | null` 과 다르다.
- 제안: `project-planner` 위임 — spec §3 타입 블록에 `params?` 필드와 `evaluate` 반환 타입 변경을 반영.

---

### **[INFO]** e2e 테스트(파일 2) 에서 `params.grand` 단언이 실제 rule 구현과 일치하는지 확인
- 위치: `codebase/backend/test/graph-warning-save.e2e-spec.ts` L285–286 (diff 기준), `codebase/packages/graph-warning-rules/src/rules/parallel.ts` L88–92
- 상세: e2e 테스트는 `depthErr!.params` 에 `{ node, child, grand }` 키가 있어야 한다고 단언한다. shared package `parallel.ts` 도 동일하게 `{ node, child, grand }` 를 반환하므로 단언과 구현이 일치한다. 그러나 e2e 는 실제 HTTP 응답 shape 에서 `params` 를 검증하므로, backend `WorkflowsService` 가 `GraphWarningRuleResult.params` 를 `details.errors[]` 에 그대로 직렬화하는 경로가 코드 변경 없이(plan Phase 2 "자동 전파") 정상 동작한다고 가정한다. 해당 전파 경로(`workflows.service.ts`, `GlobalExceptionFilter` 직렬화)를 별도로 확인하지 않으면 e2e 가 첫 실행에서 실패할 수 있다.
- 제안: 리뷰 수준에서 INFO — 실제 `WorkflowsService` 에서 `results` 를 `details.errors` 에 spread 하는 코드를 확인해 `params` 직렬화 경로가 존재하는지 검증 권장.

---

### **[INFO]** `GRAPH_WARNING_KO` 한국어 템플릿의 `{{node}}` placeholder 명명이 영문 `message` 의 의미론과 다를 수 있음
- 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` `GRAPH_WARNING_KO["parallel:nested-depth-exceeded"]` 템플릿
- 상세: 템플릿 문자열이 `"{{node}}" ... "{{child}}" ... "{{grand}}"` 를 사용한다. `params` 키(`node`, `child`, `grand`)와 일치하므로 보간 자체는 정확하다. 단, `interpolate()` 가 미지정 placeholder 를 빈 문자열로 대체(개발 모드 경고 후 silent) 하므로, 향후 rule 이 변경되어 키 이름이 바뀌면 사용자에게 빈 문자열이 그대로 노출된다. `translateGraphWarning` 에 fallback 처리가 있어(매핑 없으면 영문 `message` 반환) 부분 보간 실패는 커버 안 된다.
- 제안: INFO 수준 — 향후 rule 변경 시 ko 템플릿과 `params` 키 동기화 체크리스트 추가 권장.

---

### **[INFO]** `editor-toolbar.tsx` 의 저장 버튼 `title` 에 `translateBackendError` 대신 `translateGraphWarning` 사용
- 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` L1401–1407
- 상세: plan Phase 3 항목 "저장 거부 toast/title 이 `translateBackendError('GRAPH_VALIDATION_FAILED', ...)` 적용"이 있으나, 실제 구현은 error rule 의 `translateGraphWarning` 을 사용해 rule 메시지를 직접 title 로 표시한다. plan 주석(`"저장 버튼은 hasError 시 local 평가로 이미 차단되어 title 은 translateGraphWarning 으로 rule 메시지 직접 표시"`)에 이 결정이 설명되어 있으므로 의도적인 변경으로 보인다. `translateBackendError` 는 신설되어 export 되지만 현재 코드에서 호출 위치가 없다. `translateBackendError` 가 미사용 export 로 남는다.
- 제안: INFO — `translateBackendError` 의 의도된 호출처(예: API 오류 toast)가 향후 PR 에 추가되는지 추적 필요. 현재 export 만 되고 미사용인 상태는 기능 누락이 아닌 점진적 확장 의도.

---

### **[INFO]** `no-internal-refs.test.ts` 금지 목록에서 `GRAPH_WARNING_KO` 누락 케이스 처리 방식
- 위치: `codebase/frontend/src/lib/docs/__tests__/no-internal-refs.test.ts` L1949
- 상세: 변경된 정규식이 `GRAPH_WARNING_KO` 를 추가해 사용자 가이드 본문에 이 식별자가 노출되면 hard fail 한다. 신규 추가된 `validation-errors.mdx` / `.en.mdx` 는 `GRAPH_WARNING_KO` 를 언급하지 않으므로 즉시 충돌은 없다. 정상적으로 보인다.

---

## 요약

변경은 "i18n Principle 3-C" 라는 명칭으로 설계·구현된 동적 그래프 경고 메시지의 한국어 localization 기능을 완성한다. shared package 타입 계약(`params?` 추가), rule 구현(두 parallel rule 에 params 노출), frontend 매핑 테이블(`GRAPH_WARNING_KO` / `ERROR_KO`), 변환 함수(`translateGraphWarning` / `translateBackendError`), UI 배선(custom-node tooltip, toolbar save button title), 자동 가드(P3-C-1/P3-C-2 테스트), 사용자 가이드 문서 등 기능 범위가 일관되게 구현되어 있다. 그러나 이 기능의 핵심 근거인 "Principle 3-C" 가 `spec/conventions/i18n-userguide.md` 에 정의되지 않았고, `cross-node-warning-rules.md §3` 의 타입 블록도 `params` 필드를 반영하지 않아 spec 본문과 구현 간 이중 불일치가 존재한다. 기능 자체의 완전성과 정확성에는 큰 결함이 없으나, spec 미반영 상태로 구현이 완료된 점이 SDD 원칙 위반이며 `project-planner` 에 의한 spec 갱신이 필요하다.

## 위험도

MEDIUM
