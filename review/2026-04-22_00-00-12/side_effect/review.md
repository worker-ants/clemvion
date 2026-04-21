## 부작용 코드 리뷰

### 발견사항

---

**[INFO]** `get_current_workflow` SSE 이벤트가 프론트엔드로 방출됨
- 위치: `workflow-assistant-stream.service.ts` — `if (kind === 'edit' || kind === 'explore')` 분기
- 상세: `get_current_workflow` 결과가 `tool_call` SSE 이벤트로 방출되어, 프론트엔드가 탐색 배지(🔍)를 렌더링할 가능성이 있음. `spec/4-ai-assistant.md §5.3`의 `tool_call (kind=explore)` 이벤트 처리 정책과 일치하므로 의도된 동작이나, 클라이언트 UI가 workflow 전체 데이터를 배지로 노출하지 않는지 확인 필요.
- 제안: 프론트엔드에서 `get_current_workflow` 배지를 `list_integrations` 등과 동일하게 "요약 한 줄 + 접기/펼치기" 형태로 처리하는지 검토.

---

**[WARNING]** 시스템 프롬프트 스냅샷과 `get_current_workflow` 결과 간 엣지 스키마 불일치
- 위치: `system-prompt.ts:44–49` vs. `workflow-assistant-stream.service.ts:buildCurrentWorkflowResult` (라인 ~453–460)
- 상세: 시스템 프롬프트 스냅샷은 엣지에 `{ source, sourcePort, target, targetPort, type }` 만 포함하며 **`id` 없음**. 반면 `buildCurrentWorkflowResult`는 `{ id, source, sourcePort, target, targetPort, type }`를 반환함. `remove_edge` 도구는 `id`를 필수 파라미터로 요구하므로, LLM이 시스템 프롬프트 스냅샷만 보고 `remove_edge`를 호출하면 엣지 ID를 알 수 없어 실패함. `get_current_workflow` 호출이 이 문제를 해결하는 우회책이 되지만, 프롬프트 스냅샷이 불완전함.
- 제안: `buildSystemPrompt`의 엣지 매핑에도 `id: e.id` 필드를 추가해 두 스냅샷 포맷을 일치시키거나, `remove_edge`의 파라미터를 ID 대신 `{source, target, sourcePort}` 조합으로 식별 가능하도록 개선.

---

**[INFO]** `get_current_workflow` 도구 정의에 `required` 배열 누락
- 위치: `tool-definitions.ts:112–118`
- 상세: 파라미터가 없는 도구이므로 기능상 문제없으나, 일부 LLM API(특히 엄격한 JSON Schema 검증을 수행하는 경우)에서 `required: []` 없이 `properties: {}` 만 있는 스키마를 비표준으로 처리할 가능성이 있음. `list_knowledge_bases`도 동일한 패턴을 사용하고 있어 프로젝트 내 일관성은 유지됨.
- 제안: 현 패턴이 기존 `list_knowledge_bases`와 동일하므로 수정 불필요. 다른 LLM provider 테스트 시 문제가 발생하면 `required: []` 추가 검토.

---

**[INFO]** `package-lock.json` — `peer: true` 플래그 다수 제거
- 위치: `frontend/package-lock.json` — `react`, `react-dom`, `react-hook-form`, `zod`, `redux`, `immer`, `d3-selection` 등
- 상세: 이 패키지들이 실제로 `package.json`의 `dependencies`에 직접 선언되어 있으므로 peer 마킹 제거는 npm의 lockfile 재생성으로 인한 올바른 재분류임. 기능적 부작용 없음. 단, 이 변경이 `npm install` 결과의 부산물이라면 다른 개발자 환경에서도 동일하게 재현되므로 문제없음.
- 제안: 없음.

---

**[INFO]** `redactConfig` 결과가 DB에 영구 저장됨
- 위치: `workflow-assistant-stream.service.ts` — `pendingToolCalls.push({..., result, ...})` → `persistAssistantTurn`
- 상세: `get_current_workflow` 결과(`redactConfig` 적용된 config)가 `assistant_message.toolCalls[].result`로 DB에 저장됨. 이는 기존 explore 도구들과 동일한 패턴이며, `[REDACTED]` 치환이 적용되므로 비밀 정보 노출 없음. 다음 턴 히스토리 재수화 시 이 결과가 LLM context에 포함되어 캔버스 상태를 간접적으로 제공함.
- 제안: 없음. 보안 관점에서 적절한 처리임.

---

### 요약

이번 변경의 핵심은 `get_current_workflow` 도구를 새로 추가하고, 시스템 프롬프트에 스냅샷을 권위적 소스로 명시하는 것이다. 새 도구는 기존 explore 분기에 격리 조건(if-else)으로 추가되어 기존 도구 흐름에 영향을 주지 않으며, `redactConfig` 적용으로 보안 일관성도 유지된다. `TOOL_KIND_BY_NAME` 맵 추가와 서비스 내 조건 분기 모두 단방향 확장으로 기존 코드 경로를 건드리지 않는다. 주목할 유일한 실질적 문제는 시스템 프롬프트 스냅샷의 엣지 스키마에 `id`가 없어 `remove_edge` 직접 호출이 어렵다는 **기존 불일치**이며, 이번 변경에서 `buildCurrentWorkflowResult`가 `id`를 포함함으로써 부분적으로 해소되나 프롬프트 스냅샷과의 포맷 괴리는 남아 있다.

### 위험도

**LOW**