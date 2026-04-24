### 발견사항

- **[INFO]** `hint` 필드가 에러 코드별로 불일치하게 적용됨
  - 위치: `explore-tools.service.ts` — `getWorkflowExecutions`, `getExecutionDetails`
  - 상세: `INVALID_ID` 에러에만 `hint` 필드가 포함되고, `WORKFLOW_NOT_FOUND` / `EXECUTION_NOT_FOUND` / `EXECUTION_NOT_IN_SCOPE` 에는 없음. LLM이 에러 응답을 해석할 때 가이드 일관성이 떨어짐
  - 제안: 모든 에러 응답에 `hint` 필드를 추가하거나 (`EXECUTION_NOT_IN_SCOPE`의 경우 "Open that workflow's editor to query its executions"), 의도적으로 `INVALID_ID` 에만 붙이는 경우 스펙 문서에 명시

- **[INFO]** `EXECUTION_NOT_IN_SCOPE` 에러 코드가 실행 id의 존재를 암묵적으로 노출
  - 위치: `explore-tools.service.ts:isExecutionInScope` 분기
  - 상세: 워크스페이스 경계 위반은 `EXECUTION_NOT_FOUND` 로 통합해 정보 누출을 차단했지만, `EXECUTION_NOT_IN_SCOPE` 는 "해당 id의 실행이 이 워크스페이스 내 다른 워크플로에 있다"는 사실을 간접 노출함. 스펙(§4.1.1, memory doc)에서 이 동작이 의도된 것("Open that workflow's editor" 유도)으로 명시되어 있어 설계상 선택임은 확인됨
  - 제안: 현 설계 유지 시 스펙 "에러 코드" 표에 "존재 여부 노출 의도됨" 을 한 줄 추가해 향후 보안 리뷰에서 오해받지 않도록 명시화 권장

- **[INFO]** `get_workflow_executions` 응답에 `triggerId` 가 포함되지만 도구 description에 미기재
  - 위치: `tool-definitions.ts` `get_workflow_executions` description, `explore-tools.service.ts` 매핑
  - 상세: 서비스는 `triggerId: e.triggerId ?? null` 을 반환하지만, LLM에 전달되는 tool description의 items 필드 목록(`id, status, startedAt, finishedAt, durationMs, triggerId, nodeStats`)에 명기되어 있어 불일치는 아님. 그러나 spec §4.1 표에는 열거되지 않아 스펙-구현 간 미세한 불일치 존재
  - 제안: spec §4.1 응답 컬럼에 `triggerId?` 추가

- **[INFO]** `get_workflow_executions` 에 cursor/offset 페이지네이션 없음
  - 위치: `explore-tools.service.ts:getWorkflowExecutions`, `clampLimit()`
  - 상세: `limit` 기반 최신 N건 절단만 지원. 상한 50건을 초과하는 이력을 탐색할 수 없음. MVP 범위에서 의도된 제한(memory doc "열린 주제" 기록)이나, 대량 실행이 쌓이면 오래된 실패 실행을 LLM이 조회하지 못하는 문제 발생 가능
  - 제안: 단기엔 현행 유지, 이후 `before?: ISO8601` 커서 파라미터 추가를 검토

---

### 요약

이번 변경은 기존 탐색 도구 6종의 패턴(`{ok, ...}` 응답 envelope, workspace 스코프 격리, `INVALID_ID` UUID 선처리)을 일관되게 따르는 순수 additive 추가이다. 기존 도구 정의·서비스 인터페이스는 전혀 수정되지 않아 하위 호환성 위반이 없으며, 에러 코드·마스킹 규칙·스코프 정책이 스펙(§4.1.1)과 구현 사이에 정합된다. 단, `hint` 필드의 불균일한 적용과 `EXECUTION_NOT_IN_SCOPE`의 의도된 정보 노출이 향후 보안 리뷰 시 혼선을 줄 수 있으므로 스펙 주석으로 명시화할 것을 권장한다. LLM function-calling 도구 계층이므로 HTTP 상태 코드·URL 설계·전통적 API 버전 관리는 해당 없음.

### 위험도
LOW