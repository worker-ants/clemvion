## 발견사항

- **[INFO]** `get_current_workflow` 도구 추가 — 완전한 하위 호환 확장
  - 위치: `tool-definitions.ts`, `TOOL_KIND_BY_NAME` 및 `buildAssistantTools()`
  - 상세: 기존 탐색 도구 목록에 신규 항목을 추가한 것으로, 기존 클라이언트(LLM 및 프론트엔드)에 breaking change 없음. `additionalProperties: false`로 스키마 오염을 방지하고 있음.
  - 제안: 이상 없음.

- **[WARNING]** SSE 이벤트 타입: 스펙과 구현 간 사전 존재 불일치 (이번 변경이 악화시키지는 않음)
  - 위치: `spec/4-ai-assistant.md §5.3` vs `workflow-assistant-stream.service.ts`
  - 상세: 스펙은 편집 도구 결과를 `event: edit`으로 문서화하고 있으나, 구현은 `explore`·`edit` 양쪽 모두 `event: tool_call`을 사용하고 `kind` 필드로 구분함. 이번 변경은 이 패턴을 그대로 따르므로 기존 불일치가 유지될 뿐 신규 계약 위반은 없음.
  - 제안: 스펙을 구현 기준에 맞게 정정하거나, 반대로 구현에서 별도 이벤트 타입을 복원하는 것을 별도 이슈로 추적할 것.

- **[INFO]** `buildCurrentWorkflowResult` 반환 필드 명명이 요청 바디와 다름 — 의도적
  - 위치: `workflow-assistant-stream.service.ts:buildCurrentWorkflowResult`
  - 상세: 엣지 필드가 `source`/`target`으로 반환되나, `AssistantMessageRequest.currentWorkflow.edges`는 `sourceNodeId`/`targetNodeId`를 사용함. 이는 LLM 도구 결과(읽기 전용 요약)와 REST 요청 바디의 역할 구분에서 비롯된 의도적 차이로 보임. 스펙 §4.1 표에는 필드 명세가 생략되어 있어 모호성이 있음.
  - 제안: 스펙 `get_current_workflow` 반환 예시에 실제 필드명(`source`, `target`)을 명시해 두면 혼란을 방지할 수 있음.

- **[INFO]** `get_workflow` 설명 변경 — 스키마 무변경, 설명 문자열만 수정
  - 위치: `tool-definitions.ts:91`
  - 상세: 현재 워크플로우 조회 금지 지침이 명확해졌을 뿐, 파라미터 스키마·반환값·필수 필드는 동일. LLM이 학습한 동작 가이드라인이 변경되지만 계약 호환성은 유지됨.
  - 제안: 이상 없음.

- **[INFO]** `frontend/package-lock.json` 변경 — API 계약과 무관
  - 위치: `package-lock.json` 전체
  - 상세: `"peer": true` 메타데이터 재정렬 및 `@rolldown/binding-wasm32-wasi` 하위 패키지 추가. 런타임 API에 영향 없음.

---

## 요약

이번 변경은 `get_current_workflow`라는 탐색 전용 도구를 LLM function-calling 계약에 추가한 것으로, 모두 하위 호환적 확장이다. 새 도구는 기존 `explore` kind 패턴을 정확히 따르고, 반환 스키마는 시스템 프롬프트 스냅샷과 동일한 redaction 정책을 적용하며, `TOOL_KIND_BY_NAME` 등록도 일관성이 있다. 사전에 존재하는 스펙·구현 간 SSE 이벤트 타입 불일치(`edit` vs `tool_call`)는 이번 변경으로 악화되지 않았으나 별도 정리가 권장된다. `get_current_workflow` 반환 필드명(`source`/`target`)이 요청 바디 필드명(`sourceNodeId`/`targetNodeId`)과 다른 점은 스펙에 명시적으로 기록하면 충분하다.

### 위험도

**LOW**