### 발견사항

---

**[INFO]** `BuildReviewChecklistInput.nodeDefs` — 필수 필드 추가로 인한 내부 인터페이스 계약 변경

- 위치: `review-workflow.ts` — `BuildReviewChecklistInput` 인터페이스
- 상세: `nodeDefs: NodeDefinitionView[]` 가 기존 인터페이스에 필수 필드로 추가됨. `buildReviewChecklist()` 를 직접 호출하는 모든 코드가 컴파일 타임 브레이킹 체인지를 겪는다. 스트림 서비스는 `this.nodeRegistry.listDefinitions()` 를 올바르게 전달하고 있으며, 테스트 헬퍼는 `nodeDefs: []` 기본값으로 기존 테스트들을 보호한다. `nodeDefs: []` 일 때 검사를 no-op 처리하는 설계로 내부 하위 호환성은 유지됨.
- 제안: 이 함수가 공개 모듈 경계를 넘는지 확인 필요. 현재 `stream.service.ts` 가 유일한 실사용 호출자라면 영향 없음.

---

**[INFO]** `ReviewChecklistCode` union 타입 확장 — `DANGLING_OUTPUT_PORTS` 추가

- 위치: `review-workflow.ts` — `ReviewChecklistCode` 타입 정의
- 상세: LLM 이 `finish` 응답으로 받는 `WORKFLOW_REVIEW_REQUIRED` 페이로드의 `checklist[*].code` 에 새 값이 추가됨. 클라이언트(LLM 또는 프론트엔드)가 이 코드를 exhaustive switch 로 처리하고 있다면 핸들러 누락이 발생할 수 있다. 시스템 프롬프트에 해당 코드 처리 방법이 명시되어 LLM 계약은 갱신됨.
- 제안: 프론트엔드 코드에서 `checklist.code` 를 switch 처리하는 곳이 있다면 `DANGLING_OUTPUT_PORTS` 케이스 추가 확인.

---

**[INFO]** `WORKFLOW_REVIEW_REQUIRED` 응답 — `data` 필드 신규 스키마

- 위치: `review-workflow.ts` — `ReviewChecklistItem.data` JSDoc + `collectDanglingOutputPorts`
- 상세: `DANGLING_OUTPUT_PORTS` 코드일 때 `data` 는 `{ nodeId, nodeLabel, nodeType, portId, portLabel }[]` 구조를 가짐. 기존 코드들 (`ORPHAN_NODES`, `UNRESOLVED_FAILED_CALLS` 등) 과 동일한 패턴으로 추가되었으며 JSDoc 에 명시됨. LLM 이 `add_edge source_port` 를 한 라운드에 정확히 지정할 수 있도록 필요한 정보가 포함된 최소 충분 구조.
- 제안: 없음 (기존 패턴 일관성 유지됨).

---

**[INFO]** SSE `done` 이벤트 `finishReason` 정규화 확장

- 위치: `workflow-assistant-stream.service.ts` — `planPending` 블록
- 상세: 이전 리뷰(`api_contract/review.md`)에서 이미 지적된 사항의 범위가 이번 변경으로 확장됨. `finishReason` 이 서버에서 `'tool_calls'` → `'stop'` 으로 정규화되는 조건이 두 가지 경로(`finishResolved=true` 기존 경로 + `planPending` 신규 경로)로 늘어남. 클라이언트가 `finishReason` 을 프로바이더 원문으로 신뢰하는 계약은 이미 성립하지 않으며, 이번 변경은 기존 정규화 패턴을 일관되게 확장함.
- 제안: `AssistantStreamEvent` 타입 주석에 `finishReason: 'stop' | 'tool_calls' | 'error'` 와 "provider raw 값 아님" 을 문서화하는 것은 여전히 유효한 권고사항.

---

### 요약

이번 변경에서 공개 HTTP API 엔드포인트·요청 스키마·HTTP 상태 코드에 대한 변경은 없다. API 계약 관점의 변경은 (1) `buildReviewChecklist` 내부 인터페이스에 필수 필드 추가, (2) LLM-facing tool result의 `checklist.code` union 확장, (3) `DANGLING_OUTPUT_PORTS` 에 대한 신규 `data` 스키마 정의, (4) SSE `done.finishReason` 정규화 경로 확장이다. 모두 기존 패턴과 일관되는 additive 변경이며, 시스템 프롬프트 갱신으로 LLM 계약도 동기화되어 있다. 프론트엔드 코드에서 `ReviewChecklistCode` 를 exhaustive 처리하는 곳이 있다면 `DANGLING_OUTPUT_PORTS` 케이스 누락 여부를 확인하는 것이 유일한 실질적 조치 사항이다.

### 위험도
**LOW**